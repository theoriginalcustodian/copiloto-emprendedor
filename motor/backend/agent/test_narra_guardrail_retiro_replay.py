"""Replay-verify del retiro de `narra-guardrail-required-retry` contra un history REAL en vuelo.

Mismo patrón que `apps/copiloto/tests/test_afip_factura_replay.py` (AFIP), aplicado acá porque el
riesgo es el mismo: un `workflow.patched(...)` mal puesto no falla en los tests unitarios (con LLM
guionado, siempre arranca ejecución "nueva") — falla en el momento del deploy, sobre las
ejecuciones que ya están en vuelo, con `NonDeterministicError`. Al retirar el guardrail había
**34/81 `ConversationWorkflow` Running** con `narra-guardrail-required-retry` grabado en su history
(medido contra el Temporal del VPS, `temporal workflow count ... TemporalChangeVersion=
'narra-guardrail-required-retry'`).

Este test corre el código de HOY (con `narra-guardrail-retirado` envolviendo el bloque viejo) contra
el history de una de esas 34 ejecuciones. Si el retiro estuviera mal anidado, esto se pone rojo acá,
no en producción.

El fixture es un history capturado con `temporal workflow show --output json`. Para renovarlo:

    docker exec temporal-admin-tools temporal workflow show \
      --address temporal-server:7233 --namespace default \
      --workflow-id <wid> --run-id <rid> --output json > fixtures/history_conv_en_vuelo_con_narra_guardrail.json
"""
from __future__ import annotations

import base64
import json
import uuid
from datetime import timedelta
from pathlib import Path

import pytest
from temporalio import workflow

FIXTURE = Path(__file__).parent / "fixtures" / "history_conv_en_vuelo_con_narra_guardrail.json"


@pytest.mark.asyncio
async def test_el_retiro_no_rompe_las_ejecuciones_en_vuelo():
    """El history tiene turnos ya procesados con `narra-guardrail-required-retry` grabado. El código de
    hoy (con `narra-guardrail-retirado` envolviendo el bloque viejo) tiene que reproducirlos idéntico."""
    from temporalio.client import WorkflowHistory
    from temporalio.worker import Replayer

    from backend.agent.conversation_workflow import ConversationWorkflow

    historia = json.loads(FIXTURE.read_text(encoding="utf-8"))
    replayer = Replayer(workflows=[ConversationWorkflow])

    # Si el replay divergiera del history, esto levanta y el test falla. No hay assert que agregar:
    # la ausencia de excepción ES la verificación.
    await replayer.replay_workflow(WorkflowHistory.from_json(str(uuid.uuid4()), historia))


@workflow.defn(name="ConversationWorkflow")
class _ConversationWorkflowDivergente:
    """Workflow deliberadamente incompatible con el history: agenda otra activity como primer paso.

    Existe sólo como control del instrumento. Se declara a nivel de módulo porque el SDK rechaza
    clases locales en `@workflow.run`.
    """

    @workflow.run
    async def run(self, config: dict) -> None:  # noqa: ARG002
        await workflow.execute_activity(
            "una_activity_que_no_esta_en_el_history",
            start_to_close_timeout=timedelta(seconds=10))


@pytest.mark.asyncio
async def test_control_positivo_el_replayer_SI_detecta_una_divergencia():
    """¿Qué devolvería este instrumento si el workflow estuviera roto?

    Sin esta pregunta, un Replayer mal cableado —history vacío, workflow que no matchea, excepción
    tragada— pasa en verde y certifica un deploy que va a romper. Acá se le da a propósito un workflow
    que agenda una activity distinta como PRIMER paso: el replay TIENE que levantar. Si este test se
    pusiera verde, el de arriba no estaría verificando nada.
    """
    from temporalio.client import WorkflowHistory
    from temporalio.worker import Replayer

    historia = json.loads(FIXTURE.read_text(encoding="utf-8"))
    replayer = Replayer(workflows=[_ConversationWorkflowDivergente])

    with pytest.raises(Exception) as exc:
        await replayer.replay_workflow(WorkflowHistory.from_json(str(uuid.uuid4()), historia))

    assert exc.value is not None, "el Replayer no detectó una divergencia evidente: no sirve como gate"


def test_el_fixture_trae_el_marker_que_este_test_tiene_que_ejercitar():
    """Control del propio fixture: si mañana se renueva con un history que nunca llegó a evaluar
    `narra-guardrail-required-retry`, este test deja de vigilar lo que dice vigilar."""
    historia = json.loads(FIXTURE.read_text(encoding="utf-8"))
    eventos = historia.get("events") or historia.get("history", {}).get("events") or []
    assert eventos, "el fixture no tiene eventos: no está verificando nada"

    ids_grabados = []
    for e in eventos:
        if e.get("eventType") != "EVENT_TYPE_MARKER_RECORDED":
            continue
        attrs = e.get("markerRecordedEventAttributes", {})
        if attrs.get("markerName") != "core_patch":
            continue
        payloads = attrs.get("details", {}).get("patch-data", {}).get("payloads", [])
        for p in payloads:
            data = json.loads(base64.b64decode(p["data"]).decode())
            ids_grabados.append(data.get("id"))

    assert "narra-guardrail-required-retry" in ids_grabados, (
        f"el fixture no tiene el marker narra-guardrail-required-retry grabado (tiene: {ids_grabados}) "
        "-- renovalo con una ejecución que sí lo haya evaluado")
