"""make_tool_executor (Task 6): ejecuta UNA tool -> ToolResult, con gate write/read + artifact + then/resolve.

Los tests de `mp_charge` (dedup + artifact payment_link, Task 8) están al final de este archivo."""
import tool_catalog
from backend.agent.types import ToolResult


class _FakeGateway:
    def __init__(self, exec_result=None):
        self.calls = []
        self._exec_result = exec_result or {"successful": True, "data": {}}

    def execute(self, slug, *, user_id, arguments, confirmed=False):
        self.calls.append((slug, confirmed, dict(arguments)))
        return self._exec_result


class _Ctx:
    composio_user_id = "42"
    mp_gateway = None
    mp_cred_store = None
    mp_seller_user_id = None
    mp_webhook_base = None
    cliente_id = "42"


def test_read_executes_directly():
    ex = tool_catalog.make_tool_executor(_FakeGateway({"data": {"messages": []}}), now_iso_provider=lambda: "2026-07-04T00:00:00")
    tr = ex("gmail_fetch", {"query": "is:unread"}, _Ctx(), confirmed=False, idem_key="run1-0")
    assert tr.is_write is False
    assert tr.status == "ok"


def test_write_without_confirm_opens_gate_without_executing():
    gw = _FakeGateway()
    ex = tool_catalog.make_tool_executor(gw, now_iso_provider=lambda: "2026-07-04T00:00:00")
    tr = ex("gmail_send", {"to": "a@b.com", "body": "hola"}, _Ctx(), confirmed=False, idem_key="run1-1")
    assert tr.status == "needs_confirmation"
    assert tr.is_write is True
    assert gw.calls == []          # NO ejecutó


def test_write_with_confirm_executes_and_returns_artifact():
    gw = _FakeGateway({"successful": True, "data": {}})
    ex = tool_catalog.make_tool_executor(gw, now_iso_provider=lambda: "2026-07-04T00:00:00")
    tr = ex("gmail_send", {"to": "a@b.com", "subject": "s", "body": "hola"}, _Ctx(), confirmed=True, idem_key="run1-1")
    assert gw.calls[0][1] is True   # confirmed=True
    assert tr.is_write is True
    assert tr.status == "ok"
    assert tr.artifact is not None and tr.artifact.kind == "email_draft"


def test_proposal_then_runs_two_executes(monkeypatch):
    """B2: un Proposal con `.then` (instagram create→publish) dispara DOS gateway.execute (paso 1 + paso 2)."""
    from services.base import Proposal
    prop = Proposal(slug="IG_CREATE", arguments={"caption": "x"}, reply_text="publicar?",
                    then={"slug": "IG_PUBLISH", "id_key": "id", "id_arg": "container_id", "arguments": {}})
    monkeypatch.setitem(tool_catalog.TOOL_INDEX, "instagram_publish",
                        ("service", type("M", (), {"build": staticmethod(lambda op, a, now_iso=None: prop)}), "publish"))
    gw = _FakeGateway({"successful": True, "data": {"id": "CONT1"}})
    ex = tool_catalog.make_tool_executor(gw, now_iso_provider=lambda: "t")
    ex("instagram_publish", {"caption": "x"}, _Ctx(), confirmed=True, idem_key="k")
    assert [c[0] for c in gw.calls] == ["IG_CREATE", "IG_PUBLISH"]        # los 2 pasos


def test_proposal_resolve_injects_before_write(monkeypatch):
    """B2: un Proposal con `.resolve` hace un read previo y inyecta el valor en arguments[into] ANTES del write."""
    from services.base import Proposal
    prop = Proposal(slug="SHEETS_APPEND", arguments={"values": [1]}, reply_text="agregar?",
                    resolve={"slug": "SHEETS_GET", "arguments": {}, "path": ["data", "sheet"], "into": "sheet_name"})
    monkeypatch.setitem(tool_catalog.TOOL_INDEX, "sheets_append",
                        ("service", type("M", (), {"build": staticmethod(lambda op, a, now_iso=None: prop)}), "append"))
    gw = _FakeGateway({"successful": True, "data": {"sheet": "Hoja Real"}})
    ex = tool_catalog.make_tool_executor(gw, now_iso_provider=lambda: "t")
    ex("sheets_append", {"values": [1]}, _Ctx(), confirmed=True, idem_key="k")
    write_call = [c for c in gw.calls if c[0] == "SHEETS_APPEND"][0]
    assert write_call[2]["sheet_name"] == "Hoja Real"                    # el resolve inyectó el valor


def test_docs_create_doc_produces_doc_artifact():
    """Fix de review: `_artifact_for` comparaba contra el nombre inexistente 'docs_create' (la tool real es
    'docs_create_doc', ver services/docs.py TOOLS) — sin este fix el link al Google Doc creado no llegaba."""
    gw = _FakeGateway({"successful": True, "data": {"documentId": "DOC123"}})
    ex = tool_catalog.make_tool_executor(gw, now_iso_provider=lambda: "2026-07-04T00:00:00")
    tr = ex("docs_create_doc", {"title": "Notas", "content": "hola"}, _Ctx(), confirmed=True, idem_key="run1-2")
    assert tr.status == "ok"
    assert tr.artifact is not None
    assert tr.artifact.kind == "doc"
    assert tr.artifact.data["url"] == "https://docs.google.com/document/d/DOC123"


# ── mp_charge (Task 8): dedup app-side + artifact payment_link ──────────────────────────────────

class _FakeMpGw:
    def __init__(self): self.calls = 0
    def create_payment_link(self, token, *, amount, external_reference, notification_url, title):
        self.calls += 1
        return {"id": f"pref{self.calls}", "init_point": f"https://mpago.la/{self.calls}",
                "external_reference": external_reference}


class _FakeCred:
    def get(self, seller): return {"access_token": "tok"}


def _mp_ctx(gw):
    c = _Ctx(); c.mp_gateway = gw; c.mp_cred_store = _FakeCred()
    c.mp_seller_user_id = "seller1"; c.mp_webhook_base = "https://x"; c.cliente_id = "42"
    return c


def _dedup_factory():
    store = {}
    class _S:
        def __init__(self, cid): self._cid = cid
        def get(self, k): return store.get((self._cid, k))
        def save(self, k, *, preference_id, init_point, external_reference):
            store.setdefault((self._cid, k), {"preference_id": preference_id, "init_point": init_point,
                                              "external_reference": external_reference})
    return (lambda cid: _S(cid))


def test_mp_charge_confirmed_creates_link_with_artifact():
    gw = _FakeMpGw()
    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "t", mp_dedup_factory=_dedup_factory())
    tr = ex("mp_charge", {"amount": 5000, "concept": "sena"}, _mp_ctx(gw), confirmed=True, idem_key="run1-0")
    assert gw.calls == 1
    assert tr.artifact.kind == "payment_link"
    assert tr.artifact.data["url"] == "https://mpago.la/1"
    assert tr.artifact.data["amount"] == 5000


def test_mp_charge_retry_same_idemkey_dedups():
    gw = _FakeMpGw()
    dedup = _dedup_factory()
    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "t", mp_dedup_factory=dedup)
    ctx = _mp_ctx(gw)
    ex("mp_charge", {"amount": 5000}, ctx, confirmed=True, idem_key="run1-0")
    tr2 = ex("mp_charge", {"amount": 5000}, ctx, confirmed=True, idem_key="run1-0")   # retry at-least-once
    assert gw.calls == 1                                   # NO creo un 2do link
    assert tr2.artifact.data["url"] == "https://mpago.la/1"
