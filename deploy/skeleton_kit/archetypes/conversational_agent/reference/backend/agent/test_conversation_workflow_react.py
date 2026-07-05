"""Tests del motor ReAct dentro de ConversationWorkflow (Tasks 11+12).

Task 11: bifurcación por `config['engine_mode']` — 'dispatch' (default) rutea EXACTAMENTE igual que antes
(byte-identical, cero cambio de comportamiento) vía `_run_dispatch_turn`; 'react' rutea a `_run_react_turn`
(loop tool-calling nuevo).

Task 12: el loop ReAct en sí — encadena tool-calls (read -> observación -> sigue), abre el gate cross-turn
en un write sin confirmar (parquea scratchpad + card, sale del turno SIN ejecutar), el callback confirm
reingresa y ejecuta con el link real (spike A: el link viaja en el body del mail siguiente), y el callback
cancel corta DETERMINÍSTICAMENTE (tool_choice='none', spike B) sin volver a invocar execute_tool.

Deterministas (WorkflowEnvironment time-skipping, sin cluster ni LLM real). Corre EN el VPS (temporalio).
"""
from __future__ import annotations

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from backend.agent.conversation_workflow import ConversationWorkflow
from backend.agent.types import DispatchResult, ToolResult


def _cfg(**extra) -> dict:
    return {"domain": "d", "channel": "web", "channel_ref": "s1", "cliente_id": "c1", **extra}


