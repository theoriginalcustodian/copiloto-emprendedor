"""apps/copiloto/auth.py — capa de auth del BFF (Task 2, spec §5.2).

Valida el JWT HS256 emitido por GoTrue (Supabase Auth, self-host fusion) y resuelve el
`cliente_id` del tenant desde `uc_factory.tenants` (registry `auth_user_id -> cliente_id`,
Task 1). El worker usa el rol owner (bypassa RLS) → la barrera efectiva NO es RLS, es este
filtro explícito por `auth_user_id`/`cliente_id` en cada query (regla dura del proyecto).

Cero hardcoding: el secreto (`SUPABASE_JWT_SECRET`) y el `conn_factory` se inyectan siempre
desde el composition root — nunca literales acá. Sumar un tenant = 0 cambios de código (la
resolución es por query a `tenants`, no por config)."""
from __future__ import annotations

from typing import Callable

import jwt
from fastapi import HTTPException, Request

_SCHEMA = "uc_factory"
_TENANTS_TABLE = f"{_SCHEMA}.tenants"


class InvalidToken(Exception):
    """El JWT es inválido: firma incorrecta, expirado, `aud` incorrecto, o le faltan claims
    requeridos (`exp`/`sub`)."""


def decode_supabase_jwt(
    token: str, *, secret: str, audience: str = "authenticated", issuer: str | None = None
) -> dict:
    """Decodifica y valida un JWT HS256 de GoTrue. Levanta `InvalidToken` (fail-closed) ante
    CUALQUIER fallo de `jwt.PyJWTError` (firma mala, expirado, aud incorrecto, claims faltantes).

    `issuer` (opcional): si se pasa, verifica el claim `iss` == issuer y EXIGE que el token lo
    traiga (`MissingRequiredClaimError` si falta, `InvalidIssuerError` si no coincide). Con la GoTrue
    DEDICADA (issuer propio) esto cierra el "SSO-by-accident": un token firmado con el mismo secreto
    pero emitido por OTRA app de la infra compartida queda RECHAZADO. `issuer=None` → no se verifica
    `iss` (comportamiento legacy idéntico al de fusion, backward-compatible: seguro deployar este
    cambio ANTES del cutover)."""
    require = ["exp", "sub"] if issuer is None else ["exp", "sub", "iss"]
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=audience,
            issuer=issuer,  # None -> PyJWT no verifica iss (backward-compat)
            options={"require": require},
        )
    except jwt.PyJWTError as exc:
        raise InvalidToken(str(exc)) from exc


def resolve_cliente_id(conn_factory: Callable, auth_user_id: str) -> str | None:
    """Resuelve `cliente_id` (uuid como str) desde `uc_factory.tenants` por `auth_user_id` (el
    `sub` del JWT). `None` si el usuario no tiene fila de tenant (sin onboarding todavía)."""
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT cliente_id::text FROM {_TENANTS_TABLE} WHERE auth_user_id=%s",
            (auth_user_id,),
        )
        row = cur.fetchone()
    return row[0] if row else None


def _bearer_claims(request: Request, *, secret: str, issuer: str | None) -> dict:
    """Extrae el Bearer del header y lo valida (mismo gate 401 que require_tenant). Devuelve los
    claims. Compartido por `require_tenant` (que además exige fila de tenant) y `require_claims`
    (que NO la exige — first-login OAuth, el user existe en GoTrue pero aún no tiene tenant)."""
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="missing or malformed Authorization header")
    try:
        return decode_supabase_jwt(token, secret=secret, issuer=issuer)
    except InvalidToken as exc:
        raise HTTPException(status_code=401, detail=f"invalid token: {exc}") from exc


def make_require_tenant(*, secret: str, conn_factory: Callable, issuer: str | None = None) -> Callable:
    """Fábrica de la dependencia FastAPI `require_tenant` (spec §5.2). `secret`, `conn_factory` e
    `issuer` se inyectan desde el composition root (nunca hardcodeados) — permite testear con un
    secreto de prueba y un conn_factory fake, y escalar a N tenants sin tocar código.

    `issuer` (opcional): cuando el copiloto corre contra su GoTrue DEDICADA, el composition root
    inyecta `COPILOTO_JWT_ISSUER` → cada token se valida además por `iss` (cierra el SSO-by-accident
    de la infra compartida). `None` → sin verificación de `iss` (comportamiento legacy).

    Devuelve `cliente_id: str` inyectable vía `Depends(...)`.
    `HTTPException(401)` si el header falta o el token es inválido/expirado/aud o iss incorrecto.
    `HTTPException(403)` si el token es válido pero no hay fila de tenant (sin onboarding).

    Fail-closed en el arranque: si el secreto falta o está vacío, aborta AL CONSTRUIR (el
    servicio muere al bootear) en vez de aceptar tokens forjados con clave vacía en runtime —
    PyJWT verifica HMAC contra `""` sin quejarse, así que un secret vacío es un fail-open."""
    if not secret or not isinstance(secret, str):
        raise ValueError("SUPABASE_JWT_SECRET missing/empty")

    def require_tenant(request: Request) -> str:
        claims = _bearer_claims(request, secret=secret, issuer=issuer)
        cliente_id = resolve_cliente_id(conn_factory, claims["sub"])
        if cliente_id is None:
            raise HTTPException(status_code=403, detail="tenant not provisioned for this user")
        return cliente_id

    return require_tenant


def make_require_claims(*, secret: str, issuer: str | None = None) -> Callable:
    """Fábrica de la dependencia `require_claims`: valida el Bearer (401 ante inválido/ajeno, mismo
    gate que require_tenant) y devuelve los CLAIMS (sub/email/app_metadata) SIN exigir fila de tenant.

    Para el first-login de un proveedor OAuth externo (Google): el user ya existe en GoTrue (alta
    self-service del proveedor) pero todavía no tiene fila en `uc_factory.tenants` → require_tenant
    daría 403. El endpoint de provisioning usa esta dependencia para leer sub+email del token y dar
    de alta el tenant. Mismo fail-closed al construir que require_tenant."""
    if not secret or not isinstance(secret, str):
        raise ValueError("SUPABASE_JWT_SECRET missing/empty")

    def require_claims(request: Request) -> dict:
        return _bearer_claims(request, secret=secret, issuer=issuer)

    return require_claims
