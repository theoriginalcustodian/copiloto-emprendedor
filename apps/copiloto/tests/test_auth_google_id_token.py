"""Tests de `POST /auth/google/id-token` (sign-in nativo Google, Credential Manager -- sin browser).

Mismo criterio de dos niveles que test_auth_refresh.py:
- `GoTrueAdmin.id_token_grant` a nivel TRANSPORTE con `httpx.MockTransport`: 200 -> token dict tal
  cual; 400/401 (GoTrue ante id_token inválido/expirado/audience incorrecta) -> `InvalidCredentials`;
  500 -> se propaga `httpx.HTTPStatusError` sin traducir.
- `POST /auth/google/id-token` a nivel RUTA con `TestClient` + `gotrue` fake: SIN auth (el id_token
  de Google ES la credencial, no depende de `require_tenant`), 200 con el token si el fake no
  levanta, 401 con detail genérico si levanta `InvalidCredentials`."""
from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import web as web_module
from clients.agent.providers.crypto import FernetCrypto
from onboarding import GoTrueAdmin, InvalidCredentials


# --- GoTrueAdmin.id_token_grant (transporte fake, sin red real) -----------------

def _admin_with_transport(handler) -> GoTrueAdmin:
    client = httpx.Client(transport=httpx.MockTransport(handler), timeout=5.0)
    return GoTrueAdmin(base_url="http://gotrue.test", service_role_key="svc-key", client=client)


def test_id_token_grant_success_returns_token_dict():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/auth/v1/token"
        assert request.url.params.get("grant_type") == "id_token"
        import json as _json
        body = _json.loads(request.content)
        assert body == {"id_token": "google-id-token-real", "provider": "google"}
        return httpx.Response(200, json={
            "access_token": "AT-G", "token_type": "bearer", "expires_in": 3600,
            "refresh_token": "RT-G", "user": {"id": "u1", "email": "a@gmail.com"},
        })

    admin = _admin_with_transport(handler)
    token = admin.id_token_grant("google-id-token-real")

    assert token["access_token"] == "AT-G"
    assert token["refresh_token"] == "RT-G"
    assert token["user"]["email"] == "a@gmail.com"


def test_id_token_grant_400_raises_invalid_credentials():
    """GoTrue responde 400 ante id_token inválido/expirado/audience no aceptada -> InvalidCredentials,
    nunca un httpx.HTTPStatusError crudo."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "invalid_grant",
                                         "error_description": "Unacceptable audience in id_token"})

    admin = _admin_with_transport(handler)
    with pytest.raises(InvalidCredentials):
        admin.id_token_grant("bad-id-token")


def test_id_token_grant_401_raises_invalid_credentials():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "unauthorized"})

    admin = _admin_with_transport(handler)
    with pytest.raises(InvalidCredentials):
        admin.id_token_grant("bad-id-token")


def test_id_token_grant_other_error_propagates_http_status_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "internal"})

    admin = _admin_with_transport(handler)
    with pytest.raises(httpx.HTTPStatusError):
        admin.id_token_grant("some-id-token")


# --- POST /auth/google/id-token (ruta HTTP, gotrue fake) ------------------------

class _FakeGoTrueIdToken:
    """Fake mínimo: `token_by_idtoken` mapea id_token -> token dict (grant OK); cualquier otro
    id_token simula inválido (levanta InvalidCredentials, igual que el GoTrueAdmin real)."""
    def __init__(self, token_by_idtoken: dict) -> None:
        self._tokens = token_by_idtoken

    def id_token_grant(self, id_token: str) -> dict:
        token = self._tokens.get(id_token)
        if token is None:
            raise InvalidCredentials("id_token inválido")
        return token


def _require_tenant_401():
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
        require_tenant=_require_tenant_401(),   # /auth/google/id-token NO debe depender de esto
        mp_app=FastAPI(),
        gotrue=gotrue,
        mp_gateway=None,
        composio_gateway=None,
    )


def test_google_id_token_route_valid_token_returns_tokens_without_needing_tenant_auth():
    gotrue = _FakeGoTrueIdToken({"real-google-id-token": {
        "access_token": "AT-G", "token_type": "bearer", "expires_in": 3600,
        "refresh_token": "RT-G", "user": {"id": "u1", "email": "a@gmail.com"},
    }})
    app = _build_app(gotrue=gotrue)
    r = TestClient(app).post("/auth/google/id-token", json={"id_token": "real-google-id-token"})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "AT-G"
    assert body["refresh_token"] == "RT-G"


def test_google_id_token_route_invalid_token_returns_401():
    gotrue = _FakeGoTrueIdToken({})   # ningún id_token registrado -> InvalidCredentials siempre
    app = _build_app(gotrue=gotrue)
    r = TestClient(app).post("/auth/google/id-token", json={"id_token": "ghost-id-token"})
    assert r.status_code == 401
    assert r.json()["detail"] == "id_token de Google inválido"
