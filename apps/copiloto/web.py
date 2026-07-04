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

import asyncio
import os
import sys
from pathlib import Path
from typing import Callable

ARCH = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from temporalio.common import WorkflowIDConflictPolicy

from backend.agent.inbound_router import route_inbound
from catalog import build_catalog
from clients.agent.providers.crypto import FernetCrypto
from clients.agent.providers.mp_refresh_workflow import MpRefreshWorkflow
from clients.agent.providers.stt import _API_ERRORS as _STT_API_ERRORS
from clients.agent.providers.stt import GroqSTT
from mp_credential_store import MpCredentialStore
from onboarding import InvalidCredentials, signup_and_provision
from reply_store import read_replies as _read_replies

import services
from calendar_policy import CALENDAR_POLICY

AGENT_B_TASK_QUEUE = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")
DOMAIN = "emprendedor"

# MercadoPago refresh (Task 9): el token OAuth del vendedor dura 180 días REALES (contrato MP, no un valor
# desacoplado -- M1 dejó `expires_at` absoluto a partir de ese vencimiento). El intervalo de refresh se ancla
# a ese vencimiento CON COLCHÓN (150d < 180d) para que el token nunca llegue a expirar entre ciclos, incluso si
# un ciclo se demora. MAX_REFRESH_CYCLES acota el history del workflow antes del `continue_as_new` (loop
# indefinido sin inflar el history, ver `mp_refresh_workflow.py`).
REFRESH_INTERVAL_SECONDS = float(os.environ.get("MP_REFRESH_INTERVAL_SECONDS", 150 * 24 * 3600))
MAX_REFRESH_CYCLES = int(os.environ.get("MP_REFRESH_MAX_CYCLES", 20))


def make_start_refresh(temporal_client, *, task_queue: str = AGENT_B_TASK_QUEUE,
                       refresh_interval_seconds: float = REFRESH_INTERVAL_SECONDS,
                       max_cycles: int = MAX_REFRESH_CYCLES) -> Callable:
    """Fábrica de `start_refresh` (hook de `create_mp_app`, Task 9): arranca el `MpRefreshWorkflow` durable
    para UN (cliente_id, seller_user_id) al conectar MercadoPago. `id` determinístico por ese par +
    `id_conflict_policy=USE_EXISTING` -> IDEMPOTENTE (reconectar/re-callback del MISMO seller reusa el loop ya
    corriendo, nunca arranca uno duplicado; spec §Task 9, patrón start-or-signal de `inbound_router.py`).
    `temporal_client` inyectado desde el composition root (Task 11) -- cero hardcoding, testeable con un fake."""

    async def start_refresh(cliente_id: str, seller_user_id: str) -> None:
        await temporal_client.start_workflow(
            MpRefreshWorkflow.run,
            args=[cliente_id, seller_user_id, refresh_interval_seconds, max_cycles],
            id=f"mp-refresh-{cliente_id}-{seller_user_id}",
            task_queue=task_queue,
            id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING,
        )

    return start_refresh


def _composio_valid_toolkits() -> frozenset[str]:
    """Toolkits Composio soportados por ESTE Copiloto, DERIVADOS de la policy real (misma unión que
    `worker_b.py` arma para el `ComposioGateway`: `{**CALENDAR_POLICY, **services.merged_policy()}`)
    — no una lista literal aparte que pueda driftear. Sumar un servicio nuevo en `services/*.py`
    (discovery por archivo, ver `services/__init__.py`) lo agrega acá sin tocar este módulo."""
    return frozenset(CALENDAR_POLICY) | frozenset(services.merged_policy())


def _spa_static_dir() -> Path:
    """Dir del build del cliente PWA (Vite `dist`), servido mismo-origen por el front-door (sin CORS).
    Parametrizable (`COPILOTO_WEB_STATIC_DIR`, cero hardcoding); default relativo al repo
    (`apps/copiloto-web/dist`, que produce `deploy/copiloto/sync-web.sh` en el VPS)."""
    env = os.environ.get("COPILOTO_WEB_STATIC_DIR")
    return Path(env) if env else Path(__file__).resolve().parents[2] / "apps/copiloto-web/dist"


