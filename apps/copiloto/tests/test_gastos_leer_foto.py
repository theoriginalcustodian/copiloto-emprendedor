"""Tests de `POST /gastos/leer-foto` (BL-J7, 3er ítem del DoD -- foto del ticket SIN chat): hermano
"sin side effects" de `/chat/foto`, mismo patrón que `/transcribir` (K-10) respecto de `/chat/audio`.
Reusa los fakes/fixtures de `test_chat_foto.py` (mismo criterio que `test_transcribir.py` importando
de `test_audio.py`): NO hay `session_id`, NO hay `adapter.send`, la respuesta es sólo `{"gasto": ...}`
con el mismo `data` que la card `gasto_propuesto`. TestClient con deps FAKE, sin infra real ni red."""
from __future__ import annotations

import urllib.error

from fastapi.testclient import TestClient

from test_chat_foto import (  # noqa: F401 -- _mp_fernet_key_env es autouse
    _JPEG_HEADER,
    _build_app,
    _mp_fernet_key_env,
    _post_foto,
    _require_tenant_401,
    _require_tenant_fixed,
)


def _post_leer_foto(app, *, imagen_bytes: bytes = _JPEG_HEADER + b"fake-jpeg-bytes",
                    filename: str = "ticket.jpg", content_type: str = "image/jpeg"):
    return TestClient(app).post(
        "/gastos/leer-foto",
        files={"imagen": (filename, imagen_bytes, content_type)},
    )


# --- 401 sin token -----------------------------------------------------------------

def test_leer_foto_without_token_returns_401():
    app, _ = _build_app(require_tenant=_require_tenant_401(),
                        extraer_ticket=lambda b, ct: {"monto": 100, "fecha": None,
                                                       "proveedor": None, "categoria": None})
    r = _post_leer_foto(app)
    assert r.status_code == 401


# --- 200: mismo `data` que la card `gasto_propuesto`, monto SIEMPRE vacío, SIN side effects --

def test_leer_foto_returns_same_shape_as_chat_foto_card_data():
    def _fake_ocr(imagen_bytes: bytes, content_type: str) -> dict:
        return {"monto": 739.59, "evidencia_monto": "TOTAL 739.59", "fecha": "2026-08-01",
                "proveedor": "Panadería Los Tilos", "categoria": "mercaderia", "legible": True}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_fake_ocr)
    imagen_bytes = _JPEG_HEADER + b"raw-jpeg"
    r = _post_leer_foto(app, imagen_bytes=imagen_bytes, content_type="image/jpeg")
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"gasto"}
    gasto = body["gasto"]
    assert gasto["monto"] == ""                          # 🔴 nunca se pre-carga, igual que /chat/foto
    assert gasto["monto_sugerido"] == "739.59"
    assert gasto["fecha"] == "2026-08-01"
    assert gasto["proveedor"] == "Panadería Los Tilos"
    assert gasto["categoria"] == "mercaderia"
    assert gasto["origen"] == "foto"
    assert gasto["medio_pago"] is None
    assert adapter.sent == []                             # sin side effects (ver test adversarial abajo)


def test_leer_foto_categoria_invalida_cae_en_otros():
    def _fake_ocr(imagen_bytes, content_type):
        return {"monto": 500, "fecha": None, "proveedor": None, "categoria": "rubro-inventado"}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_fake_ocr)
    r = _post_leer_foto(app)
    assert r.status_code == 200
    assert r.json()["gasto"]["categoria"] == "otros"
    assert adapter.sent == []


# --- 422: ningún campo reconocible (NO se gatea por `legible`) ---------------------

def test_leer_foto_no_reconocible_returns_422():
    def _fake_ocr(imagen_bytes, content_type):
        return {"monto": None, "fecha": None, "proveedor": None, "categoria": None, "legible": False}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_fake_ocr)
    r = _post_leer_foto(app)
    assert r.status_code == 422
    assert adapter.sent == []


def test_leer_foto_legible_false_pero_con_datos_NO_es_422():
    def _fake_ocr(imagen_bytes, content_type):
        return {"monto": None, "fecha": "2026-08-01", "proveedor": None, "categoria": None,
                "legible": False}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_fake_ocr)
    r = _post_leer_foto(app)
    assert r.status_code == 200
    assert adapter.sent == []


