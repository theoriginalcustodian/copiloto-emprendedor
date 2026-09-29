"""Aceptación de términos legales del tenant (BL-O6 Parte B).

Vive en `uc_factory.tenants.legal_version` + `.legal_aceptado_en` (columnas aditivas,
`provision._ensure_legal_aceptado`), no en el perfil del negocio: es un hecho de la CUENTA, igual
que `onboarding_completado` (`tenant_onboarding_store.py`, mismo molde). Siempre filtrado por
`cliente_id` del token -- nunca de un valor que mande el cliente en el body.
"""
from __future__ import annotations

import datetime
from typing import Callable, Optional

_TABLE = "uc_factory.tenants"

# La versión vigente del documento legal, del lado del servidor. Es la que compara `POST
# /me/legal/aceptar` para decidir 200 vs 409. No hay import cruzado posible con el `LEGAL_VERSION`
# de `apps/copiloto-web`/`apps/mobile` (Python vs TS, repos-dentro-del-repo): el valor viaja por
# CONVENCIÓN -- literal idéntico en los tres lugares -- no por código compartido. Si cambia acá,
# cambia también en el front (Parte A, BL-O6); si no, todo tenant queda en 409 permanente.
LEGAL_VERSION_VIGENTE = "2026-09-22"


class TenantLegalStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    def version_aceptada(self) -> Optional[str]:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"SELECT legal_version FROM {_TABLE} WHERE cliente_id = %s", (self._cid,))
            row = cur.fetchone()
        return row[0] if row else None

    def aceptar(self, version: str) -> datetime.datetime:
        """Idempotente: aceptar la misma versión dos veces pisa la misma fila, sin error."""
        conn = self._conn_factory()
        en = datetime.datetime.now(datetime.timezone.utc)
        with conn.cursor() as cur:
            cur.execute(f"UPDATE {_TABLE} SET legal_version = %s, legal_aceptado_en = %s "
                        f"WHERE cliente_id = %s", (version, en, self._cid))
        return en
