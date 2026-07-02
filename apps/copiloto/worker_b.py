"""Composition root + worker del Agente B (capa CLIENTE).

Registra el dominio 'emprendedor' (system prompt + LlmProvider gpt-4o-mini + dispatcher) y el canal 'web'
(WebChannelAdapter con reply_sink a uc_factory) en el registry del arquetipo, y corre un Worker Temporal
propio con task_queue 'agent-emprendedor'. Proceso SEPARADO del de A (el registry es singleton de módulo)."""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Callable

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
from clients.agent.providers.llm import LlmProvider

import services
from calendar_policy import CALENDAR_POLICY
from dispatcher_emprendedor import make_dispatcher

AGENT_B_TASK_QUEUE = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")
OPENAI_API_KEY_ENV = "OPENAI_API_KEY"
_ACTIVITIES = [call_llm, dispatch_intent, send_channel_message, notify_staff]


def build_llm() -> LlmProvider:
    return LlmProvider(primary_model="gpt-4o-mini", failover_model="gpt-4o-mini",
                       api_key_env=OPENAI_API_KEY_ENV, url="https://api.openai.com/v1/chat/completions",
                       quantizations=())


def build_registrations(*, gateway, reply_sink: Callable[[str, str, list | None], None],
                        composio_user_id: str, now_iso_provider: Callable[[], str]) -> None:
    from system_prompt import SYSTEM_PROMPT
    # system prompt = base del dominio + fragmentos autodescubiertos de cada servicio (cero edición central)
    system_prompt = SYSTEM_PROMPT + "\n" + services.prompt_fragments()
    register_domain("emprendedor", system_prompt=system_prompt, llm_provider=build_llm(),
                    dispatcher=make_dispatcher(gateway, composio_user_id=composio_user_id,
                                               now_iso_provider=now_iso_provider))
    register_channel("web", WebChannelAdapter(reply_sink=reply_sink))


async def main() -> None:
    import datetime
    import psycopg2
    from reply_store import make_pg_reply_sink

    cliente_id = os.environ["COPILOTO_CLIENTE_ID"]            # tenant sintético
    composio_user_id = os.environ["COPILOTO_COMPOSIO_USER_ID"]
    db_url = os.environ["DATABASE_URL"]

    def conn_factory():
        c = psycopg2.connect(db_url); c.autocommit = True; return c

    def now_iso():
        return datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat()

    # policy = Calendar (verbo 'book') + policies mínimas de los módulos de servicio (discovery)
    gateway = ComposioGateway({**CALENDAR_POLICY, **services.merged_policy()})
    reply_sink = make_pg_reply_sink(conn_factory, cliente_id)
    build_registrations(gateway=gateway, reply_sink=reply_sink,
                        composio_user_id=composio_user_id, now_iso_provider=now_iso)

    target = os.environ.get("TEMPORAL_TARGET", "localhost:7233")
    client = await Client.connect(target, namespace=os.environ.get("TEMPORAL_NAMESPACE", "default"))
    async with Worker(client, task_queue=AGENT_B_TASK_QUEUE,
                      workflows=[ConversationWorkflow], activities=_ACTIVITIES):
        print(f"AGENT_B worker up on {AGENT_B_TASK_QUEUE}", flush=True)
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
