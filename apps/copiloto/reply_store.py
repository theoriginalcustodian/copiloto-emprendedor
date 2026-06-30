"""Reply store del canal web de B: persiste los replies del agente y los sirve por long-poll.

Tabla copiloto_web_replies (uc_factory). El cursor del long-poll es el `id` bigserial (monotonico).
Aislamiento por tenant: el filtro EXPLICITO (cliente_id, session_id) en cada query es la barrera efectiva de
esta ruta — el worker usa el rol owner de DATABASE_URL, que BYPASSA la policy RLS de la tabla (no hay FORCE
RLS ni JWT context en esta conexion). La policy RLS cubre el acceso via PostgREST/anon, no este camino."""
from __future__ import annotations

import json
from typing import Callable

_SCHEMA = "uc_factory"
_TABLE = f'{_SCHEMA}.copiloto_web_replies'


def make_pg_reply_sink(conn_factory: Callable, cliente_id: str) -> Callable[[str, str, list | None], None]:
    """Devuelve un reply_sink(channel_ref, text, choices) que inserta una fila. conn_factory() -> conexion psycopg2."""
    def _sink(session_id: str, text: str, choices: list | None) -> None:
        conn = conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f'INSERT INTO {_TABLE} (cliente_id, session_id, reply_text, choices) VALUES (%s, %s, %s, %s)',
                (cliente_id, session_id, text, json.dumps(choices) if choices else None))
    return _sink


def read_replies(conn_factory: Callable, cliente_id: str, session_id: str, after_id: int) -> list[dict]:
    """Replies de (cliente_id, session_id) con id > after_id, en orden. Cada dict: {id, reply_text, choices, created_at}."""
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute(
            f'SELECT id, reply_text, choices, created_at FROM {_TABLE} '
            f'WHERE cliente_id = %s AND session_id = %s AND id > %s ORDER BY id',
            (cliente_id, session_id, after_id))
        rows = cur.fetchall()
    out = []
    for rid, text, choices, created in rows:
        out.append({"id": rid, "reply_text": text,
                    "choices": (json.loads(choices) if isinstance(choices, str) else choices),
                    "created_at": str(created)})
    return out
