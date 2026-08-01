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
ciclo: con el tope diario en 5, hacen falta CINCO disparos para agotarlo. Con uno solo —como estuvo
hasta el 2026-08-01— el máximo real era 1 bug/día y el tope nunca llegaba a morder. Un cron cada 5
minutos tampoco repararía más rápido: chocaría contra el mismo tope, gastando un `tomar()` por
vuelta. El número de disparos y el tope son la misma decisión mirada de dos lados, y sólo tiene
sentido moverlos juntos.

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
#: Cada 2 h entre las 00:00 y las 08:00 → 5 disparos, uno por cada reparación que el tope diario
#: permite. Antes había UN disparo: con "una ejecución = un trauma", el máximo real era 1 bug/día y
#: el tope de 5 era decorativo — no limitaba nada porque nunca se llegaba a él. Aprobado por el
#: operador el 2026-08-01. El tope NO se toca: es el que acota el daño de un ciclo que se desboca.
HORA_INICIO = int(os.environ.get("COPILOTO_AUTOSANACION_HORA", "0"))
HORA_FIN = int(os.environ.get("COPILOTO_AUTOSANACION_HORA_FIN", "8"))
PASO_HORAS = int(os.environ.get("COPILOTO_AUTOSANACION_PASO_HORAS", "2"))
ENV_KILL_SWITCH = "COPILOTO_AUTOSANACION_OFF"
SCHEDULE_ID = "autosanacion-global"

#: Prefijo de los Schedules por-tenant de la topología vieja (uno por `cliente_id`), a limpiar.
PREFIJO_VIEJO = "autosanacion-"


def _apagado() -> bool:
    return os.environ.get(ENV_KILL_SWITCH, "").strip().lower() in ("1", "true", "yes")


def horas_de_disparo() -> list[int]:
    """Las horas efectivas, expandidas — lo que se imprime y lo que se compara contra el vivo."""
    return list(range(HORA_INICIO, HORA_FIN + 1, max(PASO_HORAS, 1)))


def _spec():
    from temporalio.client import ScheduleCalendarSpec, ScheduleRange, ScheduleSpec

    return ScheduleSpec(calendars=[ScheduleCalendarSpec(
        hour=[ScheduleRange(HORA_INICIO, HORA_FIN, max(PASO_HORAS, 1))],
        minute=[ScheduleRange(0)])])


def _horas_del_spec(spec) -> list[int]:
    """Expande los `ScheduleRange` de un spec a horas concretas: *¿a qué horas dispara?*

    Se compara el EFECTO y no los objetos: un mismo conjunto de horas se puede expresar de varias
    formas (`[0,2,4,6,8]` suelto vs. un rango con paso 2), y comparar objetos marcaría como
    "distinto" un Schedule idéntico → reescritura en cada deploy.

    Medido contra el temporalio 1.28.0 del VPS y contra el Schedule vivo: tanto el constructor como
    el server normalizan —`ScheduleRange(4)` llega como `(start=4, end=4, step=1)`, en tupla—, así
    que no hace falta tratar `end` ausente. El `or 1` queda sólo para un rango construido a mano con
    `step=0`, que haría lanzar a `range()`.
    """
    horas: set[int] = set()
    for cal in getattr(spec, "calendars", []) or []:
        for r in getattr(cal, "hour", []) or []:
            horas.update(range(r.start, r.end + 1, r.step or 1))
    return sorted(horas)


async def ensure_schedule(client, task_queue: str) -> str:
    """`"creado"` | `"creado (pausado)"` | `"ya existía"` | `"spec actualizado …"`.

    Nunca lanza si el Schedule ya está, y **nunca toca `state`**: si alguien pausó el Schedule a mano
    para frenar un ciclo que se estaba portando mal, un deploy no puede volver a encenderlo. Pero el
    *spec* sí se sincroniza — antes tampoco se tocaba, y eso convertía cualquier cambio de frecuencia
    en un no-op silencioso: el código nuevo desplegado, el Schedule viejo intacto y el log diciendo
    "ya existía". Un cambio que parece aplicado y no lo está es peor que uno que falla.
    """
    from temporalio.client import (Schedule, ScheduleActionStartWorkflow,
                                   ScheduleAlreadyRunningError, ScheduleState, ScheduleUpdate)

    pausado = _apagado()
    try:
        await client.create_schedule(
            SCHEDULE_ID,
            Schedule(
                action=ScheduleActionStartWorkflow(
                    "AutosanacionWorkflow",
                    id="autosanacion-run", task_queue=task_queue,
                ),
                spec=_spec(),
                state=ScheduleState(
                    paused=pausado,
                    note=f"pausado por {ENV_KILL_SWITCH}" if pausado else "",
                ),
            ),
        )
        return "creado (pausado)" if pausado else "creado"
    except ScheduleAlreadyRunningError:
        pass

    handle = client.get_schedule_handle(SCHEDULE_ID)
    vivas = _horas_del_spec((await handle.describe()).schedule.spec)
    deseadas = horas_de_disparo()
    if vivas == deseadas:
        return "ya existía"

    def _cambiar_solo_el_spec(entrada):
        schedule = entrada.description.schedule
        schedule.spec = _spec()      # `state` queda como estaba: la pausa manual sobrevive al deploy
        return ScheduleUpdate(schedule=schedule)

    await handle.update(_cambiar_solo_el_spec)
    return (f"spec actualizado: {len(vivas)}→{len(deseadas)} disparo(s) "
            f"({_hhmm(vivas)} → {_hhmm(deseadas)})")


def _hhmm(horas: list[int]) -> str:
    return ", ".join(f"{h:02d}:00" for h in horas) or "(ninguno)"


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
    disparos = horas_de_disparo()
    print(f"{SCHEDULE_ID}: {resultado} (dispara {_hhmm(disparos)}, task_queue={task_queue}){estado}",
          flush=True)

    # Control de coherencia: los disparos son el techo REAL de reparaciones/día, porque cada
    # ejecución toma un solo trauma. Si son menos que el tope, el tope no limita nada y el número
    # que figura en la config miente sobre lo que el ciclo puede hacer — que es exactamente cómo
    # estuvo hasta hoy (1 disparo, tope 5). Se avisa en vez de asumir que alguien lo va a notar.
    try:
        from autosanacion_gates import tope_diario  # noqa: PLC0415 — opcional: el script corre solo
    except ImportError:
        print("  (no se pudo leer el tope diario desde acá: control de coherencia OMITIDO)", flush=True)
    else:
        tope = tope_diario()
        if len(disparos) < tope:
            print(f"  ⚠️  {len(disparos)} disparo(s)/día < tope diario {tope}: el techo real es "
                  f"{len(disparos)} bug(s)/día y el tope NO llega a morder", flush=True)
        else:
            print(f"  ✅ {len(disparos)} disparo(s)/día ≥ tope diario {tope}: el tope es el límite "
                  f"efectivo, como debe ser", flush=True)

    borrados = await limpiar_schedules_por_tenant(client)
    print(f"{borrados} Schedule(s) por-tenant de la topología vieja eliminado(s)", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
