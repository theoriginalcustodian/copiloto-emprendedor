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

def _build_app(registry: dict, issuer: str | None = None) -> FastAPI:
    app = FastAPI()
    require_tenant = make_require_tenant(
        secret=SECRET, conn_factory=_fake_conn_factory(registry), issuer=issuer
    )

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


# --- H2: adversarial — verificación de `iss` (GoTrue DEDICADA cierra el SSO-by-accident) -----
# Regla dura del proyecto: control sin test adversarial = no verificado. Con la GoTrue propia
# (issuer propio), un token firmado con el MISMO secreto pero emitido por OTRA app de la infra
# compartida (otro `iss`) DEBE ser rechazado. `issuer=None` = comportamiento legacy (sin verificar).

ISSUER = "https://copiloto-auth.local/auth/v1"


def test_issuer_valid_passes():
    """Token con `iss` propio + decode con ese issuer → válido."""
    d = decode_supabase_jwt(_tok({"iss": ISSUER}), secret=SECRET, issuer=ISSUER)
    assert d["iss"] == ISSUER


def test_issuer_mismatch_raises():
    """Token de OTRO emisor (mismo secreto, firma válida) → InvalidToken (cierra el SSO-by-accident)."""
    with pytest.raises(InvalidToken):
        decode_supabase_jwt(_tok({"iss": "https://fusion.other/auth/v1"}), secret=SECRET, issuer=ISSUER)


def test_issuer_required_but_missing_raises():
    """Se exige issuer pero el token NO trae `iss` → InvalidToken (MissingRequiredClaim)."""
    with pytest.raises(InvalidToken):
        decode_supabase_jwt(_tok({}), secret=SECRET, issuer=ISSUER)


def test_issuer_none_skips_verification():
    """`issuer=None` (legacy / pre-cutover) → no se verifica `iss`, aunque el token traiga uno ajeno.
    Garantiza que deployar este cambio ANTES del cutover no rompe nada."""
    d = decode_supabase_jwt(_tok({"iss": "https://cualquiera/auth/v1"}), secret=SECRET, issuer=None)
    assert d["sub"] == "u-1"


def test_require_tenant_wrong_issuer_returns_401():
    """HTTP boundary: require_tenant con issuer propio + token de otro emisor → 401, aunque el
    `sub` tenga tenant y la firma sea válida (el token ajeno NO entra al copiloto)."""
    client = TestClient(_build_app({"u-1": "cid-abc"}, issuer=ISSUER))
    tok = _tok({"iss": "https://fusion.other/auth/v1"})
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 401


def test_require_tenant_correct_issuer_returns_cliente_id():
    """require_tenant con issuer propio + token del emisor propio + tenant → 200."""
    client = TestClient(_build_app({"u-1": "cid-abc"}, issuer=ISSUER))
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {_tok({'iss': ISSUER})}"})
    assert resp.status_code == 200
    assert resp.json()["cliente_id"] == "cid-abc"


# --- make_require_claims (first-login OAuth: valida token pero NO exige tenant) ---------------

def _claims_app(issuer: str | None = None) -> FastAPI:
    from auth import make_require_claims
    app = FastAPI()
    require_claims = make_require_claims(secret=SECRET, issuer=issuer)

    @app.get("/claims")
    def _c(claims: dict = Depends(require_claims)):
        return {"sub": claims["sub"], "email": claims.get("email")}

    return app


def test_require_claims_valid_returns_claims_without_tenant_check():
    """Token válido → devuelve claims SIN exigir tenant (a diferencia de require_tenant, no da 403
    aunque no haya fila de tenant — es justo el caso del first-login OAuth)."""
    resp = TestClient(_claims_app()).get(
        "/claims", headers={"Authorization": f"Bearer {_tok({'email': 'a@b.com'})}"})
    assert resp.status_code == 200
    assert resp.json() == {"sub": "u-1", "email": "a@b.com"}


