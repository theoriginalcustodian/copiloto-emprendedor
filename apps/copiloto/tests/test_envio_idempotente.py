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
from backend.agent.agent_runtime import register_channel, register_staff_notifier


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
