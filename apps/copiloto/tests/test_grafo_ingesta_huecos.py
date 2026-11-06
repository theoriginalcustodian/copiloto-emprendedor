"""Huecos de ingesta al grafo (inventario 2026-11-06) — mapeo + sync incremental, sin Temporal ni red.

Lo que se defiende, en orden de gravedad:
1. **Las altas con `campo` llegan al grafo.** `comprobante/emitido` y `presupuesto/creado` traen
   `campo="estado"`; el sync filtraba `campo is None` y nunca escribía EMITIO/PRESUPUESTO en producción.
2. **Corregir / borrar un cobro invalida lo que el grafo decía** — la 1ª revisión invalida las aristas
   del ALTA (venga el alta en el mismo batch o de una corrida anterior); las siguientes, la versión vigente.
3. Clientes, cobro→cliente y presupuesto→factura se mapean con la MISMA clave de cliente que el resto.
"""
from __future__ import annotations

import datetime

import httpx

from grafo_mapeo import (COBRADO_A, E_COBRO, E_FICHA_CLIENTE, E_REGISTRO_COBRO, EMITIO, ESTADO_CONCEPTO,
                         FACTURADO_EN, TIENE_CLIENTE, MapeadorEvento, edge_uuids_del_alta, ontologia)
from grafo_sync_activities import sincronizar_tenant
from graphity_structured_client import GraphityStructuredClient
from presupuesto_store import factura_id_de_presupuesto, presupuesto_de_workflow, workflow_id_de_factura

Z = datetime.timezone(datetime.timedelta(hours=-3))
CID = "t-1"
GROUP = f"negocio-{CID}"


def _t(dia):
    return datetime.datetime(2026, 11, dia, tzinfo=Z)


# ── fake Postgres: el del test de sync + la query del ALTA (`_leer_alta`) ──────────────────────────
class _FakeCur:
    def __init__(self, db):
        self._db, self._row, self._rows = db, None, None

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).upper()
        if s.startswith("SELECT SET_CONFIG"):
            return
        if s.startswith("SELECT ID, ENTIDAD_TIPO") and "EVENTO='CREADO'" in s:
            _cid, tipo, eid = params
            altas = [r for r in self._db["eventos"] if r[1] == tipo and r[2] == eid and r[3] == "creado"]
            self._row = altas[0] if altas else None
        elif s.startswith("SELECT ID, ENTIDAD_TIPO") and "AND ID=%S" in s:
            _cid, orden = params
            self._row = next((r for r in self._db["eventos"] if r[0] == orden), None)
        elif s.startswith("SELECT ULTIMO_ORDEN"):
            fila = self._db["vigencias"].get(tuple(params))
            self._row = (fila[0],) if fila else None
        elif s.startswith("SELECT ID, ENTIDAD_TIPO"):
            _cid, desde = params
            self._rows = [r for r in self._db["eventos"] if r[0] > desde]
        elif s.startswith("SELECT ULTIMO_EVENTO_ID"):
            self._row = self._db["cursores"].get(params[0])
        elif s.startswith("INSERT") and "COPILOTO_GRAFO_CURSOR" in s:
            self._db["cursores"][params[0]] = (params[1],)
        elif s.startswith("SELECT ULTIMO_EDGE_UUID"):
            fila = self._db["vigencias"].get(tuple(params))
            self._row = (fila[1],) if fila else None
        elif s.startswith("INSERT") and "COPILOTO_GRAFO_VIGENCIA" in s:
            cid, tipo, eid, campo, orden, edge = params
            self._db["vigencias"][(cid, tipo, eid, campo)] = (orden, edge)
        else:
            raise AssertionError(f"query no reconocida por el fake: {sql!r}")

    def fetchone(self):
        return self._row

    def fetchall(self):
        return self._rows

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class _FakeConn:
    def __init__(self, db):
        self._db, self.autocommit = db, True

    def cursor(self):
        return _FakeCur(self._db)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _db(*eventos):
    return {"eventos": list(eventos), "cursores": {}, "vigencias": {}}


def _correr(db):
    posts, patches = [], []

    def handler(req: httpx.Request) -> httpx.Response:
        import json as _j
        if req.method == "PUT" and req.url.path == "/api/v2/entity-types":
            return httpx.Response(200, json={"success": True})
        if req.method == "POST" and req.url.path == "/api/v2/graph/structured":
            posts.append(_j.loads(req.content))
            return httpx.Response(202, json={"migration_id": f"mig_{len(posts)}"})
        if req.method == "GET" and req.url.path.startswith("/api/v2/graph/structured/mig_"):
            return httpx.Response(200, json={"status": "completed", "totals": {"failed": 0}})
        if req.method == "PATCH" and req.url.path.startswith("/api/v2/graph/edge/"):
            patches.append(req.url.path.rsplit("/", 1)[-1])
            return httpx.Response(200, json={})
        raise AssertionError(f"request no esperado: {req.method} {req.url.path}")

    http = httpx.Client(transport=httpx.MockTransport(handler), timeout=5.0)
    client = GraphityStructuredClient(base_url="https://graphity.test", api_key="gphy_test",
                                      client=http, sleep=lambda _s: None)
    sincronizar_tenant(lambda: _FakeConn(db), CID, negocio_nombre="Mi Negocio", client=client)
    return posts, patches


