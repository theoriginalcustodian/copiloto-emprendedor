"""make_tool_executor (Task 6): ejecuta UNA tool -> ToolResult, con gate write/read + artifact + then/resolve.

Los tests de `mp_charge` (dedup + artifact payment_link, Task 8) están al final de este archivo."""
import os
import uuid

import pytest

import tool_catalog
from backend.agent.types import ToolResult

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")


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
    # El ejemplo era `gmail_fetch`, podada en el hito 2. Lo que se prueba NO es esa tool: es que una
    # READ se ejecute sin pedir confirmación. `docs_read_doc` es la read que quedó, y sirve igual.
    tr = ex("docs_read_doc", {"document_id": "doc-1"}, _Ctx(), confirmed=False, idem_key="run1-0")
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


def test_mp_charge_gateway_error_returns_error_not_exception():
    """Un fallo del cobro MP (MercadoPagoError) se traduce a status='error' como OBSERVACIÓN, nunca se propaga
    como excepción (contrato del executor 'nunca excepción → retry ∞', regla dura PR #114)."""
    from clients.agent.providers.mercadopago_gateway import MercadoPagoError

    class _BoomMpGw:
        def create_payment_link(self, *a, **k):
            raise MercadoPagoError("POST /checkout/preferences → HTTP 500")

    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "t", mp_dedup_factory=_dedup_factory())
    tr = ex("mp_charge", {"amount": 5000}, _mp_ctx(_BoomMpGw()), confirmed=True, idem_key="run1-0")
    assert tr.status == "error"                            # no excepción propagada
    assert "cobro" in tr.observation["error"].lower() or "no pude" in tr.observation["error"].lower()


def test_mp_charge_missing_init_point_errors_before_dedup_save():
    """FIX MEDIUM (money path, review final): si `create_payment_link` devuelve un dict SIN `init_point`
    (200/201 "raro" de la gateway), el guard corta ANTES de `dedup.save` -- guardar None violaría el NOT NULL
    de la tabla (IntegrityError -> el retry at-least-once de Temporal reintentaría el POST completo, creando
    un 2do link real para el mismo turno). status='error', nunca excepción, y dedup.save NUNCA se invoca."""
    class _NoInitPointMpGw:
        def create_payment_link(self, *a, **k):
            return {"id": "prefX"}   # sin init_point

    save_calls = []

    def _spy_dedup_factory():
        class _S:
            def __init__(self, cid): pass
            def get(self, k): return None
            def save(self, k, **kw): save_calls.append((k, kw))
        return lambda cid: _S(cid)

    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "t",
                                         mp_dedup_factory=_spy_dedup_factory())
    tr = ex("mp_charge", {"amount": 5000}, _mp_ctx(_NoInitPointMpGw()), confirmed=True, idem_key="run1-0")
    assert tr.status == "error"
    assert not save_calls                                   # dedup.save NUNCA se llamó (guard cortó antes)


def test_mp_charge_needs_confirmation_observation_has_service():
    """FIX HIGH (card del gate, review final): la observation de `needs_confirmation` debe traer
    `service`/`label` (mercadopago/Mercado Pago) -- el workflow arma la card del gate a partir de esto; sin
    el fix el frontend no puede mostrar el badge de riesgo "REVISAR" ni el ícono correcto."""
    gw = _FakeMpGw()
    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "t", mp_dedup_factory=_dedup_factory())
    tr = ex("mp_charge", {"amount": 5000}, _mp_ctx(gw), confirmed=False, idem_key="run1-0")
    assert tr.status == "needs_confirmation"
    assert tr.observation["service"] == "mercadopago"
    assert tr.observation["label"] == "Mercado Pago"


def test_calendar_book_needs_confirmation_observation_has_service():
    """Mismo fix aplicado a calendar_book (2da tool de 1ra clase): `service='googlecalendar'`."""
    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "2026-07-04T00:00:00")
    tr = ex("calendar_book", {"title": "Reunión", "date_raw": "mañana", "time_raw": "15"},
           _Ctx(), confirmed=False, idem_key="run1-1")
    assert tr.status == "needs_confirmation"
    assert tr.observation["service"] == "googlecalendar"


def test_service_proposal_needs_confirmation_observation_has_service():
    """Mismo fix aplicado al path de servicio plug-in (Proposal): `service` = `mod.TOOLKIT` real."""
    tr = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "2026-07-04T00:00:00")(
        "gmail_send", {"to": "a@b.com", "body": "hola"}, _Ctx(), confirmed=False, idem_key="run1-2")
    assert tr.status == "needs_confirmation"
    assert tr.observation["service"] == "gmail"


def test_unexpected_exception_in_executor_returns_error_not_propagates():
    """FIX LOW (contrato 'nunca excepción -> observación', regla dura PR #114): cualquier excepción NO
    prevista (no ConnectionRequired/ComposioExecutionError/MercadoPagoError, ej un KeyError de un shape
    inesperado) debe degradar a status='error', NUNCA propagar -- de lo contrario dispararía los 5 retries
    de LOOP_RETRY contra la MISMA excepción determinística y, sin try/except en el workflow, tumbaría la
    sesión entera."""
    class _BoomGateway:
        def execute(self, *a, **k):
            raise KeyError("shape inesperado de Composio")

    ex = tool_catalog.make_tool_executor(_BoomGateway(), now_iso_provider=lambda: "2026-07-04T00:00:00")
    tr = ex("gmail_send", {"to": "a@b.com", "subject": "s", "body": "hola"}, _Ctx(), confirmed=True, idem_key="run1-3")
    assert tr.status == "error"


