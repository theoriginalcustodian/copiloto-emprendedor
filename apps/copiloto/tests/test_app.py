import sys
from pathlib import Path
ARCH = Path(__file__).resolve().parents[3] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

import app as app_module
from clients.agent.channels.web import WebChannelAdapter


class _FakeTemporal:
    def __init__(self): self.signals = []


async def _fake_route(client, *, adapter, cliente_id, domain, task_queue, raw_update):
    msg = adapter.normalize_inbound(raw_update)
    assert msg is not None
    return f"conv-web-{cliente_id}-{msg.channel_ref}"


def test_chat_accepts_and_returns_wf_id(monkeypatch):
    monkeypatch.setattr(app_module, "route_inbound", _fake_route)
    replies_store = {"rows": [{"id": 1, "reply_text": "hola", "choices": None, "created_at": "t"}]}
    a = app_module.create_app(
        temporal_client=_FakeTemporal(),
        adapter=WebChannelAdapter(reply_sink=lambda *x: None),
        cliente_id="cid-1",
        read_replies_fn=lambda sess, after: [r for r in replies_store["rows"] if r["id"] > after])
    c = TestClient(a)
    r = c.post("/chat", json={"session_id": "s1", "text": "agendá algo"})
    assert r.status_code == 200 and r.json()["wf_id"] == "conv-web-cid-1-s1"


def test_reply_long_poll_returns_after_cursor(monkeypatch):
    monkeypatch.setattr(app_module, "route_inbound", _fake_route)
    rows = [{"id": 1, "reply_text": "a", "choices": None, "created_at": "t"},
            {"id": 2, "reply_text": "b", "choices": None, "created_at": "t"}]
    a = app_module.create_app(temporal_client=_FakeTemporal(),
                              adapter=WebChannelAdapter(reply_sink=lambda *x: None), cliente_id="cid-1",
                              read_replies_fn=lambda sess, after: [r for r in rows if r["id"] > after])
    c = TestClient(a)
    r = c.get("/reply", params={"session_id": "s1", "after_id": 1})
    body = r.json()
    assert [x["reply_text"] for x in body["replies"]] == ["b"] and body["next_id"] == 2
