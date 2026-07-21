"""Composition root + worker del Agente B (capa CLIENTE).

Registra el dominio 'emprendedor' (system prompt + LlmProvider gpt-4o-mini + dispatcher) y el canal 'web'
(WebChannelAdapter con reply_sink a uc_factory) en el registry del arquetipo, y corre un Worker Temporal
propio con task_queue 'agent-emprendedor'. Proceso SEPARADO del de A (el registry es singleton de módulo).

Multitenant real (Task 8 del plan 2026-07-03): NINGÚN `cliente_id`/`composio_user_id`/seller MP sale de env
— todo per-request vía `context_factory` (ver context_factory.py). El worker sirve N tenants sin fugas; el
`context_factory` arma un `TenantCtx` NUEVO por request desde `conv["cliente_id"]`. También registra
`MpRefreshWorkflow` (refresh durable del token de 180d) y cablea `set_refresh_deps` ANTES de que el worker
empiece a pollear (si no, `refresh_credential` hace `_store_factory(None)` -> TypeError)."""
from __future__ import annotations

import asyncio
import datetime
import os
import sys
from pathlib import Path
from typing import Callable, Mapping

from _paths import ensure_paths
ensure_paths()

from temporalio.client import Client
from temporalio.worker import Worker

from backend.agent.agent_activities import (
    call_llm, call_llm_tools, dispatch_intent, execute_tool, notify_staff, recall_memory,
    remember_memory, send_channel_message, warm_memory)
from backend.agent.agent_runtime import register_channel, register_domain
from backend.agent.conversation_workflow import ConversationWorkflow
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.composio_gateway import ComposioGateway
from clients.agent.providers.crypto import FernetCrypto
from clients.agent.providers.llm import LlmProvider
from clients.agent.providers.mercadopago_gateway import MercadoPagoGateway
from clients.agent.providers.mp_refresh_activities import refresh_credential, set_refresh_deps
from clients.agent.providers.mp_refresh_workflow import MpRefreshWorkflow

import services
import tool_catalog
from afip_anulacion_workflow import AnulacionWorkflow
from afip_comprobante_store import AfipComprobanteStore
from afip_credential_store import AfipCredentialStore, AfipPerfilStore, AfipSecretHandoff
from afip_factura_activities import (
    archivar_factura_en_drive, buscar_comprobante, cargar_contexto_factura, emitir_comprobante,
    generar_pdf_comprobante, listar_comprobantes, marcar_comprobante_anulado, set_drive_deps,
    set_factura_deps)
from afip_factura_workflow import FacturaWorkflow
from afip_gateway import AfipGateway
from afip_onboarding_activities import (
    dar_de_alta_afip, purgar_secretos_vencidos, set_onboarding_deps, verificar_habilitacion_afip)
from afip_onboarding_workflow import AfipOnboardingWorkflow
from calendar_policy import CALENDAR_POLICY
from context_factory import make_context_factory
from dispatcher_emprendedor import make_dispatcher
from mp_credential_store import MpCredentialStore
from mp_dedup_store import MpLinkDedupStore
from memory_provider import build_memory_provider
from reply_store import make_pg_reply_sink
from system_prompt import SYSTEM_PROMPT_REACT

AGENT_B_TASK_QUEUE = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")
OPENAI_API_KEY_ENV = "OPENAI_API_KEY"
# warm_memory/remember_memory SIEMPRE registradas (aunque memory_provider sea None → no-op): si el workflow
# emitiera la command y el worker no sirviera la activity, el turno colgaría hasta el timeout (no falla rápido).
# call_llm_tools/execute_tool/recall_memory: las 3 activities del motor ReAct (engine_mode="react", Task 14).
_ACTIVITIES = [call_llm, dispatch_intent, send_channel_message, notify_staff, warm_memory, remember_memory,
              call_llm_tools, execute_tool, recall_memory]


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat()


def build_llm() -> LlmProvider:
    return LlmProvider(primary_model="gpt-4o-mini", failover_model="gpt-4o-mini",
                       api_key_env=OPENAI_API_KEY_ENV, url="https://api.openai.com/v1/chat/completions",
                       quantizations=())


