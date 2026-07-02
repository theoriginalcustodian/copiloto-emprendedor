"""Test del motor GENERICO make_dispatcher (fixed-mount R1). Gate 1x: la maquina confirm-gate se valida UNA vez
aca contra hojas FALSAS + una closed-list de referencia; cada dominio la reusa sin re-testearla. Puro (sin temporal
ni deps del dominio) -> corre en PC o VPS. Porta las 5 invariantes que antes vivian en el (retirado) router unit."""
from __future__ import annotations

from backend.agent.dispatch import make_dispatcher
from backend.agent.types import Intent

_VALID = {"target": {"reunion", "consulta", "turno"}}


def _fake_parse(text_value, callback_value):
    v = callback_value if callback_value is not None else text_value
    if v in ("yes", "si", "sí", "dale"):
        return "yes"
    if v in ("no", "cancelar"):
        return "no"
    return None


def _fake_merge(state, incoming, valid):
    out = dict(state)
    for k, v in (incoming or {}).items():
        if k in valid and v in valid[k]:
            out[k] = v
    return out


def _fake_resolve(ctx, hint):
    return {"id": hint, "name": hint} if hint in _VALID["target"] else None


class _FakeGateway:
    def __init__(self):
        self.calls = []

    def execute(self, slug, **kwargs):
        self.calls.append((slug, kwargs))
        return {"status": "ok", "slug": slug}


class _FakeCtx:
    def __init__(self, gateway=None):
        self.gateway = gateway or _FakeGateway()
        self.cliente_id = "c1"


def _fake_execute(ctx, target, *, confirmed):
    if not target:
        return {"status": "needs_confirmation"}
    if confirmed:
        ctx.gateway.execute("BOOK", target=target)
    return {"status": "ok"}


def _dispatch():
    return make_dispatcher(valid_entities=_VALID, parse_confirmation=_fake_parse, merge_entities=_fake_merge,
                           resolve_target=_fake_resolve, execute_action=_fake_execute)


def _intent(action, **entities):
    return Intent(action=action, entities=entities, confidence=1.0, reply_es="")


def test_ambiguous_confirmation_does_not_execute():
    gateway = _FakeGateway()
    ctx = _FakeCtx(gateway)
    state = {"awaiting": "confirm", "pending_target": {"id": "turno", "name": "turno"}}
    result = _dispatch()(_intent("clarify", confirmation="tal vez"), state, ctx)
    assert gateway.calls == []
    assert result.done is False
    assert result.state_patch.get("awaiting") == "confirm"


def test_explicit_yes_executes_pending_action():
    gateway = _FakeGateway()
    ctx = _FakeCtx(gateway)
    state = {"awaiting": "confirm", "pending_target": {"id": "turno", "name": "turno"}}
    result = _dispatch()(_intent("callback", value="yes"), state, ctx)
    assert len(gateway.calls) == 1
    assert result.done is True
    assert result.state_patch.get("awaiting") is None


def test_escalate_human_uses_fixed_text_not_llm_reply():
    ctx = _FakeCtx()
    intent = Intent(action="escalate_human", entities={}, confidence=1.0, reply_es="esto no es grave, tranqui")
    result = _dispatch()(intent, {}, ctx)
    assert result.escalate is True
    assert result.reply_text != intent.reply_es
    assert "persona del equipo" in result.reply_text


def test_invalid_entity_does_not_override_valid_one():
    ctx = _FakeCtx()
    state = {"target": "turno"}
    result = _dispatch()(_intent("book", target="algo_inventado"), state, ctx)
    assert result.state_patch.get("target") == "turno"


def test_no_cancels_and_clears_pending_state():
    gateway = _FakeGateway()
    ctx = _FakeCtx(gateway)
    state = {"awaiting": "confirm", "pending_target": {"id": "turno", "name": "turno"}}
    result = _dispatch()(_intent("callback", value="no"), state, ctx)
    assert gateway.calls == []
    assert result.state_patch.get("awaiting") is None
    assert result.done is False


def test_happy_path_new_target_offers_confirmation():
    ctx = _FakeCtx()
    result = _dispatch()(_intent("book", target="turno"), {}, ctx)
    assert result.state_patch.get("awaiting") == "confirm"
    assert result.state_patch.get("pending_target", {}).get("name") == "turno"
    assert result.choices and result.choices[0]["value"] == "yes"
    assert "turno" in result.reply_text


def test_texts_override_replaces_defaults():
    d = make_dispatcher(valid_entities=_VALID, parse_confirmation=_fake_parse, merge_entities=_fake_merge,
                        resolve_target=_fake_resolve, execute_action=_fake_execute,
                        texts={"escalate": "Un momento, te paso con alguien."})
    result = d(Intent(action="emergency", entities={}, confidence=1.0, reply_es=""), {}, _FakeCtx())
    assert result.reply_text == "Un momento, te paso con alguien."
    assert result.escalate is True
