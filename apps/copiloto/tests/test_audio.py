"""Tests de `POST /chat/audio` (voz-backend, front-door del Copiloto): recibe una nota de voz
(`multipart/form-data`: `session_id` + `audio`), la transcribe (`transcribe`, INYECTABLE -- mismo
criterio que el resto del composition root de `web.py`) y la mete al MISMO flujo de dispatch que
`/chat` (`route_inbound` con `kind="text"`, texto=transcript) -- la voz es solo OTRA fuente de
texto para el agente, nunca un camino de dispatch aparte.

TestClient con deps FAKE (mismo patrón que test_web_app.py/test_connect_endpoints.py -- sin infra
real): `require_tenant` fijo o 401, `route_inbound` monkeypatcheado para spiar cliente_id/texto/
kind, y un `transcribe` fake inyectado para no pegarle a Groq real en los tests."""
from __future__ import annotations

import sys
import urllib.error
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ARCH = APP.parents[1] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(APP))

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import web as web_module
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.crypto import FernetCrypto


# --- fakes compartidos (mismo criterio que test_web_app.py) ---------------------

class _FakeTemporal:
    """Standin: `route_inbound` se monkeypatchea; este objeto solo viaja como 1er posicional."""


async def _fake_route_inbound(client, *, adapter, cliente_id, domain, task_queue, raw_update):
    msg = adapter.normalize_inbound(raw_update)
    if msg is None:
        return None
    return f"conv-web-{cliente_id}-{msg.channel_ref}"


def _require_tenant_fixed(cliente_id: str):
    def _dep() -> str:
        return cliente_id
    return _dep


def _require_tenant_401():
    def _dep() -> str:
        raise HTTPException(status_code=401, detail="missing or malformed Authorization header")
    return _dep


class _FakeMpGateway:
    def connect_url(self, state):
        return f"https://mp.example/auth?state={state}"


class _FakeComposioGateway:
    def list_connections(self, user_id):
        return []

    def authorize(self, user_id, toolkit):
        return f"https://composio.example/connect?user={user_id}&toolkit={toolkit}"


@pytest.fixture(autouse=True)
def _mp_fernet_key_env(monkeypatch):
    """`create_web_app` construye un `FernetCrypto()` propio (para /me/mp-connect) sin importar si
    este archivo ejercita esas rutas -- mismo fixture que el resto de la suite de web.py."""
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())


def _build_app(*, require_tenant, transcribe=None):
    return web_module.create_web_app(
        temporal_client=_FakeTemporal(),
        adapter=WebChannelAdapter(reply_sink=lambda *a: None),
        conn_factory=lambda: None,   # /chat/audio no toca DB -- ya cubierto en test_web_app.py
        require_tenant=require_tenant,
        mp_app=FastAPI(),
        gotrue=None,
        mp_gateway=_FakeMpGateway(),
        composio_gateway=_FakeComposioGateway(),
        transcribe=transcribe,
    )


def _post_audio(app, *, session_id: str = "s1", audio_bytes: bytes = b"fake-audio-bytes",
               filename: str = "clip.webm", content_type: str = "audio/webm"):
    return TestClient(app).post(
        "/chat/audio",
        data={"session_id": session_id},
        files={"audio": (filename, audio_bytes, content_type)},
    )


# --- 401 sin token ---------------------------------------------------------------

def test_chat_audio_without_token_returns_401():
    app = _build_app(require_tenant=_require_tenant_401(), transcribe=lambda b, ct: "hola")
    r = _post_audio(app)
    assert r.status_code == 401


# --- 200: transcribe + mismo flujo que /chat --------------------------------------

def test_chat_audio_transcribes_and_routes_like_chat(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    calls: list[tuple[bytes, str]] = []

    def _fake_transcribe(audio_bytes: bytes, content_type: str) -> str:
        calls.append((audio_bytes, content_type))
        return "quiero un turno para mañana"

    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_fake_transcribe)
    r = _post_audio(app, session_id="s1", audio_bytes=b"raw-bytes", content_type="audio/webm")
    assert r.status_code == 200
    body = r.json()
    assert body == {"wf_id": "conv-web-cid-A-s1", "accepted": True,
                    "transcript": "quiero un turno para mañana"}
    assert calls == [(b"raw-bytes", "audio/webm")]        # el transcriber recibió los bytes reales


def test_chat_audio_different_tenants_route_to_their_own_wf_id(monkeypatch):
    """Multitenant real: el MISMO front-door, otro token -> otro cliente_id -> otro wf_id."""
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app = _build_app(require_tenant=_require_tenant_fixed("cid-B"), transcribe=lambda b, ct: "hola")
    r = _post_audio(app, session_id="s1")
    assert r.json()["wf_id"] == "conv-web-cid-B-s1"


# --- 422: transcript vacío (audio ininteligible / silencio) -----------------------

def test_chat_audio_empty_transcript_returns_422(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: "")
    r = _post_audio(app)
    assert r.status_code == 422


def test_chat_audio_whitespace_only_transcript_returns_422(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: "   ")
    r = _post_audio(app)
    assert r.status_code == 422


# --- 503: voz no configurada (sin GROQ_API_KEY, transcriber default) --------------

def test_chat_audio_without_groq_key_returns_503(monkeypatch):
    """Sin `transcribe` inyectado (default de producción = GroqSTT real) y sin `GROQ_API_KEY` en el
    env: `GroqSTT.transcribe` levanta `RuntimeError` ANTES de pegarle a la red (ver stt.py) -- la
    ruta lo traduce a 503, nunca 500, y NUNCA intenta la llamada HTTP real (test seguro sin red)."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))   # transcribe=None -> default
    r = _post_audio(app)
    assert r.status_code == 503


# --- 502: error de transporte/API del servicio de transcripción -------------------

def test_chat_audio_transport_error_returns_502(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)

    def _flaky_transcribe(audio_bytes: bytes, content_type: str) -> str:
        raise urllib.error.URLError("timeout")

    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_flaky_transcribe)
    r = _post_audio(app)
    assert r.status_code == 502
