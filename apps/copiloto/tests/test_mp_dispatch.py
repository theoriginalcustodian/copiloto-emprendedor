import sys
from pathlib import Path

from backend.agent.types import Intent  # noqa: E402
from context_factory import TenantCtx  # noqa: E402
from dispatcher_emprendedor import make_dispatcher  # noqa: E402


class _FakeMpGateway:
    def create_payment_link(self, at, *, amount, external_reference, notification_url, title="Cobro"):
        assert "cid=cli-A" in notification_url and "seller=146" in notification_url   # ruteo multi-tenant
        return {"id": "pref-1", "init_point": "https://mp/redirect?pref_id=pref-1", "external_reference": external_reference}


class _FakeMpCred:
    def get(self, seller): return {"access_token": "AT"}


def _ctx(*, mp_gateway=None, mp_cred_store=None, mp_seller_user_id="146",
         composio_user_id="u", cliente_id="cli-A", idem_key=None):
    """TenantCtx real (no un doble) — así el test ejercita el mismo contrato que arma context_factory.py."""
    return TenantCtx(cliente_id=cliente_id, composio_user_id=composio_user_id, mp_gateway=mp_gateway,
                     mp_cred_store=mp_cred_store, mp_seller_user_id=mp_seller_user_id,
                     mp_webhook_base="https://mp.example", idem_key=idem_key)


def _dispatch(*, mp_dedup_factory=None):
    return make_dispatcher(gateway=None, now_iso_provider=lambda: "2026-07-02T10:00:00",
                           mp_dedup_factory=mp_dedup_factory)


def _dedup_factory():
    """Mismo idioma que `tests/test_execute_tool.py::_dedup_factory` (la gemela protegida) — un dict en
    memoria keyed por (cliente_id, idem_key), SELECT-then-INSERT."""
    store = {}
    class _S:
        def __init__(self, cid): self._cid = cid
        def get(self, k): return store.get((self._cid, k))
        def save(self, k, *, preference_id, init_point, external_reference):
            store.setdefault((self._cid, k), {"preference_id": preference_id, "init_point": init_point,
                                              "external_reference": external_reference})
    return (lambda cid: _S(cid))


def test_mp_charge_proposes_then_confirm_returns_link():
    d = _dispatch()
    ctx = _ctx(mp_gateway=_FakeMpGateway(), mp_cred_store=_FakeMpCred())
    # 1) el usuario pide cobrar → propuesta (HITL), NO ejecuta todavía
    r1 = d(Intent(action="mp_charge", entities={"amount": 150, "concept": "Sesión"}, reply_es=""), {}, ctx)
    assert r1.choices and r1.state_patch["pending"]["provider"] == "mercadopago"
    assert r1.card == {"service": "mercadopago", "label": "Mercado Pago"}   # cartel con la app real, no "AGENDA"
    # 2) confirma → crea el link y lo devuelve (mp_gateway/mp_cred_store/seller/webhook_base salen de ctx)
    r2 = d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""),
           {"pending": r1.state_patch["pending"]}, ctx)
    assert "pref_id=pref-1" in r2.reply_text and r2.done is True


def test_mp_charge_without_connection_asks_to_connect():
    class _NoCred:
        def get(self, seller): return None
    ctx = _ctx(mp_gateway=_FakeMpGateway(), mp_cred_store=_NoCred())
    d = _dispatch()
    r1 = d(Intent(action="mp_charge", entities={"amount": 150, "concept": "x"}, reply_es=""), {}, ctx)
    r2 = d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""),
           {"pending": r1.state_patch["pending"]}, ctx)
    assert "conect" in r2.reply_text.lower()   # pide conectar MercadoPago primero


def test_mp_charge_without_gateway_is_graceful_not_crash():
    """H1: tenant sin MP configurado (ctx.mp_gateway=None) NO debe crashear la activity de dispatch.
    Antes: mp_charge creaba pending sin guard → confirm → mp_cred_store.get(None) → AttributeError → retry infinito."""
    ctx = _ctx(mp_gateway=None, mp_cred_store=None)
    d = _dispatch()
    r1 = d(Intent(action="mp_charge", entities={"amount": 150, "concept": "x"}, reply_es=""), {}, ctx)
    assert "disponible" in r1.reply_text.lower()
    assert not (r1.state_patch or {}).get("pending")


def test_mp_charge_survives_intent_from_dict():
    """Gate del PATH REAL: agent_activities usa Intent.from_dict, que filtra action contra ACTIONS. Si
    mp_charge no está registrado, from_dict lo degrada a 'clarify' → el feature NO dispara en producción, aunque
    los tests que construyen Intent(...) directo pasen. Este test ejercita el filtro real (regresión encontrada
    en el review de Task 8)."""
    intent = Intent.from_dict({"action": "mp_charge", "entities": {"amount": 150, "concept": "Sesión"}})
    assert intent.action == "mp_charge"            # NO se degradó a 'clarify'
    assert intent.entities.get("amount") == 150


