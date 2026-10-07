"""Guard MPGUARDDERIVA (planificación, 2026-10-07): `/me` y `/catalog` derivan `mp_connected` de
`_estado_mp` + `_mp_connected` (web.py). Un docstring que lo dice no falla; este test sí.

Método: sentinela. Se parchean las dos funciones de módulo con un valor que ningún estado real produce
(`"sentinela"` → conectado). Si un endpoint deja de pasar por ellas y calcula el booleano por su cuenta
(`estado == "conectado"`, o una query directa a la credencial), el sentinela no llega al payload y el
test se pone rojo.

Control positivo: sin parche, el mismo tenant (sin credencial MP) da `False`. Así el verde del caso
parcheado no es una coincidencia de defaults."""
from __future__ import annotations

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import web as web_module
from clients.agent.providers.crypto import FernetCrypto

SENTINELA = "sentinela"


class _ConexionVacia:
    """Cualquier query devuelve vacío. Con `_estado_mp` parcheado, la query de MP nunca corre; esto
    sólo cubre las consultas de onboarding y legal que `/me` también hace."""
    def cursor(self):
        return self

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


class _ComposioVacio:
    def authorize(self, user_id: str, toolkit: str) -> str:
        return "https://composio.example/connect"

    def list_connections(self, user_id: str) -> list:
        return []


def _require_tenant_fixed(cliente_id: str):
    def _dep() -> str:
        return cliente_id
    return _dep


def _require_claims_fixed(claims: dict):
    def _dep() -> dict:
        return claims
    return _dep


@pytest.fixture(autouse=True)
def _mp_fernet_key_env(monkeypatch):
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


@pytest.fixture
def parche_sentinela(monkeypatch):
    """Reemplaza las dos funciones que el guard vigila. Si un endpoint no las llama, el sentinela no
    aparece y el test falla. `_mp_connected` sólo dice True para el sentinela: no imita la regla real."""
    monkeypatch.setattr(web_module, "_estado_mp", lambda conn_factory, cliente_id, crypto: SENTINELA)
    monkeypatch.setattr(web_module, "_mp_connected", lambda estado: estado == SENTINELA)


def _build_app(*, require_tenant, require_claims=None):
    return web_module.create_web_app(
        temporal_client=None,
        adapter=None,
        conn_factory=lambda: _ConexionVacia(),
        require_tenant=require_tenant,
        require_claims=require_claims,
        mp_app=FastAPI(),
        gotrue=None,
        mp_gateway=None,
        composio_gateway=_ComposioVacio(),
    )


def _me(app) -> dict:
    r = TestClient(app).get("/me")
    assert r.status_code == 200, r.text
    return r.json()


def _mercadopago(app) -> dict:
    r = TestClient(app).get("/catalog")
    assert r.status_code == 200, r.text
    return {s["key"]: s for s in r.json()["services"]}["mercadopago"]


# --- caso parcheado: el sentinela tiene que llegar a las dos superficies ---------------------------

def test_me_rama_sin_token_pasa_por_los_helpers(parche_sentinela):
    me = _me(_build_app(require_tenant=_require_tenant_fixed("cid-A")))
    assert me["mp_connected"] is True, (
        "`/me` (rama sin claims) no derivó mp_connected de `_mp_connected(_estado_mp(...))`")


def test_me_rama_con_token_pasa_por_los_helpers(parche_sentinela):
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"),
                     require_claims=_require_claims_fixed({"sub": "auth-x", "email": "x@x.test"}))
    me = _me(app)
    assert me["mp_connected"] is True, (
        "`/me` (rama con claims) no derivó mp_connected de `_mp_connected(_estado_mp(...))`")


def test_catalog_pasa_por_los_helpers(parche_sentinela):
    mp = _mercadopago(_build_app(require_tenant=_require_tenant_fixed("cid-A")))
    assert mp["connected"] is True, (
        "`/catalog` no derivó `connected` de `_mp_connected(_estado_mp(...))`")
    assert mp["status"] == SENTINELA, (
        "`/catalog` no tomó `status` de `_estado_mp`: el estado y el booleano pueden divergir")


# --- control positivo: sin parche, el mismo tenant da False ------------------------------------------

def test_control_sin_parche_el_tenant_sin_credencial_da_false():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    assert _me(app)["mp_connected"] is False
    mp = _mercadopago(app)
    assert mp["connected"] is False
    assert mp["status"] != SENTINELA


def test_catalog_sin_token_sigue_en_401(parche_sentinela):
    """El guard no debe tapar el boundary de auth: el parche no cambia la exigencia de `require_tenant`."""
    def _sin_token():
        raise HTTPException(status_code=401, detail="missing or malformed Authorization header")
    r = TestClient(_build_app(require_tenant=_sin_token)).get("/catalog")
    assert r.status_code == 401
