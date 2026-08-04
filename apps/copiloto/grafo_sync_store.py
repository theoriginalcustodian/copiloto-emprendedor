"""Estado incremental del sync evento→grafo (BETA-G0) — cursor por tenant + último edge vigente por
`(entidad_tipo, entidad_id, campo)`.

Sin esto el modo incremental no puede invalidar correctamente: `derivador.py` §7.1.bis dice que en
producción "sólo se puede invalidar cuando LLEGA el evento siguiente, sin saber si va a llegar" — hace
falta recordar, entre una corrida del Schedule y la siguiente, cuál fue la ÚLTIMA transición que cada
`(entidad, campo)` materializó, para poder invalidarla cuando llega la próxima. `construir_datasets_estado`
(la carga histórica) no sirve para esto: conoce el futuro completo de una sola pasada; acá cada corrida
sólo ve su propio tramo nuevo.
"""
from __future__ import annotations

from typing import Callable

_SCHEMA = "uc_factory"
_CURSOR = f"{_SCHEMA}.copiloto_grafo_cursor"
_VIGENCIA = f"{_SCHEMA}.copiloto_grafo_vigencia"


class GrafoSyncStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cliente_id = cliente_id

    def cursor(self) -> int:
        """El `id` de `copiloto_eventos` hasta donde ya se sincronizó (0 si el tenant nunca corrió)."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT ultimo_evento_id FROM {_CURSOR} WHERE cliente_id=%s",
                       (self._cliente_id,))
            row = cur.fetchone()
            return int(row[0]) if row else 0

    def avanzar_cursor(self, ultimo_evento_id: int) -> None:
        """Upsert de una sola fila por tenant. Llamar SÓLO después de que el `write` al grafo terminó
        bien — si se llama antes y el write falla, el rango se pierde sin reintentar (trampa inversa a
        la que este mecanismo existe para evitar)."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_CURSOR} (cliente_id, ultimo_evento_id) VALUES (%s, %s) "
                f"ON CONFLICT (cliente_id) DO UPDATE SET ultimo_evento_id = EXCLUDED.ultimo_evento_id",
                (self._cliente_id, ultimo_evento_id))

    def vigente(self, entidad_tipo: str, entidad_id: str, campo: str) -> str | None:
        """El `edge_uuid` de la transición vigente para esta clave, o `None` si es la primera vez que
        se ve (nada que invalidar)."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT ultimo_edge_uuid FROM {_VIGENCIA} "
                f"WHERE cliente_id=%s AND entidad_tipo=%s AND entidad_id=%s AND campo=%s",
                (self._cliente_id, entidad_tipo, entidad_id, campo))
            row = cur.fetchone()
            return row[0] if row else None

    def marcar_vigente(self, entidad_tipo: str, entidad_id: str, campo: str, *,
                       orden: int, edge_uuid: str) -> None:
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_VIGENCIA} (cliente_id, entidad_tipo, entidad_id, campo, "
                f"ultimo_orden, ultimo_edge_uuid) VALUES (%s,%s,%s,%s,%s,%s) "
                f"ON CONFLICT (cliente_id, entidad_tipo, entidad_id, campo) "
                f"DO UPDATE SET ultimo_orden = EXCLUDED.ultimo_orden, "
                f"ultimo_edge_uuid = EXCLUDED.ultimo_edge_uuid",
                (self._cliente_id, entidad_tipo, entidad_id, campo, orden, edge_uuid))
