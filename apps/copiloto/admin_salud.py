"""CONS2 · A1 — Salud del front-door, workers y Schedules. Read-only, cross-tenant por diseño (la
consola opera la APP, no los datos de un tenant — specs §2).

## Lo verificado empíricamente antes de escribir esto (no asumido de la doc)

Contra el Temporal real del VPS, con el SDK instalado (no la doc genérica, que no cubre
`list_schedules`/`describe_task_queue` para ningún lenguaje):

- `client.list_schedules()` es una CORRUTINA que devuelve un iterador -- hace falta
  `async for s in await client.list_schedules():`, no `async for s in client.list_schedules():`.
  El segundo no tira error de sintaxis, tira `TypeError` en runtime.
- `describe_task_queue` NO vive en `Client` (alto nivel): vive en el stub gRPC crudo
  (`client.workflow_service.describe_task_queue(...)`), con `report_pollers=True` en el request.
- El namespace `default` es COMPARTIDO con otras apps del VPS (`documed-drenaje-grafo` apareció
  en `list_schedules()` real). Sin filtrar por los prefijos propios, la salud de OTRA app se
  reportaría como si fuera nuestra.

## Los 4 prefijos, calcados de `deploy/worker/ensure_*_schedules.py`

`autosanacion-global` (exacto, uno solo) · `grafo-sync-` · `mi-dia-` · `soporte-feedback-`
(prefijos, uno por tenant). Si alguien agrega un 5º `ensure_*_schedules.py`, este archivo queda
desactualizado a propósito -- mejor un prefijo faltante detectable a ojo que adivinar por regex
genérico y arrastrar schedules ajenos.
"""
from __future__ import annotations

from temporalio.api.taskqueue.v1 import TaskQueue
from temporalio.api.workflowservice.v1 import DescribeTaskQueueRequest
from temporalio.client import Client

PREFIJOS_PROPIOS = ("autosanacion-global", "grafo-sync-", "mi-dia-", "soporte-feedback-")


def _es_propio(schedule_id: str) -> bool:
    return schedule_id == "autosanacion-global" or any(
        schedule_id.startswith(p) for p in PREFIJOS_PROPIOS if p != "autosanacion-global")


async def estado_salud(client: Client, *, namespace: str, task_queue: str) -> dict:
    """Un solo round-trip por pieza: 1 `describe_task_queue` + 1 `list_schedules` (paginado por el
    SDK). No es una llamada por schedule -- con cientos de tenants seguiría siendo barato."""
    req = DescribeTaskQueueRequest(
        namespace=namespace, task_queue=TaskQueue(name=task_queue), report_pollers=True)
    resp = await client.workflow_service.describe_task_queue(req)
    pollers = len(resp.pollers)

    total = pausados = sin_proxima_corrida = 0
    async for s in await client.list_schedules():
        if not _es_propio(s.id):
            continue
        total += 1
        if s.schedule.state.paused:
            pausados += 1
        # Un schedule ACTIVO (no pausado) sin próxima corrida es la señal de que algo se rompió --
        # Temporal dejó de poder calcular/despachar la siguiente acción.
        elif not s.info.next_action_times:
            sin_proxima_corrida += 1

    return {
        "ok": pollers > 0 and sin_proxima_corrida == 0,
        "workers": {"task_queue": task_queue, "pollers": pollers, "ok": pollers > 0},
        "schedules": {
            "total": total,
            "pausados": pausados,
            "sin_proxima_corrida": sin_proxima_corrida,
            "ok": sin_proxima_corrida == 0,
        },
    }
