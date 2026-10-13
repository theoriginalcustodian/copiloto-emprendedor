"""Dictado por destino, de punta a punta con el workflow REAL (contrato 2026-10-13).

`ConversationWorkflow` (react) + las activities REALES del motor (`call_llm_tools`/`execute_tool`) + el
`tool_executor` REAL del copiloto contra el test-server de Temporal. Sólo el LLM es guionado, y lo es de
la forma que importa: **obedece `tool_choice`**. Con `required` llama a la única tool que se le ofrece;
con `auto` hace lo que haría un modelo al que le dicen «gasté cinco mil» sin contexto: preguntar. Eso
convierte la diferencia entre las dos ramas en la prueba del mecanismo (scope de la sesión), no de un
LLM real — la obediencia de un modelo real no se mide acá y no se afirma.

Mide:
  · los 4 destinos terminan en la card `*_propuesto` correcta, SIN pasar por «¿qué querés hacer?»;
  · el modelo vio UNA sola tool y la segunda llamada fue `none` (no repite la tool);
  · CONTROL: la misma frase por una sesión normal NO produce card (el modelo pregunta) y ve el catálogo;
  · los dos hilos son independientes: el dictado no deja nada en el `channel_ref` del chat.
"""
from __future__ import annotations

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

import dictado_destinos as DD
import tool_catalog
from backend.agent.agent_activities import call_llm_tools, execute_tool, recall_memory
from backend.agent.agent_runtime import register_domain, reset_registry
from backend.agent.conversation_workflow import ConversationWorkflow

DOMINIO = "emprendedor-dictado-test"
HOY = "2026-10-13T12:00:00-03:00"

# argumentos que un modelo extraería de cada frase dictada (lo mínimo que cada tool pide)
ARGS = {
    "registrar_gasto": {"monto": "5000", "categoria": "otros", "descripcion": "nafta"},
    "registrar_ingreso": {"monto": "85000", "cliente": "la panadería"},
    "registrar_presupuesto": {"concepto": "dos sillas", "cliente_nombre": "Juan",
                              "items": [{"descripcion": "silla", "cantidad": "2", "precio_unitario": "8000"}]},
    "registrar_cliente": {"nombre": "Panadería Los Tilos"},
}
CARD = {"gasto": "gasto_propuesto", "ingreso": "ingreso_propuesto",
        "presupuesto": "presupuesto_propuesto", "cliente": "cliente_propuesto"}


class _Ctx:
    cliente_id = "c1"
    composio_user_id = "c1"


class _CobroStoreSinDuplicados:
    """`registrar_ingreso` pregunta por duplicados ANTES de armar la card: sin store propone error."""
    def posible_duplicado(self, *, monto, cliente_nombre):
        return None


class _LlmQueObedeceElToolChoice:
    def __init__(self):
        self.llamadas: list[dict] = []

    def complete_tools(self, system, messages, tools, *, tool_choice="auto", parallel_tool_calls=False):
        nombres = [t["function"]["name"] for t in tools]
        self.llamadas.append({"tools": nombres, "tool_choice": tool_choice})
        base = {"finish_reason": "stop", "model": "guion", "failed_over": False, "usage": {}}
        if tool_choice == "required":
            nombre = nombres[0]
            return {**base, "finish_reason": "tool_calls", "content": None,
                    "tool_calls": [{"id": "call_1", "name": nombre, "arguments": ARGS[nombre]}]}
        if tool_choice == "none":
            return {**base, "tool_calls": [], "content": "Te armé un borrador, revisalo y confirmalo."}
        return {**base, "tool_calls": [], "content": "¿Qué querés hacer con eso?"}


def _registrar(llm):
    reset_registry()
    register_domain(
        DOMINIO, system_prompt="SYS", llm_provider=llm, dispatcher=lambda *a, **k: None,
        context_factory=lambda conv: _Ctx(), engine_mode="react",
        tool_schemas=tool_catalog.build_tool_catalog(),
        tool_executor=tool_catalog.make_tool_executor(
            None, now_iso_provider=lambda: HOY,
            cobro_store_factory=lambda cid: _CobroStoreSinDuplicados()),
        session_scope=DD.scope_de_sesion)


async def _correr(channel_ref: str, texto: str, llm) -> list[dict]:
    """Un turno completo por el workflow real; devuelve lo que se mandó por el canal."""
    _registrar(llm)
    enviados: list[dict] = []

    @activity.defn(name="send_channel_message")
    async def _send(p):
        enviados.append(p)
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="dictado", workflows=[ConversationWorkflow],
                          activities=[call_llm_tools, execute_tool, recall_memory, _send]):
            h = await env.client.start_workflow(
                ConversationWorkflow.run,
                {"domain": DOMINIO, "channel": "web", "channel_ref": channel_ref, "cliente_id": "c1",
                 "engine_mode": "react"},
                id=f"wf-{channel_ref}", task_queue="dictado")
            await h.signal(ConversationWorkflow.receive_message, {"text": texto, "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            await h.result()
    return enviados


@pytest.mark.asyncio
@pytest.mark.parametrize("destino", ["gasto", "ingreso", "presupuesto", "cliente"])
async def test_el_dictado_de_cada_destino_termina_en_su_card_sin_preguntar_que_hacer(destino):
    llm = _LlmQueObedeceElToolChoice()
    enviados = await _correr(DD.session_de_dictado(destino, "s1"), "dictado de prueba", llm)

    tool = DD.DESTINOS_DICTADO[destino].tool
    assert [c["tools"] for c in llm.llamadas] == [[tool], [tool]], "el modelo vio más de una tool"
    assert [c["tool_choice"] for c in llm.llamadas] == ["required", "none"]
    assert len(enviados) == 1
    assert enviados[0]["card"]["kind"] == CARD[destino], enviados[0]
    assert enviados[0]["channel_ref"] == f"dictado:{destino}:s1"
    assert "Qué querés hacer" not in enviados[0]["text"]


@pytest.mark.asyncio
async def test_CONTROL_la_misma_frase_por_una_sesion_normal_no_produce_card_y_ve_el_catalogo():
    llm = _LlmQueObedeceElToolChoice()
    enviados = await _correr("s1", "gasté cinco mil de nafta", llm)

    assert len(llm.llamadas) == 1 and llm.llamadas[0]["tool_choice"] == "auto"
    assert len(llm.llamadas[0]["tools"]) > 10, "la sesión normal tiene que ver el catálogo completo"
    assert enviados[-1]["card"] == {} and "Qué querés hacer" in enviados[-1]["text"]