# ═══════════════════════════════ Task 11: bifurcación engine_mode ═══════════════════════════════

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
async def test_react_mode_routes_to_react_turn():
    """engine_mode='react' -> se invoca call_llm_tools (loop react), NUNCA call_llm/dispatch_intent."""
    seen = {"call_llm": 0, "call_llm_tools": 0}

    @activity.defn(name="call_llm")
    async def fl(p):
        seen["call_llm"] += 1
        return {"parsed": {"action": "clarify"}, "raw": ""}

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        seen["call_llm_tools"] += 1
        return {"tool_calls": [], "content": "listo"}

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        return ToolResult(tool_call_id="k", observation={}).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="react-mode", workflows=[ConversationWorkflow],
                          activities=[fl, flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="react-mode", task_queue="react-mode")
            await h.signal(ConversationWorkflow.receive_message, {"text": "hola", "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            await h.result()
    assert seen["call_llm_tools"] >= 1 and seen["call_llm"] == 0   # ruteo react


# ═══════════════════════════════ Task 12: loop ReAct + gate + corte ═══════════════════════════════

def _script_worker(env, tq, *, llm_script, exec_fn):
    """llm_script: lista de respuestas de call_llm_tools (consumidas en orden). exec_fn(payload)->ToolResult dict."""
    calls = {"exec": [], "sent": [], "llm": 0}
    it = iter(llm_script)

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        calls["llm"] += 1
        return next(it)

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        calls["exec"].append(p)
        return exec_fn(p)

    @activity.defn(name="send_channel_message")
    async def fs(p):
        calls["sent"].append(p)
        return {"sent": True}

    return Worker(env.client, task_queue=tq, workflows=[ConversationWorkflow],
                  activities=[flt, frc, fe, fs]), calls


def _tc(name, args, cid="c1"):
    return {"tool_calls": [{"id": "call_x", "name": name, "arguments": args}], "content": None,
            "finish_reason": "tool_calls"}


def _TEXT(t):
    return {"tool_calls": [], "content": t, "finish_reason": "stop"}


@pytest.mark.asyncio
async def test_react_chains_read_then_final():
    """gmail_fetch (read) -> observación -> el modelo cierra con texto. 1 turno, sin gate."""
    def exec_fn(p):
        return ToolResult(tool_call_id=p["idem_key"], is_write=False,
                          observation={"result": "2 mails sin leer"}).to_dict()
    async with await WorkflowEnvironment.start_time_skipping() as env:
        w, calls = _script_worker(env, "r1", llm_script=[_tc("gmail_fetch", {"query": "is:unread"}),
                                                         _TEXT("Tenés 2 sin leer.")], exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r1", task_queue="r1")
            await h.signal(ConversationWorkflow.receive_message, {"text": "tengo mails?", "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            await h.result()
    assert len(calls["exec"]) == 1 and calls["exec"][0]["confirmed"] is False
    assert calls["sent"][-1]["text"] == "Tenés 2 sin leer."


@pytest.mark.asyncio
async def test_react_write_opens_gate_without_executing():
    """mp_charge (write): execute_tool(confirmed=False) -> needs_confirmation -> card+choices, NO ejecuta el cobro."""
    def exec_fn(p):
        st = "needs_confirmation" if not p["confirmed"] else "ok"
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status=st,
                          observation={"preview": "generar link de cobro por $5000"}).to_dict()
    async with await WorkflowEnvironment.start_time_skipping() as env:
        w, calls = _script_worker(env, "r2", llm_script=[_tc("mp_charge", {"amount": 5000})], exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r2", task_queue="r2")
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobrá 5000", "kind": "text"})
            # NO cerramos: el gate quedó abierto (pending parqueado); dejamos que el idle-reap termine el wf
            await env.sleep(2)   # el turno ya emitió la card y salió; el estado tiene 'react'
            st = await h.query(ConversationWorkflow.state)
            await h.signal(ConversationWorkflow.close)
            await h.result()
    assert all(c["confirmed"] is False for c in calls["exec"])         # NUNCA ejecutó el cobro
    assert calls["sent"][-1]["choices"]                                # emitió los botones Confirmar/Cancelar
    assert st["conversation_state"].get("react")                      # parqueó el scratchpad


@pytest.mark.asyncio
async def test_react_confirm_chains_with_real_link():
    """confirm del cobro -> link real; el modelo encadena gmail_send con el init_point en el body -> 2º gate."""
    def exec_fn(p):
        if p["name"] == "mp_charge" and p["confirmed"]:
            return ToolResult(tool_call_id=p["idem_key"], is_write=True, status="ok",
                              observation={"init_point": "https://mpago.la/REAL"}).to_dict()
        st = "needs_confirmation" if not p["confirmed"] else "ok"
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status=st,
                          observation={"preview": "acción"}).to_dict()
    # tras el confirm del cobro, el modelo pide gmail_send con el link real en el body:
    llm_after_confirm = [_tc("gmail_send", {"to": "a@b.com", "body": "Pagá acá: https://mpago.la/REAL"})]
    async with await WorkflowEnvironment.start_time_skipping() as env:
        w, calls = _script_worker(env, "r3", llm_script=[_tc("mp_charge", {"amount": 5000}), *llm_after_confirm],
                                  exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r3", task_queue="r3")
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobrá 5000 y mandá mail", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.receive_message, {"text": "confirm", "kind": "callback"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()
    # el cobro se ejecutó confirmado, y el gmail_send que sigue lleva el link REAL en el body (spike A)
    confirmed_charge = [c for c in calls["exec"] if c["name"] == "mp_charge" and c["confirmed"]]
    gmail = [c for c in calls["exec"] if c["name"] == "gmail_send"]
    assert confirmed_charge and gmail
    assert "https://mpago.la/REAL" in gmail[0]["arguments"]["body"]


@pytest.mark.asyncio
async def test_react_reject_does_not_chain():
    """spike B: cancel del 1er write -> corte tool_choice='none' -> solo texto; execute_tool NO se re-invoca."""
    def exec_fn(p):
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status="needs_confirmation",
                          observation={"preview": "cobro"}).to_dict()
    async with await WorkflowEnvironment.start_time_skipping() as env:
        # tras el cancel, el workflow llama call_llm_tools(tool_choice='none') -> el fake devuelve solo texto
        w, calls = _script_worker(env, "r4", llm_script=[_tc("mp_charge", {"amount": 5000}),
                                                         _TEXT("Listo, no generé nada.")], exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r4", task_queue="r4")
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobrá 5000", "kind": "text"})
            await env.sleep(1)
            n_exec_before = len(calls["exec"])
            await h.signal(ConversationWorkflow.receive_message, {"text": "cancel", "kind": "callback"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()
    assert len(calls["exec"]) == n_exec_before          # tras el cancel NO se ejecutó ningún write más (corte)
    assert "no generé" in calls["sent"][-1]["text"].lower()
