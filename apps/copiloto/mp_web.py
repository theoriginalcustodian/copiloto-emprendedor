"""FastAPI de MercadoPago (capa CLIENTE): /mp/callback (OAuth) + /mp/webhook (pagos). Superficie pública
distinta del /chat del usuario. I/O sync (gateway httpx + stores psycopg2) → rutas async con asyncio.to_thread.
El state OAuth = crypto.encrypt(cliente_id) (tamper-proof). El webhook rutea al tenant por ?cid=&seller= del
notification_url (la notificación de MercadoPago no trae cliente_id)."""
from __future__ import annotations

import asyncio
import time
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse


def create_mp_app(*, gateway, crypto, cred_store_factory: Callable, payment_store_factory: Callable,
                  start_refresh: Callable | None = None) -> FastAPI:
    app = FastAPI(title="Copiloto MercadoPago")

    @app.get("/mp/callback")
    async def callback(code: str = "", state: str = "") -> Response:
        try:
            cliente_id = crypto.decrypt(state)          # tamper-proof; si falla → 400
        except Exception:  # noqa: BLE001
            return Response("state inválido", status_code=400)
        if not code:
            return Response("sin code", status_code=400)
        tok = await asyncio.to_thread(gateway.exchange_code, code)
        seller = str(tok["user_id"])
        await asyncio.to_thread(
            cred_store_factory(cliente_id).save, seller,
            access_token=tok["access_token"], refresh_token=tok["refresh_token"],
            expires_at=int(time.time()) + int(tok.get("expires_in") or 0), public_key=tok.get("public_key"))
        if start_refresh:
            await _maybe_async(start_refresh, cliente_id, seller)
        return HTMLResponse("✅ Cuenta MercadoPago conectada. Ya podés cerrar esta pestaña.")

    @app.post("/mp/webhook")
    async def webhook(request: Request, cid: str = "", seller: str = "") -> Response:
        data_id = request.query_params.get("data.id") or request.query_params.get("id") or ""
        x_sig = request.headers.get("x-signature", "")
        x_rid = request.headers.get("x-request-id", "")
        if not (cid and seller and data_id):
            return Response("ok", status_code=200)      # SIEMPRE 200 (o MercadoPago reintenta)
        if await asyncio.to_thread(gateway.verify_webhook, x_sig, x_rid, data_id):
            creds = await asyncio.to_thread(cred_store_factory(cid).get, seller)
            if creds:
                payment = await asyncio.to_thread(gateway.get_payment, creds["access_token"], data_id)
                await asyncio.to_thread(payment_store_factory(cid).upsert_from_payment,
                                        payment, seller_user_id=seller)
        return Response("ok", status_code=200)

    return app


async def _maybe_async(fn, *args):
    """Permite pasar un start_refresh sync (test) o async (arranque real de Temporal)."""
    res = fn(*args)
    if asyncio.iscoroutine(res):
        await res
