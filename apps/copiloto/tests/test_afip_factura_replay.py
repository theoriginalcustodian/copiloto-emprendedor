"""Replay-verify del `FacturaWorkflow` contra un history REAL de producción.

Un `workflow.patched(...)` mal puesto no falla en los tests: falla en el momento del deploy, sobre
las ejecuciones que ya están en vuelo, con `NonDeterministicError` — y ahí ya es tarde. Al agregar
`reservar-nro-antes-de-emitir` había **34 `FacturaWorkflow` Running** medidos contra el Temporal del
VPS, la mayoría esperando la confirmación del usuario (`wait_condition` sin límite), es decir
**antes** del punto que el patch toca.

Este test corre el código de HOY contra el history de una de esas ejecuciones. Si alguien mueve el
patch de lugar, le cambia el id, o agrega/quita una activity fuera de la rama versionada, esto se
pone rojo acá y no en producción.

El fixture es un history capturado con `temporal workflow show --output json`. Para renovarlo:

    docker exec temporal-admin-tools temporal workflow show \
      --address temporal-server:7233 --namespace default \
      --workflow-id <wid> --run-id <rid> --output json > fixtures/history_factura_en_vuelo.json

**El replay contra el código de HOY corre en `test_workflow_replay_gate.py`** (D4, gate genérico que
cubre este fixture y el de `ConversationWorkflow` desde un solo manifest). Este archivo se queda con
lo que ES específico de este fixture: el control positivo de que el instrumento detecta divergencia,
y el guard de que el fixture siga siendo uno pre-emisión.
"""
from __future__ import annotations

import json
import uuid
from datetime import timedelta
from pathlib import Path

import pytest
from temporalio import workflow

FIXTURE = Path(__file__).parent / "fixtures" / "history_factura_en_vuelo.json"


@workflow.defn(name="FacturaWorkflow")
class _FacturaWorkflowDivergente:
    """Workflow deliberadamente incompatible con el history: agenda otra activity como primer paso.

    Existe sólo como control del instrumento. Se declara a nivel de módulo porque el SDK rechaza
    clases locales en `@workflow.run`.
    """

    @workflow.run
    async def run(self, cliente_id: str, cuit: str, idem_key: str) -> dict:  # noqa: ARG002
        await workflow.execute_activity(
            "una_activity_que_no_esta_en_el_history",
            start_to_close_timeout=timedelta(seconds=10))
        return {}


@pytest.mark.asyncio
async def test_control_positivo_el_replayer_SI_detecta_una_divergencia():
    """¿Qué devolvería este instrumento si el workflow estuviera roto?

    Sin esta pregunta, un Replayer mal cableado —history vacío, workflow que no matchea, excepción
    tragada— pasa en verde y certifica un deploy que va a romper. Acá se le da a propósito un
    workflow que agenda una activity distinta como PRIMER paso, fuera de todo `patched`: el replay
    TIENE que levantar. Si este test se pusiera verde, el de arriba no estaría verificando nada.
    """
    from temporalio.client import WorkflowHistory
    from temporalio.worker import Replayer

    historia = json.loads(FIXTURE.read_text(encoding="utf-8"))
    replayer = Replayer(workflows=[_FacturaWorkflowDivergente])

    with pytest.raises(Exception) as exc:
        await replayer.replay_workflow(WorkflowHistory.from_json(str(uuid.uuid4()), historia))

    assert exc.value is not None, "el Replayer no detectó una divergencia evidente: no sirve como gate"


def test_el_fixture_es_una_ejecucion_ANTES_de_emitir():
    """Control del propio fixture: si mañana se renueva con un history que ya emitió, este test
    deja de vigilar lo que dice vigilar — un history post-emisión no ejercita el patch."""
    historia = json.loads(FIXTURE.read_text(encoding="utf-8"))
    eventos = historia.get("events") or historia.get("history", {}).get("events") or []
    tipos = [e.get("eventType", "") for e in eventos]

    assert tipos, "el fixture no tiene eventos: no está verificando nada"
    agendadas = [e for e in eventos if e.get("eventType") == "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED"]
    nombres = [e.get("activityTaskScheduledEventAttributes", {}).get("activityType", {}).get("name")
               for e in agendadas]
    assert "emitir_comprobante" not in nombres, (
        "el fixture ya pasó por la emisión: renovalo con una ejecución detenida en el HITL, "
        "que es la que el patch tiene que dejar intacta")
