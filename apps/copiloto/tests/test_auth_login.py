"""Tests de `POST /auth/login` (Task 6, decisión de arquitectura: el frontend NO habla directo con
GoTrue -- proxy de login mismo-origen, sin CORS, sin anon key en el browser).

Dos niveles, mismo criterio que test_onboarding.py:
- `GoTrueAdmin.password_grant` a nivel TRANSPORTE con `httpx.MockTransport` (sin red real): 200 ->
  devuelve el token dict tal cual; 400/401 (GoTrue ante credenciales inválidas) -> `InvalidCredentials`,
  sin excepción cruda de httpx. El status EXACTO de GoTrue real se confirma en el go-live smoke
  (Task 12) -- acá se ejercita la LÓGICA de traducción con un transport fake.
- `POST /auth/login` a nivel RUTA con `TestClient` + `gotrue` fake (mismo patrón que
  test_connect_endpoints.py): SIN auth (no depende de `require_tenant`), 200 con el token si el fake
  no levanta, 401 si levanta `InvalidCredentials` -- nunca el detalle crudo de GoTrue."""
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


# --- GoTrueAdmin.password_grant (transporte fake, sin red real) -----------------

def _admin_with_transport(handler) -> GoTrueAdmin:
    client = httpx.Client(transport=httpx.MockTransport(handler), timeout=5.0)
    return GoTrueAdmin(base_url="http://gotrue.test", service_role_key="svc-key", client=client)


def test_password_grant_success_returns_token_dict():
    """POST 200 -> devuelve el JSON completo del token (access_token, refresh_token, user, ...)."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/auth/v1/token"
        assert request.url.params.get("grant_type") == "password"
        return httpx.Response(200, json={
            "access_token": "AT", "token_type": "bearer", "expires_in": 3600,
            "refresh_token": "RT", "user": {"id": "u1", "email": "a@test.com"},
        })

    admin = _admin_with_transport(handler)
    token = admin.password_grant("a@test.com", "pw")

    assert token["access_token"] == "AT"
    assert token["refresh_token"] == "RT"
    assert token["user"]["email"] == "a@test.com"


def test_password_grant_400_raises_invalid_credentials():
    """GoTrue responde 400 (invalid_grant) ante password incorrecto -> InvalidCredentials, NUNCA
    un httpx.HTTPStatusError crudo."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "invalid_grant",
                                         "error_description": "Invalid login credentials"})

    admin = _admin_with_transport(handler)
    with pytest.raises(InvalidCredentials):
        admin.password_grant("a@test.com", "wrong-pw")


def test_password_grant_401_raises_invalid_credentials():
    """Variante 401 (algunos self-host de GoTrue usan este status) -> misma InvalidCredentials."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "unauthorized"})

    admin = _admin_with_transport(handler)
    with pytest.raises(InvalidCredentials):
        admin.password_grant("a@test.com", "wrong-pw")


def test_password_grant_other_error_propagates_http_status_error():
    """Un error que NO es "credenciales inválidas" (ej. 500) no se traga como InvalidCredentials --
    se propaga tal cual (mismo criterio que admin_create_user con el 422 no-hallable)."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "internal"})

    admin = _admin_with_transport(handler)
    with pytest.raises(httpx.HTTPStatusError):
        admin.password_grant("a@test.com", "pw")


# --- POST /auth/login (ruta HTTP, gotrue fake) ----------------------------------

class _FakeGoTrueLogin:
    """Fake mínimo: `token_by_email` mapea email -> token dict (login OK); cualquier otro email
    simula credenciales inválidas (levanta InvalidCredentials, igual que el GoTrueAdmin real)."""
    def __init__(self, token_by_email: dict) -> None:
        self._tokens = token_by_email

    def password_grant(self, email: str, password: str) -> dict:
        token = self._tokens.get(email)
        if token is None:
            raise InvalidCredentials("credenciales inválidas")
        return token


def _require_tenant_401():
    """Simula "sin token" -- usado para probar que /auth/login NO depende de require_tenant."""
    def _dep() -> str:
        raise HTTPException(status_code=401, detail="missing or malformed Authorization header")
    return _dep


@pytest.fixture(autouse=True)
def _mp_fernet_key_env(monkeypatch):
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


def _build_app(*, gotrue):
    return web_module.create_web_app(
        temporal_client=None,
        adapter=None,
        conn_factory=lambda: None,
        require_tenant=_require_tenant_401(),   # /auth/login NO debe depender de esto
        mp_app=FastAPI(),
        gotrue=gotrue,
        mp_gateway=None,
        composio_gateway=None,
    )


def test_login_route_valid_credentials_returns_token_without_needing_tenant_auth():
    gotrue = _FakeGoTrueLogin({"a@test.com": {"access_token": "AT", "token_type": "bearer",
                                              "expires_in": 3600, "refresh_token": "RT",
                                              "user": {"id": "u1", "email": "a@test.com"}}})
    app = _build_app(gotrue=gotrue)
    r = TestClient(app).post("/auth/login", json={"email": "a@test.com", "password": "pw"})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "AT"
    assert body["refresh_token"] == "RT"


def test_login_route_invalid_credentials_returns_401_not_500():
    gotrue = _FakeGoTrueLogin({})   # ningún email registrado -> InvalidCredentials siempre
    app = _build_app(gotrue=gotrue)
    r = TestClient(app).post("/auth/login", json={"email": "ghost@test.com", "password": "wrong"})
    assert r.status_code == 401
    assert r.json()["detail"] == "credenciales inválidas"   # nunca el detalle crudo de GoTrue


def test_login_route_never_leaks_password_in_response():
    gotrue = _FakeGoTrueLogin({"a@test.com": {"access_token": "AT", "user": {"email": "a@test.com"}}})
    app = _build_app(gotrue=gotrue)
    r = TestClient(app).post("/auth/login", json={"email": "a@test.com", "password": "super-secret"})
    assert "super-secret" not in r.text
