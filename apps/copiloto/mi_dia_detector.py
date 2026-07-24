"""Detector proactivo — hito 7 (`contrato_mi-dia-y-el-detector-proactivo` §1).

Arquitectura DETECTAR → PRIORIZAR → REDACTAR → ENTREGAR (contrato §1): este módulo es el paso
DETECTAR — reglas nombradas, deterministas, **sin LLM y sin Temporal**. Las reglas se dividen a
propósito en dos mitades:

- **`_candidatos_*`** (impura): trae los datos de la capa de queries que YA existe (hito 6) —
  `InteligenciaQueries`, `PresupuestoStore`, `CobroStore`. No define ningún cálculo nuevo (contrato
  del hito 6 §0: una sola definición de cada número, cuatro caras la consumen — el detector es la
  quinta cara, no una sexta fuente).
- **`_evaluar_*`** (pura): recibe los datos YA traídos y decide qué dispara. Esta es la mitad que el
  DoD exige testear "con datos fijos y dan siempre lo mismo" (contrato §5) — separarla de la DB es lo
  que hace esa prueba barata y sin infra.

`correr_detector()` es el único punto de entrada que junta ambas mitades y filtra contra el silencio
(`AvisosEmitidosStore`). Es lo que la activity de Temporal llama; el workflow no sabe de reglas.
"""
from __future__ import annotations

import datetime
import json
import os
from decimal import Decimal
from typing import Callable

from afip_comprobante_store import AfipComprobanteStore
from cobro_store import CobroStore
# `DIAS_VENCIDO` es el umbral de "vencido" del hito 6 (`por_cobrar`) — se importa, no se redefine:
# una sola definición de "factura vieja" en toda la app.
from inteligencia_queries import DIAS_VENCIDO as DIAS_FACTURA_VENCIDA
from inteligencia_queries import InteligenciaQueries
from presupuesto_store import PENDIENTE, PresupuestoStore

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_avisos_emitidos"

# Umbral de "presupuesto enfriándose" — mismo patrón que `DIAS_SIN_RESPUESTA` en presupuesto_store.py:
# env var con default, nunca hardcodeado a secas.
UMBRAL_PRESUPUESTO_ENFRIANDOSE = Decimal(os.environ.get("COPILOTO_MI_DIA_UMBRAL_PRESUPUESTO") or "0")

# Umbral de "trabajo sin ingreso" (contrato §1.bis) — días desde el ÚLTIMO MOVIMIENTO, no desde que
# empezó (ver `TrabajoStore.margen` → `dias_desde_ultimo_movimiento`).
DIAS_TRABAJO_SIN_INGRESO = int(os.environ.get("COPILOTO_MI_DIA_DIAS_SIN_INGRESO") or "15")

# "Muy por encima" del mes anterior — multiplicador, no una resta: escala con el tamaño del negocio.
UMBRAL_GASTO_MES_MULTIPLICADOR = Decimal(os.environ.get("COPILOTO_MI_DIA_MULT_GASTO_MES") or "1.5")

# Ventana de "CAE por vencer" — sólo el futuro cercano; ya vencido es otra alerta, no ésta.
DIAS_CAE_POR_VENCER = int(os.environ.get("COPILOTO_MI_DIA_DIAS_CAE") or "14")

# Silencio "para siempre" — reglas que dicen un hecho cerrado una sola vez (contrato §1.bis,
# `trabajo_con_margen_negativo`: "no se repite"). `silenciado_hasta` es NOT NULL a propósito: un NULL
# ahí sería indistinguible de "nunca se calculó" en una lectura apurada; un año 9999 es inequívoco.
SILENCIO_PARA_SIEMPRE = datetime.datetime(9999, 12, 31, tzinfo=datetime.timezone.utc)


def _js(valor):
    return None if valor is None else json.dumps(valor, ensure_ascii=False, default=str)


