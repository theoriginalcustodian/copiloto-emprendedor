"""Tests de `POST /auth/refresh` (renovar el JWT sin re-login, mismo criterio que test_auth_login.py).

Dos niveles, mismo criterio que test_auth_login.py/test_onboarding.py:
- `GoTrueAdmin.refresh_grant` a nivel TRANSPORTE con `httpx.MockTransport` (sin red real): 200 ->
  devuelve el token dict tal cual (con el refresh_token NUEVO, GoTrue rota); 400/401 (GoTrue ante
  refresh inválido/expirado/reusado) -> `InvalidCredentials`, sin excepción cruda de httpx; 500 ->
  se propaga `httpx.HTTPStatusError` sin traducir.
- `POST /auth/refresh` a nivel RUTA con `TestClient` + `gotrue` fake: SIN auth (no depende de
  `require_tenant`), 200 con el token si el fake no levanta, 401 con detail="sesión expirada" si
  levanta `InvalidCredentials` -- nunca el detalle crudo de GoTrue."""
from __future__ import annotations

import sys
from pathlib import Path


import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import web as web_module
from clients.agent.providers.crypto import FernetCrypto
from onboarding import GoTrueAdmin, InvalidCredentials


# --- GoTrueAdmin.refresh_grant (transporte fake, sin red real) -----------------

def _admin_with_transport(handler) -> GoTrueAdmin:
    client = httpx.Client(transport=httpx.MockTransport(handler), timeout=5.0)
    return GoTrueAdmin(base_url="http://gotrue.test", service_role_key="svc-key", client=client)


def test_refresh_grant_success_returns_new_token_dict():
    """POST 200 -> devuelve el JSON completo del token, con access_token Y refresh_token NUEVOS
    (GoTrue rota el refresh en cada uso)."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/auth/v1/token"
        assert request.url.params.get("grant_type") == "refresh_token"
        body = request.content
        assert b"old-refresh-token" in body
        return httpx.Response(200, json={
            "access_token": "AT-NEW", "token_type": "bearer", "expires_in": 3600,
            "refresh_token": "RT-NEW", "user": {"id": "u1", "email": "a@test.com"},
        })

    admin = _admin_with_transport(handler)
    token = admin.refresh_grant("old-refresh-token")

    assert token["access_token"] == "AT-NEW"
    assert token["refresh_token"] == "RT-NEW"
    assert token["user"]["email"] == "a@test.com"


def test_refresh_grant_400_raises_invalid_credentials():
    """GoTrue responde 400 ante refresh inválido/expirado/reusado -> InvalidCredentials, NUNCA un
    httpx.HTTPStatusError crudo."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "invalid_grant",
                                         "error_description": "Invalid Refresh Token"})

    admin = _admin_with_transport(handler)
    with pytest.raises(InvalidCredentials):
        admin.refresh_grant("bad-refresh-token")


def test_refresh_grant_401_raises_invalid_credentials():
    """Variante 401 (algunos self-host de GoTrue usan este status) -> misma InvalidCredentials."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "unauthorized"})

    admin = _admin_with_transport(handler)
    with pytest.raises(InvalidCredentials):
        admin.refresh_grant("bad-refresh-token")


def test_refresh_grant_other_error_propagates_http_status_error():
    """Un error que NO es "refresh inválido" (ej. 500) no se traga como InvalidCredentials -- se
    propaga tal cual (mismo criterio que password_grant/admin_create_user)."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "internal"})

    admin = _admin_with_transport(handler)
    with pytest.raises(httpx.HTTPStatusError):
        admin.refresh_grant("some-refresh-token")


# --- POST /auth/refresh (ruta HTTP, gotrue fake) --------------------------------

class _FakeGoTrueRefresh:
    """Fake mínimo: `token_by_refresh` mapea refresh_token -> token dict NUEVO (refresh OK);
    cualquier otro refresh_token simula inválido/expirado/reusado (levanta InvalidCredentials,
    igual que el GoTrueAdmin real)."""
    def __init__(self, token_by_refresh: dict) -> None:
        self._tokens = token_by_refresh

    def refresh_grant(self, refresh_token: str) -> dict:
        token = self._tokens.get(refresh_token)
        if token is None:
            raise InvalidCredentials("sesión expirada")
        return token


def _require_tenant_401():
    """Simula "sin token" -- usado para probar que /auth/refresh NO depende de require_tenant."""
    def _dep() -> str:
        raise HTTPException(status_code=401, detail="missing or malformed Authorization header")
    return _dep


@pytest.fixture(autouse=True)
def _mp_fernet_key_env(monkeypatch):
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())


def _build_app(*, gotrue):
    return web_module.create_web_app(
        temporal_client=None,
        adapter=None,
        conn_factory=lambda: None,
        require_tenant=_require_tenant_401(),   # /auth/refresh NO debe depender de esto
        mp_app=FastAPI(),
        gotrue=gotrue,
        mp_gateway=None,
        composio_gateway=None,
    )


def test_refresh_route_valid_token_returns_new_tokens_without_needing_tenant_auth():
    gotrue = _FakeGoTrueRefresh({"old-RT": {"access_token": "AT-NEW", "token_type": "bearer",
                                            "expires_in": 3600, "refresh_token": "RT-NEW",
                                            "user": {"id": "u1", "email": "a@test.com"}}})
    app = _build_app(gotrue=gotrue)
    r = TestClient(app).post("/auth/refresh", json={"refresh_token": "old-RT"})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "AT-NEW"
    assert body["refresh_token"] == "RT-NEW"


def test_refresh_route_invalid_token_returns_401_sesion_expirada():
    gotrue = _FakeGoTrueRefresh({})   # ningún refresh_token registrado -> InvalidCredentials siempre
    app = _build_app(gotrue=gotrue)
    r = TestClient(app).post("/auth/refresh", json={"refresh_token": "ghost-RT"})
    assert r.status_code == 401
    assert r.json()["detail"] == "sesión expirada"   # nunca el detalle crudo de GoTrue
