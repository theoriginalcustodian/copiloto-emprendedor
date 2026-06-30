import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import reply_store


class _FakeCursor:
    def __init__(self, store): self.store = store; self._rows = []
    def execute(self, sql, params=None):
        s = sql.strip().upper()
        if s.startswith("INSERT"):
            cid, sess, text, choices = params
            self.store.append({"id": len(self.store) + 1, "cliente_id": cid, "session_id": sess,
                               "reply_text": text, "choices": json.loads(choices) if choices else None,
                               "created_at": "t"})
        elif s.startswith("SELECT"):
            cid, sess, after = params
            self._rows = [(r["id"], r["reply_text"], r["choices"], r["created_at"])
                          for r in self.store
                          if r["cliente_id"] == cid and r["session_id"] == sess and r["id"] > after]
    def fetchall(self): return self._rows
    def __enter__(self): return self
    def __exit__(self, *a): return False


class _FakeConn:
    def __init__(self, store): self.store = store; self.autocommit = True
    def cursor(self): return _FakeCursor(self.store)


def test_sink_writes_and_read_returns_after_cursor():
    store = []
    conn = _FakeConn(store)
    cf = lambda: conn
    cid = "00000000-0000-4000-8000-0000000000aa"
    sink = reply_store.make_pg_reply_sink(cf, cid)
    sink("s1", "primer reply", [{"label": "Confirmar", "value": "confirm"}])
    sink("s1", "segundo reply", None)
    rows = reply_store.read_replies(cf, cid, "s1", after_id=0)
    assert [r["reply_text"] for r in rows] == ["primer reply", "segundo reply"]
    assert rows[0]["choices"] == [{"label": "Confirmar", "value": "confirm"}]
    rows2 = reply_store.read_replies(cf, cid, "s1", after_id=rows[0]["id"])
    assert [r["reply_text"] for r in rows2] == ["segundo reply"]      # cursor avanza
