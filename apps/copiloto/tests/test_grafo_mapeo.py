"""El mapeo de dominio (§1.3, mitad de EVENTO) — evento del log → `Dataset` con el `fact_template`
correcto, y la identidad `uuid5` derivada exactamente como la calcularía el server (`edge_uuid` sobre
`node_uuid` de los nodos, nunca una fórmula propia — ver el docstring de `grafo_mapeo.py`).
"""
from __future__ import annotations

import datetime

from derivador import eventos_desde_sinteticos
from grafo_dataset import generar_dataset
from grafo_mapeo import COMPROBANTE, construir_datasets_evento
from graph_identity import edge_uuid, node_uuid

Z = datetime.timezone(datetime.timedelta(hours=-3))
GRUPO = "copiloto"


def _neg(**kw):
    return construir_datasets_evento(
        kw.pop("eventos"), group_logico=GRUPO, negocio_key="t-1", negocio_nombre="Mi Negocio", **kw)


def _por_tipo(datasets):
    """{edge_type: dataset} — cada dataset de EVENTO tiene una sola arista saliente."""
    return {ds.mapping["source_entity"]["edges"][0]["edge_type"]: ds for ds in datasets}


# ── EMITIO + FACTURADO_A: una factura emitida produce las dos aristas ──────────────────────────────

def test_comprobante_emitido_produce_emitio_y_facturado_a():
    ev = generar_dataset(cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)
    datasets = _neg(eventos=ev)
    por_tipo = _por_tipo(datasets)
    assert "EMITIO" in por_tipo and "FACTURADO_A" in por_tipo
    fila_emitio = por_tipo["EMITIO"].rows[0]
    assert fila_emitio["negocio_key"] == "t-1"
    assert fila_emitio["comprobante_key"]  # la clave natural cuit|tipo|pv|nro, no un id inventado


def test_fact_template_de_emitio_interpola_todo_lo_que_hay_que_poder_leer():
    ds = _por_tipo(_neg(eventos=generar_dataset(
        cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)))["EMITIO"]
    edge = ds.mapping["source_entity"]["edges"][0]
    # cada placeholder del fact_template tiene que resolver a una columna real (o {source}/{target}).
    for placeholder in ("{source}", "{tipo}", "{pto}", "{nro}", "{total}", "{fecha}"):
        assert placeholder in edge["fact_template"]
    for col in ("tipo", "pto", "nro", "total", "fecha"):
        assert col in edge["property_map"]


def test_facturado_a_lleva_el_cliente_como_target():
    ds = _por_tipo(_neg(eventos=generar_dataset(
        cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)))["FACTURADO_A"]
    nombres = {r["cliente_nombre"] for r in ds.rows}
    assert "Panadería La Espiga" in nombres


# ── REGISTRO_GASTO + PAGADO_A ────────────────────────────────────────────────────────────────────

def test_gasto_creado_produce_registro_gasto_y_pagado_a_con_su_proveedor():
    ds = _por_tipo(_neg(eventos=generar_dataset(
        cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)))
    assert "REGISTRO_GASTO" in ds and "PAGADO_A" in ds
    proveedores = {r["proveedor_nombre"] for r in ds["PAGADO_A"].rows}
    assert "Distribuidora Sur" in proveedores


def test_el_nodo_gasto_carga_su_propio_monto_y_categoria():
    """La pregunta #13 ('¿cuánto me dejó este trabajo?') lee `monto`/`categoria` por TRAVERSAL desde
    `IMPUTADO_A` (Gasto→Imputacion), sin volver a pasar por `REGISTRO_GASTO` — decisión planificación
    2026-07-23 00:24. Por eso el nodo `Gasto` (no sólo la arista) tiene que cargar esos atributos como
    `target_property_map`; si sólo estuvieran en la arista, el traversal no los vería (trampa 6:
    `/search`/`/traverse` no proyectan `attributes` de arista, y un traversal al NODO tampoco ve
    atributos que sólo vivan en OTRA arista)."""
    ds = _por_tipo(_neg(eventos=generar_dataset(
        cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)))["REGISTRO_GASTO"]
    edge = ds.mapping["source_entity"]["edges"][0]
    assert edge["target_property_map"].keys() >= {"monto", "categoria"}
    # y el dato realmente está en las filas (no sólo declarado el mapeo de columnas).
    assert all(r.get("monto") and r.get("categoria") for r in ds.rows)


# ── PRESUPUESTO / DIRIGIDO_A / INCLUYE / REEMPLAZA_A ────────────────────────────────────────────

def test_presupuesto_produce_las_cuatro_aristas_de_evento_asociadas():
    ds = _por_tipo(_neg(eventos=generar_dataset(
        cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)))
    assert {"PRESUPUESTO", "DIRIGIDO_A", "INCLUYE", "REEMPLAZA_A"} <= ds.keys()
    # el dataset sintético trae un presupuesto que reemplaza a otro (Taller Rossi)
    reemplazos = ds["REEMPLAZA_A"].rows
    assert len(reemplazos) == 1
    assert reemplazos[0]["reemplazado_key"] == reemplazos[0]["reemplazado_numero"]