class AvisosEmitidosStore:
    """Qué se avisó y cuándo — contrato §1.2: "no es telemetría, es parte del algoritmo".

    Multi-tenant: `cliente_id` fijo en el constructor, todas las queries lo filtran (regla 7).
    """

    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    def silenciados(self, regla: str) -> set[str]:
        """`entidad_id` de todo lo silenciado ahora mismo para `regla` — un roundtrip por regla, para
        que PRIORIZAR filtre en memoria en vez de una query por candidato."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT entidad_id FROM {_TABLE} WHERE cliente_id=%s AND regla=%s "
                        f"AND silenciado_hasta > now()", (self._cid, regla))
            return {r[0] for r in cur.fetchall()}

    def emitir(self, regla: str, entidad_tipo: str, entidad_id: str, *,
               dias_silencio: int | None, datos: dict | None = None) -> None:
        """Registra el aviso y fija su silencio. `dias_silencio=None` → `SILENCIO_PARA_SIEMPRE`.

        `ON CONFLICT` sobre `copiloto_avisos_emitidos_regla_entidad_ux` (mi_dia_migrations.sql): el
        mismo candidato detectado dos días seguidos actualiza la fila, nunca la duplica — es la
        idempotencia del silenciado, no una optimización (ver el comentario del índice)."""
        hasta = (SILENCIO_PARA_SIEMPRE if dias_silencio is None else
                 datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=dias_silencio))
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {_TABLE}
                    (cliente_id, regla, entidad_tipo, entidad_id, silenciado_hasta, datos)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (cliente_id, regla, entidad_tipo, entidad_id)
                DO UPDATE SET emitido_en = now(), silenciado_hasta = EXCLUDED.silenciado_hasta,
                              datos = EXCLUDED.datos
            """, (self._cid, regla, entidad_tipo, str(entidad_id), hasta, _js(datos)))


# ── Reglas — mitad PURA (contrato §5: "datos fijos y dan siempre lo mismo") ────────────────────────
#
# Cada `_evaluar_*` recibe la lista que su `_candidatos_*` ya trajo y devuelve los candidatos que
# DISPARAN, con la forma común `{regla, entidad_tipo, entidad_id, dias_silencio, datos}` que
# `correr_detector` consume sin conocer el detalle de cada regla.

REGLA_PRESUPUESTOS_ENFRIANDOSE = "presupuestos_enfriandose"
REGLA_FACTURAS_IMPAGAS_VIEJAS = "facturas_impagas_viejas"
REGLA_TRABAJO_MARGEN_NEGATIVO = "trabajo_con_margen_negativo"
REGLA_TRABAJO_SIN_INGRESO = "trabajo_con_gastos_y_sin_ingreso"
REGLA_GASTO_MES_ALTO = "gasto_del_mes_alto"
REGLA_CAE_POR_VENCER = "cae_por_vencer"


def _evaluar_presupuestos_enfriandose(presupuestos: list[dict]) -> list[dict]:
    """Contrato §1: `presupuesto sin desenlace hace > 30 días y total > umbral`.

    `sin_respuesta` ya viene CALCULADO por `PresupuestoStore.listar()` (columna derivada en SQL, hito
    6) — no se recalculan los 30 días acá, para que "sin desenlace" siga significando una sola cosa
    en toda la app."""
    salida = []
    for p in presupuestos:
        if p.get("estado") != PENDIENTE or not p.get("sin_respuesta"):
            continue
        if Decimal(str(p.get("total") or 0)) <= UMBRAL_PRESUPUESTO_ENFRIANDOSE:
            continue
        salida.append({
            "regla": REGLA_PRESUPUESTOS_ENFRIANDOSE, "entidad_tipo": "presupuesto",
            "entidad_id": p["id"], "dias_silencio": 14,
            "datos": {"numero": p.get("numero"), "cliente": p.get("receptor_nombre"),
                      "total": str(p.get("total"))},
        })
    return salida


def _evaluar_facturas_impagas_viejas(impagos: dict) -> list[dict]:
    """Contrato §1: `facturas impagas viejas` — mismo umbral que `por_cobrar.vencido` del hito 6
    (`DIAS_VENCIDO`, importado, no redefinido)."""
    salida = []
    for c in impagos.get("comprobantes", []):
        if (c.get("dias") or 0) <= DIAS_FACTURA_VENCIDA:
            continue
        salida.append({
            "regla": REGLA_FACTURAS_IMPAGAS_VIEJAS, "entidad_tipo": "comprobante",
            "entidad_id": c["id"], "dias_silencio": 14,
            "datos": {"nro": c.get("nro"), "cliente": c.get("receptor_nombre"),
                      "saldo": str(c.get("saldo")), "dias": c.get("dias")},
        })
    return salida


def _evaluar_trabajo_margen_negativo(trabajos: list[dict]) -> list[dict]:
    """Contrato §1.bis: `cadena con ingreso registrado Y gastos imputados, margen < 0`.

    Se dice **una sola vez** (`dias_silencio=None` → `SILENCIO_PARA_SIEMPRE`): "es un hecho cerrado",
    no algo que siga vigente mañana como un presupuesto sin responder."""
    salida = []
    for t in trabajos:
        if Decimal(str(t.get("margen") or 0)) >= 0:
            continue
        entidad_id = f"{t['eslabon']}:{t['ref']}"
        salida.append({
            "regla": REGLA_TRABAJO_MARGEN_NEGATIVO, "entidad_tipo": "trabajo",
            "entidad_id": entidad_id, "dias_silencio": None,
            "datos": {"etiqueta": t.get("etiqueta"), "cobrado": str(t.get("cobrado")),
                      "gastado": str(t.get("gastado")), "margen": str(t.get("margen"))},
        })
    return salida


