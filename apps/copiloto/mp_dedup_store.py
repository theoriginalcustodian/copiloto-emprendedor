"""Dedup app-side de links de cobro MercadoPago (capa CLIENTE, multi-tenant). Spike C (2026-07-04) probó que
MP /checkout/preferences NO deduplica (ni external_reference ni X-Idempotency-Key): un retry at-least-once de
Temporal crearia un 2do link. Keyed por (cliente_id, idem_key) donde idem_key = f"{workflow_id}-{turn_ix}-{step}"
(turn_ix global y monotono, sobrevive continue-as-new): SELECT-then-INSERT ON CONFLICT.
Aislamiento por filtro cliente_id explicito (el worker owner bypassa RLS)."""
from __future__ import annotations

from typing import Callable

_TABLE = "uc_factory.mp_link_dedup"


class MpLinkDedupStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    def get(self, idem_key: str) -> dict | None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT preference_id, init_point, external_reference FROM {_TABLE} "
                f"WHERE cliente_id=%s AND idem_key=%s", (self._cid, idem_key))
            row = cur.fetchone()
        if not row:
            return None
        return {"preference_id": row[0], "init_point": row[1], "external_reference": row[2]}

    def save(self, idem_key: str, *, preference_id: str, init_point: str, external_reference: str) -> None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_TABLE} (cliente_id, idem_key, preference_id, init_point, external_reference) "
                f"VALUES (%s,%s,%s,%s,%s) ON CONFLICT (cliente_id, idem_key) DO NOTHING",
                (self._cid, idem_key, preference_id, init_point, external_reference))
