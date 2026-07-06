"""Tests de los connect endpoints per-tenant (Task 7, spec §7): `/mp/connect`, `/composio/connect`,
y la extensión de `/me` con `composio_connected`.

TestClient con deps FAKE (mismo criterio que test_web_app.py — no infra real):
- `require_tenant` fake fijo (simula un token válido de ESE tenant) o 401 (simula sin token/inválido;
  ya cubierto en detalle en test_auth.py).
- `mp_gateway`/`composio_gateway` fake que SPÍAN los args con los que se los invoca (para probar que
  `cliente_id`/`user_id` SIEMPRE sale del token, nunca de un valor fijo -- regla dura multitenant).
- `conn_factory` fake mínimo: solo la query de `MpCredentialStore.first_seller_user_id` (la que toca
  `/me`); no se prueba `mp_connected` acá (ya cubierto en test_web_app.py), solo que no explota.
- `mp_app`: un `FastAPI()` vacío alcanza -- `/mp/callback`/`/mp/webhook` no son objeto de este archivo.

Boundary bajo test: `/mp/connect` y `/composio/connect` EXIGEN `require_tenant` (spec §7, "auth").
`service` de `/composio/connect` se valida contra los toolkits DERIVADOS de la policy real
(`web._composio_valid_toolkits`) -- nunca se reenvía un slug arbitrario al gateway."""
from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse


import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import services
import web as web_module
from calendar_policy import CALENDAR_POLICY
from clients.agent.providers.crypto import FernetCrypto


# --- fakes ---------------------------------------------------------------------

def _require_tenant_fixed(cliente_id: str):
    def _dep() -> str:
        return cliente_id
    return _dep


def _require_tenant_401():
    def _dep() -> str:
        raise HTTPException(status_code=401, detail="missing or malformed Authorization header")
    return _dep


class _FakeCursor:
    """Solo soporta la query de `MpCredentialStore.first_seller_user_id` -- /me la corre siempre,
    aunque este archivo no la ejercite a fondo (eso vive en test_web_app.py)."""
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql: str, params: tuple = ()) -> None:
        pass

    def fetchone(self):
        return None

    def fetchall(self):
        return []


class _FakeConn:
    def cursor(self):
        return _FakeCursor()


def _fake_conn_factory():
    return lambda: _FakeConn()


class _FakeMpGateway:
    """Spía el `state` con el que se lo invoca -- no llama a MercadoPago real. `urlencode` (no
    f-string) porque un token Fernet puede terminar en `=` -- mismo criterio que el gateway real
    (`connect_url` de mercadopago_gateway.py usa `urlencode`)."""
    def __init__(self) -> None:
        self.connect_url_calls: list[str] = []

    def connect_url(self, state: str) -> str:
        self.connect_url_calls.append(state)
        return f"https://mp.example/auth?{urlencode({'state': state})}"


class _FakeComposioGateway:
    """Spía `authorize(user_id, toolkit)` -- no llama a Composio real. `connections` = {user_id:
    [{"id","toolkit","status"}, ...]} para poblar `/me`."""
    def __init__(self, connections: dict | None = None) -> None:
        self.authorize_calls: list[tuple[str, str]] = []
        self._connections = connections or {}

    def authorize(self, user_id: str, toolkit: str) -> str:
        self.authorize_calls.append((user_id, toolkit))
        return f"https://composio.example/connect?user={user_id}&toolkit={toolkit}"

    def list_connections(self, user_id: str) -> list:
        return self._connections.get(user_id, [])


@pytest.fixture(autouse=True)
def _mp_fernet_key_env(monkeypatch):
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())


def _build_app(*, require_tenant, mp_gateway=None, composio_gateway=None):
    app = web_module.create_web_app(
        temporal_client=None,
        adapter=None,
        conn_factory=_fake_conn_factory(),
        require_tenant=require_tenant,
        mp_app=FastAPI(),
        gotrue=None,
        mp_gateway=mp_gateway or _FakeMpGateway(),
        composio_gateway=composio_gateway or _FakeComposioGateway(),
    )
    return app


def _state_of(url: str) -> str:
    return parse_qs(urlparse(url).query)["state"][0]


# --- /mp/connect -----------------------------------------------------------------

def test_mp_connect_without_token_returns_401():
    app = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).get("/mp/connect")
    assert r.status_code == 401


def test_mp_connect_with_token_state_decrypts_to_that_tenant(monkeypatch):
    key = FernetCrypto.generate_key()
    monkeypatch.setenv("MP_FERNET_KEY", key)
    gateway = _FakeMpGateway()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), mp_gateway=gateway)
    r = TestClient(app).get("/mp/connect")
    assert r.status_code == 200
    state = _state_of(r.json()["url"])
    assert FernetCrypto(key_env="MP_FERNET_KEY").decrypt(state) == "cid-A"
    assert gateway.connect_url_calls == [state]


