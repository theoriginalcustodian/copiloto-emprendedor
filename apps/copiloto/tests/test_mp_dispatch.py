import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ARCH = APP.parents[1] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH)); sys.path.insert(0, str(APP))
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
         composio_user_id="u", cliente_id="cli-A"):
    """TenantCtx real (no un doble) — así el test ejercita el mismo contrato que arma context_factory.py."""
    return TenantCtx(cliente_id=cliente_id, composio_user_id=composio_user_id, mp_gateway=mp_gateway,
                     mp_cred_store=mp_cred_store, mp_seller_user_id=mp_seller_user_id,
                     mp_webhook_base="https://mp.example")


def _dispatch():
    return make_dispatcher(gateway=None, now_iso_provider=lambda: "2026-07-02T10:00:00")


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
