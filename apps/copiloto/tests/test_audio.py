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


import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import web as web_module
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.crypto import FernetCrypto


# --- fakes compartidos (mismo criterio que test_web_app.py) ---------------------

class _FakeTemporal:
    """Standin: `route_inbound` se monkeypatchea; este objeto solo viaja como 1er posicional."""


async def _fake_route_inbound(client, *, adapter, cliente_id, domain, task_queue, raw_update, extra_config=None):
    # extra_config: la app pasa {"memory": False} (apagada en el hito 5 §2). El fake lo acepta para no romper el
    # contrato de route_inbound; el ruteo del wf_id no depende de él.
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
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


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


# D6: firma EBML real (`OggS`/`ftyp`/etc. según formato) -- desde que `web.py` valida magic bytes,
# un blob fake sin firma se rechaza con 415 ANTES de llegar a `transcribe`, y estos tests dejarían
# de probar lo que dicen probar.
_WEBM_HEADER = b"\x1a\x45\xdf\xa3"


def _post_audio(app, *, session_id: str = "s1", audio_bytes: bytes = _WEBM_HEADER + b"fake-audio-bytes",
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
    audio_bytes = _WEBM_HEADER + b"raw-bytes"
    r = _post_audio(app, session_id="s1", audio_bytes=audio_bytes, content_type="audio/webm")
    assert r.status_code == 200
    body = r.json()
    assert body == {"wf_id": "conv-web-cid-A-s1", "accepted": True,
                    "transcript": "quiero un turno para mañana"}
    assert calls == [(audio_bytes, "audio/webm")]        # el transcriber recibió los bytes reales


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


# --- 413: audio demasiado grande (cap de RAM del front-door compartido, review HIGH-1) ------

def test_chat_audio_oversized_returns_413(monkeypatch):
    """Un upload mayor al cap se rechaza con 413 ANTES de transcribir -> no OOM-ea el front-door
    compartido por todas las tenants. Bajamos el cap a 5 bytes para el test."""
    monkeypatch.setattr(web_module, "MAX_AUDIO_BYTES", 5)
    called = {"n": 0}

    def _t(audio_bytes: bytes, content_type: str) -> str:
        called["n"] += 1
        return "no debería llegar acá"

    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_t)
    r = _post_audio(app, audio_bytes=b"esto-supera-los-cinco-bytes")
    assert r.status_code == 413
    assert called["n"] == 0   # rechazó antes de transcribir


# --- 415: magic bytes no coinciden con el content_type declarado (D6) -------------

def test_chat_audio_content_type_mentido_returns_415_y_no_transcribe(monkeypatch):
    """El cliente declara `audio/webm` pero los bytes reales son un JPEG -- D6 (deuda registrada):
    extensión/content-type es un dato del cliente, no una prueba. Debe rechazar ANTES de pegarle a
    Groq, no confiar en la etiqueta."""
    called = {"n": 0}

    def _t(audio_bytes: bytes, content_type: str) -> str:
        called["n"] += 1
        return "no debería llegar acá"

    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_t)
    r = _post_audio(app, audio_bytes=b"\xff\xd8\xffno-es-un-webm", content_type="audio/webm")
    assert r.status_code == 415
    assert called["n"] == 0


def test_chat_audio_content_type_desconocido_returns_415(monkeypatch):
    """`content_type` fuera de la whitelist de firmas conocidas -> fail-closed, aunque los bytes
    pudieran ser audio real de un formato no contemplado."""
    called = {"n": 0}

    def _t(audio_bytes: bytes, content_type: str) -> str:
        called["n"] += 1
        return "no debería llegar acá"

    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_t)
    r = _post_audio(app, audio_bytes=_WEBM_HEADER + b"x", content_type="application/octet-stream")
    assert r.status_code == 415
    assert called["n"] == 0
