"""Tests de la bifurcación por `config['engine_mode']` en ConversationWorkflow (Task 11).

'dispatch' (default) rutea EXACTAMENTE igual que antes (byte-identical, cero cambio de comportamiento) vía
`_run_dispatch_turn` — el cuerpo del turno extraído sin tocar su lógica. `_run_react_turn` es por ahora un
STUB que delega a dispatch; Task 12 lo reemplaza por el loop ReAct real (tool-calling).

Deterministas (WorkflowEnvironment time-skipping, sin cluster ni LLM real). Corre EN el VPS (temporalio).
"""
from __future__ import annotations

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from backend.agent.conversation_workflow import ConversationWorkflow
from backend.agent.types import DispatchResult


def _cfg(**extra) -> dict:
    return {"domain": "d", "channel": "web", "channel_ref": "s1", "cliente_id": "c1", **extra}


@pytest.mark.asyncio
async def test_dispatch_mode_unchanged_routes_to_call_llm():
    """engine_mode ausente -> flujo intent actual: se invoca call_llm + dispatch_intent, NO las activities react."""
    seen = {"call_llm": 0, "call_llm_tools": 0}

    @activity.defn(name="call_llm")
    async def fl(p):
        seen["call_llm"] += 1
        return {"parsed": {"action": "clarify", "reply_es": "ok"}, "raw": ""}

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        seen["call_llm_tools"] += 1
        return {"tool_calls": [], "content": "x"}

    @activity.defn(name="dispatch_intent")
    async def fd(p):
        return DispatchResult(reply_text="ok", done=True).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="disp", workflows=[ConversationWorkflow],
                          activities=[fl, flt, fd, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(), id="disp", task_queue="disp")
            await h.signal(ConversationWorkflow.receive_message, {"text": "hola", "kind": "text"})
            await h.result()
    assert seen["call_llm"] == 1 and seen["call_llm_tools"] == 0   # ruteo dispatch, byte-identical


@pytest.mark.asyncio
async def test_react_mode_routes_to_react_turn_stub():
    """engine_mode='react' -> ya bifurca a _run_react_turn (el STUB delega a dispatch por ahora; Task 12
    reemplaza el stub por el loop real que invoca call_llm_tools en vez de call_llm)."""
    seen = {"call_llm": 0, "call_llm_tools": 0}

    @activity.defn(name="call_llm")
    async def fl(p):
        seen["call_llm"] += 1
        return {"parsed": {"action": "clarify", "reply_es": "ok"}, "raw": ""}

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        seen["call_llm_tools"] += 1
        return {"tool_calls": [], "content": "listo"}

    @activity.defn(name="dispatch_intent")
    async def fd(p):
        return DispatchResult(reply_text="ok", done=True).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="react-stub", workflows=[ConversationWorkflow],
                          activities=[fl, flt, fd, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="react-stub", task_queue="react-stub")
            await h.signal(ConversationWorkflow.receive_message, {"text": "hola", "kind": "text"})
            await h.result()
    assert seen["call_llm"] == 1   # el STUB de Task 11 delega a dispatch (Task 12 lo reemplaza por el loop real)
