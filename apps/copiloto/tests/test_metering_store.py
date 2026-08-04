"""Tests de `MeteringStore` (BETA-1b): fake conn, sin Postgres real -- mismo patrón que
`test_feedback_store.py` (conn/cursor con `__enter__`/`__exit__`, `MeteringStore.registrar` usa
`with conn_factory() as conn, conn.cursor() as cur:`, patrón real de psycopg2)."""
from metering_store import LLM_TURNO, TOOL_CALL_PREFIX, MeteringStore


class _FakeCur:
    def __init__(self, rows): self._rows = rows

    def execute(self, sql, params):
        assert sql.strip().upper().startswith("INSERT INTO")
        cliente_id, session_id, model, tokens, evento = params
        self._rows.append({"cliente_id": cliente_id, "session_id": session_id, "model": model,
                           "tokens": tokens, "evento": evento})

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


def test_registrar_llm_turno_con_tokens():
    conn_factory, rows = _factory()
    MeteringStore(conn_factory, "cid-A").registrar(
        session_id="s1", model="deepseek/deepseek-v4-flash", tokens=1234, evento=LLM_TURNO)
    assert rows == [{"cliente_id": "cid-A", "session_id": "s1", "model": "deepseek/deepseek-v4-flash",
                     "tokens": 1234, "evento": "llm_turno"}]


def test_registrar_tool_call_sin_tokens():
    conn_factory, rows = _factory()
    MeteringStore(conn_factory, "cid-A").registrar(
        session_id="s1", model="tool:mp_charge", tokens=None, evento=f"{TOOL_CALL_PREFIX}:ok")
    assert rows[0]["tokens"] is None
    assert rows[0]["evento"] == "tool_call:ok"


def test_dos_tenants_no_se_pisan():
    conn_factory, rows = _factory()
    MeteringStore(conn_factory, "cid-A").registrar(session_id="s1", model="m", tokens=1, evento=LLM_TURNO)
    MeteringStore(conn_factory, "cid-B").registrar(session_id="s2", model="m", tokens=2, evento=LLM_TURNO)
    assert [r["cliente_id"] for r in rows] == ["cid-A", "cid-B"]
