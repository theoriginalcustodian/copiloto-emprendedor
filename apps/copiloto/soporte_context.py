"""context_factory liviano del domain 'soporte' (SOP4) -- NO reusa `TenantCtx` (context_factory.py) a
propósito: ese ctx carga MercadoPago/Composio, ajeno al soporte técnico. Mismo patrón (per-request,
cero fuga entre tenants, `cliente_id` nunca de env/closure), campo único."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class SoporteCtx:
    cliente_id: str


def make_soporte_context_factory() -> Callable[[dict], SoporteCtx]:
    def context_factory(conv: dict) -> SoporteCtx:
        return SoporteCtx(cliente_id=conv["cliente_id"])
    return context_factory


__all__ = ["SoporteCtx", "make_soporte_context_factory"]
