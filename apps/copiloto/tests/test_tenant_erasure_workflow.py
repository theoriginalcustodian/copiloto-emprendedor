"""SEC-D8 · el workflow de baja: orden fijo, reintento de lo que falla y cero "ok" falsos.

Activities de mentira registradas con los MISMOS nombres que las reales (el workflow las invoca por
nombre). Lo que se prueba es la orquestación: que el grafo se borre ANTES que Postgres, que `tenants`
(vía postgres) no se borre antes de tener el `auth_user_id`, y que un fallo transitorio de Graphity se
REINTENTE en vez de dar el borrado por hecho (el riesgo de `MemoryProvider.forget` tragado).
"""
from __future__ import annotations

import uuid

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from tenant_erasure_workflow import TenantErasureWorkflow, workflow_id

COLA = "erasure-test"


def _actividades(orden: list, grafo_falla_primera_vez: bool):
    intentos = {"grafo": 0}

    @activity.defn(name="tenant_erasure_suspender")
    async def suspender(cid: str) -> str:
        orden.append("suspender")
        return "auth-123"

    @activity.defn(name="tenant_erasure_temporal")
    async def temporal(cid: str, propio: str) -> dict:
        orden.append("temporal")
        assert propio == workflow_id(cid)
        return {}

    @activity.defn(name="tenant_erasure_externos")
    async def externos(cid: str) -> dict:
        orden.append("externos")
        return {}

    @activity.defn(name="tenant_erasure_grafo")
    async def grafo(cid: str) -> str:
        intentos["grafo"] += 1
        orden.append("grafo")
        if grafo_falla_primera_vez and intentos["grafo"] == 1:
            raise RuntimeError("graphity caído")
        return "borrado"

    @activity.defn(name="tenant_erasure_postgres")
    async def postgres(cid: str) -> dict:
        orden.append("postgres")
        return {"tenants": 1}

    @activity.defn(name="tenant_erasure_auth")
    async def auth(auth_user_id: str) -> str:
        orden.append("auth")
        assert auth_user_id == "auth-123"      # el id viajó desde el paso 1, no se re-leyó de `tenants`
        return "borrado"

    @activity.defn(name="tenant_erasure_recibo")
    async def recibo(cid: str, sol: str, email: str, detalle: dict) -> None:
        orden.append("recibo")

    return [suspender, temporal, externos, grafo, postgres, auth, recibo]


async def _correr(orden: list, falla: bool) -> dict:
    cid = str(uuid.uuid4())
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[TenantErasureWorkflow],
                          activities=_actividades(orden, falla)):
            return await env.client.execute_workflow(
                TenantErasureWorkflow.run, args=[cid, "op-1", "op@x.invalid"],
                id=workflow_id(cid), task_queue=COLA)


@pytest.mark.asyncio
async def test_orden_fijo_y_resultado():
    orden: list = []
    r = await _correr(orden, falla=False)
    assert orden == ["suspender", "temporal", "externos", "grafo", "postgres", "auth", "recibo"]
    assert r["grafo"] == "borrado" and r["auth"] == "borrado" and r["postgres"] == {"tenants": 1}


@pytest.mark.asyncio
async def test_si_graphity_falla_se_reintenta_y_postgres_no_se_borra_antes():
    orden: list = []
    await _correr(orden, falla=True)
    # grafo corre dos veces (falla + reintento) y SIEMPRE antes de postgres: si Postgres se borrara
    # primero, un fallo posterior de Graphity dejaría datos personales sin forma de identificar de quién
    assert orden.count("grafo") == 2
    assert orden.index("postgres") > max(i for i, p in enumerate(orden) if p == "grafo")
    assert orden[-1] == "recibo"
