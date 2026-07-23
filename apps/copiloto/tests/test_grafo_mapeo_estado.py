"""El mapeo de dominio (§1.3, mitad de ESTADO) — la parte que motivó el `hallazgo_
identidad-arista-estado-no-es-la-formula-del-server` y la decisión de planificación del 00:07: el
`LOG_EVENT_ID` vive en la clave del NODO destino (`Estado`/`Precio`/`Imputacion`), nunca en la fórmula
de la arista. Estos tests fijan ese contrato contra el dataset sintético real — el mismo que ejercita
§2.3 (el concepto que sube de precio tres veces y VUELVE a un valor anterior).
"""
from __future__ import annotations

import datetime

from derivador import eventos_desde_sinteticos, invalidaciones_historico
from grafo_dataset import generar_dataset
from grafo_mapeo import (AL_TRABAJO, COMPROBANTE, DE_CONCEPTO, ESTADO, ESTADO_COMPROBANTE,
                         ESTADO_PRESUPUESTO, GASTO, IMPUTACION, IMPUTADO_A, MapeadorEstado, NEGOCIO,
                         PRECIO, PRECIO_DE, PRESUPUESTO, construir_datasets_estado)
from graph_identity import edge_uuid, node_uuid

Z = datetime.timezone(datetime.timedelta(hours=-3))
GRUPO = "copiloto"
NEG = dict(negocio_key="t-1", negocio_nombre="Mi Negocio")


def _eventos():
    # n_clientes=4 → sin relleno: los únicos eventos de estado son los casos §2 obligatorios,
    # deterministas y conocidos (ver el conteo en el docstring del PR).
    return generar_dataset(cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)


def _por_tipo(datasets):
    salida = {}
    for ds in datasets:
        edge = ds.mapping["source_entity"]["edges"][0]
        salida.setdefault(edge["edge_type"], []).append(ds)
    return salida


# ── el caso bandera de §2.3: sube tres veces y VUELVE — no puede resucitar ─────────────────────────

def test_el_concepto_que_vuelve_a_un_precio_anterior_no_resucita():
    datasets, invalidaciones = construir_datasets_estado(_eventos(), group_logico=GRUPO, **NEG)
    por_tipo = _por_tipo(datasets)
    precio_rows = por_tipo[PRECIO_DE][0].rows
    tablero_rows = [r for r in precio_rows if "Tablero eléctrico" in r["precio_label"]]
    valores = [r["valor"] for r in tablero_rows]
    # 4 puntos de precio: 85000, 95000, 110000, 85000 — el último VUELVE al primero.
    assert valores == ["85000.00", "95000.00", "110000.00", "85000.00"]
    # las claves de los dos nodos "85000" tienen que ser DISTINTAS (LOG_EVENT_ID distinto) — si
    # colapsaran, el segundo POST resucitaría la arista invalidada del primero.
    primero, vuelta = tablero_rows[0], tablero_rows[-1]
    assert primero["precio_key"] != vuelta["precio_key"]
    # y por lo tanto sus edge_uuid también difieren.
    src = node_uuid(GRUPO, NEGOCIO, "t-1")
    u1 = edge_uuid(GRUPO, src, PRECIO_DE, node_uuid(GRUPO, PRECIO, primero["precio_key"]))
    u2 = edge_uuid(GRUPO, src, PRECIO_DE, node_uuid(GRUPO, PRECIO, vuelta["precio_key"]))
    assert u1 != u2


def test_el_primer_precio_del_tablero_queda_invalidado_y_el_ultimo_no():
    datasets, invalidaciones = construir_datasets_estado(_eventos(), group_logico=GRUPO, **NEG)
    por_tipo = _por_tipo(datasets)
    tablero_rows = [r for r in por_tipo[PRECIO_DE][0].rows if "Tablero eléctrico" in r["precio_label"]]
    src = node_uuid(GRUPO, NEGOCIO, "t-1")

    def _uuid(row):
        return edge_uuid(GRUPO, src, PRECIO_DE, node_uuid(GRUPO, PRECIO, row["precio_key"]))

    invalidados = {i.edge_uuid for i in invalidaciones}
    # los 3 primeros puntos de precio del tablero fueron superados (cada uno por el siguiente).
    for row in tablero_rows[:3]:
        assert _uuid(row) in invalidados
    # el último (la vuelta a 85000) es el vigente: nadie lo supera, no está invalidado.
    assert _uuid(tablero_rows[-1]) not in invalidados


