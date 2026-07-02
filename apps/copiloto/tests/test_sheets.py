"""Sheets — unit (ruteo) + E2E REAL (crea planilla scratch → escribe fila → lee). Corre EN EL VPS.

El create de la planilla scratch usa el raw client (fuera de la policy del producto: es scaffolding de test)."""
import os
import re
import sys
import time
import uuid
from pathlib import Path

ARCH = Path(__file__).resolve().parents[3] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from backend.agent.types import Intent
import dispatcher_emprendedor as de
from services.sheets import WRITE_SLUG, READ_SLUG, SHEETS_VERSION, build


class _GatewaySpy:
    def __init__(self, ret=None):
        self.calls = []
        self._ret = ret or {"successful": True, "data": {}}

    def execute(self, slug, *, user_id, arguments, confirmed):
        self.calls.append({"slug": slug, "arguments": arguments, "confirmed": confirmed})
        return self._ret


def _disp(gw):
    return de.make_dispatcher(gw, composio_user_id="u1", now_iso_provider=lambda: "2026-07-02T10:00:00-03:00")


def test_append_row_propone():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "sheets", "op": "append_row",
                  "spreadsheet_id": "sid1", "values": ["a", "b"]}), {}, None)
    assert gw.calls == []
    p = r.state_patch["pending"]
    assert p["slug"] == WRITE_SLUG
    assert p["arguments"]["spreadsheet_id"] == "sid1" and p["arguments"]["values"] == [["a", "b"]]


def test_read_range_es_lectura_directa():
    gw = _GatewaySpy(ret={"successful": True, "data": {"valueRanges": []}})
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "sheets", "op": "read_range", "spreadsheet_id": "sid1"}), {}, None)
    assert gw.calls[0]["slug"] == READ_SLUG and gw.calls[0]["confirmed"] is False
    assert r.reply_text


@pytest.mark.skipif(not (os.environ.get("COMPOSIO_API_KEY") and os.environ.get("COPILOTO_COMPOSIO_USER_ID")),
                    reason="real: requiere COMPOSIO_API_KEY + COPILOTO_COMPOSIO_USER_ID (VPS)")
def test_write_read_real():
    sys.path.insert(0, str(ARCH / "clients/agent/providers"))
    from composio_gateway import ComposioGateway
    from composio import Composio
    import services
    user = os.environ["COPILOTO_COMPOSIO_USER_ID"]
    gw = ComposioGateway(services.merged_policy())
    raw = Composio()
    rid = uuid.uuid4().hex[:8]

    # scratch spreadsheet (scaffolding: raw client, fuera de la policy del producto)
    created = raw.tools.execute("GOOGLESHEETS_CREATE_GOOGLE_SHEET1", user_id=user,
                                arguments={"title": f"Copiloto E2E {rid}"}, version=SHEETS_VERSION)
    m = re.search(r"[\"']spreadsheet_?[iI]d[\"']\s*:\s*[\"']([A-Za-z0-9_\-]{20,})[\"']", str(created))
    assert m, f"no pude extraer spreadsheet_id del create: {str(created)[:400]}"
    sid = m.group(1)

    prop = build("append_row", {"spreadsheet_id": sid, "values": ["Copiloto", rid]})
    res = gw.execute(prop.slug, user_id=user, arguments=prop.arguments, confirmed=True)
    assert res.get("successful") is True, f"BATCH_UPDATE falló: {res}"

    found = False
    for _ in range(15):
        rd = gw.execute(READ_SLUG, user_id=user, arguments={"spreadsheet_id": sid, "ranges": ["A1:D5"]}, confirmed=False)
        if rid in str(rd):
            found = True
            break
        time.sleep(1)
    assert found, f"no leí el marcador {rid} en la planilla {sid}"

    # cleanup best-effort: borrar la planilla scratch (es un archivo de Drive)
    try:
        raw.tools.execute("GOOGLEDRIVE_DELETE_FILE", user_id=user, arguments={"file_id": sid}, version="20260629_00")
    except Exception:  # noqa: BLE001
        pass