def build_worker_config(env: Mapping[str, str], conn_factory: Callable) -> dict:
    """Composition root PURO y multitenant real (Task 8): construye los recursos COMPARTIDOS una sola vez
    (crypto, mp_gateway, composio gateway) y arma el `context_factory` que resuelve TODO lo per-tenant
    (`cliente_id`, `composio_user_id`, seller MP) desde el `conv` de cada request — cero
    cliente_id/composio_user_id/seller de env (elimina `COPILOTO_CLIENTE_ID`/`COPILOTO_COMPOSIO_USER_ID`/
    `MP_SELLER_USER_ID`; `MP_WEBHOOK_BASE` sí sale de `env` por ser infra, no identidad de tenant).

    Registra el dominio 'emprendedor' con `context_factory` no-None (ctx SIEMPRE presente en prod;
    `dispatcher_emprendedor.make_dispatcher` es multitenant-only, sin fallback) y el canal 'web'. Cablea
    `set_refresh_deps` ANTES de devolver, para que `MpRefreshWorkflow`/`refresh_credential` puedan correr en
    cuanto el `Worker` arranque a pollear.

    No abre I/O real al construirse (`conn_factory` solo se guarda; recién se invoca cuando una query lo
    necesita) → testeable sin Temporal ni Postgres vivos. Devuelve {workflows, activities, context_factory}
    listos para `Worker(...)`."""
    crypto = FernetCrypto()
    mp_gateway = MercadoPagoGateway()
    # policy = Calendar (verbo 'book') + policies mínimas de los módulos de servicio (discovery)
    gateway = ComposioGateway({**CALENDAR_POLICY, **services.merged_policy()})

    # Memoria de largo plazo (Graphity): se construye desde el `env` PARAM (no os.environ) → testeable con
    # env={} (queda None = sin memoria, el wiring test no necesita Graphity). En prod, copiloto.env aporta
    # GRAPHITY_BASE_URL/API_KEY. Si faltan → OFF EXPLÍCITO (se loguea; no un cliente mudo silencioso).
    memory_provider = build_memory_provider(env)   # fuente única de construcción (compartida con serve.py/`/warm`)
    print("AGENT_B memoria: ON (Graphity)" if memory_provider is not None
          else "AGENT_B memoria: OFF (faltan GRAPHITY_BASE_URL/API_KEY en el env)", flush=True)

    ctx_factory = make_context_factory(conn_factory=conn_factory, crypto=crypto, mp_gateway=mp_gateway,
                                       mp_webhook_base=env.get("MP_WEBHOOK_BASE"),
                                       memory_provider=memory_provider)
    reply_sink = make_pg_reply_sink(conn_factory)

    # Motor ReAct (Task 14): tool_executor real (Composio + MP + calendar) con dedup app-side de links de
    # cobro (spike C) atado al `cliente_id` per-request (nunca de env). El `dispatcher=` se sigue registrando
    # como fallback dispatch/tests legacy; en engine_mode="react" el workflow usa el tool_executor.
    # `llm` COMPARTIDO: clasificador del turno (register_domain), summarizer de 'consultar_actividad' en el
    # dispatcher (recall temporal #125) Y de la MISMA tool en el motor react (tool_executor, PR #137) — mismo
    # modelo/credencial, stateless, sin duplicar construcción. En engine_mode=react 'consultar_actividad' es una
    # tool de 1ra clase READ del tool_catalog (sin gate); en dispatch es una acción del dispatcher. El recall
    # semántico (MemoryProvider) opera en ambos modos por separado (parte del loop, no una tool).
    def _mp_dedup_factory(cliente_id: str):
        return MpLinkDedupStore(conn_factory, cliente_id)

    # En react el prompt NO concatena los PROMPT_FRAGMENT de los servicios: esos están escritos en formato
    # dispatch (`action="tool_action", entities={...}`) y en tool-calling nativo son RUIDO — los TOOL_SCHEMAS
    # (name + description + parameters) ya describen cada tool (auditoría 2026-07-05: 0 matiz de negocio único
    # fuera del schema). Los fragments siguen siendo la fuente del formato action/entities del modo DISPATCH.
    # ⚠️ Deuda gestionada (pre-existente desde el motor react #134, NO la introduce este cambio): el domain
    # registra UN solo system_prompt (el react); `call_llm` (dispatch) y `call_llm_tools` (react) leen el MISMO
    # `dom["system_prompt"]`. Por eso un rollback a engine_mode=dispatch correría el dispatcher con el prompt
    # react → dispatch fallback DEGRADADO (ya lo estaba). Pago (si se necesita rollback funcional): que este
    # composition root arme prompt+engine_mode por `COPILOTO_ENGINE_MODE`. Owner: operador. Ver frentes-abiertos.
    system_prompt_react = SYSTEM_PROMPT_REACT
    llm = build_llm()
    tool_executor = tool_catalog.make_tool_executor(
        gateway, now_iso_provider=_now_iso, mp_dedup_factory=_mp_dedup_factory, llm=llm)
    register_domain("emprendedor", system_prompt=system_prompt_react, llm_provider=llm,
                    dispatcher=make_dispatcher(gateway, now_iso_provider=_now_iso, llm=llm),
                    context_factory=ctx_factory, memory_provider=memory_provider,
                    engine_mode="react", tool_schemas=tool_catalog.build_tool_catalog(),
                    tool_executor=tool_executor)
    register_channel("web", WebChannelAdapter(reply_sink=reply_sink))

    set_refresh_deps(mp_gateway, lambda cliente_id: MpCredentialStore(conn_factory, cliente_id, crypto))

    # AFIP: mismas fábricas per-tenant, cableadas ANTES de que el worker empiece a pollear (igual que
    # set_refresh_deps). El gateway de onboarding se construye SIN cert: todavía no existe — el alta es
    # justamente lo que lo genera.
    # El mismo `crypto` cifra el certificado AFIP y los tokens de MercadoPago. La llave se llama
    # `COPILOTO_FERNET_KEY` —no `MP_FERNET_KEY`— justamente para que su nombre no mienta sobre eso:
    # deuda saldada el 2026-07-21 (ver `crypto.py`). Rotarla es no-destructivo vía COPILOTO_FERNET_KEYS.
    set_onboarding_deps(
        lambda cuit, ambiente="dev": AfipGateway(cuit=cuit, production=(ambiente == "prod")),
        lambda cliente_id: AfipCredentialStore(conn_factory, cliente_id, crypto),
        lambda cliente_id: AfipSecretHandoff(conn_factory, cliente_id, crypto),
    )

    # Emisión/anulación: el gateway acá SÍ se construye con el certificado del tenant (a diferencia
    # del de onboarding, que todavía no tiene ninguno) y en el AMBIENTE de esa credencial — un
    # certificado de producción contra el endpoint de homologación no autentica.
    set_factura_deps(
        lambda cuit, cert, key, ambiente="dev": AfipGateway(
            cuit=cuit, cert=cert, key=key, production=(ambiente == "prod")),
        lambda cliente_id: AfipCredentialStore(conn_factory, cliente_id, crypto),
        lambda cliente_id: AfipPerfilStore(conn_factory, cliente_id),
        lambda cliente_id: AfipComprobanteStore(conn_factory, cliente_id),
    )

    # Archivado del PDF en el Drive del emprendedor: el MISMO gateway Composio que usa el agente, con
    # los slugs de archivado declarados en la policy de `services/drive.py`. Reusarlo trae gratis el
    # manejo de "el toolkit no está conectado" y la versión de policy; construir uno aparte duplicaría
    # esa lógica y se desincronizaría.
    set_drive_deps(gateway)

    return {"workflows": [ConversationWorkflow, MpRefreshWorkflow, AfipOnboardingWorkflow,
                          FacturaWorkflow, AnulacionWorkflow],
            "activities": _ACTIVITIES + [refresh_credential, dar_de_alta_afip,
                                         verificar_habilitacion_afip, purgar_secretos_vencidos,
                                         cargar_contexto_factura, emitir_comprobante,
                                         generar_pdf_comprobante, buscar_comprobante,
                                         listar_comprobantes, marcar_comprobante_anulado,
                                         archivar_factura_en_drive],
            "context_factory": ctx_factory}


async def main() -> None:
    import psycopg2

    db_url = os.environ["DATABASE_URL"]

    def conn_factory():
        c = psycopg2.connect(db_url); c.autocommit = True; return c

    cfg = build_worker_config(os.environ, conn_factory)

    target = os.environ.get("TEMPORAL_TARGET", "localhost:7233")
    client = await Client.connect(target, namespace=os.environ.get("TEMPORAL_NAMESPACE", "default"))
    async with Worker(client, task_queue=AGENT_B_TASK_QUEUE,
                      workflows=cfg["workflows"], activities=cfg["activities"]):
        print(f"AGENT_B worker up on {AGENT_B_TASK_QUEUE}", flush=True)
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
