"""Crea (idempotente) las auth configs CUSTOM de Composio para los 5 toolkits de Google,
usando nuestro propio OAuth Client en vez del gestionado por Composio.

Runbook: docs/copiloto-emprendedor/2026-07-21-runbook-oauth-google-propio.md §5-6.

Credenciales SIEMPRE por env, nunca hardcodeadas ni escritas por este script:
  COMPOSIO_API_KEY          — ya vive en /etc/unreal-copilot/copiloto.env en el VPS
  GOOGLE_OAUTH_CLIENT_ID    — del "Cliente Web" creado en Google Cloud Console
  GOOGLE_OAUTH_CLIENT_SECRET

No pasamos oauth_redirect_uri: el default de Composio (verificado 2026-08-03 contra
`composio.toolkits.get("gmail")` en vivo) es `https://backend.composio.dev/api/v1/auth-apps/add`,
que es exactamente el URI registrado en el Client de Google — pasar uno propio lo pisaría.

Idempotente: si el toolkit ya tiene una auth config NO gestionada por Composio (nuestra), no crea
otra — lista y sale. No hace update (cambiar client_id/secret de una config existente es una
decisión operativa aparte, no un re-run accidental de este script).
"""
from __future__ import annotations

import os
import sys

from composio import Composio

# scopes no-sensibles / sensibles-sin-auditoría por toolkit — decisión operador 2026-07-21,
# runbook §0 y §6. Ninguno "restringido" (mail.google.com/, drive completo).
_SCOPES_POR_TOOLKIT = {
    "gmail": (
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/gmail.send",
    ),
    "googledrive": (
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/drive.file",
    ),
    "googledocs": (
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/documents",
    ),
    "googlesheets": (
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/spreadsheets",
    ),
    "googlecalendar": (
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/calendar.events",
    ),
}


def _config_propia_existente(client, toolkit: str):
    resp = client.auth_configs.list(toolkit_slug=toolkit)
    items = resp.items if hasattr(resp, "items") else resp.get("items", [])
    for item in items:
        d = item.model_dump() if hasattr(item, "model_dump") else dict(item)
        if not d.get("is_composio_managed"):
            return d.get("id") or d.get("nano_id")
    return None


def main() -> int:
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("faltan GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET en el env", file=sys.stderr)
        return 1
    if not os.environ.get("COMPOSIO_API_KEY"):
        print("falta COMPOSIO_API_KEY en el env", file=sys.stderr)
        return 1

    client = Composio()

    for toolkit, scopes in _SCOPES_POR_TOOLKIT.items():
        existente = _config_propia_existente(client, toolkit)
        if existente:
            print(f"{toolkit}: ya existe config propia ({existente}) — no se toca")
            continue
        creada = client.auth_configs.create(
            toolkit,
            {
                "type": "use_custom_auth",
                "auth_scheme": "OAUTH2",
                "name": "composio-copiloto",
                "credentials": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "scopes": ",".join(scopes),
                },
            },
        )
        print(f"{toolkit}: creada {creada.id}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
