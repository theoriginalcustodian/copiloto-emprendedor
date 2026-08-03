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

from _paths import ensure_paths
ensure_paths()

import psycopg2
import uvicorn
from temporalio.client import Client

from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.composio_gateway import ComposioGateway
from clients.agent.providers.crypto import FernetCrypto
from clients.agent.providers.mercadopago_gateway import MercadoPagoGateway

import services
from auth import make_require_claims, make_require_tenant
from calendar_policy import CALENDAR_POLICY
from memory_provider import build_memory_provider
from contexto_tenant import conexion_con_tenant
from mp_credential_store import MpCredentialStore
from mp_payment_store import MpPaymentStore
from mp_web import create_mp_app
from onboarding import GoTrueAdmin
from reply_store import make_pg_reply_sink
from web import (create_web_app, make_abrir_borrador_de_presupuesto, make_confirmar_anulacion,
                 make_confirmar_factura, make_consultar_anulacion,
                 make_consultar_factura,
                 make_consultar_onboarding, make_iniciar_anulacion, make_iniciar_factura,
                 make_signal_anulacion, make_signal_factura, make_start_onboarding,
                 make_start_refresh)
from afip_comprobante_store import AfipComprobanteStore
from afip_credential_store import AfipCredentialStore, AfipPerfilStore, AfipSecretHandoff
from afip_web import create_afip_app
from cobro_store import CobroStore
from concepto_store import ConceptoStore
from trabajo_store import TrabajoStore
from perfil_negocio_store import PerfilNegocioStore
from presupuesto_doc import generar_doc as generar_doc_presupuesto
from presupuesto_store import PresupuestoStore
from presupuestos_web import create_presupuestos_app
from gastos_web import create_gastos_app
from clientes_web import create_clientes_app
from contabilidad_web import create_contabilidad_app
from actividad_web import create_actividad_app
from clients.agent.providers.llm import LlmProvider
from graphity_structured_client import GraphityStructuredClient
from inteligencia_chat import InteligenciaChat, group_id_negocio
from inteligencia_web import create_inteligencia_app
from inteligencia_queries import InteligenciaQueries
from mi_dia_orquestador import avanzar_tablero
from mi_dia_tarjeta_store import TarjetaStore
from mi_dia_web import create_mi_dia_app
from actividad_store import ActividadStore
from cliente_store import ClienteStore
from gasto_store import GastoStore

