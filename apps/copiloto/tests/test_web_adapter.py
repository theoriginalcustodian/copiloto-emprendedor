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
        reply_sink=lambda cid, ref, text, choices, card, *, idem_key=None:
        seen.append((cid, ref, text, choices, card)))
    out = a.send("s1", "listo", [{"label": "Confirmar", "value": "confirm"}], cliente_id="cid-A",
                 card={"service": "gmail", "label": "Gmail"})
    assert out == {"sent": True}
    assert seen == [("cid-A", "s1", "listo", [{"label": "Confirmar", "value": "confirm"}],
                     {"service": "gmail", "label": "Gmail"})]


def test_send_pasa_la_idem_key_al_sink():
    """El adapter no la inventa ni la ignora: la reenvía. Quien la genera es la activity, que es la
    que se reintenta — el adapter no tiene forma de saber si esta llamada es un reintento."""
    seen = []
    a = WebChannelAdapter(
        reply_sink=lambda cid, ref, text, choices, card, *, idem_key=None: seen.append(idem_key))

    a.send("s1", "listo", None, cliente_id="cid-A", idem_key="wf-1:run-1:5")
    a.send("s1", "otro", None, cliente_id="cid-A")          # sin clave: sigue funcionando

    assert seen == ["wf-1:run-1:5", None]


def test_send_accepts_no_choices_no_cliente_id_no_card():    # todo keyword-only opcional (backward-compat)
    a = WebChannelAdapter(reply_sink=lambda cid, ref, text, choices, card, *, idem_key=None: None)
    assert a.send("s1", "hola", None) == {"sent": True}      # sin card -> el sink recibe None
