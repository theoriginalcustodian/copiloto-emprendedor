"""Helper compartido de tests del dispatcher — arma un `TenantCtx` real (no un doble) para ejercitar el
MISMO contrato que `context_factory.py` arma en producción. Multitenant-only (Task 8b): `make_dispatcher`
ya no acepta un fallback single-tenant, así que todo test que ejercite `dispatch(...)` necesita pasar un
`ctx` real. DRY: un solo lugar en vez de duplicarlo en cada test file de servicio (docs/drive/gmail/hubspot/
instagram/sheets/dispatcher/e2e*)."""
from __future__ import annotations

import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP))

from context_factory import TenantCtx  # noqa: E402


def make_ctx(*, composio_user_id: str = "u1", mp_gateway=None, mp_cred_store=None,
             mp_seller_user_id: str | None = None, mp_webhook_base: str | None = None,
             cliente_id: str = "cli-test") -> TenantCtx:
    """TenantCtx real: los servicios non-MP solo necesitan `composio_user_id`; mp_* quedan None salvo que
    el test los ejercite explícitamente (ver test_mp_dispatch.py para el caso MercadoPago)."""
    return TenantCtx(cliente_id=cliente_id, composio_user_id=composio_user_id, mp_gateway=mp_gateway,
                     mp_cred_store=mp_cred_store, mp_seller_user_id=mp_seller_user_id,
                     mp_webhook_base=mp_webhook_base)


__all__ = ["make_ctx"]
