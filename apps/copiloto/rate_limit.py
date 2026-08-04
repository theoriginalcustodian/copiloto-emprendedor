"""apps/copiloto/rate_limit.py — rate-limiting del front-door (BETA-2.d, protege costo LLM/abuso).

Middleware ASGI, sliding-window en memoria, keyed por IP del cliente (via `X-Forwarded-For`, que
Caddy setea por default en el `reverse_proxy` -- ver `deploy/copiloto/Caddyfile.snippet`; fallback a
`request.client.host` para tests/dev sin proxy). Se instala UNA vez en `create_web_app` y envuelve
TODO el stack ASGI antes del ruteo -- cubre `/chat`, `/auth/*` y también los sub-apps montados
(`/mp/*`, `/afip/*`, etc.) sin tocarlos.

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

# Cero hardcoding: límite y ventana parametrizables por env. Default pensado para uso conversacional
# real (chat + polling de /reply) sin molestar a un usuario normal, mientras corta un loop de abuso.
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get("COPILOTO_RATE_LIMIT_MAX_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("COPILOTO_RATE_LIMIT_WINDOW_SECONDS", "60"))


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window log por IP. Devuelve 429 + `Retry-After` al exceder `max_requests` dentro de
    `window_seconds`. `max_requests<=0` desactiva el límite (permite testear/operar sin él sin tocar
    el wiring)."""

    def __init__(self, app: ASGIApp, *, max_requests: int = RATE_LIMIT_MAX_REQUESTS,
                 window_seconds: int = RATE_LIMIT_WINDOW_SECONDS) -> None:
        super().__init__(app)
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if self._max_requests <= 0:
            return await call_next(request)

        key = _client_key(request)
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
