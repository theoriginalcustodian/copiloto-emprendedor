"""Crea el Temporal Schedule del ciclo de auto-reparación (Fase 3) por tenant — idempotente.

Calca `ensure_mi_dia_schedules.py`, que ya está en producción: un Schedule por `cliente_id`, id
determinístico, `ScheduleAlreadyRunningError` tratado como "ya existe, seguí".

## Tres decisiones propias de este ciclo

**Dispara de madrugada, no a las 9.** El paso caro es la suite completa en un sandbox (hasta 20
minutos de CPU). A las 9 compite con los tenants usando la app; a las 4 no compite con nadie.

**Una ejecución = un trauma.** El workflow toma uno solo, así que el Schedule marca el ritmo del
ciclo: con el tope diario en 5, cinco disparos por día alcanzan para agotarlo. Un cron cada 5
minutos no repararía más rápido — chocaría contra el mismo tope, gastando un `tomar()` por vuelta.

**Nace PAUSADO si `COPILOTO_AUTOSANACION_OFF` está activo.** El kill switch ya frena el ciclo en el
gate, pero un Schedule corriendo contra un ciclo apagado igual arranca una ejecución por disparo, la
rechaza y la escribe en Temporal. Ruido que después hay que aprender a ignorar — y aprender a
ignorar alertas es cómo se pierde la que importa.

Uso:
    DATABASE_URL=... TEMPORAL_TARGET=127.0.0.1:7233 python ensure_autosanacion_schedules.py

Se corre después de `provision.py` y con el worker YA registrando `AutosanacionWorkflow` y sus 7
activities. Si el Schedule dispara antes, la ejecución queda encolada hasta que el worker levante.
"""
from __future__ import annotations

import asyncio
import os

#: De madrugada: el paso caro es una suite completa, y a esa hora no compite con nadie.
HORA_DISPARO = int(os.environ.get("COPILOTO_AUTOSANACION_HORA", "4"))
SCHEMA = "uc_factory"
ENV_KILL_SWITCH = "COPILOTO_AUTOSANACION_OFF"


def _schedule_id(cliente_id: str) -> str:
    return f"autosanacion-{cliente_id}"


def _apagado() -> bool:
    return os.environ.get(ENV_KILL_SWITCH, "").strip().lower() in ("1", "true", "yes")


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
    """`"creado"` | `"creado (pausado)"` | `"ya existía"` — nunca lanza si el Schedule ya está."""
    from temporalio.client import (Schedule, ScheduleActionStartWorkflow,
                                   ScheduleAlreadyRunningError, ScheduleCalendarSpec, ScheduleRange,
                                   ScheduleSpec, ScheduleState)

    pausado = _apagado()
    try:
        await client.create_schedule(
            _schedule_id(cliente_id),
            Schedule(
                action=ScheduleActionStartWorkflow(
                    "AutosanacionWorkflow", cliente_id,
                    id=f"autosanacion-run-{cliente_id}", task_queue=task_queue,
                ),
                spec=ScheduleSpec(
                    calendars=[ScheduleCalendarSpec(
                        hour=[ScheduleRange(HORA_DISPARO)], minute=[ScheduleRange(0)])],
                ),
                state=ScheduleState(
                    paused=pausado,
                    note=f"pausado por {ENV_KILL_SWITCH}" if pausado else "",
                ),
            ),
        )
        return "creado (pausado)" if pausado else "creado"
    except ScheduleAlreadyRunningError:
        # Deliberadamente NO se actualiza el existente: si alguien pausó un Schedule a mano para
        # frenar un ciclo que se estaba portando mal, un `update` silencioso lo volvería a encender
        # en el próximo deploy. El kill switch por env sigue frenándolo en el gate igual.
        return "ya existía"


async def main() -> None:
    from temporalio.client import Client

    database_url = os.environ["DATABASE_URL"]
    target = os.environ.get("TEMPORAL_TARGET", "localhost:7233")
    namespace = os.environ.get("TEMPORAL_NAMESPACE", "default")
    task_queue = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")

    tenants = _tenants_activos(database_url)
    estado = " (el kill switch está activo: nacen PAUSADOS)" if _apagado() else ""
    print(f"{len(tenants)} tenant(s) activo(s){estado}", flush=True)

    client = await Client.connect(target, namespace=namespace)
    for cliente_id in tenants:
        resultado = await ensure_schedule(client, cliente_id, task_queue)
        print(f"  {cliente_id}: {resultado} (dispara {HORA_DISPARO:02d}:00, "
              f"task_queue={task_queue})", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
