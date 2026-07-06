"""E2E ReAct con LLM REAL (Task 15 del plan motor-react) — gate final del motor conversacional.

Corre EN EL VPS con OPENAI_API_KEY real (gpt-4o-mini, igual a `worker_b.build_llm()`). El motor
(ConversationWorkflow engine_mode='react') + las activities REALES del motor (call_llm_tools /
execute_tool, agent_activities.py) + el LlmProvider REAL se ejercitan end-to-end contra un
WorkflowEnvironment de Temporal. Las tools se mockean SOLO a nivel gateway (un tool_executor fake
que simula mp_charge/gmail_send con observations realistas con nonce) -- lo que se valida acá es
el MOTOR + el provider real + el gate cross-turn, NO las integraciones externas (Composio/
MercadoPago ya validadas E2E aparte: memoria `composio-gateway-ladrillo` /
`mercadopago-gateway-impl-followup`).

Fidelidad con prod (worker_b.build_worker_config): mismo `LlmProvider` (worker_b.build_llm()),
mismo system prompt (`SYSTEM_PROMPT_REACT`, react NO concatena fragments), mismo catálogo de tools
(`tool_catalog.build_tool_catalog()`, catálogo COMPLETO — no recortado) — solo el tool_executor y
el context_factory son fakes de este test.

Escenario insignia (spike A: 24/24 encadenamiento cobro+mail; spike B: gate cross-turn con LLM
real, `spikes/gate-cross-turn/`):
  1. user pide cobrar $5000 y mandar el link por mail a juan@x.com.
  2. -> gate mp_charge (needs_confirmation, card con choices Confirmar/Cancelar). NO se manda mail.
  3. callback confirm (token REAL leído de la card, nunca "confirm" pelado) -> link real (con
     nonce); el LLM encadena gmail_send con el link en el body -> 2do gate.
  4. callback confirm -> mail "enviado". El body de gmail_send contiene el init_point REAL.
  5. Escenario reject: repetir hasta el paso 2, cancel -> NO se manda mail, NO se inventa link.

Estocástico (LLM real): la estructura de asserts es determinista; la variabilidad del modelo se
evalúa corriendo el archivo N veces (sin retry embebido -- un retry silencioso enmascararía
flakiness real, ver CLAUDE.md "no codificar la esperanza").
"""
from __future__ import annotations

import asyncio
import os
import secrets
import sys
from pathlib import Path

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker


from backend.agent.agent_activities import call_llm_tools, execute_tool, recall_memory  # noqa: E402
from backend.agent.agent_runtime import register_domain, reset_registry  # noqa: E402
from backend.agent.conversation_workflow import ConversationWorkflow  # noqa: E402
from backend.agent.types import Artifact, ToolResult  # noqa: E402

import tool_catalog  # noqa: E402
import worker_b  # noqa: E402 -- reusa build_llm() REAL (== prod, gpt-4o-mini)
from system_prompt import SYSTEM_PROMPT_REACT  # noqa: E402

pytestmark = pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"),
                                reason="E2E con LLM real: requiere OPENAI_API_KEY")

_USER_MSG = "generá un link de pago de $5000 por la seña y mandáselo por mail a juan@x.com"


