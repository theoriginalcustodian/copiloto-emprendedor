"""`GrafoSyncWorkflow` — lo que dispara el Schedule incremental de sync evento→grafo (BETA-G0).

Mismo criterio que `MiDiaDetectorWorkflow` (hito 7): un Schedule POR TENANT dispara una ejecución nueva
de este workflow con cadencia fija (`deploy/worker/ensure_grafo_sync_schedules.py`). El workflow es
deliberadamente CORTO — llama la activity y termina; cada corrida es su propia ejecución con su propio
historial en la Visibility de Temporal (se puede ver por qué una corrida no sincronizó nada).

Determinismo: todo el I/O (SQL, HTTP a Graphity) vive en `sincronizar_grafo_negocio` (activity,
`grafo_sync_activities.py`) — el workflow sólo orquesta.
"""
from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

TIMEOUT = timedelta(seconds=120)   # el POST no corre LLM (encola), pero el poll del writer puede tardar
REINTENTO = RetryPolicy(maximum_attempts=3, initial_interval=timedelta(seconds=5))


@workflow.defn
class GrafoSyncWorkflow:
    @workflow.run
    async def run(self, cliente_id: str) -> dict:
        return await workflow.execute_activity(
            "sincronizar_grafo_negocio", cliente_id,
            start_to_close_timeout=TIMEOUT, retry_policy=REINTENTO)
