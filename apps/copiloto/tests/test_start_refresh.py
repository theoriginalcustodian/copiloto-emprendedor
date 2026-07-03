"""Tests de `make_start_refresh` (Task 9) — arranque durable del `MpRefreshWorkflow` al conectar MP.

Boundary bajo test: `make_start_refresh(temporal_client)` devuelve una función async `start_refresh(cliente_id,
seller_user_id)` que arranca el workflow de forma IDEMPOTENTE (`id_conflict_policy=USE_EXISTING`, `id`
determinístico por `(cliente_id, seller_user_id)`) — reconectar el mismo seller NO debe duplicar el loop de
refresh. `temporal_client` es un FAKE spy (async) — no requiere Temporal real."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1]
ARCH = APP.parents[1] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(APP))

from temporalio.common import WorkflowIDConflictPolicy  # noqa: E402

from clients.agent.providers.mp_refresh_workflow import MpRefreshWorkflow  # noqa: E402
from web import AGENT_B_TASK_QUEUE, MAX_REFRESH_CYCLES, REFRESH_INTERVAL_SECONDS, make_start_refresh  # noqa: E402


class _FakeTemporalClient:
    """Spy async: registra cada llamada a start_workflow (args posicionales + kwargs) sin tocar Temporal real."""

    def __init__(self):
        self.calls = []

    async def start_workflow(self, *args, **kwargs):
        self.calls.append((args, kwargs))


@pytest.mark.asyncio
async def test_start_refresh_arranca_mp_refresh_workflow_idempotente():
    client = _FakeTemporalClient()
    start_refresh = make_start_refresh(client)

    await start_refresh("cliente-A", "146")

    assert len(client.calls) == 1
    args, kwargs = client.calls[0]
    assert args[0] is MpRefreshWorkflow.run                      # workflow correcto
    assert kwargs["id"] == "mp-refresh-cliente-A-146"            # id determinístico por (cliente_id, seller)
    assert kwargs["task_queue"] == AGENT_B_TASK_QUEUE
    assert kwargs["id_conflict_policy"] == WorkflowIDConflictPolicy.USE_EXISTING   # idempotencia
    assert kwargs["args"] == ["cliente-A", "146", REFRESH_INTERVAL_SECONDS, MAX_REFRESH_CYCLES]


@pytest.mark.asyncio
async def test_start_refresh_id_distingue_por_seller_no_solo_por_cliente():
    """Un mismo cliente_id con DOS sellers (dos cuentas MP conectadas) debe arrancar DOS workflows
    distintos -- el id incluye el seller, no solo el cliente_id."""
    client = _FakeTemporalClient()
    start_refresh = make_start_refresh(client)

    await start_refresh("cliente-A", "146")
    await start_refresh("cliente-A", "999")

    ids = {kwargs["id"] for _, kwargs in client.calls}
    assert ids == {"mp-refresh-cliente-A-146", "mp-refresh-cliente-A-999"}


@pytest.mark.asyncio
async def test_start_refresh_respeta_task_queue_e_intervalos_custom():
    client = _FakeTemporalClient()
    start_refresh = make_start_refresh(client, task_queue="custom-q",
                                        refresh_interval_seconds=10.0, max_cycles=3)

    await start_refresh("cliente-B", "seller-9")

    _, kwargs = client.calls[0]
    assert kwargs["task_queue"] == "custom-q"
    assert kwargs["args"] == ["cliente-B", "seller-9", 10.0, 3]


def test_refresh_interval_menor_a_vencimiento_180_dias():
    """M1 dejó `expires_at` absoluto a partir del vencimiento REAL del token MP (180 días). El intervalo de
    refresh tiene que quedar por debajo de ese vencimiento con colchón -- si no, el token podría expirar entre
    ciclos. No es un valor desacoplado: se ancla al contrato real de MercadoPago."""
    ciento_ochenta_dias_seg = 180 * 24 * 3600
    assert 0 < REFRESH_INTERVAL_SECONDS < ciento_ochenta_dias_seg
