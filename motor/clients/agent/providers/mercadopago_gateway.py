"""Boundary fail-closed entre el Copiloto y la API de MercadoPago (capa PLANTILLA). Sync (gemelo de
ComposioGateway): se invoca desde una activity vía asyncio.to_thread — I/O de red NUNCA en el workflow.
Porta la lógica validada en spikes/mercadopago-oauth-checkout/. Cero secretos: todo del env. Custodia de
tokens = del caller (los pasa como arg); este boundary no persiste nada. Firma de webhook vía SDK oficial."""
from __future__ import annotations

import os
from typing import Callable
from urllib.parse import urlencode

AUTH_URL = "https://auth.mercadopago.com/authorization"
TOKEN_URL = "https://api.mercadopago.com/oauth/token"
API = "https://api.mercadopago.com"


class MercadoPagoError(Exception):
    """Fallo de una llamada a la API de MercadoPago (sin secretos en el mensaje)."""


class MercadoPagoAuthError(MercadoPagoError):
    """Fallo de OAuth (exchange/refresh) — token inválido o rechazado."""


class MercadoPagoGateway:
    def __init__(self, *, client_id_env: str = "MP_CLIENT_ID", client_secret_env: str = "MP_CLIENT_SECRET",
                 redirect_uri_env: str = "MP_REDIRECT_URI", webhook_secret_env: str = "MP_WEBHOOK_SECRET",
                 http_factory: Callable | None = None) -> None:
        self._client_id_env = client_id_env
        self._client_secret_env = client_secret_env
        self._redirect_uri_env = redirect_uri_env
        self._webhook_secret_env = webhook_secret_env
        self._http_factory = http_factory or self._default_http
        self._http = None  # lazy

    def _default_http(self):
        import httpx  # lazy: los unit con fake nunca lo disparan
        return httpx.Client(timeout=30)

    @property
    def _client(self):
        if self._http is None:
            self._http = self._http_factory()
        return self._http

    def _env(self, name: str) -> str:
        v = os.environ.get(name)
        if not v:
            raise MercadoPagoError(f"falta {name} en el env")
        return v

    # ── OAuth ─────────────────────────────────────────────────────────────────
    def connect_url(self, state: str) -> str:
        q = {"response_type": "code", "client_id": self._env(self._client_id_env),
             "redirect_uri": self._env(self._redirect_uri_env), "state": state}
        return f"{AUTH_URL}?{urlencode(q)}"

    def exchange_code(self, code: str) -> dict:
        return self._token_call({"grant_type": "authorization_code", "code": code,
                                 "redirect_uri": self._env(self._redirect_uri_env)})

    def refresh(self, refresh_token: str) -> dict:
        return self._token_call({"grant_type": "refresh_token", "refresh_token": refresh_token})

    def _token_call(self, extra: dict) -> dict:
        body = {"client_id": self._env(self._client_id_env),
                "client_secret": self._env(self._client_secret_env), **extra}
        r = self._client.post(TOKEN_URL, json=body)
        if r.status_code != 200:
            raise MercadoPagoAuthError(f"POST /oauth/token → HTTP {r.status_code}")
        d = r.json()
        if not d.get("access_token"):
            raise MercadoPagoAuthError("respuesta de /oauth/token sin access_token")
        return {"access_token": d["access_token"], "refresh_token": d.get("refresh_token"),
                "expires_in": d.get("expires_in"), "user_id": d.get("user_id"),
                "public_key": d.get("public_key"), "live_mode": d.get("live_mode")}

    # ── cobros ────────────────────────────────────────────────────────────────
    def create_payment_link(self, access_token: str, *, amount, external_reference: str,
                            notification_url: str, title: str = "Cobro") -> dict:
        pref = {"items": [{"title": title, "quantity": 1, "unit_price": float(amount), "currency_id": "ARS"}],
                "external_reference": external_reference, "notification_url": notification_url}
        r = self._client.post(f"{API}/checkout/preferences", json=pref,
                              headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"})
        if r.status_code not in (200, 201):
            raise MercadoPagoError(f"POST /checkout/preferences → HTTP {r.status_code}")
        d = r.json()
        return {"id": d.get("id"), "init_point": d.get("init_point"), "external_reference": external_reference}

    def get_payment(self, access_token: str, payment_id: str) -> dict:
        r = self._client.get(f"{API}/v1/payments/{payment_id}",
                             headers={"Authorization": f"Bearer {access_token}"})
        if r.status_code != 200:
            raise MercadoPagoError(f"GET /v1/payments/{payment_id} → HTTP {r.status_code}")
        return r.json()

    def search_payments(self, access_token: str, *, since: str | None = None) -> list:
        params = {"sort": "date_created", "criteria": "desc"}
        if since:
            params.update({"range": "date_created", "begin_date": since, "end_date": "NOW"})
        r = self._client.get(f"{API}/v1/payments/search",
                             headers={"Authorization": f"Bearer {access_token}"}, params=params)
        if r.status_code != 200:
            raise MercadoPagoError(f"GET /v1/payments/search → HTTP {r.status_code}")
        d = r.json()
        return d.get("results", []) if isinstance(d, dict) else []

    # ── webhook ───────────────────────────────────────────────────────────────
    def verify_webhook(self, x_signature: str, x_request_id: str, data_id: str) -> bool:
        """True si la firma x-signature es válida (SDK oficial WebhookSignatureValidator, tolerancia 300s).
        manifest = id:<data_id>;request-id:<x_request_id>;ts:<ms>; · HMAC-SHA256 · secret del env. Fail-closed."""
        secret = os.environ.get(self._webhook_secret_env)
        if not (secret and x_signature and data_id):
            return False
        try:
            from mercadopago.webhook import WebhookSignatureValidator
            WebhookSignatureValidator.validate(x_signature=x_signature, x_request_id=x_request_id,
                                               data_id=data_id, secret=secret, tolerance_seconds=300)
            return True
        except Exception:  # noqa: BLE001 (InvalidWebhookSignatureError u otra → inválida)
            return False
