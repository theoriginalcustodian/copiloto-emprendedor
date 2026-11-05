"""`TenantErasureWorkflow` — baja de UN tenant, durable e idempotente (SEC-D8 · ISO 27701 7.3).

Orden (cada paso es idempotente; Temporal reintenta hasta que el paso funcione, y un borrado que no
terminó NO se reporta como hecho):

  1. suspender   — corta el acceso YA (el tenant no puede seguir escribiendo mientras se borra).
  2. temporal    — borra sus Schedules y termina sus workflows vivos (si no, re-escriben datos).
  3. externos    — revoca las conexiones Composio.
  4. grafo       — borra su user graph en Graphity (levanta si falla: `MemoryProvider.forget`).
  5. postgres    — borra las filas (ver `tenant_erasure_store`) y por último el registro `tenants`.
  6. auth        — borra el usuario de GoTrue.
  7. recibo      — fila de auditoría (append-only) con SÓLO conteos.

Determinismo: todo el I/O vive en `tenant_erasure_activities`; el workflow sólo orquesta.
"""
from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

TIMEOUT = timedelta(seconds=120)
REINTENTO = RetryPolicy(maximum_attempts=10, initial_interval=timedelta(seconds=5),
                        backoff_coefficient=2.0, maximum_interval=timedelta(minutes=5))


def workflow_id(cliente_id: str) -> str:
    return f"borrado-tenant-{cliente_id}"


@workflow.defn
class TenantErasureWorkflow:
    @workflow.run
    async def run(self, cliente_id: str, solicitante: str, solicitante_email: str = "") -> dict:
        async def paso(nombre: str, *args):
            return await workflow.execute_activity(
                nombre, args=list(args), start_to_close_timeout=TIMEOUT, retry_policy=REINTENTO)

        auth_user_id = await paso("tenant_erasure_suspender", cliente_id)
        await paso("tenant_erasure_temporal", cliente_id, workflow_id(cliente_id))
        await paso("tenant_erasure_externos", cliente_id)
        grafo = await paso("tenant_erasure_grafo", cliente_id)
        recibo = await paso("tenant_erasure_postgres", cliente_id)
        auth = await paso("tenant_erasure_auth", auth_user_id)
        await paso("tenant_erasure_recibo", cliente_id, solicitante, solicitante_email,
                   {"postgres": recibo, "grafo": grafo, "auth": auth})
        return {"cliente_id": cliente_id, "grafo": grafo, "auth": auth, "postgres": recibo}
