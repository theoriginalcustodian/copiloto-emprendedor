import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ARCH = APP.parents[1] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH)); sys.path.insert(0, str(APP))
from backend.agent.types import Intent  # noqa: E402
from dispatcher_emprendedor import make_dispatcher  # noqa: E402


class _FakeMpGateway:
    def create_payment_link(self, at, *, amount, external_reference, notification_url, title="Cobro"):
        assert f"cid=cli-A" in notification_url and "seller=146" in notification_url   # ruteo multi-tenant
        return {"id": "pref-1", "init_point": "https://mp/redirect?pref_id=pref-1", "external_reference": external_reference}


class _FakeMpCred:
    def get(self, seller): return {"access_token": "AT"}


def _dispatch():
    return make_dispatcher(gateway=None, composio_user_id="u", now_iso_provider=lambda: "2026-07-02T10:00:00",
                           mp_gateway=_FakeMpGateway(), mp_cred_store=_FakeMpCred(), mp_seller_user_id="146",
                           mp_webhook_base="https://mp.example", cliente_id="cli-A")


def test_mp_charge_proposes_then_confirm_returns_link():
    d = _dispatch()
    # 1) el usuario pide cobrar → propuesta (HITL), NO ejecuta todavía
    r1 = d(Intent(action="mp_charge", entities={"amount": 150, "concept": "Sesión"}, reply_es=""), {}, None)
    assert r1.choices and r1.state_patch["pending"]["provider"] == "mercadopago"
    # 2) confirma → crea el link y lo devuelve
    r2 = d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""),
           {"pending": r1.state_patch["pending"]}, None)
    assert "pref_id=pref-1" in r2.reply_text and r2.done is True


def test_mp_charge_without_connection_asks_to_connect():
    class _NoCred:
        def get(self, seller): return None
    d = make_dispatcher(gateway=None, composio_user_id="u", now_iso_provider=lambda: "x",
                        mp_gateway=_FakeMpGateway(), mp_cred_store=_NoCred(), mp_seller_user_id="146",
                        mp_webhook_base="https://mp.example", cliente_id="cli-A")
    r1 = d(Intent(action="mp_charge", entities={"amount": 150, "concept": "x"}, reply_es=""), {}, None)
    r2 = d(Intent(action="confirm_pending", entities={"value": "confirm"}, reply_es=""),
           {"pending": r1.state_patch["pending"]}, None)
    assert "conect" in r2.reply_text.lower()   # pide conectar MercadoPago primero


def test_mp_charge_without_gateway_is_graceful_not_crash():
    """H1: tenant sin MP configurado (mp_gateway=None) NO debe crashear la activity de dispatch.
    Antes: mp_charge creaba pending sin guard → confirm → mp_cred_store.get(None) → AttributeError → retry infinito."""
    d = make_dispatcher(gateway=None, composio_user_id="u", now_iso_provider=lambda: "x")
    r1 = d(Intent(action="mp_charge", entities={"amount": 150, "concept": "x"}, reply_es=""), {}, None)
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
