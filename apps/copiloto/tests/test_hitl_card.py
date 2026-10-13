"""C-D3 (contrato 2026-10-13): `card.detalle` / `card.recibo` del gate HITL — piloto Gmail.

Lado DOMINIO: el executor real (`make_tool_executor`) arma `observation["detalle"]` en el gate y
`observation["recibo"]` tras una ejecución confirmada y exitosa. El lado MOTOR (re-empaquetado a la card)
se prueba en `motor/backend/agent/test_hitl_detalle_recibo.py`, con el workflow real.

Lo que se fija acá, y por qué:
  · `detalle` sale de los ARGUMENTOS de la acción, no del `preview` (el texto es redacción, no dato).
  · el `recibo` sólo existe si la tool EJECUTÓ OK.
  · un servicio sin entrada deja la card como estaba (un solo piloto: Gmail).
"""
import pytest

import hitl_card
import tool_catalog

from test_execute_tool import _Ctx, _FakeGateway

_AHORA_UTC = "2026-07-04T18:41:00+00:00"          # = 15:41 en la zona del negocio (UTC−3)


def _ex(gw, ahora=_AHORA_UTC):
    return tool_catalog.make_tool_executor(gw, now_iso_provider=lambda: ahora)


def test_gate_de_gmail_trae_el_detalle_estructurado():
    tr = _ex(_FakeGateway())("gmail_send", {"to": "lucia@x.com", "subject": "Recordatorio",
                                            "body": "Te recuerdo la reunión del lunes."},
                             _Ctx(), confirmed=False, idem_key="k1")
    assert tr.status == "needs_confirmation"
    assert tr.observation["detalle"] == {
        "titulo": "Mail a lucia@x.com",
        "filas": [{"k": "Para", "v": "lucia@x.com", "sub": None, "editable": False},
                  {"k": "Asunto", "v": "Recordatorio", "sub": None, "editable": False}],
        "cita": "Te recuerdo la reunión del lunes.",
        "nota": "Se manda desde tu Gmail.",
    }
    assert "recibo" not in tr.observation                      # el recibo es del cierre, no del gate
    assert tr.observation["service"] == "gmail"                # lo de antes sigue igual


def test_el_detalle_sale_de_los_arguments_no_del_preview(monkeypatch):
    """CONTROL: el `preview` dice OTRA persona. El detalle tiene que mostrar a quien se le va a mandar de
    verdad (los arguments que se ejecutan), no lo que dice el texto redactado."""
    from services.base import Proposal
    mod = tool_catalog.TOOL_INDEX["gmail_send"][1]
    def build_mentiroso(op, entities, now_iso=None):
        return Proposal(slug=mod.SEND_SLUG,
                        arguments={"recipient_email": "real@x.com", "subject": "Real", "body": "cuerpo real"},
                        reply_text="Voy a enviar un mail a OTRA@persona.com con asunto «Otro». ¿Confirmás?")
    monkeypatch.setattr(mod, "build", build_mentiroso)
    tr = _ex(_FakeGateway())("gmail_send", {"to": "x@y.com", "body": "z"}, _Ctx(), confirmed=False,
                             idem_key="k2")
    filas = {f["k"]: f["v"] for f in tr.observation["detalle"]["filas"]}
    assert filas == {"Para": "real@x.com", "Asunto": "Real"}
    assert "OTRA@persona.com" in tr.observation["preview"]     # el preview sigue siendo lo que es


def test_sin_asunto_el_detalle_muestra_lo_que_se_va_a_mandar():
    tr = _ex(_FakeGateway())("gmail_send", {"to": "a@b.com", "body": "hola"}, _Ctx(), confirmed=False,
                             idem_key="k3")
    filas = {f["k"]: f["v"] for f in tr.observation["detalle"]["filas"]}
    assert filas["Asunto"] == "(sin asunto)"                   # el mismo default que ejecuta `build`


def test_confirmado_y_ok_trae_el_recibo_con_hora_del_negocio():
    gw = _FakeGateway({"successful": True, "data": {}})
    tr = _ex(gw)("gmail_send", {"to": "lucia@x.com", "subject": "s", "body": "hola"}, _Ctx(),
                 confirmed=True, idem_key="k4")
    assert tr.status == "ok"
    assert tr.observation["recibo"] == {"titulo": "Mandado a lucia@x.com", "meta": "15:41", "accion": None}
    assert "detalle" not in tr.observation                     # el detalle es del gate, no del cierre


def test_si_el_envio_fallo_no_hay_recibo():
    """«Mandado a Lucía» sobre un envío que no salió es la mentira exacta que este guard existe para evitar."""
    gw = _FakeGateway({"successful": False, "data": {}})
    tr = _ex(gw)("gmail_send", {"to": "lucia@x.com", "subject": "s", "body": "hola"}, _Ctx(),
                 confirmed=True, idem_key="k5")
    assert tr.status == "error"
    assert "recibo" not in tr.observation


def test_la_hora_del_recibo_no_se_inventa_sin_reloj():
    recibo = hitl_card.recibo_de("gmail", {"recipient_email": "a@b.com"}, None)
    assert recibo == {"titulo": "Mandado a a@b.com", "meta": None, "accion": None}
    assert hitl_card.recibo_de("gmail", {"recipient_email": "a@b.com"}, "no-es-una-fecha")["meta"] is None


def test_piloto_un_solo_servicio_el_resto_queda_como_estaba():
    """Decisión del contrato C-D3: NO se migran los cinco. Un servicio sin entrada devuelve None y su card
    queda `{kind, service, label}`. Agregar otro es agregar UNA entrada — y cambiar este test a propósito."""
    assert hitl_card.TOOLKITS_CON_DETALLE == frozenset({"gmail"})
    for toolkit in ("googledocs", "googlesheets", "googlecalendar", "hubspot", "mercadopago", "instagram"):
        assert hitl_card.detalle_de(toolkit, {"recipient_email": "a@b.com"}) is None, toolkit
        assert hitl_card.recibo_de(toolkit, {"recipient_email": "a@b.com"}, _AHORA_UTC) is None, toolkit


def test_sin_destinatario_no_hay_detalle():
    assert hitl_card.detalle_de("gmail", {"subject": "x", "body": "y"}) is None
    assert hitl_card.detalle_de("gmail", None) is None
