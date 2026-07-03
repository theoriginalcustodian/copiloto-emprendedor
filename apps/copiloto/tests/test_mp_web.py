# apps/copiloto/tests/test_mp_web.py
import sys, time, hmac, hashlib
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

APP = Path(__file__).resolve().parents[1]
ARCH = APP.parents[1] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH)); sys.path.insert(0, str(APP))
from clients.agent.providers.crypto import FernetCrypto  # noqa: E402
from mp_web import create_mp_app  # noqa: E402


class _FakeGateway:
    def exchange_code(self, code): return {"access_token": "AT", "refresh_token": "RT",
                                           "expires_in": 999, "user_id": 146, "public_key": "PK"}
    def get_payment(self, at, pid): return {"id": pid, "status": "approved", "transaction_amount": 150.0,
                                            "external_reference": "ext-1", "payer": {"email": "b@t.com"}}
    def verify_webhook(self, x_sig, x_rid, data_id): return x_sig.startswith("ts=") and "v1=0" not in x_sig


class _FakeCredStore:
    def __init__(self): self.saved = {}
    def save(self, seller, **kw): self.saved[seller] = kw
    def get(self, seller): return {"access_token": "AT"} if seller in self.saved or seller == "146" else {"access_token": "AT"}


class _FakePayStore:
    def __init__(self): self.upserts = []
    def upsert_from_payment(self, p, *, seller_user_id): self.upserts.append((p["id"], seller_user_id))


@pytest.fixture
def ctx(monkeypatch):
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())
    crypto = FernetCrypto()
    cred, pay = _FakeCredStore(), _FakePayStore()
    started = []
    app = create_mp_app(gateway=_FakeGateway(), crypto=crypto,
                        cred_store_factory=lambda cid: cred, payment_store_factory=lambda cid: pay,
                        start_refresh=lambda cid, seller: started.append((cid, seller)))
    return TestClient(app), crypto, cred, pay, started


def test_callback_exchanges_saves_and_starts_refresh(ctx):
    client, crypto, cred, pay, started = ctx
    state = crypto.encrypt("cliente-A")
    r = client.get(f"/mp/callback?code=abc&state={state}")
    assert r.status_code == 200
    assert "146" in cred.saved and cred.saved["146"]["access_token"] == "AT"   # guardó por seller user_id
    assert started == [("cliente-A", "146")]                                   # arrancó el refresh


def test_callback_saves_expires_at_as_absolute_timestamp(ctx):
    """M1: expires_at debe persistirse como timestamp ABSOLUTO (now + expires_in), no la duración cruda —
    _FakeGateway.exchange_code devuelve expires_in=999."""
    client, crypto, cred, pay, started = ctx
    state = crypto.encrypt("cliente-A")
    r = client.get(f"/mp/callback?code=abc&state={state}")
    assert r.status_code == 200
    assert cred.saved["146"]["expires_at"] >= int(time.time())   # NO es 999 (duración cruda)


def test_callback_rejects_tampered_state(ctx):
    client, *_ = ctx
    r = client.get("/mp/callback?code=abc&state=tampered")
    assert r.status_code == 400


def test_webhook_valid_signature_persists_payment(ctx):
    client, crypto, cred, pay, started = ctx
    ts = str(int(time.time() * 1000))
    r = client.post(f"/mp/webhook?cid=cliente-A&seller=146&data.id=P1&type=payment",
                    headers={"x-signature": f"ts={ts},v1=abc", "x-request-id": "rid"})
    assert r.status_code == 200
    assert pay.upserts == [("P1", "146")]


def test_webhook_bad_signature_does_not_persist(ctx):
    client, crypto, cred, pay, started = ctx
    r = client.post(f"/mp/webhook?cid=cliente-A&seller=146&data.id=P1&type=payment",
                    headers={"x-signature": "ts=1,v1=000", "x-request-id": "rid"})
    assert r.status_code == 200 and pay.upserts == []   # firma inválida → NO persiste, pero 200 (no reintentos)


def test_webhook_valid_signature_without_creds_does_not_persist(ctx):
    """L3: firma válida pero sin credenciales guardadas para el seller (tenant nunca conectó MP, o el store no
    tiene el par) → NO debe persistir el pago, pero igual responde 200 (no reintentos). Cred-store fake propio
    (no toca los fakes/tests existentes) cuyo .get() siempre devuelve None."""
    client, crypto, _cred, _pay, _started = ctx
    pay = _FakePayStore()

    class _NoCredStore:
        def get(self, seller):
            return None

    app = create_mp_app(gateway=_FakeGateway(), crypto=crypto,
                        cred_store_factory=lambda cid: _NoCredStore(), payment_store_factory=lambda cid: pay)
    no_cred_client = TestClient(app)
    ts = str(int(time.time() * 1000))
    r = no_cred_client.post(f"/mp/webhook?cid=cliente-A&seller=999&data.id=P1&type=payment",
                            headers={"x-signature": f"ts={ts},v1=abc", "x-request-id": "rid"})
    assert r.status_code == 200 and pay.upserts == []
