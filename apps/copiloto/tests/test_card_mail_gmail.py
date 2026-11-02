"""SM-H3 — el pedido de mail produce la card de GMAIL, y el mail sale al confirmar (decisión D8).

Medido: «mandale un recordatorio por mail» devolvía la card de Calendar. La card sale de la TOOL que el
LLM elige (`TOOL_INDEX[tool] -> servicio`), y `calendar_book` no decía que NO es para mails. Se fijan
acá (a) el discriminante en las descripciones de las dos tools, (b) la card por TIPO (`service`, no por
texto) y (c) las DOS ramas del gate en tests separados: confirmar manda, no confirmar NO manda — un
mecanismo roto hacia el «no» no da síntoma. NO hay envío programado (D8): nada acá lo introduce.
"""
import tool_catalog

from test_execute_tool import _Ctx, _FakeGateway

_AHORA = "2026-07-04T18:41:00+00:00"
_ARGS = {"to": "lucia@x.com", "subject": "Recordatorio", "body": "Mañana: reunión con Juan."}


def _ex(gw):
    return tool_catalog.make_tool_executor(gw, now_iso_provider=lambda: _AHORA)


def test_el_pedido_de_mail_arma_la_card_de_GMAIL_por_tipo_no_la_de_calendar():
    gw = _FakeGateway()
    tr = _ex(gw)("gmail_send", dict(_ARGS), _Ctx(), confirmed=False, idem_key="k1")
    assert tr.status == "needs_confirmation"
    assert tr.observation["service"] == "gmail"               # el TIPO de card, no el texto
    assert tr.observation["service"] != "googlecalendar"
    assert tr.observation["detalle"]["titulo"] == "Mail a lucia@x.com"


def test_la_card_dice_que_el_mail_sale_al_confirmar():
    tr = _ex(_FakeGateway())("gmail_send", dict(_ARGS), _Ctx(), confirmed=False, idem_key="k2")
    nota = tr.observation["detalle"]["nota"]
    assert "cuando confirmes" in nota and "no antes" in nota


def test_sin_confirmar_el_mail_NO_sale():
    """La rama del «no»: pedir y no confirmar no ejecuta nada contra Gmail."""
    gw = _FakeGateway()
    _ex(gw)("gmail_send", dict(_ARGS), _Ctx(), confirmed=False, idem_key="k3")
    assert gw.calls == [], "el gate no puede mandar el mail antes del confirmar"


def test_al_confirmar_el_mail_SALE_una_vez_por_gmail():
    gw = _FakeGateway()
    tr = _ex(gw)("gmail_send", dict(_ARGS), _Ctx(), confirmed=True, idem_key="k4")
    assert tr.status != "needs_confirmation"
    assert len(gw.calls) == 1
    slug, confirmed, args = gw.calls[0]
    assert "GMAIL" in slug.upper() and confirmed is True
    assert args.get("recipient_email") == "lucia@x.com"


def test_las_descripciones_separan_mail_de_calendar():
    """El discriminante que decide qué tool elige el LLM: Calendar no es para mails y Gmail sí lo es para
    recordatorios por mail (con 'para mañana' como contenido, no como envío diferido)."""
    from services import gmail
    gmail_desc = gmail.TOOL_SCHEMAS[0]["function"]["description"]
    assert "POR MAIL" in gmail_desc and "no se puede programar" in gmail_desc
    assert "gmail_send" in tool_catalog.CALENDAR_BOOK_SCHEMA["function"]["description"]
    assert "NO la uses" in tool_catalog.CALENDAR_BOOK_SCHEMA["function"]["description"]
