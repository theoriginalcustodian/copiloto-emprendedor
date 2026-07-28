"""WebChannelAdapter — canal HTTP/web (capa PLANTILLA, agnostica del dominio).

Gemelo del TelegramAdapter para una interfaz web. normalize_inbound mapea el POST del frontend
({session_id, text, kind}) a NormalizedMessage; send NO postea a una Bot API: persiste el reply via
`reply_sink` (inyectado) para que un endpoint /reply lo sirva por long-poll. session_id = channel_ref.
A diferencia de Telegram, NO tiene get_updates ni download_file (no hay long-poll ni STT en F1).

Multitenant: `cliente_id` viaja POR LLAMADA (kwarg de `send`, nunca horneado en el adapter) y se lo pasa tal
cual al `reply_sink` inyectado -- un mismo adapter/worker puede servir replies de N tenants sin fugas."""
from __future__ import annotations

from typing import Callable

from backend.agent.types import NormalizedMessage

CHANNEL = "web"


class WebChannelAdapter:
    name = CHANNEL

    def __init__(self, *, reply_sink: Callable[..., None]):
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

    def send(self, channel_ref: str, text: str, choices: list | None = None, *,
             cliente_id: str | None = None, card: dict | None = None,
             idem_key: str | None = None) -> dict:
        """El reply se persiste con `idem_key`: el sink lo usa para que un reintento de la activity no
        deje un segundo reply idéntico en el chat del emprendedor."""
        self._reply_sink(cliente_id, channel_ref, text, choices or None, card or None,
                         idem_key=idem_key)
        return {"sent": True}
