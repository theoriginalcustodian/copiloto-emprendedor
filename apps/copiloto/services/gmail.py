"""Servicio Gmail: enviar (write, HITL) y buscar/leer mails (read). Composio toolkit 'gmail'.

Policy MÍNIMA (defensa tool-overload nivel 1): solo SEND + FETCH — NO los 63 slugs del toolkit.
Shape de args confirmado contra Composio (validate_toolkit gmail + dump de input_parameters, 2026-07-02):
  GMAIL_SEND_EMAIL(recipient_email, subject, body, is_html?, cc?, bcc?) · GMAIL_FETCH_EMAILS(query, max_results?).
"""
from __future__ import annotations

import sys
from pathlib import Path

from _paths import ensure_paths
ensure_paths()
from clients.agent.providers.composio_gateway import ToolkitPolicy  # noqa: E402

from services.base import Proposal, Read  # noqa: E402

TOOLKIT = "gmail"
GMAIL_VERSION = "20260701_01"          # validar/bumpear: validate_toolkit.py gmail
SEND_SLUG = "GMAIL_SEND_EMAIL"
FETCH_SLUG = "GMAIL_FETCH_EMAILS"
POLICY = ToolkitPolicy(version=GMAIL_VERSION, read=frozenset({FETCH_SLUG}), write=frozenset({SEND_SLUG}))

PROMPT_FRAGMENT = (
    '- ENVIAR un mail: action="tool_action", entities={"service":"gmail","op":"send",'
    '"to":<email destino>,"subject":<asunto>,"body":<cuerpo del mail>}.\n'
    '- BUSCAR/LEER mails: action="tool_action", entities={"service":"gmail","op":"fetch",'
    '"query":<búsqueda Gmail, ej "is:unread" o "from:juan">}.'
)


def _summarize_fetch(res: dict) -> str:
    data = res.get("data") or {}
    msgs = data.get("messages") or data.get("emails") or []
    if not isinstance(msgs, list) or not msgs:
        return "No encontré mails para esa búsqueda."
    lines = []
    for m in msgs[:5]:
        if not isinstance(m, dict):
            continue
        subj = m.get("subject") or (m.get("payload") or {}).get("subject") or "(sin asunto)"
        frm = m.get("sender") or m.get("from") or m.get("from_email") or ""
        lines.append(("• " + str(subj) + (" — " + str(frm) if frm else "")).strip())
    return "Encontré:\n" + "\n".join(lines) if lines else "Encontré mails pero no pude leer los asuntos."


def build(op: str, entities: dict, *, now_iso: str | None = None):
    if op == "send":
        to = entities.get("to") or entities.get("recipient_email")
        if not to:
            return None
        subject = entities.get("subject") or "(sin asunto)"
        body = entities.get("body") or ""
        args = {"recipient_email": to, "subject": subject, "body": body}
        return Proposal(slug=SEND_SLUG, arguments=args,
                        reply_text=f"Voy a enviar un mail a {to} con asunto «{subject}». ¿Confirmás?",
                        ok_text="Listo, lo envié ✅")
    if op == "fetch":
        query = entities.get("query") or "is:unread"
        return Read(slug=FETCH_SLUG, arguments={"query": query, "max_results": 5}, summarize=_summarize_fetch)
    return None


# ── contrato ReAct (motor tool-calling) — ver services/base.py ──────────────────────────────────
# Poda del hito 2: `gmail_fetch` se fue — leer correos se quitó por la auditoría de Google.
# El `build()` de `fetch` queda abajo: el módulo no lo expone, y sacar el slug de la policy
# es una decisión aparte (cambia lo que `/composio/connect` valida).
TOOLS = {"gmail_send": "send"}

TOOL_SCHEMAS = [
    {"type": "function", "function": {
        "name": "gmail_send",
        "description": "Envía un correo por Gmail. Devuelve un borrador enlazable para revisar antes de enviar.",
        "parameters": {"type": "object", "properties": {
            "to": {"type": "string", "description": "email destino"},
            "subject": {"type": "string", "description": "asunto"},
            "body": {"type": "string", "description": "cuerpo del mail (podés incluir un link de pago)"}},
            "required": ["to", "body"]}}},
]

WRITE_OPS = frozenset({"send"})
