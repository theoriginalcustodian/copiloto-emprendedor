"""apps/copiloto/web.py — front-door único del Copiloto (Task 6, spec §3/§7).

Ensambla en UN solo ASGI app: el BFF (`/chat`,`/reply`) tras auth per-request (`require_tenant`
inyectado, Task 2), el onboarding admin-mediado (`/auth/signup`, sin auth, Task 3), el estado del
tenant (`/me`, con auth), liveness (`/healthz`, sin auth) y el router de MercadoPago (`/mp/*`, Task
previa) EXENTO de auth — su barrera es propia (state cifrado / x-signature, spec §5.3).

Reemplaza a `apps/copiloto/app.py::create_app` (single-tenant, `cliente_id` horneado en el closure):
mantener las dos puertas de entrada sería deuda no-gestionada (regla dura del proyecto — "cero
fricción para escalar", CLAUDE.md §4.9). `app.py` re-exporta `create_web_app` para no romper imports
históricos (ver docstring de `app.py`).

Multitenant real (regla dura, spec §5): `cliente_id` en `/chat`,`/reply`,`/me` sale SIEMPRE del
`require_tenant` per-request (`Depends`), nunca de un valor horneado — el mismo front-door sirve N
tenants sin fugas. Todas las deps (`require_tenant`, `conn_factory`, `gotrue`, `mp_app`, `adapter`,
`temporal_client`) se inyectan desde el composition root -> testeable sin Temporal/DB/GoTrue reales."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Callable

ARCH = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from backend.agent.inbound_router import route_inbound
from clients.agent.providers.crypto import FernetCrypto
from mp_credential_store import MpCredentialStore
from onboarding import signup_and_provision
from reply_store import read_replies as _read_replies

import services
from calendar_policy import CALENDAR_POLICY

AGENT_B_TASK_QUEUE = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")
DOMAIN = "emprendedor"


def _composio_valid_toolkits() -> frozenset[str]:
    """Toolkits Composio soportados por ESTE Copiloto, DERIVADOS de la policy real (misma unión que
    `worker_b.py` arma para el `ComposioGateway`: `{**CALENDAR_POLICY, **services.merged_policy()}`)
    — no una lista literal aparte que pueda driftear. Sumar un servicio nuevo en `services/*.py`
    (discovery por archivo, ver `services/__init__.py`) lo agrega acá sin tocar este módulo."""
    return frozenset(CALENDAR_POLICY) | frozenset(services.merged_policy())


class ChatIn(BaseModel):
    session_id: str
    text: str
    kind: str = "text"


class SignupIn(BaseModel):
    email: str
    password: str


def create_web_app(*, temporal_client, adapter, conn_factory: Callable, require_tenant: Callable,
                   mp_app: FastAPI, gotrue, mp_gateway, composio_gateway,
                   read_replies_fn: Callable[[str, str, int], list] | None = None) -> FastAPI:
    """Composition root del front-door (spec §3). `read_replies_fn(cliente_id, session_id, after_id)
    -> list`; si no se inyecta, usa el default de producción (`reply_store.read_replies` atado al
    `conn_factory`). El `crypto` de `/me`/`/mp/connect` se construye acá (lee `MP_FERNET_KEY` del
    env, mismo patrón que `mp_web.py`/`context_factory.py`).

    `mp_gateway` (`MercadoPagoGateway`, Task 7 spec §7): arma la URL de conexión OAuth per-tenant en
    `/mp/connect` (mismo patrón que `mp_connect.py` CLI, `state = crypto.encrypt(cliente_id)`).
    `composio_gateway` (`ComposioGateway`): habilita `/composio/connect?service=<toolkit>` (onboarding
    per-tenant, `user_id=cliente_id`) y alimenta `composio_connected` en `/me`. Ambos inyectados desde
    el composition root (Task 11) — cero hardcoding, testeables con fakes."""
    read_replies_fn = read_replies_fn or (
        lambda cliente_id, session_id, after_id: _read_replies(conn_factory, cliente_id, session_id, after_id))
    crypto = FernetCrypto()

    app = FastAPI(title="Copiloto — front-door")

    # --- BFF: EXIGE tenant (auth per-request, spec §5.2) ------------------------

    @app.post("/chat")
    async def chat(msg: ChatIn, cliente_id: str = Depends(require_tenant)) -> dict:
        wf_id = await route_inbound(
            temporal_client, adapter=adapter, cliente_id=cliente_id, domain=DOMAIN,
            task_queue=AGENT_B_TASK_QUEUE,
            raw_update={"session_id": msg.session_id, "text": msg.text, "kind": msg.kind})
        return {"wf_id": wf_id, "accepted": wf_id is not None}

    # `def` (NO `async def`): estas rutas hacen I/O BLOQUEANTE síncrono (psycopg2 en
    # read_replies/MpCredentialStore, httpx sync en signup_and_provision). FastAPI corre las rutas
    # `def` en su threadpool anyio -> el I/O no bloquea el event loop, así N requests multitenant no
    # se serializan (regla de oro "cero fricción para escalar"). `/chat` SÍ es `async def` porque
    # genuinamente hace `await route_inbound(...)` (I/O async del cliente Temporal).

    @app.get("/reply")
    def reply(session_id: str, after_id: int = 0, cliente_id: str = Depends(require_tenant)) -> dict:
        rows = read_replies_fn(cliente_id, session_id, after_id)
        next_id = rows[-1]["id"] if rows else after_id
        return {"replies": rows, "next_id": next_id}

    @app.get("/me")
    def me(cliente_id: str = Depends(require_tenant)) -> dict:
        seller = MpCredentialStore(conn_factory, cliente_id, crypto).first_seller_user_id()
        composio_connected = [c["toolkit"] for c in composio_gateway.list_connections(cliente_id)
                              if (c["status"] or "").upper() == "ACTIVE"]
        return {"cliente_id": cliente_id, "mp_connected": seller is not None,
                "composio_connected": composio_connected}

    # --- Connect flows per-tenant (Task 7, spec §7) -----------------------------
    # `def` (no `async def`): ambas rutas hacen I/O bloqueante sync (crypto + HTTP del gateway real)
    # -> threadpool, mismo criterio que /reply,/me,/auth/signup.

    @app.get("/mp/connect")
    def mp_connect(cliente_id: str = Depends(require_tenant)) -> dict:
        """URL de conexión OAuth de MercadoPago para ESTE tenant (mismo patrón que `mp_connect.py`
        CLI): el `state` cifra el `cliente_id` del token -> `/mp/callback` lo descifra y ata las
        credenciales a ESE tenant, nunca a otro (spec §7)."""
        return {"url": mp_gateway.connect_url(crypto.encrypt(cliente_id))}

    @app.get("/composio/connect")
    def composio_connect(service: str = "", cliente_id: str = Depends(require_tenant)) -> dict:
        """URL de conexión de un toolkit Composio para ESTE tenant (`user_id=cliente_id`, spec §7).
        `service` se valida contra los toolkits DERIVADOS de la policy real (`_composio_valid_toolkits`)
        -- nunca se reenvía un toolkit arbitrario al gateway (fail-closed ante slugs inventados)."""
        if service not in _composio_valid_toolkits():
            raise HTTPException(status_code=400, detail=f"service inválido o desconocido: {service!r}")
        return {"url": composio_gateway.authorize(user_id=cliente_id, toolkit=service)}

    # --- SIN auth (spec §5.3) ---------------------------------------------------

    @app.post("/auth/signup")
    def signup(body: SignupIn) -> dict:
        # Admin-mediado (disable_signup:true en fusion): crea el user + la fila `tenants` + el
        # claim (Task 3). Sin `require_tenant` -- todavía no hay tenant al momento del signup.
        # `def` (no async): httpx sync + psycopg2 -> threadpool, no bloquea el loop.
        return signup_and_provision(email=body.email, password=body.password, gotrue=gotrue,
                                    conn_factory=conn_factory)

    @app.get("/healthz")
    def healthz() -> dict:
        return {"status": "ok"}

    # `/mp/callback` y `/mp/webhook` ya construidos en `mp_app` (create_mp_app) con su propia
    # barrera (state cifrado / x-signature). `include_router` copia sus rutas absolutas al front-door
    # SIN heredar `require_tenant` -- MercadoPago no manda JWT del tenant en sus llamadas.
    app.include_router(mp_app.router)

    return app