@necesita_pg
def test_unexpected_exception_deposita_en_copiloto_traumas(conn_de_tenant):
    """D-A / C2 (lote higiene, 2026-08-12): control POSITIVO contra Postgres real, no un mock -- un
    mock probaría que se llama a `depositar_trauma`, que no es lo que está en duda. Se provoca el
    MISMO fallo no-previsto que `test_unexpected_exception_in_executor_returns_error_not_propagates`
    y se verifica que el trauma aparece efectivamente en `copiloto_traumas`. Sin ver la fila, el
    catch-all sigue siendo el punto ciego que la auditoría encontró."""
    from deposito_traumas import fabrica_desde
    from trauma_store import TraumaStore

    class _BoomGateway:
        def execute(self, *a, **k):
            raise KeyError("shape inesperado de Composio")

    class _CtxTenant:
        composio_user_id = "42"
        mp_gateway = None
        mp_cred_store = None
        mp_seller_user_id = None
        mp_webhook_base = None

    cid = str(uuid.uuid4())
    conn_factory = conn_de_tenant(cid)
    ctx = _CtxTenant()
    ctx.cliente_id = cid
    ex = tool_catalog.make_tool_executor(
        _BoomGateway(), now_iso_provider=lambda: "2026-07-04T00:00:00",
        trauma_store_factory=fabrica_desde(conn_factory))

    tr = ex("gmail_send", {"to": "a@b.com", "subject": "s", "body": "hola"}, ctx,
           confirmed=True, idem_key="run-dlq-1")
    assert tr.status == "error"

    traumas = TraumaStore(conn_factory, cid).listar()
    assert len(traumas) == 1
    assert traumas[0]["workflow"] == "tool_executor"
    assert traumas[0]["error_type"] == "KeyError"

    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM uc_factory.copiloto_traumas WHERE cliente_id = %s", (cid,))
    conn.close()


def test_ctx_none_still_raises_outside_the_catch_all():
    """El catch-all del FIX LOW NO debe absorber el error de PROGRAMACIÓN `ctx is None` (context_factory mal
    cableado) -- ese debe seguir fallando FUERTE (ValueError), no degradar silencioso a una ToolResult."""
    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "t")
    with pytest.raises(ValueError):
        ex("gmail_send", {"to": "a@b.com"}, None, confirmed=False, idem_key="run1-4")


# ═══════════ consultar_actividad (recall temporal por rango, 1ra clase READ → sin gate) ═══════════
class _Mem:
    def __init__(self, episodes):
        self._eps = episodes

    def recall_range(self, cliente_id, since, until):
        return self._eps


class _CtxMem(_Ctx):
    def __init__(self, episodes):
        self.memory_provider = _Mem(episodes)


def test_consultar_actividad_es_read_sin_gate(monkeypatch):
    """consultar_actividad es READ puro: resuelve el rango + recall_range + summarize_activity → observación,
    is_write=False, SIN abrir gate HITL (aunque confirmed=False)."""
    monkeypatch.setattr(tool_catalog, "summarize_activity",
                        lambda episodes, **k: "Hoy agendaste 1 reunión y cobraste $5000.")
    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "2026-07-05T12:00:00", llm=object())
    tr = ex("consultar_actividad", {"range_raw": "hoy"}, _CtxMem([{"content": "x"}]), confirmed=False, idem_key="run1-0")
    assert tr.is_write is False
    assert tr.status == "ok"
    assert "agendaste" in tr.observation["result"]


def test_consultar_actividad_no_esta_en_write_tools():
    """Contrato: NO va en WRITE_TOOLS (read → sin gate) y rutea al destino 'activity'."""
    assert "consultar_actividad" not in tool_catalog.WRITE_TOOLS
    assert tool_catalog.TOOL_INDEX["consultar_actividad"] == ("activity",)


def test_consultar_actividad_sin_episodios_no_llama_al_llm(monkeypatch):
    called = []
    monkeypatch.setattr(tool_catalog, "summarize_activity", lambda *a, **k: called.append(1) or "x")
    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "2026-07-05T12:00:00", llm=object())
    tr = ex("consultar_actividad", {"range_raw": "hoy"}, _CtxMem([]), confirmed=False, idem_key="k")
    assert tr.status == "ok" and tr.is_write is False
    assert "No encontré actividad" in tr.observation["result"]
    assert called == []          # sin episodios NO invoca al LLM (ahorro)


def test_consultar_actividad_rango_invalido_es_error(monkeypatch):
    monkeypatch.setattr(tool_catalog, "resolve_date_range", lambda *a, **k: None)
    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "t", llm=object())
    tr = ex("consultar_actividad", {"range_raw": "??"}, _CtxMem([{"content": "x"}]), confirmed=False, idem_key="k")
    assert tr.status == "error" and "período" in tr.observation["error"]


def test_consultar_actividad_sin_llm_degrada_sin_crashear():
    ex = tool_catalog.make_tool_executor(_FakeGateway(), now_iso_provider=lambda: "t", llm=None)
    tr = ex("consultar_actividad", {"range_raw": "hoy"}, _CtxMem([{"content": "x"}]), confirmed=False, idem_key="k")
    assert tr.status == "error" and tr.is_write is False
