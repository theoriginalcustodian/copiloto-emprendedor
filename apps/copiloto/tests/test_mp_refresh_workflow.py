import sys, uuid
from pathlib import Path
import pytest
from temporalio.client import Client
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

ARCH = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
from clients.agent.providers.mp_refresh_activities import refresh_credential, set_refresh_deps  # noqa: E402
from clients.agent.providers.mp_refresh_workflow import MpRefreshWorkflow  # noqa: E402


class _FakeGateway:
    def __init__(self): self.calls = 0
    def refresh(self, rt):
        self.calls += 1
        return {"access_token": f"AT{self.calls}", "refresh_token": f"RT{self.calls}", "expires_in": 15552000}


class _FakeStore:
    def __init__(self): self.tokens = {"access_token": "AT0", "refresh_token": "RT0", "expires_at": 1}
    def get(self, seller): return dict(self.tokens)
    def update_tokens(self, seller, *, access_token, refresh_token, expires_at):
        self.tokens = {"access_token": access_token, "refresh_token": refresh_token, "expires_at": expires_at}


@pytest.mark.asyncio
async def test_refresh_loop_rotates_and_persists():
    gw, store = _FakeGateway(), _FakeStore()
    set_refresh_deps(gw, lambda cid: store)
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="mp-refresh-test",
                          workflows=[MpRefreshWorkflow], activities=[refresh_credential]):
            out = await env.client.execute_workflow(
                MpRefreshWorkflow.run, args=[str(uuid.uuid4()), "s1", 60.0, 3, False],  # loop_forever=False
                id=f"mp-refresh-{uuid.uuid4()}", task_queue="mp-refresh-test")
    assert gw.calls == 3                       # refrescó 3 ciclos (los sleeps se saltaron)
    assert store.tokens["refresh_token"] == "RT3"   # persistió el par rotado
    assert out["cycles"] == 3 and out["outcome"] == "active"
