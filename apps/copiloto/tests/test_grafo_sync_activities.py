"""`sincronizar_tenant` (BETA-G0) — la lógica de invalidación incremental, sin Temporal ni red: fake
Postgres (mismo patrón que test_mp_dedup.py) + `httpx.MockTransport` (mismo patrón que
test_graphity_structured_client.py). Lo que se defiende: que una transición de estado invalide la
vigente ANTERIOR (venga de la DB de una corrida previa, o de este mismo batch) y nunca resucite nada.
"""
from __future__ import annotations

import datetime

import httpx

from grafo_sync_activities import sincronizar_tenant
from graphity_structured_client import GraphityStructuredClient

Z = datetime.timezone(datetime.timedelta(hours=-3))
CID = "t-1"


class _FakeCur:
    def __init__(self, db):
        self._db = db
        self._row = None
        self._rows = None

    def execute(self, sql, params=()):
        s = sql.strip().upper()
        if s.startswith("SELECT SET_CONFIG"):
            return
        if s.startswith("SELECT ID, ENTIDAD_TIPO"):
            cid, desde = params
            self._rows = [r for r in self._db["eventos"] if r[0] > desde]
        elif s.startswith("SELECT ULTIMO_EVENTO_ID"):
            self._row = self._db["cursores"].get(params[0])
        elif s.startswith("INSERT") and "COPILOTO_GRAFO_CURSOR" in s:
            cid, valor = params
            self._db["cursores"][cid] = (valor,)
        elif s.startswith("SELECT ULTIMO_EDGE_UUID"):
            cid, tipo, eid, campo = params
            fila = self._db["vigencias"].get((cid, tipo, eid, campo))
            self._row = (fila[1],) if fila else None   # la query real sólo trae 1 columna
        elif s.startswith("INSERT") and "COPILOTO_GRAFO_VIGENCIA" in s:
            cid, tipo, eid, campo, orden, edge_uuid = params
            self._db["vigencias"][(cid, tipo, eid, campo)] = (orden, edge_uuid)
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
        self._db = db
        self.autocommit = True

    def cursor(self):
        return _FakeCur(self._db)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _evento_gasto(id_, entidad_id, ocurrido_en, *, monto="10.00", categoria="otros"):
    """`(id, entidad_tipo, entidad_id, evento, campo, valor_a, datos, ocurrido_en)` — evento PURO
    (`campo=None`), la forma real de `registrar_evento` para `gasto/creado` (`gasto_store.py`)."""
    return (id_, "gasto", entidad_id, "creado", None, None,
           {"monto": monto, "categoria": categoria, "proveedor": "", "medio_pago": "", "origen": "manual"},
           ocurrido_en)


def _evento_estado_presupuesto(id_, entidad_id, evento, estado, ocurrido_en):
    """Transición de ESTADO real (`campo='estado'`, `valor_a=<el estado nuevo>` — NO en `datos`, ver
    `evento_store.registrar_evento` y `grafo_mapeo.MapeadorEstado._estado_generico`)."""
    return (id_, "presupuesto", entidad_id, evento, "estado", estado, {}, ocurrido_en)


def _db_con_eventos(*eventos):
    return {"eventos": list(eventos), "cursores": {}, "vigencias": {}}


def _cliente_mock(handler) -> GraphityStructuredClient:
    http = httpx.Client(transport=httpx.MockTransport(handler), timeout=5.0)
    return GraphityStructuredClient(base_url="https://graphity.test", api_key="gphy_test",
                                    client=http, sleep=lambda _s: None)


def _handler_ok(migraciones: list, invalidaciones: list):
    def handler(req: httpx.Request) -> httpx.Response:
        import json as _j
        if req.method == "PUT" and req.url.path == "/api/v2/entity-types":
            return httpx.Response(200, json={"success": True})
        if req.method == "POST" and req.url.path == "/api/v2/graph/structured":
            body = _j.loads(req.content)
            mig_id = f"mig_{len(migraciones)}"
            migraciones.append(body)
            return httpx.Response(202, json={"migration_id": mig_id})
        if req.method == "GET" and req.url.path.startswith("/api/v2/graph/structured/mig_"):
            return httpx.Response(200, json={"status": "completed", "totals": {"failed": 0}})
        if req.method == "PATCH" and req.url.path.startswith("/api/v2/graph/edge/"):
            invalidaciones.append(req.url.path.rsplit("/", 1)[-1])
            return httpx.Response(200, json={})
        raise AssertionError(f"request no esperado: {req.method} {req.url.path}")
    return handler


def test_sin_eventos_nuevos_es_noop():
    db = _db_con_eventos()
    posts, patches = [], []
    r = sincronizar_tenant(lambda: _FakeConn(db), CID, negocio_nombre="Mi Negocio",
                           client=_cliente_mock(_handler_ok(posts, patches)))
    assert r == {"sincronizados": 0, "cursor": 0}
    assert posts == []


def test_gasto_creado_avanza_cursor_y_no_invalida_nada():
    db = _db_con_eventos(_evento_gasto(1, "50", datetime.datetime(2026, 8, 1, tzinfo=Z)))
    posts, patches = [], []
    r = sincronizar_tenant(lambda: _FakeConn(db), CID, negocio_nombre="Mi Negocio",
                           client=_cliente_mock(_handler_ok(posts, patches)))
    assert r["sincronizados"] == 1
    assert r["cursor"] == 1
    assert db["cursores"][CID] == (1,)
    assert patches == []                          # evento puro: nunca invalida
    assert posts and posts[0]["mapping"]["source_entity"]["edges"][0]["edge_type"] == "REGISTRO_GASTO"


