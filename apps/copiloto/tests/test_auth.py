"""Tests de apps/copiloto/auth.py (Task 2 del sprint deploy vivo + multitenant).

Cubre `decode_supabase_jwt` (válido / firma mala / expirado / aud incorrecto) y
`make_require_tenant` (token+tenant→200 cliente_id · token sin tenant→403 · sin header→401).
conn_factory fake: dict auth_user_id -> cliente_id, sin DB real (constraint del brief)."""
from __future__ import annotations

import time

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from auth import InvalidToken, decode_supabase_jwt, make_require_tenant, resolve_cliente_id

SECRET = "test-secret-not-real"


def _tok(claims: dict, secret: str = SECRET) -> str:
    base = {"sub": "u-1", "aud": "authenticated", "exp": int(time.time()) + 3600}
    return jwt.encode({**base, **claims}, secret, algorithm="HS256")


# --- decode_supabase_jwt -----------------------------------------------------

def test_valid_token_returns_sub():
    d = decode_supabase_jwt(_tok({}), secret=SECRET)
    assert d["sub"] == "u-1"


def test_bad_signature_raises():
    with pytest.raises(InvalidToken):
        decode_supabase_jwt(_tok({}, secret="otro"), secret=SECRET)


def test_expired_raises():
    expired = jwt.encode(
        {"sub": "u", "aud": "authenticated", "exp": int(time.time()) - 10}, SECRET, algorithm="HS256"
    )
    with pytest.raises(InvalidToken):
        decode_supabase_jwt(expired, secret=SECRET)


def test_wrong_audience_raises():
    with pytest.raises(InvalidToken):
        decode_supabase_jwt(_tok({"aud": "otra"}), secret=SECRET)


# --- resolve_cliente_id (conn_factory fake, sin DB real) ---------------------

class _FakeCursor:
    def __init__(self, registry: dict):
        self._registry = registry
        self._result = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql: str, params: tuple) -> None:
        auth_user_id = params[0]
        cliente_id = self._registry.get(auth_user_id)
        self._result = (cliente_id,) if cliente_id is not None else None

    def fetchone(self):
        return self._result


class _FakeConn:
    def __init__(self, registry: dict):
        self._registry = registry

    def cursor(self):
        return _FakeCursor(self._registry)


def _fake_conn_factory(registry: dict):
    return lambda: _FakeConn(registry)


def test_resolve_cliente_id_found():
    registry = {"u-1": "cid-abc"}
    assert resolve_cliente_id(_fake_conn_factory(registry), "u-1") == "cid-abc"


def test_resolve_cliente_id_not_found():
    registry: dict = {}
    assert resolve_cliente_id(_fake_conn_factory(registry), "u-1") is None


# --- make_require_tenant (FastAPI TestClient + conn_factory fake) -----------

def _build_app(registry: dict) -> FastAPI:
    app = FastAPI()
    require_tenant = make_require_tenant(secret=SECRET, conn_factory=_fake_conn_factory(registry))

    @app.get("/whoami")
    def whoami(cliente_id: str = Depends(require_tenant)):
        return {"cliente_id": cliente_id}

    return app


def test_require_tenant_valid_token_with_tenant_returns_cliente_id():
    client = TestClient(_build_app({"u-1": "cid-abc"}))
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {_tok({})}"})
    assert resp.status_code == 200
    assert resp.json()["cliente_id"] == "cid-abc"


def test_require_tenant_valid_token_without_tenant_returns_403():
    client = TestClient(_build_app({}))
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {_tok({})}"})
    assert resp.status_code == 403


def test_require_tenant_missing_header_returns_401():
    client = TestClient(_build_app({"u-1": "cid-abc"}))
    resp = client.get("/whoami")
    assert resp.status_code == 401


def test_require_tenant_invalid_token_returns_401():
    client = TestClient(_build_app({"u-1": "cid-abc"}))
    resp = client.get("/whoami", headers={"Authorization": "Bearer garbage-not-a-jwt"})
    assert resp.status_code == 401


# --- H1: adversarial — pin de algoritmo (alg-confusion / alg:none) -----------
# Regla dura del proyecto: control sin test adversarial = no verificado. El validador
# fija algorithms=["HS256"]; cualquier otro alg (o none) DEBE ser rechazado fail-closed.

def test_alg_none_unsigned_raises():
    """Token sin firma (`alg:none`) → InvalidToken (nunca aceptar tokens no firmados)."""
    unsigned = jwt.encode(
        {"sub": "u", "aud": "authenticated", "exp": int(time.time()) + 3600},
        None,
        algorithm="none",
    )
    with pytest.raises(InvalidToken):
        decode_supabase_jwt(unsigned, secret=SECRET)


def test_rs256_token_raises():
    """Token RS256 firmado con clave RSA al vuelo → rechazado por el pin HS256
    (mitiga alg-confusion RS256↔HS256)."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    rs_token = jwt.encode(
        {"sub": "u", "aud": "authenticated", "exp": int(time.time()) + 3600},
        private_pem,
        algorithm="RS256",
    )
    with pytest.raises(InvalidToken):
        decode_supabase_jwt(rs_token, secret=SECRET)


def test_hs512_same_secret_raises():
    """Token HS512 con el MISMO secreto → fuera del pin ["HS256"] → rechazado."""
    hs512_token = jwt.encode(
        {"sub": "u", "aud": "authenticated", "exp": int(time.time()) + 3600},
        SECRET,
        algorithm="HS512",
    )
    with pytest.raises(InvalidToken):
        decode_supabase_jwt(hs512_token, secret=SECRET)


# --- M1: fail-closed ante secret vacío/None al construir la dependencia ------

def test_make_require_tenant_empty_secret_raises():
    """Secret vacío → ValueError AL CONSTRUIR (el servicio muere al arrancar en vez de
    aceptar tokens forjados con clave vacía; PyJWT verifica HMAC contra "" sin quejarse)."""
    with pytest.raises(ValueError):
        make_require_tenant(secret="", conn_factory=_fake_conn_factory({}))
