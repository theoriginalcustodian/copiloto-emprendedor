"""Tests ADVERSARIALES del DoD (Task 18) del motor ReAct — regla dura de seguridad del CLAUDE global:
"control de autorizacion sin test adversarial = control no verificado". Los 3 tests de abajo ejercitan el
CASO HOSTIL (no el happy-path) sobre las 3 garantias de seguridad del motor:

  1. REPLAY crash-mid-loop: el worker "muere" DESPUES de ejecutar el cobro (write1, YA confirmado) y ANTES
     de ejecutar el mail (write2, aun sin confirmar) -> un worker NUEVO (instancia sin cache in-process,
     misma task queue -> simula un restart real de proceso) retoma. Assert: el cobro NO se re-ejecuta
     (Temporal reconstruye el estado replayando el history -- NUNCA re-invoca una activity ya completada) y
     el mail sale exactamente una vez, ejecutado por el worker NUEVO.
  2. BOLA cross-tenant: un tool_call cuyos `arguments` (payload LLM-controlado, no confiable) intentan
     apuntar a la identidad/recursos del tenant B, en una sesion cuyo `conv['cliente_id']` es A (el
     ESTABLECIDO al abrir la conversacion, controlado por el canal/autenticacion, NUNCA por el chat).
     Assert: el context_factory arma el ctx SOLO desde `conv`, nunca desde `arguments` -> el gateway externo
     recibe SIEMPRE el user_id de A.
  3. PROVENANCE del confirmed=True: el UNICO productor de `confirmed=True` en todo el motor es el brazo
     `action == 'confirm'` de `_run_react_turn`, alcanzable SOLO via `kind == 'callback'` + el token del
     gate VIGENTE. Dos intentos hostiles (token real pero como texto libre; callback con token equivocado)
     NUNCA producen un execute_tool con confirmed=True; solo el callback correcto lo hace.

Deterministas (WorkflowEnvironment time-skipping + activities fake / registry fake), sin cluster ni LLM
real. Corre EN el VPS (temporalio) -- ver harness identico en test_conversation_workflow_react.py (Task 12).
"""
from __future__ import annotations

import asyncio
import inspect
from datetime import timedelta

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Replayer, Worker

from backend.agent import agent_activities as A
from backend.agent import conversation_workflow as CW
from backend.agent.agent_runtime import register_domain, reset_registry
from backend.agent.conversation_workflow import ConversationWorkflow
from backend.agent.types import ToolResult


def _cfg(**extra) -> dict:
    return {"domain": "d", "channel": "web", "channel_ref": "s1", "cliente_id": "c1", **extra}


def _tc(name, args):
    return {"tool_calls": [{"id": "call_x", "name": name, "arguments": args}], "content": None,
            "finish_reason": "tool_calls"}


def _TEXT(t):
    return {"tool_calls": [], "content": t, "finish_reason": "stop"}


def _choice_value(sent_payload: dict, label: str) -> str:
    """Extrae el `value` (con el token del gate embebido, ej 'confirm:1:0') de las choices de un envio --
    simula lo que hace el frontend real: reenvia el `value` de la card tal cual (kind='callback')."""
    return next(c["value"] for c in sent_payload["choices"] if c["label"] == label)


def _script_worker(env, tq, *, llm_script, exec_fn, **worker_kwargs):
    """Adaptado de test_conversation_workflow_react.py (Task 12): worker con activities fake guionadas.
    `worker_kwargs` (ej. max_cached_workflows=0) permite forzar que el worker NO cachee sticky -> una
    instancia NUEVA en la MISMA task queue se comporta como un proceso independiente que jamas vio el
    workflow antes (usado por el test de crash-mid-loop para simular un restart real)."""
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
                  activities=[flt, frc, fe, fs], **worker_kwargs), calls


# ═══════════════════════ 1) REPLAY crash-mid-loop (cobro YA confirmado, mail pendiente) ═══════════════════════

