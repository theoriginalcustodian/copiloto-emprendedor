"""Crea el Temporal Schedule de clasificación de feedback (BETA-4a) — uno POR TENANT, idempotente.

Calca `ensure_mi_dia_schedules.py` (mismo criterio: la clasificación es independiente por ticket, no
hay "el peor de todos" que justifique una cola cross-tenant como en `ensure_autosanacion_schedules.py`
— ver el docstring de `procesar_feedback_pendiente_de_tenant`).

`schedule_id` determinístico (`soporte-feedback-{cliente_id}`) → correr N veces no duplica.

Uso:
    DATABASE_URL=... TEMPORAL_TARGET=127.0.0.1:7233 python ensure_soporte_feedback_schedule.py

Se corre con el worker YA registrando `SoporteFeedbackWorkflow`/`procesar_feedback_pendiente_de_tenant`.
"""
from __future__ import annotations

import asyncio
import os
from datetime import timedelta

#: Cada 30 min: el feedback no es urgente (Decisión 4 del contrato: siempre batch/async, nunca en el
#: turno del chat) y el volumen de BETA es bajo — no hace falta más frecuencia que esto.
PASO_MINUTOS = int(os.environ.get("COPILOTO_SOPORTE_FEEDBACK_PASO_MIN", "30"))
SCHEMA = "uc_factory"


def _schedule_id(cliente_id: str) -> str:
    return f"soporte-feedback-{cliente_id}"


def _tenants_activos(database_url: str) -> list[str]:
    import psycopg2

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT cliente_id::text FROM {SCHEMA}.tenants WHERE status = 'active'")
            return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


async def ensure_schedule(client, cliente_id: str, task_queue: str) -> str:
    """`"creado"` | `"ya existía"` — nunca lanza si el Schedule ya está."""
    from temporalio.client import (Schedule, ScheduleActionStartWorkflow, ScheduleAlreadyRunningError,
                                   ScheduleIntervalSpec, ScheduleSpec)

    schedule_id = _schedule_id(cliente_id)
    try:
        await client.create_schedule(
            schedule_id,
            Schedule(
                action=ScheduleActionStartWorkflow(
                    "SoporteFeedbackWorkflow", cliente_id,
                    id=f"soporte-feedback-run-{cliente_id}", task_queue=task_queue,
                ),
                spec=ScheduleSpec(intervals=[
                    ScheduleIntervalSpec(every=timedelta(minutes=PASO_MINUTOS))]),
            ),
        )
        return "creado"
    except ScheduleAlreadyRunningError:
        return "ya existía"


async def main() -> None:
    from temporalio.client import Client

    database_url = os.environ["DATABASE_URL"]
    target = os.environ.get("TEMPORAL_TARGET", "localhost:7233")
    namespace = os.environ.get("TEMPORAL_NAMESPACE", "default")
    task_queue = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")

    tenants = _tenants_activos(database_url)
    print(f"{len(tenants)} tenant(s) activo(s)", flush=True)

    client = await Client.connect(target, namespace=namespace)
    for cliente_id in tenants:
        resultado = await ensure_schedule(client, cliente_id, task_queue)
        print(f"  {cliente_id}: {resultado} (cada {PASO_MINUTOS} min, task_queue={task_queue})",
              flush=True)


if __name__ == "__main__":
    asyncio.run(main())
