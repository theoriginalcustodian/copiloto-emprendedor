"""Servicio Google Sheets: append de fila real + update de celda/rango puntual + leer rango. Toolkit 'googlesheets'.

Tres ops (2 write con HITL + 1 read):
- append_row  -> GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND: agrega la fila DESPUÉS de la última fila con datos
  (Google resuelve la posición del lado servidor; sirve para planilla vacía o poblada, sin pisar ni contar).
- update_range -> GOOGLESHEETS_BATCH_UPDATE: sobreescribe a partir de una celda puntual (first_cell_location, ej "B3").
- read_range   -> GOOGLESHEETS_BATCH_GET.

Shapes CONFIRMADOS por introspección real (2026-07-02, composio 0.17.1, version 20260623_00):
- VALUES_APPEND usa camelCase (spreadsheetId, valueInputOption, range, values) — required: range/spreadsheetId/
  valueInputOption/values. El `range` localiza la tabla lógica; se appendea tras su última fila.
- BATCH_UPDATE usa snake_case (spreadsheet_id, sheet_name, values, first_cell_location, value_input_option).
El casing DIFIERE entre slugs: el gateway pasa `arguments` tal cual, así que cada op arma su propio casing."""
from __future__ import annotations

import sys
from pathlib import Path

from _paths import ensure_paths
ensure_paths()
from clients.agent.providers.composio_gateway import ToolkitPolicy  # noqa: E402

from services.base import Proposal, Read  # noqa: E402

TOOLKIT = "googlesheets"
SHEETS_VERSION = "20260623_00"
APPEND_SLUG = "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND"   # append real (posición resuelta por Google)
UPDATE_SLUG = "GOOGLESHEETS_BATCH_UPDATE"                 # sobreescribir desde una celda puntual
READ_SLUG = "GOOGLESHEETS_BATCH_GET"
SHEET_NAMES_SLUG = "GOOGLESHEETS_GET_SHEET_NAMES"        # resolver el nombre real de la 1ra pestaña (locale-agnóstico)
POLICY = ToolkitPolicy(version=SHEETS_VERSION, read=frozenset({READ_SLUG, SHEET_NAMES_SLUG}),
                       write=frozenset({APPEND_SLUG, UPDATE_SLUG}))


def _resolve_first_sheet(sid: str, into: str) -> dict:
    """Pre-paso `resolve` para el confirm-gate: si el usuario no nombró la pestaña, tomar la 1ra REAL en runtime.
    NUNCA hardcodear 'Sheet1'/'Hoja 1' — el nombre depende del locale/renombrado de la planilla del usuario."""
    return {"slug": SHEET_NAMES_SLUG, "arguments": {"spreadsheet_id": sid},
            "path": ["data", "sheet_names", 0], "into": into}

PROMPT_FRAGMENT = (
    '- AGREGAR una fila al FINAL de una planilla (append, NO pisa lo existente): action="tool_action", '
    'entities={"service":"sheets","op":"append_row","spreadsheet_id":<id de la planilla>,'
    '"values":[<celda1>,<celda2>,...],"sheet_name":<pestaña opcional, def Sheet1>}.\n'
    '- CAMBIAR/ACTUALIZAR datos en una celda o rango puntual (sobreescribe desde esa celda): '
    'action="tool_action", entities={"service":"sheets","op":"update_range","spreadsheet_id":<id>,'
    '"cell":<celda destino en notación A1, ej "B3">,"values":[<celda1>,...],"sheet_name":<pestaña opcional>}.\n'
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
    sheet = entities.get("sheet_name")   # None => se resuelve la 1ra pestaña real en runtime (ver _resolve_first_sheet)
    if op == "append_row":
        if not sid:
            return None
        rows = _as_rows(entities.get("values"))
        # APPEND real: `range` = pestaña -> Google appendea tras la última fila de la tabla (camelCase).
        # Sin pestaña explícita, `range` se rellena en el confirm-gate con el nombre real de la 1ra hoja.
        args = {"spreadsheetId": sid, "range": sheet or "", "values": rows, "valueInputOption": "USER_ENTERED"}
        return Proposal(slug=APPEND_SLUG, arguments=args,
                        reply_text="Voy a agregar esa fila al final de la planilla. ¿Confirmás?",
                        ok_text="Listo, agregué la fila ✅",
                        resolve=None if sheet else _resolve_first_sheet(sid, "range"))
    if op == "update_range":
        if not sid:
            return None
        rows = _as_rows(entities.get("values"))
        cell = entities.get("cell") or entities.get("first_cell_location") or "A1"
        # UPDATE puntual: sobreescribe desde `first_cell_location` (snake_case). Sin pestaña explícita,
        # `sheet_name` se resuelve a la 1ra hoja real (no confiar en el lenient de BATCH_UPDATE).
        args = {"spreadsheet_id": sid, "sheet_name": sheet or "",
                "values": rows, "first_cell_location": cell, "value_input_option": "USER_ENTERED"}
        return Proposal(slug=UPDATE_SLUG, arguments=args,
                        reply_text=f"Voy a escribir esos datos a partir de {cell} en la planilla (sobreescribe). ¿Confirmás?",
                        ok_text="Listo, actualicé la planilla ✅",
                        resolve=None if sheet else _resolve_first_sheet(sid, "sheet_name"))
    if op == "read_range":
        if not sid:
            return None
        rng = entities.get("range") or "A1:Z50"
        return Read(slug=READ_SLUG, arguments={"spreadsheet_id": sid, "ranges": [rng]}, summarize=_summarize_read)
    return None


# ── contrato ReAct (motor tool-calling) — ver services/base.py ──────────────────────────────────
# Poda del hito 2: `sheets_update_range` y `sheets_read_range` se fueron. Sólo escribimos filas
# nuevas, y LEER ya no hace falta: la información vive en Postgres, que es la fuente de verdad.
# El `build()` de esas ops sigue abajo a propósito — el módulo no las EXPONE al agente, pero el
# gateway conserva la policy del toolkit; borrar la policy es otra decisión y no la tomo de paso.
TOOLS = {
    "sheets_append_row": "append_row",
}

TOOL_SCHEMAS = [
    {"type": "function", "function": {
        "name": "sheets_append_row",
        "description": "Agrega una fila al FINAL de una planilla de Google Sheets (append, no pisa lo existente).",
        "parameters": {"type": "object", "properties": {
            "spreadsheet_id": {"type": "string", "description": "id de la planilla"},
            "values": {"type": "array", "items": {"type": "string"}, "description": "celdas de la fila a agregar"},
            "sheet_name": {"type": "string", "description": "pestaña destino (opcional, default la 1ra hoja real)"}},
            "required": ["spreadsheet_id", "values"]}}},
]

WRITE_OPS = frozenset({"append_row"})
