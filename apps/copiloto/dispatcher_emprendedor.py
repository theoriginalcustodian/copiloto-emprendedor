"""Dispatcher del dominio 'emprendedor' (capa CLIENTE de B).

Mapea el Intent (del LLM o de un botón determinístico) a acciones sobre Composio, con HITL conversacional:
una acción con efecto se PROPONE primero (pending + botones) y solo se ejecuta tras confirmación, con
confirmed=True (doble candado con el ComposioGateway). Firma esperada por dispatch_intent: (intent, state, ctx)."""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable

ARCH = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))

from backend.agent.types import DispatchResult, Intent
from clients.agent.datetime_resolver import DEFAULT_TZ, resolve_datetime

from calendar_policy import CREATE_EVENT_SLUG

_DEFAULT_DURATION_MIN = 60   # duración default del evento agendado (el dominio aún no pide duración explícita)


def _plus_minutes(date_iso: str, hhmm: str, minutes: int) -> str:
    """ISO naive-local de (date_iso, hhmm) + minutes. Determinista (no usa el reloj): apto para la activity."""
    dt = datetime.fromisoformat(f"{date_iso}T{hhmm}:00")
    return (dt + timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%S")


def make_dispatcher(gateway, *, composio_user_id: str, now_iso_provider: Callable[[], str],
                    tz: str = DEFAULT_TZ) -> Callable[[Intent, dict, object], DispatchResult]:
    def dispatch(intent: Intent, state: dict, ctx: object | None) -> DispatchResult:
        action = intent.action
        ent = intent.entities or {}

        # ── confirmación / cancelación de una acción pendiente ─────────────────────────────
        if action in ("callback", "confirm_pending"):
            pending = (state or {}).get("pending")
            value = str(ent.get("value", "")).lower()
            said_cancel = value == "cancel"
            said_confirm = value == "confirm" or (not value and action == "confirm_pending")
            if not pending:
                return DispatchResult(reply_text="No tengo ninguna acción pendiente para confirmar. ¿Qué querés hacer?")
            if said_cancel:
                return DispatchResult(reply_text="Listo, lo cancelé. ¿Algo más?", done=True, state_patch={"pending": None})
            if said_confirm:
                res = gateway.execute(pending["slug"], user_id=composio_user_id,
                                      arguments=pending["arguments"], confirmed=True)
                ok = bool(res.get("successful", False))   # fail-closed: sin la key NO declaramos éxito
                txt = "Listo, lo agendé ✅" if ok else "Uy, no pude agendarlo. Probemos de nuevo."
                return DispatchResult(reply_text=txt, done=ok, state_patch={"pending": None})
            return DispatchResult(reply_text="¿Confirmás o cancelás?",
                                  choices=[{"label": "Confirmar", "value": "confirm"},
                                           {"label": "Cancelar", "value": "cancel"}])

        # ── proponer agendar un evento (NO ejecuta) ────────────────────────────────────────
        if action == "book":
            title = ent.get("title") or "Reunión"
            resolved = resolve_datetime(ent.get("date_raw"), ent.get("time_raw"),
                                        now_iso=now_iso_provider(), tz=tz)
            date, hhmm = resolved.get("date"), resolved.get("time")
            if not (date and hhmm):
                return DispatchResult(reply_text="¿Para qué día y hora querés agendarlo?")
            # Contrato CREATE_EVENT validado (spike wizard_flow2 + spike contrato 2026-06-30): start/end
            # naive-LOCAL + timezone IANA. NO el datetime_iso UTC: mostraría y argumentaría la hora corrida +3h.
            arguments = {"summary": title,
                         "start_datetime": f"{date}T{hhmm}:00",
                         "end_datetime": _plus_minutes(date, hhmm, _DEFAULT_DURATION_MIN),
                         "timezone": tz}
            pending = {"slug": CREATE_EVENT_SLUG, "arguments": arguments}
            return DispatchResult(
                reply_text=f"Voy a agendar «{title}» para el {date} a las {hhmm} hs. ¿Confirmás?",
                choices=[{"label": "Confirmar", "value": "confirm"},
                         {"label": "Cancelar", "value": "cancel"}],
                state_patch={"pending": pending})

        # ── cualquier otra cosa ────────────────────────────────────────────────────────────
        return DispatchResult(reply_text=intent.reply_es or "Contame qué necesitás y te ayudo.")

    return dispatch


# re-export para los tests/composition root
__all__ = ["make_dispatcher", "CREATE_EVENT_SLUG"]
