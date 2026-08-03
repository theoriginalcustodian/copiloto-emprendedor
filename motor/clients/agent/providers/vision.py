"""OpenAIVisionOCR — lectura de tickets de gastos por foto (capa PLANTILLA, agnóstica del dominio).

Gemelo de `GroqSTT` (`stt.py`) para OCR: pega con `urllib` (sin SDK) al endpoint chat/completions de
OpenAI con un content-part `image_url` (data URI base64). Modelo `gpt-4o` (NO `mini`): el spike
`spikes/ocr-tickets/RESULT.md` midió 4/4 vs 2/4 aciertos al MISMO costo real (`gpt-4o` cobra 17× menos
tokens de imagen por su tiling más grueso — el barato salía más caro). SYNC a propósito: se invoca vía
`asyncio.to_thread` desde el endpoint HTTP (mismo patrón que `/chat/audio` con `GroqSTT.transcribe`).
Cero secreto nuevo: reusa `OPENAI_API_KEY`, la misma key que ya usa `worker_b.build_llm`.

🔴 `legible` NO es señal de confianza — el spike midió `legible: true` en TODAS las alucinaciones del
modelo ante fotos ilegibles/borrosas. El caller NUNCA debe usar este campo como gate; el diseño del
addendum de la foto (monto vacío + sugerencia tocable) existe justamente porque no hay ninguna señal
del modelo en la que se pueda confiar para decidir "esto sí, esto no"."""
from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request

# Errores de TRANSPORTE/API (para que el caller decida; NO los traga el provider) — mismo criterio que
# `stt._API_ERRORS`.
_API_ERRORS = (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ConnectionError, OSError)

DEFAULT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o"

_PROMPT_BASE = (
    "Sos un lector de tickets de gastos argentinos. Devolvé SOLO JSON (sin markdown) con estas claves: "
    "monto (número o null — el TOTAL final que se pagó), "
    "evidencia_monto (el texto crudo de la línea del ticket donde leíste ese total, o null), "
    "fecha (YYYY-MM-DD o null), "
    "proveedor (el nombre del comercio, o null), "
    "categoria (la que mejor encaje entre: {categorias}, o null si ninguna encaja con confianza), "
    "legible (true/false, tu propia evaluación — no es definitoria, igual devolvé tu mejor lectura). "
    "Si la imagen no es un ticket, o un dato puntual no se ve, poné null en ESE campo. "
    "NUNCA inventes un monto ni una fecha: null es siempre preferible a un valor inventado."
)


class OpenAIVisionOCR:
    """Cliente de OCR de tickets vía OpenAI Vision. `leer_ticket(imagen_bytes)` -> dict crudo del
    modelo (sin validar contra el dominio — eso lo hace el caller, ver `gasto_desde_foto.py`)."""

    def __init__(self, *, model: str = DEFAULT_MODEL, api_key_env: str = "OPENAI_API_KEY",
                 url: str = DEFAULT_URL, timeout: float = 60.0,
                 categorias: tuple[str, ...] = ()):
        self.model = model
        self._api_key_env = api_key_env
        self._url = url
        self._timeout = timeout
        self._prompt = _PROMPT_BASE.format(categorias=", ".join(categorias) or "sin lista")

    def leer_ticket(self, imagen_bytes: bytes, *, content_type: str = "image/jpeg") -> dict:
        """Lee el ticket y devuelve el dict crudo (monto/evidencia_monto/fecha/proveedor/categoria/
        legible). Lanza si falta la key o falla la API (el caller decide qué HTTP status corresponde,
        mismo criterio que `GroqSTT.transcribe`). Respuesta no-JSON del modelo -> dict vacío (ningún
        campo se pre-carga, que es siempre el comportamiento seguro acá)."""
        key = os.environ.get(self._api_key_env)
        if not key:
            raise RuntimeError(f"falta {self._api_key_env} en el env del worker")
        data_uri = f"data:{content_type};base64,{base64.b64encode(imagen_bytes).decode()}"
        payload = {"model": self.model, "max_tokens": 300, "messages": [{"role": "user", "content": [
            {"type": "text", "text": self._prompt},
            {"type": "image_url", "image_url": {"url": data_uri}}]}]}
        req = urllib.request.Request(
            self._url, data=json.dumps(payload).encode(), method="POST",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                     "User-Agent": "uc-clinic-agent/1.0"})
        with urllib.request.urlopen(req, timeout=self._timeout) as resp:
            d = json.loads(resp.read().decode())
        texto = (d["choices"][0]["message"]["content"] or "").strip().strip("`")
        if texto.startswith("json"):
            texto = texto[4:]
        try:
            parsed = json.loads(texto)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
