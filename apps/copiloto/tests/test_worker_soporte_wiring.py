"""Wiring del composition root del Agente de Soporte (SOP4, C1).

NO arranca Temporal real: ejercita `build_worker_config` (función pura) y assertea contra el registry
de `agent_runtime`. Mismo patrón que `test_worker_b_wiring.py` -- `conn_factory` FAKE, corre sin DB."""
import pytest

from backend.agent.agent_runtime import get_channel, get_domain, reset_registry  # noqa: E402

import worker_soporte  # noqa: E402
from soporte_store import SOPORTE_TECNICO  # noqa: E402


class _FakeConn:
    def cursor(self):
        raise AssertionError("build_worker_config no debe tocar la DB durante el wiring")


def _fake_conn_factory():
    return lambda: _FakeConn()


@pytest.fixture(autouse=True)
def _reset():
    reset_registry()
    yield
    reset_registry()


def test_build_worker_config_registra_UN_dominio():
    """DoD versionado (PR #357, §F0): `domain`/`task_queue` son constantes DEL SERVIDOR -- un solo
    domain 'soporte_tecnico', no dos. La distinción soporte-técnico-vs-cómo-uso-la-app (MAESTRO §9.1)
    la resuelve el agente al elegir `canal` en `crear_ticket_de_soporte`, no el wiring de Temporal."""
    worker_soporte.build_worker_config({}, _fake_conn_factory())
    dom = get_domain(SOPORTE_TECNICO)
    assert dom["engine_mode"] == "react"
    assert dom["tool_schemas"]
    assert dom["tool_executor"] is not None
    assert get_channel("web") is not None


def test_system_prompt_de_soporte_NO_comparte_una_letra_con_el_de_emprendedor():
    """C1, evidencia literal del DoD: "un grep que muestre que no comparte prompt"."""
    import system_prompt as prompt_emprendedor
    from soporte_system_prompts import SYSTEM_PROMPT_SOPORTE

    frases_emprendedor = {
        frase.strip() for frase in prompt_emprendedor.SYSTEM_PROMPT_REACT.split(".") if len(frase.strip()) > 20}
    for frase in frases_emprendedor:
        assert frase not in SYSTEM_PROMPT_SOPORTE, f"frase compartida con 'emprendedor': {frase!r}"


def test_dispatcher_es_None_este_domain_nunca_corre_engine_mode_dispatch():
    worker_soporte.build_worker_config({}, _fake_conn_factory())
    assert get_domain(SOPORTE_TECNICO)["dispatcher"] is None


def test_sin_GRAPHITY_CODE_env_el_worker_ARRANCA_igual_grafo_apagado():
    """Apagado explícito (mismo criterio que `SoporteClasificador.from_env`), no un crash. Verificado
    indirectamente: build_worker_config no lanza con env vacío."""
    cfg = worker_soporte.build_worker_config({}, _fake_conn_factory())
    assert cfg["workflows"] and cfg["activities"]


def test_sin_RAG_ORQUESTADOR_env_el_worker_ARRANCA_y_la_tool_degrada_a_unavailable():
    """El agente ARRANCA sin el token (contrato SOP4: llega por canal de secretos aparte). La tool
    de KB debe degradar a outcome=unavailable, no lanzar -- lo prueba `test_soporte_agent_tools.py`."""
    worker_soporte.build_worker_config({}, _fake_conn_factory())
    dom = get_domain(SOPORTE_TECNICO)
    executor = dom["tool_executor"]
    from soporte_context import SoporteCtx
    r = executor("consultar_base_de_conocimiento", {"pregunta": "¿cómo emito una factura?"},
                SoporteCtx(cliente_id="x"), confirmed=False, idem_key="t1")
    assert r.status == "ok"
    assert r.observation["outcome"] == "unavailable"
