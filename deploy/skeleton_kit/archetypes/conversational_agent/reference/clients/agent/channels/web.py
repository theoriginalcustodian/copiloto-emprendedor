"""WebChannelAdapter — canal HTTP/web (capa PLANTILLA, agnostica del dominio).

Gemelo del TelegramAdapter para una interfaz web. normalize_inbound mapea el POST del frontend
({session_id, text, kind}) a NormalizedMessage; send NO postea a una Bot API: persiste el reply via
`reply_sink` (inyectado) para que un endpoint /reply lo sirva por long-poll. session_id = channel_ref.
A diferencia de Telegram, NO tiene get_updates ni download_file (no hay long-poll ni STT en F1)."""
from __future__ import annotations

from typing import Callable

from backend.agent.types import NormalizedMessage

CHANNEL = "web"


class WebChannelAdapter:
    name = CHANNEL

    def __init__(self, *, reply_sink: Callable[[str, str, list | None], None]):
        self._reply_sink = reply_sink

    def normalize_inbound(self, raw: dict) -> NormalizedMessage | None:
        session_id = raw.get("session_id")
        text = raw.get("text")
        if not session_id or not isinstance(text, str) or not text.strip():
            return None
        kind = raw.get("kind") or "text"
        if kind not in ("text", "callback"):
            kind = "text"
        return NormalizedMessage(channel=CHANNEL, channel_ref=str(session_id), text=text, kind=kind)

    def send(self, channel_ref: str, text: str, choices: list | None = None) -> dict:
        self._reply_sink(channel_ref, text, choices or None)
        return {"sent": True}
