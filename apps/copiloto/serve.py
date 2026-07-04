"""apps/copiloto/serve.py — entrypoint ASGI real del front-door (Task 11, deploy vivo).

Composition root de PRODUCCIÓN: arma TODOS los recursos reales (Temporal client, conn_factory
Postgres, crypto, gateways MP/Composio, GoTrue admin, `require_tenant`) y corre uvicorn EN EL
MISMO event loop que conectó el `Client` de Temporal.

Por qué no `asyncio.run(...)` a nivel de módulo + `uvicorn web:app` desde CLI: `Client.connect` es
async y su conexión queda atada al loop que estaba corriendo en ese momento. Si ese loop se cierra
(como pasaría si se conectara el client con un `asyncio.run` propio y LUEGO se le entregara la app
resultante a un proceso `uvicorn` externo, que abre su PROPIO loop) el client queda huérfano de un
loop muerto -> revienta en el primer request real. La única forma correcta con temporalio + uvicorn
embebido es: UN solo `asyncio.run` que abre el loop una vez, conecta el `Client` DENTRO de ese loop,
arma la app, y le pasa el control a `uvicorn.Server(...).serve()` (coroutine) en el MISMO loop —
nunca `uvicorn.run()`, que arranca su propio loop internamente.

Puerto/host parametrizables (cero hardcoding, regla de oro del proyecto): el default
(127.0.0.1:8099) refleja la ruta Caddy YA registrada en el VPS (`copiloto.*` -> 127.0.0.1:8099,
ver `deploy/copiloto/Caddyfile.snippet`); un 2º entorno solo necesita setear `COPILOTO_WEB_PORT`
distinto, cero refactor.

Import-safe (Task 11 self-review): NINGÚN `os.environ[...]` obligatorio corre a nivel de módulo —
todos viven dentro de `_serve()`, invocado recién al arrancar el proceso real. Permite testear el
wiring (`tests/test_serve.py`) sin Temporal/Postgres/GoTrue reales."""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

ARCH = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import psycopg2
import uvicorn
from temporalio.client import Client

from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.composio_gateway import ComposioGateway
from clients.agent.providers.crypto import FernetCrypto
from clients.agent.providers.mercadopago_gateway import MercadoPagoGateway

import services
from auth import make_require_tenant
from calendar_policy import CALENDAR_POLICY
from mp_credential_store import MpCredentialStore
from mp_payment_store import MpPaymentStore
from mp_web import create_mp_app
from onboarding import GoTrueAdmin
from reply_store import make_pg_reply_sink
from web import create_web_app, make_start_refresh

# Todos con default -> el módulo importa sin reventar aunque el proceso no haya seteado nada
# todavía (los env realmente OBLIGATORIOS -- DATABASE_URL, SUPABASE_JWT_SECRET, MP_FERNET_KEY,
# SUPABASE_URL, SERVICE_ROLE_KEY, MP_CLIENT_ID/SECRET/REDIRECT_URI -- se leen recién dentro de
# `_serve()`, al arrancar el proceso real).
TEMPORAL_TARGET = os.environ.get("TEMPORAL_TARGET", "localhost:7233")
TEMPORAL_NAMESPACE = os.environ.get("TEMPORAL_NAMESPACE", "default")
WEB_HOST = os.environ.get("COPILOTO_WEB_HOST", "127.0.0.1")
WEB_PORT = int(os.environ.get("COPILOTO_WEB_PORT", "8099"))


def _conn_factory_from_env():
    """Mismo patrón que `worker_b.py::main`: una conexión psycopg2 autocommit por invocación. Lazy
    a propósito -- `DATABASE_URL` recién se lee cuando el proceso real arranca `_serve()`, nunca al
    importar el módulo (import-safety, ver docstring)."""
    db_url = os.environ["DATABASE_URL"]

    def conn_factory():
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        return conn

    return conn_factory


async def _serve() -> None:
    """Composition root real, EN el loop del proceso (ver docstring del módulo). Conecta Temporal
    primero (todo lo que dependa de `client` -- `mp_app.start_refresh`, `/chat` -- lo hace desde acá
    en adelante, nunca desde un loop distinto)."""
    client = await Client.connect(TEMPORAL_TARGET, namespace=TEMPORAL_NAMESPACE)

    conn_factory = _conn_factory_from_env()
    crypto = FernetCrypto()
    mp_gateway = MercadoPagoGateway()
    # Misma unión que build_worker_config (worker_b.py): Calendar (verbo 'book') + policies de los
    # módulos de servicio por discovery -- cero drift entre lo que el worker ejecuta y lo que el
    # front-door ofrece conectar (_composio_valid_toolkits en web.py deriva de la MISMA unión).
    composio_gateway = ComposioGateway({**CALENDAR_POLICY, **services.merged_policy()})
    require_tenant = make_require_tenant(secret=os.environ["SUPABASE_JWT_SECRET"], conn_factory=conn_factory)
    gotrue = GoTrueAdmin.from_env()

    mp_app = create_mp_app(
        gateway=mp_gateway, crypto=crypto,
        cred_store_factory=lambda cid: MpCredentialStore(conn_factory, cid, crypto),
        payment_store_factory=lambda cid: MpPaymentStore(conn_factory, cid),
        start_refresh=make_start_refresh(client),
    )
    # Solo para normalize_inbound del /chat (route_inbound); el reply_sink real que sirve /reply es
    # el mismo make_pg_reply_sink que usa el worker (Task 5) -- un solo camino de escritura.
    adapter = WebChannelAdapter(reply_sink=make_pg_reply_sink(conn_factory))

    app = create_web_app(
        temporal_client=client, adapter=adapter, conn_factory=conn_factory,
        require_tenant=require_tenant, mp_app=mp_app, gotrue=gotrue,
        mp_gateway=mp_gateway, composio_gateway=composio_gateway,
        # `transcribe` sin inyectar -- `create_web_app` usa su default de producción
        # (`_default_transcribe`/GroqSTT, lazy sobre `GROQ_API_KEY`); menos invasivo que construirlo
        # acá y no duplica el criterio "cuál transcriber usa /chat/audio" en dos módulos.
    )

    server = uvicorn.Server(uvicorn.Config(app, host=WEB_HOST, port=WEB_PORT, log_level="info"))
    print(f"copiloto web up on {WEB_HOST}:{WEB_PORT} (Temporal {TEMPORAL_TARGET}/{TEMPORAL_NAMESPACE})",
          flush=True)
    await server.serve()


def main() -> None:
    asyncio.run(_serve())


if __name__ == "__main__":
    main()
