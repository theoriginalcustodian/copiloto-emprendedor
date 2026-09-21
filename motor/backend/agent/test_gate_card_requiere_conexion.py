"""K-11: una tool que devuelve `gate_card` en su observación hace que la respuesta final del turno react
lleve esa card (sheet «conectá X» en la app), sin que el LLM la vea y sin cambiar nada cuando no hay gate.

El motor es domain-blind: no conoce `requiere_conexion`, sólo re-empaqueta el `gate_card` que el executor
del dominio puso en la observación (mismo criterio que el `card` del gate `needs_confirmation`).
"""
from __future__ import annotations

import json

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from backend.agent.conversation_workflow import ConversationWorkflow

CARD = {"kind": "requiere_conexion", "service": "gmail", "label": "Gmail",
        "alcance": ["Leer mails"], "connect_path": "/composio/connect?service=gmail"}


def _cfg() -> dict:
    return {"domain": "d", "channel": "web", "channel_ref": "s1", "cliente_id": "c1", "engine_mode": "react"}


def _activities(observacion: dict, status: str, enviados: list, mensajes_llm: list):
    llamadas = {"n": 0}

    @activity.defn(name="call_llm_tools")
    async def call_llm_tools(p):
        llamadas["n"] += 1
        mensajes_llm.append(json.dumps(p["messages"]))
        if llamadas["n"] == 1:
            return {"tool_calls": [{"id": "t1", "name": "enviar_mail", "arguments": {"a": 1}}], "content": None}
        return {"tool_calls": [], "content": "Para eso necesito que conectes Gmail primero."}

    @activity.defn(name="execute_tool")
    async def execute_tool(p):
        return {"tool_call_id": "t1", "status": status, "observation": observacion}

    @activity.defn(name="send_channel_message")
    async def send_channel_message(p):
        enviados.append(p)
        return {"sent": True}

    return [call_llm_tools, execute_tool, send_channel_message]


async def _correr(observacion: dict, status: str, nombre: str):
    enviados: list = []
    mensajes_llm: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=nombre, workflows=[ConversationWorkflow],
                          activities=_activities(observacion, status, enviados, mensajes_llm)):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(), id=nombre, task_queue=nombre)
            await h.signal(ConversationWorkflow.receive_message, {"text": "mandale un mail a Juan", "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            await h.result()
    return enviados, mensajes_llm


@pytest.mark.asyncio
async def test_gate_card_de_la_tool_llega_a_la_respuesta_final_y_no_al_llm():
    enviados, mensajes_llm = await _correr(
        {"error": "servicio no conectado: gmail", "needs_connect": "gmail", "gate_card": CARD}, "error", "q-gate")
    assert len(enviados) == 1
    assert enviados[0]["card"] == CARD
    assert enviados[0]["text"] == "Para eso necesito que conectes Gmail primero."
    assert "gate_card" not in mensajes_llm[1] and "alcance" not in mensajes_llm[1]   # el LLM no la ve
    assert "servicio no conectado: gmail" in mensajes_llm[1]                          # pero sí el error


@pytest.mark.asyncio
async def test_control_sin_gate_card_la_respuesta_no_lleva_card():
    """Control diferencial: sin `gate_card` el comportamiento es el de siempre (card vacía)."""
    enviados, _ = await _correr({"result": "listo"}, "ok", "q-sin-gate")
    assert len(enviados) == 1 and enviados[0]["card"] == {}
