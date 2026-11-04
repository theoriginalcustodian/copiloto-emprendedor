"""`registrar_trauma_de_turno`: la costura C3 para fallos que nacen DENTRO del workflow.

Control positivo: con tenant y fábrica, deposita 1. Hostiles: sin tenant, sin fábrica, fábrica que
lanza, payload basura -> devuelve False y NUNCA lanza (corre dentro del manejo de un error).
"""
from __future__ import annotations

import pytest

import trauma_de_turno_activities as m


class _Store:
    def __init__(self, sink):
        self.sink = sink

    def depositar(self, **kw):
        self.sink.append(kw)
        return {"dedupe_count": 1}


@pytest.fixture(autouse=True)
def _limpiar():
    yield
    m.set_trauma_de_turno_deps(None)


@pytest.mark.asyncio
async def test_deposita_con_tenant_y_fabrica():
    sink: list = []
    m.set_trauma_de_turno_deps(lambda cid: _Store(sink))
    ok = await m.registrar_trauma_de_turno(
        {"cliente_id": "c1", "nodo": "turno_react", "error_type": "KeyError",
         "error_message": "'name'", "payload_shape": "KeyError"})
    assert ok is True and len(sink) == 1
    assert sink[0]["costura"] == m.COSTURA and sink[0]["error_type"] == "KeyError"
    assert sink[0]["contexto"]["nodo"] == "turno_react"


@pytest.mark.asyncio
async def test_nodos_distintos_con_el_mismo_error_no_se_funden():
    sink: list = []
    m.set_trauma_de_turno_deps(lambda cid: _Store(sink))
    base = {"cliente_id": "c1", "error_type": "KeyError", "error_message": "'name'"}
    await m.registrar_trauma_de_turno({**base, "nodo": "turno_react"})
    await m.registrar_trauma_de_turno({**base, "nodo": "turno_dispatch"})
    assert sink[0]["fingerprint"] != sink[1]["fingerprint"]


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{}, {"cliente_id": ""}, {"error_type": None}, {"cliente_id": 5}])
async def test_payload_hostil_no_lanza(payload):
    m.set_trauma_de_turno_deps(lambda cid: _Store([]))
    assert await m.registrar_trauma_de_turno(payload) in (True, False)


@pytest.mark.asyncio
async def test_sin_tenant_o_sin_fabrica_devuelve_false_sin_lanzar():
    m.set_trauma_de_turno_deps(lambda cid: _Store([]))
    assert await m.registrar_trauma_de_turno({"error_type": "X"}) is False   # sin tenant
    m.set_trauma_de_turno_deps(None)
    assert await m.registrar_trauma_de_turno({"cliente_id": "c1"}) is False  # sin fábrica


@pytest.mark.asyncio
async def test_fabrica_que_lanza_no_propaga():
    def mala(cid):
        raise RuntimeError("la DLQ explotó")
    m.set_trauma_de_turno_deps(mala)
    assert await m.registrar_trauma_de_turno({"cliente_id": "c1"}) is False
