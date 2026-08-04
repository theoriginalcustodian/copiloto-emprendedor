"""Crea el Temporal Schedule incremental de sync evento→grafo (BETA-G0) para cada tenant activo —
idempotente. Mismo patrón que `ensure_mi_dia_schedules.py` (hito 7), cadencia distinta: acá es
INCREMENTAL (cada N minutos, no una vez al día) porque el disparador es "hay eventos nuevos que
todavía no llegaron al grafo", no "una vez por jornada alcanza".

Un Schedule POR `cliente_id`, que dispara `GrafoSyncWorkflow` cada `COPILOTO_GRAFO_SYNC_MINUTOS`
minutos (default 15 — volumen bajo de eventos en esta etapa, no hace falta más frecuencia; bajar el
intervalo es un solo env var, sin tocar código).

Idempotente: `schedule_id` es determinístico (`grafo-sync-{cliente_id}`), así que correr este script
N veces no crea Schedules duplicados — `ScheduleAlreadyRunningError` se atrapa y se trata como
"ya existe, seguí".

Uso:
    DATABASE_URL=... TEMPORAL_TARGET=127.0.0.1:7233 python ensure_grafo_sync_schedules.py

Se corre después de `provision.py` (necesita la tabla `tenants`) y con el worker YA registrando
`GrafoSyncWorkflow`/`sincronizar_grafo_negocio` (si el Schedule dispara antes de que el worker sepa el
workflow, la ejecución queda encolada hasta que el worker levante — no se pierde).
"""
from __future__ import annotations

import asyncio
import os

INTERVALO_MINUTOS = int(os.environ.get("COPILOTO_GRAFO_SYNC_MINUTOS", "15"))
SCHEMA = "uc_factory"


def _schedule_id(cliente_id: str) -> str:
    return f"grafo-sync-{cliente_id}"


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
    from datetime import timedelta

    from temporalio.client import (Schedule, ScheduleActionStartWorkflow, ScheduleAlreadyRunningError,
                                   ScheduleIntervalSpec, ScheduleSpec)

    schedule_id = _schedule_id(cliente_id)
    try:
        await client.create_schedule(
            schedule_id,
            Schedule(
                action=ScheduleActionStartWorkflow(
                    "GrafoSyncWorkflow", cliente_id,
                    id=f"grafo-sync-run-{cliente_id}", task_queue=task_queue,
                ),
                spec=ScheduleSpec(
                    intervals=[ScheduleIntervalSpec(every=timedelta(minutes=INTERVALO_MINUTOS))],
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
        print(f"  {cliente_id}: {resultado} (cada {INTERVALO_MINUTOS}min, task_queue={task_queue})",
              flush=True)


if __name__ == "__main__":
    asyncio.run(main())