def test_primera_transicion_de_estado_no_invalida_nada_pero_queda_vigente():
    db = _db_con_eventos(
        _evento_estado_presupuesto(1, "225", "creado", "pendiente", datetime.datetime(2026, 8, 1, tzinfo=Z)))
    posts, patches = [], []
    sincronizar_tenant(lambda: _FakeConn(db), CID, negocio_nombre="Mi Negocio",
                       client=_cliente_mock(_handler_ok(posts, patches)))
    assert patches == []                           # nada previo que invalidar
    assert db["vigencias"][(CID, "presupuesto", "225", "estado")][0] == 1   # quedó marcada


def test_segunda_transicion_en_otra_corrida_invalida_la_vigente_de_la_corrida_anterior():
    db = _db_con_eventos(
        _evento_estado_presupuesto(1, "225", "creado", "pendiente", datetime.datetime(2026, 8, 1, tzinfo=Z)))
    posts1, patches1 = [], []
    sincronizar_tenant(lambda: _FakeConn(db), CID, negocio_nombre="Mi Negocio",
                       client=_cliente_mock(_handler_ok(posts1, patches1)))
    edge_uuid_primera = db["vigencias"][(CID, "presupuesto", "225", "estado")][1]

    db["eventos"].append(
        _evento_estado_presupuesto(2, "225", "estado_cambiado", "aprobado",
                                   datetime.datetime(2026, 8, 2, tzinfo=Z)))
    posts2, patches2 = [], []
    r2 = sincronizar_tenant(lambda: _FakeConn(db), CID, negocio_nombre="Mi Negocio",
                            client=_cliente_mock(_handler_ok(posts2, patches2)))

    assert r2["sincronizados"] == 1                 # sólo el tramo NUEVO, no re-lee el evento 1
    assert patches2 == [edge_uuid_primera]           # invalida la de la corrida anterior, ninguna otra
    assert db["vigencias"][(CID, "presupuesto", "225", "estado")][0] == 2   # la 2ª es la nueva vigente


def test_dos_transiciones_en_la_misma_corrida_encadenan_sin_tocar_la_db_previa():
    """Caso que el `store.vigente()` sembrado UNA vez, antes del loop, se perdería: dos transiciones
    del MISMO (entidad, campo) llegan juntas en un solo batch (el Schedule corrió cada 15 min y hubo
    2 cambios de estado en el medio)."""
    db = _db_con_eventos(
        _evento_estado_presupuesto(1, "225", "creado", "pendiente", datetime.datetime(2026, 8, 1, tzinfo=Z)),
        _evento_estado_presupuesto(2, "225", "estado_cambiado", "aprobado",
                                   datetime.datetime(2026, 8, 2, tzinfo=Z)),
    )
    posts, patches = [], []
    r = sincronizar_tenant(lambda: _FakeConn(db), CID, negocio_nombre="Mi Negocio",
                           client=_cliente_mock(_handler_ok(posts, patches)))
    assert r["sincronizados"] == 2
    assert len(patches) == 1                         # 1 sola invalidación: la de "pendiente"→"aprobado"
    assert db["vigencias"][(CID, "presupuesto", "225", "estado")][0] == 2


def test_estado_vuelve_al_valor_anterior_no_resucita_nada():
    """El caso §2.3 (trampa 4): pendiente→aprobado→pendiente (ej. deshacer). Cada transición es un
    nodo-evento DISTINTO (lleva el `orden`/LOG_EVENT_ID en su clave), así que el 3er evento NO puede
    dar el mismo `edge_uuid` que el 1ro — si lo diera, invalidarlo resucitaría al 1ro."""
    db = _db_con_eventos(
        _evento_estado_presupuesto(1, "225", "creado", "pendiente", datetime.datetime(2026, 8, 1, tzinfo=Z)),
        _evento_estado_presupuesto(2, "225", "estado_cambiado", "aprobado",
                                   datetime.datetime(2026, 8, 2, tzinfo=Z)),
        _evento_estado_presupuesto(3, "225", "estado_cambiado", "pendiente",
                                   datetime.datetime(2026, 8, 3, tzinfo=Z)),
    )
    posts, patches = [], []
    sincronizar_tenant(lambda: _FakeConn(db), CID, negocio_nombre="Mi Negocio",
                       client=_cliente_mock(_handler_ok(posts, patches)))
    assert len(patches) == 2                          # 1→2 invalidado, 2→3 invalidado
    assert len(set(patches)) == 2                      # los dos edge_uuid invalidados son DISTINTOS
    assert db["vigencias"][(CID, "presupuesto", "225", "estado")][0] == 3


def test_dos_tenants_no_se_pisan_el_cursor_ni_la_vigencia():
    db = _db_con_eventos(_evento_gasto(1, "1", datetime.datetime(2026, 8, 1, tzinfo=Z)))
    posts, patches = [], []
    sincronizar_tenant(lambda: _FakeConn(db), "tenant-A", negocio_nombre="A",
                       client=_cliente_mock(_handler_ok(posts, patches)))
    assert db["cursores"]["tenant-A"] == (1,)
    assert "tenant-B" not in db["cursores"]
