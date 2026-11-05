"""Borrado y exportación de los datos de UN tenant en Postgres (SEC-D8 · ISO 27701 7.3).

Capa de DATOS pura: sin Temporal, sin red. La orquestación multi-sistema (Composio, Graphity,
Temporal schedules, GoTrue) vive en `tenant_erasure_activities.py` / `tenant_erasure_workflow.py`.

## Clasificación (decisión del operador, 2026-11-05)

- **BORRAR**: toda tabla del copiloto con `cliente_id` salvo las tres de abajo.
- **RETENER** (por obligación o por diseño; quedan keyed a un uuid que, borrados `tenants` y el usuario
  de GoTrue, ya no se puede ligar a una persona = seudonimizado):
    * `afip_comprobantes` — retención fiscal de comprobantes emitidos.
    * `copiloto_auditoria` — append-only por trigger (CONS1); sólo guarda acciones del operador.
    * `copiloto_metering` — conteos de uso, sin contenido.
- **AJENAS**: las tablas de apps retiradas (clinic_*, documed_*, ...) comparten esquema pero no son del
  copiloto: este módulo NO las toca. `test_tenant_erasure_clasificacion.py` obliga a clasificar toda
  tabla `copiloto_*`/`afip_*`/`mp_*` nueva: una tabla sin clasificar rompe el test (si no, un dato
  nuevo escaparía del borrado en silencio).

## Orden

Hijas antes que padres (FK `copiloto_mensajes`/`copiloto_ticket_adjuntos` -> `copiloto_tickets`) y
`tenants` (el registro que resuelve la identidad) SIEMPRE al final: un reintento tras una caída a mitad
de camino sigue encontrando el tenant.
"""
from __future__ import annotations

import json
from typing import Callable

SCHEMA = "uc_factory"

#: En orden de borrado (hijas primero).
TABLAS_BORRAR: tuple[str, ...] = (
    "copiloto_mensajes", "copiloto_ticket_adjuntos", "copiloto_tickets", "copiloto_ticket_secuencia",
    "copiloto_presupuesto_items", "copiloto_presupuestos",
    "copiloto_cobros", "copiloto_gastos", "copiloto_conceptos", "copiloto_clientes",
    "copiloto_eventos", "copiloto_grafo_cursor", "copiloto_grafo_vigencia",
    "copiloto_mi_dia_tarjetas", "copiloto_avisos_emitidos", "copiloto_perfil_negocio",
    "copiloto_feedback", "copiloto_traumas", "copiloto_web_replies",
    "afip_credentials", "afip_perfil", "afip_secret_handoff",
    "mp_credentials", "mp_link_dedup", "mp_payments",
)
TABLAS_RETENER: tuple[str, ...] = ("afip_comprobantes", "copiloto_auditoria", "copiloto_metering")
TABLA_REGISTRO = "tenants"

#: Con material cifrado/credenciales: se borran pero NUNCA se exportan.
TABLAS_SIN_EXPORTAR: frozenset[str] = frozenset(
    {"afip_credentials", "afip_secret_handoff", "mp_credentials", "copiloto_auditoria"})

PREFIJOS_DEL_COPILOTO = ("copiloto_", "afip_", "mp_")


def tablas_clasificadas() -> frozenset[str]:
    return frozenset(TABLAS_BORRAR) | frozenset(TABLAS_RETENER) | {TABLA_REGISTRO}


def _fq(tabla: str) -> str:
    # `tabla` sale SIEMPRE de las tuplas de arriba (constantes del módulo), nunca de input externo.
    assert tabla in tablas_clasificadas(), f"tabla no clasificada: {tabla!r}"
    return f"{SCHEMA}.{tabla}"


def borrar_datos(conn_factory: Callable, cliente_id: str) -> dict[str, int]:
    """Borra las filas de `cliente_id` en todas las tablas BORRAR, y por último su fila en `tenants`.

    Idempotente (re-correr devuelve ceros). Devuelve `{tabla: filas_borradas}`: es el recibo que se
    audita — sin contenido, sólo conteos. Sólo borra por `cliente_id` recibido del borde (token o
    operador), y la conexión nace con el tenant declarado (RLS FORCE como segunda línea)."""
    recibo: dict[str, int] = {}
    conn = conn_factory()
    try:
        with conn.cursor() as cur:
            for tabla in TABLAS_BORRAR:
                cur.execute(f"DELETE FROM {_fq(tabla)} WHERE cliente_id = %s", (str(cliente_id),))
                recibo[tabla] = cur.rowcount
            cur.execute(f"DELETE FROM {_fq(TABLA_REGISTRO)} WHERE cliente_id = %s", (str(cliente_id),))
            recibo[TABLA_REGISTRO] = cur.rowcount
        if not conn.autocommit:
            conn.commit()
    except Exception:
        if not conn.autocommit:
            conn.rollback()
        raise
    finally:
        conn.close()
    return recibo


def exportar_datos(conn_factory: Callable, cliente_id: str) -> dict:
    """Portabilidad: todo lo del tenant en JSON (una lista de filas por tabla). Excluye credenciales
    cifradas y la auditoría del operador (`TABLAS_SIN_EXPORTAR`). Sólo lectura."""
    datos: dict[str, list] = {}
    conn = conn_factory()
    try:
        with conn.cursor() as cur:
            for tabla in (*TABLAS_BORRAR, "afip_comprobantes", "copiloto_metering"):
                if tabla in TABLAS_SIN_EXPORTAR:
                    continue
                cur.execute(
                    f"SELECT coalesce(json_agg(t), '[]'::json) FROM {_fq(tabla)} t WHERE cliente_id = %s",
                    (str(cliente_id),))
                filas = cur.fetchone()[0]
                datos[tabla] = json.loads(filas) if isinstance(filas, str) else filas
    finally:
        conn.close()
    return {"cliente_id": str(cliente_id), "tablas": datos,
            "excluidas": sorted(TABLAS_SIN_EXPORTAR)}


def auth_user_id_de(conn_factory: Callable, cliente_id: str) -> str | None:
    """`auth_user_id` (el usuario de GoTrue) del tenant, o None si ya no existe el registro."""
    conn = conn_factory()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT auth_user_id::text FROM {_fq(TABLA_REGISTRO)} WHERE cliente_id = %s",
                        (str(cliente_id),))
            fila = cur.fetchone()
            return fila[0] if fila else None
    finally:
        conn.close()