def _fake_gateway_executor(sent_links: list, sent_mails: list, unexpected: list):
    """Simula la CAPA GATEWAY (Composio/MercadoPago reales) — el gate needs_confirmation/confirmed
    es el MISMO invariante de prod (`tool_catalog._run_mp_charge` / el módulo `services/gmail.py`);
    lo único mockeado es la llamada de red. El link/mail llevan un nonce -> probamos que es el
    MISMO valor el que viaja al 2do tool-call, no un string hardcodeado por el test."""
    def executor(name, arguments, ctx, *, confirmed, idem_key):
        if name == "mp_charge":
            if not confirmed:
                return ToolResult(tool_call_id=idem_key, is_write=True, status="needs_confirmation",
                                  observation={"preview": f"generar link de cobro por ${arguments.get('amount')}"})
            nonce = secrets.token_hex(4)
            link = f"https://mpago.la/FAKE-{nonce}"
            sent_links.append(link)
            return ToolResult(tool_call_id=idem_key, is_write=True, status="ok",
                              observation={"result": "link de cobro listo", "init_point": link},
                              artifact=Artifact(kind="payment_link",
                                                data={"url": link, "amount": arguments.get("amount")}))
        if name == "gmail_send":
            if not confirmed:
                return ToolResult(tool_call_id=idem_key, is_write=True, status="needs_confirmation",
                                  observation={"preview": f"enviar mail a {arguments.get('to')}"})
            sent_mails.append(dict(arguments))
            return ToolResult(tool_call_id=idem_key, is_write=True, status="ok",
                              observation={"result": "mail enviado"},
                              artifact=Artifact(kind="email_draft", data={"url": "https://mail.google.com/"}))
        # cualquier otra tool del catálogo completo (calendar_book, gmail_fetch, docs_*, drive_*, sheets_*,
        # hubspot_*, instagram_*): el escenario NO la necesita -- si el modelo la invoca igual (no debería,
        # spike A midió 0/24 llamadas fuera de lo esperado), no se rompe el test: se registra como anomalía
        # y se devuelve un error de negocio (nunca una excepción -- regla PR #114 retry infinito).
        unexpected.append({"name": name, "arguments": arguments, "confirmed": confirmed})
        return ToolResult(tool_call_id=idem_key, status="error",
                          observation={"error": f"tool no disponible en este entorno de prueba: {name}"})
    return executor


def _choice_value(sent_payload: dict, label: str) -> str:
    """Extrae el `value` REAL (con el token del gate embebido, ej 'confirm:0:0') de la card que el
    workflow mandó -- nunca un literal "confirm"/"cancel": el motor lo valida contra el pending
    (`ConversationWorkflow._run_react_turn`) y un literal plano sería un no-op fail-closed."""
    return next(c["value"] for c in sent_payload["choices"] if c["label"] == label)


async def _wait_until(pred, label: str, tries: int = 60, delay: float = 1.5) -> None:
    """Poll con asyncio.sleep REAL (no `env.sleep`): las activities de este test hacen HTTP real a
    OpenAI (LlmProvider real) y tardan tiempo de pared real -- el time-skipping de Temporal no
    puede saltar mientras hay una activity en vuelo. ~90s de margen por gate (holgado)."""
    for _ in range(tries):
        if pred():
            return
        await asyncio.sleep(delay)
    raise AssertionError(f"timeout esperando: {label}")


def _register_domain(name: str) -> tuple[list, list, list]:
    """Registra el dominio con la MISMA composición que `worker_b.build_worker_config` (system
    prompt + catálogo de tools + LlmProvider reales), solo con tool_executor/context_factory fakes."""
    sent_links: list[str] = []
    sent_mails: list[dict] = []
    unexpected: list[dict] = []
    system_prompt = SYSTEM_PROMPT_REACT   # == worker_b: react NO concatena fragments (los TOOL_SCHEMAS describen las tools)
    register_domain(name, system_prompt=system_prompt, llm_provider=worker_b.build_llm(),
                    dispatcher=lambda *a, **k: None, context_factory=None, engine_mode="react",
                    tool_schemas=tool_catalog.build_tool_catalog(),   # == worker_b.py:115 (catálogo completo)
                    tool_executor=_fake_gateway_executor(sent_links, sent_mails, unexpected))
    return sent_links, sent_mails, unexpected


def _cfg(domain: str) -> dict:
    return {"domain": domain, "channel": "web", "channel_ref": "e2e-user", "cliente_id": "e2e-cliente",
            "engine_mode": "react"}


def _worker(env, tq: str, calls: list):
    @activity.defn(name="send_channel_message")
    async def fs(p):
        calls.append(p)
        return {"sent": True}

    return Worker(env.client, task_queue=tq, workflows=[ConversationWorkflow],
                  activities=[call_llm_tools, execute_tool, recall_memory, fs])


@pytest.fixture(autouse=True)
def _clean_registry():
    reset_registry()
    yield
    reset_registry()