@pytest.mark.asyncio
async def test_replay_crash_mid_loop_does_not_redo_charge_and_sends_mail_once():
    """CASO HOSTIL: el worker que procesa "cobrá 5000 y mandá el link" MUERE justo despues de ejecutar el
    cobro CONFIRMADO (write1) y ANTES de ejecutar el mail (write2, gate2 recien abierto y parqueado en
    `self._state['react']` -- que vive en el HISTORY del server, NO en memoria del proceso worker). Un
    worker NUEVO retoma en la MISMA task queue.

    Por que este enfoque (y no un Replayer aislado con un history armado a mano, que es fragil): instanciar
    dos `Worker()` SEPARADOS sobre la MISMA task queue, con `max_cached_workflows=0` (sin cache sticky) para
    que la 2da instancia jamas comparta estado in-process con la 1ra, es la forma que la propia doc oficial
    del SDK describe para "Worker Crash Mid-Workflow": "the workflow will replay up to that point, skipping
    already executed steps" (validado via context7 antes de escribir este test, temporalio 1.28 pinned).
    Ademas corroboramos con `Replayer` (mismo patron ya usado en `deploy/ops/replay_check.py`) sobre el
    history FINAL: si el motor no fuera determinista tras el "restart", el replay levantaria un error de
    no-determinismo -- esa garantia es, estructuralmente, lo que impide re-cobrar.
    """
    def exec_fn(p):
        # tanto el cobro como el mail estan gateados (is_write): confirmed=False -> needs_confirmation.
        st = "ok" if p["confirmed"] else "needs_confirmation"
        obs = {"preview": "cobro $5000", "init_point": "https://mpago.la/REAL"} if p["name"] == "mp_charge" \
            else {"preview": "enviar mail con el link"}
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status=st, observation=obs).to_dict()

    tq = "crash1"
    async with await WorkflowEnvironment.start_time_skipping() as env:
        # ── Worker A: procesa hasta que el cobro esta CONFIRMADO y el gate del mail (gate2) quedo abierto.
        #    max_cached_workflows=0 + sticky timeout corto: ninguna afinidad sticky sobrevive a este worker.
        w1, calls1 = _script_worker(
            env, tq, llm_script=[_tc("mp_charge", {"amount": 5000}), _tc("gmail_send", {"to": "a@b.com"})],
            exec_fn=exec_fn, max_cached_workflows=0, sticky_queue_schedule_to_start_timeout=timedelta(seconds=2))
        async with w1:
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id=tq, task_queue=tq)
            await h.signal(ConversationWorkflow.receive_message,
                           {"text": "cobrá 5000 y mandá el link", "kind": "text"})
            await env.sleep(1)
            tok1 = _choice_value(calls1["sent"][-1], "Confirmar")           # token del gate1 (mp_charge)
            await h.signal(ConversationWorkflow.receive_message, {"text": tok1, "kind": "callback"})
            await env.sleep(1)

            # el cobro (write1) ya se ejecuto CONFIRMADO exactamente una vez; el mail (write2) AUN no se mando
            confirmed_charge_before = [c for c in calls1["exec"] if c["name"] == "mp_charge" and c["confirmed"]]
            assert len(confirmed_charge_before) == 1
            assert not any(c["name"] == "gmail_send" and c["confirmed"] for c in calls1["exec"])
            st = await h.query(ConversationWorkflow.state)
            assert st["conversation_state"].get("react")                   # gate2 (mail) quedo parqueado
            tok2 = _choice_value(calls1["sent"][-1], "Confirmar")           # token del gate2 (gmail_send)
        # ── "muere" el worker (sale del `async with`): el pending del gate2 vive en el SERVER, no en el proceso.

        # ── Worker B: instancia NUEVA (calls propios, sin cache in-process) en la MISMA task queue -> el
        #    proximo workflow task lo atiende un worker que jamas vio esta ejecucion -> replay forzado del
        #    history completo (incluida la activity YA completada del cobro) antes de poder seguir en vivo.
        w2, calls2 = _script_worker(env, tq, llm_script=[_TEXT("Listo, cobrado y mail enviado.")],
                                    exec_fn=exec_fn, max_cached_workflows=0,
                                    sticky_queue_schedule_to_start_timeout=timedelta(seconds=2))
        async with w2:
            await h.signal(ConversationWorkflow.receive_message, {"text": tok2, "kind": "callback"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

        # ── el cobro NO se re-ejecuto tras el "restart"; el mail salio EXACTAMENTE una vez (por el worker NUEVO)
        all_exec = calls1["exec"] + calls2["exec"]
        confirmed_charges = [c for c in all_exec if c["name"] == "mp_charge" and c["confirmed"]]
        confirmed_mails = [c for c in all_exec if c["name"] == "gmail_send" and c["confirmed"]]
        assert len(confirmed_charges) == 1                                 # jamas se re-cobro
        assert len(confirmed_mails) == 1                                   # el mail salio UNA sola vez
        assert confirmed_mails[0] in calls2["exec"]                        # lo ejecuto el worker POST-restart

        # ── Replayer (mismo patron que deploy/ops/replay_check.py): si el motor no fuera determinista, esto
        #    levantaria un error de no-determinismo en vez de completar silenciosamente.
        hist = await env.client.get_workflow_handle(tq).fetch_history()
        await Replayer(workflows=[ConversationWorkflow]).replay_workflow(hist)


# ═══════════════════════════════ 2) BOLA cross-tenant ═══════════════════════════════

class _TenantCtxFake:
    """Espeja `apps/copiloto/context_factory.py::TenantCtx` (leido para este test): identidad SOLO desde
    `conv['cliente_id']` -- `composio_user_id = str(cliente_id)` ahi tambien."""
    def __init__(self, cliente_id: str):
        self.cliente_id = cliente_id
        self.composio_user_id = f"comp_{cliente_id}"


def _bola_context_factory(conv: dict) -> _TenantCtxFake:
    """Arma el ctx EXCLUSIVAMENTE desde `conv['cliente_id']` -- el unico campo que threadea el workflow
    desde la config de arranque de la SESION (el tenant autenticado por el canal). Nunca lee `arguments`
    (eso ni siquiera llega aca: `agent_activities.execute_tool` llama context_factory(payload['conv']))."""
    return _TenantCtxFake(conv["cliente_id"])


def _bola_executor(gateway_calls: list):
    """Simula un tool_executor de dominio real (ej. MercadoPagoGateway del copiloto): usa SOLO
    `ctx.composio_user_id` para el gateway externo -- NUNCA un campo de identidad que venga en `arguments`
    (payload NO confiable, lo arma el LLM; en este escenario el LLM esta siendo manipulado/alucina para
    "hablar" en nombre de otro tenant)."""
    def executor(name, arguments, ctx, *, confirmed, idem_key):
        gateway_calls.append({"user_id": ctx.composio_user_id, "name": name, "arguments": dict(arguments)})
        return ToolResult(tool_call_id=idem_key, is_write=True, status="ok", observation={"result": "hecho"})
    return executor


def test_bola_cross_tenant_tool_call_never_executes_as_other_tenant():
    """CASO HOSTIL: la sesion es del cliente A (`conv['cliente_id']='clienteA'`, establecido al ABRIR la
    conversacion -- lo controla el canal/autenticacion, NUNCA el usuario dentro del chat). El tool_call
    (`arguments`) viene del LLM y, en un escenario de prompt-injection/alucinacion, intenta referenciar la
    identidad/recursos del tenant B. Assert: el gateway.execute() SIEMPRE recibe el user_id de A -- el motor
    NUNCA lee identidad de `arguments`.

    Por que no es trivial: se ejercita el codigo REAL de la activity `agent_activities.execute_tool` (no una
    reimplementacion en el test) con un context_factory/executor que reproducen EXACTAMENTE el contrato real
    (`apps/copiloto/context_factory.py`: ctx solo desde `conv['cliente_id']`). Si un refactor futuro
    mezclara `payload['arguments']` dentro de `payload['conv']` antes de invocar el context_factory (bug de
    BOLA real y plausible -- "ser mas flexible" con la identidad), este test lo detecta: `composio_user_id`
    pasaria a ser el de B en vez del de A.
    """
    reset_registry()
    gateway_calls: list = []
    register_domain("d_bola", system_prompt="SYS", llm_provider=None, dispatcher=lambda *a: None,
                    context_factory=_bola_context_factory, tool_executor=_bola_executor(gateway_calls),
                    tool_schemas=[{"type": "function", "function": {"name": "mp_charge"}}], engine_mode="react")

    # tool_call HOSTIL: el LLM pide accionar con la identidad/recursos de B, en una sesion cuyo conv es de A
    # -- el "ataque" viaja en `arguments` (lo que el atacante SI puede influenciar via el chat/LLM), nunca
    # en `conv` (eso lo arma el motor desde la config de arranque de la sesion, fuera del alcance del chat).
    hostile_arguments = {"amount": 5000, "cliente_id": "clienteB", "composio_user_id": "comp_clienteB",
                        "to_account": "cuenta-de-B"}
    payload = {"domain": "d_bola", "name": "mp_charge", "arguments": hostile_arguments,
              "conv": {"cliente_id": "clienteA", "channel": "web", "channel_ref": "s1"},
              "confirmed": True, "idem_key": "k-1"}
    out = asyncio.run(A.execute_tool(payload))

    assert out["status"] == "ok"
    assert len(gateway_calls) == 1
    # el gateway SIEMPRE actuo como A -- el campo de identidad embebido en `arguments` (B) fue ignorado
    assert gateway_calls[0]["user_id"] == "comp_clienteA"
    assert gateway_calls[0]["user_id"] != "comp_clienteB"
    # los datos hostiles SI llegan al executor (arguments es del dominio, ej. 'amount') -- lo que NO puede
    # pasar es que un campo de identidad ahi determine CONTRA QUIEN se ejecuta la accion
    assert gateway_calls[0]["arguments"]["cliente_id"] == "clienteB"       # el dato viajo tal cual...
    assert gateway_calls[0]["user_id"] == "comp_clienteA"                 # ...pero jamas gano la identidad


# ═══════════════════════════════ 3) PROVENANCE del confirmed=True ═══════════════════════════════

@pytest.mark.asyncio
async def test_confirmed_true_only_ever_produced_by_the_gate_callback():
    """CASO HOSTIL: se abre un gate (write sin confirmar) y se intenta, de DOS formas hostiles, forzar la
    ejecucion CONFIRMADA sin pasar por el callback humano real:
      (a) mandar el TOKEN real del gate como TEXTO LIBRE (`kind='text'`, no `'callback'`) -- alguien que
          adivino/copio el string del boton pero no lo toco en la card real (`kind` lo pone el canal/adapter
          al procesar el click, nunca texto libre del usuario).
      (b) mandar un callback (`kind='callback'`) con `action='confirm'` pero un TOKEN equivocado (spoofing
          de una card vieja/ajena).
    Ninguno de los dos ejecuta el write con confirmed=True. Recien el callback CORRECTO (kind='callback' +
    token del gate VIGENTE) lo hace -- prueba que el mecanismo funciona (no es un false-negative por un
    execute_tool roto) y que ese es el UNICO camino a confirmed=True.
    """
    def exec_fn(p):
        st = "ok" if p["confirmed"] else "needs_confirmation"
        return ToolResult(tool_call_id=p["idem_key"], is_write=True, status=st,
                          observation={"preview": "cobro $5000"}).to_dict()

    tq = "prov1"
    async with await WorkflowEnvironment.start_time_skipping() as env:
        w, calls = _script_worker(env, tq, llm_script=[
            _tc("mp_charge", {"amount": 5000}),           # abre gate1
            _TEXT("no entendí ese mensaje"),               # cierra el turno "supersede" (ataque a)
            _tc("mp_charge", {"amount": 5000}),           # reabre el gate (gate2, tras el ataque a)
            _TEXT("Listo, cobrado."),                       # cierra tras el confirm CORRECTO
        ], exec_fn=exec_fn)
        async with w:
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id=tq, task_queue=tq)
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobrá 5000", "kind": "text"})
            await env.sleep(1)
            real_token = _choice_value(calls["sent"][-1], "Confirmar").partition(":")[2]   # "turn_ix:step"

            # (a) HOSTIL: el token real del gate1, pero como TEXTO LIBRE (kind='text'), NO via el boton/callback
            await h.signal(ConversationWorkflow.receive_message,
                           {"text": f"confirm:{real_token}", "kind": "text"})
            await env.sleep(1)
            assert all(not c["confirmed"] for c in calls["exec"])          # SIGUE sin ejecutar confirmado
            st = await h.query(ConversationWorkflow.state)
            # un turno de TEXTO con gate abierto lo SUPERSEDE (major #5): la card vieja queda inerte, jamas
            # se re-dispara el write que abandono -- adivinar el token como texto no alcanza para ejecutar.
            assert not st["conversation_state"].get("react")

            # rearmamos el gate (mismo ataque de fondo, turno nuevo): se vuelve a pedir el cobro
            await h.signal(ConversationWorkflow.receive_message, {"text": "cobrá 5000 de nuevo", "kind": "text"})
            await env.sleep(1)

            # (b) HOSTIL: callback real (kind='callback') pero con un TOKEN equivocado (spoofing de otra card)
            n_before = len(calls["exec"])
            await h.signal(ConversationWorkflow.receive_message, {"text": "confirm:999:999", "kind": "callback"})
            await env.sleep(1)
            assert len(calls["exec"]) == n_before                          # no-op fail-closed: ni se re-invoco
            assert all(not c["confirmed"] for c in calls["exec"])          # y jamas con confirmed=True

            # CONTROL: el callback CORRECTO (kind='callback' + token del gate VIGENTE) -- prueba que el
            # mecanismo SI funciona (el fallo de (a)/(b) no es un execute_tool roto) y que este es el UNICO
            # camino a confirmed=True.
            tok_ok = _choice_value(calls["sent"][-1], "Confirmar")
            await h.signal(ConversationWorkflow.receive_message, {"text": tok_ok, "kind": "callback"})
            await env.sleep(1)
            await h.signal(ConversationWorkflow.close)
            await h.result()

    confirmed = [c for c in calls["exec"] if c["confirmed"]]
    assert len(confirmed) == 1                                             # confirmed=True: EXACTAMENTE 1 vez
    assert confirmed[0]["name"] == "mp_charge"

    # defensa estatica adicional: en TODO el motor, el literal `"confirmed": True` aparece en UN SOLO lugar
    # del codigo-fuente -- el brazo `action == 'confirm'` del callback (linea ~355). Un 2do lugar seria una
    # via de escape no auditada para producir un write confirmado sin pasar por el gate humano.
    src = inspect.getsource(CW)
    assert src.count('"confirmed": True') == 1
