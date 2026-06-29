"""TelegramAdapter — canal Telegram (texto en Fase 1; nota de voz marcada para Fase 2).

Implementa el contrato ChannelAdapter. `normalize_inbound` mapea un update de Bot API (getUpdates/webhook)
a NormalizedMessage; `send` postea via sendMessage. Cero secretos en el modulo: el token se inyecta (lo lee
el worker del env TELEGRAM_BOT_TOKEN). Una nota de voz -> kind='needs_stt' (la transcripcion la hara Fase 2;
el motor recibe el flag y, por ahora, el dispatcher responde pidiendo texto).
"""
from __future__ import annotations

import json
import urllib.request

from backend.agent.types import NormalizedMessage

CHANNEL = "telegram"


class TelegramAdapter:
    name = CHANNEL

    def __init__(self, token: str, *, api_base: str = "https://api.telegram.org", timeout: float = 20.0):
        self._token = token
        self._base = f"{api_base}/bot{token}"
        self._timeout = timeout

    def normalize_inbound(self, update: dict) -> NormalizedMessage | None:
        # Botón tocado (inline keyboard): determinístico, el value va como texto con kind='callback' -> el motor
        # NO llama al LLM para esto. (Pura: NO hace I/O; el answerCallbackQuery cosmético se omite en Fase 1.5.)
        cb = update.get("callback_query")
        if cb:
            chat = ((cb.get("message") or {}).get("chat")) or {}
            chat_id = chat.get("id")
            data = cb.get("data")
            if chat_id is None or not data:
                return None
            return NormalizedMessage(channel=CHANNEL, channel_ref=str(chat_id), text=str(data), kind="callback")
        msg = update.get("message") or update.get("edited_message") or {}
        chat = msg.get("chat") or {}
        chat_id = chat.get("id")
        if chat_id is None:
            return None
        ref = str(chat_id)
        if isinstance(msg.get("text"), str) and msg["text"].strip():
            return NormalizedMessage(channel=CHANNEL, channel_ref=ref, text=msg["text"], kind="text")
        if "voice" in msg or "audio" in msg:
            return NormalizedMessage(channel=CHANNEL, channel_ref=ref, text="", kind="needs_stt")
        return None

    def send(self, channel_ref: str, text: str, choices: list | None = None) -> dict:
        payload = {"chat_id": channel_ref, "text": text}
        if choices:
            # un botón por fila (vertical, más legible en mobile). callback_data = el value (≤64 bytes).
            payload["reply_markup"] = {"inline_keyboard": [
                [{"text": c["label"], "callback_data": str(c["value"])}] for c in choices]}
        body = json.dumps(payload).encode()
        req = urllib.request.Request(f"{self._base}/sendMessage", data=body, method="POST",
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=self._timeout) as resp:
            d = json.loads(resp.read().decode())
        result = d.get("result") or {}
        return {"sent": bool(d.get("ok")), "message_id": result.get("message_id")}

    def get_updates(self, offset: int | None = None, timeout: int = 25) -> list[dict]:
        """Long-poll de updates (para el router en modo polling). Devuelve la lista de updates."""
        params = {"timeout": timeout}
        if offset is not None:
            params["offset"] = offset
        body = json.dumps(params).encode()
        req = urllib.request.Request(f"{self._base}/getUpdates", data=body, method="POST",
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout + 10) as resp:
            d = json.loads(resp.read().decode())
        return d.get("result") or []
