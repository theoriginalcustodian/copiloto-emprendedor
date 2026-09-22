"""BL-B2: el `FacturaWorkflow` esperando confirmación tiene ventana de vida (`VENTANA_VIDA_BORRADOR`).

Con time-skipping: un borrador abandonado pasa la ventana y termina CANCELADA `dictado_vencido`; un
update `confirmar` posterior ya no encuentra workflow vivo (el link directo no lo reanuda). Control
positivo: dentro de la ventana el borrador SIGUE vivo y confirma. Que las ejecuciones en vuelo (history
sin el marker `ventana-de-vida-borrador`) sigan igual lo verifica `test_workflow_replay_gate.py` con la
fixture real (ADR-003).
"""
from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from temporalio.client import WorkflowUpdateFailedError  # noqa: F401  (documenta el error posible)
from temporalio.service import RPCError
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from afip_factura_workflow import VENTANA_VIDA_BORRADOR, FacturaWorkflow
from test_confirmar_devuelve_si_valio import COLA, _actividades, _borrador_listo


async def _worker(env, emisiones):
    return Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                  activities=_actividades(emisiones))


@pytest.mark.asyncio
async def test_borrador_abandonado_vence_y_termina_cancelado_sin_emitir():
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with await _worker(env, emisiones):
            handle = await _borrador_listo(env, emisiones)
            estado = await handle.query("estado")
            assert estado["estado"] == "esperando_confirmacion"
            token = estado["token_confirmacion"]
            await env.sleep(VENTANA_VIDA_BORRADOR + timedelta(minutes=1))
            resultado = await handle.result()
            assert resultado["estado"] == "cancelada"
            assert resultado["resultado"] is None and emisiones == []
            assert "venció" in (resultado.get("motivo") or ""), resultado
            # el link directo (update confirmar) no lo reanuda: el workflow ya cerró
            with pytest.raises(Exception) as ei:
                await handle.execute_update("confirmar", token)
            assert isinstance(ei.value, (RPCError, WorkflowUpdateFailedError)) or "complet" in str(ei.value).lower() \
                or "not found" in str(ei.value).lower()
            assert emisiones == []


@pytest.mark.asyncio
async def test_control_dentro_de_la_ventana_sigue_vivo_y_confirma():
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with await _worker(env, emisiones):
            handle = await _borrador_listo(env, emisiones)
            estado = await handle.query("estado")
            await env.sleep(VENTANA_VIDA_BORRADOR - timedelta(hours=1))
            vivo = await handle.query("estado")
            assert vivo["estado"] == "esperando_confirmacion"      # NO venció antes de tiempo
            r = await handle.execute_update("confirmar", estado["token_confirmacion"])
            assert r["aceptado"] is True
            assert (await handle.result())["estado"] in ("emitida", "entregada")
            assert emisiones == [11]
