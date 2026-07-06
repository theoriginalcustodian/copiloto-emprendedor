"""Gmail — unit (ruteo del dispatcher, sin red) + E2E REAL (envía un mail y lo lee de vuelta). Corre EN EL VPS.

PLANTILLA de test por servicio (la reusa el fan-out): 3 unit con spy + 1 real que ejercita la tool contra la
cuenta conectada (slug+args correctos + read-back). El circuito durable completo (ConversationWorkflow) se
prueba una vez para tool_action en test_e2e_tool_action.py (genérico a todos los servicios)."""
import os
import sys
import time
import uuid
from pathlib import Path


import pytest
from backend.agent.types import Intent
from _ctx_helper import make_ctx as _ctx
import dispatcher_emprendedor as de
from services.gmail import SEND_SLUG, FETCH_SLUG, build


class _GatewaySpy:
    def __init__(self, ret=None):
        self.calls = []
        self._ret = ret or {"successful": True, "data": {}}

    def execute(self, slug, *, user_id, arguments, confirmed):
        self.calls.append({"slug": slug, "arguments": arguments, "confirmed": confirmed})
        return self._ret


def _disp(gw):
    return de.make_dispatcher(gw, now_iso_provider=lambda: "2026-07-02T10:00:00-03:00")


def test_send_propone_y_no_ejecuta():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "gmail", "op": "send",
                  "to": "x@y.com", "subject": "Hola", "body": "cuerpo"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls == []                                       # HITL: no ejecuta todavía
    p = r.state_patch["pending"]
    assert p["slug"] == SEND_SLUG
    assert p["arguments"] == {"recipient_email": "x@y.com", "subject": "Hola", "body": "cuerpo"}
    assert {c["value"] for c in r.choices} == {"confirm", "cancel"}


def test_confirm_ejecuta_send_con_confirmed_true():
    gw = _GatewaySpy()
    pending = {"slug": SEND_SLUG, "arguments": {"recipient_email": "x@y.com", "subject": "H", "body": "b"},
               "ok_text": "Listo, lo envié ✅"}
    r = _disp(gw)(Intent(action="callback", entities={"value": "confirm"}), {"pending": pending}, _ctx(composio_user_id="u1"))
    assert gw.calls[0]["confirmed"] is True and gw.calls[0]["slug"] == SEND_SLUG   # doble candado
    assert r.done is True and "✅" in r.reply_text


def test_fetch_es_lectura_directa_sin_confirmar():
    gw = _GatewaySpy(ret={"successful": True, "data": {"messages": []}})
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "gmail", "op": "fetch", "query": "is:unread"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls[0]["slug"] == FETCH_SLUG and gw.calls[0]["confirmed"] is False  # read: sin HITL
    assert r.reply_text


@pytest.mark.skipif(not (os.environ.get("COMPOSIO_API_KEY") and os.environ.get("COPILOTO_COMPOSIO_USER_ID")),
                    reason="real: requiere COMPOSIO_API_KEY + COPILOTO_COMPOSIO_USER_ID (correr en el VPS)")
def test_send_real_y_readback():
    """E2E REAL: el módulo Gmail arma el call, el gateway lo ejecuta contra la cuenta, y el mail aparece."""
    from composio_gateway import ComposioGateway
    import services
    user = os.environ["COPILOTO_COMPOSIO_USER_ID"]
    to = os.environ.get("COPILOTO_TEST_EMAIL", "341lin@gmail.com")
    gw = ComposioGateway(services.merged_policy())
    rid = uuid.uuid4().hex[:8]
    subject = f"Copiloto E2E {rid}"

    prop = build("send", {"to": to, "subject": subject, "body": "Mail de prueba del Copiloto (E2E)."})
    res = gw.execute(prop.slug, user_id=user, arguments=prop.arguments, confirmed=True)
    assert res.get("successful") is True, f"SEND falló: {res}"

    found = False
    for _ in range(20):
        rd = gw.execute(FETCH_SLUG, user_id=user,
                        arguments={"query": f'subject:"{subject}"', "max_results": 5}, confirmed=False)
        if rid in str(rd):
            found = True
            break
        time.sleep(1)
    assert found, f"no encontré el mail «{subject}» en la cuenta tras enviarlo"
