"""El Kanban "Mi día" (contrato `mi-dia-y-el-detector-proactivo` §2) — la tarjeta, no la regla.

Separado de `mi_dia_detector.py` a propósito: el detector sólo sabe *qué dispara*; este módulo es
lo que el emprendedor VE y TOCA — su ciclo de vida (para_hoy → haciendo → hecha), la caducidad, y
las tarjetas manuales que el detector nunca crea (contrato §2.4, por voz).

§2.1 — "la tarjeta muere por el HECHO, no por el gesto": las tarjetas nacidas de una regla con
`REGLAS_AUTO_CIERRE` (`mi_dia_detector.py`) se cierran vía `cerrar_resueltas()`, comparado contra la
verdad CRUDA de `detectar_todos()` — nunca porque el emprendedor las tocó.
"""
from __future__ import annotations

import datetime
import json
import os
from typing import Callable

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_mi_dia_tarjetas"

PARA_HOY, HACIENDO, HECHA = "para_hoy", "haciendo", "hecha"
ESTADOS = (PARA_HOY, HACIENDO, HECHA)

# Título visible de cada solapa (contrato §2: "Para hoy · Haciendo · Hechas") — el `id` que manda la
# app es el `estado` interno; el título es lo único que cambia si algún día se retraduce la UI.
SOLAPAS_TITULOS = {PARA_HOY: "Para hoy", HACIENDO: "Haciendo", HECHA: "Hechas"}

# Caducidad — contrato §2.2: "sin tocar en 21 días se archiva sola". Mismo patrón que
# `DIAS_SIN_RESPUESTA` (presupuesto_store.py): env var con default, nunca hardcodeado a secas.
DIAS_CADUCIDAD_TARJETA = int(os.environ.get("COPILOTO_MI_DIA_CADUCIDAD_DIAS") or "21")

_COLS = ("id", "regla", "entidad_tipo", "entidad_id", "texto", "estado", "datos",
         "creada_en", "movida_en")


def _js(valor):
    return None if valor is None else json.dumps(valor, ensure_ascii=False, default=str)


def _fila_a_dict(fila: tuple) -> dict:
    id_, regla, entidad_tipo, entidad_id, texto, estado, datos, creada, movida = fila
    return {
        # `str(id_)`: el id es SERIAL (int) en la DB, pero el contrato del wire lo espera string
        # (packages/core/src/api/miDia.ts:91 descarta en silencio toda tarjeta con `id` no-string —
        # así se perdían TODAS las tarjetas del tablero sin ningún error visible).
        "id": str(id_), "regla": regla, "entidad_tipo": entidad_tipo, "entidad_id": entidad_id,
        "texto": texto, "estado": estado, "datos": datos,
        "creada_en": creada.isoformat() if creada else None,
        "movida_en": movida.isoformat() if movida else None,
    }


class EstadoInvalido(ValueError):
    def __init__(self, estado: str) -> None:
        super().__init__(f"estado inválido: {estado!r} (válidos: {ESTADOS})")


class TarjetaStore:
    """Multi-tenant: `cliente_id` fijo en el constructor, todas las queries lo filtran (regla 7)."""

    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    # ── ENTREGAR (lo escribe el orquestador/detector) ───────────────────────────────────────────

    def crear_si_no_existe(self, regla: str, entidad_tipo: str, entidad_id, texto: str,
                            datos: dict | None = None) -> None:
        """Idempotente vía `copiloto_mi_dia_tarjetas_regla_entidad_ux` (parcial, `regla IS NOT NULL`
        — mi_dia_migrations.sql). Si la tarjeta ya existe (el emprendedor la movió, o ya estaba en
        `para_hoy`), NO la toca: recrearla resetearía el progreso que ya hizo."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {_TABLE} (cliente_id, regla, entidad_tipo, entidad_id, texto, datos)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (cliente_id, regla, entidad_tipo, entidad_id) WHERE regla IS NOT NULL
                DO NOTHING
            """, (self._cid, regla, entidad_tipo, str(entidad_id), texto, _js(datos)))

    def cerrar_resueltas(self, regla: str, entidad_ids_vigentes: set[str]) -> int:
        """Contrato §2.1: la tarjeta se cierra sola cuando su candidato deja de aparecer en la
        verdad CRUDA del detector (`entidad_ids_vigentes` = `detectar_todos()[regla]`, SIN filtrar
        por silencio — ver el docstring de `detectar_todos`). Sólo toca `para_hoy`/`haciendo`: una
        tarjeta ya `hecha` no se re-cierra ni se reabre. Devuelve cuántas cerró."""
        vigentes = [str(v) for v in entidad_ids_vigentes]
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                UPDATE {_TABLE} SET estado = %s, movida_en = now()
                 WHERE cliente_id = %s AND regla = %s AND estado IN (%s, %s)
                   AND NOT (entidad_id = ANY(%s))
            """, (HECHA, self._cid, regla, PARA_HOY, HACIENDO, vigentes))
            return cur.rowcount

    # ── manual (contrato §2.4, tools de voz) ────────────────────────────────────────────────────

    def crear_manual(self, texto: str, datos: dict | None = None) -> dict:
        """`regla`/`entidad_tipo`/`entidad_id` en NULL — nunca colisiona con el índice parcial
        (que sólo cubre `regla IS NOT NULL`), así que cada tarjeta manual es siempre una fila nueva."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {_TABLE} (cliente_id, texto, datos)
                VALUES (%s, %s, %s::jsonb)
                RETURNING {', '.join(_COLS)}
            """, (self._cid, texto, _js(datos)))
            return _fila_a_dict(cur.fetchone())

    def mover(self, tarjeta_id: int, nuevo_estado: str) -> dict | None:
        if nuevo_estado not in ESTADOS:
            raise EstadoInvalido(nuevo_estado)
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                UPDATE {_TABLE} SET estado = %s, movida_en = now()
                 WHERE cliente_id = %s AND id = %s
                RETURNING {', '.join(_COLS)}
            """, (nuevo_estado, self._cid, tarjeta_id))
            fila = cur.fetchone()
            return _fila_a_dict(fila) if fila else None

    def borrar(self, tarjeta_id: int) -> bool:
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"DELETE FROM {_TABLE} WHERE cliente_id = %s AND id = %s",
                        (self._cid, tarjeta_id))
            return cur.rowcount > 0

    # ── lectura (el tablero) ─────────────────────────────────────────────────────────────────────

    def listar_tablero(self) -> dict[str, list[dict]]:
        """`{para_hoy: [...], haciendo: [...], hecha: [...]}` — excluye las CADUCADAS (§2.2:
        `movida_en` hace más de `DIAS_CADUCIDAD_TARJETA` días), calculado en SQL igual que
        `sin_respuesta` en presupuesto_store.py: se deriva, no se guarda un booleano que alguien
        tendría que mantener al día corriendo algo todas las noches."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                SELECT {', '.join(_COLS)} FROM {_TABLE}
                 WHERE cliente_id = %s
                   AND movida_en > now() - interval '{DIAS_CADUCIDAD_TARJETA} days'
                 ORDER BY creada_en DESC
            """, (self._cid,))
            filas = [_fila_a_dict(f) for f in cur.fetchall()]
        tablero: dict[str, list[dict]] = {e: [] for e in ESTADOS}
        for t in filas:
            tablero.setdefault(t["estado"], []).append(t)
        return tablero
