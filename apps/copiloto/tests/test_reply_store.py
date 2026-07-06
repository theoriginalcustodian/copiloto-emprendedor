import json
import sys
from pathlib import Path

import reply_store


class _FakeCursor:
    def __init__(self, store): self.store = store; self._rows = []
    def execute(self, sql, params=None):
        s = sql.strip().upper()
        if s.startswith("INSERT"):
            cid, sess, text, choices, card = params
            self.store.append({"id": len(self.store) + 1, "cliente_id": cid, "session_id": sess,
                               "reply_text": text, "choices": json.loads(choices) if choices else None,
                               "card": json.loads(card) if card else None, "created_at": "t"})
        elif s.startswith("SELECT"):
            cid, sess, after = params
            self._rows = [(r["id"], r["reply_text"], r["choices"], r["card"], r["created_at"])
                          for r in self.store
                          if r["cliente_id"] == cid and r["session_id"] == sess and r["id"] > after]
    def fetchall(self): return self._rows
    def __enter__(self): return self
    def __exit__(self, *a): return False


class _FakeConn:
    def __init__(self, store): self.store = store; self.autocommit = True
    def cursor(self): return _FakeCursor(self.store)


def test_sink_is_per_request_writes_and_read_returns_after_cursor():
    """make_pg_reply_sink(conn_factory) SIN cliente_id horneado: el sink devuelto recibe cliente_id por llamada."""
    store = []
    conn = _FakeConn(store)
    cf = lambda: conn
    cid = "00000000-0000-4000-8000-0000000000aa"
    sink = reply_store.make_pg_reply_sink(cf)
    sink(cid, "s1", "primer reply", [{"label": "Confirmar", "value": "confirm"}])
    sink(cid, "s1", "segundo reply", None)
    rows = reply_store.read_replies(cf, cid, "s1", after_id=0)
    assert [r["reply_text"] for r in rows] == ["primer reply", "segundo reply"]
    assert rows[0]["choices"] == [{"label": "Confirmar", "value": "confirm"}]
    rows2 = reply_store.read_replies(cf, cid, "s1", after_id=rows[0]["id"])
    assert [r["reply_text"] for r in rows2] == ["segundo reply"]      # cursor avanza


def test_sink_isolates_cross_tenant_same_session_id():
    """Aislamiento adversarial: el MISMO sink (per-worker, no horneado) usado para 2 tenants con el MISMO
    session_id -> el reply de A no es visible para B y viceversa (regla dura multitenant)."""
    store = []
    conn = _FakeConn(store)
    cf = lambda: conn
    cid_a = "00000000-0000-4000-8000-0000000000aa"
    cid_b = "00000000-0000-4000-8000-0000000000bb"
    sink = reply_store.make_pg_reply_sink(cf)
    sink(cid_a, "s1", "reply de A", None)
    sink(cid_b, "s1", "reply de B", None)                # mismo session_id, tenant distinto
    rows_a = reply_store.read_replies(cf, cid_a, "s1", after_id=0)
    rows_b = reply_store.read_replies(cf, cid_b, "s1", after_id=0)
    assert [r["reply_text"] for r in rows_a] == ["reply de A"]
    assert [r["reply_text"] for r in rows_b] == ["reply de B"]


def test_card_roundtrips_and_defaults_none():
    """El `card` (metadata de presentación del reply HITL) se persiste y vuelve en read_replies; omitirlo -> None."""
    store = []
    conn = _FakeConn(store)
    cf = lambda: conn
    cid = "00000000-0000-4000-8000-0000000000aa"
    sink = reply_store.make_pg_reply_sink(cf)
    sink(cid, "s1", "confirmá el doc", [{"label": "Confirmar", "value": "confirm"}],
         {"service": "googledocs", "label": "Google Docs"})
    sink(cid, "s1", "sin card", None)                        # card omitido -> None
    rows = reply_store.read_replies(cf, cid, "s1", after_id=0)
    assert rows[0]["card"] == {"service": "googledocs", "label": "Google Docs"}
    assert rows[1]["card"] is None
