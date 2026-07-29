"""Una tool que FALLÓ no puede contar como "acción ejecutada" — item 0.5a del plan del frente de errores.

El guardrail anti-narración ([[copiloto-narra-la-accion-sin-ejecutarla]]) rechaza un cierre tipo
"Listo, ya lo anoté" cuando el turno NO ejecutó ninguna tool, y re-pregunta con `tool_choice="required"`
para forzar la llamada real. Su condición de disparo es `not trace`.

**El bug que estos tests miden:** `trace` se llenaba con CUALQUIER `execute_tool` que devolviera, sin
mirar el `status`. Con el contrato `'ok' | 'error' | 'rejected' | 'needs_confirmation'`
(`types.py:147`), una tool que devuelve `status="error"` entraba al trace igual que una exitosa →
el guardrail quedaba **desactivado** justo en el caso que existe para cubrir: el LLM afirma haber hecho
algo que en realidad falló, y nadie lo contradice.

Dos sitios lo hacían, y el segundo es el que más duele:

1. `_react_loop` — la tool falla dentro del loop.
2. El reingreso `action == "confirm"` — la tool que el usuario **confirmó explícitamente** falla. Acá
   el daño es peor: el emprendedor apretó "Confirmar" para emitir/cobrar, la operación falló, y el
   cierre le dice "Listo". Cree que se emitió.

Por qué el assert mira `tool_choice` y no un texto: el efecto observable del guardrail es la SEGUNDA
llamada al LLM forzando `required`. Medir eso mide el mecanismo; medir el texto mediría al LLM fake.
"""
from __future__ import annotations

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from backend.agent.conversation_workflow import ConversationWorkflow
from backend.agent.types import ToolResult


def _cfg(**extra) -> dict:
    return {"domain": "d", "channel": "web", "channel_ref": "s1", "cliente_id": "c1", **extra}


def _tc(name, args):
    return {"tool_calls": [{"id": "call_x", "name": name, "arguments": args}], "content": None,
            "finish_reason": "tool_calls"}


def _TEXT(t):
    return {"tool_calls": [], "content": t, "finish_reason": "stop"}


def _worker(env, tq, *, llm_script, exec_fn):
    """Worker con activities fake guionadas. `calls['llm_payloads']` guarda el payload de CADA llamada al
    LLM — ahí se observa si el guardrail forzó `tool_choice='required'`."""
    calls = {"exec": [], "sent": [], "llm_payloads": []}
    it = iter(llm_script)

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        calls["llm_payloads"].append(p)
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


def _tool_choices(calls) -> list:
    return [p.get("tool_choice") for p in calls["llm_payloads"]]


def _choice_value(sent_payload: dict, label: str) -> str:
    """El `value` con el token del gate embebido — simula al frontend reenviándolo tal cual."""
    return next(c["value"] for c in sent_payload["choices"] if c["label"] == label)