# Todos con default -> el módulo importa sin reventar aunque el proceso no haya seteado nada
# todavía (los env realmente OBLIGATORIOS -- DATABASE_URL, SUPABASE_JWT_SECRET, COPILOTO_FERNET_KEY,
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

    # Toda conexión nace declarándole a la base de qué tenant es la operación en curso. Sin esto, el
    # RLS con `FORCE` no tendría cómo filtrar y la app vería 0 filas. Ver `contexto_tenant.py`.
    return conexion_con_tenant(conn_factory)


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
    # `COPILOTO_JWT_ISSUER` (opcional): presente cuando el copiloto corre contra su GoTrue DEDICADA
    # → require_tenant valida además el `iss` propio (cierra el SSO-by-accident de la infra compartida).
    # Ausente (legacy / pre-cutover) → sin verificación de iss, comportamiento idéntico al de fusion.
    # iss-enforcement FAIL-CLOSED (review M4): con la GoTrue DEDICADA, `COPILOTO_DEDICATED_GOTRUE=true`
    # (lo setea repoint-env.sh en el cutover). Con el flag en true, la AUSENCIA de COPILOTO_JWT_ISSUER
    # aborta el arranque en vez de desactivar el control en silencio por env-drift. Sin el flag (rollback
    # a fusion, que no valida iss), el issuer es opcional → no rompe el rollback.
    issuer = os.environ.get("COPILOTO_JWT_ISSUER")
    if os.environ.get("COPILOTO_DEDICATED_GOTRUE", "").strip().lower() in ("1", "true", "yes") and not issuer:
        raise RuntimeError(
            "COPILOTO_DEDICATED_GOTRUE=true pero COPILOTO_JWT_ISSUER falta/vacío: el iss-enforcement "
            "quedaría desactivado en silencio (SSO-by-accident reabierto). Fail-closed: seteá el issuer "
            "(o quitá el flag para volver a fusion).")
    require_tenant = make_require_tenant(
        secret=os.environ["SUPABASE_JWT_SECRET"], conn_factory=conn_factory, issuer=issuer)
    # Mismo secreto+issuer, SIN exigir tenant: para el first-login OAuth (Google) donde el user ya
    # existe en GoTrue pero aún no tiene fila de tenant (POST /auth/oauth/ensure-tenant).
    require_claims = make_require_claims(secret=os.environ["SUPABASE_JWT_SECRET"], issuer=issuer)
    gotrue = GoTrueAdmin.from_env()

    mp_app = create_mp_app(
        gateway=mp_gateway, crypto=crypto,
        cred_store_factory=lambda cid: MpCredentialStore(conn_factory, cid, crypto),
        payment_store_factory=lambda cid: MpPaymentStore(conn_factory, cid),
        start_refresh=make_start_refresh(client),
    )
    # AFIP (Ajustes): perfil fiscal + alta ARCA. El alta arranca el workflow durable y el estado se lee
    # por query — la pantalla muestra progreso real durante los minutos que tarda el RPA de AfipSDK.
    afip_app = create_afip_app(
        require_tenant=require_tenant,
        perfil_store_factory=lambda cid: AfipPerfilStore(conn_factory, cid),
        cred_store_factory=lambda cid: AfipCredentialStore(conn_factory, cid, crypto),
        handoff_factory=lambda cid: AfipSecretHandoff(conn_factory, cid, crypto),
        start_onboarding=make_start_onboarding(client),
        consultar_onboarding=make_consultar_onboarding(client),
        comprobante_store_factory=lambda cid: AfipComprobanteStore(conn_factory, cid),
        cobro_store_factory=lambda cid: CobroStore(conn_factory, cid),
        iniciar_factura=make_iniciar_factura(client),
        consultar_factura=make_consultar_factura(client),
        signal_factura=make_signal_factura(client),
        confirmar_factura=make_confirmar_factura(client),
        confirmar_anulacion=make_confirmar_anulacion(client),
        iniciar_anulacion=make_iniciar_anulacion(client),
        consultar_anulacion=make_consultar_anulacion(client),
        signal_anulacion=make_signal_anulacion(client),
        # El MISMO gateway Composio del agente: sirve `drive_conectado` en `GET /afip/estado` para que
        # Ajustes diga el HECHO ("Drive no está conectado") en vez de una advertencia preventiva.
        composio_gateway=composio_gateway,
    )

    # Presupuestos + perfil del negocio. `generar_doc` corre en threadpool desde el endpoint (habla con
    # Google por HTTP sync) y NUNCA hace fallar la creación: el presupuesto vive en Postgres, el Doc es
    # una proyección.
    def _generar_doc(cid: str, presupuesto: dict) -> dict:
        perfil = PerfilNegocioStore(conn_factory, cid).get()
        res = generar_doc_presupuesto(composio_gateway, user_id=str(cid), presupuesto=presupuesto,
                                      perfil_negocio=perfil)
        return res.como_dict()

    presupuestos_app = create_presupuestos_app(
        require_tenant=require_tenant,
        perfil_negocio_store_factory=lambda cid: PerfilNegocioStore(conn_factory, cid),
        presupuesto_store_factory=lambda cid: PresupuestoStore(conn_factory, cid),
        concepto_store_factory=lambda cid: ConceptoStore(conn_factory, cid),
        # El CUIT del tenant sale de su credencial AFIP (única fuente), igual que en `/afip/estado`.
        afip_cred_store_factory=lambda cid: AfipCredentialStore(conn_factory, cid, crypto),
        # Mismo flujo que `/afip/facturas` —el gate de confirmación sigue siendo el único lugar donde
        # se emite— pero el borrador se abre con `make_abrir_borrador_de_presupuesto`, no con
        # `make_iniciar_factura`: acá el `factura_id` deriva del presupuesto para que tocar "Facturar"
        # dos veces devuelva el MISMO borrador en vez de crear otro (ver el docstring del endpoint).
        abrir_borrador=make_abrir_borrador_de_presupuesto(client),
        consultar_factura=make_consultar_factura(client),
        signal_factura=make_signal_factura(client),
        generar_doc=_generar_doc,
    )

    gastos_app = create_gastos_app(
        require_tenant=require_tenant,
        gasto_store_factory=lambda cid: GastoStore(conn_factory, cid),
        trabajo_store_factory=lambda cid: TrabajoStore(conn_factory, cid),
    )

    clientes_app = create_clientes_app(
        require_tenant=require_tenant,
        cliente_store_factory=lambda cid: ClienteStore(conn_factory, cid),
    )

    contabilidad_app = create_contabilidad_app(
        require_tenant=require_tenant,
        cobro_store_factory=lambda cid: CobroStore(conn_factory, cid),
        gasto_store_factory=lambda cid: GastoStore(conn_factory, cid),
        afip_comprobante_store_factory=lambda cid: AfipComprobanteStore(conn_factory, cid),
    )

    actividad_app = create_actividad_app(
        require_tenant=require_tenant,
        actividad_store_factory=lambda cid: ActividadStore(conn_factory, cid),
    )

    # Chat de IN (§3): best-effort, igual que `memory_provider` — sin OPENAI_API_KEY o sin
    # GRAPHITY_GRAFO_* el endpoint sigue vivo (devuelve "No tengo ese dato.", nunca 500). El LLM es
    # el MISMO del motor (`gpt-4o-mini`, decisión backend-a-planificacion 2026-07-23 02:04): cero
    # dependencia nueva, mismo patrón de failover ya probado.
    _chat_llm = (LlmProvider(primary_model="gpt-4o-mini", failover_model="gpt-4o-mini",
                             api_key_env="OPENAI_API_KEY",
                             url="https://api.openai.com/v1/chat/completions", quantizations=())
                if os.environ.get("OPENAI_API_KEY") else None)
    _grafo_client = (GraphityStructuredClient.from_env()
                     if os.environ.get("GRAPHITY_GRAFO_BASE_URL") and os.environ.get("GRAPHITY_GRAFO_API_KEY")
                     else None)
    chat_factory = (
        (lambda cid: InteligenciaChat(queries=InteligenciaQueries(conn_factory, cid), llm=_chat_llm,
                                      grafo_client=_grafo_client, graph_id=group_id_negocio(cid)))
        if _chat_llm is not None and _grafo_client is not None else None)
    print("copiloto chat IN: " + ("ON" if chat_factory is not None else "OFF (falta LLM o Graphity)"),
          flush=True)

    inteligencia_app = create_inteligencia_app(
        require_tenant=require_tenant,
        queries_factory=lambda cid: InteligenciaQueries(conn_factory, cid),
        chat_factory=chat_factory,
    )

    mi_dia_app = create_mi_dia_app(
        require_tenant=require_tenant,
        tarjeta_store_factory=lambda cid: TarjetaStore(conn_factory, cid),
        avanzar_tablero_fn=lambda cid: avanzar_tablero(conn_factory, cid),
    )

    # Solo para normalize_inbound del /chat (route_inbound); el reply_sink real que sirve /reply es
    # el mismo make_pg_reply_sink que usa el worker (Task 5) -- un solo camino de escritura.
    adapter = WebChannelAdapter(reply_sink=make_pg_reply_sink(conn_factory))

    # Warm de la memoria (perceived latency): el front-door precalienta el grafo del emprendedor en
    # `POST /warm` (el front lo dispara al abrir la app / volver al chat, ANTES del 1er mensaje). Se
    # construye desde los MISMOS GRAPHITY_* que el worker (`build_memory_provider`, fuente única) → None si
    # faltan → `/warm` no-op. Best-effort: el warm nunca tumba el turno (es latencia, no correctitud).
    memory_provider = build_memory_provider(os.environ)
    print("copiloto web warm: " + ("ON (Graphity)" if memory_provider is not None
                                    else "OFF (sin GRAPHITY_BASE_URL/API_KEY)"), flush=True)

    app = create_web_app(
        temporal_client=client, adapter=adapter, conn_factory=conn_factory,
        require_tenant=require_tenant, require_claims=require_claims, mp_app=mp_app,
        afip_app=afip_app, presupuestos_app=presupuestos_app, gastos_app=gastos_app,
        clientes_app=clientes_app, contabilidad_app=contabilidad_app, actividad_app=actividad_app,
        inteligencia_app=inteligencia_app,
        mi_dia_app=mi_dia_app,
        gotrue=gotrue,
        mp_gateway=mp_gateway, composio_gateway=composio_gateway,
        warm_fn=(memory_provider.warm if memory_provider is not None else None),
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
