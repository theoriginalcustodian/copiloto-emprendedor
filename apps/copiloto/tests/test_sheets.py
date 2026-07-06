"""Sheets — unit (ruteo + resolución de pestaña) + E2E REAL a través del dispatcher. Corre EN EL VPS.

El E2E ejercita el flujo completo del agente (propose -> confirm) incluyendo el pre-paso `resolve` que ubica
la 1ra pestaña real (locale-agnóstico): siembra 2 filas (update A1) -> appendea una 3ra -> verifica que quedó
DESPUÉS sin pisar -> actualiza una celda puntual (B1) -> verifica que cambió sin tocar el resto. El create/
delete de la planilla scratch usa el raw client (scaffolding, fuera de la policy)."""
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
from services.sheets import APPEND_SLUG, UPDATE_SLUG, READ_SLUG, SHEET_NAMES_SLUG, SHEETS_VERSION


class _GatewaySpy:
    def __init__(self, ret=None):
        self.calls = []
        self._ret = ret or {"successful": True, "data": {}}

    def execute(self, slug, *, user_id, arguments, confirmed):
        self.calls.append({"slug": slug, "arguments": arguments, "confirmed": confirmed})
        return self._ret


def _disp(gw):
    return de.make_dispatcher(gw, now_iso_provider=lambda: "2026-07-02T10:00:00-03:00")


# ── unit: ruteo + casing + resolución de pestaña ─────────────────────────────
def test_append_sin_pestania_resuelve_primera():
    """append sin sheet_name propone APPEND (camelCase) + resolve que ubica la 1ra hoja en el arg `range`."""
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "sheets", "op": "append_row",
                  "spreadsheet_id": "sid1", "values": ["a", "b"]}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls == []                       # no ejecuta: propone
    p = r.state_patch["pending"]
    assert p["slug"] == APPEND_SLUG
    args = p["arguments"]
    assert args["spreadsheetId"] == "sid1" and args["values"] == [["a", "b"]]
    assert args["valueInputOption"] == "USER_ENTERED"
    assert "spreadsheet_id" not in args         # sin claves snake_case del otro slug (no mezclar casing)
    rslv = p["resolve"]
    assert rslv["slug"] == SHEET_NAMES_SLUG and rslv["into"] == "range" and rslv["path"] == ["data", "sheet_names", 0]


def test_append_con_pestania_no_resuelve():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "sheets", "op": "append_row",
                  "spreadsheet_id": "sid1", "values": ["a"], "sheet_name": "Ventas"}), {}, _ctx(composio_user_id="u1"))
    p = r.state_patch["pending"]
    assert p["arguments"]["range"] == "Ventas" and p.get("resolve") is None


def test_update_range_targetea_celda_y_resuelve_pestania():
    """update sin sheet_name propone BATCH_UPDATE (snake_case) con la celda destino + resolve en `sheet_name`."""
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "sheets", "op": "update_range",
                  "spreadsheet_id": "sid1", "cell": "B3", "values": ["x"]}), {}, _ctx(composio_user_id="u1"))
    p = r.state_patch["pending"]
    assert p["slug"] == UPDATE_SLUG
    args = p["arguments"]
    assert args["spreadsheet_id"] == "sid1" and args["first_cell_location"] == "B3"
    assert args["values"] == [["x"]] and args["value_input_option"] == "USER_ENTERED"
    assert p["resolve"]["into"] == "sheet_name"


def test_update_range_default_a1_y_pestania_explicita():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "sheets", "op": "update_range",
                  "spreadsheet_id": "sid1", "values": ["x"], "sheet_name": "Datos"}), {}, _ctx(composio_user_id="u1"))
    p = r.state_patch["pending"]
    assert p["arguments"]["first_cell_location"] == "A1"       # default cuando no se da celda
    assert p["arguments"]["sheet_name"] == "Datos" and p.get("resolve") is None


def test_read_range_es_lectura_directa():
    gw = _GatewaySpy(ret={"successful": True, "data": {"valueRanges": []}})
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "sheets", "op": "read_range", "spreadsheet_id": "sid1"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls[0]["slug"] == READ_SLUG and gw.calls[0]["confirmed"] is False
    assert r.reply_text


