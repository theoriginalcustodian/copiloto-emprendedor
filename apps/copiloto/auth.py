"""apps/copiloto/auth.py — capa de auth del BFF (Task 2, spec §5.2).

Valida el JWT HS256 emitido por GoTrue (Supabase Auth, self-host fusion) y resuelve el
`cliente_id` del tenant desde `uc_factory.tenants` (registry `auth_user_id -> cliente_id`,
Task 1). El worker usa el rol owner (bypassa RLS) → la barrera efectiva NO es RLS, es este
filtro explícito por `auth_user_id`/`cliente_id` en cada query (regla dura del proyecto).

Cero hardcoding: el secreto (`SUPABASE_JWT_SECRET`) y el `conn_factory` se inyectan siempre
desde el composition root — nunca literales acá. Sumar un tenant = 0 cambios de código (la
resolución es por query a `tenants`, no por config)."""
from __future__ import annotations

import asyncio
from typing import Callable

import jwt
from fastapi import HTTPException, Request

from contexto_tenant import declarar_tenant

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

    # ⚠️ `async def` NO es cosmético y no se puede volver a `def` sin romper el aislamiento de la
    # base. Medido el 2026-07-31: una dependencia SYNC de FastAPI corre en un threadpool, y el
    # `ContextVar` que setea NO llega al handler (probe: `{'visto': None}`); en una dependencia ASYNC
    # sí llega, y además sobrevive a `asyncio.to_thread`, que es donde corren todos los stores.
    # Como el RLS con `FORCE` depende de ese ContextVar, volverla sync haría que la app deje de ver
    # SUS PROPIOS datos —0 filas en todo— sin ningún error que lo delate.
    async def require_tenant(request: Request) -> str:
        claims = _bearer_claims(request, secret=secret, issuer=issuer)
        # `to_thread` porque `resolve_cliente_id` hace I/O de DB síncrono: llamarlo directo acá
        # bloquearía el event loop en CADA request autenticado.
        cliente_id = await asyncio.to_thread(resolve_cliente_id, conn_factory, claims["sub"])
        if cliente_id is None:
            raise HTTPException(status_code=403, detail="tenant not provisioned for this user")
        # El borde declara el tenant: de acá en adelante, toda conexión que se abra en este request
        # se lo dice a la base. Ver `contexto_tenant.py`.
        declarar_tenant(cliente_id)
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


#: Dónde vive el claim de administrador dentro del JWT (CONS0b). `app_metadata`, NUNCA
#: `user_metadata`: verificado empíricamente contra GoTrue real (fusion) que `user_metadata` es
#: auto-editable por el propio usuario vía `PUT /auth/v1/user` — un claim ahí sería
#: auto-otorgable. `app_metadata` sólo se escribe con la Admin API (service_role_key), y un
#: intento de escalada por las 3 rutas probadas (top-level, dentro de `data`, `data.app_metadata`
#: anidado) no logró tocarlo. Ver docs/copiloto-emprendedor/2026-08-06-RESULT-CONS0b-claim-admin.md.
_ADMIN_CLAIM_KEY = "copiloto_admin"


def es_admin(claims: dict) -> bool:
    """¿Este token trae el claim de administrador? ÚNICA implementación de la pregunta.

    `require_admin` (el guard) y `/me` (la ergonomía del front, contrato `es_admin en /me`) la
    comparten a propósito: dos lecturas del mismo claim divergen en silencio el día que el claim
    se mueva de lugar."""
    return claims.get("app_metadata", {}).get(_ADMIN_CLAIM_KEY) is True


def make_require_admin(*, secret: str, issuer: str | None = None) -> Callable:
    """Fábrica de la dependencia `require_admin` (CONS0b): 401 si el Bearer falta/es inválido
    (mismo gate que `require_tenant`/`require_claims`), **403** si el token es válido pero
    `app_metadata.copiloto_admin` no es `True`.

    Deliberadamente NO exige fila de tenant (a diferencia de `require_tenant`): el operador es
    un actor de la APP, no de un tenant — specs §2, "la consola opera la app, no los datos de
    negocio de los tenants". No toca Postgres ni el `ContextVar` de RLS: `sync def` alcanza,
    igual que `require_claims`.

    Mismo fail-closed al construir que las otras dos fábricas: sin secreto, el proceso no arranca
    en vez de aceptar tokens forjados con clave vacía en runtime."""
    if not secret or not isinstance(secret, str):
        raise ValueError("SUPABASE_JWT_SECRET missing/empty")

    def require_admin(request: Request) -> dict:
        claims = _bearer_claims(request, secret=secret, issuer=issuer)
        if not es_admin(claims):
            raise HTTPException(status_code=403, detail="admin claim required")
        return claims

    return require_admin
