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


class NonRetryableError(RuntimeError):
    """Error de la API LLM que Temporal NO debe reintentar (401 `invalid_api_key` o 429 `insufficient_quota`):
    reintentar no lo arregla (la cuenta no tiene credencial/cupo válidos). El __name__ de esta clase es el
    string que se agrega a `RetryPolicy.non_retryable_error_types` de `LOOP_RETRY` (gate-blocker #2, Task 9)."""


def _is_non_retryable_http_error(e: urllib.error.HTTPError) -> bool:
    """401 siempre es invalid_api_key (no hay credencial que arreglar reintentando). 429 solo es no-retryable
    si el body indica insufficient_quota (un 429 de rate-limit genérico SÍ debe seguir el failover normal)."""
    if e.code == 401:
        return True
    if e.code == 429:
        try:
            body = json.loads(e.read().decode())
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            return False
        err = body.get("error") or {}
        return err.get("code") == "insufficient_quota" or err.get("type") == "insufficient_quota"
    return False


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

    def complete_tools(self, system: str, messages: list[dict], tools: list[dict], *,
                       tool_choice: str = "auto", parallel_tool_calls: bool = False) -> dict:
        """Tool-calling nativo. `messages` = scratchpad ReAct (roles user/assistant/tool). Devuelve los
        tool_calls (arguments ya deserializados) + content. `parallel_tool_calls=False` es MANDATORIO (gate):
        1 write por turno para que el confirm-gate sea secuencial. Failover operativo igual que complete(),
        salvo los errores marcados no-retryable (401/insufficient_quota) que se re-levantan sin reintentar."""
        if not os.environ.get(self._api_key_env):
            raise RuntimeError(f"falta {self._api_key_env} en el env del worker")
        full = [{"role": "system", "content": system}, *messages]
        payload = {"model": self.primary_model, "messages": full, "max_tokens": self._max_tokens,
                   "tools": tools, "tool_choice": tool_choice, "parallel_tool_calls": parallel_tool_calls}
        if self._quantizations:
            payload["provider"] = {"quantizations": self._quantizations}
        body = json.dumps(payload).encode()
        try:
            d = self._post(self._url, body, self._timeout)
            model, failed_over = self.primary_model, False
        except urllib.error.HTTPError as e:
            if _is_non_retryable_http_error(e):
                raise NonRetryableError(f"error no-retryable de la API LLM (status {e.code}): {e}") from e
            payload["model"] = self.failover_model
            d = self._post(self._url, json.dumps(payload).encode(), self._timeout)
            model, failed_over = self.failover_model, True
        except _API_ERRORS:
            payload["model"] = self.failover_model
            d = self._post(self._url, json.dumps(payload).encode(), self._timeout)
            model, failed_over = self.failover_model, True
        choice = (d.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        tool_calls = []
        for tc in (msg.get("tool_calls") or []):
            fn = tc.get("function") or {}
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except (ValueError, json.JSONDecodeError):
                args = {}
            tool_calls.append({"id": tc.get("id"), "name": fn.get("name"), "arguments": args})
        return {"tool_calls": tool_calls, "content": msg.get("content"),
                "finish_reason": choice.get("finish_reason") or "", "model": model, "failed_over": failed_over}

    # ── transporte (inyectable en test) ───────────────────────────────────────────────────────────
    def _post(self, url: str, body: bytes, timeout: float) -> dict:
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Authorization": f"Bearer {os.environ.get(self._api_key_env)}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())

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
