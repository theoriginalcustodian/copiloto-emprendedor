"""H-A3-2(a): si la conexión se cae ENTRE el confirm y la ejecución (la tool devuelve `gate_card`
recién en el reingreso post-confirm, no antes de pedir HITL), la card no se pierde -- la rama del
confirm-reentry la extrae igual que el loop normal (`:626-641`).

Medido roto en prod, 2026-09-22 (historia `conv-web-...-e2e-g6-durabilidad-hitl-...`): tras
confirmar, `execute_tool` devolvía `gate_card`, pero la respuesta final salía con `card: {}` -- la
rama del confirm-reentry (antes del fix, `:424-450`) no tenía ninguna extracción de `gate_card`,
sólo la rama normal del loop la tenía. H-A3-2(a) del contrato de A3 (Ola 3).

El motor sigue domain-blind: no conoce `requiere_conexion`, sólo re-empaqueta lo que el executor de
dominio puso en la observación (mismo criterio que `test_gate_card_requiere_conexion.py`, que cubre
la rama NORMAL del loop -- este archivo cubre la rama del CONFIRM, que era la que faltaba).
"""
from __future__ import annotations

import asyncio

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from backend.agent.conversation_workflow import ConversationWorkflow

CARD = {"kind": "requiere_conexion", "service": "gmail", "label": "Gmail",
        "alcance": ["Leer mails"], "connect_path": "/composio/connect?service=gmail"}


def _cfg() -> dict:
    return {"domain": "d", "channel": "web", "channel_ref": "s1", "cliente_id": "c1", "engine_mode": "react"}


async def _wait_until(pred, label, tries=100, delay=0.1):
    for _ in range(tries):
        if pred():
            return
        await asyncio.sleep(delay)
    raise AssertionError(f"timeout esperando: {label}")


def _confirm_value(enviado: dict) -> str:
    """El token REAL del gate (`confirm:<turn_ix>:<step>`, ver `_confirm_choices`), nunca un literal
    hardcodeado -- el motor lo valida contra el `pending` vigente y un literal plano es un no-op
    fail-closed (mismo criterio que `_choice_value` en test_e2e_react.py)."""
    return next(c["value"] for c in enviado["choices"] if c["label"] == "Confirmar")


def _activities(enviados: list):
    llamadas = {"llm": 0, "tool": 0}

    @activity.defn(name="call_llm_tools")
    async def call_llm_tools(p):
        n = llamadas["llm"]
        llamadas["llm"] += 1
        if n == 0:
            return {"tool_calls": [{"id": "t0", "name": "enviar_mail", "arguments": {"a": 1}}], "content": None}
        return {"tool_calls": [], "content": "Para eso necesito que conectes Gmail primero."}

    @activity.defn(name="execute_tool")
    async def execute_tool(p):
        n = llamadas["tool"]
        llamadas["tool"] += 1
        if n == 0:
            assert p["confirmed"] is False
            return {"tool_call_id": "t0", "status": "needs_confirmation",
                    "observation": {"preview": "¿Mando el mail?", "service": "gmail", "label": "Gmail"}}
        # 2do: el usuario ya confirmó, pero la conexión se cayó ENTRE el confirm y la ejecución.
        assert p["confirmed"] is True
        return {"tool_call_id": "t0", "status": "error",
                "observation": {"error": "servicio no conectado: gmail", "needs_connect": "gmail",
                                 "gate_card": CARD}}

    @activity.defn(name="send_channel_message")
    async def send_channel_message(p):
        enviados.append(p)
        return {"sent": True}

    return [call_llm_tools, execute_tool, send_channel_message]


async def _correr(nombre: str) -> list:
    enviados: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=nombre, workflows=[ConversationWorkflow],
                          activities=_activities(enviados)):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(), id=nombre, task_queue=nombre)
            # turno 1: pide mandar el mail -> gate needs_confirmation. Hay que ESPERAR la card real
            # antes de confirmar: el token (`confirm:<turn_ix>:<step>`) depende del `turn_ix` global
            # de la sesión, que no es necesariamente 0 -- hardcodearlo dio falso-negativo (el no-op
            # fail-closed del motor absorbió el callback en silencio, medido: sólo 1 envío en vez de 2).
            await h.signal(ConversationWorkflow.receive_message, {"text": "mandale un mail a Juan", "kind": "text"})
            await _wait_until(lambda: len(enviados) >= 1, "HITL preview del turno 1")
            token = _confirm_value(enviados[0])
            # turno 2 (callback): el usuario confirma -> reingresa por la rama del confirm.
            await h.signal(ConversationWorkflow.receive_message, {"text": token, "kind": "callback"})
            await _wait_until(lambda: len(enviados) >= 2, "cierre del turno 2 (post-confirm)")
            await h.signal(ConversationWorkflow.close)
            await h.result()
    return enviados


@pytest.mark.asyncio
async def test_CONTRATO_card_sobrevive_al_confirm_cuando_la_conexion_se_cae_en_el_medio():
    enviados = await _correr("q-gate-card-sobrevive-confirm")
    assert len(enviados) == 2                              # 1) el HITL preview, 2) el cierre con la card
    assert enviados[0]["choices"], "el primer envío debe ser el HITL con Confirmar/Cancelar"
    assert enviados[-1]["card"] == CARD, f"card final = {enviados[-1]['card']}"


@pytest.mark.asyncio
async def test_control_confirm_sin_gate_card_no_regresiona():
    """Control diferencial: si tras confirmar la tool ejecuta OK sin `gate_card`, el cierre sigue sin
    card (comportamiento previo al fix, intacto)."""
    enviados: list = []
    nombre = "q-gate-card-sobrevive-confirm-control"

    @activity.defn(name="call_llm_tools")
    async def call_llm_tools(p, _n={"v": 0}):
        _n["v"] += 1
        if _n["v"] == 1:
            return {"tool_calls": [{"id": "t0", "name": "enviar_mail", "arguments": {"a": 1}}], "content": None}
        return {"tool_calls": [], "content": "Listo, lo mandé."}

    @activity.defn(name="execute_tool")
    async def execute_tool(p, _n={"v": 0}):
        _n["v"] += 1
        if _n["v"] == 1:
            return {"tool_call_id": "t0", "status": "needs_confirmation",
                    "observation": {"preview": "¿Mando el mail?", "service": "gmail", "label": "Gmail"}}
        return {"tool_call_id": "t0", "status": "ok", "observation": {"result": "mail enviado"}}

    @activity.defn(name="send_channel_message")
    async def send_channel_message(p):
        enviados.append(p)
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=nombre, workflows=[ConversationWorkflow],
                          activities=[call_llm_tools, execute_tool, send_channel_message]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(), id=nombre, task_queue=nombre)
            await h.signal(ConversationWorkflow.receive_message, {"text": "mandale un mail a Juan", "kind": "text"})
            await _wait_until(lambda: len(enviados) >= 1, "HITL preview del turno 1")
            token = _confirm_value(enviados[0])
            await h.signal(ConversationWorkflow.receive_message, {"text": token, "kind": "callback"})
            await _wait_until(lambda: len(enviados) >= 2, "cierre del turno 2 (post-confirm)")
            await h.signal(ConversationWorkflow.close)
            await h.result()
    assert enviados[-1]["card"] == {}