# --- 415: formato no soportado ------------------------------------------------------

def test_leer_foto_formato_no_soportado_returns_415():
    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"),
                              extraer_ticket=lambda b, ct: {"monto": 1})
    r = _post_leer_foto(app, content_type="application/pdf")
    assert r.status_code == 415
    assert adapter.sent == []


def test_leer_foto_content_type_mentido_returns_415_y_no_llama_ocr():
    """D6: `content_type=image/jpeg` declarado, bytes reales PNG -- rechaza por magic bytes ANTES de
    pegarle a OpenAI Vision (mismo criterio que `/chat/foto`)."""
    called = {"n": 0}

    def _ocr(imagen_bytes, content_type):
        called["n"] += 1
        return {"monto": 1}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_ocr)
    png_bytes = b"\x89PNG\r\n\x1a\nno-es-un-jpeg"
    r = _post_leer_foto(app, imagen_bytes=png_bytes, content_type="image/jpeg")
    assert r.status_code == 415
    assert called["n"] == 0
    assert adapter.sent == []


# --- 503: sin OPENAI_API_KEY (default extractor) ------------------------------------

def test_leer_foto_sin_openai_key_returns_503(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"))   # extraer_ticket=None -> default
    r = _post_leer_foto(app)
    assert r.status_code == 503
    assert adapter.sent == []


# --- 502: error de transporte/API del servicio de OCR --------------------------------

def test_leer_foto_transport_error_returns_502():
    def _flaky_ocr(imagen_bytes, content_type):
        raise urllib.error.URLError("timeout")

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_flaky_ocr)
    r = _post_leer_foto(app)
    assert r.status_code == 502
    assert adapter.sent == []


# --- 413: imagen demasiado grande (cap de RAM del front-door compartido) -------------

def test_leer_foto_oversized_returns_413(monkeypatch):
    import web as web_module
    monkeypatch.setattr(web_module, "MAX_IMAGEN_BYTES", 5)
    called = {"n": 0}

    def _ocr(imagen_bytes, content_type):
        called["n"] += 1
        return {"monto": 1}

    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_ocr)
    r = _post_leer_foto(app, imagen_bytes=b"esto-supera-los-cinco-bytes")
    assert r.status_code == 413
    assert called["n"] == 0
    assert adapter.sent == []


# --- Adversarial "sin side effects": control positivo contra /chat/foto -------------

def test_leer_foto_no_tiene_side_effects_control_positivo_contra_chat_foto():
    """El contrato exige probar que `/gastos/leer-foto` NO escribe nada, no sólo asumirlo. El
    `adapter.sent` es el proxy observable de "se hubiera escrito un reply" en este harness (los tests
    de este módulo usan `conn_factory=lambda: None`, sin Postgres real -- el `reply_sink` real vive
    detrás de `adapter.send`, así que "el adapter no fue llamado" ES "no hay fila nueva en
    `reply_store`"). Control positivo: la MISMA foto contra `/chat/foto` sí dispara `adapter.send` --
    si este test estuviera roto y `adapter.sent` quedara vacío siempre, el control positivo lo
    delataría."""
    def _fake_ocr(imagen_bytes, content_type):
        return {"monto": 739.59, "fecha": "2026-08-01", "proveedor": "Panadería Los Tilos",
                "categoria": "mercaderia", "legible": True}

    imagen_bytes = _JPEG_HEADER + b"raw-jpeg"

    # Caso bajo prueba: /gastos/leer-foto no debe dejar rastro.
    app, adapter = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_fake_ocr)
    r = _post_leer_foto(app, imagen_bytes=imagen_bytes)
    assert r.status_code == 200
    assert adapter.sent == []

    # Control positivo: la MISMA foto, mismo fake OCR, contra /chat/foto -- SÍ debe verse.
    app2, adapter2 = _build_app(require_tenant=_require_tenant_fixed("cid-A"), extraer_ticket=_fake_ocr)
    r2 = _post_foto(app2, session_id="s1", imagen_bytes=imagen_bytes)
    assert r2.status_code == 200
    assert len(adapter2.sent) == 1
