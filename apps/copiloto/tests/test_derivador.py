"""El motor de invalidación del derivador (§1.2) — con el invariante que ninguna carga de golpe prueba:
histórico e incremental producen las MISMAS invalidaciones.

El caso que importa (§7.1.bis): un dataset se ingesta de una sola vez en desarrollo, así que el modo
incremental —el de producción— no se ejercita a menos que se lo pruebe aparte. Estos tests lo prueban
aparte, y contra el dataset sintético real (§1.4).
"""
from __future__ import annotations

import datetime

from derivador import (EventoLog, eventos_desde_sinteticos, invalidaciones_historico,
                       invalidaciones_incremental, vigentes)
from grafo_dataset import generar_dataset

Z = datetime.timezone(datetime.timedelta(hours=-3))


def _ev(orden, tipo, eid, campo, dia):
    return EventoLog(orden=orden, entidad_tipo=tipo, entidad_id=eid, campo=campo,
                     ocurrido_en=datetime.datetime(2026, dia, 1, 12, tzinfo=Z))


# ── el invariante central: los dos modos coinciden ──────────────────────────────────────────────

def test_historico_e_incremental_dan_lo_mismo_en_el_dataset_real():
    """DoD: 'las invalidaciones salen igual'. Contra el dataset §1.4 completo, no un juguete."""
    evs = eventos_desde_sinteticos(generar_dataset(cliente_id="t", hoy=datetime.date(2026, 7, 22)))
    assert invalidaciones_historico(evs) == invalidaciones_incremental(evs)


def test_los_dos_modos_coinciden_con_una_serie_de_precios_larga():
    # concepto que cambia de precio 4 veces: 3 invalidaciones, iguales en ambos modos.
    evs = [_ev(0, "concepto", "tablero", "precio", 1),
           _ev(1, "concepto", "tablero", "precio", 2),
           _ev(2, "concepto", "tablero", "precio", 3),
           _ev(3, "concepto", "tablero", "precio", 4)]
    h = invalidaciones_historico(evs)
    i = invalidaciones_incremental(evs)
    assert h == i
    assert len(h) == 3
    # cada uno invalida al inmediato anterior, con invalid_at = fecha del que lo supera
    assert [(s.superado, s.superador) for s in h] == [(0, 1), (1, 2), (2, 3)]


# ── el evento puro no se invalida jamás (§2.1) ──────────────────────────────────────────────────

def test_un_evento_sin_campo_nunca_genera_invalidacion():
    # cobros y gastos creados: campo=None → eventos puros. Aunque se repita la entidad, no hay supersesión.
    evs = [_ev(0, "cobro", "C-1", None, 1),
           _ev(1, "cobro", "C-2", None, 2),
           _ev(2, "gasto", "G-1", None, 3)]
    assert invalidaciones_historico(evs) == []
    assert invalidaciones_incremental(evs) == []


def test_claves_distintas_no_se_pisan():
    # dos conceptos distintos, cada uno con su serie: no se cruzan.
    evs = [_ev(0, "concepto", "a", "precio", 1), _ev(1, "concepto", "a", "precio", 2),
           _ev(2, "concepto", "b", "precio", 1)]
    h = invalidaciones_historico(evs)
    assert len(h) == 1 and h[0].superado == 0 and h[0].superador == 1


# ── §2.3: volver a un valor anterior NO resucita — es un evento nuevo ────────────────────────────

def test_volver_a_un_precio_anterior_es_un_evento_nuevo_no_resucita():
    """El caso de la trampa 4: precio 85→95→85. El segundo 85 es orden=2, un evento DISTINTO del
    orden=0; supera al 95 (orden=1). El vigente final es orden=2, no orden=0 — nada resucita."""
    evs = [_ev(0, "concepto", "tablero", "precio", 1),   # 85
           _ev(1, "concepto", "tablero", "precio", 2),   # 95
           _ev(2, "concepto", "tablero", "precio", 3)]   # vuelve a 85, evento nuevo
    h = invalidaciones_historico(evs)
    assert invalidaciones_incremental(evs) == h
    assert [(s.superado, s.superador) for s in h] == [(0, 1), (1, 2)]
    # el vigente es el ÚLTIMO evento (orden 2), no el primer 85 (orden 0)
    assert vigentes(evs)[("concepto", "tablero", "precio")] == 2


# ── imputación como ESTADO (corrección backend §4 del avance §1.1) ──────────────────────────────

def test_reimputar_un_gasto_invalida_la_imputacion_anterior():
    """IMPUTADO_A debe comportarse como estado: re-imputar supera la imputación previa (o el margen se
    cuenta dos veces). Como `imputado`/`desimputado` traen `campo='imputacion'`, el motor lo trata como
    arista de estado sin saber nada de ontología."""
    evs = [_ev(0, "gasto", "G-9", "imputacion", 1),
           _ev(1, "gasto", "G-9", "imputacion", 2),   # re-imputado
           _ev(2, "gasto", "G-9", "imputacion", 3)]   # des/re-imputado otra vez
    h = invalidaciones_historico(evs)
    assert invalidaciones_incremental(evs) == h
    assert [(s.superado, s.superador) for s in h] == [(0, 1), (1, 2)]


# ── comprobante emitida→anulada: invalida el ESTADO, el motor no toca el EMITIO ──────────────────

def test_comprobante_anulada_supera_su_estado_una_vez():
    evs = [_ev(0, "comprobante", "cuit|6|1|7", "estado", 1),   # emitida
           _ev(1, "comprobante", "cuit|6|1|7", "estado", 3)]   # anulada
    h = invalidaciones_historico(evs)
    assert invalidaciones_incremental(evs) == h
    assert len(h) == 1 and h[0].superado == 0
    # el motor sólo mira aristas de estado; el EMITIO (evento puro, otro campo=None) no está en su alcance


# ── determinismo del orden de salida ─────────────────────────────────────────────────────────────

def test_desempate_por_orden_cuando_coincide_la_fecha():
    # dos eventos misma clave y misma fecha: el desempate es `orden`, determinista.
    a = EventoLog(0, "concepto", "x", "precio", datetime.datetime(2026, 5, 1, 12, tzinfo=Z))
    b = EventoLog(1, "concepto", "x", "precio", datetime.datetime(2026, 5, 1, 12, tzinfo=Z))
    h = invalidaciones_historico([b, a])   # entran desordenados
    assert len(h) == 1 and h[0].superado == 0 and h[0].superador == 1


# ── el dataset real ejercita de verdad el motor ─────────────────────────────────────────────────

def test_el_dataset_real_produce_invalidaciones_no_triviales():
    """Si el dataset fuera plano, esto daría 0 y el motor nunca se probaría contra datos. El §1.4
    garantiza la serie de precios que sube y vuelve + la factura anulada, así que hay supersesiones."""
    evs = eventos_desde_sinteticos(generar_dataset(cliente_id="t", hoy=datetime.date(2026, 7, 22)))
    h = invalidaciones_historico(evs)
    assert len(h) >= 4, "el dataset real debería producir varias invalidaciones (precios + estados)"
    # y hay al menos una arista de concepto/precio superada (la serie que sube y vuelve)
    assert any(s.clave[0] == "concepto" and s.clave[2] == "precio" for s in h)
