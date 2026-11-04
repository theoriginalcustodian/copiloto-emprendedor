"""SM-N53: el trauma de turno no DUPLICA el fallo de una activity ni FUNDE fallos distintos.

Antes, un `ActivityError` en el turno dejaba DOS filas (`activity_interceptor` + `workflow_turno`) y la
de turno, con `error_type` genérico, fundía en UNA fila fallos de activities distintas. La regla es una
MARCA POSITIVA: el workflow sólo saltea su depósito si el interceptor ya dejó la fila de esa
(workflow_id, activity_id). Lo que el interceptor nunca vio —activity no registrada (`NotFoundError`)
o `start_to_close` vencido— no tiene fila, y el depósito del turno es el ÚNICO rastro.

Corre contra Postgres real: lo que se verifica es la consulta sobre `contexto` jsonb y la RLS.
"""
from __future__ import annotations

import os
import types
import uuid

import pytest

import interceptor_errores as ie
import trauma_de_turno_activities as m
from deposito_traumas import fabrica_desde
from trauma_store import TABLA

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")

WF = "conv-wf-n53"


@pytest.fixture
def tenant(conn_de_tenant):
    cid = str(uuid.uuid4())
    m.set_trauma_de_turno_deps(fabrica_desde(conn_de_tenant(cid)))
    yield cid
    m.set_trauma_de_turno_deps(None)
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {TABLA} WHERE cliente_id = %s", (cid,))
    conn.close()


def _filas(conn_de_tenant, cid):
    conn = conn_de_tenant(cid)()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT costura, workflow, contexto ->> 'activity_id' FROM {TABLA} "
                        "WHERE cliente_id = %s ORDER BY id", (cid,))
            return cur.fetchall()
    finally:
        conn.close()


def _interceptor_falla(monkeypatch, cid, conn_de_tenant, *, activity_id, tipo="execute_tool",
                       exc=None):
    """Lo que hace el interceptor REAL (`_registrar`) cuando una activity lanza."""
    info = types.SimpleNamespace(activity_type=tipo, attempt=1, workflow_id=WF,
                                 activity_id=activity_id)
    monkeypatch.setattr(ie.activity, "info", lambda: info)
    inbound = ie._CapturaInbound.__new__(ie._CapturaInbound)
    inbound._traumas = fabrica_desde(conn_de_tenant(cid))
    entrada = types.SimpleNamespace(args=[{"cliente_id": cid, "name": "t"}], fn=None)
    inbound._registrar(exc or RuntimeError(f"boom {activity_id}"), entrada)


async def _turno(cid, *, activity_id, error_type="ActivityError"):
    """Lo que manda el workflow (`_registrar_trauma_de_turno`) cuando el turno cae."""
    p = {"cliente_id": cid, "nodo": "turno_react", "error_type": error_type,
         "error_message": "Activity task failed", "payload_shape": error_type, "workflow_id": WF}
    if activity_id is not None:
        p["activity_id"] = activity_id
    return await m.registrar_trauma_de_turno(p)


@necesita_pg
@pytest.mark.asyncio
async def test_la_activity_que_lanza_deja_UNA_fila_no_dos(tenant, conn_de_tenant, monkeypatch):
    _interceptor_falla(monkeypatch, tenant, conn_de_tenant, activity_id="7")
    assert await _turno(tenant, activity_id="7") is False        # ya estaba: no duplica
    filas = _filas(conn_de_tenant, tenant)
    assert [f[0] for f in filas] == ["activity_interceptor"] and filas[0][2] == "7"


@necesita_pg
@pytest.mark.asyncio
async def test_activity_NotFound_o_timeout_sin_fila_del_interceptor_deja_la_de_turno(
        tenant, conn_de_tenant):
    """Las dos causas reales medidas por manejo-de-errores: el interceptor no las ve."""
    for causa, aid in (("NotFoundError", "8"), ("TimeoutError", "9")):
        assert await _turno(tenant, activity_id=aid, error_type=causa) is True
    filas = _filas(conn_de_tenant, tenant)
    assert [f[0] for f in filas] == ["workflow_turno", "workflow_turno"]
    assert len({f[1] for f in filas}) == 2                       # no se funden en una fila


