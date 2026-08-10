"""Composition root + worker del Agente de Soporte (SOP4/SOP5, C1) -- capa CLIENTE.

Registra UN dominio ('soporte_tecnico'), `engine_mode='react'` sobre el MISMO motor durable
(`ConversationWorkflow`) que usa 'emprendedor' (worker_b.py) -- pero con system prompt y toolset
PROPIOS (C1: "no comparte el cerebro del copiloto"). Un solo dominio y no dos, porque el DoD
versionado (PR #357, `01-DOD-...md` §F0) fija `domain`/`task_queue` como constantes DEL SERVIDOR en
`POST /soporte/chat` -- no hay parámetro de "función" que decida cuál de dos dominios arrancar; la
distinción soporte-técnico-vs-cómo-uso-la-app (MAESTRO §9.1) la hace el propio agente al elegir
`canal` en `crear_ticket_de_soporte`, no el wiring de Temporal (ver `soporte_system_prompts.py`).
`feedback` NO es un tercer dominio: sigue el camino ya existente (`soporte_feedback_workflow`/
`_activities`, one-shot, sin hilo -- MAESTRO §9.3), corre en el worker de 'emprendedor', no acá.

Proceso SEPARADO (task_queue propio `SOPORTE_TASK_QUEUE`, C1 lo exige) -- mismo criterio que A/B: el
registry de `agent_runtime` es singleton de MÓDULO, así que un proceso propio es la única forma de que
'emprendedor' y 'soporte' no compartan namespace de dominios ni de activities en runtime."""
from __future__ import annotations

import asyncio
import os

from _paths import ensure_paths
ensure_paths()

from temporalio.client import Client
from temporalio.worker import Worker

from backend.agent.agent_activities import (
    call_llm_tools, execute_tool, notify_staff, recall_memory, remember_memory, send_channel_message,
    warm_memory)
from backend.agent.agent_runtime import register_channel, register_domain
from backend.agent.conversation_workflow import ConversationWorkflow
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.llm import LlmProvider

from contexto_tenant import conexion_con_tenant
from interceptor_errores import CapturaDeErroresInterceptor
from deposito_traumas import fabrica_desde
from reply_store import make_pg_reply_sink
from soporte_agent_tools import TOOL_SCHEMAS_SOPORTE, make_soporte_tool_executor
from soporte_clasificador import SoporteClasificador
from soporte_context import make_soporte_context_factory
from soporte_feedback_activities import set_soporte_feedback_deps
from soporte_store import SOPORTE_TECNICO, TicketStore
from soporte_system_prompts import SYSTEM_PROMPT_SOPORTE
from orquestador_rag_client import build_rag_client_factory
from trauma_store import TraumaStore

SOPORTE_TASK_QUEUE = os.environ.get("SOPORTE_TASK_QUEUE", "agent-soporte")
OPENAI_API_KEY_ENV = "OPENAI_API_KEY"
# El namespace del RAG por función -- "cómo uso la app" busca en la KB de producto; "soporte técnico"
# en la misma KB (comparte corpus de usuario, MAESTRO §1: un solo corpus "cómo usar la app"). Ambas
# funciones consultan el MISMO namespace a propósito: no hay un corpus de soporte técnico separado.
_RAG_NAMESPACE = os.environ.get("RAG_ORQUESTADOR_NAMESPACE", "copiloto-howto")

# call_llm/dispatch_intent quedan afuera: este domain SIEMPRE corre engine_mode='react' (nunca dispatch,
# nunca clasifica por JSON-mode). warm_memory/remember_memory registradas igual que en A/B: si el
# workflow emitiera la command (memory_provider no-None) y el worker no la sirviera, el turno colgaría
# hasta el timeout en vez de fallar rápido -- acá quedan como NO-OP porque memory_provider=None (C3: el
# historial de 20 turnos ya es nativo del motor, sin memoria de largo plazo Graphity para este dominio).
_ACTIVITIES = [call_llm_tools, execute_tool, send_channel_message, notify_staff, warm_memory,
              remember_memory, recall_memory]