@pytest.mark.asyncio
async def test_e2e_react_cobro_mail_confirm_real_llm():
    """Escenario insignia CONFIRM: cobro -> gate -> confirm -> link real -> el LLM encadena
    gmail_send con el link en el body -> gate -> confirm -> mail enviado. Cero mock del motor/
    provider; solo el gateway (mp_charge/gmail_send)."""
    domain = "e2e_react_confirm"
    sent_links, sent_mails, unexpected = _register_domain(domain)
    calls: list[dict] = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with _worker(env, domain, calls):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(domain),
                                                id=domain, task_queue=domain)
            await h.signal(ConversationWorkflow.receive_message, {"text": _USER_MSG, "kind": "text"})

            await _wait_until(lambda: len(calls) >= 1, "1er gate (mp_charge)")
            assert not sent_mails, f"mandó mail ANTES de confirmar el cobro: {sent_mails}"
            assert calls[0].get("choices"), f"no emitió el gate de confirmación: {calls[0]}"
            confirm1 = _choice_value(calls[0], "Confirmar")

            await h.signal(ConversationWorkflow.receive_message, {"text": confirm1, "kind": "callback"})
            await _wait_until(lambda: len(calls) >= 2, "2do gate (gmail_send, tras confirmar el cobro)")
            assert sent_links, "el cobro no se ejecutó (execute_tool confirmed=True nunca emitió link)"
            link = sent_links[0]
            assert not sent_mails, "el mail se mandó SIN esperar el 2do confirm"
            assert calls[1].get("choices"), f"no encadenó al gate de gmail_send: {calls[1]}"
            confirm2 = _choice_value(calls[1], "Confirmar")

            await h.signal(ConversationWorkflow.receive_message, {"text": confirm2, "kind": "callback"})
            await _wait_until(lambda: len(calls) >= 3, "cierre final (mail enviado)")

            await h.signal(ConversationWorkflow.close)
            await h.result()

    assert sent_mails, "el mail nunca se mandó tras el 2do confirm"
    body = sent_mails[0].get("body", "") or ""
    assert link in body, f"el link REAL no viajó al body del mail. link={link!r} body={body!r}"
    print(f"\n[EVIDENCIA confirm] gate1={calls[0]}\nlink_real={link}\ngate2={calls[1]}\n"
          f"mail_enviado={sent_mails[0]}\nfinal={calls[2]['text']!r}\nunexpected_tools={unexpected}")


@pytest.mark.asyncio
async def test_e2e_react_cobro_mail_reject_no_inventa_link():
    """Escenario REJECT: cancel del gate mp_charge -> corte determinístico (tool_choice='none').
    NUNCA manda mail, NUNCA ejecuta el cobro, NUNCA inventa un link en el texto final."""
    domain = "e2e_react_reject"
    sent_links, sent_mails, unexpected = _register_domain(domain)
    calls: list[dict] = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with _worker(env, domain, calls):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(domain),
                                                id=domain, task_queue=domain)
            await h.signal(ConversationWorkflow.receive_message, {"text": _USER_MSG, "kind": "text"})

            await _wait_until(lambda: len(calls) >= 1, "gate (mp_charge)")
            assert calls[0].get("choices"), f"no emitió el gate de confirmación: {calls[0]}"
            cancel = _choice_value(calls[0], "Cancelar")

            await h.signal(ConversationWorkflow.receive_message, {"text": cancel, "kind": "callback"})
            await _wait_until(lambda: len(calls) >= 2, "corte tras el cancel (texto final)")

            await h.signal(ConversationWorkflow.close)
            await h.result()

    assert not sent_links, f"generó un link de cobro pese al cancel: {sent_links}"
    assert not sent_mails, f"mandó un mail pese al cancel: {sent_mails}"
    final_text = calls[1]["text"]
    assert "http://" not in final_text and "https://" not in final_text, (
        f"inventó una URL en el texto final tras el cancel: {final_text!r}")
    print(f"\n[EVIDENCIA reject] gate={calls[0]}\nfinal={final_text!r}\n"
          f"sent_links={sent_links} sent_mails={sent_mails} unexpected_tools={unexpected}")
