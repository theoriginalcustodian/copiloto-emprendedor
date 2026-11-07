"""El router del PRIMER paso (2026-11-06): un modelo rápido (Groq gpt-oss-120b) elige la tool; todo lo
demás, y cualquier falla del rápido, va al principal. Sin red: cada `LlmProvider` tiene su `_post` falso."""
import urllib.error

import pytest

import worker_b
from clients.agent.providers.llm import LlmProvider, RouterPrimerPaso

_TOOL = {"choices": [{"finish_reason": "tool_calls", "message": {"tool_calls": [
    {"id": "1", "function": {"name": "consultar_negocio", "arguments": '{"consulta":"portada"}'}}]}}]}
_TEXTO = {"choices": [{"finish_reason": "stop", "message": {"content": "listo"}}]}


class _Prov(LlmProvider):
    def __init__(self, modelo, respuestas):
        super().__init__(primary_model=modelo, failover_model=modelo, api_key_env="K_FALSA", quantizations=())
        self.respuestas, self.llamadas = list(respuestas), []

    def _post(self, url, body, timeout):
        self.llamadas.append(body)
        r = self.respuestas.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


@pytest.fixture(autouse=True)
def _key(monkeypatch):
    monkeypatch.setenv("K_FALSA", "x")


def _router(rapido, principal, fallbacks=None):
    return RouterPrimerPaso(rapido, principal,
                            on_fallback=(lambda m, motivo: fallbacks.append(motivo)) if fallbacks is not None else None)


def test_el_primer_paso_va_al_rapido_y_no_toca_el_principal():
    rapido, principal = _Prov("openai/gpt-oss-120b", [_TOOL]), _Prov("gpt-6-luna", [])
    r = _router(rapido, principal).complete_tools("sys", [{"role": "user", "content": "hola"}], [])
    assert r["model"] == "openai/gpt-oss-120b" and r["tool_calls"][0]["name"] == "consultar_negocio"
    assert principal.llamadas == []


def test_despues_de_la_tool_redacta_el_principal():
    rapido, principal = _Prov("openai/gpt-oss-120b", []), _Prov("gpt-6-luna", [_TEXTO])
    msgs = [{"role": "user", "content": "hola"}, {"role": "tool", "content": "{}", "tool_call_id": "1"}]
    r = _router(rapido, principal).complete_tools("sys", msgs, [])
    assert r["model"] == "gpt-6-luna" and rapido.llamadas == []


@pytest.mark.parametrize("falla, motivo", [
    (urllib.error.URLError("caido"), "URLError"),
    ({"choices": [{"finish_reason": "error", "message": {}}]}, "finish_reason=error"),
    ({"choices": [{"finish_reason": "stop", "message": {"content": "  "}}]}, "vacia"),
])
def test_cualquier_falla_del_rapido_cae_al_principal(falla, motivo):
    # El rápido tiene su propio failover (mismo modelo): la excepción de transporte se repite 2 veces.
    rapido = _Prov("openai/gpt-oss-120b", [falla, falla] if isinstance(falla, Exception) else [falla])
    principal, avisos = _Prov("gpt-6-luna", [_TOOL]), []
    r = _router(rapido, principal, avisos).complete_tools("sys", [{"role": "user", "content": "hola"}], [])
    assert r["model"] == "gpt-6-luna" and r["failed_over"] is True and r["tool_calls"]
    assert avisos == [motivo]


def test_401_del_rapido_tampoco_corta_el_turno():
    err = urllib.error.HTTPError("u", 401, "unauthorized", {}, None)
    rapido, principal = _Prov("openai/gpt-oss-120b", [err]), _Prov("gpt-6-luna", [_TOOL])
    r = _router(rapido, principal).complete_tools("sys", [{"role": "user", "content": "hola"}], [])
    assert r["model"] == "gpt-6-luna"


def test_gpt_oss_manda_reasoning_effort_low_y_gpt6_none():
    import json
    rapido, principal = _Prov("openai/gpt-oss-120b", [_TOOL]), _Prov("gpt-6-luna", [_TOOL])
    rapido.complete_tools("s", [{"role": "user", "content": "x"}], [])
    principal.complete_tools("s", [{"role": "user", "content": "x"}], [])
    assert json.loads(rapido.llamadas[0])["reasoning_effort"] == "low"
    assert json.loads(principal.llamadas[0])["reasoning_effort"] == "none"


def test_sin_el_flag_el_camino_es_el_de_siempre():
    llm = worker_b.build_llm({"COPILOTO_LLM_MODEL": "gpt-6-luna"})
    assert type(llm) is LlmProvider and llm.primary_model == "gpt-6-luna"
    assert type(worker_b.build_llm({"COPILOTO_LLM_MODEL": "gpt-6-luna", "COPILOTO_LLM_ROUTER_MODEL": " "})) \
        is LlmProvider


def test_con_el_flag_arma_el_router_contra_groq():
    llm = worker_b.build_llm({"COPILOTO_LLM_MODEL": "gpt-6-luna", "COPILOTO_LLM_ROUTER_MODEL": "openai/gpt-oss-120b"})
    assert isinstance(llm, RouterPrimerPaso)
    assert llm.rapido.primary_model == "openai/gpt-oss-120b" and llm.rapido._url == worker_b.GROQ_URL
    assert llm.rapido._api_key_env == "GROQ_API_KEY" and llm.principal.primary_model == "gpt-6-luna"
    assert llm.primary_model == "gpt-6-luna"


def test_la_key_con_crlf_no_rompe_el_header(monkeypatch):
    """EnvironmentFile con CRLF: `\\r` al final de la key → http.client rechazaba el header entero."""
    monkeypatch.setenv("K_CR", "abc\r")
    p = LlmProvider(api_key_env="K_CR", url="http://127.0.0.1:9/x", quantizations=(), timeout=0.5)
    with pytest.raises(urllib.error.URLError):   # llega a conectar: el header ya no es el problema
        p._post(p._url, b"{}", 0.5)
