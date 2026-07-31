"""`MiDiaDetectorWorkflow` — lo que dispara el Schedule diario de Mi día (hito 7, contrato §1.1).

Un Schedule POR TENANT dispara una ejecución nueva de este workflow una vez por día, a la mañana
(`deploy/worker/ensure_mi_dia_schedules.py`). El workflow es deliberadamente CORTO: llama la activity y
termina — no hay estado que sobreviva entre corridas, cada día es su propia ejecución con su propio
historial. Eso es lo que da el DoD del contrato: "se puede ver por qué el martes no salió nada"
(visibilidad de Temporal sobre ejecuciones pasadas), sin acoplar el detector de HOY al de ayer.

Determinismo: ninguno de los pasos reales (SQL, fechas, redacción) vive acá — todo eso está en
`avanzar_tablero_mi_dia` (activity, `mi_dia_schedule_activities.py`). El workflow sólo orquesta.
"""
from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

TIMEOUT = timedelta(seconds=60)
REINTENTO = RetryPolicy(maximum_attempts=3, initial_interval=timedelta(seconds=2))


@workflow.defn
class MiDiaDetectorWorkflow:
    @workflow.run
    async def run(self, cliente_id: str) -> dict:
        return await workflow.execute_activity(
            "avanzar_tablero_mi_dia", cliente_id,
            start_to_close_timeout=TIMEOUT, retry_policy=REINTENTO)