def build_llm() -> LlmProvider:
    return LlmProvider(primary_model="gpt-4o-mini", failover_model="gpt-4o-mini",
                       api_key_env=OPENAI_API_KEY_ENV, url="https://api.openai.com/v1/chat/completions",
                       quantizations=())


def build_worker_config(env, conn_factory) -> dict:
    """Composition root PURO (testeable sin Temporal/Postgres vivos -- mismo criterio que
    `worker_b.build_worker_config`): `conn_factory` sólo se guarda en las factories, no se invoca acá.

    `graphity_code_client=None` si faltan `GRAPHITY_CODE_BASE_URL`/`_API_KEY` -- apagado explícito
    (mismo criterio que `SoporteClasificador.from_env`), no un import que tumba el worker."""
    ctx_factory = make_soporte_context_factory()
    reply_sink = make_pg_reply_sink(conn_factory)
    rag_client_factory = build_rag_client_factory(_RAG_NAMESPACE, env)

    def _trauma_store_factory(cliente_id: str) -> TraumaStore:
        return TraumaStore(conn_factory, cliente_id)

    def _ticket_store_factory(cliente_id: str) -> TicketStore:
        return TicketStore(conn_factory, cliente_id)

    graphity_code_client = None
    if env.get("GRAPHITY_CODE_BASE_URL") and env.get("GRAPHITY_CODE_API_KEY"):
        try:
            graphity_code_client = SoporteClasificador.from_env()
        except RuntimeError:
            graphity_code_client = None  # apagado explícito (mismo criterio que abajo): C9 degrada a
            # "no encontré dónde está" en vez de tumbar el worker por una feature opcional
    print("SOPORTE grafo de código: ON" if graphity_code_client is not None
          else "SOPORTE grafo de código: OFF (faltan GRAPHITY_CODE_BASE_URL/_API_KEY -- C9 degrada "
               "a 'no encontré dónde está' en vez de citar)", flush=True)

    # D1: `_run_crear_ticket` (soporte_agent_tools) llama `clasificar_y_depositar` -- necesita ESTE
    # `conn_factory` seteado en el módulo de `soporte_feedback_activities`, proceso propio (task_queue
    # separado de worker_b): sus globals de módulo NO se comparten entre procesos. Reusa el MISMO
    # `graphity_code_client` que arriba -- una sola conexión HTTP al grafo, no dos.
    set_soporte_feedback_deps(conn_factory, graphity_code_client)

    tool_executor = make_soporte_tool_executor(
        rag_client_factory=rag_client_factory, trauma_store_factory=_trauma_store_factory,
        ticket_store_factory=_ticket_store_factory, graphity_code_client=graphity_code_client)

    llm = build_llm()
    # `dispatcher=None`: este domain no tiene fallback a engine_mode='dispatch' (siempre react, a
    # diferencia de 'emprendedor' que preserva el dispatcher legacy). `register_domain` lo acepta.
    register_domain(SOPORTE_TECNICO, system_prompt=SYSTEM_PROMPT_SOPORTE, llm_provider=llm,
                    dispatcher=None, context_factory=ctx_factory, memory_provider=None,
                    engine_mode="react", tool_schemas=TOOL_SCHEMAS_SOPORTE, tool_executor=tool_executor)
    register_channel("web", WebChannelAdapter(reply_sink=reply_sink))

    return {"workflows": [ConversationWorkflow], "activities": _ACTIVITIES,
            "context_factory": ctx_factory}


async def main() -> None:
    import psycopg2

    db_url = os.environ["DATABASE_URL"]

    def _conn_crudo():
        c = psycopg2.connect(db_url); c.autocommit = True; return c

    conn_factory = conexion_con_tenant(_conn_crudo)
    cfg = build_worker_config(os.environ, conn_factory)

    target = os.environ.get("TEMPORAL_TARGET", "localhost:7233")
    client = await Client.connect(target, namespace=os.environ.get("TEMPORAL_NAMESPACE", "default"))

    async with Worker(client, task_queue=SOPORTE_TASK_QUEUE,
                      workflows=cfg["workflows"], activities=cfg["activities"],
                      interceptors=[CapturaDeErroresInterceptor(fabrica_desde(conn_factory))]):
        print(f"SOPORTE worker up on {SOPORTE_TASK_QUEUE}", flush=True)
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