def _mount_spa(app: FastAPI, static_dir: Path | None = None) -> bool:
    """Monta la PWA build mismo-origen SOLO si ya existe (`index.html`). Import-safe: sin build, el
    front-door queda API-only (no rompe -- el spike de serving lo activa cuando el build llega).

    Se llama DESPUÉS de todas las rutas de API + el router de MP: las rutas explícitas se registran
    primero -> Starlette las matchea primero; el catch-all GET solo atrapa lo NO matcheado (las rutas
    de cliente de la SPA, ej. /login, /conexiones) y devuelve `index.html` (routing client-side).
    Los assets reales (js/css bajo /assets, más manifest/iconos/sw en la raíz) se sirven tal cual."""
    d = static_dir or _spa_static_dir()
    index = d / "index.html"
    if not index.is_file():
        return False
    assets = d / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        candidate = d / full_path
        if full_path and candidate.is_file() and candidate.resolve().is_relative_to(d.resolve()):
            return FileResponse(str(candidate))
        return FileResponse(str(index))  # fallback SPA (client-side routing)

    return True


class ChatIn(BaseModel):
    session_id: str
    text: str
    kind: str = "text"


def _filename_for_content_type(content_type: str) -> str:
    """Deriva el filename (`audio.<ext>`) del Content-Type MIME real que sube el browser
    (`audio/webm`, `audio/ogg`, `audio/mp4`, ...) -- Groq valida el formato por la EXTENSIÓN del
    filename del multipart, no por el Content-Type (ver docstring de `GroqSTT`, spike S4/Motor C)."""
    subtype = (content_type or "audio/ogg").split(";")[0].split("/")[-1] or "ogg"
    return f"audio.{subtype}"


def _default_transcribe(audio_bytes: bytes, content_type: str) -> str:
    """Transcriber por default de `/chat/audio` (voz-backend): `GroqSTT` real. Se construye ACÁ
    DENTRO -- recién se instancia/usa cuando `/chat/audio` recibe un request real, nunca al armar
    la app (import-safety, mismo criterio que `serve.py`). Si falta `GROQ_API_KEY` en el env,
    `GroqSTT.transcribe` levanta `RuntimeError` explícito (ver stt.py); la ruta lo traduce a 503
    sin romper el resto del front-door (texto por `/chat` sigue andando igual)."""
    return GroqSTT().transcribe(audio_bytes, filename=_filename_for_content_type(content_type),
                                content_type=content_type or "audio/ogg")


class SignupIn(BaseModel):
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


