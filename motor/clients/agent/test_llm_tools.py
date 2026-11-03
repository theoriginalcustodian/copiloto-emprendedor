import io
import json
import urllib.error

import pytest

from clients.agent.providers.llm import LlmProvider, NonRetryableError


class _FakeTransport:
    """Captura el payload y devuelve una respuesta canónica de tool-calling."""
    def __init__(self, response):
        self.response = response
        self.seen_payload = None

    def __call__(self, url, body, timeout):
        self.seen_payload = json.loads(body.decode())
        return self.response


def _provider(transport):
    p = LlmProvider(primary_model="gpt-4o-mini", failover_model="gpt-4o-mini", quantizations=())
    p._post = transport   # inyección del transporte (ver Step 3)
    return p


def test_complete_tools_forwards_tools_and_disables_parallel(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    resp = {"choices": [{"finish_reason": "tool_calls", "message": {"content": None, "tool_calls": [
        {"id": "call_1", "type": "function",
         "function": {"name": "mp_charge", "arguments": '{"amount": 5000}'}}]}}]}
    t = _FakeTransport(resp)
    out = _provider(t).complete_tools("sys", [{"role": "user", "content": "cobrá 5000"}],
                                      tools=[{"type": "function", "function": {"name": "mp_charge"}}])
    assert t.seen_payload["parallel_tool_calls"] is False
    assert t.seen_payload["tools"][0]["function"]["name"] == "mp_charge"
    assert out["tool_calls"][0]["name"] == "mp_charge"
    assert out["tool_calls"][0]["arguments"] == {"amount": 5000}   # deserializado
    assert out["finish_reason"] == "tool_calls"


def test_complete_tools_forwards_usage_for_metering(monkeypatch):
    """BETA-1b: el `usage` de OpenRouter viaja tal cual en el dict de salida (antes se descartaba)."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    resp = {"choices": [{"finish_reason": "stop", "message": {"content": "ok", "tool_calls": None}}],
           "usage": {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120}}
    out = _provider(_FakeTransport(resp)).complete_tools("sys", [{"role": "user", "content": "hola"}], tools=[])
    assert out["usage"] == {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120}


def test_complete_tools_sin_usage_en_la_respuesta_devuelve_dict_vacio(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    resp = {"choices": [{"finish_reason": "stop", "message": {"content": "ok", "tool_calls": None}}]}
    out = _provider(_FakeTransport(resp)).complete_tools("sys", [{"role": "user", "content": "hola"}], tools=[])
    assert out["usage"] == {}


def test_complete_tools_tool_choice_none_yields_text(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    resp = {"choices": [{"finish_reason": "stop",
                         "message": {"content": "Cancelado, no envié nada.", "tool_calls": None}}]}
    out = _provider(_FakeTransport(resp)).complete_tools(
        "sys", [{"role": "user", "content": "no"}], tools=[], tool_choice="none")
    assert out["tool_calls"] == []
    assert out["content"] == "Cancelado, no envié nada."


# ── gate-blocker #2: mapeo de errores no-retryable (401/insufficient_quota NO deben reintentar ∞) ──────────

def _http_error(code: int, body: dict) -> urllib.error.HTTPError:
    fp = io.BytesIO(json.dumps(body).encode())
    return urllib.error.HTTPError(url="https://openrouter.ai/api/v1/chat/completions",
                                  code=code, msg="error", hdrs=None, fp=fp)


class _RaisingOnceTransport:
    """Lanza SIEMPRE el mismo error (simula que el failover pega al mismo endpoint no-op)."""
    def __init__(self, error):
        self.calls = 0
        self._error = error

    def __call__(self, url, body, timeout):
        self.calls += 1
        raise self._error


class _FlakyThenOkTransport:
    """1ra llamada falla (error transitorio), 2da (failover) responde OK."""
    def __init__(self, error, ok_response):
        self.calls = 0
        self._error = error
        self._ok = ok_response

    def __call__(self, url, body, timeout):
        self.calls += 1
        if self.calls == 1:
            raise self._error
        return self._ok


def test_complete_tools_401_is_non_retryable_and_skips_failover(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    t = _RaisingOnceTransport(_http_error(401, {"error": {"code": "invalid_api_key"}}))
    with pytest.raises(NonRetryableError):
        _provider(t).complete_tools("sys", [{"role": "user", "content": "hola"}], tools=[])
    assert t.calls == 1   # NO intentó el failover (no-op de todos modos, pero no debe ni probar)


def test_complete_tools_429_insufficient_quota_is_non_retryable(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    t = _RaisingOnceTransport(_http_error(429, {"error": {"code": "insufficient_quota"}}))
    with pytest.raises(NonRetryableError):
        _provider(t).complete_tools("sys", [{"role": "user", "content": "hola"}], tools=[])
    assert t.calls == 1


def test_complete_tools_500_still_triggers_failover(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    resp = {"choices": [{"finish_reason": "stop", "message": {"content": "ok", "tool_calls": None}}]}
    t = _FlakyThenOkTransport(_http_error(500, {"error": {"code": "server_error"}}), resp)
    out = _provider(t).complete_tools("sys", [{"role": "user", "content": "hola"}], tools=[])
    assert t.calls == 2              # 1er intento falla, 2do (failover) responde
    assert out["failed_over"] is True
    assert out["content"] == "ok"


_RESP_OK = {"choices": [{"finish_reason": "stop", "message": {"content": "ok", "tool_calls": None}}]}


def test_modelo_actual_sigue_mandando_max_tokens_y_nada_de_razonamiento(monkeypatch):
    """El default de producción (gpt-4o-mini) NO cambia de payload: `max_tokens`, sin `reasoning_effort`."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    t = _FakeTransport(_RESP_OK)
    _provider(t).complete_tools("sys", [{"role": "user", "content": "hola"}], tools=[])
    assert t.seen_payload["max_tokens"] == 1500
    assert "max_completion_tokens" not in t.seen_payload and "reasoning_effort" not in t.seen_payload


def test_luna_usa_max_completion_tokens_y_razonamiento_none(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    t = _FakeTransport(_RESP_OK)
    p = LlmProvider(primary_model="gpt-6-luna", failover_model="gpt-6-luna", quantizations=())
    p._post = t
    p.complete_tools("sys", [{"role": "user", "content": "hola"}], tools=[])
    assert t.seen_payload["model"] == "gpt-6-luna"
    assert t.seen_payload["max_completion_tokens"] == 1500
    assert t.seen_payload["reasoning_effort"] == "none"
    assert "max_tokens" not in t.seen_payload and "temperature" not in t.seen_payload


def test_failover_de_otra_familia_reescribe_los_parametros(monkeypatch):
    """Primario Luna que falla -> failover gpt-4o-mini: el payload del segundo intento vuelve a `max_tokens`."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    vistos = []

    def transporte(url, body, timeout):
        vistos.append(json.loads(body.decode()))
        if len(vistos) == 1:
            raise urllib.error.URLError("caido")
        return _RESP_OK

    p = LlmProvider(primary_model="gpt-6-luna", failover_model="gpt-4o-mini", quantizations=())
    p._post = transporte
    out = p.complete_tools("sys", [{"role": "user", "content": "hola"}], tools=[])
    assert out["failed_over"] is True
    assert "max_completion_tokens" in vistos[0] and "max_tokens" not in vistos[0]
    assert vistos[1]["model"] == "gpt-4o-mini" and vistos[1]["max_tokens"] == 1500
    assert "max_completion_tokens" not in vistos[1] and "reasoning_effort" not in vistos[1]
