"""Test de `register_domain`/`get_domain` con los kwargs aditivos del motor ReAct (Task 10).
Puro (sin Temporal ni deps del dominio) -> corre en PC o VPS. Cubre: default byte-identical ('dispatch',
tool_schemas/tool_executor=None) para los callers legacy, y el shape completo cuando un dominio opta a 'react'."""
from __future__ import annotations

from backend.agent.agent_runtime import register_domain, get_domain, reset_registry


def test_register_defaults_dispatch():
    reset_registry()
    register_domain("legacy", system_prompt="s", llm_provider=object(), dispatcher=lambda *a: None)
    d = get_domain("legacy")
    assert d["engine_mode"] == "dispatch"
    assert d["tool_schemas"] is None and d["tool_executor"] is None


def test_register_react_domain():
    reset_registry()
    register_domain("emp", system_prompt="s", llm_provider=object(), dispatcher=lambda *a: None,
                    engine_mode="react", tool_schemas=[{"x": 1}], tool_executor=lambda *a, **k: None)
    d = get_domain("emp")
    assert d["engine_mode"] == "react"
    assert d["tool_schemas"] == [{"x": 1}]
    assert callable(d["tool_executor"])
