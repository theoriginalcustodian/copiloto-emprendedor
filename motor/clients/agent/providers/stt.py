"""GroqSTT — transcripción de notas de voz (capa PLANTILLA, agnóstica del dominio).

Gemelo de LlmProvider: pega con `urllib` (sin SDK) al endpoint OpenAI-compatible de Groq
(`/openai/v1/audio/transcriptions`, modelo `whisper-large-v3`). SYNC a propósito: se invoca desde una activity
de Temporal vía `asyncio.to_thread` (igual que `complete` del LLM). Cero secretos: la key se lee del env
(`GROQ_API_KEY`).

Validado en el spike S4 / Motor C (2026-06-29): el OGG/Opus de Telegram (`.oga`) se acepta SIN conversión a wav
declarando el filename como `.ogg` (Groq valida el formato por extensión; `.oga` no está en su lista pero el
contenido OGG/Opus sí). Calidad es-AR ≥ ElevenLabs; latencia ~0.5s. NO requiere ffmpeg.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
import uuid

# Errores de TRANSPORTE/API (para que el caller decida; NO los traga el provider).
_API_ERRORS = (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ConnectionError, OSError)

DEFAULT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
DEFAULT_MODEL = "whisper-large-v3"     # multilingüe, máxima precisión; turbo = fallback si se excede la cuota


class GroqSTT:
    """Cliente STT con Groq Whisper. `transcribe(audio_bytes)` -> texto plano. Telegram envía `.oga` (OGG/Opus);
    se sube con filename `.ogg` (spike S4/Motor C) — sin conversión."""

    def __init__(self, *, model: str = DEFAULT_MODEL, language: str = "es",
                 api_key_env: str = "GROQ_API_KEY", url: str = DEFAULT_URL, timeout: float = 60.0):
        self.model = model
        self.language = language
        self._api_key_env = api_key_env
        self._url = url
        self._timeout = timeout

    def transcribe(self, audio_bytes: bytes, *, filename: str = "audio.ogg",
                   content_type: str = "audio/ogg") -> str:
        """Transcribe el audio y devuelve el texto. Lanza si falta la key o falla la API (el caller decide)."""
        key = os.environ.get(self._api_key_env)
        if not key:
            raise RuntimeError(f"falta {self._api_key_env} en el env del worker")
        boundary = f"----uc{uuid.uuid4().hex}"
        body = self._multipart(boundary, audio_bytes, filename, content_type)
        req = urllib.request.Request(self._url, data=body, method="POST", headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "uc-clinic-agent/1.0"})   # Groq/Cloudflare devuelve 403 al UA por defecto de urllib
        with urllib.request.urlopen(req, timeout=self._timeout) as resp:
            d = json.loads(resp.read().decode())
        return (d.get("text") or "").strip()

    def _multipart(self, boundary: str, audio_bytes: bytes, filename: str, content_type: str) -> bytes:
        """Arma el body multipart/form-data a mano (sin deps): campos de texto + el archivo de audio."""
        nl = b"\r\n"
        b = boundary.encode()
        parts: list[bytes] = []
        for name, value in (("model", self.model), ("language", self.language), ("response_format", "json")):
            parts += [b"--" + b + nl,
                      f'Content-Disposition: form-data; name="{name}"'.encode() + nl + nl,
                      value.encode() + nl]
        parts += [b"--" + b + nl,
                  f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode() + nl,
                  f"Content-Type: {content_type}".encode() + nl + nl,
                  audio_bytes + nl,
                  b"--" + b + b"--" + nl]
        return b"".join(parts)
