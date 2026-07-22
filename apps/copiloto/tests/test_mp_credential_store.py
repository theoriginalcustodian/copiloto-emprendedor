import os
import sys
import uuid
from pathlib import Path
import pytest

from clients.agent.providers.crypto import FernetCrypto  # noqa: E402
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


def test_save_get_roundtrip(crypto):
    cid = str(uuid.uuid4())
    store = MpCredentialStore(_conn_factory(), cid, crypto)
    store.save("seller-1", access_token="AT-1", refresh_token="RT-1", expires_at=999, public_key="PK-1")
    got = store.get("seller-1")
    assert got["access_token"] == "AT-1" and got["refresh_token"] == "RT-1" and got["expires_at"] == 999


def test_update_rotates_pair(crypto):
    cid = str(uuid.uuid4())
    store = MpCredentialStore(_conn_factory(), cid, crypto)
    store.save("seller-1", access_token="AT-1", refresh_token="RT-1", expires_at=1)
    store.update_tokens("seller-1", access_token="AT-2", refresh_token="RT-2", expires_at=2)
    got = store.get("seller-1")
    assert got["access_token"] == "AT-2" and got["refresh_token"] == "RT-2" and got["expires_at"] == 2


def test_tokens_are_encrypted_at_rest(crypto):
    cid = str(uuid.uuid4())
    store = MpCredentialStore(_conn_factory(), cid, crypto)
    store.save("seller-1", access_token="PLAINSECRET", refresh_token="RT", expires_at=1)
    conn = _conn_factory()()
    with conn.cursor() as cur:
        cur.execute("SELECT access_token_enc FROM uc_factory.mp_credentials WHERE cliente_id=%s", (cid,))
        raw = cur.fetchone()[0]
    assert "PLAINSECRET" not in raw            # en la DB está cifrado, no en claro


def test_adversarial_cross_tenant_isolation(crypto):
    """A guarda; B (otro cliente_id) NO puede leer la credencial de A (barrera = filtro cliente_id explícito)."""
    cid_a, cid_b = str(uuid.uuid4()), str(uuid.uuid4())
    MpCredentialStore(_conn_factory(), cid_a, crypto).save(
        "seller-x", access_token="AT-A", refresh_token="RT-A", expires_at=1)
    store_b = MpCredentialStore(_conn_factory(), cid_b, crypto)
    assert store_b.get("seller-x") is None     # B no ve lo de A
