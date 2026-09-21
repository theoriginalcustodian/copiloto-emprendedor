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

    def completar(self) -> None:
        """Idempotente: marcar dos veces es marcar una."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"UPDATE {_TABLE} SET onboarding_completado = true WHERE cliente_id = %s", (self._cid,))
