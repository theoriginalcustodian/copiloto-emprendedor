"""Servicio Google Docs: crear documento desde markdown (write, HITL) + leer texto plano (read). Toolkit 'googledocs'.

Policy MÍNIMA: CREATE_DOCUMENT_MARKDOWN + GET_DOCUMENT_PLAINTEXT (2 de 43). Shapes confirmados (2026-07-02):
CREATE_DOCUMENT_MARKDOWN(title, markdown_text) · GET_DOCUMENT_PLAINTEXT(document_id)."""
from __future__ import annotations

import sys
from pathlib import Path

_REF = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(_REF))
from clients.agent.providers.composio_gateway import ToolkitPolicy  # noqa: E402

from services.base import Proposal, Read  # noqa: E402

TOOLKIT = "googledocs"
DOCS_VERSION = "20260623_00"
CREATE_SLUG = "GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN"
READ_SLUG = "GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT"
POLICY = ToolkitPolicy(version=DOCS_VERSION, read=frozenset({READ_SLUG}), write=frozenset({CREATE_SLUG}))

PROMPT_FRAGMENT = (
    '- CREAR un documento en Docs: action="tool_action", entities={"service":"docs","op":"create_doc",'
    '"title":<título>,"content":<contenido en markdown>}.\n'
    '- LEER un documento: action="tool_action", entities={"service":"docs","op":"read_doc","document_id":<id del doc>}.'
)


def _summarize_read(res: dict) -> str:
    data = res.get("data") or {}
    text = data.get("plaintext") or data.get("text") or data.get("content") or ""
    text = str(text).strip()
    return ("Contenido:\n" + text[:800]) if text else "El documento está vacío o no pude leerlo."


def build(op: str, entities: dict, *, now_iso: str | None = None):
    if op == "create_doc":
        title = entities.get("title")
        if not title:
            return None
        content = entities.get("content") or entities.get("markdown_text") or ""
        return Proposal(slug=CREATE_SLUG, arguments={"title": title, "markdown_text": content},
                        reply_text=f"Voy a crear el documento «{title}» en Docs. ¿Confirmás?",
                        ok_text="Listo, lo creé en Docs ✅")
    if op == "read_doc":
        doc_id = entities.get("document_id") or entities.get("id")
        if not doc_id:
            return None
        return Read(slug=READ_SLUG, arguments={"document_id": doc_id}, summarize=_summarize_read)
    return None


# ── contrato ReAct (motor tool-calling) — ver services/base.py ──────────────────────────────────
TOOLS = {"docs_create_doc": "create_doc", "docs_read_doc": "read_doc"}

TOOL_SCHEMAS = [
    {"type": "function", "function": {
        "name": "docs_create_doc",
        "description": "Crea un Google Doc a partir de markdown. Devuelve un link clicable al documento.",
        "parameters": {"type": "object", "properties": {
            "title": {"type": "string", "description": "título del documento"},
            "content": {"type": "string", "description": "contenido en markdown"}},
            "required": ["title"]}}},
    {"type": "function", "function": {
        "name": "docs_read_doc",
        "description": "Lee el texto plano de un Google Doc existente.",
        "parameters": {"type": "object", "properties": {
            "document_id": {"type": "string", "description": "id del documento a leer"}},
            "required": ["document_id"]}}},
]

WRITE_OPS = frozenset({"create_doc"})
