"""Crea el Temporal Schedule diario de "Mi día" (hito 7) para cada tenant activo — idempotente.

Un Schedule POR `cliente_id`, que dispara `MiDiaDetectorWorkflow` una vez por día a la mañana
(contrato `mi-dia-y-el-detector-proactivo` §1.1: "una sola vez alcanza" — decisión del operador).

Idempotente: `schedule_id` es determinístico (`mi-dia-{cliente_id}`), así que correr este script
N veces no crea Schedules duplicados — `ScheduleAlreadyRunningError` se atrapa y se trata como
"ya existe, seguí".

Uso:
    DATABASE_URL=... TEMPORAL_TARGET=127.0.0.1:7233 python ensure_mi_dia_schedules.py

Se corre después de `provision.py` (necesita la tabla `tenants`) y con el worker YA registrando
`MiDiaDetectorWorkflow`/`avanzar_tablero_mi_dia` (si el Schedule dispara antes de que el worker
sepa el workflow, la ejecución queda encolada hasta que el worker levante — no se pierde).
"""
from __future__ import annotations

import asyncio
import os
from datetime import timedelta

HORA_DISPARO = int(os.environ.get("COPILOTO_MI_DIA_HORA", "9"))  # 9am, hora del servidor
SCHEMA = "uc_factory"


def _schedule_id(cliente_id: str) -> str:
    return f"mi-dia-{cliente_id}"


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
                                   ScheduleCalendarSpec, ScheduleRange, ScheduleSpec)

    schedule_id = _schedule_id(cliente_id)
    try:
        await client.create_schedule(
            schedule_id,
            Schedule(
                action=ScheduleActionStartWorkflow(
                    "MiDiaDetectorWorkflow", cliente_id,
                    id=f"mi-dia-run-{cliente_id}", task_queue=task_queue,
                ),
                spec=ScheduleSpec(
                    calendars=[ScheduleCalendarSpec(
                        hour=[ScheduleRange(HORA_DISPARO)], minute=[ScheduleRange(0)])],
                ),
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
        print(f"  {cliente_id}: {resultado} (dispara {HORA_DISPARO:02d}:00, task_queue={task_queue})",
              flush=True)


if __name__ == "__main__":
    asyncio.run(main())
