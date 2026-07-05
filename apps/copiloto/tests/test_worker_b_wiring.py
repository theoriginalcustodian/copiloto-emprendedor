"""Wiring del composition root multitenant de worker_b (Task 8).

NO arranca un worker/Temporal real: ejercita `build_worker_config` (función pura factorizada) y assertea
contra el registry de agent_runtime + el estado global de mp_refresh_activities. `conn_factory` nunca se
invoca durante el wiring (se guarda para cuando una query lo necesite) -> este test corre sin DB real."""
import sys
from pathlib import Path

import pytest

ARCH = Path(__file__).resolve().parents[3] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.agent.agent_runtime import get_channel, get_domain, reset_registry  # noqa: E402
from clients.agent.providers import mp_refresh_activities  # noqa: E402
from clients.agent.providers.crypto import FernetCrypto  # noqa: E402
from clients.agent.providers.mp_refresh_workflow import MpRefreshWorkflow  # noqa: E402

import worker_b  # noqa: E402


class _FakeCursor:
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, *a, **k):
        pass

    def fetchone(self):
        return None


class _FakeConn:
    def cursor(self):
        return _FakeCursor()


def _fake_conn_factory():
    """conn_factory FAKE (sin DB real): alcanza para probar el wiring, incl. que `context_factory(conv)`
    pueda resolver `first_seller_user_id()` (devuelve None -> tenant sin MP conectado) sin tocar Postgres."""
    return lambda: _FakeConn()


@pytest.fixture(autouse=True)
def _fernet_key(monkeypatch):
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())


def test_build_worker_config_registra_workflows_activities_context_y_refresh():
    reset_registry()
    cfg = worker_b.build_worker_config({}, _fake_conn_factory())

    assert MpRefreshWorkflow in cfg["workflows"]
    assert mp_refresh_activities.refresh_credential in cfg["activities"]

    dom = get_domain("emprendedor")
    assert dom["context_factory"] is not None                  # ctx SIEMPRE presente en prod (nunca None)
    assert callable(dom["dispatcher"])
    assert get_channel("web").name == "web"


def test_build_worker_config_cablea_set_refresh_deps_atado_al_tenant():
    reset_registry()
    worker_b.build_worker_config({}, _fake_conn_factory())

    assert mp_refresh_activities._store_factory is not None
    store = mp_refresh_activities._store_factory("C-A")
    assert store._cid == "C-A"


def test_build_worker_config_lee_mp_webhook_base_de_env_no_de_cliente_id():
    reset_registry()
    cfg = worker_b.build_worker_config({"MP_WEBHOOK_BASE": "https://copiloto.example"},
                                       _fake_conn_factory())
    ctx = cfg["context_factory"]({"cliente_id": "C-Z"})
    assert ctx.mp_webhook_base == "https://copiloto.example"
    assert ctx.cliente_id == "C-Z"
    assert ctx.composio_user_id == "C-Z"                        # per-request, nunca hardcodeado de env


def test_build_worker_config_registra_memory_provider_con_graphity_env():
    """Con GRAPHITY_* en el env: el dominio 'emprendedor' y el TenantCtx llevan el MemoryProvider, y las 2
    activities de memoria SIEMPRE se registran (evita el HANG si el workflow emite la command sin worker)."""
    reset_registry()
    from backend.agent.agent_activities import remember_memory, warm_memory  # noqa: PLC0415

    cfg = worker_b.build_worker_config(
        {"GRAPHITY_BASE_URL": "http://graphity.test", "GRAPHITY_API_KEY": "gphy_test"},
        _fake_conn_factory())

    assert get_domain("emprendedor")["memory_provider"] is not None
    assert warm_memory in cfg["activities"] and remember_memory in cfg["activities"]
    assert cfg["context_factory"]({"cliente_id": "C-M"}).memory_provider is not None


def test_build_worker_config_sin_graphity_env_deja_memoria_off_sin_crashear():
    """Sin GRAPHITY_*: memory_provider = None (OFF EXPLÍCITO, el worker arranca igual); las activities de
    memoria siguen registradas (no-op) → el test de wiring corre sin Graphity."""
    reset_registry()
    from backend.agent.agent_activities import remember_memory, warm_memory  # noqa: PLC0415

    cfg = worker_b.build_worker_config({}, _fake_conn_factory())

    assert get_domain("emprendedor")["memory_provider"] is None
    assert warm_memory in cfg["activities"] and remember_memory in cfg["activities"]


def test_wiring_registers_react_domain_and_activities():
    """Task 14: el dominio 'emprendedor' corre en engine_mode='react' con tool_executor + tool_schemas reales
    (mp_charge incluido), y el worker sirve las 3 activities del motor ReAct además de las de dispatch legacy
    (dispatch queda registrado como fallback -- byte-identical, ver tests de arriba -- pero el workflow usa
    el executor cuando engine_mode='react')."""
    reset_registry()
    from backend.agent.agent_activities import call_llm_tools, execute_tool, recall_memory  # noqa: PLC0415

    cfg = worker_b.build_worker_config({}, _fake_conn_factory())

    d = get_domain("emprendedor")
    assert d["engine_mode"] == "react"
    assert d["tool_executor"] is not None
    assert callable(d["dispatcher"])                          # fallback dispatch/tests legacy sigue vivo
    assert any(s["function"]["name"] == "mp_charge" for s in d["tool_schemas"])

    names = {getattr(a, "__name__", "") for a in cfg["activities"]}
    assert {"call_llm_tools", "execute_tool", "recall_memory"} <= names
    assert call_llm_tools in cfg["activities"] and execute_tool in cfg["activities"]
    assert recall_memory in cfg["activities"]
