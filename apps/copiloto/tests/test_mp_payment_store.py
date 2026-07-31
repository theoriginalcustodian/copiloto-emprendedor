import os, uuid
import pytest

from mp_payment_store import MpPaymentStore  # noqa: E402

pytestmark = pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="requiere Postgres del VPS")


def _payment(pid, status="approved", amount=150.0):
    return {"id": pid, "status": status, "transaction_amount": amount,
            "external_reference": "ext-1", "payer": {"email": "b@t.com"}, "date_approved": "2026-07-02T10:00:00Z"}


def test_upsert_is_idempotent_by_payment_id(conn_de_tenant):
    cid = str(uuid.uuid4())
    store = MpPaymentStore(conn_de_tenant(cid), cid)
    store.upsert_from_payment(_payment("p1", status="pending"), seller_user_id="s1")
    store.upsert_from_payment(_payment("p1", status="approved"), seller_user_id="s1")  # misma id → update, no dup
    rows = store.list_payments()
    assert len(rows) == 1 and rows[0]["status"] == "approved"


def test_sum_approved_is_cash_flow(conn_de_tenant):
    cid = str(uuid.uuid4())
    store = MpPaymentStore(conn_de_tenant(cid), cid)
    store.upsert_from_payment(_payment("p1", amount=100.0), seller_user_id="s1")
    store.upsert_from_payment(_payment("p2", amount=50.0), seller_user_id="s1")
    store.upsert_from_payment(_payment("p3", status="rejected", amount=999.0), seller_user_id="s1")
    assert store.sum_approved() == 150.0   # solo approved


def test_adversarial_cross_tenant(conn_de_tenant):
    cid_a, cid_b = str(uuid.uuid4()), str(uuid.uuid4())
    MpPaymentStore(conn_de_tenant(cid_a), cid_a).upsert_from_payment(_payment("p1"), seller_user_id="s1")
    assert MpPaymentStore(conn_de_tenant(cid_b), cid_b).list_payments() == []   # B no ve pagos de A
