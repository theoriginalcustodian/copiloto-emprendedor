"""Tests de MpLinkDedupStore (Task 7, spike C): fake conn, sin Postgres real."""
from mp_dedup_store import MpLinkDedupStore


class _FakeCur:
    def __init__(self, store): self._store = store; self._row = None
    def execute(self, sql, params):
        if sql.strip().upper().startswith("SELECT"):
            self._row = self._store.get((params[0], params[1]))
        elif "ON CONFLICT" in sql:
            cid, key, pref, init, ext = params
            self._store.setdefault((cid, key), (pref, init, ext))
    def fetchone(self): return self._row
    def __enter__(self): return self
    def __exit__(self, *a): return False


class _FakeConn:
    def __init__(self, store): self._store = store; self.autocommit = True
    def cursor(self): return _FakeCur(self._store)


def _factory():
    store = {}
    return (lambda: _FakeConn(store)), store


def test_save_then_get_returns_cached():
    conn_factory, _ = _factory()
    s = MpLinkDedupStore(conn_factory, "42")
    assert s.get("run1-0") is None
    s.save("run1-0", preference_id="P1", init_point="https://mpago.la/x", external_reference="ext1")
    got = s.get("run1-0")
    assert got["preference_id"] == "P1"
    assert got["init_point"] == "https://mpago.la/x"


def test_second_save_same_key_is_noop():
    conn_factory, store = _factory()
    s = MpLinkDedupStore(conn_factory, "42")
    s.save("run1-0", preference_id="P1", init_point="u1", external_reference="e1")
    s.save("run1-0", preference_id="P2", init_point="u2", external_reference="e2")   # ON CONFLICT DO NOTHING
    assert s.get("run1-0")["preference_id"] == "P1"                                   # el primero gana
