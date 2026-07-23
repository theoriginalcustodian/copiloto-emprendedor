"""El dataset sintético §1.4 — el instrumento que debe FALLAR si el dataset se vuelve plano.

No basta con "genera eventos": cada test verifica que un caso §2 obligatorio EXISTE, porque un dataset
plano da toda la bitemporalidad en verde sin haberla ejercitado (`ontologia-grafo-negocio-v1.md` §7.2).
Si alguien simplifica el generador y borra el concepto que vuelve a un precio anterior, o deja todas
las facturas cobradas, estos tests se ponen rojos — que es su razón de ser.
"""
from __future__ import annotations

import datetime

from grafo_dataset import (CBTE_ANULADA, CBTE_EMITIDA, COBRO_MANUAL, PRESU_APROBADO,
                           PRESU_DESESTIMADO, PRESU_PENDIENTE, generar_dataset)

HOY = datetime.date(2026, 7, 22)
CID = "e2e7e57e-0000-4000-8000-e2e7e57e0002"


def _ds(n=30):
    return generar_dataset(cliente_id=CID, hoy=HOY, n_clientes=n)


def _de(evs, entidad_tipo=None, evento=None, campo=None):
    out = evs
    if entidad_tipo is not None:
        out = [e for e in out if e.entidad_tipo == entidad_tipo]
    if evento is not None:
        out = [e for e in out if e.evento == evento]
    if campo is not None:
        out = [e for e in out if e.campo == campo]
    return out


# ── determinismo y forma ──────────────────────────────────────────────────────────────────────────

def test_es_determinista_dos_corridas_dan_lo_mismo():
    # §3: "re-derivar para comparar" sólo vale si el dataset es idéntico entre corridas.
    a = _ds()
    b = _ds()
    assert a == b


def test_esta_ordenado_cronologicamente():
    # el modo incremental del derivador (§7.1.bis) procesa los eventos como llegarían en prod: en orden.
    evs = _ds()
    fechas = [e.ocurrido_en for e in evs]
    assert fechas == sorted(fechas)


def test_todo_cae_dentro_de_la_ventana_de_6_meses():
    evs = _ds()
    inicio = datetime.datetime(2026, 1, 1, tzinfo=evs[0].ocurrido_en.tzinfo)
    fin = datetime.datetime(2026, 7, 23, tzinfo=evs[0].ocurrido_en.tzinfo)
    assert all(inicio <= e.ocurrido_en <= fin for e in evs)


# ── caso §2.3: la arista que resucita ───────────────────────────────────────────────────────────

def test_hay_un_concepto_que_vuelve_a_un_precio_anterior():
    """El caso que justifica que la identidad de arista incluya el id de evento (§2.3, trampa 4): un
    precio que baja y VUELVE genera el mismo par (concepto, precio) que uno ya invalidado."""
    cambios = _de(_ds(), "concepto", campo="precio")
    por_concepto: dict[str, list] = {}
    for e in cambios:
        por_concepto.setdefault(e.entidad_id, []).append(e.valor_a)
    # algún concepto tiene ≥3 cambios y un valor que reaparece
    reincide = [c for c, precios in por_concepto.items()
                if len(precios) >= 3 and len(precios) != len(set(precios))]
    assert reincide, "ningún concepto vuelve a un precio anterior — el guard anti-resurrección no se ejercita"


def test_hay_un_concepto_de_precio_estable_para_contraste():
    cambios = _de(_ds(), "concepto", campo="precio")
    por_concepto: dict[str, int] = {}
    for e in cambios:
        por_concepto[e.entidad_id] = por_concepto.get(e.entidad_id, 0) + 1
    assert any(n == 1 for n in por_concepto.values())


# ── caso §1.4: los cuatro desenlaces de presupuesto ─────────────────────────────────────────────

