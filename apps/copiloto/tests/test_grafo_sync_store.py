"""Tests de GrafoSyncStore (BETA-G0): fake conn, sin Postgres real — mismo patrón que test_mp_dedup.py."""
from grafo_sync_store import GrafoSyncStore


class _FakeCur:
    def __init__(self, cursores, vigencias):
        self._cursores = cursores
        self._vigencias = vigencias
        self._row = None

    def execute(self, sql, params):
        s = sql.strip().upper()
        if s.startswith("SELECT ULTIMO_EVENTO_ID"):
            self._row = self._cursores.get(params[0])
        elif s.startswith("INSERT") and "COPILOTO_GRAFO_CURSOR" in s.upper():
            cid, valor = params
            self._cursores[cid] = (valor,)
        elif s.startswith("SELECT ULTIMO_EDGE_UUID"):
            cid, tipo, eid, campo = params
            fila = self._vigencias.get((cid, tipo, eid, campo))
            self._row = (fila[1],) if fila else None   # la query real sólo trae 1 columna
        elif s.startswith("INSERT") and "COPILOTO_GRAFO_VIGENCIA" in s.upper():
            cid, tipo, eid, campo, orden, edge_uuid = params
            self._vigencias[(cid, tipo, eid, campo)] = (orden, edge_uuid)
        else:
            raise AssertionError(f"query no reconocida por el fake: {sql!r}")

    def fetchone(self):
        return self._row

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class _FakeConn:
    def __init__(self, cursores, vigencias):
        self._cursores = cursores
        self._vigencias = vigencias
        self.autocommit = True

    def cursor(self):
        return _FakeCur(self._cursores, self._vigencias)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _factory():
    cursores, vigencias = {}, {}
    return (lambda: _FakeConn(cursores, vigencias)), cursores, vigencias


def test_cursor_sin_correr_nunca_es_cero():
    conn_factory, _, _ = _factory()
    store = GrafoSyncStore(conn_factory, "t1")
    assert store.cursor() == 0


def test_avanzar_cursor_y_releer():
    conn_factory, _, _ = _factory()
    store = GrafoSyncStore(conn_factory, "t1")
    store.avanzar_cursor(42)
    assert store.cursor() == 42


def test_avanzar_cursor_dos_veces_pisa_no_acumula():
    conn_factory, _, _ = _factory()
    store = GrafoSyncStore(conn_factory, "t1")
    store.avanzar_cursor(10)
    store.avanzar_cursor(25)
    assert store.cursor() == 25


def test_cursor_es_por_tenant():
    conn_factory, _, _ = _factory()
    store_a = GrafoSyncStore(conn_factory, "a")
    store_b = GrafoSyncStore(conn_factory, "b")
    store_a.avanzar_cursor(100)
    assert store_a.cursor() == 100
    assert store_b.cursor() == 0


def test_vigente_sin_marcar_nunca_es_none():
    conn_factory, _, _ = _factory()
    store = GrafoSyncStore(conn_factory, "t1")
    assert store.vigente("presupuesto", "225", "estado") is None


def test_marcar_vigente_y_releer():
    conn_factory, _, _ = _factory()
    store = GrafoSyncStore(conn_factory, "t1")
    store.marcar_vigente("presupuesto", "225", "estado", orden=7, edge_uuid="uuid-7")
    assert store.vigente("presupuesto", "225", "estado") == "uuid-7"


def test_marcar_vigente_dos_veces_pisa_la_anterior():
    conn_factory, _, _ = _factory()
    store = GrafoSyncStore(conn_factory, "t1")
    store.marcar_vigente("presupuesto", "225", "estado", orden=7, edge_uuid="uuid-7")
    store.marcar_vigente("presupuesto", "225", "estado", orden=9, edge_uuid="uuid-9")
    assert store.vigente("presupuesto", "225", "estado") == "uuid-9"


def test_vigencia_distingue_por_clave_completa():
    conn_factory, _, _ = _factory()
    store = GrafoSyncStore(conn_factory, "t1")
    store.marcar_vigente("presupuesto", "225", "estado", orden=7, edge_uuid="uuid-A")
    assert store.vigente("presupuesto", "225", "precio") is None       # mismo entidad_id, otro campo
    assert store.vigente("comprobante", "225", "estado") is None       # mismo entidad_id, otro tipo
    assert store.vigente("presupuesto", "999", "estado") is None       # otro entidad_id
