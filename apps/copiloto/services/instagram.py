"""Servicio Instagram (cuenta Business): ver cuenta/posts (read) + publicar foto (write, HITL, 2 pasos). Toolkit 'instagram'.

Policy MÍNIMA: GET_USER_INFO + GET_IG_USER_MEDIA (read) · POST_IG_USER_MEDIA + POST_IG_USER_MEDIA_PUBLISH (write).
Shapes confirmados (2026-07-02): POST_IG_USER_MEDIA(ig_user_id, image_url, caption) -> creation_id (campo 'id');
PUBLISH(ig_user_id, creation_id). El publish es 2 pasos → usa el 'then' chain del dispatcher.

⚠️ CONSTRAINT (propietario: operador · decisión pendiente): la API de Instagram NO tiene delete-post (solo
DELETE_COMMENT). Un post publicado es PERMANENTE (borrado manual desde la app). Por eso el E2E NO dispara un
publish real sobre la cuenta de marca; el publish queda cableado + unit-testeado, listo para activar con una
image_url pública cuando el operador lo decida."""
from __future__ import annotations

import sys
from pathlib import Path

_REF = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(_REF))
from clients.agent.providers.composio_gateway import ToolkitPolicy  # noqa: E402

from services.base import Proposal, Read  # noqa: E402

TOOLKIT = "instagram"
IG_VERSION = "20260623_00"
ACCOUNT_SLUG = "INSTAGRAM_GET_USER_INFO"
MEDIA_SLUG = "INSTAGRAM_GET_IG_USER_MEDIA"
CREATE_MEDIA_SLUG = "INSTAGRAM_POST_IG_USER_MEDIA"          # crea el contenedor -> devuelve 'id' (creation_id)
PUBLISH_SLUG = "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH"       # publica el contenedor
POLICY = ToolkitPolicy(version=IG_VERSION,
                       read=frozenset({ACCOUNT_SLUG, MEDIA_SLUG}),
                       write=frozenset({CREATE_MEDIA_SLUG, PUBLISH_SLUG}))

PROMPT_FRAGMENT = (
    '- VER la cuenta de Instagram: action="tool_action", entities={"service":"instagram","op":"account"}.\n'
    '- VER las publicaciones: action="tool_action", entities={"service":"instagram","op":"media","ig_user_id":<id>}.\n'
    '- PUBLICAR una foto: action="tool_action", entities={"service":"instagram","op":"publish","ig_user_id":<id>,'
    '"image_url":<URL pública de la imagen>,"caption":<texto>}.'
)


def _summarize_account(res: dict) -> str:
    d = res.get("data") or {}
    u = d.get("username") or ""
    return (f"Cuenta @{u} — {d.get('media_count', '?')} posts, {d.get('followers_count', '?')} seguidores "
            f"(id {d.get('id', '?')})") if u else "No pude leer la cuenta."


def _summarize_media(res: dict) -> str:
    d = res.get("data") or {}
    items = d.get("data") or d.get("media") or []
    if not isinstance(items, list) or not items:
        return "No encontré publicaciones."
    caps = [(i.get("caption") or i.get("id") or "post") for i in items[:5] if isinstance(i, dict)]
    return "Últimas publicaciones: " + " · ".join(str(c)[:60] for c in caps)


def build(op: str, entities: dict, *, now_iso: str | None = None):
    if op == "account":
        return Read(slug=ACCOUNT_SLUG, arguments={}, summarize=_summarize_account)
    if op == "media":
        ig = entities.get("ig_user_id")
        if not ig:
            return None
        return Read(slug=MEDIA_SLUG, arguments={"ig_user_id": ig, "limit": 5}, summarize=_summarize_media)
    if op == "publish":
        ig = entities.get("ig_user_id")
        image_url = entities.get("image_url")
        if not (ig and image_url):
            return None
        caption = entities.get("caption") or ""
        return Proposal(
            slug=CREATE_MEDIA_SLUG,
            arguments={"ig_user_id": ig, "image_url": image_url, "caption": caption},
            then={"slug": PUBLISH_SLUG, "id_key": "id", "id_arg": "creation_id", "arguments": {"ig_user_id": ig}},
            reply_text=f"Voy a publicar una foto en Instagram (@{ig}). ¿Confirmás? (recordá: no se puede borrar por API)",
            ok_text="Listo, lo publiqué en Instagram ✅")
    return None
