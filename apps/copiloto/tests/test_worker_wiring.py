import sys
from pathlib import Path
ARCH = Path(__file__).resolve().parents[3] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.agent.agent_runtime import reset_registry, get_domain, get_channel
import worker_b


class _GwStub:
    def execute(self, *a, **k): return {"successful": True}


def test_build_registrations_wires_domain_and_channel():
    reset_registry()
    worker_b.build_registrations(gateway=_GwStub(), reply_sink=lambda *a: None,
                                 composio_user_id="u1", now_iso_provider=lambda: "2026-07-01T10:00:00-03:00")
    dom = get_domain("emprendedor")
    assert dom["system_prompt"] and callable(dom["dispatcher"])
    assert dom["llm_provider"].primary_model == "gpt-4o-mini"
    assert get_channel("web").name == "web"
