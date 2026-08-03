"""Tests de `POST /chat/foto` (Gastos Fase 2 -- OCR de tickets): recibe una foto (`multipart/
form-data`: `session_id` + `imagen`), la lee con `extraer_ticket` (INYECTABLE, mismo criterio que
`transcribe` en `test_audio.py`) y escribe la card `gasto_propuesto` DIRECTO vía `adapter.send` --
a diferencia de `/chat/audio`, NO pasa por `route_inbound`/el LLM (ver docstring del endpoint en
`web.py`). TestClient con deps FAKE, sin infra real ni red."""
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


class _SpyAdapter(WebChannelAdapter):
    """Espía las llamadas a `send` (mismo objeto que consumiría `/reply`) sin tocar DB real."""

    def __init__(self):
        super().__init__(reply_sink=lambda *a, **kw: None)
        self.sent: list[dict] = []

    def send(self, channel_ref, text, choices=None, *, cliente_id=None, card=None, idem_key=None):
        self.sent.append({"channel_ref": channel_ref, "text": text, "choices": choices,
                          "cliente_id": cliente_id, "card": card, "idem_key": idem_key})
        return super().send(channel_ref, text, choices, cliente_id=cliente_id, card=card,
                            idem_key=idem_key)


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


def _build_app(*, require_tenant, extraer_ticket=None, adapter=None):
    adapter = adapter or _SpyAdapter()
    app = web_module.create_web_app(
        temporal_client=_FakeTemporal(),
        adapter=adapter,
        conn_factory=lambda: None,
        require_tenant=require_tenant,
        mp_app=FastAPI(),
        gotrue=None,
        mp_gateway=_FakeMpGateway(),
        composio_gateway=_FakeComposioGateway(),
        extraer_ticket=extraer_ticket,
    )
    return app, adapter


def _post_foto(app, *, session_id: str = "s1", imagen_bytes: bytes = b"fake-jpeg-bytes",
              filename: str = "ticket.jpg", content_type: str = "image/jpeg"):
    return TestClient(app).post(
        "/chat/foto",
        data={"session_id": session_id},
        files={"imagen": (filename, imagen_bytes, content_type)},
    )


# --- 401 sin token -----------------------------------------------------------------

def test_chat_foto_without_token_returns_401():
    app, _ = _build_app(require_tenant=_require_tenant_401(),
                        extraer_ticket=lambda b, ct: {"monto": 100, "fecha": None,
                                                       "proveedor": None, "categoria": None})
    r = _post_foto(app)
    assert r.status_code == 401


# --- 200: escribe la card directo vía adapter.send, monto SIEMPRE vacío ------------

def test_chat_foto_writes_gasto_propuesto_card_with_empty_monto(monkeypatch):
    calls: list[tuple[bytes, str]] = []

    def _fake_ocr(imagen_bytes: bytes, content_type: str) -> dict:
        calls.append((imagen_bytes, content_type))
        return {"monto": 739.59, "evidencia_monto": "TOTAL 739.59", "fecha": "2026-08-01",
                "proveedor": "Panadería Los Tilos", "categoria": "mercaderia", "legible": True}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_fake_ocr)
    r = _post_foto(app, session_id="s1", imagen_bytes=b"raw-jpeg", content_type="image/jpeg")
    assert r.status_code == 200
    body = r.json()
    assert body["accepted"] is True
    assert isinstance(body["wf_id"], str) and body["wf_id"]
    assert calls == [(b"raw-jpeg", "image/jpeg")]

    assert len(adapter.sent) == 1
    sent = adapter.sent[0]
    assert sent["channel_ref"] == "s1"
    assert sent["cliente_id"] == "cid-A"
    assert sent["card"]["kind"] == "gasto_propuesto"
    data = sent["card"]["data"]
    assert data["monto"] == ""                          # 🔴 nunca se pre-carga, ver spike §3
    assert data["monto_sugerido"] == "739.59"
    assert data["fecha"] == "2026-08-01"
    assert data["proveedor"] == "Panadería Los Tilos"
    assert data["categoria"] == "mercaderia"
    assert data["origen"] == "foto"
    assert data["medio_pago"] is None                    # nunca se infiere de una foto
    # el guardrail verbal (narra-sin-hacer): nunca "guardado"/"anoté"/"listo"
    for verbo in ("guardado", "anoté", "listo"):
        assert verbo not in sent["text"].lower()


def test_chat_foto_categoria_invalida_cae_en_otros():
    def _fake_ocr(imagen_bytes, content_type):
        return {"monto": 500, "fecha": None, "proveedor": None, "categoria": "rubro-inventado"}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_fake_ocr)
    r = _post_foto(app)
    assert r.status_code == 200
    assert adapter.sent[0]["card"]["data"]["categoria"] == "otros"


def test_chat_foto_different_tenants_route_to_their_own_session(monkeypatch):
    def _fake_ocr(imagen_bytes, content_type):
        return {"monto": 100, "fecha": None, "proveedor": None, "categoria": None}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-B"), extraer_ticket=_fake_ocr)
    r = _post_foto(app, session_id="s2")
    assert r.status_code == 200
    assert adapter.sent[0]["cliente_id"] == "cid-B"
    assert adapter.sent[0]["channel_ref"] == "s2"


# --- 422: ningún campo reconocible (NO se gatea por `legible`, el spike lo prohíbe) --

def test_chat_foto_no_reconocible_returns_422():
    def _fake_ocr(imagen_bytes, content_type):
        return {"monto": None, "fecha": None, "proveedor": None, "categoria": None, "legible": False}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_fake_ocr)
    r = _post_foto(app)
    assert r.status_code == 422
    assert adapter.sent == []


def test_chat_foto_legible_false_pero_con_datos_NO_es_422():
    """`legible` no es el gate (spike §2a) -- si extrajo aunque sea un campo, se muestra la card."""
    def _fake_ocr(imagen_bytes, content_type):
        return {"monto": None, "fecha": "2026-08-01", "proveedor": None, "categoria": None,
                "legible": False}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_fake_ocr)
    r = _post_foto(app)
    assert r.status_code == 200
    assert len(adapter.sent) == 1


# --- 415: formato no soportado ------------------------------------------------------

def test_chat_foto_formato_no_soportado_returns_415():
    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"),
                              extraer_ticket=lambda b, ct: {"monto": 1})
    r = _post_foto(app, content_type="application/pdf")
    assert r.status_code == 415
    assert adapter.sent == []


# --- 503: sin OPENAI_API_KEY (default extractor) ------------------------------------

def test_chat_foto_sin_openai_key_returns_503(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"))   # extraer_ticket=None -> default
    r = _post_foto(app)
    assert r.status_code == 503
    assert adapter.sent == []


# --- 502: error de transporte/API del servicio de OCR --------------------------------

def test_chat_foto_transport_error_returns_502():
    def _flaky_ocr(imagen_bytes, content_type):
        raise urllib.error.URLError("timeout")

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_flaky_ocr)
    r = _post_foto(app)
    assert r.status_code == 502
    assert adapter.sent == []


# --- 413: imagen demasiado grande (cap de RAM del front-door compartido) -------------

def test_chat_foto_oversized_returns_413(monkeypatch):
    monkeypatch.setattr(web_module, "MAX_IMAGEN_BYTES", 5)
    called = {"n": 0}

    def _ocr(imagen_bytes, content_type):
        called["n"] += 1
        return {"monto": 1}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_ocr)
    r = _post_foto(app, imagen_bytes=b"esto-supera-los-cinco-bytes")
    assert r.status_code == 413
    assert called["n"] == 0
    assert adapter.sent == []
