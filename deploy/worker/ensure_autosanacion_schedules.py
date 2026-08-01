"""Crea el Temporal Schedule GLOBAL del ciclo de auto-reparación (Fase 3) — idempotente.

Hasta el 2026-08-01 este script creaba un Schedule POR TENANT (calcando
`ensure_mi_dia_schedules.py`). Decisión del operador: el ciclo pasa a ser UNO SOLO para toda la
app. El bug que repara vive en NUESTRO código, no en los datos del emprendedor — el tenant es un
atributo de la ocurrencia del trauma (vive en la fila que la activity procesa), no la unidad de
reparación. Un Schedule por tenant escalaba mal por construcción: hoy son 19 disparos idénticos a
las 4hs reparando el mismo bug; con 5000 emprendedores serían 5000.

## Tres decisiones propias de este ciclo (siguen vigentes con el Schedule único)

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
    TEMPORAL_TARGET=127.0.0.1:7233 python ensure_autosanacion_schedules.py

Se corre después de `provision.py` y con el worker YA registrando `AutosanacionWorkflow` y sus 7
activities. Si el Schedule dispara antes, la ejecución queda encolada hasta que el worker levante.
Ya no depende de `DATABASE_URL` ni de la tabla `tenants`: el workflow no recibe `cliente_id`.
"""
from __future__ import annotations

import asyncio
import os

#: De madrugada: el paso caro es una suite completa, y a esa hora no compite con nadie.
HORA_DISPARO = int(os.environ.get("COPILOTO_AUTOSANACION_HORA", "4"))
ENV_KILL_SWITCH = "COPILOTO_AUTOSANACION_OFF"
SCHEDULE_ID = "autosanacion-global"

#: Prefijo de los Schedules por-tenant de la topología vieja (uno por `cliente_id`), a limpiar.
PREFIJO_VIEJO = "autosanacion-"


def _apagado() -> bool:
    return os.environ.get(ENV_KILL_SWITCH, "").strip().lower() in ("1", "true", "yes")


async def ensure_schedule(client, task_queue: str) -> str:
    """`"creado"` | `"creado (pausado)"` | `"ya existía"` — nunca lanza si el Schedule ya está."""
    from temporalio.client import (Schedule, ScheduleActionStartWorkflow,
                                   ScheduleAlreadyRunningError, ScheduleCalendarSpec, ScheduleRange,
                                   ScheduleSpec, ScheduleState)

    pausado = _apagado()
    try:
        await client.create_schedule(
            SCHEDULE_ID,
            Schedule(
                action=ScheduleActionStartWorkflow(
                    "AutosanacionWorkflow",
                    id="autosanacion-run", task_queue=task_queue,
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


async def limpiar_schedules_por_tenant(client) -> int:
    """Borra los Schedules `autosanacion-<cliente_id>` de la topología vieja — idempotente.

    Se listan los Schedules vivos y se compara contra `SCHEDULE_ID`, en vez de derivar los ids desde
    la tabla de tenants: así también se limpian los de un tenant que ya no está activo — que son
    justamente los que nadie iría a buscar. Y correr esto dos veces no falla: a la segunda pasada ya
    no queda ninguno para borrar.
    """
    from temporalio.client import ScheduleHandle

    borrados = 0
    # `await` y recién después `async for`: `list_schedules` es una CORRUTINA que devuelve el
    # iterador (a diferencia de `list_workflows`, que devuelve el iterador directo). Sin el `await`
    # el `async for` recibe la corrutina cruda y revienta con "coroutine was never awaited" —
    # verificado con `inspect.iscoroutinefunction` contra el temporalio 1.28.0 del VPS.
    async for entrada in await client.list_schedules():
        schedule_id = entrada.id
        if schedule_id == SCHEDULE_ID or not schedule_id.startswith(PREFIJO_VIEJO):
            continue
        handle: ScheduleHandle = client.get_schedule_handle(schedule_id)
        await handle.delete()
        borrados += 1
        print(f"  borrado (topología vieja): {schedule_id}", flush=True)
    return borrados


async def main() -> None:
    from temporalio.client import Client

    target = os.environ.get("TEMPORAL_TARGET", "localhost:7233")
    namespace = os.environ.get("TEMPORAL_NAMESPACE", "default")
    task_queue = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")

    client = await Client.connect(target, namespace=namespace)

    resultado = await ensure_schedule(client, task_queue)
    estado = " (el kill switch está activo: nace PAUSADO)" if _apagado() and resultado == "creado (pausado)" else ""
    print(f"{SCHEDULE_ID}: {resultado} (dispara {HORA_DISPARO:02d}:00, task_queue={task_queue}){estado}",
          flush=True)

    borrados = await limpiar_schedules_por_tenant(client)
    print(f"{borrados} Schedule(s) por-tenant de la topología vieja eliminado(s)", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
