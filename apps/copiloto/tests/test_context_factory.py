import os
import sys
import uuid
from pathlib import Path
import pytest

from clients.agent.providers.crypto import FernetCrypto  # noqa: E402
from context_factory import make_context_factory  # noqa: E402
from mp_credential_store import MpCredentialStore  # noqa: E402

pytestmark = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                reason="requiere Postgres del VPS (DATABASE_URL)")


def _conn_factory():
    import psycopg2

    def f():
        c = psycopg2.connect(os.environ["DATABASE_URL"]); c.autocommit = True; return c
    return f


@pytest.fixture
def crypto(monkeypatch):
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())
    return FernetCrypto()


class _FakeMpGateway:
    """Stateless (sin datos por-tenant) → el factory lo inyecta compartido, igual en todo ctx."""


def test_context_factory_arma_ctx_atado_al_cliente_id_del_conv(crypto):
    cid = str(uuid.uuid4())
    factory = make_context_factory(conn_factory=_conn_factory(), crypto=crypto,
                                   mp_gateway=_FakeMpGateway(), mp_webhook_base="https://mp.example")
    ctx = factory({"cliente_id": cid})
    assert ctx.cliente_id == cid
    assert ctx.composio_user_id == cid                  # composio_user_id = cliente_id (design §2.3)
    assert ctx.mp_cred_store._cid == cid                # el store queda ATADO a este tenant
    assert isinstance(ctx.mp_gateway, _FakeMpGateway)
    assert ctx.mp_webhook_base == "https://mp.example"
    assert ctx.mp_seller_user_id is None                # el tenant todavía no conectó MercadoPago


def test_context_factory_resuelve_seller_del_tenant_sin_env_manual(crypto):
    """mp_seller_user_id sale del mp_credentials DE ESE tenant — elimina el MP_SELLER_USER_ID manual."""
    cid = str(uuid.uuid4())
    MpCredentialStore(_conn_factory(), cid, crypto).save(
        "seller-777", access_token="AT", refresh_token="RT", expires_at=1)
    factory = make_context_factory(conn_factory=_conn_factory(), crypto=crypto)
    ctx = factory({"cliente_id": cid})
    assert ctx.mp_seller_user_id == "seller-777"


def test_context_factory_dos_tenants_no_se_pisan(crypto):
    """Cero fuga entre tenants: dos conv distintos arman ctx distintos, cada uno atado a SU cliente_id."""
    cid_a, cid_b = str(uuid.uuid4()), str(uuid.uuid4())
    MpCredentialStore(_conn_factory(), cid_a, crypto).save(
        "seller-A", access_token="AT-A", refresh_token="RT-A", expires_at=1)
    factory = make_context_factory(conn_factory=_conn_factory(), crypto=crypto)
    ctx_a = factory({"cliente_id": cid_a})
    ctx_b = factory({"cliente_id": cid_b})
    assert ctx_a.mp_seller_user_id == "seller-A"
    assert ctx_b.mp_seller_user_id is None              # B NO ve el seller de A
    assert ctx_a.mp_cred_store._cid != ctx_b.mp_cred_store._cid


def test_first_seller_user_id_toma_el_mas_reciente(crypto):
    """Si el tenant reconecta con OTRO seller, first_seller_user_id() resuelve el más reciente (updated_at)."""
    cid = str(uuid.uuid4())
    store = MpCredentialStore(_conn_factory(), cid, crypto)
    store.save("seller-old", access_token="AT1", refresh_token="RT1", expires_at=1)
    store.save("seller-new", access_token="AT2", refresh_token="RT2", expires_at=2)
    assert store.first_seller_user_id() == "seller-new"
