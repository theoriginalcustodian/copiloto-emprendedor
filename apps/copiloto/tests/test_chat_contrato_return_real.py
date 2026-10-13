"""`CLAVES_CHAT` (contrato de `POST /chat`) contra el `return` REAL del handler (MECLAVESRESTO, hallazgo 2026-10-13).

Por qué existe: el set declarado en `chat_contrato.py` y su espejo TS (`chat.contrato.ts`) sólo se medían
ENTRE SÍ (test de paridad) y contra prod (smoke). Nada lo medía contra lo que `web.py:chat` devuelve en un
test de CI. Cuando #1050 sumó `session_id` al `return`, los dos lados quedaron consistentes entre sí y
equivocados juntos: el paridad TS seguía verde, y sólo el smoke vivo contra prod lo cazó
(`sobra_no_declaradas=['session_id']`).

Este test ejercita el handler real por el front-door (mismo `create_web_app` que arma producción, sólo el
ruteo a Temporal es fake) y compara el set de claves de la respuesta HTTP con el declarado. Si alguien
toca el `return` sin tocar el contrato —o al revés—, sale rojo en CI y no en el smoke post-deploy.

Los controles negativos prueban que el comparador discrimina: el set viejo (sin `session_id`) y un set con
una clave de más NO igualan la respuesta real.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import web as web_module
from chat_contrato import CLAVES_CHAT
from test_web_app import _build_app, _fake_route_inbound, _require_tenant_fixed
from test_web_app import _mp_fernet_key_env  # noqa: F401 — fixture autouse (COPILOTO_FERNET_KEY)


def _chat(monkeypatch, *, route_inbound=_fake_route_inbound, **body):
    monkeypatch.setattr(web_module, "route_inbound", route_inbound)
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    payload = {"session_id": "s1", "text": "hola", **body}
    r = TestClient(app).post("/chat", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def test_el_return_real_de_chat_es_exactamente_el_set_declarado(monkeypatch):
    body = _chat(monkeypatch)
    sobra = set(body) - CLAVES_CHAT
    falta = CLAVES_CHAT - set(body)
    assert not sobra and not falta, (
        f"el return de POST /chat y chat_contrato.CLAVES_CHAT divergen: "
        f"sobra_no_declaradas={sorted(sobra)} falta_declarada={sorted(falta)}")


def test_session_id_es_el_efectivo_del_turno_en_un_chat_normal(monkeypatch):
    body = _chat(monkeypatch)
    assert body["session_id"] == "s1"


@pytest.mark.parametrize("destino", ["gasto", "ingreso", "presupuesto", "cliente"])
def test_dictado_devuelve_el_session_id_namespaceado_y_el_mismo_set(monkeypatch, destino):
    """El caso por el que la clave existe: el cliente tiene que pollear `/reply` con el id EFECTIVO."""
    body = _chat(monkeypatch, kind=f"dictado:{destino}")
    assert set(body) == CLAVES_CHAT
    assert body["session_id"] == f"dictado:{destino}:s1"


def test_un_turno_no_aceptado_mantiene_la_misma_forma(monkeypatch):
    """`route_inbound` devuelve None (mensaje no normalizable): `accepted` False, pero el set no cambia —
    el contrato describe la forma, no el camino feliz."""
    async def _no_acepta(client, *, adapter, cliente_id, domain, task_queue, raw_update, extra_config=None):
        return None

    body = _chat(monkeypatch, route_inbound=_no_acepta)
    assert body["accepted"] is False
    assert body["wf_id"] is None
    assert set(body) == CLAVES_CHAT


def test_control_negativo_el_set_viejo_sin_session_id_no_iguala_el_return_real(monkeypatch):
    body = _chat(monkeypatch)
    assert set(body) != CLAVES_CHAT - {"session_id"}
    assert set(body) - (CLAVES_CHAT - {"session_id"}) == {"session_id"}


def test_control_negativo_una_clave_de_mas_en_el_contrato_no_iguala_el_return_real(monkeypatch):
    body = _chat(monkeypatch)
    declarado_de_mas = CLAVES_CHAT | {"clave_de_mentira"}
    assert set(body) != declarado_de_mas
    assert declarado_de_mas - set(body) == {"clave_de_mentira"}

