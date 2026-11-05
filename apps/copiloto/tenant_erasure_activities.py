"""Activities de `TenantErasureWorkflow` (SEC-D8). Corren fuera del sandbox: DB, HTTP y Temporal reales.

Deps inyectadas una sola vez al arrancar el worker (`set_tenant_erasure_deps`), mismo criterio que
`set_grafo_sync_deps`: el `conn_factory` COMPARTIDO, nunca uno por tenant. El `cliente_id` llega SIEMPRE
como argumento del workflow, que a su vez lo recibió del borde autenticado (token del propio tenant o
`require_admin`): ninguna activity lo deduce de un dato del request.
"""
from __future__ import annotations

import asyncio
from typing import Callable

from temporalio import activity
from temporalio.service import RPCError

import tenant_erasure_store as store
from admin_tenants import cambiar_estado
from auditoria_store import AuditoriaStore
from contexto_tenant import conexion_con_tenant, tenant

_deps: dict = {}

#: Prefijos de Schedules por tenant (ver `ensure_*_schedules.py`).
PREFIJOS_SCHEDULE = ("grafo-sync-", "mi-dia-", "soporte-feedback-")


def set_tenant_erasure_deps(*, conn_factory: Callable, composio_gateway=None, memory_provider=None,
                            gotrue_factory: Callable | None = None) -> None:
    _deps.update(conn_factory=conn_factory, composio_gateway=composio_gateway,
                 memory_provider=memory_provider, gotrue_factory=gotrue_factory)


def _cf():
    return conexion_con_tenant(_deps["conn_factory"])


@activity.defn(name="tenant_erasure_suspender")
async def tenant_erasure_suspender(cliente_id: str) -> str | None:
    def _run():
        with tenant(cliente_id):
            auth_user_id = store.auth_user_id_de(_cf(), cliente_id)
            cambiar_estado(_cf(), cliente_id=cliente_id, nuevo_estado="suspended")
            return auth_user_id
    return await asyncio.to_thread(_run)


@activity.defn(name="tenant_erasure_temporal")
async def tenant_erasure_temporal(cliente_id: str, propio_workflow_id: str) -> dict:
    client = activity.client()
    schedules = 0
    # 1) los conocidos por id exacto (idempotente: NOT_FOUND = ya no existe)
    for prefijo in PREFIJOS_SCHEDULE:
        try:
            await client.get_schedule_handle(f"{prefijo}{cliente_id}").delete()
            schedules += 1
        except RPCError as exc:
            if "not found" not in str(exc).lower():
                raise
    # 2) red de seguridad: CUALQUIER schedule cuyo id termine en `-{cliente_id}` (un schedule por tenant
    #    nuevo que no esté en PREFIJOS_SCHEDULE no puede sobrevivir al borrado en silencio).
    async for s in await client.list_schedules():
        if s.id.endswith(f"-{cliente_id}"):
            await client.get_schedule_handle(s.id).delete()
            schedules += 1
    terminados = 0
    async for wf in client.list_workflows('ExecutionStatus="Running"'):
        if cliente_id in wf.id and wf.id != propio_workflow_id:
            await client.get_workflow_handle(wf.id).terminate(reason="SEC-D8: baja de tenant")
            terminados += 1
    return {"schedules": schedules, "workflows_terminados": terminados}


@activity.defn(name="tenant_erasure_externos")
async def tenant_erasure_externos(cliente_id: str) -> dict:
    gw = _deps.get("composio_gateway")
    if gw is None:
        return {"composio": "no-configurado"}

    def _run():
        revocadas = 0
        for c in gw.list_connections(cliente_id):
            gw.revoke(c["id"])
            revocadas += 1
        gw.invalidate(cliente_id)
        return {"composio_revocadas": revocadas}
    return await asyncio.to_thread(_run)


@activity.defn(name="tenant_erasure_grafo")
async def tenant_erasure_grafo(cliente_id: str) -> str:
    mp = _deps.get("memory_provider")
    if mp is None:
        return "memoria-off"   # sin Graphity configurado no hay user graph que borrar
    await asyncio.to_thread(mp.forget, cliente_id)   # LEVANTA si falla -> Temporal reintenta
    return "borrado"


@activity.defn(name="tenant_erasure_postgres")
async def tenant_erasure_postgres(cliente_id: str) -> dict:
    def _run():
        with tenant(cliente_id):
            return store.borrar_datos(_cf(), cliente_id)
    return await asyncio.to_thread(_run)


@activity.defn(name="tenant_erasure_auth")
async def tenant_erasure_auth(auth_user_id: str | None) -> str:
    if not auth_user_id:
        return "sin-usuario"   # reintento tras un borrado previo completo
    factory = _deps.get("gotrue_factory")
    if factory is None:
        raise RuntimeError("gotrue_factory no configurado: no se puede borrar el usuario de GoTrue")
    await asyncio.to_thread(factory().admin_delete_user, auth_user_id)
    return "borrado"


@activity.defn(name="tenant_erasure_recibo")
async def tenant_erasure_recibo(cliente_id: str, solicitante: str, solicitante_email: str,
                                detalle: dict) -> None:
    def _run():
        with tenant(cliente_id):
            AuditoriaStore(_cf(), cliente_id).registrar(
                admin_user_id=solicitante, admin_email=solicitante_email,
                accion="tenant.borrado", detalle=detalle)
    await asyncio.to_thread(_run)


ACTIVITIES = [tenant_erasure_suspender, tenant_erasure_temporal, tenant_erasure_externos,
              tenant_erasure_grafo, tenant_erasure_postgres, tenant_erasure_auth, tenant_erasure_recibo]