def test_require_claims_invalid_token_401():
    assert TestClient(_claims_app()).get(
        "/claims", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_require_claims_wrong_issuer_401():
    """Con issuer propio, un token de otro emisor → 401 (mismo gate iss que require_tenant)."""
    tok = _tok({"iss": "https://fusion.other/auth/v1", "email": "a@b.com"})
    assert TestClient(_claims_app(issuer=ISSUER)).get(
        "/claims", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_make_require_claims_empty_secret_raises():
    from auth import make_require_claims
    with pytest.raises(ValueError):
        make_require_claims(secret="")


# --- make_require_admin (CONS0b) — el claim vive en app_metadata, ver docstring en auth.py ------

def _admin_app(issuer: str | None = None) -> FastAPI:
    from auth import make_require_admin
    app = FastAPI()
    require_admin = make_require_admin(secret=SECRET, issuer=issuer)

    @app.get("/admin/whoami")
    def _a(claims: dict = Depends(require_admin)):
        return {"sub": claims["sub"]}

    return app


def test_require_admin_con_el_claim_pasa():
    tok = _tok({"app_metadata": {"copiloto_admin": True}})
    resp = TestClient(_admin_app()).get("/admin/whoami", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 200


def test_require_admin_SIN_el_claim_da_403():
    """ADVERSARIAL: usuario normal (token válido, sin el claim) → 403. Regla dura del repo:
    control de acceso sin este test = no verificado."""
    tok = _tok({})
    resp = TestClient(_admin_app()).get("/admin/whoami", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 403


def test_require_admin_claim_en_FALSE_da_403():
    """No alcanza con que la clave exista -- tiene que ser exactamente True."""
    tok = _tok({"app_metadata": {"copiloto_admin": False}})
    resp = TestClient(_admin_app()).get("/admin/whoami", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 403


def test_require_admin_claim_en_USER_METADATA_no_alcanza():
    """El claim en el lugar EQUIVOCADO (user_metadata, auto-editable por el propio usuario) no
    debe otorgar acceso -- si esto pasara, el boundary de seguridad no estaría donde el código
    dice que está. Ver docs/copiloto-emprendedor/2026-08-06-RESULT-CONS0b-claim-admin.md."""
    tok = _tok({"user_metadata": {"copiloto_admin": True}})
    resp = TestClient(_admin_app()).get("/admin/whoami", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 403


def test_require_admin_missing_header_401():
    resp = TestClient(_admin_app()).get("/admin/whoami")
    assert resp.status_code == 401


def test_require_admin_wrong_issuer_401():
    tok = _tok({"iss": "https://fusion.other/auth/v1", "app_metadata": {"copiloto_admin": True}})
    resp = TestClient(_admin_app(issuer=ISSUER)).get(
        "/admin/whoami", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 401


def test_make_require_admin_empty_secret_raises():
    from auth import make_require_admin
    with pytest.raises(ValueError):
        make_require_admin(secret="")


# --- es_admin() -- predicado extraído para /me (contrato `es_admin en /me`, 2026-08-06) ---------
# `require_admin` (arriba) y `es_admin` son la MISMA función por dentro: `require_admin` la llama,
# no la reimplementa. Estos tests verifican eso mismo -- el mismo claim da el mismo veredicto en
# los dos lugares -- para que un futuro cambio no pueda desalinearlos en silencio.

@pytest.mark.parametrize("claims,esperado", [
    ({"app_metadata": {"copiloto_admin": True}}, True),
    ({}, False),
    ({"app_metadata": {"copiloto_admin": False}}, False),
    ({"user_metadata": {"copiloto_admin": True}}, False),  # ADVERSARIAL: lugar equivocado
])
def test_es_admin_es_el_MISMO_predicado_que_usa_require_admin(claims, esperado):
    from auth import es_admin

    assert es_admin(claims) is esperado

    # Control cruzado: el MISMO dict de claims, contra el guard HTTP real -- si algún día
    # `require_admin` dejara de llamar a `es_admin()`, este test es el que lo detecta.
    tok = _tok(claims)
    resp = TestClient(_admin_app()).get("/admin/whoami", headers={"Authorization": f"Bearer {tok}"})
    assert (resp.status_code == 200) is esperado
