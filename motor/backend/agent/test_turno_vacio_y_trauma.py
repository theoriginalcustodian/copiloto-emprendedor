"""Pedidos de manejo-de-errores (2026-11-03): el LLM vacío no es «Listo.» y el fallo del turno llega a la DLQ.

A. `resp.get("content") or "Listo."`: un LLM que cierra SIN texto y SIN tools le decía al usuario que
   algo pasó cuando no pasó, y con solo espacios le mandaba un mensaje en blanco.
B. Un `tool_call` malformado revienta DENTRO del workflow: el usuario veía el aviso pero la DLQ recibía
   cero, porque el interceptor sólo captura fallos de activities.

Cada caso hostil tiene su control positivo: sin él, un test verde puede ser el que nunca ejercitó el bug.
"""
from __future__ import annotations

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from backend.agent.conversation_workflow import ConversationWorkflow


def _cfg(**extra) -> dict:
    return {"domain": "d", "channel": "web", "channel_ref": "s1", "cliente_id": "c1",
            "engine_mode": "react", **extra}


async def _correr(respuestas: list, *, con_registrador: bool = True, task_queue: str = "q-vacio"):
    """Corre 2 turnos react. `respuestas` = lo que devuelve `call_llm_tools`, en orden de llamada.
    Devuelve (enviados, traumas, resultado)."""
    enviados: list = []
    traumas: list = []
    cola = list(respuestas)

    @activity.defn(name="call_llm_tools")
    async def call_llm_tools(p):
        return cola.pop(0)

    @activity.defn(name="execute_tool")
    async def execute_tool(p):
        return {"status": "ok", "observation": {}}

    @activity.defn(name="send_channel_message")
    async def send_channel_message(p):
        enviados.append(p["text"])
        return {"sent": True}

    @activity.defn(name="registrar_trauma_de_turno")
    async def registrar_trauma_de_turno(p):
        traumas.append(p)
        return True

    acts = [call_llm_tools, execute_tool, send_channel_message]
    if con_registrador:
        acts.append(registrar_trauma_de_turno)
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=task_queue, workflows=[ConversationWorkflow],
                          activities=acts):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(),
                                                id=f"wf-{task_queue}", task_queue=task_queue)
            await h.signal(ConversationWorkflow.receive_message, {"text": "uno", "kind": "text"})
            await h.signal(ConversationWorkflow.receive_message, {"text": "dos", "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            resultado = await h.result()
    return enviados, traumas, resultado


@pytest.mark.asyncio
@pytest.mark.parametrize("vacio", ["", "   ", "\n\t ", None], ids=["vacio", "espacios", "blancos", "none"])
async def test_llm_sin_contenido_ni_tools_no_dice_listo_ni_manda_en_blanco(vacio):
    """CASO HOSTIL (A). El turno 1 vuelve vacío, el 2 contesta normal: la sesión sigue viva, el usuario
    recibe el aviso honesto (nunca «Listo.» ni un mensaje en blanco) y el fallo queda en la DLQ."""
    enviados, traumas, res = await _correr(
        [{"tool_calls": [], "content": vacio}, {"tool_calls": [], "content": "respuesta real"}],
        task_queue=f"q-vacio-{abs(hash(repr(vacio)))}")
    assert res["turns"] == 2, "la sesión murió"
    assert "Listo." not in enviados, f"el LLM vacío se tradujo en un «Listo.» mentiroso: {enviados}"
    assert all(t.strip() for t in enviados), f"salió un mensaje en blanco: {enviados!r}"
    assert "trabó" in enviados[0] and enviados[1] == "respuesta real"
    assert len(traumas) == 1 and traumas[0]["error_type"] == "TurnoSinContenido"
    assert traumas[0]["cliente_id"] == "c1"


@pytest.mark.asyncio
async def test_control_positivo_contenido_real_se_entrega_y_no_deposita_nada():
    """Control: si el aviso/trauma salieran siempre, el test hostil pasaría con el bug puesto."""
    enviados, traumas, _ = await _correr(
        [{"tool_calls": [], "content": "hola, ¿en qué te ayudo?"},
         {"tool_calls": [], "content": "listo"}], task_queue="q-vacio-ctrl")
    assert enviados == ["hola, ¿en qué te ayudo?", "listo"]
    assert traumas == []


@pytest.mark.asyncio
async def test_control_positivo_cierre_vacio_tras_una_tool_real_sigue_siendo_listo():
    """Con una tool ejecutada antes en el mismo turno, el «Listo.» es verdad (hay acción real detrás)."""
    enviados, traumas, _ = await _correr(
        [{"tool_calls": [{"id": "t1", "name": "una_tool", "arguments": {}}], "content": ""},
         {"tool_calls": [], "content": ""},
         {"tool_calls": [], "content": "otra"}], task_queue="q-vacio-tool")
    assert enviados[0].startswith("Listo.")
    assert traumas == []


@pytest.mark.asyncio
async def test_tool_call_malformado_llega_a_la_dlq_y_la_sesion_sigue():
    """CASO HOSTIL (B). `tool_call` sin `name`: reventaba dentro del workflow con DLQ en cero."""
    enviados, traumas, res = await _correr(
        [{"tool_calls": [{"arguments": {}}], "content": ""},
         {"tool_calls": [], "content": "sigo viva"}], task_queue="q-malformado")
    assert res["turns"] == 2
    assert "trabó" in enviados[0] and enviados[1] == "sigo viva"
    assert len(traumas) == 1, f"la DLQ debía recibir 1 y recibió {len(traumas)}"
    assert traumas[0]["error_type"] and traumas[0]["cliente_id"] == "c1"
    assert traumas[0]["nodo"] == "turno_react"


@pytest.mark.asyncio
async def test_si_el_registro_no_esta_en_el_worker_la_sesion_igual_sobrevive():
    """Registrar es best-effort: un worker sin la activity no puede matar la sesión."""
    enviados, _, res = await _correr(
        [{"tool_calls": [{"arguments": {}}], "content": ""},
         {"tool_calls": [], "content": "sigo viva"}], con_registrador=False,
        task_queue="q-sin-registrador")
    assert res["turns"] == 2 and "trabó" in enviados[0] and enviados[1] == "sigo viva"