def _tipos(posts):
    return [p["mapping"]["source_entity"]["edges"][0]["edge_type"] for p in posts]


# filas `(id, entidad_tipo, entidad_id, evento, campo, valor_a, datos, ocurrido_en)` con la forma REAL
def _cobro_creado(id_, eid="9", cliente="Panadería"):
    return (id_, "cobro", eid, "creado", None, None,
            {"monto": "15000.00", "medio": "efectivo", "fecha": "2026-11-01", "origen": "manual",
             "cliente_nombre": cliente, "concepto": "flete"}, _t(1))


def _cobro_corregido(id_, eid="9", monto="50000.00", dia=2):
    return (id_, "cobro", eid, "corregido", "registro",
            {"monto": monto, "medio": "efectivo", "fecha": "2026-11-01", "cliente_nombre": "Panadería",
             "concepto": "flete"}, {"cambios": ["monto"]}, _t(dia))


def _cobro_borrado(id_, eid="9", dia=3):
    return (id_, "cobro", eid, "borrado", "registro", None, {}, _t(dia))


def _alta_uuids(fila):
    from grafo_sync_activities import _EventoRow
    ev = _EventoRow(orden=fila[0], entidad_tipo=fila[1], entidad_id=fila[2], evento=fila[3],
                    campo=fila[4], valor_a=fila[5], datos=fila[6], ocurrido_en=fila[7])
    return edge_uuids_del_alta(ev, group_logico=GROUP, negocio_key=CID, negocio_nombre="Mi Negocio")


# ── 1. la raíz: las altas con `campo` llegan al grafo ────────────────────────────────────────────
def test_comprobante_emitido_con_campo_estado_escribe_EMITIO_ademas_del_estado():
    fila = (1, "comprobante", "30712345678|6|1|7", "emitido", "estado", "emitida",
            {"tipo_cbte": 6, "punto_venta": 1, "nro": 7, "total": "1000.00",
             "receptor_nombre": "Panadería", "presupuesto_ref": 77}, _t(1))
    posts, _ = _correr(_db(fila))
    tipos = _tipos(posts)
    assert EMITIO in tipos, "el alta de la factura no llegó al grafo (filtro campo is None)"
    assert "FACTURADO_A" in tipos and FACTURADO_EN in tipos and "ESTADO_COMPROBANTE" in tipos


def test_presupuesto_creado_con_campo_estado_escribe_PRESUPUESTO():
    fila = (1, "presupuesto", "77", "creado", "estado", "pendiente",
            {"numero": "P-1", "total": "5000.00", "concepto": "Flete", "receptor_nombre": "Panadería",
             "items": [{"descripcion": "flete", "cantidad": "1", "precio_unitario": "5000.00"}]}, _t(1))
    tipos = _tipos(_correr(_db(fila))[0])
    assert {"PRESUPUESTO", "DIRIGIDO_A", "INCLUYE", "ESTADO_PRESUPUESTO"} <= set(tipos)


# ── 2. corregir / borrar un cobro ─────────────────────────────────────────────────────────────────
def test_cobro_creado_escribe_COBRO_y_COBRADO_A():
    tipos = _tipos(_correr(_db(_cobro_creado(1)))[0])
    assert E_COBRO in tipos and COBRADO_A in tipos


def test_correccion_en_otra_corrida_invalida_el_alta_y_escribe_el_registro():
    db = _db(_cobro_creado(1))
    _correr(db)
    db["eventos"].append(_cobro_corregido(2))
    posts, patches = _correr(db)
    assert sorted(patches) == sorted(_alta_uuids(_cobro_creado(1)))   # E_COBRO + COBRADO_A del alta
    assert len(patches) == 2
    assert _tipos(posts) == [E_REGISTRO_COBRO]
    assert db["vigencias"][(CID, "cobro", "9", "registro")][0] == 2


def test_alta_y_correccion_en_el_mismo_batch_invalidan_el_alta_igual():
    posts, patches = _correr(_db(_cobro_creado(1), _cobro_corregido(2)))
    assert sorted(patches) == sorted(_alta_uuids(_cobro_creado(1)))
    assert E_COBRO in _tipos(posts) and E_REGISTRO_COBRO in _tipos(posts)


def test_segunda_correccion_invalida_la_primera_no_el_alta_otra_vez():
    db = _db(_cobro_creado(1), _cobro_corregido(2))
    _correr(db)
    vigente = db["vigencias"][(CID, "cobro", "9", "registro")][1]
    db["eventos"].append(_cobro_corregido(3, monto="60000.00", dia=4))
    _, patches = _correr(db)
    assert patches == [vigente]


