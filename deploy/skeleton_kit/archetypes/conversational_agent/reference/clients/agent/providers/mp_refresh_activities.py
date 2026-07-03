"""Activities del refresh de MercadoPago (capa PLANTILLA). Archivo SEPARADO del workflow: el sandbox de
Temporal recarga el archivo del workflow en cada task, y las activities corren FUERA del sandbox → importan
el gateway normal. I/O bloqueante (httpx del gateway + psycopg2 del store) vía asyncio.to_thread para no
bloquear el event loop del worker."""
from __future__ import annotations

import asyncio
import time

from temporalio import activity

from clients.agent.providers.mercadopago_gateway import MercadoPagoAuthError

_gateway = None
_store_factory = None


def set_refresh_deps(gateway, store_factory) -> None:
    """Inyecta el gateway (con .refresh) y store_factory(cliente_id) -> MpCredentialStore. SYNC. Molde set_store."""
    global _gateway, _store_factory
    _gateway, _store_factory = gateway, store_factory


def _refresh_sync(cliente_id: str, seller_user_id: str) -> dict:
    """Refresca + persiste el par ROTADO inmediatamente. Clasificación de errores: los transitorios (red,
    MercadoPagoError no-auth) PROPAGAN → Temporal reintenta la activity; solo el auth-error (refresh_token ya
    rotado/inválido, ventana de crash refresh→save) devuelve needs_reauth → el vendedor re-conecta."""
    store = _store_factory(cliente_id)
    creds = store.get(seller_user_id)
    if not creds:
        return {"ok": False, "reason": "no_credential"}
    try:
        tok = _gateway.refresh(creds["refresh_token"])
    except MercadoPagoAuthError:
        return {"ok": False, "reason": "needs_reauth"}
    if not tok.get("refresh_token"):
        return {"ok": False, "reason": "needs_reauth"}
    store.update_tokens(seller_user_id, access_token=tok["access_token"],
                        refresh_token=tok["refresh_token"],
                        expires_at=int(time.time()) + int(tok.get("expires_in") or 0))
    return {"ok": True, "reason": None}


@activity.defn
async def refresh_credential(cliente_id: str, seller_user_id: str) -> dict:
    return await asyncio.to_thread(_refresh_sync, cliente_id, seller_user_id)