def test_mp_connect_two_tenants_get_state_bound_to_their_own_cliente_id(monkeypatch):
    """El state NUNCA se comparte entre tenants -- ata SIEMPRE al cliente_id del token de ESE request."""
    key = FernetCrypto.generate_key()
    monkeypatch.setenv("MP_FERNET_KEY", key)
    crypto = FernetCrypto(key_env="MP_FERNET_KEY")
    app_a = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    app_b = _build_app(require_tenant=_require_tenant_fixed("cid-B"))
    state_a = _state_of(TestClient(app_a).get("/mp/connect").json()["url"])
    state_b = _state_of(TestClient(app_b).get("/mp/connect").json()["url"])
    assert crypto.decrypt(state_a) == "cid-A"
    assert crypto.decrypt(state_b) == "cid-B"


# --- /composio/connect -------------------------------------------------------------

def test_composio_connect_without_token_returns_401():
    app = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).get("/composio/connect", params={"service": "gmail"})
    assert r.status_code == 401


def test_composio_connect_valid_service_calls_authorize_with_user_id_and_toolkit():
    gateway = _FakeComposioGateway()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).get("/composio/connect", params={"service": "gmail"})
    assert r.status_code == 200
    assert gateway.authorize_calls == [("cid-A", "gmail")]
    assert r.json()["url"] == "https://composio.example/connect?user=cid-A&toolkit=gmail"


def test_composio_connect_unknown_service_returns_400():
    gateway = _FakeComposioGateway()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).get("/composio/connect", params={"service": "un-toolkit-inexistente"})
    assert r.status_code == 400
    assert gateway.authorize_calls == []          # NUNCA se reenvía un slug arbitrario al gateway


def test_composio_connect_missing_service_returns_400():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).get("/composio/connect")
    assert r.status_code == 400


def test_composio_connect_empty_service_returns_400():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).get("/composio/connect", params={"service": ""})
    assert r.status_code == 400


def test_composio_connect_two_tenants_use_their_own_user_id():
    gateway = _FakeComposioGateway()
    app_a = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    app_b = _build_app(require_tenant=_require_tenant_fixed("cid-B"), composio_gateway=gateway)
    TestClient(app_a).get("/composio/connect", params={"service": "gmail"})
    TestClient(app_b).get("/composio/connect", params={"service": "gmail"})
    assert gateway.authorize_calls == [("cid-A", "gmail"), ("cid-B", "gmail")]


def test_composio_valid_toolkits_derived_matches_policy_union():
    """`_composio_valid_toolkits` no es una lista literal aparte -- es EXACTAMENTE la unión de
    CALENDAR_POLICY + services.merged_policy() (la misma que arma worker_b.py para el ComposioGateway
    real). Si un test de este archivo divergiera de la policy real, este assert lo cazaría."""
    expected = frozenset(CALENDAR_POLICY) | frozenset(services.merged_policy())
    assert web_module._composio_valid_toolkits() == expected
    assert len(expected) == 7   # gmail, googlecalendar, googledrive, googledocs, hubspot, googlesheets, instagram


@pytest.mark.parametrize("toolkit", sorted(
    frozenset(CALENDAR_POLICY) | frozenset(services.merged_policy())))
def test_composio_connect_accepts_every_derived_toolkit(toolkit):
    """Los 7 toolkits soportados hoy responden 200 -- ninguno queda rechazado por una lista
    desactualizada a mano."""
    gateway = _FakeComposioGateway()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).get("/composio/connect", params={"service": toolkit})
    assert r.status_code == 200
    assert gateway.authorize_calls == [("cid-A", toolkit)]


# --- /me: composio_connected -------------------------------------------------------

def test_me_includes_composio_connected_only_active_toolkits():
    gateway = _FakeComposioGateway(connections={
        "cid-A": [
            {"id": "1", "toolkit": "gmail", "status": "ACTIVE"},
            {"id": "2", "toolkit": "hubspot", "status": "INITIATED"},
        ]
    })
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).get("/me")
    assert r.status_code == 200
    assert r.json()["composio_connected"] == ["gmail"]


def test_me_without_composio_connections_reports_empty_list():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).get("/me")
    assert r.json()["composio_connected"] == []


def test_me_two_tenants_do_not_leak_composio_state():
    gateway = _FakeComposioGateway(connections={
        "cid-A": [{"id": "1", "toolkit": "gmail", "status": "ACTIVE"}],
        "cid-B": [{"id": "2", "toolkit": "googlecalendar", "status": "ACTIVE"}],
    })
    app_a = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    app_b = _build_app(require_tenant=_require_tenant_fixed("cid-B"), composio_gateway=gateway)
    assert TestClient(app_a).get("/me").json()["composio_connected"] == ["gmail"]
    assert TestClient(app_b).get("/me").json()["composio_connected"] == ["googlecalendar"]
