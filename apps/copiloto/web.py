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

from fastapi import Depends, FastAPI
from pydantic import BaseModel

from backend.agent.inbound_router import route_inbound
from clients.agent.providers.crypto import FernetCrypto
from mp_credential_store import MpCredentialStore
from onboarding import signup_and_provision
from reply_store import read_replies as _read_replies

AGENT_B_TASK_QUEUE = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")
DOMAIN = "emprendedor"


class ChatIn(BaseModel):
    session_id: str
    text: str
    kind: str = "text"


class SignupIn(BaseModel):
    email: str
    password: str


def create_web_app(*, temporal_client, adapter, conn_factory: Callable, require_tenant: Callable,
                   mp_app: FastAPI, gotrue,
                   read_replies_fn: Callable[[str, str, int], list] | None = None) -> FastAPI:
    """Composition root del front-door (spec §3). `read_replies_fn(cliente_id, session_id, after_id)
    -> list`; si no se inyecta, usa el default de producción (`reply_store.read_replies` atado al
    `conn_factory`). El `crypto` de `/me` se construye acá (lee `MP_FERNET_KEY` del env, mismo patrón
    que `mp_web.py`/`context_factory.py`) — `/me` no necesita descifrar nada, solo saber si el
    tenant tiene un seller MercadoPago guardado."""
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

    @app.get("/reply")
    async def reply(session_id: str, after_id: int = 0, cliente_id: str = Depends(require_tenant)) -> dict:
        rows = read_replies_fn(cliente_id, session_id, after_id)
        next_id = rows[-1]["id"] if rows else after_id
        return {"replies": rows, "next_id": next_id}

    @app.get("/me")
    async def me(cliente_id: str = Depends(require_tenant)) -> dict:
        seller = MpCredentialStore(conn_factory, cliente_id, crypto).first_seller_user_id()
        return {"cliente_id": cliente_id, "mp_connected": seller is not None}

    # --- SIN auth (spec §5.3) ---------------------------------------------------

    @app.post("/auth/signup")
    async def signup(body: SignupIn) -> dict:
        # Admin-mediado (disable_signup:true en fusion): crea el user + la fila `tenants` + el
        # claim (Task 3). Sin `require_tenant` -- todavía no hay tenant al momento del signup.
        return signup_and_provision(email=body.email, password=body.password, gotrue=gotrue,
                                    conn_factory=conn_factory)

    @app.get("/healthz")
    async def healthz() -> dict:
        return {"status": "ok"}

    # `/mp/callback` y `/mp/webhook` ya construidos en `mp_app` (create_mp_app) con su propia
    # barrera (state cifrado / x-signature). `include_router` copia sus rutas absolutas al front-door
    # SIN heredar `require_tenant` -- MercadoPago no manda JWT del tenant en sus llamadas.
    app.include_router(mp_app.router)

    return app
