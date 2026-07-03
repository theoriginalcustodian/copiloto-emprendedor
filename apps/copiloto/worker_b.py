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

from backend.agent.agent_activities import call_llm, dispatch_intent, notify_staff, send_channel_message
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
from calendar_policy import CALENDAR_POLICY
from context_factory import make_context_factory
from dispatcher_emprendedor import make_dispatcher
from mp_credential_store import MpCredentialStore
from reply_store import make_pg_reply_sink
from system_prompt import SYSTEM_PROMPT

AGENT_B_TASK_QUEUE = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")
OPENAI_API_KEY_ENV = "OPENAI_API_KEY"
_ACTIVITIES = [call_llm, dispatch_intent, send_channel_message, notify_staff]


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

    ctx_factory = make_context_factory(conn_factory=conn_factory, crypto=crypto, mp_gateway=mp_gateway,
                                       mp_webhook_base=env.get("MP_WEBHOOK_BASE"))
    reply_sink = make_pg_reply_sink(conn_factory)

    system_prompt = SYSTEM_PROMPT + "\n" + services.prompt_fragments()
    register_domain("emprendedor", system_prompt=system_prompt, llm_provider=build_llm(),
                    dispatcher=make_dispatcher(gateway, now_iso_provider=_now_iso),
                    context_factory=ctx_factory)
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
