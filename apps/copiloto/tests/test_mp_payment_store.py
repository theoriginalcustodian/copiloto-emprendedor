import os, sys, uuid
from pathlib import Path
import pytest

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP))
from mp_payment_store import MpPaymentStore  # noqa: E402

pytestmark = pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="requiere Postgres del VPS")


def _cf():
    import psycopg2
    def f():
        c = psycopg2.connect(os.environ["DATABASE_URL"]); c.autocommit = True; return c
    return f


def _payment(pid, status="approved", amount=150.0):
    return {"id": pid, "status": status, "transaction_amount": amount,
            "external_reference": "ext-1", "payer": {"email": "b@t.com"}, "date_approved": "2026-07-02T10:00:00Z"}


def test_upsert_is_idempotent_by_payment_id():
    cid = str(uuid.uuid4())
    store = MpPaymentStore(_cf(), cid)
    store.upsert_from_payment(_payment("p1", status="pending"), seller_user_id="s1")
    store.upsert_from_payment(_payment("p1", status="approved"), seller_user_id="s1")  # misma id → update, no dup
    rows = store.list_payments()
    assert len(rows) == 1 and rows[0]["status"] == "approved"


def test_sum_approved_is_cash_flow():
    cid = str(uuid.uuid4())
    store = MpPaymentStore(_cf(), cid)
    store.upsert_from_payment(_payment("p1", amount=100.0), seller_user_id="s1")
    store.upsert_from_payment(_payment("p2", amount=50.0), seller_user_id="s1")
    store.upsert_from_payment(_payment("p3", status="rejected", amount=999.0), seller_user_id="s1")
    assert store.sum_approved() == 150.0   # solo approved


def test_adversarial_cross_tenant():
    cid_a, cid_b = str(uuid.uuid4()), str(uuid.uuid4())
    MpPaymentStore(_cf(), cid_a).upsert_from_payment(_payment("p1"), seller_user_id="s1")
    assert MpPaymentStore(_cf(), cid_b).list_payments() == []   # B no ve pagos de A
