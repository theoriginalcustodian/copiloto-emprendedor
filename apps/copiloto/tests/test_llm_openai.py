import json
import os
import sys
from pathlib import Path

import pytest

# arquetipo importable

from clients.agent.providers.llm import LlmProvider


def _captured_body(provider, monkeypatch):
    seen = {}
    def fake_urlopen(req, timeout=None):
        seen["body"] = json.loads(req.data.decode())
        class _R:
            def __enter__(self_): return self_
            def __exit__(self_, *a): return False
            def read(self_): return json.dumps(
                {"choices": [{"message": {"content": '{"action":"book","entities":{},"reply_es":"ok"}'}}]}).encode()
        return _R()
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    provider.complete("sys", "user")
    return seen["body"]


def test_openai_body_omits_provider_field(monkeypatch):
    p = LlmProvider(primary_model="gpt-4o-mini", failover_model="gpt-4o-mini",
                    api_key_env="OPENAI_API_KEY", url="https://api.openai.com/v1/chat/completions",
                    quantizations=())
    body = _captured_body(p, monkeypatch)
    assert "provider" not in body            # OpenAI rechaza 'provider'
    assert body["model"] == "gpt-4o-mini"


def test_openrouter_body_keeps_provider(monkeypatch):
    p = LlmProvider(quantizations=("fp8",))  # defaults OpenRouter
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    body = _captured_body(p, monkeypatch)
    assert body["provider"] == {"quantizations": ["fp8"]}   # A (clínica) intacto


@pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"), reason="sin OPENAI_API_KEY")
def test_gpt4o_mini_emits_parseable_json_real():
    p = LlmProvider(primary_model="gpt-4o-mini", failover_model="gpt-4o-mini",
                    api_key_env="OPENAI_API_KEY", url="https://api.openai.com/v1/chat/completions",
                    quantizations=())
    sysmsg = ('Sos un asistente. Respondé SOLO un objeto JSON con las claves '
              '"action","entities","reply_es". action debe ser "book" si el usuario quiere agendar algo.')
    out = p.complete(sysmsg, "agendá una reunión con Juan el jueves a las 15")
    assert isinstance(out["parsed"], dict), f"no parseó JSON: {out['raw']!r}"
    assert out["parsed"].get("action") == "book"
