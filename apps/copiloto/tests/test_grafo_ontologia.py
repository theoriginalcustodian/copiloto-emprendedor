"""`grafo_mapeo.ontologia()` (BETA-G0) — el payload que se registra contra Graphity antes de poder
escribir. Verifica estructura y que cubra EXACTAMENTE los tipos que los mapeadores reales usan: un
edge_type que el mapeo emite y la ontología no declara es un 422 en producción que estos tests cazan
en 20ms, sin red.
"""
from __future__ import annotations

import datetime

from grafo_mapeo import (AL_TRABAJO, COBRO, COMPROBANTE, CONCEPTO, DE_CONCEPTO, DIRIGIDO_A, E_COBRO,
                         E_PRESUPUESTO, EMITIO, ESTADO, ESTADO_COMPROBANTE, ESTADO_PRESUPUESTO,
                         FACTURADO_A, GASTO, IMPUTACION, IMPUTADO_A, INCLUYE, MapeadorEstado,
                         MapeadorEvento, PAGADO_A, PRECIO, PRECIO_DE, REEMPLAZA_A, REGISTRO_GASTO,
                         ontologia)

Z = datetime.timezone(datetime.timedelta(hours=-3))


def _todos_los_edge_types_del_mapeo() -> set[str]:
    """Los `edge_type` que `MapeadorEvento`/`MapeadorEstado` pueden llegar a emitir — leídos de sus
    propios acumuladores, no transcritos a mano (si el mapeo agrega un tipo, este set lo sigue solo)."""
    ev = MapeadorEvento(negocio_key="t-1", negocio_nombre="Mi Negocio")
    tipos = {EMITIO, FACTURADO_A, REGISTRO_GASTO, PAGADO_A, E_PRESUPUESTO, DIRIGIDO_A, INCLUYE,
            E_COBRO, REEMPLAZA_A}
    assert set(ev._acc.keys()) == tipos, "el set de arriba no coincide con los acumuladores reales"
    # MapeadorEstado arma sus acumuladores lazy (recién al procesar), así que los 5 tipos de estado se
    # declaran acá directo desde las constantes del módulo — son los únicos edge_type que emite.
    tipos |= {ESTADO_PRESUPUESTO, ESTADO_COMPROBANTE, PRECIO_DE, DE_CONCEPTO, IMPUTADO_A, AL_TRABAJO}
    return tipos


def test_ontologia_declara_todos_los_edge_types_del_mapeo():
    _, edge_types = ontologia()
    nombres = {e["name"] for e in edge_types}
    assert nombres == _todos_los_edge_types_del_mapeo()


def test_ontologia_entity_types_cubren_todos_los_source_target_referenciados():
    entity_types, edge_types = ontologia()
    declaradas = {e["name"] for e in entity_types}
    referenciadas: set[str] = set()
    for e in edge_types:
        for st in e["source_targets"]:
            referenciadas.add(st["source"])
            referenciadas.add(st["target"])
    faltantes = referenciadas - declaradas
    assert not faltantes, f"entity_types sin declarar pero referenciados por un edge: {faltantes}"


def test_ontologia_property_types_son_todos_text():
    entity_types, edge_types = ontologia()
    for e in entity_types + edge_types:
        for p in e["properties"]:
            assert p["type"] == "Text", f"{e['name']}.{p['name']} no es Text"


def test_ontologia_es_json_serializable_y_no_tiene_scope_vacio_implicito():
    import json
    entity_types, edge_types = ontologia()
    payload = {"entity_types": entity_types, "edge_types": edge_types, "user_ids": [],
              "graph_ids": ["negocio-t-1"]}
    json.dumps(payload)   # no debe lanzar
    assert payload["graph_ids"], "graph_ids vacío == scope project-wide (v1 §5.7, prohibido)"
