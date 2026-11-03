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

import base64
import json
import logging
import os
import random
import time
import urllib.error
import urllib.request
import uuid

# Errores de TRANSPORTE/API (para que el caller decida; NO los traga el provider).
_API_ERRORS = (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ConnectionError, OSError)

DEFAULT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
# multilingüe, máxima precisión. `GROQ_STT_MODEL` lo sobreescribe sin deploy de código (p. ej. `whisper-large-v3-turbo`:
# más barato y con más cupo por hora, algo menos preciso) — cambiar y volver atrás es editar el env del servicio.
DEFAULT_MODEL = os.environ.get("GROQ_STT_MODEL") or "whisper-large-v3"


class GroqSTT:
    """Cliente STT con Groq Whisper. `transcribe(audio_bytes)` -> texto plano. Telegram envía `.oga` (OGG/Opus);
    se sube con filename `.ogg` (spike S4/Motor C) — sin conversión."""

    def __init__(self, *, model: str = DEFAULT_MODEL, language: str = "es",
                 api_key_env: str = "GROQ_API_KEY", url: str = DEFAULT_URL, timeout: float = 60.0,
                 reintentos_429: int = 2, espera_max_429: float = 5.0):
        self.model = model
        self._reintentos_429 = reintentos_429
        self._espera_max_429 = espera_max_429
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
        d = self._post(req)
        return (d.get("text") or "").strip()

    def _post(self, req: urllib.request.Request) -> dict:
        """POST con reintento SÓLO ante 429 (rate limit): espera `retry-after` (tope `espera_max_429`, + jitter para
        que las ráfagas no reintenten en el mismo instante) y reintenta hasta `reintentos_429` veces. Cualquier otro
        error se propaga igual que antes. Acá NO hay Temporal que reintente: esto corre en el endpoint HTTP
        (`/chat/audio`), así que sin esto un 429 llegaba al usuario como error de dictado."""
        for intento in range(self._reintentos_429 + 1):
            try:
                with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                    return json.loads(resp.read().decode())
            except urllib.error.HTTPError as e:
                if e.code != 429 or intento >= self._reintentos_429:
                    raise
                try:
                    espera = float(e.headers.get("retry-after") or 1)
                except (TypeError, ValueError):
                    espera = 1.0
                time.sleep(min(max(espera, 0.0), self._espera_max_429) + random.uniform(0, 0.5))
        raise RuntimeError("inalcanzable")  # pragma: no cover

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


# --- Respaldo: OpenRouter (mismo modelo, otros proveedores) -------------------------------------------------------
OPENROUTER_STT_URL = "https://openrouter.ai/api/v1/audio/transcriptions"
OPENROUTER_STT_MODEL = os.environ.get("OPENROUTER_STT_MODEL") or "openai/whisper-large-v3-turbo"
# extensión del filename -> `input_audio.format` que acepta OpenRouter (mp3, mp4, wav, webm, flac, ogg)
_OR_FORMATOS = {"ogg": "ogg", "oga": "ogg", "opus": "ogg", "mp3": "mp3", "mpeg": "mp3", "mp4": "mp4", "m4a": "mp4",
                "wav": "wav", "x-wav": "wav", "webm": "webm", "flac": "flac"}
_log = logging.getLogger(__name__)


class OpenRouterSTT:
    """Respaldo de `GroqSTT` vía OpenRouter (`/audio/transcriptions`, JSON con el audio en base64 — NO multipart).
    Mismo contrato: `transcribe(audio_bytes, filename=, content_type=) -> str`; lanza si falta la key o falla la API.
    Validado contra la API real (spike 2026-11-02: HTTP 200, `{"text", "usage": {"seconds", "cost"}}`)."""

    def __init__(self, *, model: str = OPENROUTER_STT_MODEL, language: str = "es",
                 api_key_env: str = "OPENROUTER_API_KEY", url: str = OPENROUTER_STT_URL, timeout: float = 60.0):
        self.model = model
        self.language = language
        self._api_key_env = api_key_env
        self._url = url
        self._timeout = timeout

    def transcribe(self, audio_bytes: bytes, *, filename: str = "audio.ogg",
                   content_type: str = "audio/ogg") -> str:
        key = os.environ.get(self._api_key_env)
        if not key:
            raise RuntimeError(f"falta {self._api_key_env} en el env del worker")
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        fmt = _OR_FORMATOS.get(ext) or _OR_FORMATOS.get((content_type or "").split("/")[-1].split(";")[0].lower())
        if not fmt:
            raise ValueError(f"formato de audio no soportado por OpenRouter: {filename!r} / {content_type!r}")
        body = {"model": self.model, "language": self.language,
                "input_audio": {"data": base64.b64encode(audio_bytes).decode(), "format": fmt}}
        req = urllib.request.Request(self._url, data=json.dumps(body).encode(), method="POST", headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json", "User-Agent": "uc-clinic-agent/1.0"})
        with urllib.request.urlopen(req, timeout=self._timeout) as resp:
            d = json.loads(resp.read().decode())
        return (d.get("text") or "").strip()


def _es_recuperable(e: BaseException) -> bool:
    """¿Vale la pena probar el respaldo? Rate limit (429), falla del servidor (5xx) o de red. NO: 4xx (audio inválido,
    key rechazada) ni RuntimeError de configuración — el respaldo no los arregla y taparlos esconde el bug."""
    if isinstance(e, urllib.error.HTTPError):
        return e.code == 429 or e.code >= 500
    return isinstance(e, (urllib.error.URLError, TimeoutError, ConnectionError))


class STTConRespaldo:
    """Primario + respaldo. Misma interfaz que `GroqSTT`. Si el primario falla de forma recuperable, prueba el respaldo;
    si el respaldo también falla, propaga ESE error (encadenado al del primario)."""

    def __init__(self, primario, respaldo):
        self.primario, self.respaldo = primario, respaldo

    def transcribe(self, audio_bytes: bytes, *, filename: str = "audio.ogg", content_type: str = "audio/ogg") -> str:
        try:
            return self.primario.transcribe(audio_bytes, filename=filename, content_type=content_type)
        except Exception as e:  # noqa: BLE001 — se re-lanza si no es recuperable
            if not _es_recuperable(e):
                raise
            _log.warning('{"evento": "stt_respaldo", "motivo": "%s"}', type(e).__name__ + (f" {e.code}" if hasattr(e, "code") else ""))
            return self.respaldo.transcribe(audio_bytes, filename=filename, content_type=content_type)


def build_stt():
    """STT por defecto del front-door. Con `OPENROUTER_API_KEY` en el env: OpenRouter PRIMARIO y Groq de respaldo
    (medido 2026-11-02, 25 llamadas c/u: OpenRouter ~US$0,015/h y 25/25 OK, p50 0,88 s; Groq US$0,04/h, p50 0,32 s y
    429 al agotar el cupo). `STT_PRIMARIO=groq` invierte el orden SIN tocar código. El primario no espera ni reintenta
    ante un 429: cae al otro en el acto. Sin `OPENROUTER_API_KEY`: sólo Groq, con su reintento acotado de 429."""
    if not os.environ.get("OPENROUTER_API_KEY"):
        return GroqSTT()
    groq, orr = GroqSTT(reintentos_429=0), OpenRouterSTT()
    if (os.environ.get("STT_PRIMARIO") or "openrouter").lower() == "groq":
        return STTConRespaldo(groq, orr)
    return STTConRespaldo(orr, groq)