@necesita_pg
@pytest.mark.asyncio
async def test_dos_fallos_distintos_de_activity_son_exactamente_dos_filas(
        tenant, conn_de_tenant, monkeypatch):
    _interceptor_falla(monkeypatch, tenant, conn_de_tenant, activity_id="1", tipo="execute_tool",
                       exc=RuntimeError("a"))
    await _turno(tenant, activity_id="1")
    _interceptor_falla(monkeypatch, tenant, conn_de_tenant, activity_id="2", tipo="call_llm",
                       exc=ValueError("b"))
    await _turno(tenant, activity_id="2")
    assert sorted(f[0] for f in _filas(conn_de_tenant, tenant)) == ["activity_interceptor"] * 2


@necesita_pg
@pytest.mark.asyncio
async def test_CONTROL_fallo_nacido_en_el_workflow_sigue_en_una_fila_de_turno(tenant,
                                                                              conn_de_tenant):
    """tool_call malformado y `TurnoSinContenido`: no son ActivityError, no llevan activity_id."""
    assert await _turno(tenant, activity_id=None, error_type="KeyError") is True
    assert await _turno(tenant, activity_id=None, error_type="TurnoSinContenido") is True
    assert [f[0] for f in _filas(conn_de_tenant, tenant)] == ["workflow_turno"] * 2


@necesita_pg
@pytest.mark.asyncio
async def test_ajeno_no_tapa_lo_propio_misma_activity_id_otro_tenant(tenant, conn_de_tenant,
                                                                     monkeypatch):
    """La marca es por tenant (RLS): la fila de otro con el mismo activity_id no saltea mi depósito."""
    otro = str(uuid.uuid4())
    try:
        _interceptor_falla(monkeypatch, otro, conn_de_tenant, activity_id="7")
        assert await _turno(tenant, activity_id="7") is True
    finally:
        conn = conn_de_tenant(otro)()
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {TABLA} WHERE cliente_id = %s", (otro,))
        conn.close()


@pytest.mark.asyncio
async def test_si_no_se_pudo_mirar_se_deposita_igual():
    """«No pude mirar» no es «no hay fila»: duplicar es el error barato, perder el fallo no."""
    sink: list = []

    class _Store:
        def ya_deposito_la_activity(self, **kw):
            return None

        def depositar(self, **kw):
            sink.append(kw)
            return {"dedupe_count": 1}

    m.set_trauma_de_turno_deps(lambda cid: _Store())
    try:
        assert await _turno("c1", activity_id="7") is True and len(sink) == 1
    finally:
        m.set_trauma_de_turno_deps(None)


@pytest.mark.asyncio
async def test_el_workflow_manda_el_activity_id_del_ActivityError(monkeypatch):
    """La costura workflow→activity: el id viaja SOLO si el fallo es de una activity y con el patch."""
    from temporalio.exceptions import ActivityError
    from backend.agent import conversation_workflow as cw

    enviados: list = []

    async def _exec(nombre, payload, **kw):
        enviados.append(payload)

    fake = types.SimpleNamespace(
        patched=lambda _id: True, execute_activity=_exec,
        info=lambda: types.SimpleNamespace(workflow_id=WF),
        logger=types.SimpleNamespace(error=lambda *a, **k: None))
    monkeypatch.setattr(cw, "workflow", fake)
    wf = cw.ConversationWorkflow.__new__(cw.ConversationWorkflow)
    ae = ActivityError("Activity task failed", scheduled_event_id=1, started_event_id=2,
                       identity="x", activity_type="execute_tool", activity_id="42",
                       retry_state=None)
    await wf._registrar_trauma_de_turno({}, ae, "c1")
    await wf._registrar_trauma_de_turno({}, KeyError("name"), "c1")
    assert enviados[0]["activity_id"] == "42"
    assert "activity_id" not in enviados[1]                       # fallo nacido en el workflow