def test_borrado_sin_correccion_invalida_el_alta():
    db = _db(_cobro_creado(1))
    _correr(db)
    db["eventos"].append(_cobro_borrado(2))
    posts, patches = _correr(db)
    assert sorted(patches) == sorted(_alta_uuids(_cobro_creado(1)))
    assert posts == []                                        # una baja no escribe versión nueva
    assert db["cursores"][CID] == (2,)


def test_borrado_tras_correccion_invalida_el_registro_vigente():
    db = _db(_cobro_creado(1), _cobro_corregido(2))
    _correr(db)
    vigente = db["vigencias"][(CID, "cobro", "9", "registro")][1]
    db["eventos"].append(_cobro_borrado(3))
    _, patches = _correr(db)
    assert patches == [vigente]


def test_correccion_de_otro_cobro_no_toca_este():
    db = _db(_cobro_creado(1, eid="9"), _cobro_creado(2, eid="10", cliente="Kiosco"))
    _correr(db)
    db["eventos"].append(_cobro_corregido(3, eid="10"))
    _, patches = _correr(db)
    assert set(patches) == set(_alta_uuids(_cobro_creado(2, eid="10", cliente="Kiosco")))
    assert not set(patches) & set(_alta_uuids(_cobro_creado(1, eid="9")))


# ── 3. clientes, concepto, presupuesto→factura ────────────────────────────────────────────────────
def test_cliente_alta_y_edicion():
    alta = (1, "cliente", "5", "creado", None, None,
            {"nombre": "Panadería", "doc_nro": "20123456786", "condicion_iva": 5}, _t(1))
    db = _db(alta)
    assert TIENE_CLIENTE in _tipos(_correr(db)[0])
    db["eventos"].append((2, "cliente", "5", "editado", "registro",
                          {"nombre": "Panadería", "doc_nro": "20123456786", "telefono": "11"},
                          {"cambios": ["telefono"]}, _t(2)))
    posts, patches = _correr(db)
    assert _tipos(posts) == [E_FICHA_CLIENTE]
    assert patches == _alta_uuids(alta)


def test_el_nodo_cliente_del_alta_es_el_mismo_que_el_de_la_factura():
    """Si TIENE_CLIENTE usara el CUIT y FACTURADO_A el nombre, el mismo cliente serían dos nodos."""
    m = MapeadorEvento(negocio_key=CID, negocio_nombre="N")
    m.procesar(type("E", (), dict(entidad_tipo="cliente", evento="creado", entidad_id="5",
                                  datos={"nombre": "Panadería", "doc_nro": "20123456786"},
                                  ocurrido_en=_t(1)))())
    m.procesar(type("E", (), dict(entidad_tipo="comprobante", evento="emitido", entidad_id="x|6|1|1",
                                  datos={"tipo_cbte": 6, "punto_venta": 1, "nro": 1, "total": "1",
                                         "receptor_nombre": "Panadería"}, ocurrido_en=_t(1)))())
    filas = {ds.mapping["source_entity"]["edges"][0]["edge_type"]: ds.rows[0] for ds in m.datasets(GROUP)}
    assert filas[TIENE_CLIENTE]["cliente_key"] == filas["FACTURADO_A"]["cliente_key"]


def test_concepto_desactivado_es_estado_y_no_invalida_el_precio():
    db = _db((1, "concepto", "flete", "creado", "precio", "5000.00", {"nombre": "Flete"}, _t(1)))
    _correr(db)
    db["eventos"].append((2, "concepto", "flete", "desactivado", "activo", "inactivo",
                          {"nombre": "Flete"}, _t(2)))
    posts, patches = _correr(db)
    assert _tipos(posts) == [ESTADO_CONCEPTO]
    assert patches == []                       # eje `activo` nuevo: la serie de precio sigue vigente
    assert (CID, "concepto", "flete", "precio") in db["vigencias"]


def test_presupuesto_de_workflow_es_la_inversa_exacta():
    wf = workflow_id_de_factura(CID, factura_id_de_presupuesto(77))
    assert presupuesto_de_workflow(CID, wf) == 77
    assert presupuesto_de_workflow(CID, workflow_id_de_factura(CID, "abc123")) is None
    assert presupuesto_de_workflow(CID, None) is None
    # el workflow de OTRO tenant con el mismo presupuesto no se reconoce como propio
    assert presupuesto_de_workflow(CID, workflow_id_de_factura("otro", factura_id_de_presupuesto(77))) is None


def test_la_ontologia_declara_todo_tipo_que_el_mapeo_emite():
    entity_types, edge_types = ontologia()
    nombres = {e["name"] for e in edge_types}
    assert {TIENE_CLIENTE, COBRADO_A, FACTURADO_EN, ESTADO_CONCEPTO, E_REGISTRO_COBRO,
            E_FICHA_CLIENTE} <= nombres
    entidades = {e["name"] for e in entity_types}
    for e in edge_types:
        for st in e["source_targets"]:
            assert st["source"] in entidades and st["target"] in entidades
