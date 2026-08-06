"""CONS2 · A1 — `admin_salud.estado_salud`, con un `Client` de Temporal mockeado.

No usa un Temporal real: lo que se verifica acá es la LÓGICA de filtrado y agregación (los 4
prefijos propios, pausados, sin-próxima-corrida), no el SDK en sí -- eso ya se verificó de forma
empírica y en vivo contra el VPS antes de escribir `admin_salud.py` (ver su docstring).
"""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from admin_salud import _es_propio, estado_salud

AHORA = datetime.now(timezone.utc)


def _schedule(id_: str, *, paused: bool = False, next_action: bool = True):
    return SimpleNamespace(
        id=id_,
        schedule=SimpleNamespace(state=SimpleNamespace(paused=paused)),
        info=SimpleNamespace(next_action_times=[AHORA] if next_action else []),
    )


class _ScheduleIter:
    def __init__(self, items):
        self._items = list(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._items:
            raise StopAsyncIteration
        return self._items.pop(0)


def _client(schedules, *, pollers: int = 1):
    client = SimpleNamespace()
    client.workflow_service = SimpleNamespace(
        describe_task_queue=AsyncMock(return_value=SimpleNamespace(pollers=list(range(pollers)))))
    client.list_schedules = AsyncMock(return_value=_ScheduleIter(schedules))
    return client


@pytest.mark.parametrize("id_,esperado", [
    ("autosanacion-global", True),
    ("grafo-sync-abc123", True),
    ("mi-dia-abc123", True),
    ("soporte-feedback-abc123", True),
    ("documed-drenaje-grafo", False),
    ("autosanacion-global-viejo", False),  # no es exacto, no cuenta
])
def test_es_propio_filtra_por_los_4_prefijos_reales(id_, esperado):
    assert _es_propio(id_) is esperado


@pytest.mark.asyncio
async def test_workers_vivos_y_schedules_sanos_da_ok():
    client = _client([_schedule("autosanacion-global"), _schedule("grafo-sync-t1")], pollers=1)
    r = await estado_salud(client, namespace="default", task_queue="agent-emprendedor")
    assert r["ok"] is True
    assert r["workers"] == {"task_queue": "agent-emprendedor", "pollers": 1, "ok": True}
    assert r["schedules"] == {"total": 2, "pausados": 0, "sin_proxima_corrida": 0, "ok": True}


@pytest.mark.asyncio
async def test_sin_pollers_da_ok_false():
    client = _client([], pollers=0)
    r = await estado_salud(client, namespace="default", task_queue="agent-emprendedor")
    assert r["ok"] is False
    assert r["workers"]["ok"] is False


@pytest.mark.asyncio
async def test_schedule_activo_sin_proxima_corrida_da_ok_false():
    """La señal real de "algo se rompió": no pausado, pero Temporal no calculó próxima corrida."""
    client = _client([_schedule("autosanacion-global", next_action=False)], pollers=1)
    r = await estado_salud(client, namespace="default", task_queue="agent-emprendedor")
    assert r["ok"] is False
    assert r["schedules"]["sin_proxima_corrida"] == 1


@pytest.mark.asyncio
async def test_schedule_pausado_no_cuenta_como_sin_proxima_corrida():
    """Pausado a propósito (mantenimiento) no es lo mismo que roto -- no debe ensuciar `ok`."""
    client = _client([_schedule("mi-dia-t1", paused=True, next_action=False)], pollers=1)
    r = await estado_salud(client, namespace="default", task_queue="agent-emprendedor")
    assert r["ok"] is True
    assert r["schedules"] == {"total": 1, "pausados": 1, "sin_proxima_corrida": 0, "ok": True}


@pytest.mark.asyncio
async def test_schedule_de_otra_app_no_se_cuenta():
    """El namespace es compartido (documed también vive ahí, verificado en vivo) -- sin el filtro,
    la salud de OTRA app se reportaría como si fuera nuestra."""
    client = _client([_schedule("documed-drenaje-grafo"), _schedule("autosanacion-global")], pollers=1)
    r = await estado_salud(client, namespace="default", task_queue="agent-emprendedor")
    assert r["schedules"]["total"] == 1
