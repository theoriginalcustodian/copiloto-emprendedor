"""E2E del circuito durable completo con action='tool_action' (genérico a TODOS los servicios plug-in).

Mensaje del usuario -> ConversationWorkflow durable -> call_llm -> dispatch_intent -> dispatcher (branch
tool_action) -> confirm-gate (botón) -> ejecuta la tool REAL vía ComposioGateway. Se prueba con Gmail (send
real + read-back); el circuito es idéntico para cualquier servicio que use tool_action, así que probarlo una
vez cubre a todos. Corre EN EL VPS (temporalio + DB fusion + Composio). Determinista: el LLM es un guión."""
import asyncio
import os
import sys
import uuid
from pathlib import Path

ARCH = Path(__file__).resolve().parents[3] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg2
import pytest
from temporalio.client import Client
from temporalio.worker import Worker

from backend.agent.agent_activities import call_llm, dispatch_intent, notify_staff, send_channel_message
from backend.agent.agent_runtime import register_channel, register_domain, reset_registry
from backend.agent.conversation_workflow import ConversationWorkflow
from backend.agent.inbound_router import route_inbound
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.composio_gateway import ComposioGateway

import services
from _ctx_helper import make_ctx as _ctx
from dispatcher_emprendedor import make_dispatcher
from reply_store import make_pg_reply_sink, read_replies
from services.gmail import FETCH_SLUG

_ACTIVITIES = [call_llm, dispatch_intent, send_channel_message, notify_staff]
_RID = uuid.uuid4().hex[:8]
_SUBJECT = f"Copiloto tool_action {_RID}"

pytestmark = pytest.mark.skipif(
    not (os.environ.get("DATABASE_URL") and os.environ.get("COPILOTO_CLIENTE_ID")
         and os.environ.get("COPILOTO_COMPOSIO_USER_ID")),
    reason="E2E requiere VPS: DATABASE_URL + COPILOTO_CLIENTE_ID + COPILOTO_COMPOSIO_USER_ID")


class _ScriptedLlm:
    """Guión: 'mail/correo' -> tool_action gmail.send; la confirmación llega como botón (kind='callback')."""
    def complete(self, system, user, *, history=None):
        u = (user or "").lower()
        if "mail" in u or "correo" in u:
            to = os.environ.get("COPILOTO_TEST_EMAIL", "341lin@gmail.com")
            parsed = {"action": "tool_action",
                      "entities": {"service": "gmail", "op": "send", "to": to,
                                   "subject": _SUBJECT, "body": "E2E tool_action del Copiloto."},
                      "reply_es": "Dale"}
        else:
            parsed = {"action": "ask_info", "entities": {}, "reply_es": "Contame más."}
        return {"parsed": parsed, "raw": "", "model": "scripted", "failed_over": False}


async def _wait_until(pred, label, tries=40, delay=1.0):
    for _ in range(tries):
        try:
            if pred():
                return
        except Exception:  # noqa: BLE001
            pass
        await asyncio.sleep(delay)
    raise AssertionError(f"timeout esperando: {label}")


@pytest.mark.asyncio
async def test_e2e_tool_action_gmail_send():
    cliente_id = os.environ["COPILOTO_CLIENTE_ID"]
    composio_user = os.environ["COPILOTO_COMPOSIO_USER_ID"]
    db_url = os.environ["DATABASE_URL"]

    def conn_factory():
        c = psycopg2.connect(db_url); c.autocommit = True; return c

    reset_registry()
    gw = ComposioGateway(services.merged_policy())
    sink = make_pg_reply_sink(conn_factory)
    register_channel("web", WebChannelAdapter(reply_sink=sink))
    register_domain("emprendedor", system_prompt="(scripted)", llm_provider=_ScriptedLlm(),
                    dispatcher=make_dispatcher(gw, now_iso_provider=lambda: "2026-07-02T10:00:00-03:00"),
                    context_factory=lambda conv: _ctx(composio_user_id=composio_user,
                                                      cliente_id=conv.get("cliente_id", cliente_id)))
    router_adapter = WebChannelAdapter(reply_sink=sink)

    client = await Client.connect(os.environ.get("TEMPORAL_TARGET", "127.0.0.1:7233"),
                                  namespace=os.environ.get("TEMPORAL_NAMESPACE", "default"))
    rid = uuid.uuid4().hex[:8]
    tq = f"agent-emprendedor-ta-{rid}"
    session = f"ta-{rid}"
    created: list[str] = []

    async def _route(text, kind="text"):
        wf = await route_inbound(client, adapter=router_adapter, cliente_id=cliente_id, domain="emprendedor",
                                 task_queue=tq, raw_update={"session_id": session, "text": text, "kind": kind})
        if wf and wf not in created:
            created.append(wf)
        return wf

    def _replies():
        return read_replies(conn_factory, cliente_id, session, after_id=0)

    try:
        async with Worker(client, task_queue=tq, workflows=[ConversationWorkflow], activities=_ACTIVITIES):
            await _route("mandá un mail de prueba")
            await _wait_until(lambda: any("confirmás" in r["reply_text"].lower() for r in _replies()),
                              "propuesta de enviar mail")
            assert "confirm" in str(_replies()[-1]["choices"]).lower()
            hitl = next(r for r in _replies() if "confirmás" in r["reply_text"].lower())
            assert hitl["card"] == {"service": "gmail", "label": "Gmail"}   # cartel HITL con la app real (no "AGENDA"),
            #                                                                 path completo dispatcher→sink→DB→read

            await _route("confirm", kind="callback")

            def _enviado():
                for r in _replies():
                    t = r["reply_text"].lower()
                    if "no pude" in t:
                        raise AssertionError(f"el SEND falló según el dispatcher: {r['reply_text']!r}")
                    if "✅" in r["reply_text"] or "envié" in t:
                        return True
                return False
            await _wait_until(_enviado, "confirmación de mail enviado (✅)")

            gw2 = ComposioGateway(services.merged_policy())

            def _visible():
                rd = gw2.execute(FETCH_SLUG, user_id=composio_user,
                                 arguments={"query": f'subject:"{_SUBJECT}"', "max_results": 5}, confirmed=False)
                return _RID in str(rd)
            await _wait_until(_visible, f"mail «{_SUBJECT}» visible en la cuenta")
        print("\nAGENT_B_TOOL_ACTION_E2E: PASS")
    finally:
        for wfid in created:
            try:
                await client.get_workflow_handle(wfid).terminate()
            except Exception:  # noqa: BLE001
                pass
        with conn_factory().cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_web_replies WHERE session_id = %s", (session,))