def test_el_concepto_estable_nunca_se_invalida():
    """'Instalación de luces' tiene un solo punto de precio — nunca lo supera nada."""
    datasets, invalidaciones = construir_datasets_estado(_eventos(), group_logico=GRUPO, **NEG)
    por_tipo = _por_tipo(datasets)
    fila = next(r for r in por_tipo[PRECIO_DE][0].rows if "Instalación de luces" in r["precio_label"])
    src = node_uuid(GRUPO, NEGOCIO, "t-1")
    u = edge_uuid(GRUPO, src, PRECIO_DE, node_uuid(GRUPO, PRECIO, fila["precio_key"]))
    assert u not in {i.edge_uuid for i in invalidaciones}


# ── segundo salto: DE_CONCEPTO siempre apunta al MISMO Concepto estable ─────────────────────────────

def test_de_concepto_converge_al_mismo_nodo_concepto_pase_lo_que_pase_con_precio():
    """Los 4 nodos Precio del tablero son DISTINTOS, pero los 4 `DE_CONCEPTO` apuntan al MISMO
    `concepto_key` — si no, el catálogo se fragmentaría y INCLUYE dejaría de coincidir (v1 §7.3)."""
    datasets, _ = construir_datasets_estado(_eventos(), group_logico=GRUPO, **NEG)
    ds = _por_tipo(datasets)[DE_CONCEPTO][0]
    tablero_rows = [r for r in ds.rows if r["concepto_nombre"] == "Tablero eléctrico"]
    assert len(tablero_rows) == 4
    assert len({r["concepto_key"] for r in tablero_rows}) == 1


# ── ESTADO_PRESUPUESTO / ESTADO_COMPROBANTE: aprobado/desestimado/anulada invalidan al anterior ────

def test_presupuesto_aprobado_invalida_el_pendiente_anterior():
    datasets, invalidaciones = construir_datasets_estado(_eventos(), group_logico=GRUPO, **NEG)
    ds = _por_tipo(datasets)[ESTADO_PRESUPUESTO][0]
    fila_panaderia = [r for r in ds.rows if r["fuente_key"] == "P-0001"]
    assert [r["estado"] for r in fila_panaderia] == ["pendiente", "aprobado"]
    u_pendiente = edge_uuid(GRUPO, node_uuid(GRUPO, PRESUPUESTO, "P-0001"), ESTADO_PRESUPUESTO,
                            node_uuid(GRUPO, ESTADO, fila_panaderia[0]["estado_key"]))
    assert u_pendiente in {i.edge_uuid for i in invalidaciones}


def test_presupuesto_sin_respuesta_nunca_se_invalida():
    """Kiosco El Sol: un solo evento ('pendiente') — el caso del presupuesto colgado (§9 pregunta 7).
    No tiene que aparecer entre las invalidaciones: nadie lo superó."""
    datasets, invalidaciones = construir_datasets_estado(_eventos(), group_logico=GRUPO, **NEG)
    ds = _por_tipo(datasets)[ESTADO_PRESUPUESTO][0]
    numeros = {r["fuente_key"] for r in ds.rows}
    # el presupuesto de Kiosco El Sol tiene un solo renglón de estado en todo el dataset.
    colgados = [n for n in numeros if sum(1 for r in ds.rows if r["fuente_key"] == n) == 1]
    assert colgados, "tiene que existir al menos un presupuesto con un solo evento de estado"


def test_factura_anulada_invalida_estado_comprobante_pero_no_emitio():
    """v1 §2.2: la anulación cambia `ESTADO_COMPROBANTE`, nunca invalida `EMITIO` (arista de EVENTO,
    en otro mapeador). Acá sólo se verifica la mitad de ESTADO: que la anulación SÍ generó una
    invalidación de `ESTADO_COMPROBANTE` sobre el estado 'emitida' anterior."""
    datasets, invalidaciones = construir_datasets_estado(_eventos(), group_logico=GRUPO, **NEG)
    ds = _por_tipo(datasets)[ESTADO_COMPROBANTE][0]
    anuladas = [r for r in ds.rows if r["estado"] == "anulada"]
    assert len(anuladas) == 1
    fuente_anulada = anuladas[0]["fuente_key"]
    fila_emitida = next(r for r in ds.rows
                        if r["fuente_key"] == fuente_anulada and r["estado"] == "emitida")
    u_emitida = edge_uuid(GRUPO, node_uuid(GRUPO, COMPROBANTE, fuente_anulada), ESTADO_COMPROBANTE,
                          node_uuid(GRUPO, ESTADO, fila_emitida["estado_key"]))
    assert u_emitida in {i.edge_uuid for i in invalidaciones}


