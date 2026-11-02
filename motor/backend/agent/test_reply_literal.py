"""SM-N21 (opción C): una tool que MUEVE PLATA deja `reply_literal` y el motor emite ese texto EXACTO sin volver a
llamar al LLM (un importe que el modelo reescribe no se puede garantizar). Replay-safe: sólo ramifica sobre datos
que vienen de la activity. Dos mitades: con la clave se salta el LLM; sin ella (tool que no mueve plata) el LLM
sigue redactando -- sin la segunda, «aplicué C» y «apliqué B de más» salen igual de verdes."""
from __future__ import annotations

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Replayer, Worker

from backend.agent.conversation_workflow import ConversationWorkflow

LITERAL = "Registré $70.000 de la factura 0001-00000042 (Panadería)."
CARD = {"kind": "sugerencia_armar_factura", "presupuesto_id": 7, "texto": "¿Te armo la factura?", "bloquea": False}


def _cfg() -> dict:
    return {"domain": "d", "channel": "web", "channel_ref": "s1", "cliente_id": "c1", "engine_mode": "react"}


async def _correr(observation: dict, nombre: str, *, replay: bool = False):
    enviados: list = []
    llamadas = {"llm": 0}

    @activity.defn(name="call_llm_tools")
    async def call_llm_tools(p):
        n = llamadas["llm"]
        llamadas["llm"] += 1
        if n == 0:
            return {"tool_calls": [{"id": "t0", "name": "marcar_factura_cobrada", "arguments": {}}], "content": None}
        return {"tool_calls": [], "content": "Anoté $70,000 (versión del modelo)"}

    @activity.defn(name="execute_tool")
    async def execute_tool(p):
        return {"tool_call_id": "t0", "status": "ok", "observation": observation}

    @activity.defn(name="send_channel_message")
    async def send_channel_message(p):
        enviados.append(p)
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=nombre, workflows=[ConversationWorkflow],
                          activities=[call_llm_tools, execute_tool, send_channel_message]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(), id=nombre, task_queue=nombre)
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobré la de la panadería", "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            await h.result()
            if replay:
                hist = await env.client.get_workflow_handle(nombre).fetch_history()
                await Replayer(workflows=[ConversationWorkflow]).replay_workflow(hist)
    return enviados, llamadas["llm"]


def _texto(enviados: list) -> str:
    return " ".join(str(p.get("text") or p.get("content") or p) for p in enviados)


@pytest.mark.asyncio
async def test_con_reply_literal_el_motor_emite_ese_texto_y_no_vuelve_al_llm():
    enviados, llm = await _correr({"result": "x", "reply_literal": LITERAL}, "q-literal-si", replay=True)
    assert llm == 1, "el motor volvió a llamar al LLM pese al reply_literal"
    assert LITERAL in _texto(enviados) and "$70,000" not in _texto(enviados)


@pytest.mark.asyncio
async def test_NEGATIVO_sin_reply_literal_el_LLM_sigue_redactando():
    enviados, llm = await _correr({"result": "Registré 70000"}, "q-literal-no", replay=True)
    assert llm == 2
    assert "$70,000" in _texto(enviados)


@pytest.mark.asyncio
async def test_el_literal_conserva_la_card_del_gate_del_turno():
    enviados, _ = await _correr({"result": "x", "reply_literal": LITERAL, "gate_card": CARD}, "q-literal-card")
    assert any(p.get("card") == CARD for p in enviados), "el literal perdió la card del turno"
