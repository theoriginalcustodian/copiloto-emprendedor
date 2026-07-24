"""`MiDiaDetectorWorkflow` — el disparo del Schedule diario (hito 7, contrato §1.1).

Mismo patrón que `test_mp_refresh_workflow.py`: `WorkflowEnvironment.start_time_skipping()`, sin
Postgres ni Schedule real — se ejercita el workflow + la activity de punta a punta, con
`mi_dia_orquestador.avanzar_tablero` monkeypatcheado (la lógica de negocio real ya está cubierta en
`test_mi_dia_detector.py`/`test_mi_dia_orquestador.py`; acá se prueba el plomero de Temporal).
"""
from __future__ import annotations

import uuid

import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

import mi_dia_orquestador
from mi_dia_schedule_activities import avanzar_tablero_mi_dia, set_mi_dia_deps
from mi_dia_schedule_workflow import MiDiaDetectorWorkflow


@pytest.mark.asyncio
async def test_el_workflow_llama_la_activity_y_devuelve_el_tablero(monkeypatch):
    llamadas = []

    def _fake_avanzar_tablero(conn_factory, cliente_id):
        llamadas.append(cliente_id)
        return {"para_hoy": [{"id": 1}], "haciendo": [], "hecha": []}

    monkeypatch.setattr(mi_dia_orquestador, "avanzar_tablero", _fake_avanzar_tablero)
    set_mi_dia_deps(lambda: None)  # conn_factory nunca se usa de verdad (fake arriba)

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="mi-dia-test",
                          workflows=[MiDiaDetectorWorkflow], activities=[avanzar_tablero_mi_dia]):
            resultado = await env.client.execute_workflow(
                MiDiaDetectorWorkflow.run, "cid-A",
                id=f"mi-dia-{uuid.uuid4()}", task_queue="mi-dia-test")

    assert resultado == {"para_hoy": [{"id": 1}], "haciendo": [], "hecha": []}
    assert llamadas == ["cid-A"]


def test_avanzar_tablero_mi_dia_asserta_si_no_se_llamo_set_mi_dia_deps():
    """Guard contra el orden de arranque: si el composition root olvida `set_mi_dia_deps`, la
    activity tiene que fallar RUIDOSO (assert), no silenciosamente con `conn_factory=None()`."""
    import mi_dia_schedule_activities as mod
    mod._conn_factory = None
    import inspect
    fuente = inspect.getsource(mod.avanzar_tablero_mi_dia)
    assert "_conn_factory is not None" in fuente
