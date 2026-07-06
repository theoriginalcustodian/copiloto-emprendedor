"""HubSpot — unit (ruteo) + E2E REAL (crea un contacto y lo busca). Corre EN EL VPS. Cleanup best-effort (archive)."""
import os
import re
import sys
import time
import uuid
from pathlib import Path


import pytest
from backend.agent.types import Intent
from _ctx_helper import make_ctx as _ctx
import dispatcher_emprendedor as de
from services.hubspot import CREATE_SLUG, SEARCH_SLUG, HUBSPOT_VERSION, build


class _GatewaySpy:
    def __init__(self, ret=None):
        self.calls = []
        self._ret = ret or {"successful": True, "data": {}}

    def execute(self, slug, *, user_id, arguments, confirmed):
        self.calls.append({"slug": slug, "arguments": arguments, "confirmed": confirmed})
        return self._ret


def _disp(gw):
    return de.make_dispatcher(gw, now_iso_provider=lambda: "2026-07-02T10:00:00-03:00")


def test_create_contact_propone():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "hubspot", "op": "create_contact",
                  "email": "a@b.com", "firstname": "Ana"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls == []
    p = r.state_patch["pending"]
    assert p["slug"] == CREATE_SLUG and p["arguments"]["email"] == "a@b.com" and p["arguments"]["firstname"] == "Ana"


def test_search_es_lectura_directa():
    gw = _GatewaySpy(ret={"successful": True, "data": {"results": []}})
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "hubspot", "op": "search_contact", "query": "a@b.com"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls[0]["slug"] == SEARCH_SLUG and gw.calls[0]["confirmed"] is False
    assert r.reply_text


@pytest.mark.skipif(not (os.environ.get("COMPOSIO_API_KEY") and os.environ.get("COPILOTO_COMPOSIO_USER_ID")),
                    reason="real: requiere COMPOSIO_API_KEY + COPILOTO_COMPOSIO_USER_ID (VPS)")
def test_create_contact_real_y_readback():
    from composio_gateway import ComposioGateway
    import services
    user = os.environ["COPILOTO_COMPOSIO_USER_ID"]
    gw = ComposioGateway(services.merged_policy())
    rid = uuid.uuid4().hex[:8]
    email = f"copiloto.e2e.{rid}@example.com"

    prop = build("create_contact", {"email": email, "firstname": "Copiloto", "lastname": f"E2E {rid}"})
    res = gw.execute(prop.slug, user_id=user, arguments=prop.arguments, confirmed=True)
    assert res.get("successful") is True, f"CREATE_CONTACT falló: {res}"

    found = False
    for _ in range(15):
        rd = gw.execute(SEARCH_SLUG, user_id=user, arguments={"query": email, "limit": 5}, confirmed=False)
        if email in str(rd) or rid in str(rd):
            found = True
            break
        time.sleep(1)
    assert found, f"no encontré el contacto {email} tras crearlo"

    # cleanup best-effort: archivar el contacto de prueba
    try:
        from composio import Composio
        raw = Composio()
        m = re.search(r"[\"']id[\"']\s*:\s*[\"']?(\d{5,})[\"']?", str(res))
        if m:
            raw.tools.execute("HUBSPOT_ARCHIVE_CONTACT", user_id=user,
                              arguments={"contact_id": m.group(1)}, version=HUBSPOT_VERSION)
    except Exception:  # noqa: BLE001
        pass
