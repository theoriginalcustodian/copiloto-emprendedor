"""Drive — unit (ruteo, sin red) + E2E REAL (crea un archivo de texto y lo encuentra). Corre EN EL VPS.

Mismo patrón-plantilla que test_gmail.py. Cleanup best-effort del archivo creado (raw client)."""
import os
import sys
import time
import uuid
from pathlib import Path

ARCH = Path(__file__).resolve().parents[3] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from backend.agent.types import Intent
from _ctx_helper import make_ctx as _ctx
import dispatcher_emprendedor as de
from services.drive import CREATE_SLUG, FIND_SLUG, DRIVE_VERSION, build


class _GatewaySpy:
    def __init__(self, ret=None):
        self.calls = []
        self._ret = ret or {"successful": True, "data": {}}

    def execute(self, slug, *, user_id, arguments, confirmed):
        self.calls.append({"slug": slug, "arguments": arguments, "confirmed": confirmed})
        return self._ret


def _disp(gw):
    return de.make_dispatcher(gw, now_iso_provider=lambda: "2026-07-02T10:00:00-03:00")


def test_create_propone_y_no_ejecuta():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "drive", "op": "create_file",
                  "name": "n.txt", "content": "hola"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls == []
    p = r.state_patch["pending"]
    assert p["slug"] == CREATE_SLUG
    assert p["arguments"] == {"file_name": "n.txt", "text_content": "hola"}
    assert {c["value"] for c in r.choices} == {"confirm", "cancel"}


def test_confirm_ejecuta_create():
    gw = _GatewaySpy()
    pending = {"slug": CREATE_SLUG, "arguments": {"file_name": "n.txt", "text_content": "x"}, "ok_text": "ok ✅"}
    r = _disp(gw)(Intent(action="callback", entities={"value": "confirm"}), {"pending": pending}, _ctx(composio_user_id="u1"))
    assert gw.calls[0]["confirmed"] is True and gw.calls[0]["slug"] == CREATE_SLUG
    assert r.done is True


def test_find_es_lectura_directa():
    gw = _GatewaySpy(ret={"successful": True, "data": {"files": []}})
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "drive", "op": "find", "name": "x"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls[0]["slug"] == FIND_SLUG and gw.calls[0]["confirmed"] is False
    assert r.reply_text


@pytest.mark.skipif(not (os.environ.get("COMPOSIO_API_KEY") and os.environ.get("COPILOTO_COMPOSIO_USER_ID")),
                    reason="real: requiere COMPOSIO_API_KEY + COPILOTO_COMPOSIO_USER_ID (VPS)")
def test_create_real_y_readback():
    sys.path.insert(0, str(ARCH / "clients/agent/providers"))
    from composio_gateway import ComposioGateway
    import services
    user = os.environ["COPILOTO_COMPOSIO_USER_ID"]
    gw = ComposioGateway(services.merged_policy())
    rid = uuid.uuid4().hex[:8]
    name = f"copiloto-e2e-{rid}.txt"

    prop = build("create_file", {"name": name, "content": f"Archivo de prueba del Copiloto {rid}"})
    res = gw.execute(prop.slug, user_id=user, arguments=prop.arguments, confirmed=True)
    assert res.get("successful") is True, f"CREATE falló: {res}"

    found = False
    for _ in range(15):
        rd = gw.execute(FIND_SLUG, user_id=user, arguments={"q": f"name contains '{name}'"}, confirmed=False)
        if name in str(rd) or rid in str(rd):
            found = True
            break
        time.sleep(1)
    assert found, f"no encontré el archivo «{name}» tras crearlo"

    # cleanup best-effort: borrar el archivo creado (raw client, DELETE fuera de la policy del producto)
    try:
        import re
        from composio import Composio
        raw = Composio()
        rd = raw.tools.execute(FIND_SLUG, user_id=user, arguments={"q": f"name contains '{name}'"}, version=DRIVE_VERSION)
        m = re.search(r"[\"']id[\"']\s*:\s*[\"']([A-Za-z0-9_\-]{10,})[\"']", str(rd))
        if m:
            raw.tools.execute("GOOGLEDRIVE_DELETE_FILE", user_id=user,
                              arguments={"file_id": m.group(1)}, version=DRIVE_VERSION)
    except Exception:  # noqa: BLE001 — cleanup best-effort, no rompe el gate
        pass