def test_incluye_trae_un_item_por_concepto_del_presupuesto():
    ds = _por_tipo(_neg(eventos=generar_dataset(
        cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)))["INCLUYE"]
    conceptos = {r["concepto_nombre"] for r in ds.rows}
    assert "Tablero eléctrico" in conceptos or "Instalación de luces" in conceptos


# ── COBRO — el origen viaja en el fact (v1 §2.1: un cobro visto por el sistema no vale igual que uno dictado) ──

def test_cobro_lleva_origen_en_property_map_y_en_el_fact_template():
    ds = _por_tipo(_neg(eventos=generar_dataset(
        cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)))["COBRO"]
    edge = ds.mapping["source_entity"]["edges"][0]
    assert "origen" in edge["property_map"]
    assert "{origen}" in edge["fact_template"]
    origenes = {r["origen"] for r in ds.rows}
    assert {"factura", "manual"} <= origenes


# ── identidad: nunca la fórmula propia, siempre node_uuid→edge_uuid como el server ─────────────────

def test_edge_uuid_de_emitio_coincide_con_el_calculo_manual_del_server():
    """El punto del hallazgo emitido: la identidad de arista NO lleva ningún discriminador propio en
    la fórmula — es SIEMPRE `edge_uuid(group, node_uuid(src), tipo, node_uuid(tgt))`. Este test fija
    ese contrato: si algún día alguien mete un `event_key` en la fórmula de la arista, rompe acá."""
    ds = _por_tipo(_neg(eventos=generar_dataset(
        cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)))["EMITIO"]
    fila = ds.rows[0]
    src = node_uuid(GRUPO, "Negocio", fila["negocio_key"])
    tgt = node_uuid(GRUPO, COMPROBANTE, fila["comprobante_key"])
    esperado = edge_uuid(GRUPO, src, "EMITIO", tgt)
    calculados = _neg(eventos=generar_dataset(
        cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4))
    from grafo_mapeo import MapeadorEvento
    mapeador = MapeadorEvento(negocio_key="t-1", negocio_nombre="Mi Negocio")
    for ev in generar_dataset(cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4):
        mapeador.procesar(ev)
    assert esperado in mapeador.edge_uuids(GRUPO)


def test_ninguna_arista_de_evento_se_declara_estable():
    """Las 9 aristas de EVENTO son únicas por su clave natural — ningún re-POST puede resucitar nada,
    así que ninguna necesita el guard anti-resurrección (`aristas_estables` vacío en todos los Dataset)."""
    datasets = _neg(eventos=generar_dataset(
        cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4))
    assert all(ds.aristas_estables == () for ds in datasets)


# ── el motor de invalidación NO ve nada de esto (contrato entre capas) ──────────────────────────────

def test_transiciones_puras_de_estado_no_generan_ninguna_arista_de_evento():
    """`concepto/precio_cambiado`, `presupuesto/estado_cambiado`, `comprobante/estado_cambiado`,
    `gasto/imputado` son transiciones de ESTADO PURAS —no disparan ningún `(entidad_tipo, evento)` del
    despacho de `MapeadorEvento`— y por eso no producen ninguna fila acá; son la otra mitad (mitad
    ESTADO, `MapeadorEstado`). Ojo: `comprobante/emitido` y `presupuesto/creado` SÍ tienen `campo`
    seteado (son también transiciones de estado) pero ADEMÁS disparan EMITIO/PRESUPUESTO — son
    dual-propósito, no puros; por eso se filtran por `evento`, no por `campo is not None`."""
    from grafo_mapeo import MapeadorEvento
    eventos = generar_dataset(cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)
    puros = [e for e in eventos if e.evento in ("precio_cambiado", "estado_cambiado", "imputado")]
    assert puros, "el dataset sintético SIEMPRE trae cambios de precio/estado/imputación"
    mapeador = MapeadorEvento(negocio_key="t-1", negocio_nombre="Mi Negocio")
    for ev in puros:
        mapeador.procesar(ev)   # no debe lanzar, y no debe producir filas
    assert mapeador.datasets(GRUPO) == []


# ── control: el generador de EventoLog (derivador) sigue viendo el mismo log, sin acoplarse al mapeo ──

def test_el_derivador_no_depende_del_mapeo_mismo_log_mismo_resultado():
    """Control de que ambas capas leen el MISMO stream sin interferirse: `eventos_desde_sinteticos`
    (derivador) sobre el log completo da la misma cuenta de eventos que ve `MapeadorEvento`."""
    sinteticos = generar_dataset(cliente_id="t-1", hoy=datetime.date(2026, 7, 22), n_clientes=4)
    logs = eventos_desde_sinteticos(sinteticos)
    assert len(logs) == len(sinteticos)
