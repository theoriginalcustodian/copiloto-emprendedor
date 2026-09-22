"""apps/copiloto/rate_limit.py — rate-limiting del front-door (BETA-2.d, protege costo LLM/abuso).

Middleware ASGI, sliding-window en memoria. H-A4-10: el cupo es por USUARIO (claim `sub` del JWT,
verificado) en rutas autenticadas -- así dos emprendedores atrás del MISMO NAT no comparten cupo,
que era la causa de 429 falsos entre testers. Sin Bearer válido (rutas públicas/login) cae al IP
del cliente (via `X-Forwarded-For`, que Caddy setea por default en el `reverse_proxy` -- ver
`deploy/copiloto/Caddyfile.snippet`; fallback a `request.client.host` para tests/dev sin proxy). Se
instala UNA vez en `create_web_app` y envuelve TODO el stack ASGI antes del ruteo -- cubre `/chat`,
`/auth/*` y también los sub-apps montados (`/mp/*`, `/afip/*`, etc.) sin tocarlos. Los assets
estáticos de la PWA (bundle JS/CSS, app shell) NO cuentan contra ningún cupo -- una sola carga de
página no debería gastar el presupuesto pensado para mensajes de chat.

Asume proceso ÚNICO: `serve.py` corre un solo `uvicorn.Server` en un solo event loop (sin
`--workers`), confirmado en el systemd unit real. Si el front-door pasara a multi-proceso, este
estado en memoria dejaría de ser consistente entre procesos -- migrar a un backend compartido
(Redis) en ese momento, no antes (sin sobreingeniería para el proceso único de hoy)."""
from __future__ import annotations

import os
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

from auth import InvalidToken, decode_supabase_jwt

# Cero hardcoding: límite y ventana parametrizables por env. Default pensado para uso conversacional
# real (chat + polling de /reply) sin molestar a un usuario normal, mientras corta un loop de abuso.
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get("COPILOTO_RATE_LIMIT_MAX_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("COPILOTO_RATE_LIMIT_WINDOW_SECONDS", "60"))

# H-A4-10: mismo "app shell" que `web.py::_mount_spa` sirve tal cual (bundle con hash bajo /assets,
# + estos pocos archivos fijos sin hash) -- una carga/reload de la PWA los pide TODOS de una, y
# contra el cupo pensado para mensajes de chat eso alcanza para agotarlo antes del primer mensaje.
_STATIC_SHELL_FILES = {"index.html", "sw.js", "registerSW.js", "manifest.webmanifest"}


def _is_static_path(path: str) -> bool:
    if path.startswith("/assets/"):
        return True
    name = path.rsplit("/", 1)[-1]
    return path == "/" or name in _STATIC_SHELL_FILES or name.startswith("workbox-")


def _client_key(request: Request, *, jwt_secret: str | None = None, jwt_issuer: str | None = None) -> str:
    """H-A4-10: con `jwt_secret` configurado, un Bearer que verifica da un cupo por `sub` (claim del
    JWT) -- nunca se decodifica SIN validar la firma: un `sub` no verificado dejaría evadir el
    límite mandando un Bearer distinto (con `sub` inventado) en cada request, exactamente el abuso
    que este middleware existe para cortar. Sin `jwt_secret`, sin Bearer, o con un token que no
    valida (roto/expirado/ajeno): cae al IP de siempre -- mismo comportamiento que antes de este fix,
    y el único disponible para rutas públicas (no todo request autenticable trae un tenant)."""
    if jwt_secret:
        authorization = request.headers.get("authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token:
            try:
                claims = decode_supabase_jwt(token, secret=jwt_secret, issuer=jwt_issuer)
            except InvalidToken:
                # Documentado (censo-except.py): roto/expirado/ajeno cae a IP más abajo -- el
                # docstring de esta función ya explica por qué eso es lo correcto, no un fallo a loguear.
                claims = {}
            sub = claims.get("sub")
            if sub:
                return f"user:{sub}"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window log por usuario (o IP como fallback, ver `_client_key`). Devuelve 429 +
    `Retry-After` al exceder `max_requests` dentro de `window_seconds`. `max_requests<=0` desactiva
    el límite (permite testear/operar sin él sin tocar el wiring). Los assets estáticos de la PWA
    nunca se cuentan (ver `_is_static_path`)."""

    def __init__(self, app: ASGIApp, *, max_requests: int = RATE_LIMIT_MAX_REQUESTS,
                 window_seconds: int = RATE_LIMIT_WINDOW_SECONDS,
                 jwt_secret: str | None = None, jwt_issuer: str | None = None) -> None:
        super().__init__(app)
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._jwt_secret = jwt_secret
        self._jwt_issuer = jwt_issuer
        self._hits: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if self._max_requests <= 0 or _is_static_path(request.url.path):
            return await call_next(request)

        key = _client_key(request, jwt_secret=self._jwt_secret, jwt_issuer=self._jwt_issuer)
        now = time.monotonic()
        hits = self._hits[key]
        cutoff = now - self._window_seconds
        while hits and hits[0] < cutoff:
            hits.popleft()

        if len(hits) >= self._max_requests:
            retry_after = max(1, int(self._window_seconds - (now - hits[0])))
            return JSONResponse(
                {"detail": "demasiadas solicitudes, esperá un momento"},
                status_code=429, headers={"Retry-After": str(retry_after)})

        hits.append(now)
        return await call_next(request)
