"""FastAPI del Agente B: el frontend chatea por POST /chat y recibe replies por long-poll GET /reply.

/chat normaliza el POST y lo rutea al ConversationWorkflow (start-or-signal via route_inbound) — NO espera el
reply (el workflow responde async via send_channel_message -> WebChannelAdapter -> tabla). /reply lee la tabla
de replies con cursor por id. create_app() inyecta dependencias (testeable sin Temporal ni DB reales)."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Callable

ARCH = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI
from pydantic import BaseModel

from backend.agent.inbound_router import route_inbound

AGENT_B_TASK_QUEUE = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")
DOMAIN = "emprendedor"


class ChatIn(BaseModel):
    session_id: str
    text: str
    kind: str = "text"


def create_app(*, temporal_client, adapter, cliente_id: str,
               read_replies_fn: Callable[[str, int], list]) -> FastAPI:
    app = FastAPI(title="Copiloto B")

    @app.post("/chat")
    async def chat(msg: ChatIn) -> dict:
        wf_id = await route_inbound(
            temporal_client, adapter=adapter, cliente_id=cliente_id, domain=DOMAIN,
            task_queue=AGENT_B_TASK_QUEUE,
            raw_update={"session_id": msg.session_id, "text": msg.text, "kind": msg.kind})
        return {"wf_id": wf_id, "accepted": wf_id is not None}

    @app.get("/reply")
    async def reply(session_id: str, after_id: int = 0) -> dict:
        rows = read_replies_fn(session_id, after_id)
        next_id = rows[-1]["id"] if rows else after_id
        return {"replies": rows, "next_id": next_id}

    return app


# El entrypoint de producción del canal web (uvicorn) es follow-up: se cablea cuando se DESPLIEGUE el
# servidor web, junto con su smoke. El composition root (Temporal client + conn_factory + adapter + sink)
# ya está resuelto en worker_b.py/seed.py — replicarlo ahí con `asyncio.run`/lifespan de FastAPI, NO con
# get_event_loop().run_until_complete (frágil en py3.12). No se incluye un build_default_app sin smoke para
# no shipear código de wiring no ejercitado (regla 9 / cero deuda no-gestionada).
