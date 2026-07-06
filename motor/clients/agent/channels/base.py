"""ChannelAdapter — contrato de un canal de mensajeria (capa PLANTILLA, agnostica del dominio).

Un canal (Telegram, WhatsApp, voz) implementa este protocolo. El motor (ConversationWorkflow) y el router
son ciegos al canal concreto: solo conocen `normalize_inbound` (raw del canal -> NormalizedMessage) y `send`
(responder por el canal). Agregar WhatsApp manana = un adapter nuevo con la MISMA forma; nada del motor cambia.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from backend.agent.types import NormalizedMessage


@runtime_checkable
class ChannelAdapter(Protocol):
    name: str

    def normalize_inbound(self, raw: dict) -> NormalizedMessage | None:
        """Convierte un update crudo del canal en un NormalizedMessage. None si el update no es procesable."""
        ...

    def send(self, channel_ref: str, text: str, choices: list | None = None, *,
             cliente_id: str | None = None, card: dict | None = None) -> dict:
        """Envia `text` al interlocutor `channel_ref`. Si `choices` (lista de {label, value}), los renderiza
        como opciones discretas (el canal decide cómo: inline keyboard, buttons, lista hablada). `cliente_id`
        (tenant, per-request) es opcional: canales single-tenant o sin noción de tenant (Telegram) lo ignoran;
        solo lo usan los canales cuyo transporte necesita el aislamiento (web -> reply_sink). `card` es metadata
        OPCIONAL de presentacion (ej HITL {'service','label'}): los canales ricos la renderizan, los texto-only
        la ignoran. Devuelve {'sent': bool, ...}."""
        ...