def test_dispatcher_lee_recursos_de_ctx_no_del_closure_horneado():
    """MULTITENANT REAL (Task 4): make_dispatcher ya NO hornea composio_user_id/cliente_id/mp_* — el MISMO
    dispatcher (mismo closure, un solo gateway compartido) atiende dos tenants distintos y cada ejecución
    usa el composio_user_id/cliente_id de SU ctx (per-request), nunca uno fijo del composition root."""
    calls = []

    class _GwSpy:
        def execute(self, slug, *, user_id, arguments, confirmed):
            calls.append(user_id)
            return {"successful": True, "data": {"id": "evt_123"}}

    d = make_dispatcher(gateway=_GwSpy(), now_iso_provider=lambda: "2026-07-01T10:00:00-03:00")
    ctx_a = _ctx(composio_user_id="tenant-A", cliente_id="tenant-A")
    ctx_b = _ctx(composio_user_id="tenant-B", cliente_id="tenant-B")

    r_a = d(Intent(action="book", entities={"title": "R", "date_raw": "jueves", "time_raw": "15"}), {}, ctx_a)
    d(Intent(action="callback", entities={"value": "confirm"}), {"pending": r_a.state_patch["pending"]}, ctx_a)
    r_b = d(Intent(action="book", entities={"title": "R", "date_raw": "jueves", "time_raw": "15"}), {}, ctx_b)
    d(Intent(action="callback", entities={"value": "confirm"}), {"pending": r_b.state_patch["pending"]}, ctx_b)

    assert calls == ["tenant-A", "tenant-B"]       # cada ejecución usó el composio_user_id de SU tenant


# ═══════════════════ C1 (doble cobro) — dedup app-side alineado a la gemela protegida ═══════════════════
# `tool_catalog._run_mp_charge` ya estaba protegida (Spike C, mp_dedup_store); esta ruta (`dispatch`,
# fallback si `engine_mode` volviera de 'react' a 'dispatch') no lo estaba — H-2 de la pasada 2 de auditoría.

class _CountingMpGateway:
    def __init__(self):
        self.calls = 0

    def create_payment_link(self, at, *, amount, external_reference, notification_url, title="Cobro"):
        self.calls += 1
        return {"id": f"pref-{self.calls}", "init_point": f"https://mp/redirect?pref_id=pref-{self.calls}",
                "external_reference": external_reference}


def test_mp_charge_retry_mismo_idem_key_no_crea_un_segundo_link():
    """EL TEST QUE IMPORTA (control negativo): sin el fix, cada confirm llama a create_payment_link de
    nuevo -- un retry at-least-once de Temporal con el mismo idem_key (mismo activity_id, ver
    `_idem_key_de_la_activity`) generaría un 2do link real con `ext_ref` distinto. Con el fix, el 2do
    intento cachea y el gateway se llama UNA sola vez."""
    gw = _CountingMpGateway()
    d = _dispatch(mp_dedup_factory=_dedup_factory())
    ctx = _ctx(mp_gateway=gw, mp_cred_store=_FakeMpCred(), idem_key="wf-1:run-1:5")
    pending = {"provider": "mercadopago", "amount": 150, "concept": "Sesión"}

    r1 = d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""),
          {"pending": pending}, ctx)
    r2 = d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""),
          {"pending": pending}, ctx)                 # el reintento: mismo idem_key

    assert gw.calls == 1, "el reintento creó un segundo link real"
    assert r1.reply_text == r2.reply_text
    assert "pref-1" in r2.reply_text


def test_mp_charge_idem_keys_distintos_crean_links_distintos():
    """Control diferencial: si la dedup colapsara cobros de turnos LEGÍTIMOS distintos, el emprendedor
    no podría cobrar dos veces al mismo cliente en la misma sesión."""
    gw = _CountingMpGateway()
    dedup = _dedup_factory()
    d = _dispatch(mp_dedup_factory=dedup)
    pending = {"provider": "mercadopago", "amount": 150, "concept": "Sesión"}

    ctx_1 = _ctx(mp_gateway=gw, mp_cred_store=_FakeMpCred(), idem_key="wf-1:run-1:5")
    ctx_2 = _ctx(mp_gateway=gw, mp_cred_store=_FakeMpCred(), idem_key="wf-1:run-1:9")
    d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""), {"pending": pending}, ctx_1)
    d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""), {"pending": pending}, ctx_2)

    assert gw.calls == 2


def test_mp_charge_sin_mp_dedup_factory_funciona_como_antes():
    """Backward-compat: `mp_dedup_factory=None` (default) -- ningún caller viejo que no lo pase se rompe;
    el dedup queda desactivado, mismo comportamiento que antes del fix."""
    gw = _CountingMpGateway()
    d = _dispatch()   # sin mp_dedup_factory
    ctx = _ctx(mp_gateway=gw, mp_cred_store=_FakeMpCred(), idem_key="wf-1:run-1:5")
    pending = {"provider": "mercadopago", "amount": 150, "concept": "Sesión"}

    d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""), {"pending": pending}, ctx)
    d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""), {"pending": pending}, ctx)

    assert gw.calls == 2   # sin factory, no hay con qué deduplicar -- conducta previa al fix


def test_mp_charge_missing_init_point_no_llama_dedup_save():
    """Mismo candado que la gemela: un 200/201 sin `init_point` no puede llegar a `dedup.save` (columna
    NOT NULL -> IntegrityError -> Temporal reintentaría el POST completo con un ext_ref nuevo)."""
    class _NoInitPointGw:
        def create_payment_link(self, *a, **k):
            return {"id": "prefX"}   # sin init_point

    save_calls = []

    def _spy_dedup_factory():
        class _S:
            def __init__(self, cid): pass
            def get(self, k): return None
            def save(self, k, **kw): save_calls.append((k, kw))
        return lambda cid: _S(cid)

    d = _dispatch(mp_dedup_factory=_spy_dedup_factory())
    ctx = _ctx(mp_gateway=_NoInitPointGw(), mp_cred_store=_FakeMpCred(), idem_key="wf-1:run-1:5")
    pending = {"provider": "mercadopago", "amount": 150, "concept": "Sesión"}

    r = d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""), {"pending": pending}, ctx)

    assert "no devolvió un link válido" in r.reply_text
    assert not save_calls