# ── IMPUTADO_A + AL_TRABAJO ──────────────────────────────────────────────────────────────────────

def test_gasto_imputado_produce_imputado_a_y_al_trabajo_bucket_comprobante():
    """`AL_TRABAJO:{tipo}` es la clave INTERNA que el mapeador usa para no mezclar los 3 buckets
    (Presupuesto/Comprobante/Cobro) bajo un mismo dataset — el `edge_type` que efectivamente sale en
    el `mapping` sigue siendo `AL_TRABAJO` (una sola string; el `target_entity_type` del dataset es lo
    que distingue el bucket). Acá se verifica eso: existe un dataset AL_TRABAJO cuyo target es
    `Comprobante`."""
    datasets, invalidaciones = construir_datasets_estado(_eventos(), group_logico=GRUPO, **NEG)
    por_tipo = _por_tipo(datasets)
    assert IMPUTADO_A in por_tipo
    assert AL_TRABAJO in por_tipo
    targets = {ds.mapping["source_entity"]["edges"][0]["target_entity_type"] for ds in por_tipo[AL_TRABAJO]}
    assert COMPROBANTE in targets
    fila = por_tipo[IMPUTADO_A][0].rows[0]
    assert fila["gasto_key"] == "G-2"
    # nunca imputado dos veces en este dataset: no hay invalidación de IMPUTADO_A.
    u = edge_uuid(GRUPO, node_uuid(GRUPO, GASTO, "G-2"), IMPUTADO_A,
                 node_uuid(GRUPO, IMPUTACION, fila["imputacion_key"]))
    assert u not in {i.edge_uuid for i in invalidaciones}


# ── conteo total — el DoD end-to-end: derivador + mapeo dan las invalidaciones que el dataset promete ──

def test_conteo_total_de_invalidaciones_de_estado_contra_el_dataset_real():
    """8 = 3 (serie del tablero) + 4 (presupuestos con desenlace: Panadería aprobado, Kiosco
    desestimado, Taller Rossi viejo desestimado, Almacén Antiguo aprobado —éste último de
    `_cliente_que_dejo_de_comprar`, fácil de pasar por alto—) + 1 (factura anulada). Kiosco
    'sin respuesta' y Taller Rossi 'nuevo' NO invalidan nada (un solo evento cada uno); G-2 se
    imputa una sola vez. Fija el número: si el dataset cambia, este test avisa que hay que
    recontar, en vez de dejarlo pasar en silencio."""
    _, invalidaciones = construir_datasets_estado(_eventos(), group_logico=GRUPO, **NEG)
    assert len(invalidaciones) == 8


# ── control: el `orden` que arma el mapeo coincide EXACTO con el que arma el derivador ─────────────

def test_el_orden_del_mapeo_coincide_con_el_del_derivador():
    """Precondición silenciosa de todo lo de arriba: `construir_datasets_estado` ordena `eventos` con
    el MISMO criterio que `eventos_desde_sinteticos` (mismo sort, mismo desempate). Si divergieran, el
    `LOG_EVENT_ID` de una transición no coincidiría entre las dos capas y las invalidaciones apuntarían
    a nodos que el mapeo nunca declaró — `edge_uuid_de` devolvería `None` en silencio y la invalidación
    se perdería sin error (exactamente el modo de fallo de la trampa 4)."""
    eventos = _eventos()
    logs = eventos_desde_sinteticos(eventos)
    ordenados = sorted(eventos, key=lambda e: e.ocurrido_en)
    assert [ (l.entidad_tipo, l.entidad_id, l.campo) for l in logs ] == \
           [ (e.entidad_tipo, e.entidad_id, e.campo) for e in ordenados ]
    # y ninguna invalidación se pierde silenciosamente contra el mapeo real:
    mapeador = MapeadorEstado(**NEG)
    for i, ev in enumerate(ordenados):
        mapeador.procesar(i, ev, group_logico=GRUPO)
    perdidas = [s for s in invalidaciones_historico(logs) if mapeador.edge_uuid_de(s.superado) is None]
    assert perdidas == []