def create_web_app(*, temporal_client, adapter, conn_factory: Callable, require_tenant: Callable,
                   mp_app: FastAPI, gotrue, mp_gateway, composio_gateway,
                   read_replies_fn: Callable[[str, str, int], list] | None = None,
                   transcribe: Callable[[bytes, str], str] | None = None) -> FastAPI:
    """Composition root del front-door (spec §3). `read_replies_fn(cliente_id, session_id, after_id)
    -> list`; si no se inyecta, usa el default de producción (`reply_store.read_replies` atado al
    `conn_factory`). El `crypto` de `/me`/`/mp/connect` se construye acá (lee `MP_FERNET_KEY` del
    env, mismo patrón que `mp_web.py`/`context_factory.py`).

    `mp_gateway` (`MercadoPagoGateway`, Task 7 spec §7): arma la URL de conexión OAuth per-tenant en
    `/mp/connect` (mismo patrón que `mp_connect.py` CLI, `state = crypto.encrypt(cliente_id)`).
    `composio_gateway` (`ComposioGateway`): habilita `/composio/connect?service=<toolkit>` (onboarding
    per-tenant, `user_id=cliente_id`) y alimenta `composio_connected` en `/me`. Ambos inyectados desde
    el composition root (Task 11) — cero hardcoding, testeables con fakes.

    `transcribe(audio_bytes, content_type) -> str` (voz-backend): STT de `/chat/audio`. Si no se
    inyecta, usa `_default_transcribe` (GroqSTT real, construido LAZY -- import-safe aunque
    `GROQ_API_KEY` no esté seteado; solo revienta si `/chat/audio` recibe un request real sin key,
    y ahí la ruta lo traduce a 503). Los tests inyectan un fake."""
    read_replies_fn = read_replies_fn or (
        lambda cliente_id, session_id, after_id: _read_replies(conn_factory, cliente_id, session_id, after_id))
    transcribe = transcribe or _default_transcribe
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

    @app.post("/chat/audio")
    async def chat_audio(session_id: str = Form(...), audio: UploadFile = File(...),
                         cliente_id: str = Depends(require_tenant)) -> dict:
        """Front-door de voz (voz-backend): transcribe la nota de voz y la mete al MISMO flujo que
        `/chat` -- la voz es solo OTRA fuente de texto para el agente, nunca un dispatch aparte.
        `async def` (igual que `/chat`: `await route_inbound`), pero la transcripción es I/O
        BLOQUEANTE (GroqSTT usa `urllib` síncrono) -> `asyncio.to_thread` la corre en threadpool
        para no bloquear el event loop del resto de tenants (mismo criterio de escala que las
        rutas `def`)."""
        audio_bytes = await audio.read()
        content_type = audio.content_type or "audio/ogg"
        try:
            transcript = await asyncio.to_thread(transcribe, audio_bytes, content_type)
        except RuntimeError as e:
            # GroqSTT levanta RuntimeError explícito si falta GROQ_API_KEY (ver stt.py) -- 503 (no
            # configurado), NO 500: el resto del front-door (texto por /chat) sigue andando igual.
            raise HTTPException(status_code=503, detail="voz no configurada") from e
        except _STT_API_ERRORS as e:
            raise HTTPException(status_code=502, detail="error del servicio de transcripción") from e
        transcript = (transcript or "").strip()
        if not transcript:
            # Vacío O solo-espacios (el STT no captó nada útil) -> 422; nunca despachamos un
            # mensaje en blanco al agente.
            raise HTTPException(status_code=422, detail="no se entendió el audio")
        wf_id = await route_inbound(
            temporal_client, adapter=adapter, cliente_id=cliente_id, domain=DOMAIN,
            task_queue=AGENT_B_TASK_QUEUE,
            raw_update={"session_id": session_id, "text": transcript, "kind": "text"})
        return {"wf_id": wf_id, "accepted": wf_id is not None, "transcript": transcript}

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

    @app.get("/catalog")
    def catalog(cliente_id: str = Depends(require_tenant)) -> dict:
        """Catálogo de servicios de ESTE tenant (Task 6, handoff §7.7): mismo cálculo mp_connected/
        composio_connected que `/me`, pero con la metadata de presentación (`catalog.build_catalog`,
        capa PURA sin imports de temporal/fastapi -- testeable aislado). `valid_toolkits` sale
        SIEMPRE de `_composio_valid_toolkits()` (derivado de la policy real), nunca de una lista
        literal que pueda driftear de `/composio/connect`."""
        seller = MpCredentialStore(conn_factory, cliente_id, crypto).first_seller_user_id()
        composio_connected = [c["toolkit"] for c in composio_gateway.list_connections(cliente_id)
                              if (c["status"] or "").upper() == "ACTIVE"]
        return {"services": build_catalog(valid_toolkits=_composio_valid_toolkits(),
                                          mp_connected=seller is not None,
                                          composio_connected=composio_connected)}

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

    @app.post("/auth/login")
    def login(body: LoginIn) -> dict:
        """Proxy de login mismo-origen (Task 6): el frontend NUNCA habla directo con GoTrue (sin
        CORS, sin anon key en el browser) -- manda email/password acá y este endpoint hace el
        password-grant server-side (`GoTrueAdmin.password_grant`) y reenvía el token tal cual.
        `def` (no async): password_grant es I/O bloqueante sync (httpx.Client) -> threadpool, mismo
        criterio que /auth/signup. Nunca loguea password ni token (regla dura de secretos)."""
        try:
            return gotrue.password_grant(body.email, body.password)
        except InvalidCredentials:
            raise HTTPException(status_code=401, detail="credenciales inválidas")

    @app.get("/healthz")
    def healthz() -> dict:
        return {"status": "ok"}

    # `/mp/callback` y `/mp/webhook` ya construidos en `mp_app` (create_mp_app) con su propia
    # barrera (state cifrado / x-signature). `include_router` copia sus rutas absolutas al front-door
    # SIN heredar `require_tenant` -- MercadoPago no manda JWT del tenant en sus llamadas.
    app.include_router(mp_app.router)

    # SPA mismo-origen (Task 8): se monta al final -> no ensombrece ninguna ruta de API/MP de arriba.
    # No-op si todavía no hay build (front-door API-only hasta que `sync-web.sh` produzca el `dist`).
    _mount_spa(app)

    return app
