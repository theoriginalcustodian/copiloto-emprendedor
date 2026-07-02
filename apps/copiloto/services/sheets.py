"""Servicio Google Sheets: escribir fila (write, HITL) + leer rango (read). Toolkit 'googlesheets'.

Policy MÍNIMA: BATCH_UPDATE + BATCH_GET (2 de 53). Shapes confirmados (2026-07-02):
BATCH_UPDATE(spreadsheet_id, sheet_name, values[2D]) · BATCH_GET(spreadsheet_id, ranges).

DEUDA GESTIONADA (propietario: sprint copiloto · pago: cuando entre 'append a planilla poblada'): 'append_row'
escribe desde first_cell_location (A1 por default) vía BATCH_UPDATE; para APPEND real a la próxima fila vacía de
una planilla poblada, migrar a GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND. Suficiente para el MVP (escribir/leer real)."""
from __future__ import annotations

import sys
from pathlib import Path

_REF = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(_REF))
from clients.agent.providers.composio_gateway import ToolkitPolicy  # noqa: E402

from services.base import Proposal, Read  # noqa: E402

TOOLKIT = "googlesheets"
SHEETS_VERSION = "20260623_00"
WRITE_SLUG = "GOOGLESHEETS_BATCH_UPDATE"
READ_SLUG = "GOOGLESHEETS_BATCH_GET"
POLICY = ToolkitPolicy(version=SHEETS_VERSION, read=frozenset({READ_SLUG}), write=frozenset({WRITE_SLUG}))

PROMPT_FRAGMENT = (
    '- ESCRIBIR una fila en una planilla: action="tool_action", entities={"service":"sheets","op":"append_row",'
    '"spreadsheet_id":<id de la planilla>,"values":[<celda1>,<celda2>,...],"sheet_name":<pestaña opcional, def Sheet1>}.\n'
    '- LEER una planilla: action="tool_action", entities={"service":"sheets","op":"read_range",'
    '"spreadsheet_id":<id>,"range":<rango ej "A1:D20" opcional>}.'
)


def _as_rows(values):
    """Normaliza a 2D [[celdas]]: acepta escalar, fila plana, o ya-2D."""
    if values is None:
        return [[""]]
    if not isinstance(values, list):
        return [[values]]
    if values and all(isinstance(v, list) for v in values):
        return values
    return [values]


def _summarize_read(res: dict) -> str:
    data = res.get("data") or {}
    ranges = data.get("valueRanges") or data.get("value_ranges") or []
    rows = []
    for vr in ranges if isinstance(ranges, list) else []:
        for row in (vr.get("values") or []) if isinstance(vr, dict) else []:
            rows.append(", ".join(str(c) for c in row))
    return ("Contenido:\n" + "\n".join(rows[:15])) if rows else "La planilla está vacía o no pude leerla."


def build(op: str, entities: dict, *, now_iso: str | None = None):
    sid = entities.get("spreadsheet_id")
    if op == "append_row":
        if not sid:
            return None
        rows = _as_rows(entities.get("values"))
        args = {"spreadsheet_id": sid, "sheet_name": entities.get("sheet_name") or "Sheet1",
                "values": rows, "first_cell_location": "A1", "value_input_option": "USER_ENTERED"}
        return Proposal(slug=WRITE_SLUG, arguments=args,
                        reply_text="Voy a escribir esa fila en la planilla. ¿Confirmás?",
                        ok_text="Listo, lo escribí en la planilla ✅")
    if op == "read_range":
        if not sid:
            return None
        rng = entities.get("range") or "A1:Z50"
        return Read(slug=READ_SLUG, arguments={"spreadsheet_id": sid, "ranges": [rng]}, summarize=_summarize_read)
    return None
