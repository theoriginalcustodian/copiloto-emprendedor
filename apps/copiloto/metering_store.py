"""Metering de uso del agente (BETA-1b) — UNA fila por evento (turno LLM o tool ejecutada).

Patrón de `feedback_store.py`/`gasto_store.py`: `conn_factory` + `cliente_id` fijos en el
constructor. Es el boundary `metering_sink` que el motor invoca desde `agent_activities.py`
(capa PLANTILLA, sin acceso a Postgres) -- acá es donde el evento genérico se vuelve una fila real.

`evento`: `"llm_turno"` (una llamada a `call_llm_tools`, `model`+`tokens` del proveedor real) o
`"tool_call:<status>"` (una tool ejecutada -- `status` es 'ok'/'error'/'rejected'/'needs_confirmation',
ver `ToolResult`; `model` lleva `"tool:<nombre>"` y `tokens` es `None`). Overloadear `model`/`evento`
como "unidad de trabajo" + "resultado" evita 2 columnas nuevas para campos que sólo sirven para
filtrar (`LIKE 'tool:%'`, `LIKE 'tool_call:%'`) -- ver `apps/copiloto/queries/metering_dashboard.sql`
para las queries reales que consumen esta convención (uso, gasto LLM, error-rate por tenant)."""
from __future__ import annotations

from typing import Callable

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_metering"

LLM_TURNO, TOOL_CALL_PREFIX = "llm_turno", "tool_call"


class MeteringStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cliente_id = cliente_id

    def registrar(self, *, session_id: str, model: str, tokens: int | None, evento: str) -> None:
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_TABLE} (cliente_id, session_id, model, tokens, evento) "
                f"VALUES (%s, %s, %s, %s, %s)",
                (self._cliente_id, session_id, model, tokens, evento))
