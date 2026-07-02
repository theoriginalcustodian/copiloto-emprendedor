"""Servicio HubSpot (CRM): crear contacto (write, HITL) + buscar contacto (read). Toolkit 'hubspot'.

Policy MÍNIMA: CREATE_CONTACT + SEARCH_CONTACTS_BY_CRITERIA (2 de 245 slugs). Shapes confirmados (2026-07-02):
CREATE_CONTACT(email, firstname, lastname, company, ...) · SEARCH_CONTACTS_BY_CRITERIA(query)."""
from __future__ import annotations

import sys
from pathlib import Path

_REF = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(_REF))
from clients.agent.providers.composio_gateway import ToolkitPolicy  # noqa: E402

from services.base import Proposal, Read  # noqa: E402

TOOLKIT = "hubspot"
HUBSPOT_VERSION = "20260623_00"
CREATE_SLUG = "HUBSPOT_CREATE_CONTACT"
SEARCH_SLUG = "HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA"
POLICY = ToolkitPolicy(version=HUBSPOT_VERSION, read=frozenset({SEARCH_SLUG}), write=frozenset({CREATE_SLUG}))

PROMPT_FRAGMENT = (
    '- CREAR un contacto en el CRM: action="tool_action", entities={"service":"hubspot","op":"create_contact",'
    '"email":<email>,"firstname":<nombre>,"lastname":<apellido>,"company":<empresa opcional>}.\n'
    '- BUSCAR un contacto: action="tool_action", entities={"service":"hubspot","op":"search_contact","query":<email o nombre>}.'
)


def _summarize_search(res: dict) -> str:
    data = res.get("data") or {}
    results = data.get("results") or data.get("contacts") or []
    if not isinstance(results, list) or not results:
        return "No encontré contactos para esa búsqueda."
    out = []
    for c in results[:5]:
        p = (c.get("properties") if isinstance(c, dict) else None) or (c if isinstance(c, dict) else {})
        email = p.get("email") or ""
        name = " ".join(x for x in [p.get("firstname"), p.get("lastname")] if x)
        out.append((name + (f" <{email}>" if email else "")).strip() or "(contacto)")
    return "Encontré: " + ", ".join(out)


def build(op: str, entities: dict, *, now_iso: str | None = None):
    if op == "create_contact":
        email = entities.get("email")
        if not email:
            return None
        args = {"email": email}
        for k in ("firstname", "lastname", "company", "phone"):
            if entities.get(k):
                args[k] = entities[k]
        who = " ".join(x for x in [entities.get("firstname"), entities.get("lastname")] if x) or email
        return Proposal(slug=CREATE_SLUG, arguments=args,
                        reply_text=f"Voy a crear el contacto {who} en el CRM. ¿Confirmás?",
                        ok_text="Listo, lo creé en el CRM ✅")
    if op == "search_contact":
        query = entities.get("query") or entities.get("email") or ""
        return Read(slug=SEARCH_SLUG, arguments={"query": query, "limit": 5}, summarize=_summarize_search)
    return None