def test_confirm_ejecuta_resolve_antes_del_write():
    """El confirm-gate ejecuta el read de resolve (confirmed=False) e inyecta el valor antes del write (confirmed=True)."""
    gw = _GatewaySpy(ret={"successful": True, "data": {"sheet_names": ["Hoja 1"]}})
    disp = _disp(gw)
    prop = disp(Intent(action="tool_action", entities={"service": "sheets", "op": "append_row",
                "spreadsheet_id": "sid1", "values": ["a"]}), {}, _ctx(composio_user_id="u1"))
    pending = prop.state_patch["pending"]
    r = disp(Intent(action="confirm_pending", entities={}), {"pending": pending}, _ctx(composio_user_id="u1"))
    assert r.done is True
    # 1er call = resolve (read GET_SHEET_NAMES, confirmed=False); 2do = append con range inyectado (confirmed=True)
    assert gw.calls[0]["slug"] == SHEET_NAMES_SLUG and gw.calls[0]["confirmed"] is False
    assert gw.calls[1]["slug"] == APPEND_SLUG and gw.calls[1]["confirmed"] is True
    assert gw.calls[1]["arguments"]["range"] == "Hoja 1"


# ── E2E real (VPS) ───────────────────────────────────────────────────────────
@pytest.mark.skipif(not (os.environ.get("COMPOSIO_API_KEY") and os.environ.get("COPILOTO_COMPOSIO_USER_ID")),
                    reason="real: requiere COMPOSIO_API_KEY + COPILOTO_COMPOSIO_USER_ID (VPS)")
def test_append_no_pisa_y_update_puntual_real():
    from composio_gateway import ComposioGateway
    from composio import Composio
    import services
    user = os.environ["COPILOTO_COMPOSIO_USER_ID"]
    gw = ComposioGateway(services.merged_policy())
    disp = de.make_dispatcher(gw, now_iso_provider=lambda: "2026-07-02T10:00:00-03:00")
    raw = Composio()
    rid = uuid.uuid4().hex[:8]

    # scratch spreadsheet (scaffolding: raw client, fuera de la policy del producto)
    created = raw.tools.execute("GOOGLESHEETS_CREATE_GOOGLE_SHEET1", user_id=user,
                                arguments={"title": f"Copiloto E2E {rid}"}, version=SHEETS_VERSION)
    m = re.search(r"[\"']spreadsheet_?[iI]d[\"']\s*:\s*[\"']([A-Za-z0-9_\-]{20,})[\"']", str(created))
    assert m, f"no pude extraer spreadsheet_id del create: {str(created)[:400]}"
    sid = m.group(1)

    def _agent(op, ent):
        """Simula el flujo del agente: propone (tool_action) y confirma (confirm_pending). SIN sheet_name
        -> ejercita el resolve real de la 1ra pestaña. Falla si el write no cerró done=True."""
        prop = disp(Intent(action="tool_action", entities={"service": "sheets", "op": op, "spreadsheet_id": sid, **ent}), {}, _ctx(composio_user_id=user))
        pending = prop.state_patch["pending"]
        r = disp(Intent(action="confirm_pending", entities={}), {"pending": pending}, _ctx(composio_user_id=user))
        assert r.done is True, f"{op} no cerró OK: {r.reply_text}"

    def _read(rng):
        return gw.execute(READ_SLUG, user_id=user, arguments={"spreadsheet_id": sid, "ranges": [rng]}, confirmed=False)

    _agent("update_range", {"cell": "A1", "values": [["nombre", "edad"], [f"seed-{rid}", "30"]]})  # sembrar 2 filas
    _agent("append_row", {"values": [f"appended-{rid}", "25"]})                                    # append tras el seed
    _agent("update_range", {"cell": "B1", "values": ["EDAD2"]})                                    # cambiar B1

    grid = []
    for _ in range(15):                          # Sheets propaga con latencia -> retry hasta ver el marcador
        rd = _read("A1:B3")
        if f"appended-{rid}" in str(rd):
            data = rd.get("data") or {}
            ranges = data.get("valueRanges") or data.get("value_ranges") or []
            grid = (ranges[0].get("values") if ranges and isinstance(ranges[0], dict) else []) or []
            break
        time.sleep(1)

    flat = [str(c) for row in grid for c in row]
    assert f"seed-{rid}" in flat, f"el append PISÓ la fila sembrada — grid={grid}"
    assert f"appended-{rid}" in flat, f"no encontré la fila appendeada — grid={grid}"
    seed_row = next((i for i, row in enumerate(grid) if f"seed-{rid}" in [str(c) for c in row]), -1)
    app_row = next((i for i, row in enumerate(grid) if f"appended-{rid}" in [str(c) for c in row]), -1)
    assert seed_row >= 0 and app_row > seed_row, f"el append no quedó tras el seed — grid={grid}"
    assert grid[0][0] == "nombre" and grid[0][1] == "EDAD2", f"update de B1 mal aplicado — fila1={grid[0]}"

    # cleanup best-effort
    try:
        raw.tools.execute("GOOGLEDRIVE_DELETE_FILE", user_id=user, arguments={"file_id": sid}, version="20260629_00")
    except Exception:  # noqa: BLE001
        pass
