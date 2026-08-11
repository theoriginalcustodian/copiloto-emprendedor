"""Tests de `POST /soporte/chat/audio` (ODOBI8 §C1): fusiona `/chat/audio` (STT: cap de tamaño,
transcripción, manejo de errores -- ver test_audio.py) con `/soporte/chat` (validación de `funcion`
+ namespacing idempotente de `channel_ref` -- ver test_web_app.py). No re-prueba lo que cada mitad
ya cubre por separado; sólo lo que es propio de la fusión (`funcion` inválida ANTES de transcribir,
namespacing con transcript real) + una pasada de humo de cada caso heredado.

TestClient con deps FAKE (mismo patrón que test_audio.py): `require_tenant` fijo o 401,
`route_inbound` monkeypatcheado para spiar cliente_id/texto/kind, `transcribe` fake inyectado."""
from __future__ import annotations

import urllib.error

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import web as web_module
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.crypto import FernetCrypto


class _FakeTemporal:
    """Standin: `route_inbound` se monkeypatchea; este objeto solo viaja como 1er posicional."""


async def _fake_route_inbound(client, *, adapter, cliente_id, domain, task_queue, raw_update, extra_config=None):
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
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


def _build_app(*, require_tenant, transcribe=None):
    return web_module.create_web_app(
        temporal_client=_FakeTemporal(),
        adapter=WebChannelAdapter(reply_sink=lambda *a: None),
        conn_factory=lambda: None,   # /soporte/chat/audio no toca DB directamente
        require_tenant=require_tenant,
        mp_app=FastAPI(),
        gotrue=None,
        mp_gateway=_FakeMpGateway(),
        composio_gateway=_FakeComposioGateway(),
        transcribe=transcribe,
    )


def _post_soporte_audio(app, *, session_id: str = "s1", funcion: str = "soporte_tecnico",
                        audio_bytes: bytes = b"fake-audio-bytes", filename: str = "clip.webm",
                        content_type: str = "audio/webm"):
    return TestClient(app).post(
        "/soporte/chat/audio",
        data={"session_id": session_id, "funcion": funcion},
        files={"audio": (filename, audio_bytes, content_type)},
    )


# --- 401 sin token ---------------------------------------------------------------

def test_soporte_chat_audio_without_token_returns_401():
    app = _build_app(require_tenant=_require_tenant_401(), transcribe=lambda b, ct: "hola")
    r = _post_soporte_audio(app)
    assert r.status_code == 401


# --- 400: función inválida ANTES de transcribir (C4, mismo criterio que /soporte/chat) ----------

def test_soporte_chat_audio_funcion_invalida_es_400_y_no_transcribe(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    called = {"n": 0}

    def _t(audio_bytes: bytes, content_type: str) -> str:
        called["n"] += 1
        return "no debería llegar acá"

    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_t)
    r = _post_soporte_audio(app, funcion="atencion_al_cliente")
    assert r.status_code == 400
    assert called["n"] == 0   # rechazó antes de gastar STT en una función que ya sabía inválida


# --- 200: transcribe + namespacing por función (fusión de las dos mitades) ----------------------

def test_soporte_chat_audio_transcribe_y_namespacea_por_funcion(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    calls: list[tuple[bytes, str]] = []

    def _fake_transcribe(audio_bytes: bytes, content_type: str) -> str:
        calls.append((audio_bytes, content_type))
        return "necesito ayuda con AFIP"

    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_fake_transcribe)
    r = _post_soporte_audio(app, session_id="s1", funcion="soporte_tecnico",
                            audio_bytes=b"raw-bytes", content_type="audio/webm")
    assert r.status_code == 200
    body = r.json()
    assert body == {"wf_id": "conv-web-cid-A-soporte:soporte_tecnico:s1", "accepted": True,
                    "session_id": "soporte:soporte_tecnico:s1",
                    "transcript": "necesito ayuda con AFIP"}
    assert calls == [(b"raw-bytes", "audio/webm")]


def test_soporte_chat_audio_session_id_ya_namespaced_no_se_duplica(monkeypatch):
    """Misma regresión que /soporte/chat (hallazgo backend 2026-08-11): el frontend re-envía el
    session_id namespaced que la ruta ya le devolvió -- sin la guarda, cada turno de voz sumaría
    otro prefijo hasta romper el workflow_id de Temporal."""
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: "turno")
    client = TestClient(app)
    r1 = _post_soporte_audio(app, session_id="s1", funcion="soporte_tecnico")
    namespaced = r1.json()["session_id"]
    assert namespaced == "soporte:soporte_tecnico:s1"

    r2 = TestClient(app).post(
        "/soporte/chat/audio",
        data={"session_id": namespaced, "funcion": "soporte_tecnico"},
        files={"audio": ("clip.webm", b"bytes", "audio/webm")},
    )
    assert r2.json()["session_id"] == "soporte:soporte_tecnico:s1"


def test_soporte_chat_audio_no_colisiona_con_chat_audio_del_copiloto_mismo_session_id(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: "hola")
    client = TestClient(app)
    r_copiloto = client.post("/chat/audio", data={"session_id": "s1"},
                             files={"audio": ("c.webm", b"x", "audio/webm")})
    r_soporte = _post_soporte_audio(app, session_id="s1", funcion="soporte_tecnico")
    assert r_copiloto.json()["wf_id"] != r_soporte.json()["wf_id"]


# --- heredado de /chat/audio: 422 / 503 / 502 / 413 (pasada de humo, un caso cada uno) -----------

def test_soporte_chat_audio_empty_transcript_returns_422(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: "   ")
    r = _post_soporte_audio(app)
    assert r.status_code == 422


def test_soporte_chat_audio_without_groq_key_returns_503(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))   # transcribe=None -> default
    r = _post_soporte_audio(app)
    assert r.status_code == 503


def test_soporte_chat_audio_transport_error_returns_502(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)

    def _flaky_transcribe(audio_bytes: bytes, content_type: str) -> str:
        raise urllib.error.URLError("timeout")

    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_flaky_transcribe)
    r = _post_soporte_audio(app)
    assert r.status_code == 502


def test_soporte_chat_audio_oversized_returns_413(monkeypatch):
    monkeypatch.setattr(web_module, "MAX_AUDIO_BYTES", 5)
    called = {"n": 0}

    def _t(audio_bytes: bytes, content_type: str) -> str:
        called["n"] += 1
        return "no debería llegar acá"

    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_t)
    r = _post_soporte_audio(app, audio_bytes=b"esto-supera-los-cinco-bytes")
    assert r.status_code == 413
    assert called["n"] == 0
