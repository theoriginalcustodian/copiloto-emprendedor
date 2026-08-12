"""El reintento de un envío no puede escribirle dos veces al emprendedor.

`send_channel_message` y `notify_staff` son activities, y una activity se reintenta. Si el envío se
concretó y el worker murió antes de reportarlo, Temporal la corre de nuevo: el usuario ve el mismo
mensaje dos veces, o una persona recibe la misma escalación dos veces.

La clave se deriva del `activity_id` —estable entre reintentos del MISMO agendamiento, distinto entre
agendamientos— y **se calcula dentro de la activity, no se recibe por payload**. Sumarla al payload
cambiaría el input de un `ScheduleActivityTask` de `ConversationWorkflow`, que tenía **78 ejecuciones
vivas** medidas contra el Temporal del VPS (sesiones permanentes con continue-as-new). Derivarla
adentro no toca ninguna — y de paso no depende de que el llamador se acuerde de mandarla.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

import backend.agent.agent_activities as act
from backend.agent.agent_runtime import register_channel, register_domain, register_staff_notifier
from backend.agent.types import DispatchResult


def _info(workflow_id="wf-1", run_id="run-1", activity_id="5"):
    return SimpleNamespace(workflow_id=workflow_id, workflow_run_id=run_id, activity_id=activity_id)


class _CanalEspia:
    name = "espia"

    def __init__(self) -> None:
        self.envios: list = []

    def send(self, channel_ref, text, choices=None, *, cliente_id=None, card=None, idem_key=None):
        self.envios.append(idem_key)
        return {"sent": True}


def _payload():
    return {"channel": "espia", "channel_ref": "s1", "text": "hola", "cliente_id": "cid-A"}


def test_dos_intentos_del_MISMO_agendamiento_llevan_la_misma_clave(monkeypatch):
    """EL TEST QUE IMPORTA: es lo único que permite al canal descartar el duplicado."""
    canal = _CanalEspia()
    register_channel("espia", canal)
    monkeypatch.setattr(act.activity, "info", lambda: _info(activity_id="5"))

    asyncio.run(act.send_channel_message(_payload()))
    asyncio.run(act.send_channel_message(_payload()))     # el reintento: mismo activity_id

    assert canal.envios[0] == canal.envios[1], "el reintento llevó otra clave: no se puede deduplicar"
    assert canal.envios[0] == "wf-1:run-1:5"


def test_control_dos_agendamientos_distintos_llevan_claves_distintas(monkeypatch):
    """Control diferencial. Si la clave fuera la misma para envíos distintos, el segundo mensaje
    legítimo del agente se descartaría — el copiloto quedaría mudo a partir del segundo turno."""
    canal = _CanalEspia()
    register_channel("espia", canal)

    monkeypatch.setattr(act.activity, "info", lambda: _info(activity_id="5"))
    asyncio.run(act.send_channel_message(_payload()))
    monkeypatch.setattr(act.activity, "info", lambda: _info(activity_id="9"))
    asyncio.run(act.send_channel_message(_payload()))

    assert canal.envios[0] != canal.envios[1]


def test_el_continue_as_new_no_reusa_claves(monkeypatch):
    """La sesión es PERMANENTE vía continue-as-new, y eso reinicia la numeración de `activity_id`.
    Sin el `run_id` en la clave, el primer envío del run nuevo colisionaría con el primero del run
    viejo y se descartaría — el copiloto se quedaría mudo justo después de cada continue-as-new."""
    canal = _CanalEspia()
    register_channel("espia", canal)

    monkeypatch.setattr(act.activity, "info", lambda: _info(run_id="run-1", activity_id="1"))
    asyncio.run(act.send_channel_message(_payload()))
    monkeypatch.setattr(act.activity, "info", lambda: _info(run_id="run-2", activity_id="1"))
    asyncio.run(act.send_channel_message(_payload()))

    assert canal.envios[0] != canal.envios[1]


def test_notify_staff_lleva_la_misma_clave_sin_tocar_el_payload_del_workflow(monkeypatch):
    """La clave se agrega al dict ACÁ, no en el workflow: mismo motivo que arriba. Y un notifier que
    la ignore sigue funcionando — es aditiva."""
    recibidos: list = []
    register_staff_notifier(lambda p: recibidos.append(p) or {"notified": True})
    monkeypatch.setattr(act.activity, "info", lambda: _info(activity_id="7"))

    entrada = {"cliente_id": "cid-A", "reason": "hitl", "summary": "revisar"}
    asyncio.run(act.notify_staff(dict(entrada)))
    asyncio.run(act.notify_staff(dict(entrada)))

    assert recibidos[0]["idem_key"] == recibidos[1]["idem_key"] == "wf-1:run-1:7"
    assert recibidos[0]["reason"] == "hitl", "no puede pisar lo que ya venía en el payload"


def test_un_canal_que_no_entiende_la_clave_no_rompe_el_envio(monkeypatch):
    """El contrato `ChannelAdapter.send` la declara opcional. Telegram, por ejemplo, no puede
    deduplicar (su Bot API no acepta clave) y absorbe el kwarg en vez de hacer `TypeError` — que es lo
    que pasaba antes con `card`: un canal que no entendía un campo opcional tumbaba el envío entero."""
    class CanalViejo:
        name = "viejo"

        def __init__(self):
            self.veces = 0

        def send(self, channel_ref, text, choices=None, *, cliente_id=None, **_ignorados):
            self.veces += 1
            return {"sent": True}

    canal = CanalViejo()
    register_channel("viejo", canal)
    monkeypatch.setattr(act.activity, "info", lambda: _info())

    asyncio.run(act.send_channel_message({**_payload(), "channel": "viejo"}))

    assert canal.veces == 1


def test_dispatch_intent_le_pasa_al_dominio_la_misma_clave_de_la_activity(monkeypatch):
    """C1 (doble cobro): `dispatch_intent` arma `idem_key` con el MISMO mecanismo que `send_channel_message`
    /`notify_staff` (activity_id, estable entre reintentos) y lo agrega a `conv` -- de ahí lo lee
    `context_factory` para armar el `ctx` que el dispatcher del dominio usa para deduplicar (ej. MP)."""
    conv_visto = []

    def _context_factory(conv):
        conv_visto.append(conv)
        return conv   # el dispatcher fake de abajo sólo necesita ver qué le llegó

    def _dispatcher_fake(intent, state, ctx):
        return DispatchResult(reply_text="ok", done=True)

    register_domain("dom-idem-test", system_prompt="", llm_provider=None,
                    dispatcher=_dispatcher_fake, context_factory=_context_factory)
    monkeypatch.setattr(act.activity, "info", lambda: _info(activity_id="5"))

    payload = {"domain": "dom-idem-test", "intent": {"action": "clarify", "entities": {}, "reply_es": ""},
              "state": {}, "conv": {"cliente_id": "cid-A"}}
    asyncio.run(act.dispatch_intent(dict(payload)))
    asyncio.run(act.dispatch_intent(dict(payload)))   # el reintento: mismo activity_id

    assert conv_visto[0]["idem_key"] == conv_visto[1]["idem_key"] == "wf-1:run-1:5"
    assert conv_visto[0]["cliente_id"] == "cid-A", "no puede pisar lo que ya venía en conv"


def test_dispatch_intent_agendamientos_distintos_llevan_idem_keys_distintas(monkeypatch):
    """Control diferencial: si la clave fuera la misma para dos turnos legítimos distintos, el 2do cobro
    real del emprendedor se descartaría como si fuera el reintento del 1ro."""
    conv_visto = []

    def _context_factory(conv):
        conv_visto.append(conv)
        return conv

    register_domain("dom-idem-test-2", system_prompt="", llm_provider=None,
                    dispatcher=lambda intent, state, ctx: DispatchResult(reply_text="ok", done=True),
                    context_factory=_context_factory)

    payload = {"domain": "dom-idem-test-2", "intent": {"action": "clarify", "entities": {}, "reply_es": ""},
              "state": {}, "conv": {"cliente_id": "cid-A"}}
    monkeypatch.setattr(act.activity, "info", lambda: _info(activity_id="5"))
    asyncio.run(act.dispatch_intent(dict(payload)))
    monkeypatch.setattr(act.activity, "info", lambda: _info(activity_id="9"))
    asyncio.run(act.dispatch_intent(dict(payload)))

    assert conv_visto[0]["idem_key"] != conv_visto[1]["idem_key"]
