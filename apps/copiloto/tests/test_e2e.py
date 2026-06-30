"""Gate E2E del walking skeleton de B (regla 9). Corre EN EL VPS (temporalio + DB fusion).

Determinista: el LLM es un guión (el shape validado en test_llm_openai). TODO lo demás es real: ConversationWorkflow
durable, el dispatcher de B, el ComposioGateway. Observa OUTPUTS (filas en copiloto_web_replies + evento en Calendar
read-back), nunca handle.query()."""
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

from calendar_policy import CALENDAR_POLICY, FIND_EVENT_SLUG
from dispatcher_emprendedor import make_dispatcher
from reply_store import make_pg_reply_sink, read_replies

_ACTIVITIES = [call_llm, dispatch_intent, send_channel_message, notify_staff]
_E2E_TITLE = "Reunión con Juan"   # título sintético del evento; compartido por el LLM scripted, read-back y cleanup


def _events(obj, want, acc):
    """Eventos {id, start} cuyo summary == want, recorriendo el shape anidado de FIND. Se comparan summaries
    extraídos (NO un substring sobre json.dumps: ensure_ascii escaparía el acento de «Reunión»)."""
    if isinstance(obj, dict):
        if obj.get("summary") == want and obj.get("id"):
            acc.append({"id": obj["id"], "start": obj.get("start")})
        for v in obj.values():
            _events(v, want, acc)
    elif isinstance(obj, list):
        for v in obj:
            _events(v, want, acc)
    return acc

pytestmark = pytest.mark.skipif(
    not (os.environ.get("DATABASE_URL") and os.environ.get("COPILOTO_CLIENTE_ID")
         and os.environ.get("COPILOTO_COMPOSIO_USER_ID")),
    reason="E2E requiere VPS: DATABASE_URL + COPILOTO_CLIENTE_ID + COPILOTO_COMPOSIO_USER_ID")


class _ScriptedLlm:
    """Guión: 'agendá…' -> book; (la confirmación es un botón -> kind='callback', no pasa por acá)."""
    def complete(self, system, user, *, history=None):
        u = (user or "").lower()
        if "agend" in u or "reun" in u:
            parsed = {"action": "book",
                      "entities": {"title": _E2E_TITLE, "date_raw": "jueves", "time_raw": "15"},
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
async def test_e2e_agenda_evento():
    cliente_id = os.environ["COPILOTO_CLIENTE_ID"]
    composio_user = os.environ["COPILOTO_COMPOSIO_USER_ID"]
    db_url = os.environ["DATABASE_URL"]

    def conn_factory():
        c = psycopg2.connect(db_url); c.autocommit = True; return c

    reset_registry()
    gateway = ComposioGateway(CALENDAR_POLICY)
    sink = make_pg_reply_sink(conn_factory, cliente_id)
    register_channel("web", WebChannelAdapter(reply_sink=sink))
    register_domain("emprendedor", system_prompt="(scripted)", llm_provider=_ScriptedLlm(),
                    dispatcher=make_dispatcher(gateway, composio_user_id=composio_user,
                                               now_iso_provider=lambda: "2026-07-01T10:00:00-03:00"))
    router_adapter = WebChannelAdapter(reply_sink=sink)

    client = await Client.connect(os.environ.get("TEMPORAL_TARGET", "localhost:7233"),
                                  namespace=os.environ.get("TEMPORAL_NAMESPACE", "default"))
    rid = uuid.uuid4().hex[:8]
    tq = f"agent-emprendedor-e2e-{rid}"
    session = f"e2e-{rid}"
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
            await _route("agendá una reunión con Juan el jueves a las 15")
            await _wait_until(lambda: any("confirmás" in r["reply_text"].lower() for r in _replies()),
                              "propuesta de agendar")
            assert "confirm" in str(_replies()[-1]["choices"]).lower()           # propuso + botones

            await _route("confirm", kind="callback")                              # botón Confirmar

            # confirmación REAL del CREATE: el dispatcher responde "Listo, lo agendé ✅" SOLO si Composio
            # devolvió successful=True. NO buscar "agend" — matchea la propuesta "Voy a agendar".
            def _confirmado():
                for r in _replies():
                    t = r["reply_text"].lower()
                    if "no pude" in t:
                        raise AssertionError(f"el CREATE falló según el dispatcher: {r['reply_text']!r}")
                    if "✅" in r["reply_text"] or "lo agendé" in t:
                        return True
                return False
            await _wait_until(_confirmado, "confirmación de evento creado (✅)")

            # read-back INDEPENDIENTE: el evento aparece en Calendar. FIND por rango con single_events +
            # order_by (la variante que lista de forma confiable un evento futuro). Se comparan los summaries
            # extraídos, NO un substring sobre json.dumps (ensure_ascii escaparía el acento de «Reunión»).
            gw = ComposioGateway(CALENDAR_POLICY)

            def _find_events():
                res = gw.execute(FIND_EVENT_SLUG, user_id=composio_user,
                                 arguments={"time_min": "2026-07-01T00:00:00-03:00",
                                            "time_max": "2026-07-31T00:00:00-03:00",
                                            "single_events": True, "order_by": "startTime",
                                            "max_results": 50},
                                 confirmed=False)
                assert res.get("successful", True), f"FIND falló: {res}"
                return _events(res, _E2E_TITLE, [])

            await _wait_until(lambda: len(_find_events()) > 0, f"evento «{_E2E_TITLE}» visible en Calendar")
            # el evento quedó a la hora LOCAL pedida (15:00 -03:00), no a la UTC (regresión review #1: el gate
            # debe verificar la SEMÁNTICA de tiempo, no solo que exista una fila con ese summary).
            starts = [str(e["start"]) for e in _find_events()]
            assert any("15:00:00-03:00" in s for s in starts), f"el evento no quedó a las 15:00 AR: {starts}"
        print("\nAGENT_B_E2E: PASS")
    finally:
        for wfid in created:
            try:
                await client.get_workflow_handle(wfid).terminate()
            except Exception:  # noqa: BLE001
                pass
        # cleanup datos sintéticos del run (replies en DB)
        with conn_factory().cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_web_replies WHERE session_id = %s", (session,))
        # cleanup del evento sintético en Calendar (gate idempotente — no acumular en re-runs). DELETE está
        # fuera de la policy del producto (fail-closed); se usa el SDK directo, solo como teardown de test.
        try:
            from composio import Composio
            raw = Composio()
            version = CALENDAR_POLICY["googlecalendar"].version
            res = raw.tools.execute(FIND_EVENT_SLUG, user_id=composio_user,
                                    arguments={"time_min": "2026-07-01T00:00:00-03:00",
                                               "time_max": "2026-07-31T00:00:00-03:00",
                                               "single_events": True, "order_by": "startTime",
                                               "max_results": 50}, version=version)
            for ev in _events(res, _E2E_TITLE, []):
                raw.tools.execute("GOOGLECALENDAR_DELETE_EVENT", user_id=composio_user,
                                  arguments={"event_id": ev["id"], "calendar_id": "primary"}, version=version)
        except Exception:  # noqa: BLE001 — cleanup best-effort, no debe romper el gate
            pass
