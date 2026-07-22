"""Servicio Google Drive: crear archivo de texto (write, HITL) + buscar archivo (read). Toolkit 'googledrive'.

Policy MÍNIMA: CREATE_FILE_FROM_TEXT + FIND_FILE (2 slugs de 90). Shapes confirmados contra Composio
(2026-07-02): CREATE_FILE_FROM_TEXT(file_name, text_content) · FIND_FILE(q)."""
from __future__ import annotations

import sys
from pathlib import Path

from _paths import ensure_paths
ensure_paths()
from clients.agent.providers.composio_gateway import ToolkitPolicy  # noqa: E402

from services.base import Proposal, Read  # noqa: E402

TOOLKIT = "googledrive"
DRIVE_VERSION = "20260629_00"
CREATE_SLUG = "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT"
FIND_SLUG = "GOOGLEDRIVE_FIND_FILE"

# Archivado automático de facturas (`afip_drive.py`). Están en la policy porque el gateway rechaza
# cualquier slug que no esté declarado, pero deliberadamente NO en `TOOLS`/`TOOL_SCHEMAS`: el agente
# conversacional no debe poder subir archivos ni repartir permisos por su cuenta. Los invoca sólo la
# activity de archivado, que corre cuando el usuario ya lo autorizó en Ajustes.
ARCHIVADO_SLUGS = frozenset({
    "GOOGLEDRIVE_FIND_FOLDER",
    "GOOGLEDRIVE_CREATE_FOLDER",
    "GOOGLEDRIVE_UPLOAD_FROM_URL",
    "GOOGLEDRIVE_CREATE_PERMISSION",
})

POLICY = ToolkitPolicy(version=DRIVE_VERSION, read=frozenset({FIND_SLUG}),
                       write=frozenset({CREATE_SLUG}) | ARCHIVADO_SLUGS)

PROMPT_FRAGMENT = (
    '- CREAR un archivo de texto en Drive: action="tool_action", entities={"service":"drive","op":"create_file",'
    '"name":<nombre del archivo>,"content":<contenido de texto>}.\n'
    '- BUSCAR un archivo en Drive: action="tool_action", entities={"service":"drive","op":"find","name":<nombre a buscar>}.'
)


def _summarize_find(res: dict) -> str:
    data = res.get("data") or {}
    files = data.get("files") or data.get("results") or []
    if not isinstance(files, list) or not files:
        return "No encontré archivos con ese nombre."
    names = [f.get("name") or f.get("title") or f.get("id") or "?" for f in files[:5] if isinstance(f, dict)]
    return "Encontré: " + ", ".join(str(n) for n in names) if names else "Encontré archivos."


def build(op: str, entities: dict, *, now_iso: str | None = None):
    if op == "create_file":
        name = entities.get("name") or entities.get("file_name")
        if not name:
            return None
        content = entities.get("content") or entities.get("text_content") or ""
        return Proposal(slug=CREATE_SLUG, arguments={"file_name": name, "text_content": content},
                        reply_text=f"Voy a crear el archivo «{name}» en tu Drive. ¿Confirmás?",
                        ok_text="Listo, lo creé en Drive ✅")
    if op == "find":
        name = entities.get("name") or entities.get("q") or ""
        q = f"name contains '{name}'" if name else "trashed = false"
        return Read(slug=FIND_SLUG, arguments={"q": q}, summarize=_summarize_find)
    return None


# ── contrato ReAct (motor tool-calling) — ver services/base.py ──────────────────────────────────
TOOLS = {"drive_create_file": "create_file", "drive_find": "find"}

TOOL_SCHEMAS = [
    {"type": "function", "function": {
        "name": "drive_create_file",
        "description": "Crea un archivo de texto en Google Drive. Devuelve un link clicable al archivo.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string", "description": "nombre del archivo"},
            "content": {"type": "string", "description": "contenido de texto del archivo"}},
            "required": ["name"]}}},
    {"type": "function", "function": {
        "name": "drive_find",
        "description": "Busca archivos en Google Drive por nombre.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string", "description": "nombre (o parte) a buscar"}},
            "required": []}}},
]

WRITE_OPS = frozenset({"create_file"})
