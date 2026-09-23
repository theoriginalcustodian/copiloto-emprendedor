"""A2/K-07-B: cuando el MISMO turno deja dos `gate_card` (una tool que bloquea -- ej. `requiere_conexion`
-- y otra que no -- ej. `sugerencia_armar_factura`), gana la que bloquea, sin importar el orden de llegada.

Nace del arnés descartable de la auditoría A2 (`C:/gfw-src/wt-audit-a1/_evidencia/2026-09-21/A2/
test_zz_auditoria_a2_precedencia.py`), que midió `test_CONTRATO_conexion_primero_sugerencia_despues_
gana_conexion` en FAILED contra `conversation_workflow.py:621-632` ("la última tool que trae `gate_card`
la pisa, sin mirar `kind`"). Este archivo es la versión permanente, con el fix ya aplicado (precedencia
por `bloquea`, no por nombre de `kind` -- el motor sigue domain-blind, ver
`catalog.requiere_conexion_card`/`sugerencia_armar_factura_card`).
"""
from __future__ import annotations

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from backend.agent.conversation_workflow import ConversationWorkflow

# Mismo shape que devuelven `catalog.requiere_conexion_card`/`sugerencia_armar_factura_card` (motor no
# importa `apps.copiloto.catalog`: es la capa PLANTILLA domain-blind, cero dependencia hacia la CLIENTE).
CONEXION = {"kind": "requiere_conexion", "service": "gmail", "label": "Gmail", "bloquea": True,
            "alcance": ["Leer mails"], "connect_path": "/composio/connect?service=gmail"}
SUGERENCIA = {"kind": "sugerencia_armar_factura", "presupuesto_id": 7, "texto": "¿Te armo la factura?",
              "bloquea": False}
R_CONEXION = ("error", {"error": "servicio no conectado: gmail", "needs_connect": "gmail", "gate_card": CONEXION})
R_SUGERENCIA = ("ok", {"result": "Marqué el presupuesto 7 como aprobado.", "gate_card": SUGERENCIA})


def _cfg() -> dict:
    return {"domain": "d", "channel": "web", "channel_ref": "s1", "cliente_id": "c1", "engine_mode": "react"}


def _activities(resultados: list, enviados: list):
    llamadas = {"llm": 0, "tool": 0}

    @activity.defn(name="call_llm_tools")
    async def call_llm_tools(p):
        n = llamadas["llm"]
        llamadas["llm"] += 1
        if n < len(resultados):
            return {"tool_calls": [{"id": f"t{n}", "name": f"tool{n}", "arguments": {}}], "content": None}
        return {"tool_calls": [], "content": "listo"}

    @activity.defn(name="execute_tool")
    async def execute_tool(p):
        n = llamadas["tool"]
        llamadas["tool"] += 1
        status, obs = resultados[n]
        return {"tool_call_id": f"t{n}", "status": status, "observation": obs}

    @activity.defn(name="send_channel_message")
    async def send_channel_message(p):
        enviados.append(p)
        return {"sent": True}

    return [call_llm_tools, execute_tool, send_channel_message]


async def _correr(resultados: list, nombre: str) -> list:
    enviados: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=nombre, workflows=[ConversationWorkflow],
                          activities=_activities(resultados, enviados)):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(), id=nombre, task_queue=nombre)
            await h.signal(ConversationWorkflow.receive_message, {"text": "aprobá y mandalo", "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            await h.result()
    return enviados


@pytest.mark.asyncio
async def test_control_solo_sugerencia_llega_como_card():
    """Control: sin card que bloquee en el turno, la única card viaja tal cual (comportamiento previo)."""
    enviados = await _correr([R_SUGERENCIA], "q-precedencia-sug")
    assert enviados[-1]["card"] == SUGERENCIA


@pytest.mark.asyncio
async def test_control_sugerencia_primero_conexion_despues_gana_conexion():
    """Control: en el orden donde "última gana" YA daba el resultado correcto por casualidad."""
    enviados = await _correr([R_SUGERENCIA, R_CONEXION], "q-precedencia-sug-con")
    assert enviados[-1]["card"]["kind"] == "requiere_conexion"


@pytest.mark.asyncio
async def test_CONTRATO_conexion_primero_sugerencia_despues_gana_conexion():
    """El caso que auditoría midió roto: conexión primero, sugerencia después -- la que bloquea sigue
    ganando aunque no sea la última en llegar (contrato K-07-B §2)."""
    enviados = await _correr([R_CONEXION, R_SUGERENCIA], "q-precedencia-con-sug")
    assert enviados[-1]["card"]["kind"] == "requiere_conexion", f"card final = {enviados[-1]['card']}"


@pytest.mark.asyncio
async def test_dos_cards_que_bloquean_gana_la_ultima():
    """Sin regla de contrato para desempatar entre dos que bloquean: se mantiene "última gana" (mismo
    criterio que el resto del gate_card), documentado para que no sea un accidente sin test."""
    conexion_2 = {**CONEXION, "service": "instagram", "label": "Instagram"}
    r_conexion_2 = ("error", {"error": "servicio no conectado: instagram", "needs_connect": "instagram",
                              "gate_card": conexion_2})
    enviados = await _correr([R_CONEXION, r_conexion_2], "q-precedencia-con-con")
    assert enviados[-1]["card"]["service"] == "instagram"
