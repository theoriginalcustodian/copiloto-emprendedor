"""Flag «ya pasó por el onboarding de 2 permisos» del tenant (K-14, BL-X8).

Vive en `uc_factory.tenants.onboarding_completado` (columna aditiva, `provision._ensure_onboarding_completado`),
no en el perfil del negocio: es un hecho de la CUENTA que la app consulta en `GET /me` antes de pintar
nada, y `tenants` ya es la tabla que resuelve al tenant. Siempre filtrado por `cliente_id` del token.
"""
from __future__ import annotations

from typing import Callable

_TABLE = "uc_factory.tenants"


class TenantOnboardingStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    def completado(self) -> bool:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"SELECT onboarding_completado FROM {_TABLE} WHERE cliente_id = %s", (self._cid,))
            row = cur.fetchone()
        return bool(row[0]) if row else False

    def fecha_alta(self) -> str | None:
        """SM-K5: fecha de alta de la cuenta (`tenants.created_at`) en ISO `YYYY-MM-DD`; `None` si la fila no
        existe o no tiene fecha: ausente, nunca inventada. Sale del `cliente_id` del token, jamás de un
        parámetro. Vive acá porque es la misma tabla/fila que `completado()` y `/me` ya la lee."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"SELECT created_at FROM {_TABLE} WHERE cliente_id = %s", (self._cid,))
            row = cur.fetchone()
        return row[0].date().isoformat() if row and row[0] else None

    def completar(self) -> None:
        """Idempotente: marcar dos veces es marcar una."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"UPDATE {_TABLE} SET onboarding_completado = true WHERE cliente_id = %s", (self._cid,))