@pytest.mark.asyncio
async def test_una_tool_con_status_error_no_desactiva_el_guardrail():
    """La tool falla (`status='error'`) y el LLM igual cierra afirmando que la hizo.

    El guardrail DEBE disparar: segunda llamada con `tool_choice='required'`. Antes del fix, el nombre de
    la tool fallida ya estaba en `trace` → `not trace` era False → el cierre mentiroso salía tal cual.
    """
    def exec_fn(p):
        return ToolResult(tool_call_id=p["idem_key"], is_write=False, status="error",
                          observation={"error": "el gateway no respondió"}).to_dict()

    llm = [
        _tc("registrar_gasto", {"monto": 5000}),   # 1) el LLM pide la tool
        _TEXT("Listo, ya lo anoté."),              # 2) FALLÓ, y aun así afirma haberlo hecho
        _TEXT("No pude registrarlo, falló el sistema."),   # 3) tras el `required`: cierre honesto
    ]
    tq = "tool-error-1"
    async with await WorkflowEnvironment.start_time_skipping() as env:
        w, calls = _worker(env, tq, llm_script=llm, exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(
                ConversationWorkflow.run, _cfg(engine_mode="react"),
                id="wf-tool-error-1", task_queue=tq)
            await h.signal(ConversationWorkflow.receive_message, {"kind": "text", "text": "anotá 5000 de nafta"})
            await h.signal(ConversationWorkflow.close)
            await h.result()

    choices = _tool_choices(calls)
    assert "required" in choices, (
        "el guardrail NO disparó tras una tool con status='error': el cierre mentiroso salió sin "
        f"re-preguntar. tool_choice de cada llamada = {choices}")


@pytest.mark.asyncio
async def test_una_tool_ok_no_dispara_el_guardrail():
    """CONTROL NEGATIVO — sin esto, el test de arriba lo pasaría un `trace` roto que nunca se llena.

    Si la tool devuelve `status='ok'`, el cierre "Listo" es VERDAD y el guardrail NO debe disparar:
    forzar `required` acá sería un retry espurio que rompe turnos honestos.
    """
    def exec_fn(p):
        return ToolResult(tool_call_id=p["idem_key"], is_write=False, status="ok",
                          observation={"ok": True}).to_dict()

    llm = [
        _tc("registrar_gasto", {"monto": 5000}),
        _TEXT("Listo, ya lo anoté."),   # verdad: la tool ejecutó bien
    ]
    tq = "tool-ok-1"
    async with await WorkflowEnvironment.start_time_skipping() as env:
        w, calls = _worker(env, tq, llm_script=llm, exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(
                ConversationWorkflow.run, _cfg(engine_mode="react"),
                id="wf-tool-ok-1", task_queue=tq)
            await h.signal(ConversationWorkflow.receive_message, {"kind": "text", "text": "anotá 5000 de nafta"})
            await h.signal(ConversationWorkflow.close)
            await h.result()

    choices = _tool_choices(calls)
    assert "required" not in choices, (
        f"retry espurio: la tool ejecutó OK y el guardrail forzó `required` igual. choices={choices}")


@pytest.mark.asyncio
async def test_la_tool_que_el_usuario_CONFIRMO_y_fallo_tampoco_cuenta():
    """EL CASO QUE MÁS DUELE — hueco señalado por el revisor adversarial de este mismo fix.

    El emprendedor apretó **Confirmar** para una acción con efecto real (emitir, cobrar). La tool
    confirmada **falla**. El reingreso `action == 'confirm'` sembraba `tool_trace` con el nombre de esa
    tool sin mirar el status → el guardrail quedaba desactivado y el cierre le decía "Listo": cree que
    se emitió.

    Este camino NO pasa por `_react_loop` en su primera vuelta, así que los otros dos tests no lo
    cubrían — el fix del segundo sitio estaba escrito pero **no verificado**, que por la regla dura del
    repo es indistinguible de ausente.
    """
    def exec_fn(p):
        # gateada: sin confirmar abre el gate; confirmada, FALLA.
        if not p["confirmed"]:
            return ToolResult(tool_call_id=p["idem_key"], is_write=True, status="needs_confirmation",
                              observation={"preview": "¿Emito la factura?"}).to_dict()
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status="error",
                          observation={"error": "AFIP no respondió"}).to_dict()

    llm = [
        _tc("emitir_factura", {"monto": 5000}),   # 1) pide la tool → gate
        _TEXT("Listo, ya la emití."),             # 2) tras confirmar FALLIDO, afirma haberlo hecho
        _TEXT("No pude emitirla: AFIP no respondió."),   # 3) tras el `required`: honesto
    ]
    tq = "tool-confirm-error-1"
    async with await WorkflowEnvironment.start_time_skipping() as env:
        w, calls = _worker(env, tq, llm_script=llm, exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(
                ConversationWorkflow.run, _cfg(engine_mode="react"),
                id="wf-tool-confirm-error-1", task_queue=tq)
            await h.signal(ConversationWorkflow.receive_message,
                           {"kind": "text", "text": "emití una factura de 5000"})
            await env.sleep(1)
            token = _choice_value(calls["sent"][-1], "Confirmar")
            await h.signal(ConversationWorkflow.receive_message, {"kind": "callback", "text": token})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

    confirmadas = [c for c in calls["exec"] if c.get("confirmed")]
    assert len(confirmadas) == 1, f"el ciclo de confirmación no ocurrió: exec={calls['exec']}"
    choices = _tool_choices(calls)
    assert "required" in choices, (
        "la tool CONFIRMADA falló y el guardrail no disparó: el emprendedor lee 'Listo, ya la emití' "
        f"sobre una emisión que no ocurrió. tool_choice de cada llamada = {choices}")
