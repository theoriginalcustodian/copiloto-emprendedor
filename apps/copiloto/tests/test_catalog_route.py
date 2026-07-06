"""Tests de `GET /catalog` (Task 6, handoff §7.7): la ruta HTTP que cablea `catalog.build_catalog`
(lógica pura, ya cubierta en `test_catalog.py`) a `/me`'s mp_connected/composio_connected.

TestClient con deps FAKE (mismo criterio que test_connect_endpoints.py / test_web_app.py):
- `require_tenant` fake fijo o 401 (el JWT real ya se cubre en test_auth.py).
- `composio_gateway` fake que devuelve conexiones per-tenant (mismo shape que `/me`).
- `conn_factory` fake mínimo: solo la query de `MpCredentialStore.first_seller_user_id`.
- `mp_app`: un `FastAPI()` vacío alcanza -- `/mp/callback`/`/mp/webhook` no son objeto de este archivo.

Boundary bajo test: `/catalog` EXIGE `require_tenant` (mismo boundary que `/me`, spec §5.2)."""
from __future__ import annotations

import sys
from pathlib import Path


import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import web as web_module
from clients.agent.providers.crypto import FernetCrypto


# --- fakes (mismo patrón que test_connect_endpoints.py) -------------------------

def _require_tenant_fixed(cliente_id: str):
    def _dep() -> str:
        return cliente_id
    return _dep


def _require_tenant_401():
    def _dep() -> str:
        raise HTTPException(status_code=401, detail="missing or malformed Authorization header")
    return _dep


class _FakeCursor:
    """Solo soporta la query de `MpCredentialStore.first_seller_user_id` -- `/catalog` la corre
    siempre, igual que `/me`."""
    def __init__(self, seller: str | None) -> None:
        self._seller = seller

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql: str, params: tuple = ()) -> None:
        pass

    def fetchone(self):
        return (self._seller,) if self._seller else None

    def fetchall(self):
        return []


class _FakeConn:
    def __init__(self, seller: str | None) -> None:
        self._seller = seller

    def cursor(self):
        return _FakeCursor(self._seller)


def _fake_conn_factory(seller: str | None = None):
    return lambda: _FakeConn(seller)


class _FakeComposioGateway:
    """`connections` = {user_id: [{"id","toolkit","status"}, ...]} -- mismo shape que `/me`."""
    def __init__(self, connections: dict | None = None) -> None:
        self._connections = connections or {}

    def authorize(self, user_id: str, toolkit: str) -> str:
        return f"https://composio.example/connect?user={user_id}&toolkit={toolkit}"

    def list_connections(self, user_id: str) -> list:
        return self._connections.get(user_id, [])


@pytest.fixture(autouse=True)
def _mp_fernet_key_env(monkeypatch):
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())


def _build_app(*, require_tenant, seller: str | None = None, composio_gateway=None):
    app = web_module.create_web_app(
        temporal_client=None,
        adapter=None,
        conn_factory=_fake_conn_factory(seller),
        require_tenant=require_tenant,
        mp_app=FastAPI(),
        gotrue=None,
        mp_gateway=None,
        composio_gateway=composio_gateway or _FakeComposioGateway(),
    )
    return app


# --- /catalog --------------------------------------------------------------------

def test_catalog_without_token_returns_401():
    app = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).get("/catalog")
    assert r.status_code == 401


def test_catalog_with_token_returns_services_list():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).get("/catalog")
    assert r.status_code == 200
    body = r.json()
    assert "services" in body
    keys = {s["key"] for s in body["services"]}
    assert "mercadopago" in keys
    assert "gmail" in keys           # uno de los 7 toolkits derivados de la policy real
    assert len(keys) == 8            # mercadopago + 7 toolkits


def test_catalog_reflects_mp_connected_true():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), seller="seller-146")
    r = TestClient(app).get("/catalog")
    services = {s["key"]: s for s in r.json()["services"]}
    assert services["mercadopago"]["connected"] is True


def test_catalog_reflects_mp_connected_false():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).get("/catalog")
    services = {s["key"]: s for s in r.json()["services"]}
    assert services["mercadopago"]["connected"] is False


def test_catalog_reflects_composio_connected_only_active():
    gateway = _FakeComposioGateway(connections={
        "cid-A": [
            {"id": "1", "toolkit": "gmail", "status": "ACTIVE"},
            {"id": "2", "toolkit": "hubspot", "status": "INITIATED"},
        ]
    })
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).get("/catalog")
    services = {s["key"]: s for s in r.json()["services"]}
    assert services["gmail"]["connected"] is True
    assert services["hubspot"]["connected"] is False


def test_catalog_two_tenants_do_not_leak_state():
    """Adversarial mínimo: el estado de A no se filtra a B por compartir el mismo front-door."""
    gateway = _FakeComposioGateway(connections={
        "cid-A": [{"id": "1", "toolkit": "gmail", "status": "ACTIVE"}],
    })
    app_a = _build_app(require_tenant=_require_tenant_fixed("cid-A"), seller="seller-146",
                       composio_gateway=gateway)
    app_b = _build_app(require_tenant=_require_tenant_fixed("cid-B"), composio_gateway=gateway)
    services_a = {s["key"]: s for s in TestClient(app_a).get("/catalog").json()["services"]}
    services_b = {s["key"]: s for s in TestClient(app_b).get("/catalog").json()["services"]}
    assert services_a["mercadopago"]["connected"] is True
    assert services_a["gmail"]["connected"] is True
    assert services_b["mercadopago"]["connected"] is False
    assert services_b["gmail"]["connected"] is False
