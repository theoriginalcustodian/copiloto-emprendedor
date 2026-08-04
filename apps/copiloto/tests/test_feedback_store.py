"""Tests de `FeedbackStore` (BETA-1a, contrato `BETA1a-feedback-endpoint.md` §2): fake conn, sin
Postgres real -- mismo patrón que `test_mp_dedup.py`, con `__enter__`/`__exit__` en conn y cursor
porque `FeedbackStore.crear` usa `with conn_factory() as conn, conn.cursor() as cur:` (patrón real
de psycopg2), a diferencia de `MpLinkDedupStore` que no lo necesita."""
import pytest

from feedback_store import FeedbackStore, TEXTO, VOZ


class _FakeCur:
    def __init__(self, rows):
        self._rows = rows
        self._next_id = len(rows) + 1

    def execute(self, sql, params):
        assert sql.strip().upper().startswith("INSERT INTO")
        cliente_id, tipo, texto, contexto = params
        self._rows.append({"id": self._next_id, "cliente_id": cliente_id, "tipo": tipo,
                           "texto": texto, "contexto": contexto})

    def fetchone(self):
        return (self._rows[-1]["id"],)

    def __enter__(self): return self
    def __exit__(self, *a): return False


class _FakeConn:
    def __init__(self, rows): self._rows = rows
    def cursor(self): return _FakeCur(self._rows)
    def __enter__(self): return self
    def __exit__(self, *a): return False


def _factory():
    rows: list[dict] = []
    return (lambda: _FakeConn(rows)), rows


def test_crear_texto_guarda_y_devuelve_id():
    conn_factory, rows = _factory()
    store = FeedbackStore(conn_factory, "cid-A")
    feedback_id = store.crear(tipo=TEXTO, texto="me encantaría poder exportar a PDF", contexto="mi-cuenta")
    assert feedback_id == 1
    assert rows[0] == {"id": 1, "cliente_id": "cid-A", "tipo": "texto",
                       "texto": "me encantaría poder exportar a PDF", "contexto": "mi-cuenta"}


def test_crear_voz_sin_contexto():
    conn_factory, rows = _factory()
    store = FeedbackStore(conn_factory, "cid-A")
    store.crear(tipo=VOZ, texto="quiero poder marcar favoritos", contexto=None)
    assert rows[0]["tipo"] == "voz"
    assert rows[0]["contexto"] is None


def test_crear_tipo_invalido_revienta():
    conn_factory, _ = _factory()
    store = FeedbackStore(conn_factory, "cid-A")
    with pytest.raises(AssertionError):
        store.crear(tipo="carta-al-fundador", texto="x", contexto=None)


def test_dos_tenants_no_se_pisan():
    conn_factory, rows = _factory()
    FeedbackStore(conn_factory, "cid-A").crear(tipo=TEXTO, texto="feedback de A", contexto=None)
    FeedbackStore(conn_factory, "cid-B").crear(tipo=TEXTO, texto="feedback de B", contexto=None)
    assert [r["cliente_id"] for r in rows] == ["cid-A", "cid-B"]