def _evaluar_trabajo_sin_ingreso(trabajos_sin_ingreso: list[dict]) -> list[dict]:
    """Contrato §1.bis: `cadena con gastos imputados, terminada hace > 15 días, sin ningún ingreso`.

    ⚠️ **La trampa del contrato:** un trabajo sin ingreso puede ser (a) que no le pagaron, (b) que
    le pagaron y no lo anotó, o (c) que **sigue en curso**. Por eso el umbral es
    `dias_desde_ultimo_movimiento` (calculado en SQL, `TrabajoStore.margen`) — NO "hace cuánto
    empezó" — así un trabajo con actividad reciente (en curso) nunca dispara esto. Un candidato sin
    `dias_desde_ultimo_movimiento` (nunca hubo cobro ni gasto con fecha, caso degenerado) tampoco
    dispara: sin fecha no hay forma de distinguir "viejo" de "recién empezado"."""
    salida = []
    for t in trabajos_sin_ingreso:
        dias = t.get("dias_desde_ultimo_movimiento")
        if dias is None or dias <= DIAS_TRABAJO_SIN_INGRESO:
            continue
        entidad_id = f"{t['eslabon']}:{t['ref']}"
        salida.append({
            "regla": REGLA_TRABAJO_SIN_INGRESO, "entidad_tipo": "trabajo",
            "entidad_id": entidad_id, "dias_silencio": 14,
            "datos": {"etiqueta": t.get("etiqueta"), "gastado": str(t.get("gastado")), "dias": dias},
        })
    return salida


def _evaluar_gasto_del_mes_alto(serie: list[dict]) -> list[dict]:
    """Contrato §1: `gasto del mes muy por encima del anterior`. Compara los últimos 2 meses de
    `InteligenciaQueries.serie_mensual_reciente()` (misma definición de "Salió" que la portada, §0).

    Sin baseline (mes anterior en $0) no dispara: "muy por encima de cero" no es una señal de alarma,
    es el primer mes con actividad — dispararía siempre que hay CUALQUIER gasto."""
    if len(serie) < 2:
        return []
    anterior, actual = serie[-2], serie[-1]
    gasto_anterior = Decimal(str(anterior.get("gastos") or 0))
    gasto_actual = Decimal(str(actual.get("gastos") or 0))
    if gasto_anterior <= 0 or gasto_actual <= gasto_anterior * UMBRAL_GASTO_MES_MULTIPLICADOR:
        return []
    return [{
        "regla": REGLA_GASTO_MES_ALTO, "entidad_tipo": "mes", "entidad_id": actual["mes"],
        "dias_silencio": 14,
        "datos": {"mes": actual["mes"], "gasto_actual": actual["gastos"],
                  "gasto_anterior": anterior["gastos"]},
    }]


def _evaluar_cae_por_vencer(comprobantes: list[dict]) -> list[dict]:
    """Contrato §1: `CAE... por vencer`. Ventana `[0, DIAS_CAE_POR_VENCER]` — ya vencido
    (`dias_para_vencer < 0`) es otra alerta ("ya venció"), no ésta; el contrato pide "por vencer",
    no "vencido". Alcance de esta regla: el CAE por comprobante (`afip_comprobantes.cae_vto`). La
    otra mitad del nombre del contrato ("...o credencial") — el certificado WSAA de
    `afip_credentials` — no tiene columna de vencimiento en este schema todavía; queda fuera,
    deuda separada (no se inventa una fecha que no existe)."""
    salida = []
    for c in comprobantes:
        dias = c.get("dias_para_vencer")
        if dias is None or dias < 0 or dias > DIAS_CAE_POR_VENCER:
            continue
        salida.append({
            "regla": REGLA_CAE_POR_VENCER, "entidad_tipo": "comprobante", "entidad_id": c["id"],
            "dias_silencio": 14,
            "datos": {"nro": c.get("nro"), "cae_vto": c.get("cae_vto"), "dias": dias},
        })
    return salida


# ── Reglas — mitad IMPURA (traen los datos de la capa del hito 6) ──────────────────────────────────

def _candidatos_presupuestos_enfriandose(conn_factory: Callable, cliente_id: str) -> list[dict]:
    return PresupuestoStore(conn_factory, cliente_id).listar(limit=200)


