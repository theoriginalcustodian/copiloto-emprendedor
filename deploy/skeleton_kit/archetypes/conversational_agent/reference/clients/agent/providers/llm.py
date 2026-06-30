"""LlmProvider — cerebro del agente (capa PLANTILLA, agnostica del dominio).

Patron A-1 (adapter): el motor depende de ESTE contrato, no de un proveedor concreto. Hoy OpenRouter/DeepSeek;
manana otro proveedor se enchufa cambiando solo este archivo. Reusa el patron de llamada de la fabrica
(deploy/worker/activities.py `_openrouter`): mismos URL/headers/body/quantizations.

FAILOVER OPERATIVO (no cognitivo): primary=Flash; si la llamada a la API FALLA (timeout / HTTP 5xx / 429 /
error de conexion) se rutea al failover=Pro. NO es una escalacion por dificultad del problema: la ambiguedad
cognitiva la maneja el motor escalando a un humano (HITL). Pro como failover existe para sobrevivir una caida
transitoria de la API de Flash, no para "pensar mejor".

SYNC a proposito: se invoca desde una activity de Temporal via asyncio.to_thread (igual que `infer` en la
fabrica). Cero secretos: la API key se lee del env (OPENROUTER_API_KEY).
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

# Errores de TRANSPORTE/API que disparan el failover operativo (NO errores de contenido del modelo).
_API_ERRORS = (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ConnectionError, OSError)

DEFAULT_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_PRIMARY = "deepseek/deepseek-v4-flash"
DEFAULT_FAILOVER = "deepseek/deepseek-v4-pro"


class LlmProvider:
    """Cliente LLM con failover operativo. `complete()` es la unica superficie que el motor usa."""

    def __init__(self, primary_model: str = DEFAULT_PRIMARY, failover_model: str = DEFAULT_FAILOVER,
                 *, api_key_env: str = "OPENROUTER_API_KEY", url: str = DEFAULT_URL,
                 max_tokens: int = 1500, timeout: float = 90.0, quantizations=("fp8",)):
        self.primary_model = primary_model
        self.failover_model = failover_model
        self._api_key_env = api_key_env
        self._url = url
        self._max_tokens = max_tokens
        self._timeout = timeout
        self._quantizations = list(quantizations)

    # ── superficie publica ───────────────────────────────────────────────────────────────────────
    def complete(self, system: str, user: str, *, history: list[dict] | None = None,
                 json_mode: bool = True) -> dict:
        """Llama al primary; ante falla de API rutea al failover. Devuelve
        {'raw': <texto crudo>, 'parsed': <dict|None>, 'model': <id usado>, 'failed_over': <bool>}.
        `parsed` es el JSON del modelo si json_mode y se pudo extraer; si no, None (el caller decide).
        El parseo fallido NO dispara failover (no es falla de API)."""
        try:
            raw = self._call_openrouter(self.primary_model, system, user, history)
            model, failed_over = self.primary_model, False
        except _API_ERRORS:
            raw = self._call_openrouter(self.failover_model, system, user, history)  # falla de API -> failover
            model, failed_over = self.failover_model, True
        parsed = self._extract_json(raw) if json_mode else None
        return {"raw": raw, "parsed": parsed, "model": model, "failed_over": failed_over}

    # ── interno (mockeable en test) ──────────────────────────────────────────────────────────────
    def _call_openrouter(self, model: str, system: str, user: str, history: list[dict] | None) -> str:
        key = os.environ.get(self._api_key_env)
        if not key:
            raise RuntimeError(f"falta {self._api_key_env} en el env del worker")
        messages = [{"role": "system", "content": system}]
        if history:
            messages.extend(history)            # [{role:'user'|'assistant', content:...}, ...]
        messages.append({"role": "user", "content": user})
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": self._max_tokens,
        }
        if self._quantizations:                      # OpenRouter-only; OpenAI rechaza 'provider'
            payload["provider"] = {"quantizations": self._quantizations}
        body = json.dumps(payload).encode()
        req = urllib.request.Request(self._url, data=body, method="POST", headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=self._timeout) as resp:
            d = json.loads(resp.read().decode())
        return ((d.get("choices") or [{}])[0].get("message") or {}).get("content") or ""

    @staticmethod
    def _extract_json(text: str) -> dict | None:
        """Extrae el primer objeto JSON de la respuesta (tolera markdown fences). None si no hay JSON valido."""
        if not text:
            return None
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text
            if text.rstrip().endswith("```"):
                text = text.rstrip()[:-3]
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1 or end < start:
            return None
        try:
            return json.loads(text[start:end + 1])
        except (ValueError, json.JSONDecodeError):
            return None
