"""Store cifrado de credenciales OAuth de vendedores MercadoPago (capa CLIENTE, multi-tenant).

Aislamiento por tenant: el filtro EXPLÍCITO por `cliente_id` en CADA query es la barrera efectiva — el worker
usa el rol owner de DATABASE_URL, que BYPASSA la policy RLS (igual que reply_store.py). Los tokens se guardan
cifrados con Fernet (nunca en claro). Una fila por (cliente_id, seller_user_id) — idempotencia por índice único."""
from __future__ import annotations

from typing import Callable

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.mp_credentials"


class MpCredentialStore:
    def __init__(self, conn_factory: Callable, cliente_id: str, crypto) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id
        self._crypto = crypto

    def save(self, seller_user_id: str, *, access_token: str, refresh_token: str,
             expires_at: int, public_key: str | None = None) -> None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_TABLE} "
                f"(cliente_id, seller_user_id, access_token_enc, refresh_token_enc, expires_at, public_key) "
                f"VALUES (%s,%s,%s,%s,%s,%s) "
                f"ON CONFLICT (cliente_id, seller_user_id) DO UPDATE SET "
                f"access_token_enc=EXCLUDED.access_token_enc, refresh_token_enc=EXCLUDED.refresh_token_enc, "
                f"expires_at=EXCLUDED.expires_at, public_key=EXCLUDED.public_key, updated_at=now()",
                (self._cid, seller_user_id, self._crypto.encrypt(access_token),
                 self._crypto.encrypt(refresh_token), expires_at, public_key))

    def get(self, seller_user_id: str) -> dict | None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT access_token_enc, refresh_token_enc, expires_at, public_key FROM {_TABLE} "
                f"WHERE cliente_id=%s AND seller_user_id=%s", (self._cid, seller_user_id))
            row = cur.fetchone()
        if not row:
            return None
        at_enc, rt_enc, expires_at, public_key = row
        return {"access_token": self._crypto.decrypt(at_enc),
                "refresh_token": self._crypto.decrypt(rt_enc),
                "expires_at": expires_at, "public_key": public_key}

    def first_seller_user_id(self) -> str | None:
        """El seller MÁS RECIENTE conectado por ESTE tenant (resuelve el seller sin env var manual: MVP
        single-seller-por-tenant, ver context_factory.py). None si el tenant todavía no conectó MP."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT seller_user_id FROM {_TABLE} WHERE cliente_id=%s "
                f"ORDER BY updated_at DESC LIMIT 1", (self._cid,))
            row = cur.fetchone()
        return row[0] if row else None

    def update_tokens(self, seller_user_id: str, *, access_token: str,
                      refresh_token: str, expires_at: int) -> None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_TABLE} SET access_token_enc=%s, refresh_token_enc=%s, expires_at=%s, updated_at=now() "
                f"WHERE cliente_id=%s AND seller_user_id=%s",
                (self._crypto.encrypt(access_token), self._crypto.encrypt(refresh_token),
                 expires_at, self._cid, seller_user_id))
