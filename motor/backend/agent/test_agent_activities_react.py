"""Test de las activities GENERICAS del motor ReAct (Task 9): `call_llm_tools`, `execute_tool`, `recall_memory`.
Puro (fakes por el registry, sin Temporal Worker real) -> corre en PC o VPS. Los errores de negocio del
executor NUNCA se propagan como excepcion (leccion PR #114: retry ilimitado cuelga el turno)."""
from __future__ import annotations

import asyncio

from backend.agent import agent_activities as A
from backend.agent.agent_runtime import register_channel, register_domain, register_stt_provider, reset_registry


class _Prov:
    def complete_tools(self, system, messages, tools, *, tool_choice="auto", parallel_tool_calls=False):
        return {"tool_calls": [{"id": "c1", "name": "gmail_fetch", "arguments": {}}],
                "content": None, "finish_reason": "tool_calls", "model": "m", "failed_over": False,
                "usage": {"total_tokens": 123}}


def _reg(tool_executor=None, memory_provider=None, metering_sink=None):
    reset_registry()
    register_domain("d", system_prompt="SYS", llm_provider=_Prov(), dispatcher=lambda *a: None,
                    tool_schemas=[{"type": "function", "function": {"name": "gmail_fetch"}}],
                    tool_executor=tool_executor, context_factory=lambda conv: object(), engine_mode="react",
                    memory_provider=memory_provider, metering_sink=metering_sink)


def test_call_llm_tools_uses_registry_schemas():
    _reg()
    out = asyncio.run(A.call_llm_tools({"domain": "d", "messages": [{"role": "user", "content": "hola"}],
                                        "tool_choice": "auto"}))
    assert out["tool_calls"][0]["name"] == "gmail_fetch"


def test_execute_tool_calls_domain_executor():
    seen = {}
    def _ex(name, arguments, ctx, *, confirmed, idem_key):
        seen.update(name=name, confirmed=confirmed, idem_key=idem_key)
        from backend.agent.types import ToolResult
        return ToolResult(tool_call_id=idem_key, observation={"ok": True})
    _reg(tool_executor=_ex)
    out = asyncio.run(A.execute_tool({"domain": "d", "name": "gmail_send", "arguments": {"to": "a@b"},
                                      "conv": {"cliente_id": "42"}, "confirmed": True, "idem_key": "r-1"}))
    assert seen == {"name": "gmail_send", "confirmed": True, "idem_key": "r-1"}
    assert out["observation"]["ok"] is True


def test_execute_tool_without_executor_returns_error_not_exception():
    """Dominio sin tool_executor (ej registrado en modo dispatch legacy) -> observacion de error, nunca excepcion."""
    _reg(tool_executor=None)
    out = asyncio.run(A.execute_tool({"domain": "d", "name": "gmail_send", "arguments": {},
                                      "conv": {}, "confirmed": False, "idem_key": "r-2"}))
    assert out["status"] == "error"
    assert out["tool_call_id"] == "r-2"


def test_recall_memory_no_provider_is_noop():
    _reg(memory_provider=None)
    out = asyncio.run(A.recall_memory({"domain": "d", "cliente_id": "42", "thread_ref": "t", "query": "hola"}))
    assert out == {"context": ""}


def test_recall_memory_uses_provider_recall():
    class _Mem:
        def recall(self, cliente_id, thread_ref, query):
            return f"ctx:{cliente_id}:{thread_ref}:{query}"
    _reg(memory_provider=_Mem())
    out = asyncio.run(A.recall_memory({"domain": "d", "cliente_id": "42", "thread_ref": "t", "query": "hola"}))
    assert out == {"context": "ctx:42:t:hola"}


def test_recall_memory_degrades_on_exception():
    class _Mem:
        def recall(self, cliente_id, thread_ref, query):
            raise RuntimeError("graphity caido")
    _reg(memory_provider=_Mem())
    out = asyncio.run(A.recall_memory({"domain": "d", "cliente_id": "42", "thread_ref": "t", "query": "hola"}))
    assert out == {"context": ""}


# --- metering_sink (BETA-1b) -------------------------------------------------------

def test_call_llm_tools_sin_metering_sink_no_revienta():
    """None (default) -> comportamiento actual, sin cambios."""
    _reg(metering_sink=None)
    out = asyncio.run(A.call_llm_tools({"domain": "d", "messages": [], "cliente_id": "42",
                                        "session_id": "s1"}))
    assert out["tool_calls"][0]["name"] == "gmail_fetch"


def test_call_llm_tools_registra_evento_llm_turno():
    seen = []
    _reg(metering_sink=lambda *a: seen.append(a))
    asyncio.run(A.call_llm_tools({"domain": "d", "messages": [], "cliente_id": "42", "session_id": "s1"}))
    assert seen == [("42", "s1", "m", 123, "llm_turno")]


class _ProvCortadoPorLength:
    """`finish_reason='length'` -- el LLM cortó por max_tokens (pedido planificación 2026-08-09)."""
    def complete_tools(self, system, messages, tools, *, tool_choice="auto", parallel_tool_calls=False):
        return {"tool_calls": [], "content": "respuesta a mitad de frase", "finish_reason": "length",
                "model": "m", "failed_over": False, "usage": {"total_tokens": 1500}}


