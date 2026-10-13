"""Los 4 sets de la familia de chat contra el `return` REAL de cada handler (CONTRATO4, 2026-10-13).

Extiende `test_chat_contrato_return_real.py` (que mide `POST /chat`) a los cuatro endpoints hermanos que
no tenían contrato declarado: `/chat/audio`, `/chat/foto`, `/soporte/chat`, `/soporte/chat/audio`.

Por qué hace falta además de la paridad TS: ésta compara dos DECLARACIONES (`chat_contrato.py` y el
espejo `*.contrato.ts`) y puede estar mal en las dos a la vez; así nació el drift de `session_id` en
`/chat`. Este test ejercita el handler real por el front-door (mismo `create_web_app` que arma
producción; sólo el ruteo a Temporal, el STT y el OCR son fakes) y compara el set de claves de la
respuesta HTTP con el declarado. Si alguien toca el `return` sin tocar el contrato, o al revés, sale
rojo en CI y no en el smoke post-deploy.

Cada endpoint trae sus controles negativos: el set SIN una clave y el set CON una de más NO igualan la
respuesta real. Sin ellos el comparador no está probado y el verde no acreditaría nada.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import web as web_module
from chat_contrato import (
    CLAVES_CHAT_AUDIO,
    CLAVES_CHAT_FOTO,
    CLAVES_SOPORTE_CHAT,
    CLAVES_SOPORTE_CHAT_AUDIO,
)
from clients.agent.channels.web import WebChannelAdapter
from test_web_app import _FakeComposioGateway, _FakeMpGateway, _FakeTemporal
from test_web_app import _fake_route_inbound, _require_tenant_fixed
from test_web_app import _mp_fernet_key_env  # noqa: F401 — fixture autouse (COPILOTO_FERNET_KEY)

# Firmas reales: `web.py` valida magic bytes (D6) y un blob sin firma muere en 415 ANTES del handler.
_WEBM = b"\x1a\x45\xdf\xa3" + b"fake-audio-bytes"
_JPEG = b"\xff\xd8\xff" + b"fake-jpeg-bytes"
_TRANSCRIPT = "hola, esto es un audio"
_FUNCION = "soporte_tecnico"


def _ocr_ok(imagen_bytes: bytes, content_type: str) -> dict:
    return {"monto": 739.59, "evidencia_monto": "TOTAL 739.59", "fecha": "2026-08-01",
            "proveedor": "Panadería Los Tilos", "categoria": "mercaderia", "legible": True}


def _ocr_vacio(imagen_bytes: bytes, content_type: str) -> dict:
    return {}


def _cliente(monkeypatch, *, route_inbound=_fake_route_inbound, extraer_ticket=_ocr_ok) -> TestClient:
    monkeypatch.setattr(web_module, "route_inbound", route_inbound)
    app = web_module.create_web_app(
        temporal_client=_FakeTemporal(),
        adapter=WebChannelAdapter(reply_sink=lambda *a, **kw: None),
        conn_factory=lambda: None,
        require_tenant=_require_tenant_fixed("cid-A"),
        mp_app=FastAPI(),
        gotrue=None,
        mp_gateway=_FakeMpGateway(),
        composio_gateway=_FakeComposioGateway(),
        transcribe=lambda audio_bytes, content_type: _TRANSCRIPT,
        extraer_ticket=extraer_ticket,
    )
    return TestClient(app)


def _post_chat_audio(c: TestClient, session_id: str = "s1"):
    return c.post("/chat/audio", data={"session_id": session_id},
                  files={"audio": ("clip.webm", _WEBM, "audio/webm")})


def _post_chat_foto(c: TestClient, session_id: str = "s1"):
    return c.post("/chat/foto", data={"session_id": session_id},
                  files={"imagen": ("ticket.jpg", _JPEG, "image/jpeg")})


def _post_soporte_chat(c: TestClient, session_id: str = "s1"):
    return c.post("/soporte/chat",
                  json={"session_id": session_id, "text": "hola", "funcion": _FUNCION, "kind": "text"})


def _post_soporte_audio(c: TestClient, session_id: str = "s1"):
    return c.post("/soporte/chat/audio", data={"session_id": session_id, "funcion": _FUNCION},
                  files={"audio": ("clip.webm", _WEBM, "audio/webm")})


# (id, set declarado, poster). El id nombra el endpoint en la salida de pytest.
_ENDPOINTS = [
    ("chat_audio", CLAVES_CHAT_AUDIO, _post_chat_audio),
    ("chat_foto", CLAVES_CHAT_FOTO, _post_chat_foto),
    ("soporte_chat", CLAVES_SOPORTE_CHAT, _post_soporte_chat),
    ("soporte_chat_audio", CLAVES_SOPORTE_CHAT_AUDIO, _post_soporte_audio),
]
_IDS = [e[0] for e in _ENDPOINTS]

# Los que pasan por `route_inbound` (foto NO: escribe la card directo por `adapter.send`).
_ENRUTADOS = [e for e in _ENDPOINTS if e[0] != "chat_foto"]


def _body_200(monkeypatch, poster, **kw) -> dict:
    r = poster(_cliente(monkeypatch, **kw))
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.parametrize("nombre,declarado,poster", _ENDPOINTS, ids=_IDS)
def test_el_return_real_es_exactamente_el_set_declarado(monkeypatch, nombre, declarado, poster):
    body = _body_200(monkeypatch, poster)
    sobra = set(body) - declarado
    falta = declarado - set(body)
    assert not sobra and not falta, (
        f"el return de {nombre} y su set en chat_contrato.py divergen: "
        f"sobra_no_declaradas={sorted(sobra)} falta_declarada={sorted(falta)}")


@pytest.mark.parametrize("nombre,declarado,poster", _ENDPOINTS, ids=_IDS)
def test_control_negativo_un_set_sin_una_clave_no_iguala_el_return_real(monkeypatch, nombre, declarado, poster):
    body = _body_200(monkeypatch, poster)
    for clave in sorted(declarado):
        sin_una = declarado - {clave}
        assert set(body) != sin_una, f"{nombre}: el comparador no distingue la falta de {clave!r}"
        assert set(body) - sin_una == {clave}


@pytest.mark.parametrize("nombre,declarado,poster", _ENDPOINTS, ids=_IDS)
def test_control_negativo_una_clave_de_mas_en_el_contrato_no_iguala_el_return_real(
        monkeypatch, nombre, declarado, poster):
    body = _body_200(monkeypatch, poster)
    con_de_mas = declarado | {"clave_de_mentira"}
    assert set(body) != con_de_mas
    assert con_de_mas - set(body) == {"clave_de_mentira"}


# --- el contrato describe la FORMA, no el camino feliz -----------------------------------------

async def _no_acepta(client, *, adapter, cliente_id, domain, task_queue, raw_update, extra_config=None):
    return None


@pytest.mark.parametrize("nombre,declarado,poster", _ENRUTADOS, ids=[e[0] for e in _ENRUTADOS])
def test_un_turno_no_aceptado_mantiene_la_misma_forma(monkeypatch, nombre, declarado, poster):
    """`route_inbound` devuelve None (mensaje no normalizable): `accepted` False, `wf_id` None, y el set
    NO cambia. Es lo que distingue a estos tres de `/chat/foto`, donde `accepted` no puede ser False."""
    body = _body_200(monkeypatch, poster, route_inbound=_no_acepta)
    assert body["accepted"] is False
    assert body["wf_id"] is None
    assert set(body) == declarado


# --- /chat/audio -------------------------------------------------------------------------------

def test_chat_audio_devuelve_el_transcript_y_no_devuelve_session_id(monkeypatch):
    """La asimetría con `/chat` es DECLARADA (ver el comentario de `CLAVES_CHAT_AUDIO`): sin `kind`
    nunca hay namespace, el efectivo es siempre el enviado. Si esto se rompe, alguien agregó la clave
    sin pasar por el contrato."""
    body = _body_200(monkeypatch, _post_chat_audio)
    assert body["transcript"] == _TRANSCRIPT
    assert "session_id" not in body


def test_chat_audio_rechaza_un_session_id_reservado_para_dictado(monkeypatch):
    """La otra mitad del porqué: por este endpoint no se abre un namespace de dictado."""
    r = _post_chat_audio(_cliente(monkeypatch), session_id="dictado:gasto:s1")
    assert r.status_code == 422


# --- /chat/foto: las dos rarezas declaradas ---------------------------------------------------

def test_chat_foto_accepted_es_true_y_wf_id_es_un_idem_key_no_un_workflow(monkeypatch):
    body = _body_200(monkeypatch, _post_chat_foto)
    assert body["accepted"] is True
    assert body["wf_id"].startswith("foto:"), (
        f"wf_id de /chat/foto dejó de ser un idem_key (`foto:<uuid>`): {body['wf_id']!r} — si ahora es un "
        f"id de workflow, el comentario de CLAVES_CHAT_FOTO y el contrato TS mienten")


def test_chat_foto_no_enruta_por_temporal(monkeypatch):
    """Control de la rareza 2: `route_inbound` NO se llama, o sea que ese `wf_id` no puede ser de Temporal."""
    llamadas: list[int] = []

    async def _espia(client, **kw):
        llamadas.append(1)
        return "wf-que-no-deberia-existir"

    body = _body_200(monkeypatch, _post_chat_foto, route_inbound=_espia)
    assert llamadas == []
    assert body["wf_id"] != "wf-que-no-deberia-existir"


def test_chat_foto_la_senal_de_falla_es_el_status_http_no_el_campo_accepted(monkeypatch):
    """Rareza 1: un ticket irreconocible es 422 SIN `accepted` en el body — `accepted` no puede ser
    false, el cliente tiene que ramificar por el status."""
    r = _post_chat_foto(_cliente(monkeypatch, extraer_ticket=_ocr_vacio))
    assert r.status_code == 422
    assert "accepted" not in r.json()


# --- /soporte/chat y /soporte/chat/audio: session_id es el que calculó el SERVIDOR -------------------

@pytest.mark.parametrize("poster", [_post_soporte_chat, _post_soporte_audio],
                         ids=["soporte_chat", "soporte_chat_audio"])
def test_soporte_devuelve_el_session_id_namespaceado_por_funcion_y_es_idempotente(monkeypatch, poster):
    esperado = f"soporte:{_FUNCION}:s1"
    c = _cliente(monkeypatch)
    primero = poster(c, "s1").json()
    assert primero["session_id"] == esperado
    # El cliente re-envía el efectivo en el turno siguiente: no se le suma otro prefijo.
    segundo = poster(c, esperado).json()
    assert segundo["session_id"] == esperado


def test_soporte_chat_audio_devuelve_el_transcript(monkeypatch):
    assert _body_200(monkeypatch, _post_soporte_audio)["transcript"] == _TRANSCRIPT
