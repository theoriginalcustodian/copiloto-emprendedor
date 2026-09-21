"""Feedback in-app del emprendedor (BETA-1a) — voz + texto, UNA fila por envío.

Patrón de `gasto_store.py`: `conn_factory` + `cliente_id` fijos en el constructor, cada query filtra
por `cliente_id` explícito (no confiar sólo en RLS). Sin UI de admin en esta etapa — el operador lo lee
con SQL directo (mapa BETA-1a §M4-nota).

`created_at` = `now()` del servidor. A diferencia de `copiloto_gastos`, esto NO es un registro
financiero atado al "día del negocio" — no aplica `hoy_del_negocio()`/`ZONA_DEL_NEGOCIO`, UTC alcanza.
"""
from __future__ import annotations

from typing import Callable

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_feedback"

TEXTO, VOZ = "texto", "voz"
TIPOS = (TEXTO, VOZ)


class FeedbackStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cliente_id = cliente_id

    def crear(self, *, tipo: str, texto: str, contexto: str | None) -> int:
        assert tipo in TIPOS, f"tipo de feedback inválido: {tipo!r}"
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_TABLE} (cliente_id, tipo, texto, contexto) "
                f"VALUES (%s, %s, %s, %s) RETURNING id",
                (self._cliente_id, tipo, texto, contexto))
            return cur.fetchone()[0]

    def listar_propio(self, *, limite: int = 100) -> list[dict]:
        """El feedback de ESTE tenant, más nuevo primero (K-08). `cliente_id` explícito en el WHERE: nunca
        se confía sólo en RLS."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT id, tipo, texto, contexto, created_at, escuchado, escuchado_en "
                f"FROM {_TABLE} WHERE cliente_id = %s ORDER BY created_at DESC, id DESC LIMIT %s",
                (self._cliente_id, limite))
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, fila)) for fila in cur.fetchall()]

    def marcar_escuchado(self, feedback_id: int) -> dict | None:
        """Lo llama el operador (vía la consola) con el store del tenant DUEÑO. Idempotente: si ya estaba
        escuchado conserva el `escuchado_en` original. `None` si el id no es de este tenant."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_TABLE} SET escuchado = true, escuchado_en = COALESCE(escuchado_en, now()) "
                f"WHERE id = %s AND cliente_id = %s RETURNING id, escuchado, escuchado_en",
                (feedback_id, self._cliente_id))
            fila = cur.fetchone()
            return None if fila is None else {"id": fila[0], "escuchado": fila[1], "escuchado_en": fila[2]}
