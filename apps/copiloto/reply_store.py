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


def make_pg_reply_sink(conn_factory: Callable) -> Callable[..., None]:
    """Devuelve un reply_sink(cliente_id, session_id, text, choices, card=None, idem_key=None) que inserta una
    fila. `cliente_id` llega POR LLAMADA (per-request), no horneado en el closure -- un solo worker puede servir
    N tenants sin fugas. `card` = metadata OPCIONAL de presentacion del reply (ej HITL {'service','label'});
    None/{} -> NULL en la fila. conn_factory() -> conexion psycopg2.

    `idem_key` identifica el ENVÍO. La activity `send_channel_message` se reintenta, y sin clave el
    emprendedor veía el mismo mensaje dos veces en el chat: el envío se concretó y el worker murió antes
    de reportarlo. El deduplicado lo hace el índice único parcial `(cliente_id, idem_key)` con
    `ON CONFLICT DO NOTHING`, no un SELECT previo — "si ya existe no insertes" deja abierta la ventana
    entre la consulta y el INSERT, que es justo donde caen los dos intentos que esto viene a evitar.
    Sin `idem_key` (llamadores viejos, canales que no la puedan generar) se inserta como siempre: el
    índice es parcial y no los toca."""
    def _sink(cliente_id: str, session_id: str, text: str, choices: list | None,
              card: dict | None = None, *, idem_key: str | None = None) -> None:
        conn = conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f'INSERT INTO {_TABLE} (cliente_id, session_id, reply_text, choices, card, idem_key) '
                f'VALUES (%s, %s, %s, %s, %s, %s) '
                f'ON CONFLICT (cliente_id, idem_key) WHERE idem_key IS NOT NULL DO NOTHING',
                (cliente_id, session_id, text, json.dumps(choices) if choices else None,
                 json.dumps(card) if card else None, idem_key))
    return _sink


def read_replies(conn_factory: Callable, cliente_id: str, session_id: str, after_id: int) -> list[dict]:
    """Replies de (cliente_id, session_id) con id > after_id, en orden. Cada dict:
    {id, reply_text, choices, card, created_at}. `card` = metadata de presentacion (ej HITL {'service','label'}) o None."""
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute(
            f'SELECT id, reply_text, choices, card, created_at FROM {_TABLE} '
            f'WHERE cliente_id = %s AND session_id = %s AND id > %s ORDER BY id',
            (cliente_id, session_id, after_id))
        rows = cur.fetchall()
    out = []
    for rid, text, choices, card, created in rows:
        out.append({"id": rid, "reply_text": text,
                    "choices": (json.loads(choices) if isinstance(choices, str) else choices),
                    "card": (json.loads(card) if isinstance(card, str) else card),
                    "created_at": str(created)})
    return out
