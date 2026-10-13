"""C-D3 (contrato 2026-10-13): el motor re-empaqueta `detalle` (gate) y `recibo` (cierre tras confirmar) a la card.

El motor es domain-blind: NO interpreta ninguno de los dos, sólo los copia de lo que dejó el executor de
dominio en la `observation`. Lo que se prueba con el `ConversationWorkflow` REAL (Temporal time-skipping):

  · el gate: la card lleva `detalle` si el dominio lo puso, y queda `{kind, service, label}` si no;
  · el cierre: `card.recibo` sube desde la observación del execute_tool confirmado;
  · el LLM NO ve el `recibo` (es para la card, no para el modelo);
  · sin recibo (la tool falló) la card no inventa uno;
  · `confirmed_tool` conserva su forma de siempre (la señal de BL-B1 no cambia).

El replay de historias en vuelo lo cubre `apps/copiloto/tests/test_workflow_replay_gate.py` (fixtures del
`ConversationWorkflow`): este cambio no agrega ni reordena ningún Command.
"""
from __future__ import annotations

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from backend.agent.conversation_workflow import ConversationWorkflow
from backend.agent.test_conversation_workflow_react import _TEXT, _cfg, _choice_value, _tc
from backend.agent.types import ToolResult

DETALLE = {
    "titulo": "Mail a lucia@x.com",
    "filas": [{"k": "Para", "v": "lucia@x.com", "sub": None, "editable": False},
              {"k": "Asunto", "v": "Recordatorio", "sub": None, "editable": False}],
    "cita": "Te recuerdo la reunión del lunes.",
    "nota": "Se manda desde tu Gmail.",
}
RECIBO = {"titulo": "Mandado a lucia@x.com", "meta": "15:41", "accion": None}


def _worker(env, tq, *, llm_script, exec_fn):
    """Como `_script_worker` del archivo del loop, pero guarda los `messages` que ve cada llamada al LLM."""
    calls = {"exec": [], "sent": [], "llm_messages": []}
    it = iter(llm_script)

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        calls["llm_messages"].append(list(p["messages"]))
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


async def _gate_y_confirmar(env, tq, exec_fn, llm_script):
    w, calls = _worker(env, tq, llm_script=llm_script, exec_fn=exec_fn)
    async with w:
        h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                            id=tq, task_queue=tq)
        await h.signal(ConversationWorkflow.receive_message, {"text": "mandale un mail a Lucía", "kind": "text"})
        await env.sleep(1)
        gate_card = calls["sent"][-1]["card"]
        await h.signal(ConversationWorkflow.receive_message,
                       {"text": _choice_value(calls["sent"][-1], "Confirmar"), "kind": "callback"})
        await env.sleep(1)
        await h.signal(ConversationWorkflow.close)
        await h.result()
    return calls, gate_card


def _exec_gmail(observacion_gate, resultado_confirmado):
    def exec_fn(p):
        if not p["confirmed"]:
            return ToolResult(tool_call_id=p["idem_key"], is_write=True, status="needs_confirmation",
                              observation=observacion_gate).to_dict()
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, **resultado_confirmado).to_dict()
    return exec_fn


@pytest.mark.asyncio
async def test_el_gate_lleva_el_detalle_que_puso_el_dominio():
    obs = {"preview": "Voy a enviar un mail a lucia@x.com. ¿Confirmás?", "service": "gmail", "label": "Gmail",
           "detalle": DETALLE}
    exec_fn = _exec_gmail(obs, {"status": "ok", "observation": {"result": "Listo, lo envié ✅"}})
    async with await WorkflowEnvironment.start_time_skipping() as env:
        calls, gate_card = await _gate_y_confirmar(
            env, "cd3-gate", exec_fn,
            [_tc("gmail_send", {"to": "lucia@x.com", "body": "x"}), _TEXT("Listo.")])
    assert gate_card == {"kind": "confirm", "service": "gmail", "label": "Gmail", "detalle": DETALLE}


@pytest.mark.asyncio
async def test_sin_detalle_la_card_del_gate_queda_como_estaba():
    """CONTROL: un servicio que NO armó `detalle` (los otros cuatro) no cambia de forma."""
    obs = {"preview": "generar link de cobro por $5000", "service": "mercadopago", "label": "Mercado Pago"}
    exec_fn = _exec_gmail(obs, {"status": "ok", "observation": {"result": "ok"}})
    async with await WorkflowEnvironment.start_time_skipping() as env:
        calls, gate_card = await _gate_y_confirmar(
            env, "cd3-sin", exec_fn, [_tc("mp_charge", {"amount": 5000}), _TEXT("Listo.")])
    assert gate_card == {"kind": "confirm", "service": "mercadopago", "label": "Mercado Pago"}


@pytest.mark.asyncio
async def test_confirmado_sube_el_recibo_a_la_card_y_el_llm_no_lo_ve():
    obs = {"preview": "mail a lucia@x.com", "service": "gmail", "label": "Gmail", "detalle": DETALLE}
    exec_fn = _exec_gmail(obs, {"status": "ok",
                                "observation": {"result": "Listo, lo envié ✅", "recibo": RECIBO}})
    async with await WorkflowEnvironment.start_time_skipping() as env:
        calls, _ = await _gate_y_confirmar(
            env, "cd3-recibo", exec_fn,
            [_tc("gmail_send", {"to": "lucia@x.com", "body": "x"}), _TEXT("Listo, se lo mandé a Lucía.")])
    final = calls["sent"][-1]
    assert final["card"]["recibo"] == RECIBO
    # la señal BL-B1 conserva su forma de siempre: el recibo NO se mezcla adentro
    assert final["card"]["confirmed_tool"] == {"activity": "execute_tool", "name": "gmail_send",
                                               "confirmed": True, "status": "ok"}
    assert "detalle" not in final["card"]                          # el detalle es del gate, no del cierre
    # lo que vio el modelo tras el confirm: el resultado, sin el recibo (es para la card)
    tool_msgs = [m for m in calls["llm_messages"][-1] if m.get("role") == "tool"]
    assert tool_msgs and "Listo, lo envié" in tool_msgs[-1]["content"]
    assert "Mandado a" not in tool_msgs[-1]["content"] and "recibo" not in tool_msgs[-1]["content"]


@pytest.mark.asyncio
async def test_si_la_tool_fallo_la_card_no_trae_recibo():
    obs = {"preview": "mail a lucia@x.com", "service": "gmail", "label": "Gmail", "detalle": DETALLE}
    exec_fn = _exec_gmail(obs, {"status": "error", "observation": {"result": "no se pudo completar"}})
    async with await WorkflowEnvironment.start_time_skipping() as env:
        calls, _ = await _gate_y_confirmar(
            env, "cd3-fallo", exec_fn,
            [_tc("gmail_send", {"to": "lucia@x.com", "body": "x"}), _TEXT("No pude mandarlo.")])
    final = calls["sent"][-1]
    assert "recibo" not in final["card"]
    assert final["card"]["confirmed_tool"]["status"] == "error"
