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
from temporalio.client import WorkflowFailureError
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


def _choice_value(sent_payload: dict, label: str) -> str:
    """Extrae el `value` (con el token del gate embebido, ej 'confirm:1:0') de las choices de un envío. Simula
    lo que hace el frontend real: reenvía el `value` de la card tal cual, nunca un literal "confirm"/"cancel"."""
    return next(c["value"] for c in sent_payload["choices"] if c["label"] == label)


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
            # el value real (con el token del gate embebido, HIGH) — NUNCA un literal "confirm" plano
            confirm_value = _choice_value(calls["sent"][-1], "Confirmar")
            await h.signal(ConversationWorkflow.receive_message, {"text": confirm_value, "kind": "callback"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()
    # el cobro se ejecutó confirmado, y el gmail_send que sigue lleva el link REAL en el body (spike A)
    confirmed_charge = [c for c in calls["exec"] if c["name"] == "mp_charge" and c["confirmed"]]
    gmail = [c for c in calls["exec"] if c["name"] == "gmail_send"]
    assert confirmed_charge and gmail
    assert "https://mpago.la/REAL" in gmail[0]["arguments"]["body"]
    # B1 (regresión): el confirm reusa EXACTAMENTE la idem_key del probe (confirmed=False) que abrió el gate
    probe = [c for c in calls["exec"] if c["name"] == "mp_charge" and c["confirmed"] is False][0]
    assert confirmed_charge[0]["idem_key"] == probe["idem_key"]


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
            cancel_value = _choice_value(calls["sent"][-1], "Cancelar")   # value real, con el token del gate
            await h.signal(ConversationWorkflow.receive_message, {"text": cancel_value, "kind": "callback"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()
    assert len(calls["exec"]) == n_exec_before          # tras el cancel NO se ejecutó ningún write más (corte)
    assert "no generé" in calls["sent"][-1]["text"].lower()


# ═══════════════════════════ Fixes review U6 (HIGH token-por-gate · needs_stt · B1) ═══════════════════════════

@pytest.mark.asyncio
async def test_react_stale_confirm_token_does_not_execute_next_gate():
    """HIGH (bug de dinero): un confirm STALE del gate1 (ya consumido) NO puede aprobar el gate2 que lo sucedió
    tras encadenar. Doble-click / card vieja / callback mal-dirigido -> no-op fail-closed; el pending vigente
    (gate2) sigue intacto hasta que llega SU propio token."""
    def exec_fn(p):
        if p["confirmed"]:
            return ToolResult(tool_call_id=p["idem_key"], is_write=True, status="ok",
                              observation={"result": "hecho"}).to_dict()
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status="needs_confirmation",
                          observation={"preview": "confirmás?"}).to_dict()
    async with await WorkflowEnvironment.start_time_skipping() as env:
        w, calls = _script_worker(env, "r6", llm_script=[
            _tc("mp_charge", {"amount": 1000}),                       # abre gate1
            _tc("gmail_send", {"to": "a@b.com", "body": "x"}),        # tras confirm1, encadena -> abre gate2
            _TEXT("Listo, mandado."),                                 # tras confirm2, cierra
        ], exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r6", task_queue="r6")
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobrá y mandá mail", "kind": "text"})
            await env.sleep(1)
            tok1 = _choice_value(calls["sent"][-1], "Confirmar")            # token del gate1 (mp_charge)
            await h.signal(ConversationWorkflow.receive_message, {"text": tok1, "kind": "callback"})
            await env.sleep(1)
            tok2 = _choice_value(calls["sent"][-1], "Confirmar")            # token del gate2 (gmail_send)
            assert tok2 != tok1                                            # cada gate tiene SU propio token
            n_exec_before_stale = len(calls["exec"])
            # confirm STALE: reenviamos tok1 (ya consumido, del gate1) sobre el gate2 ABIERTO
            await h.signal(ConversationWorkflow.receive_message, {"text": tok1, "kind": "callback"})
            await env.sleep(1)
            assert len(calls["exec"]) == n_exec_before_stale             # el stale NO ejecutó el 2º write
            st = await h.query(ConversationWorkflow.state)
            assert st["conversation_state"].get("react")                 # gate2 SIGUE parqueado, no se consumió
            # el confirm CORRECTO (tok2) sí ejecuta
            await h.signal(ConversationWorkflow.receive_message, {"text": tok2, "kind": "callback"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()
    confirmed = [c for c in calls["exec"] if c["confirmed"]]
    assert len(confirmed) == 2   # mp_charge Y gmail_send terminan ejecutados, cada uno con SU propio confirm


@pytest.mark.asyncio
async def test_react_two_charges_different_turns_different_idem_keys():
    """B1 (regresión, bug de dinero): dos cobros en TURNOS DISTINTOS nunca colisionan de idem_key aunque
    ambos arranquen en step=0 (el step se resetea por turno; turn_ix es global y monótono)."""
    def exec_fn(p):
        st = "ok" if p["confirmed"] else "needs_confirmation"
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status=st,
                          observation={"preview": "cobro", "init_point": "https://mpago.la/X"}).to_dict()
    async with await WorkflowEnvironment.start_time_skipping() as env:
        w, calls = _script_worker(env, "r7", llm_script=[
            _tc("mp_charge", {"amount": 1000}),      # turno 1: abre gate
            _TEXT("Listo, cobrado."),                 # tras confirm 1: cierra
            _tc("mp_charge", {"amount": 2000}),      # turno 2: abre gate (mismo step=0, turn_ix distinto)
            _TEXT("Listo, cobrado de nuevo."),        # tras confirm 2: cierra
        ], exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r7", task_queue="r7")
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobrá 1000", "kind": "text"})
            await env.sleep(1)
            tok1 = _choice_value(calls["sent"][-1], "Confirmar")
            await h.signal(ConversationWorkflow.receive_message, {"text": tok1, "kind": "callback"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobrá 2000 de nuevo", "kind": "text"})
            await env.sleep(1)
            tok2 = _choice_value(calls["sent"][-1], "Confirmar")
            await h.signal(ConversationWorkflow.receive_message, {"text": tok2, "kind": "callback"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()
    confirmed = [c for c in calls["exec"] if c["name"] == "mp_charge" and c["confirmed"]]
    assert len(confirmed) == 2
    assert confirmed[0]["idem_key"] != confirmed[1]["idem_key"]   # NO colisión B1 entre turnos distintos


@pytest.mark.asyncio
async def test_react_needs_stt_with_transcript_processes_as_text():
    """MEDIUM: un mensaje `needs_stt` en el path react se transcribe (activity `transcribe_voice`) y sigue
    como texto normal — antes de este fix el file_id crudo se mandaba al LLM como si fuera texto de usuario."""
    calls = {"exec": [], "sent": [], "llm": 0, "stt": []}

    @activity.defn(name="transcribe_voice")
    async def ftt(p):
        calls["stt"].append(p)
        return {"text": "tengo mails sin leer?"}

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        calls["llm"] += 1
        assert p["messages"][0]["content"] == "tengo mails sin leer?"   # el LLM ve el TRANSCRIPT, no el file_id
        return _TEXT("Sí, tenés 2 sin leer.")

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        calls["exec"].append(p)
        return ToolResult(tool_call_id=p["idem_key"], observation={}).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        calls["sent"].append(p)
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="r8", workflows=[ConversationWorkflow],
                          activities=[ftt, flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r8", task_queue="r8")
            await h.signal(ConversationWorkflow.receive_message, {"text": "file123", "kind": "needs_stt"})
            await h.signal(ConversationWorkflow.close)
            await h.result()
    assert len(calls["stt"]) == 1 and calls["stt"][0]["file_id"] == "file123"
    assert calls["llm"] == 1 and len(calls["exec"]) == 0
    assert calls["sent"][-1]["text"] == "Sí, tenés 2 sin leer."


@pytest.mark.asyncio
async def test_react_needs_stt_empty_transcript_sends_fallback_without_breaking():
    """MEDIUM: `needs_stt` con transcript vacío manda el mensaje de fallback y CORTA el turno sin llamar al
    LLM ni tocar ningún gate — no rompe el hilo (mismo criterio que el path dispatch)."""
    calls = {"llm": 0, "sent": []}

    @activity.defn(name="transcribe_voice")
    async def ftt(p):
        return {"text": "   "}   # vacío tras strip()

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        calls["llm"] += 1
        return _TEXT("no debería llamarse jamás")

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        return ToolResult(tool_call_id=p["idem_key"], observation={}).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        calls["sent"].append(p)
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="r9", workflows=[ConversationWorkflow],
                          activities=[ftt, flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r9", task_queue="r9")
            await h.signal(ConversationWorkflow.receive_message, {"text": "file999", "kind": "needs_stt"})
            await h.signal(ConversationWorkflow.close)
            await h.result()
    assert calls["llm"] == 0                                          # nunca llegó a call_llm_tools
    assert "no pude escuchar" in calls["sent"][-1]["text"].lower()


# ═══════════════════════════════ Fixes review FINAL (retry LLM · card service · callback stale) ═══════════════

@pytest.mark.asyncio
async def test_react_llm_non_retryable_error_fails_in_one_attempt():
    """FIX HIGH (bug 'codificar la esperanza'): un error `NonRetryableError` (401/insufficient_quota) de la API
    LLM debe fallar la activity `call_llm_tools` en UN solo intento -- Temporal matchea `non_retryable_error_types`
    por el NOMBRE de la clase de la excepción (str), cableado en `LOOP_RETRY`. Sin el fix, la activity quemaría
    los 5 reintentos de `LOOP_RETRY` contra la MISMA credencial rota antes de fallar igual (nada lo arregla
    reintentando). El workflow FALLA (nadie captura `ActivityError` en el loop react hoy) pero rápido, no tras 5
    intentos con backoff."""
    from clients.agent.providers.llm import NonRetryableError

    attempts = {"n": 0}

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        attempts["n"] += 1
        raise NonRetryableError("401 invalid_api_key simulado")

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        return ToolResult(tool_call_id=p["idem_key"], observation={}).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="r10", workflows=[ConversationWorkflow],
                          activities=[flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r10", task_queue="r10")
            await h.signal(ConversationWorkflow.receive_message, {"text": "hola", "kind": "text"})
            with pytest.raises(WorkflowFailureError):
                await h.result()
    assert attempts["n"] == 1   # non-retryable: UN solo intento, NO quema los 5 de LOOP_RETRY


def test_loop_retry_has_non_retryable_llm_error_configured():
    """Verificación directa (sin cluster) de que `LOOP_RETRY` trae cableado el tipo no-retryable -- si alguien
    lo saca sin querer (regresión), este test falla sin necesitar levantar un WorkflowEnvironment."""
    from backend.agent.conversation_workflow import LOOP_RETRY
    assert LOOP_RETRY.non_retryable_error_types == ["NonRetryableError"]


@pytest.mark.asyncio
async def test_react_gate_card_carries_service_and_label():
    """FIX HIGH (bug de UX en cobros): la card del gate `needs_confirmation` debe llevar `service`/`label` --
    el frontend (`hitlMapping.ts`) keyea el badge de riesgo (Mercado Pago "REVISAR") y el monto por
    `card.service`; sin este fix TODO gate react mandaba `card={}` (needs_confirmation nunca trae artifact
    real, o trae kind='pending' que `_react_send` filtra) y el badge degradaba a genérico."""
    def exec_fn(p):
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status="needs_confirmation",
                          observation={"preview": "generar link de cobro por $5000",
                                       "service": "mercadopago", "label": "Mercado Pago"}).to_dict()
    async with await WorkflowEnvironment.start_time_skipping() as env:
        w, calls = _script_worker(env, "r12", llm_script=[_tc("mp_charge", {"amount": 5000})], exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r12", task_queue="r12")
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobrá 5000", "kind": "text"})
            await env.sleep(2)
            await h.signal(ConversationWorkflow.close)
            await h.result()
    card = calls["sent"][-1]["card"]
    assert card == {"kind": "confirm", "service": "mercadopago", "label": "Mercado Pago"}


@pytest.mark.asyncio
async def test_react_stale_callback_without_parked_gate_does_not_reach_llm():
    """FIX LOW (review final): un callback (kind='callback') que llega SIN gate parqueado (ya resuelto -- doble
    click tardío sobre una card vieja) NO debe caer al turno normal ni mandar el token crudo (ej 'confirm:1:0')
    al LLM como si fuera texto de usuario -- corta limpio, sin invocar call_llm_tools ni tocar el estado."""
    calls = {"llm": 0, "sent": []}

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        calls["llm"] += 1
        return _TEXT("no debería llamarse jamás")

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        return ToolResult(tool_call_id=p["idem_key"], observation={}).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        calls["sent"].append(p)
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="r13", workflows=[ConversationWorkflow],
                          activities=[flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="r13", task_queue="r13")
            # callback SIN gate abierto (state['react'] nunca se seteó) -- doble-click tardío / card stale
            await h.signal(ConversationWorkflow.receive_message, {"text": "confirm:0:0", "kind": "callback"})
            await h.signal(ConversationWorkflow.close)
            await h.result()
    assert calls["llm"] == 0                      # NUNCA llegó al LLM con el token crudo
    assert calls["sent"], "no respondió nada al callback stale"


# ═══════════════════════════ Regresión: memoria de CORTO plazo entre turnos (bug 2026-07-07) ═══════════════════

@pytest.mark.asyncio
async def test_react_second_turn_sees_prior_turn_history():
    """REGRESIÓN memoria de corto plazo: en 'react' el 2º turno de TEXTO normal (sin gate de por medio) DEBE
    ver el turno anterior. Síntoma real (operador): 'revisá gmail, últimos 100' -> responde; luego 'dame los
    últimos 100' -> 'no entiendo, ¿a qué te referís? (¿actividades, Instagram, correos?)'. Causa raíz: cada
    turno react arrancaba el scratchpad con SOLO el mensaje actual (`messages=[user]`), sin inyectar el buffer
    `self._history` — a diferencia de `dispatch`, que pasa `prior[-20:]`. El buffer existía (state durable del
    workflow, persistente por sesión) pero react NO lo consumía para el prompt del LLM. Fix: el turno normal
    arranca `messages = self._history[-HISTORY_TAIL:]` (incluye los turnos previos + el actual al final).

    El `recall_memory` (memoria LARGA de Graphity) devuelve vacío a propósito: así el ÚNICO contexto posible
    del 2º turno es el buffer de corto plazo — si el LLM lo ve, es porque el buffer se inyectó (no la memoria
    larga, que además ni tendría el turno inmediato: remember persiste en batch de >=20 msgs)."""
    seen_messages: list[list[dict]] = []

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        seen_messages.append(list(p["messages"]))
        # "dale, ahí va" (no "listo, ..."): texto neutro a propósito -- "listo" es palabra de cierre del
        # guardrail narra-sin-hacer v2 (Parte 1) y con trace vacío (sin tool ejecutada) dispararía un
        # retry con tool_choice="required" que duplicaría las llamadas y rompería el conteo de este test,
        # que no tiene nada que ver con el guardrail.
        return {"tool_calls": [], "content": "dale, ahí va"}   # cada turno cierra con texto (sin tools)

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}   # memoria LARGA vacía -> el único contexto posible es el buffer CORTO

    @activity.defn(name="execute_tool")
    async def fe(p):
        return ToolResult(tool_call_id=p["idem_key"], observation={}).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="rhist", workflows=[ConversationWorkflow],
                          activities=[flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="rhist", task_queue="rhist")
            await h.signal(ConversationWorkflow.receive_message,
                           {"text": "revisá gmail, últimos 100", "kind": "text"})
            await env.sleep(1)                       # deja completar el turno 1 (scratchpad + reply -> history)
            await h.signal(ConversationWorkflow.receive_message,
                           {"text": "dame los últimos 100", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

    assert len(seen_messages) == 2, "esperaba 1 llamada a call_llm_tools por turno"
    turn2 = [m.get("content") for m in seen_messages[1]]
    # el 2º turno DEBE traer el contexto del 1º (mensaje del usuario + respuesta del asistente), no solo el actual
    assert "revisá gmail, últimos 100" in turn2, f"amnesia: el 2º turno no vio el mensaje del 1º -> {turn2}"
    assert "dale, ahí va" in turn2, "el 2º turno no vio la respuesta del asistente del 1º turno"
    assert seen_messages[1][-1]["content"] == "dame los últimos 100"   # el mensaje actual va al final del scratchpad


# ═══════════════ Fix narra-sin-hacer: evidencia de tool-trace que ve el turno siguiente ═══════════════
# NOTA (2026-07-23, v2 Parte 2): estos dos tests verificaban el marcador de texto de PR#85
# (self._history + "[tool:x→ok]"). Ese marcador SIGUE en el código (self._history, sin cambios) pero ya
# NO es lo que siembra `messages` -- lo reemplazó `self._react_transcript` (shape nativo, ver Parte 2 en
# conversation_workflow.py). Las aserciones migraron a verificar la evidencia ESTRUCTURAL real que el
# turno siguiente recibe, que es lo que efectivamente importa (PR#85 medía 2/2 narrando igual pese al
# marcador; esto es lo que lo reemplaza).

@pytest.mark.asyncio
async def test_react_structural_evidence_survives_to_next_turn_when_tool_executed():
    """[[copiloto-narra-la-accion-sin-ejecutarla]]: un turno que EJECUTÓ una tool antes de cerrar debe dejar
    evidencia ESTRUCTURAL de eso (mensaje role='assistant' con 'tool_calls' + un role='tool' con el
    resultado) en lo que ve el turno siguiente -- no un marcador de texto que el LLM podía ignorar (PR#85,
    2/2 en device)."""
    seen_messages: list[list[dict]] = []

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        seen_messages.append(list(p["messages"]))
        if len(seen_messages) == 1:
            return _tc("crear_gasto", {"monto": 500})
        return _TEXT("listo" if len(seen_messages) == 2 else "ok")

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status="ok",
                          observation={"result": "ok"}).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="rmark", workflows=[ConversationWorkflow],
                          activities=[flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="rmark", task_queue="rmark")
            await h.signal(ConversationWorkflow.receive_message, {"text": "anotá un gasto de 500", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.receive_message, {"text": "otra cosa", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

    # turno 1 hace 2 llamadas (propone la tool, después cierra con texto); turno 2 es la ÚLTIMA -- por eso
    # `seen_messages[-1]` (no un índice fijo) es el que hay que inspeccionar, con el buffer YA reconstruido
    # desde self._react_transcript (a diferencia de seen_messages[1], que es el 2º llamado del PROPIO
    # turno 1, scratchpad).
    assert len(seen_messages) >= 3
    turn2 = seen_messages[-1]
    tool_call_msgs = [m for m in turn2 if m.get("role") == "assistant" and m.get("tool_calls")]
    tool_result_msgs = [m for m in turn2 if m.get("role") == "tool"]
    assert tool_call_msgs, f"el 2º turno no ve el tool_call ESTRUCTURAL del 1º -> {turn2}"
    assert tool_call_msgs[0]["tool_calls"][0]["function"]["name"] == "crear_gasto"
    assert tool_result_msgs, f"el 2º turno no ve el tool_result ESTRUCTURAL del 1º -> {turn2}"
    textos = [m.get("content") for m in turn2 if isinstance(m.get("content"), str)]
    assert any("listo" in t for t in textos), f"el 2º turno no ve el cierre en texto del 1º -> {textos}"


@pytest.mark.asyncio
async def test_react_history_marker_absent_when_no_tool_executed():
    """Regresión anti-ruido: un turno que cerró SOLO con texto (sin ejecutar ninguna tool) no debe llevar
    marcador -- si se marcara todo, el marcador deja de ser evidencia de nada."""
    seen_messages: list[list[dict]] = []

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        seen_messages.append(list(p["messages"]))
        return _TEXT("hola, en qué te ayudo")

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        return ToolResult(tool_call_id=p["idem_key"], observation={}).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="rnomark", workflows=[ConversationWorkflow],
                          activities=[flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="rnomark", task_queue="rnomark")
            await h.signal(ConversationWorkflow.receive_message, {"text": "hola", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.receive_message, {"text": "de nuevo", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

    assert len(seen_messages) >= 2
    turn2 = [m.get("content") for m in seen_messages[1]]
    assert "hola, en qué te ayudo" in turn2                # el texto viaja intacto
    assert not any(isinstance(c, str) and "tool:" in c for c in turn2), (
        f"marcó un turno que no ejecutó ninguna tool -> {turn2}")


@pytest.mark.asyncio
async def test_react_structural_evidence_includes_tool_confirmed_via_gate():
    """La evidencia estructural también cubre la tool que se ejecutó vía el gate de confirmación
    (confirmed=True) -- el reingreso por _run_react_turn apendea a self._react_transcript ANTES de
    entrar a _react_loop, no arranca en blanco."""
    seen_messages: list[list[dict]] = []
    llm_calls = {"n": 0}

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        llm_calls["n"] += 1
        if llm_calls["n"] == 1:
            return _tc("mp_charge", {"amount": 1000})
        seen_messages.append(list(p["messages"]))
        return _TEXT("listo, cobrado")

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        st = "ok" if p["confirmed"] else "needs_confirmation"
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status=st,
                          observation={"preview": "cobro"}).to_dict()

    sent: list[dict] = []

    @activity.defn(name="send_channel_message")
    async def fs(p):
        sent.append(p)
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="rmarkgate", workflows=[ConversationWorkflow],
                          activities=[flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="rmarkgate", task_queue="rmarkgate")
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobrá 1000", "kind": "text"})
            await env.sleep(1)
            confirm_value = _choice_value(sent[-1], "Confirmar")
            await h.signal(ConversationWorkflow.receive_message, {"text": confirm_value, "kind": "callback"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.receive_message, {"text": "otra cosa", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

    assert seen_messages, "no llegó a un 2º turno que pueda ver el history"
    turn_after = seen_messages[-1]
    tool_call_msgs = [m for m in turn_after if m.get("role") == "assistant" and m.get("tool_calls")]
    tool_result_msgs = [m for m in turn_after if m.get("role") == "tool"]
    assert tool_call_msgs, f"el 2º turno no ve el tool_call ESTRUCTURAL del gate -> {turn_after}"
    assert tool_call_msgs[0]["tool_calls"][0]["function"]["name"] == "mp_charge"
    assert tool_result_msgs, f"el 2º turno no ve el tool_result ESTRUCTURAL del gate -> {turn_after}"
    textos = [m.get("content") for m in turn_after if isinstance(m.get("content"), str)]
    assert any("listo, cobrado" in t for t in textos), (
        f"el 2º turno no ve el cierre en texto del gate -> {textos}")


# ═══════════════════════════ Fix narra-sin-hacer v2: guardrail (Parte 1) + cura estructural (Parte 2) ═══════════════

def test_narra_completitud_detecta_solo_palabras_de_cierre_exactas():
    """Unit puro (sin cluster): el detector dispara con las formas de HECHO CONSUMADO medidas en device (PR#88,
    3/3), pero NO con una pregunta legítima que use el mismo verbo en otra conjugación -- "¿aprobás?" no es
    "aprobado". Sin esta distinción, el guardrail se dispararía sobre turnos de aclaración honestos."""
    from backend.agent.conversation_workflow import _narra_completitud

    # medido en device, PR#88 (spike-b), 3/3:
    assert _narra_completitud('Anoté el gasto de $141 en la categoría "otros"... revisalo y confirmame.')
    assert _narra_completitud("Listo, ya lo mandé.")
    assert _narra_completitud("Quedó guardado el cliente.")
    # clarificaciones honestas -- NO deben disparar:
    assert not _narra_completitud("¿Qué categoría le corresponde a este gasto?")
    assert not _narra_completitud("¿Aprobás este presupuesto?")            # "aprobás" != "aprobado"
    assert not _narra_completitud("¿Cómo se llama el cliente?")
    assert not _narra_completitud("")
    assert not _narra_completitud(None)


@pytest.mark.asyncio
async def test_react_guardrail_forces_required_retry_when_llm_lies():
    """Parte 1 del fix v2: el LLM cierra el 1er intento SIN tool_call pero afirmando "Anoté..." (la mentira
    medida 3/3 en device) -> el guardrail rechaza esa respuesta y re-pregunta UNA vez con
    tool_choice="required". Esta vez el LLM sí llama la tool -> el turno la ejecuta de verdad."""
    payloads: list[dict] = []

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        payloads.append(dict(p))
        if len(payloads) == 1:
            return _TEXT('Anoté el gasto de $141 en la categoría "otros"... revisalo y confirmame.')
        if len(payloads) == 2:
            return _tc("registrar_gasto", {"monto": 141})
        return _TEXT("Listo, te armé el borrador.")

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    exec_calls: list[dict] = []

    @activity.defn(name="execute_tool")
    async def fe(p):
        exec_calls.append(p)
        return ToolResult(tool_call_id=p["idem_key"], is_write=False, status="ok",
                          observation={"result": "propuesto"}).to_dict()

    sent: list[dict] = []

    @activity.defn(name="send_channel_message")
    async def fs(p):
        sent.append(p)
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="rguard1", workflows=[ConversationWorkflow],
                          activities=[flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="rguard1", task_queue="rguard1")
            await h.signal(ConversationWorkflow.receive_message, {"text": "anotá 141 pesos", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

    assert len(payloads) == 3, f"esperaba 3 llamadas (mentira, retry required, cierre) -> {len(payloads)}"
    assert payloads[0]["tool_choice"] == "auto"                # intento normal, el que mintió
    assert payloads[1]["tool_choice"] == "required"             # el guardrail forzó la re-llamada
    assert len(exec_calls) == 1 and exec_calls[0]["name"] == "registrar_gasto"   # la tool SÍ se ejecutó
    assert sent[-1]["text"] == "Listo, te armé el borrador."


@pytest.mark.asyncio
async def test_react_guardrail_no_dispara_en_aclaracion_honesta():
    """Anti-falso-positivo: una repregunta honesta del copiloto (sin tool_call, sin afirmar completitud) NO
    debe disparar el guardrail -- una sola llamada a call_llm_tools, sin re-preguntar con tool_choice='required'."""
    payloads: list[dict] = []

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        payloads.append(dict(p))
        return _TEXT("¿Qué categoría le corresponde a este gasto?")

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        return ToolResult(tool_call_id=p["idem_key"], observation={}).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="rguard2", workflows=[ConversationWorkflow],
                          activities=[flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="rguard2", task_queue="rguard2")
            await h.signal(ConversationWorkflow.receive_message, {"text": "anotá un gasto", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

    assert len(payloads) == 1, f"la aclaración honesta NO debe disparar el retry required -> {len(payloads)}"
    assert payloads[0]["tool_choice"] == "auto"


@pytest.mark.asyncio
async def test_react_guardrail_cierra_igual_si_el_required_tampoco_da_tool():
    """Defensivo: si INCLUSO tras forzar tool_choice='required' el LLM sigue sin devolver tool_calls (caso
    límite de la API real, a verificar empíricamente), el turno cierra igual con ese 2º contenido -- nunca
    cuelga esperando un tool_call que no llega."""
    payloads: list[dict] = []

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        payloads.append(dict(p))
        if len(payloads) == 1:
            return _TEXT("Listo, ya lo hice.")
        return _TEXT("Perdón, no puedo hacerlo ahora.")   # ni con required devuelve tool_calls

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        return ToolResult(tool_call_id=p["idem_key"], observation={}).to_dict()

    sent: list[dict] = []

    @activity.defn(name="send_channel_message")
    async def fs(p):
        sent.append(p)
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="rguard3", workflows=[ConversationWorkflow],
                          activities=[flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="rguard3", task_queue="rguard3")
            await h.signal(ConversationWorkflow.receive_message, {"text": "hacé algo", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

    assert len(payloads) == 2
    assert sent[-1]["text"] == "Perdón, no puedo hacerlo ahora."   # cerró con el 2º contenido, no colgó


@pytest.mark.asyncio
async def test_react_transcript_estructural_siembra_el_turno_siguiente():
    """Parte 2 del fix v2 (la cura): el 2º turno debe ver la EVIDENCIA ESTRUCTURAL nativa (mensaje
    role='assistant' con 'tool_calls', y un role='tool' con el resultado) de la tool que el 1er turno ejecutó
    -- no solo el texto plano que el LLM podía imitar sin llamar nada. Esto es lo que PR#85 (marcador de texto)
    no lograba: acá la evidencia vive en la ESTRUCTURA que el propio modelo ya atiende dentro de un turno."""
    seen_messages: list[list[dict]] = []

    @activity.defn(name="call_llm_tools")
    async def flt(p):
        seen_messages.append(list(p["messages"]))
        if len(seen_messages) == 1:
            return _tc("registrar_gasto", {"monto": 500})
        return _TEXT("Te armé el borrador." if len(seen_messages) == 2 else "ok")

    @activity.defn(name="recall_memory")
    async def frc(p):
        return {"context": ""}

    @activity.defn(name="execute_tool")
    async def fe(p):
        return ToolResult(tool_call_id=p["idem_key"], is_write=False, status="ok",
                          observation={"result": "propuesto"}).to_dict()

    @activity.defn(name="send_channel_message")
    async def fs(p):
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="rstruct", workflows=[ConversationWorkflow],
                          activities=[flt, frc, fe, fs]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="rstruct", task_queue="rstruct")
            await h.signal(ConversationWorkflow.receive_message, {"text": "anotá un gasto de 500", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.receive_message, {"text": "otra cosa", "kind": "text"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

    assert len(seen_messages) >= 3
    turn_after = seen_messages[-1]   # el ÚLTIMO llamado ve el buffer YA reconstruido para el 2º turno de usuario
    assistant_tool_call = [m for m in turn_after
                           if m.get("role") == "assistant" and m.get("tool_calls")]
    tool_results = [m for m in turn_after if m.get("role") == "tool"]
    assert assistant_tool_call, f"el 2º turno no ve el tool_call ESTRUCTURAL del 1º -> {turn_after}"
    assert assistant_tool_call[0]["tool_calls"][0]["function"]["name"] == "registrar_gasto"
    assert tool_results, f"el 2º turno no ve el tool_result ESTRUCTURAL del 1º -> {turn_after}"


def test_react_tail_constants_consistent_with_history_pattern():
    """Regresión de config: REACT_CARRY_TAIL >= REACT_TAIL (mismo invariante que CARRY_TAIL >= HISTORY_TAIL) --
    si se invierte, el continue-as-new arrastraría MENOS de lo que un turno necesita para sembrarse."""
    from backend.agent.conversation_workflow import REACT_TAIL, REACT_CARRY_TAIL, CARRY_TAIL, HISTORY_TAIL
    assert REACT_CARRY_TAIL >= REACT_TAIL
    assert CARRY_TAIL >= HISTORY_TAIL
