"""Tests de `POST /feedback` y `POST /feedback/audio` (BETA-1a, contrato
`BETA1a-feedback-endpoint.md`): mismo patrón de TestClient con deps FAKE que `test_audio.py` --
`require_tenant` fijo o 401, `transcribe` fake inyectado, y acá además un `conn_factory` fake (las
rutas de feedback SÍ tocan DB, a diferencia de `/chat/audio`)."""
from __future__ import annotations

import urllib.error

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import web as web_module
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.crypto import FernetCrypto


class _FakeTemporal:
    pass


class _FakeCur:
    def __init__(self, rows):
        self._rows = rows
        self._next_id = len(rows) + 1

    def execute(self, sql, params):
        cliente_id, tipo, texto, contexto = params
        self._rows.append({"id": self._next_id, "cliente_id": cliente_id, "tipo": tipo,
                           "texto": texto, "contexto": contexto})

    def fetchone(self): return (self._rows[-1]["id"],)
    def __enter__(self): return self
    def __exit__(self, *a): return False


class _FakeConn:
    def __init__(self, rows): self._rows = rows
    def cursor(self): return _FakeCur(self._rows)
    def __enter__(self): return self
    def __exit__(self, *a): return False


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
    rows: list[dict] = []
    app = web_module.create_web_app(
        temporal_client=_FakeTemporal(),
        adapter=WebChannelAdapter(reply_sink=lambda *a: None),
        conn_factory=lambda: _FakeConn(rows),
        require_tenant=require_tenant,
        mp_app=FastAPI(),
        gotrue=None,
        mp_gateway=_FakeMpGateway(),
        composio_gateway=_FakeComposioGateway(),
        transcribe=transcribe,
    )
    return app, rows


# --- POST /feedback (texto) ------------------------------------------------------

def test_feedback_sin_token_401():
    app, _ = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).post("/feedback", json={"texto": "che, agreguen dark mode"})
    assert r.status_code == 401


def test_feedback_texto_guarda_y_devuelve_id():
    app, rows = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).post("/feedback", json={"texto": "che, agreguen dark mode", "contexto": "mi-cuenta"})
    assert r.status_code == 200
    assert r.json()["id"] == 1 and r.json()["ok"] is True
    assert rows == [{"id": 1, "cliente_id": "cid-A", "tipo": "texto",
                     "texto": "che, agreguen dark mode", "contexto": "mi-cuenta"}]


def test_feedback_devuelve_la_FRASE_FIJA_SOP4_C7():
    """C7: "feedback devuelve la frase fija ... y no abre hilo" -- exacta, no una aproximación."""
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).post("/feedback", json={"texto": "che, agreguen dark mode"})
    assert r.json()["mensaje"] == (
        "Tu mensaje quedó anotado. Estas ideas son las que ayudan a mejorar… ¡Gracias por tu aporte!")


def test_feedback_sin_contexto_es_opcional():
    app, rows = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).post("/feedback", json={"texto": "lindo"})
    assert r.status_code == 200
    assert rows[0]["contexto"] is None


def test_feedback_texto_vacio_422():
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).post("/feedback", json={"texto": "   "})
    assert r.status_code == 422


def test_feedback_texto_demasiado_largo_422():
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).post("/feedback", json={"texto": "x" * 2001})
    assert r.status_code == 422


def test_feedback_otro_tenant_no_ve_el_de_A():
    app, rows = _build_app(require_tenant=_require_tenant_fixed("cid-B"))
    TestClient(app).post("/feedback", json={"texto": "feedback de B"})
    assert rows == [{"id": 1, "cliente_id": "cid-B", "tipo": "texto",
                     "texto": "feedback de B", "contexto": None}]


# --- POST /feedback/audio (voz) ---------------------------------------------------

def _post_audio(app, *, audio_bytes: bytes = b"fake-audio-bytes", filename: str = "clip.webm",
                content_type: str = "audio/webm", contexto: str | None = None):
    data = {"contexto": contexto} if contexto is not None else {}
    return TestClient(app).post(
        "/feedback/audio", data=data, files={"audio": (filename, audio_bytes, content_type)})


def test_feedback_audio_transcribe_y_guarda(monkeypatch):
    app, rows = _build_app(require_tenant=_require_tenant_fixed("cid-A"),
                           transcribe=lambda b, ct: "el buscador de clientes tarda mucho")
    r = _post_audio(app, contexto="mi-cuenta")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == 1 and body["ok"] is True
    assert body["transcripcion"] == "el buscador de clientes tarda mucho"
    assert body["mensaje"] == (
        "Tu mensaje quedó anotado. Estas ideas son las que ayudan a mejorar… ¡Gracias por tu aporte!")
    assert rows[0]["tipo"] == "voz"
    assert rows[0]["texto"] == "el buscador de clientes tarda mucho"
    assert rows[0]["contexto"] == "mi-cuenta"


def test_feedback_audio_transcript_vacio_422(monkeypatch):
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: "   ")
    r = _post_audio(app)
    assert r.status_code == 422


def test_feedback_audio_sin_groq_key_503(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))   # transcribe=None -> default
    r = _post_audio(app)
    assert r.status_code == 503


def test_feedback_audio_error_transporte_502(monkeypatch):
    def _flaky(audio_bytes: bytes, content_type: str) -> str:
        raise urllib.error.URLError("timeout")

    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_flaky)
    r = _post_audio(app)
    assert r.status_code == 502


def test_feedback_audio_oversized_413(monkeypatch):
    monkeypatch.setattr(web_module, "MAX_AUDIO_BYTES", 5)
    called = {"n": 0}

    def _t(audio_bytes: bytes, content_type: str) -> str:
        called["n"] += 1
        return "no debería llegar acá"

    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_t)
    r = _post_audio(app, audio_bytes=b"esto-supera-los-cinco-bytes")
    assert r.status_code == 413
    assert called["n"] == 0