def test_presupuestos_en_los_cuatro_desenlaces():
    evs = _ds()
    creados = _de(evs, "presupuesto", evento="creado")
    cambios = _de(evs, "presupuesto", evento="estado_cambiado")
    destinos = {e.valor_a for e in cambios}
    # aprobado y desestimado como transiciones reales
    assert PRESU_APROBADO in destinos
    assert PRESU_DESESTIMADO in destinos
    # "sin respuesta" = un presupuesto creado que nunca cambia de estado (queda pendiente)
    con_cambio = {e.entidad_id for e in cambios}
    sin_respuesta = [e for e in creados if e.entidad_id not in con_cambio]
    assert sin_respuesta, "no hay presupuesto sin respuesta (pendiente)"
    assert all(e.valor_a == PRESU_PENDIENTE for e in creados)   # todos nacen pendiente (realidad)
    # "reemplazado" = un sucesor con reemplaza_a apuntando a otro presupuesto (no un estado — §hallazgo)
    reemplazos = [e for e in creados if e.datos.get("reemplaza_a")]
    assert reemplazos, "no hay presupuesto reemplazado (reemplaza_a)"
    numeros = {e.entidad_id for e in creados}
    assert all(e.datos["reemplaza_a"] in numeros for e in reemplazos), "reemplaza_a apunta a un numero inexistente"


# ── caso §2.2: factura anulada, cobrada, impaga ─────────────────────────────────────────────────

def test_hay_factura_anulada_y_su_anulacion_no_toca_el_emitio():
    evs = _ds()
    anulaciones = [e for e in _de(evs, "comprobante", evento="estado_cambiado")
                   if e.valor_a == CBTE_ANULADA]
    assert anulaciones, "no hay factura anulada"
    # la anulación es un estado_cambiado; el 'emitido' del mismo comprobante SIGUE existiendo (no se borra)
    for anul in anulaciones:
        emitidos = [e for e in _de(evs, "comprobante", evento="emitido")
                    if e.entidad_id == anul.entidad_id]
        assert emitidos, "la anulación hizo desaparecer el emitido — EMITIO no debe tocarse (§2.2)"


def test_hay_factura_cobrada_y_factura_impaga():
    evs = _ds()
    emitidos = _de(evs, "comprobante", evento="emitido")
    cobros = _de(evs, "cobro", evento="creado")
    con_cobro = {e.datos.get("comprobante_id") for e in cobros if e.datos.get("comprobante_id")}
    # al menos una factura cobrada y al menos una sin cobro asociado
    ids_emitidos = {e.datos["nro"] for e in emitidos}
    assert con_cobro, "ninguna factura fue cobrada"
    assert ids_emitidos - con_cobro, "todas las facturas están cobradas — falta el caso impago (#1 ¿quién me debe?)"


def test_hay_un_cobro_manual_ademas_del_de_factura():
    # el origen distingue lo que el sistema vio de lo que el emprendedor dictó (§2.1) — deben coexistir
    origenes = {e.datos.get("origen") for e in _de(_ds(), "cobro", evento="creado")}
    assert COBRO_MANUAL in origenes


# ── caso §2.1: gasto imputado ────────────────────────────────────────────────────────────────────

def test_hay_un_gasto_imputado_a_un_trabajo():
    imputaciones = _de(_ds(), "gasto", evento="imputado")
    assert imputaciones, "no hay gasto imputado — la arista IMPUTADO_A no se ejercita"
    assert all(e.valor_a and e.valor_a.get("eslabon") for e in imputaciones)


# ── caso #4: cliente que dejó de comprar ────────────────────────────────────────────────────────

def test_hay_un_cliente_sin_actividad_reciente():
    """La pregunta #4 (ausencia de eventos recientes) necesita un cliente cuya actividad esté sólo al
    principio de la ventana. Verificamos que exista un receptor cuyo último evento sea de los primeros
    meses."""
    evs = _ds()
    ultimo_por_cliente: dict[str, datetime.datetime] = {}
    for e in evs:
        nombre = e.datos.get("receptor_nombre")
        if nombre:
            if nombre not in ultimo_por_cliente or e.ocurrido_en > ultimo_por_cliente[nombre]:
                ultimo_por_cliente[nombre] = e.ocurrido_en
    corte = datetime.datetime(2026, 3, 1, tzinfo=evs[0].ocurrido_en.tzinfo)
    inactivos = [n for n, ult in ultimo_por_cliente.items() if ult < corte]
    assert inactivos, "ningún cliente dejó de comprar — la consulta de ausencia (#4) no se puede ejercitar"


# ── masa ─────────────────────────────────────────────────────────────────────────────────────────

def test_alcanza_la_masa_de_clientes_pedida():
    receptores = {e.datos.get("receptor_nombre") for e in _ds(n=30)
                  if e.datos.get("receptor_nombre")}
    assert len(receptores) >= 30
