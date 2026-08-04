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
