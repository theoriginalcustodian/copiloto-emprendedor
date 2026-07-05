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

ARCH = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parent))

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
    # `llm` COMPARTIDO: clasificador del turno (register_domain) Y summarizer de la acción 'consultar_actividad'
    # (dispatcher, recall temporal #125) — mismo modelo/credencial, stateless, sin duplicar construcción.
    # ⚠️ Deuda visible (merge motor-react × recall-temporal): en engine_mode=react 'consultar_actividad' vive
    # SOLO en el dispatcher (modo dispatch), aún NO en el tool_catalog → el recall temporal POR FECHA ("qué hice
    # ayer") no está disponible en react. Follow-up: portarla como tool. El recall semántico (MemoryProvider)
    # sí opera en ambos modos.
    def _mp_dedup_factory(cliente_id: str):
        return MpLinkDedupStore(conn_factory, cliente_id)

    tool_executor = tool_catalog.make_tool_executor(
        gateway, now_iso_provider=_now_iso, mp_dedup_factory=_mp_dedup_factory)
    system_prompt_react = SYSTEM_PROMPT_REACT + "\n" + services.prompt_fragments()
    llm = build_llm()
    register_domain("emprendedor", system_prompt=system_prompt_react, llm_provider=llm,
                    dispatcher=make_dispatcher(gateway, now_iso_provider=_now_iso, llm=llm),
                    context_factory=ctx_factory, memory_provider=memory_provider,
                    engine_mode="react", tool_schemas=tool_catalog.build_tool_catalog(),
                    tool_executor=tool_executor)
    register_channel("web", WebChannelAdapter(reply_sink=reply_sink))

    set_refresh_deps(mp_gateway, lambda cliente_id: MpCredentialStore(conn_factory, cliente_id, crypto))

    return {"workflows": [ConversationWorkflow, MpRefreshWorkflow],
            "activities": _ACTIVITIES + [refresh_credential],
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
