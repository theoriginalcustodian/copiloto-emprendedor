import sys
from pathlib import Path
ARCH = Path(__file__).resolve().parents[3] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.agent.types import Intent
import dispatcher_emprendedor as de


class _GatewaySpy:
    def __init__(self): self.calls = []
    def execute(self, slug, *, user_id, arguments, confirmed):
        self.calls.append({"slug": slug, "user_id": user_id, "arguments": arguments, "confirmed": confirmed})
        return {"successful": True, "data": {"id": "evt_123"}}


def _disp(gw):
    return de.make_dispatcher(gw, composio_user_id="u1", now_iso_provider=lambda: "2026-07-01T10:00:00-03:00")


def test_book_propone_y_no_ejecuta():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="book", entities={"title": "Reunión con Juan", "date_raw": "jueves", "time_raw": "15"}), {}, None)
    assert gw.calls == []                                  # no ejecuta todavía
    assert r.state_patch["pending"]["slug"] == de.CREATE_EVENT_SLUG
    assert "summary" in r.state_patch["pending"]["arguments"]
    assert {c["value"] for c in r.choices} == {"confirm", "cancel"}
    assert r.done is False


def test_book_usa_hora_local_y_contrato_validado():
    # REGRESIÓN (review #1): el display y los args deben ir en hora LOCAL, no en el datetime_iso UTC (que
    # corría +3h: mostraba 18:00 cuando el usuario pidió 15:00). Contrato CREATE validado empíricamente:
    # start/end naive-local + timezone IANA (event_duration_minutes solo -> successful:False).
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="book", entities={"title": "Reunión con Juan", "date_raw": "jueves", "time_raw": "15"}), {}, None)
    args = r.state_patch["pending"]["arguments"]
    assert args["start_datetime"] == "2026-07-02T15:00:00"          # naive-LOCAL (no ...T18:00:00+00:00)
    assert args["end_datetime"] == "2026-07-02T16:00:00"            # +60min default
    assert args["timezone"] == "America/Argentina/Buenos_Aires"
    assert "15:00" in r.reply_text and "18:00" not in r.reply_text  # muestra la hora pedida, no la UTC


def test_callback_confirm_ejecuta_con_confirmed_true():
    gw = _GatewaySpy()
    pending = {"slug": de.CREATE_EVENT_SLUG, "arguments": {"summary": "Reunión con Juan", "start_datetime": "2026-07-02T15:00:00-03:00"}}
    r = _disp(gw)(Intent(action="callback", entities={"value": "confirm"}), {"pending": pending}, None)
    assert gw.calls[0]["confirmed"] is True               # doble candado
    assert gw.calls[0]["slug"] == de.CREATE_EVENT_SLUG
    assert r.done is True
    assert r.state_patch["pending"] is None


def test_callback_cancel_no_ejecuta():
    gw = _GatewaySpy()
    pending = {"slug": de.CREATE_EVENT_SLUG, "arguments": {}}
    r = _disp(gw)(Intent(action="callback", entities={"value": "cancel"}), {"pending": pending}, None)
    assert gw.calls == []
    assert r.done is True and r.state_patch["pending"] is None


def test_confirm_sin_pending_clarifica():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="confirm_pending", entities={}), {}, None)
    assert gw.calls == []
    assert r.done is False and r.reply_text                # pide contexto, no rompe
