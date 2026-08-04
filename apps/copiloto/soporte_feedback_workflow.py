"""`SoporteFeedbackWorkflow` — dispara la clasificación de feedback de UN tenant (BETA-4a).

Calca `MiDiaDetectorWorkflow` (hito 7): un Schedule por `cliente_id` dispara una ejecución corta y
nueva, sin estado entre corridas — toda la lógica real vive en la activity
(`procesar_feedback_pendiente_de_tenant`), acá sólo se orquesta (determinismo, ver
`autosanacion_workflow.py` para el porqué de esta separación)."""
from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

TIMEOUT = timedelta(seconds=60)
REINTENTO = RetryPolicy(maximum_attempts=3, initial_interval=timedelta(seconds=2))


@workflow.defn
class SoporteFeedbackWorkflow:
    @workflow.run
    async def run(self, cliente_id: str) -> dict:
        return await workflow.execute_activity(
            "procesar_feedback_pendiente_de_tenant", cliente_id,
            start_to_close_timeout=TIMEOUT, retry_policy=REINTENTO)
