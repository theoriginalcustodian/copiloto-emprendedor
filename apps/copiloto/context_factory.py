"""context_factory — arma el `TenantCtx` per-request (capa CLIENTE, multitenant real).

El dispatcher del dominio 'emprendedor' ya NO hornea `cliente_id`/`composio_user_id`/`mp_*` en su closure
(composition root single-tenant heredado): en cambio, `agent_activities.dispatch_intent` (capa PLANTILLA,
sin tocar) llama `ctx = dom["context_factory"](payload["conv"])` con el `conv` DEL REQUEST — que ya trae
`cliente_id` (lo threadea el `ConversationWorkflow`, `workflow_id = conv-{channel}-{cliente_id}-{ref}`).

Cero fuga entre tenants: cada llamada arma un `TenantCtx` NUEVO desde el `cliente_id` del request (nunca de
env/closure), con un `MpCredentialStore` propio de ESE tenant. `mp_gateway` es compartido (stateless, sin
estado por-tenant) — se inyecta una sola vez al construir el factory."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from mp_credential_store import MpCredentialStore


@dataclass(frozen=True)
class TenantCtx:
    """Recursos por-tenant que el dispatcher lee vía `ctx.*` en vez del closure horneado."""
    cliente_id: str
    composio_user_id: str
    mp_gateway: object | None
    mp_cred_store: MpCredentialStore
    mp_seller_user_id: str | None
    mp_webhook_base: str | None
    memory_provider: object | None = None    # boundary de memoria (compartido, stateless); tools futuras
                                             # (BI/catálogo, group graphs) lo usan vía ctx.memory_provider
    idem_key: str | None = None              # clave de idempotencia de ESTA activity (C1): la arma
                                             # `dispatch_intent` con `activity.info()` (mismo patrón que
                                             # `_idem_key_de_la_activity` en agent_activities.py), nunca
                                             # el workflow -- así el dispatcher puede deduplicar writes
                                             # ante un retry at-least-once sin tocar el input del workflow.


def make_context_factory(*, conn_factory: Callable, crypto, mp_gateway=None,
                         mp_webhook_base: str | None = None,
                         memory_provider=None) -> Callable[[dict], TenantCtx]:
    """Devuelve `context_factory(conv) -> TenantCtx`. `conv` es el payload del activity `dispatch_intent`
    (trae `cliente_id` per-request). `composio_user_id = str(cliente_id)` (decisión cerrada del design §2.3:
    la entity de Composio se identifica por el cliente_id del tenant). El seller de MercadoPago del tenant se
    resuelve del propio `mp_credentials` (elimina el env manual `MP_SELLER_USER_ID`)."""
    def context_factory(conv: dict) -> TenantCtx:
        cliente_id = conv["cliente_id"]
        cred_store = MpCredentialStore(conn_factory, cliente_id, crypto)
        return TenantCtx(
            cliente_id=cliente_id,
            composio_user_id=str(cliente_id),
            mp_gateway=mp_gateway,
            mp_cred_store=cred_store,
            mp_seller_user_id=cred_store.first_seller_user_id(),
            mp_webhook_base=mp_webhook_base,
            memory_provider=memory_provider,
            idem_key=conv.get("idem_key"),
        )
    return context_factory


__all__ = ["TenantCtx", "make_context_factory"]
