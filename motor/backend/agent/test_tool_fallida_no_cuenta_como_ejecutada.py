"""Una tool que FALLÓ no puede contar como "acción ejecutada" — item 0.5a del plan del frente de errores.

El guardrail anti-narración ([[copiloto-narra-la-accion-sin-ejecutarla]]) rechazaba un cierre tipo
"Listo, ya lo anoté" cuando el turno NO ejecutó ninguna tool (o la ejecutó y falló), y re-preguntaba con
`tool_choice="required"` para forzar la llamada real. Su condición de disparo era `not trace`.

**RETIRO (backend, 2026-08-03):** el guardrail (`narra-guardrail-required-retry`) quedó retirado detrás
de un patch nuevo (`narra-guardrail-retirado`, `conversation_workflow.py`) — replay-safe para las
ejecuciones en vuelo (ver `test_narra_guardrail_retiro_replay.py`, Replayer contra history real). El
retiro se autorizó con evidencia contra el LLM REAL, no contra este LLM guionado: 10/10 rondas honestas
en `scripts/retest_narra_sin_hacer.py` (caso 1, sin tool_call) y `scripts/retest_narra_guardrail_caso2.py`
(caso 2, tool confirmada y fallida) — y en las 10 rondas del caso 2, el guardrail NUNCA disparó (0/10
`tool_choice='required'` verificado contra el history real de Temporal), es decir: el mecanismo mecánico
que estos tests medían ya era redundante en producción antes de retirarlo.

Estos tests con LLM guionado **no pueden verificar honestidad** (el script fuerza la mentira sin importar
la evidencia) — su valor ahora es puramente MECÁNICO: confirmar que el retiro efectivamente apaga el
retry forzado, para que nadie lo reintroduzca sin querer. La garantía de que el LLM real sigue narrando
honesto vive en los scripts de retest de arriba, no acá.

Dos sitios tenían el bug original, y el segundo era el que más dolía:

1. `_react_loop` — la tool falla dentro del loop.
2. El reingreso `action == "confirm"` — la tool que el usuario **confirmó explícitamente** falla. Acá
   el daño era peor: el emprendedor apretó "Confirmar" para emitir/cobrar, la operación falló, y el
   cierre le decía "Listo". Creía que se había emitido.
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
async def test_una_tool_con_status_error_ya_no_dispara_el_retry_retirado():
    """RETIRO: la tool falla (`status='error'`) y el LLM guionado igual cierra afirmando que la hizo.

    Antes del retiro, el guardrail forzaba una segunda llamada con `tool_choice='required'` acá. Hoy
    (`narra-guardrail-retirado`) NO debe hacerlo más — para una ejecución NUEVA (esta, en
    `WorkflowEnvironment.start_time_skipping()`), el patch nuevo siempre evalúa True. Esta mentira
    guionada ya no la cachea este mecanismo; la cachea la cura estructural contra el LLM real, medida
    en `scripts/retest_narra_guardrail_caso2.py` (10/10, ver docstring del módulo).
    """
    def exec_fn(p):
        return ToolResult(tool_call_id=p["idem_key"], is_write=False, status="error",
                          observation={"error": "el gateway no respondió"}).to_dict()

    llm = [
        _tc("registrar_gasto", {"monto": 5000}),   # 1) el LLM pide la tool
        _TEXT("Listo, ya lo anoté."),              # 2) FALLÓ, y aun así afirma haberlo hecho (LLM guionado)
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
    assert "required" not in choices, (
        "el guardrail retirado sigue disparando en una ejecución NUEVA: el patch inverso "
        f"'narra-guardrail-retirado' no está apagando el retry. tool_choice de cada llamada = {choices}")


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
async def test_la_tool_confirmada_y_fallida_ya_no_dispara_el_retry_retirado():
    """RETIRO del caso que más dolía — hueco señalado por el revisor adversarial del fix original.

    El emprendedor apretó **Confirmar** para una acción con efecto real (emitir, cobrar), la tool
    confirmada **falla**, y el LLM guionado igual dice "Listo, ya la emití". Antes del retiro, el
    guardrail forzaba acá una segunda llamada `required`. Este camino específico ("confirmada y
    fallida") es el que `scripts/retest_narra_guardrail_caso2.py` midió contra el LLM real antes de
    autorizar el retiro (10/10 honesto, el guardrail nunca disparó ni en producción) — acá se confirma
    que, mecánicamente, el patch inverso también lo apaga para el LLM guionado de este test.
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
        _TEXT("Listo, ya la emití."),             # 2) tras confirmar FALLIDO, afirma haberlo hecho (guionado)
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
    assert "required" not in choices, (
        "el guardrail retirado sigue disparando tras una tool CONFIRMADA y fallida en una ejecución "
        f"NUEVA. tool_choice de cada llamada = {choices}")
