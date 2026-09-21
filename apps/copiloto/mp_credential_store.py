"""Store cifrado de credenciales OAuth de vendedores MercadoPago (capa CLIENTE, multi-tenant).

Aislamiento por tenant: el filtro EXPLÍCITO por `cliente_id` en CADA query es la barrera efectiva — el worker
usa el rol owner de DATABASE_URL, que BYPASSA la policy RLS (igual que reply_store.py). Los tokens se guardan
cifrados con Fernet (nunca en claro). Una fila por (cliente_id, seller_user_id) — idempotencia por índice único."""
from __future__ import annotations

import time
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
                f"expires_at=EXCLUDED.expires_at, public_key=EXCLUDED.public_key, "
                f"reauth_desde=NULL, updated_at=now()",
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

    def salud(self) -> str:
        """`"conectado" | "caido" | "nunca_conectado"` de la conexión de ESTE tenant (K-09).

        `caido` = hubo una conexión y ya no sirve: el refresh marcó `reauth_desde` (MP rechazó el
        `refresh_token`) o el token venció sin que nadie lo renovara. `nunca_conectado` = no hay fila:
        también es lo que queda tras desconectar a propósito desde Ajustes (`delete_all`), que NO es una
        caída -- el emprendedor lo decidió. Se mira la fila más reciente, como `first_seller_user_id`."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT reauth_desde, expires_at FROM {_TABLE} WHERE cliente_id=%s "
                f"ORDER BY updated_at DESC LIMIT 1", (self._cid,))
            row = cur.fetchone()
        if not row:
            return "nunca_conectado"
        reauth_desde, expires_at = row
        if reauth_desde is not None or (expires_at is not None and int(expires_at) < int(time.time())):
            return "caido"
        return "conectado"

    def marcar_reauth(self, seller_user_id: str) -> None:
        """El refresh no pudo renovar: esta conexión pide reconectar. Idempotente (conserva la fecha
        de la PRIMERA falla). `save`/`update_tokens` la limpian."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_TABLE} SET reauth_desde=coalesce(reauth_desde, now()) "
                f"WHERE cliente_id=%s AND seller_user_id=%s", (self._cid, seller_user_id))

    def delete_all(self) -> int:
        """Borra TODAS las credenciales MP de ESTE tenant (desconectar la app desde Ajustes) y
        devuelve cuántas filas se borraron -- 0 significa "no había nada que desconectar", que el
        endpoint traduce a 404. Devolver el rowcount y no `None` es deliberado: un DELETE sobre 0
        filas es un no-op SILENCIOSO, y sin este dato el endpoint respondería "desconectado" sobre
        un tenant que nunca conectó MP (el mismo `ok` vacío que ya está anotado como deuda en
        `web.py`).

        Borra por `cliente_id` y nada más: no recibe ni acepta un id de fila, así que un tenant no
        puede alcanzar las credenciales de otro ni probando ids (mismo criterio que el resto del
        store -- el filtro explícito por `cliente_id` es la barrera efectiva, porque el rol owner de
        DATABASE_URL bypassa RLS).

        Alcance HONESTO: esto borra la credencial LOCAL, con lo cual el copiloto pierde el acceso.
        NO revoca el token del lado de MercadoPago (su API de revocación no está integrada acá) --
        el token sigue vivo upstream hasta que expire. TODO(deuda gestionada · 2026-07-21 ·
        propietario: operador · pagar si se expone la desconexión como garantía de revocación, p.ej.
        ante un requisito de cumplimiento): integrar la revocación upstream de MP."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {_TABLE} WHERE cliente_id=%s", (self._cid,))
            return cur.rowcount

    def update_tokens(self, seller_user_id: str, *, access_token: str,
                      refresh_token: str, expires_at: int) -> None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_TABLE} SET access_token_enc=%s, refresh_token_enc=%s, expires_at=%s, reauth_desde=NULL, "
                f"updated_at=now() "
                f"WHERE cliente_id=%s AND seller_user_id=%s",
                (self._crypto.encrypt(access_token), self._crypto.encrypt(refresh_token),
                 expires_at, self._cid, seller_user_id))
