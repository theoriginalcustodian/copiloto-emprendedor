import sys
from pathlib import Path

from clients.agent.channels.web import WebChannelAdapter


def test_normalize_text():
    a = WebChannelAdapter(reply_sink=lambda *args: None)
    m = a.normalize_inbound({"session_id": "s1", "text": "hola", "kind": "text"})
    assert (m.channel, m.channel_ref, m.text, m.kind) == ("web", "s1", "hola", "text")


def test_normalize_callback():
    a = WebChannelAdapter(reply_sink=lambda *args: None)
    m = a.normalize_inbound({"session_id": "s1", "text": "confirm", "kind": "callback"})
    assert m.kind == "callback" and m.text == "confirm"


def test_normalize_rejects_empty():
    a = WebChannelAdapter(reply_sink=lambda *args: None)
    assert a.normalize_inbound({"session_id": "s1", "text": "  ", "kind": "text"}) is None
    assert a.normalize_inbound({"text": "x"}) is None        # sin session_id


def test_send_invokes_sink_with_cliente_id_choices_and_card():
    seen = []
    a = WebChannelAdapter(
        reply_sink=lambda cid, ref, text, choices, card: seen.append((cid, ref, text, choices, card)))
    out = a.send("s1", "listo", [{"label": "Confirmar", "value": "confirm"}], cliente_id="cid-A",
                 card={"service": "gmail", "label": "Gmail"})
    assert out == {"sent": True}
    assert seen == [("cid-A", "s1", "listo", [{"label": "Confirmar", "value": "confirm"}],
                     {"service": "gmail", "label": "Gmail"})]


def test_send_accepts_no_choices_no_cliente_id_no_card():    # todo keyword-only opcional (backward-compat)
    a = WebChannelAdapter(reply_sink=lambda cid, ref, text, choices, card: None)
    assert a.send("s1", "hola", None) == {"sent": True}      # sin card -> el sink recibe None