def test_call_llm_tools_loguea_finish_reason_para_medir_cortes_por_length(capsys):
    """DoD del pedido: un grep sobre el journal del worker devuelve líneas con `finish_reason` tras un
    turno real. `print` (no `activity.logger`) -- mismo criterio que `STT_TRANSCRIPT`: sin `basicConfig`
    sólo `warning+` llega a journald, y esto es una métrica de cada turno, no un warning."""
    reset_registry()
    register_domain("d", system_prompt="SYS", llm_provider=_ProvCortadoPorLength(),
                    dispatcher=lambda *a: None, tool_schemas=[], tool_executor=None,
                    context_factory=lambda conv: object(), engine_mode="react")
    asyncio.run(A.call_llm_tools({"domain": "d", "messages": [], "cliente_id": "42", "session_id": "s1"}))
    salida = capsys.readouterr().out
    assert "LLM_TURNO" in salida and '"finish_reason": "length"' in salida


def test_call_llm_tools_sin_cliente_id_no_registra():
    """El sink existe pero no hay tenant que atribuirle el evento -- no se llama (mismo criterio que
    perfil_provider: sin cliente_id no hay a quién cargarle nada)."""
    seen = []
    _reg(metering_sink=lambda *a: seen.append(a))
    asyncio.run(A.call_llm_tools({"domain": "d", "messages": [], "session_id": "s1"}))
    assert seen == []


def test_call_llm_tools_metering_sink_que_revienta_no_rompe_el_turno():
    def _sink(*a):
        raise RuntimeError("db caida")
    _reg(metering_sink=_sink)
    out = asyncio.run(A.call_llm_tools({"domain": "d", "messages": [], "cliente_id": "42",
                                        "session_id": "s1"}))
    assert out["tool_calls"][0]["name"] == "gmail_fetch"   # el turno sigue andando


def test_execute_tool_registra_evento_tool_call_ok():
    seen = []
    def _ex(name, arguments, ctx, *, confirmed, idem_key):
        from backend.agent.types import ToolResult
        return ToolResult(tool_call_id=idem_key, observation={"ok": True})
    _reg(tool_executor=_ex, metering_sink=lambda *a: seen.append(a))
    asyncio.run(A.execute_tool({"domain": "d", "name": "gmail_send", "arguments": {},
                                "conv": {"cliente_id": "42", "channel_ref": "s1"},
                                "confirmed": True, "idem_key": "r-1"}))
    assert seen == [("42", "s1", "tool:gmail_send", None, "tool_call:ok")]


def test_execute_tool_registra_evento_tool_call_error_para_dashboard_de_error_rate():
    seen = []
    def _ex(name, arguments, ctx, *, confirmed, idem_key):
        from backend.agent.types import ToolResult
        return ToolResult(tool_call_id=idem_key, status="error", observation={"error": "boom"})
    _reg(tool_executor=_ex, metering_sink=lambda *a: seen.append(a))
    asyncio.run(A.execute_tool({"domain": "d", "name": "gmail_send", "arguments": {},
                                "conv": {"cliente_id": "42", "channel_ref": "s1"},
                                "confirmed": True, "idem_key": "r-1"}))
    assert seen == [("42", "s1", "tool:gmail_send", None, "tool_call:error")]


class _CanalFake:
    def download_file(self, file_id):
        return b"audio-bytes-simulados"


class _SttFake:
    def transcribe(self, audio):
        return "quiero cancelar mi pedido del martes"


def test_transcribe_voice_no_expone_texto_crudo_por_default(capsys, monkeypatch):
    """Control negativo del gate PII (B1, lote higiene): sin `COPILOTO_LOG_STT_TEXT`, `STT_TRANSCRIPT`
    NO lleva el texto transcripto -- puede traer lo que el cliente dijo. Sólo `chars` (longitud)."""
    monkeypatch.delenv("COPILOTO_LOG_STT_TEXT", raising=False)
    reset_registry()
    register_channel("tg", _CanalFake())
    register_stt_provider(_SttFake())
    asyncio.run(A.transcribe_voice({"channel": "tg", "file_id": "f-1"}))
    salida = capsys.readouterr().out
    assert "STT_TRANSCRIPT" in salida
    assert "cancelar mi pedido" not in salida
    assert '"chars": 38' in salida


def test_transcribe_voice_expone_texto_con_env_explicita(capsys, monkeypatch):
    """Con `COPILOTO_LOG_STT_TEXT=1` (opt-in explícito), el texto SÍ viaja -- caso de debug puntual,
    no el default de producción."""
    monkeypatch.setenv("COPILOTO_LOG_STT_TEXT", "1")
    reset_registry()
    register_channel("tg", _CanalFake())
    register_stt_provider(_SttFake())
    asyncio.run(A.transcribe_voice({"channel": "tg", "file_id": "f-1"}))
    salida = capsys.readouterr().out
    assert "cancelar mi pedido" in salida
