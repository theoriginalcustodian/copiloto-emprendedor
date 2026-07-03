"""Persistencia de pagos MercadoPago para el BI de caja (capa CLIENTE, multi-tenant). Idempotente por
(cliente_id, payment_id): el webhook puede repetir la notificación → upsert, nunca doble fila. Aislamiento
por filtro cliente_id explícito (el worker owner bypassa RLS)."""
from __future__ import annotations

import json
from typing import Callable

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.mp_payments"


class MpPaymentStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    def upsert_from_payment(self, payment: dict, *, seller_user_id: str) -> None:
        pid = str(payment.get("id"))
        amount = payment.get("transaction_amount")
        payer_email = (payment.get("payer") or {}).get("email")
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_TABLE} (cliente_id, payment_id, seller_user_id, status, amount, "
                f"external_reference, payer_email, raw, occurred_at) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                f"ON CONFLICT (cliente_id, payment_id) DO UPDATE SET "
                f"status=EXCLUDED.status, amount=EXCLUDED.amount, "
                f"external_reference=EXCLUDED.external_reference, payer_email=EXCLUDED.payer_email, "
                f"raw=EXCLUDED.raw, occurred_at=EXCLUDED.occurred_at",
                (self._cid, pid, seller_user_id, payment.get("status"), amount,
                 payment.get("external_reference"), payer_email, json.dumps(payment),
                 payment.get("date_approved") or payment.get("date_created")))

    def list_payments(self, *, limit: int = 100) -> list[dict]:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT payment_id, status, amount, external_reference, payer_email, occurred_at FROM {_TABLE} "
                f"WHERE cliente_id=%s ORDER BY id DESC LIMIT %s", (self._cid, limit))
            rows = cur.fetchall()
        return [{"payment_id": r[0], "status": r[1], "amount": float(r[2]) if r[2] is not None else None,
                 "external_reference": r[3], "payer_email": r[4], "occurred_at": str(r[5])} for r in rows]

    def sum_approved(self) -> float:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"SELECT COALESCE(SUM(amount),0) FROM {_TABLE} "
                        f"WHERE cliente_id=%s AND status='approved'", (self._cid,))
            return float(cur.fetchone()[0])
