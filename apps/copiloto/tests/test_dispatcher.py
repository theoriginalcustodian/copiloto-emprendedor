import sys
from pathlib import Path

from backend.agent.types import Intent
from _ctx_helper import make_ctx as _ctx
import dispatcher_emprendedor as de


class _GatewaySpy:
    def __init__(self): self.calls = []
    def execute(self, slug, *, user_id, arguments, confirmed):
        self.calls.append({"slug": slug, "user_id": user_id, "arguments": arguments, "confirmed": confirmed})
        return {"successful": True, "data": {"id": "evt_123"}}


def _disp(gw):
    return de.make_dispatcher(gw, now_iso_provider=lambda: "2026-07-01T10:00:00-03:00")


def test_book_propone_y_no_ejecuta():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="book", entities={"title": "Reunión con Juan", "date_raw": "jueves", "time_raw": "15"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls == []                                  # no ejecuta todavía
    assert r.state_patch["pending"]["slug"] == de.CREATE_EVENT_SLUG
    assert "summary" in r.state_patch["pending"]["arguments"]
    assert {c["value"] for c in r.choices} == {"confirm", "cancel"}
    assert r.card == {"service": "googlecalendar", "label": "Google Calendar"}   # el frontend muestra la app real
    assert r.done is False


def test_book_usa_hora_local_y_contrato_validado():
    # REGRESIÓN (review #1): el display y los args deben ir en hora LOCAL, no en el datetime_iso UTC (que
    # corría +3h: mostraba 18:00 cuando el usuario pidió 15:00). Contrato CREATE validado empíricamente:
    # start/end naive-local + timezone IANA (event_duration_minutes solo -> successful:False).
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="book", entities={"title": "Reunión con Juan", "date_raw": "jueves", "time_raw": "15"}), {}, _ctx(composio_user_id="u1"))
    args = r.state_patch["pending"]["arguments"]
    assert args["start_datetime"] == "2026-07-02T15:00:00"          # naive-LOCAL (no ...T18:00:00+00:00)
    assert args["end_datetime"] == "2026-07-02T16:00:00"            # +60min default
    assert args["timezone"] == "America/Argentina/Buenos_Aires"
    assert "15:00" in r.reply_text and "18:00" not in r.reply_text  # muestra la hora pedida, no la UTC


def test_callback_confirm_ejecuta_con_confirmed_true():
    gw = _GatewaySpy()
    pending = {"slug": de.CREATE_EVENT_SLUG, "arguments": {"summary": "Reunión con Juan", "start_datetime": "2026-07-02T15:00:00-03:00"}}
    r = _disp(gw)(Intent(action="callback", entities={"value": "confirm"}), {"pending": pending}, _ctx(composio_user_id="u1"))
    assert gw.calls[0]["confirmed"] is True               # doble candado
    assert gw.calls[0]["slug"] == de.CREATE_EVENT_SLUG
    assert r.done is True
    assert r.state_patch["pending"] is None


def test_callback_cancel_no_ejecuta():
    gw = _GatewaySpy()
    pending = {"slug": de.CREATE_EVENT_SLUG, "arguments": {}}
    r = _disp(gw)(Intent(action="callback", entities={"value": "cancel"}), {"pending": pending}, _ctx(composio_user_id="u1"))
    assert gw.calls == []
    assert r.done is True and r.state_patch["pending"] is None


def test_confirm_sin_pending_clarifica():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="confirm_pending", entities={}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls == []
    assert r.done is False and r.reply_text                # pide contexto, no rompe


# ── Robustez (bug 2026-07-04): un fallo de tool NUNCA se propaga como excepción (colgaría el workflow) ──
from clients.agent.providers.composio_gateway import ComposioExecutionError, ConnectionRequired  # noqa: E402


class _GatewayRaises:
    def __init__(self, exc): self._exc = exc
    def execute(self, slug, *, user_id, arguments, confirmed): raise self._exc


def test_tool_no_conectada_no_crashea_y_pide_conectar():
    # ConnectionRequired (cuenta no conectada) → mensaje accionable con el nombre humano del toolkit; NO se
    # propaga (si subiera, dispatch_intent reintentaría ∞ y colgaría el turno). done=False → la charla sigue;
    # pending limpio → no se re-dispara la acción fallida.
    pending = {"slug": "GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN", "arguments": {"title": "Presupuesto"}}
    r = _disp(_GatewayRaises(ConnectionRequired("googledocs")))(
        Intent(action="callback", entities={"value": "confirm"}), {"pending": pending}, _ctx(composio_user_id="u1"))
    assert "Google Docs" in r.reply_text and "conect" in r.reply_text.lower()
    assert r.done is False
    assert r.state_patch["pending"] is None


def test_fallo_de_servicio_no_crashea_mensaje_generico():
    # Un ComposioExecutionError genérico (servicio caído) tampoco tumba el turno → mensaje genérico, done=False.
    pending = {"slug": "GMAIL_SEND_EMAIL", "arguments": {}}
    r = _disp(_GatewayRaises(ComposioExecutionError("boom")))(
        Intent(action="callback", entities={"value": "confirm"}), {"pending": pending}, _ctx(composio_user_id="u1"))
    assert r.reply_text and r.done is False
    assert r.state_patch["pending"] is None


def test_ctx_none_sigue_fallando_fuerte():
    # El ctx None es un error de PROGRAMACIÓN (composition root mal armado), NO de negocio → debe seguir
    # levantando ValueError, el wrapper de robustez NO debe enmascararlo.
    import pytest
    with pytest.raises(ValueError):
        _disp(_GatewaySpy())(Intent(action="book", entities={}), {}, None)
