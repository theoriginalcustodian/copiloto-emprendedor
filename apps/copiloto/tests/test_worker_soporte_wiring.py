"""Wiring del composition root del Agente de Soporte (SOP4, C1).

NO arranca Temporal real: ejercita `build_worker_config` (función pura) y assertea contra el registry
de `agent_runtime`. Mismo patrón que `test_worker_b_wiring.py` -- `conn_factory` FAKE, corre sin DB."""
import pytest

from backend.agent.agent_runtime import get_channel, get_domain, reset_registry  # noqa: E402

import worker_soporte  # noqa: E402
from soporte_store import COMO_USO_LA_APP, SOPORTE_TECNICO  # noqa: E402


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


def test_build_worker_config_registra_los_DOS_dominios():
    worker_soporte.build_worker_config({}, _fake_conn_factory())
    dom_tec = get_domain(SOPORTE_TECNICO)
    dom_app = get_domain(COMO_USO_LA_APP)
    assert dom_tec["engine_mode"] == "react"
    assert dom_app["engine_mode"] == "react"
    assert dom_tec["tool_schemas"] and dom_app["tool_schemas"]
    assert dom_tec["tool_executor"] is not None
    assert get_channel("web") is not None


def test_los_DOS_dominios_tienen_metering_sink_wireado():
    """I2 del DoD (SOP4): "costo por consulta medido sobre corridas reales". Antes de este fix los
    dos dominios se registraban con `metering_sink=None` (default de `register_domain`), así que
    ningún turno del agente de soporte dejaba fila en `copiloto_metering` -- mismo boundary que
    `worker_b` ya usa para 'emprendedor' (BETA-1b), sólo faltaba wireado acá."""
    worker_soporte.build_worker_config({}, _fake_conn_factory())
    dom_tec = get_domain(SOPORTE_TECNICO)
    dom_app = get_domain(COMO_USO_LA_APP)
    assert dom_tec["metering_sink"] is not None
    assert dom_app["metering_sink"] is not None
    # los DOS dominios comparten el MISMO sumidero (un solo `conn_factory`, igual que el LLM)
    assert dom_tec["metering_sink"] is dom_app["metering_sink"]


def test_los_DOS_dominios_comparten_tool_schemas_pero_NO_system_prompt():
    """C1: task_queue/workflow/toolset propios -- pero cada función tiene SU prompt (soporte técnico
    ofrece `buscar_mis_errores` como primer paso, cómo-uso-la-app no lo menciona)."""
    worker_soporte.build_worker_config({}, _fake_conn_factory())
    dom_tec = get_domain(SOPORTE_TECNICO)
    dom_app = get_domain(COMO_USO_LA_APP)
    assert dom_tec["system_prompt"] != dom_app["system_prompt"]
    assert dom_tec["tool_schemas"] == dom_app["tool_schemas"]


def test_system_prompt_de_soporte_NO_comparte_una_letra_con_el_de_emprendedor():
    """C1, evidencia literal del DoD: "un grep que muestre que no comparte prompt"."""
    import system_prompt as prompt_emprendedor
    from soporte_system_prompts import SYSTEM_PROMPT_COMO_USO_LA_APP, SYSTEM_PROMPT_SOPORTE_TECNICO

    frases_emprendedor = {
        frase.strip() for frase in prompt_emprendedor.SYSTEM_PROMPT_REACT.split(".") if len(frase.strip()) > 20}
    for prompt_soporte in (SYSTEM_PROMPT_SOPORTE_TECNICO, SYSTEM_PROMPT_COMO_USO_LA_APP):
        for frase in frases_emprendedor:
            assert frase not in prompt_soporte, f"frase compartida con 'emprendedor': {frase!r}"


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