def _candidatos_facturas_impagas_viejas(conn_factory: Callable, cliente_id: str) -> dict:
    return CobroStore(conn_factory, cliente_id).impagos()


def _candidatos_margen_por_trabajo(conn_factory: Callable, cliente_id: str) -> dict:
    """`{trabajos, sin_ingreso}` — UN solo `margen_por_trabajo()` para las DOS reglas que lo
    necesitan (`trabajo_con_margen_negativo` y `trabajo_con_gastos_y_sin_ingreso`). Llamarlo dos
    veces (una por regla) duplicaría el recorrido de TODOS los trabajos del tenant en cada corrida
    del detector — barato de evitar, compartiendo el resultado acá."""
    return InteligenciaQueries(conn_factory, cliente_id).margen_por_trabajo()


def _candidatos_gasto_del_mes_alto(conn_factory: Callable, cliente_id: str) -> list[dict]:
    return InteligenciaQueries(conn_factory, cliente_id).serie_mensual_reciente(meses=2)


def _candidatos_cae_por_vencer(conn_factory: Callable, cliente_id: str) -> list[dict]:
    return AfipComprobanteStore(conn_factory, cliente_id).con_cae_vigente()


# ── El orquestador — lo único que la activity de Temporal llama ────────────────────────────────────

def detectar_todos(conn_factory: Callable, cliente_id: str) -> dict[str, list[dict]]:
    """DETECTAR puro (contrato §1, primer paso) — la verdad CRUDA, sin filtrar por silencio.

    🔴 A propósito NO filtra silenciados acá. Un consumidor que necesite "cerrar la tarjeta sola
    porque el hecho ya no es cierto" (contrato §2.1) necesita la verdad completa: si este método
    filtrara los silenciados, un candidato que sigue vigente pero está silenciado (dentro de sus 14
    días) desaparecería de la lista y un reconciliador lo leería como "ya no dispara" — cerrando una
    tarjeta que sigue activa. El filtro de silencio es una decisión de PRIORIZAR (¿corresponde avisar
    de nuevo?), no de si el hecho es verdad; por eso vive aparte, en quien orquesta (`mi_dia_orquestador.py`).

    Determinista dado el estado de la DB en el momento en que corre — no llama al LLM. REDACTAR
    (texto con tono del negocio) y ENTREGAR (Kanban + portada) son pasos aparte, fuera de este módulo.
    """
    margen_por_trabajo = _candidatos_margen_por_trabajo(conn_factory, cliente_id)
    return {
        REGLA_PRESUPUESTOS_ENFRIANDOSE:
            _evaluar_presupuestos_enfriandose(_candidatos_presupuestos_enfriandose(conn_factory, cliente_id)),
        REGLA_FACTURAS_IMPAGAS_VIEJAS:
            _evaluar_facturas_impagas_viejas(_candidatos_facturas_impagas_viejas(conn_factory, cliente_id)),
        REGLA_TRABAJO_MARGEN_NEGATIVO:
            _evaluar_trabajo_margen_negativo(margen_por_trabajo["trabajos"]),
        REGLA_TRABAJO_SIN_INGRESO:
            _evaluar_trabajo_sin_ingreso(margen_por_trabajo["sin_ingreso"]),
        REGLA_GASTO_MES_ALTO:
            _evaluar_gasto_del_mes_alto(_candidatos_gasto_del_mes_alto(conn_factory, cliente_id)),
        REGLA_CAE_POR_VENCER:
            _evaluar_cae_por_vencer(_candidatos_cae_por_vencer(conn_factory, cliente_id)),
    }


# Reglas cuya tarjeta se cierra SOLA cuando el candidato deja de aparecer en `detectar_todos()`
# (contrato §2.1). `trabajo_con_margen_negativo` NO está: es un hecho cerrado que se dice una vez
# (§1.bis) — no tiene "acción que lo resuelva", así que no se reconcilia por ausencia.
# `trabajo_con_gastos_y_sin_ingreso` SÍ está — el DoD lo pide explícito: "se cierra sola al
# registrar el ingreso" (§5), que es exactamente "el trabajo deja de aparecer en `sin_ingreso`".
# `gasto_del_mes_alto` y `cae_por_vencer` NO están — ninguna tiene una "acción que la resuelva": un
# mes caro sigue habiendo sido caro, y un CAE no se "renueva" (contrato §2.1: sólo se mueven a mano
# las que no tienen acción rastreable).
REGLAS_AUTO_CIERRE = (REGLA_PRESUPUESTOS_ENFRIANDOSE, REGLA_FACTURAS_IMPAGAS_VIEJAS,
                      REGLA_TRABAJO_SIN_INGRESO)
