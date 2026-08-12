"""Dispatcher del dominio 'emprendedor' (capa CLIENTE de B).

Confirm-gate genérico (HITL) + ruteo a módulos de servicio (`services/<svc>.py`). El confirm-gate —proponer
un write, botón Confirmar, ejecutar con confirmed=True (doble candado con el ComposioGateway)— es del CORE,
común a TODO servicio. Cada servicio solo arma el call: Proposal (write, requiere confirmación) o Read
(lectura, se ejecuta directo). Calendar conserva su verbo 'book' (path probado E2E, PR #97, intacto); los
servicios nuevos usan action='tool_action' + entities{service, op, ...} y se enchufan agregando UN archivo en
`services/` (cero fricción). Firma esperada por dispatch_intent: (intent, state, ctx)."""
from __future__ import annotations

import re
import secrets
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable

from _paths import ensure_paths
ensure_paths()

from backend.agent.types import DispatchResult, Intent
from clients.agent.datetime_resolver import DEFAULT_TZ, resolve_datetime, resolve_date_range
from clients.agent.providers.composio_gateway import ComposioExecutionError, ConnectionRequired

from activity_summary import summarize_activity
from calendar_policy import CREATE_EVENT_SLUG
import services
from services.base import Proposal, Read

_DEFAULT_DURATION_MIN = 60   # duración default del evento agendado (el dominio aún no pide duración explícita)
_CONFIRM_CHOICES = [{"label": "Confirmar", "value": "confirm"}, {"label": "Cancelar", "value": "cancel"}]

# Nombres humanos de los toolkits para el mensaje de "conectá X" (el slug técnico no le dice nada al user).
_TOOLKIT_NAMES = {
    "googledocs": "Google Docs", "googledrive": "Google Drive", "gmail": "Gmail",
    "googlecalendar": "Google Calendar", "googlesheets": "Google Sheets",
    "mercadopago": "Mercado Pago",
}


def _friendly_toolkit(toolkit: str) -> str:
    return _TOOLKIT_NAMES.get((toolkit or "").lower(), toolkit or "ese servicio")


def _service_card(service: str) -> dict:
    """Card de presentación del reply HITL: QUÉ app real se va a usar. El frontend la usa para mostrar el ícono
    + el nombre real del servicio en el cartel de confirmación (en vez de adivinar del texto → "AGENDA" siempre).
    `service` = key del catálogo (googledocs/gmail/mercadopago/...); `label` = nombre humano (_TOOLKIT_NAMES)."""
    return {"service": (service or "").lower(), "label": _friendly_toolkit(service)}


def _plus_minutes(date_iso: str, hhmm: str, minutes: int) -> str:
    """ISO naive-local de (date_iso, hhmm) + minutes. Determinista (no usa el reloj): apto para la activity."""
    dt = datetime.fromisoformat(f"{date_iso}T{hhmm}:00")
    return (dt + timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%S")


def _dig(obj, path):
    """Extrae obj[path[0]][path[1]]... con claves str (dict) o índices int (list). None si no existe.
    Serializable (no callables) → apto para el state durable del workflow. Usado por el pre-paso `resolve`."""
    cur = obj
    for k in path:
        if isinstance(k, int):
            if isinstance(cur, (list, tuple)) and -len(cur) <= k < len(cur):
                cur = cur[k]
            else:
                return None
        elif isinstance(cur, dict) and k in cur:
            cur = cur[k]
        else:
            return None
    return cur


def make_dispatcher(gateway, *, now_iso_provider: Callable[[], str],
                    tz: str = DEFAULT_TZ, llm=None,
                    mp_dedup_factory=None) -> Callable[[Intent, dict, object], DispatchResult]:
    """Multitenant-only (Task 8b): los recursos por-tenant (composio_user_id, mp_*, cliente_id) se LEEN
    SIEMPRE de `ctx` (un `TenantCtx` armado por `context_factory(conv)` desde `conv["cliente_id"]`,
    per-request — cero fuga entre tenants, ver `context_factory.py`). Sin fallback single-tenant: `ctx`
    es obligatorio, `worker_b.build_worker_config` (Task 8) ya registra el `context_factory` real, así que
    en producción `ctx` nunca es `None`. Si un caller no lo pasa, `dispatch` falla claro (`ValueError`) en
    vez de degradar en silencio a un tenant fantasma."""

    def _execute_pending(pending: dict, *, comp_uid, mpgw, mpcred, mpseller, mpwebhook, cid,
                        idem_key=None) -> DispatchResult:
        """Ejecuta el write pendiente con confirmed=True (doble candado). Fail-closed: sin successful=True NO
        declaramos éxito. Común a Calendar y a todo servicio nuevo.

        MercadoPago (pending['provider']=='mercadopago') se rutea al mpgw ANTES de tocar el
        ComposioGateway — es un boundary distinto (2º proveedor de writes del Copiloto). Dedup app-side
        (C1, alineado a la gemela protegida `tool_catalog._run_mp_charge`): MP /checkout/preferences NO
        deduplica, así que un retry at-least-once de Temporal con el mismo `idem_key` cachea (SELECT)
        antes de volver a llamar a la gateway (POST) — nunca un 2do link para el mismo paso del workflow.

        Soporta tools de 2 pasos vía pending['then'] (patrón create->publish, ej Instagram): tras el paso 1,
        extrae un id del resultado (then['id_key']) y ejecuta then['slug'] pasándolo como then['id_arg'].

        Soporta un pre-paso vía pending['resolve'] (patrón resolver-luego-escribir, ej nombre real de la hoja de
        Sheets): ejecuta un read (resolve['slug']), extrae un valor por resolve['path'] y lo inyecta en
        arguments[resolve['into']] ANTES del write. Fail-closed: si no se resuelve, NO escribimos."""
        if pending.get("provider") == "mercadopago":
            creds = mpcred.get(mpseller)
            if not creds:
                return DispatchResult(reply_text="Primero conectá tu cuenta de MercadoPago y volvé a pedirlo.",
                                      done=False, state_patch={"pending": None})
            dedup = mp_dedup_factory(cid) if mp_dedup_factory else None
            if dedup and idem_key:
                cached = dedup.get(idem_key)
                if cached:
                    return DispatchResult(
                        reply_text=f"Listo, acá está el link de cobro por ${pending['amount']} 👉 "
                                   f"{cached['init_point']}",
                        done=True, state_patch={"pending": None})
            ext_ref = f"copiloto-{secrets.token_hex(4)}"
            notif = f"{mpwebhook}/mp/webhook?cid={cid}&seller={mpseller}"
            link = mpgw.create_payment_link(
                creds["access_token"], amount=pending["amount"],
                external_reference=ext_ref, notification_url=notif, title=pending.get("concept", "Cobro"))
            # Un 200/201 sin `init_point` NO puede llegar al dedup.save -- la columna es NOT NULL (mismo
            # candado que la gemela): cortamos ANTES del save, error de negocio y no una excepción que
            # Temporal reintentaría con un ext_ref nuevo cada vez.
            if not link.get("init_point"):
                return DispatchResult(reply_text="El cobro no devolvió un link válido; probá de nuevo.",
                                      done=False, state_patch={"pending": None})
            if dedup and idem_key:
                dedup.save(idem_key, preference_id=link.get("id"), init_point=link["init_point"],
                          external_reference=ext_ref)
            return DispatchResult(
                reply_text=f"Listo, acá está el link de cobro por ${pending['amount']} 👉 {link['init_point']}",
                done=True, state_patch={"pending": None})
        arguments = dict(pending["arguments"])
        resolve = pending.get("resolve")
        if resolve:
            rr = gateway.execute(resolve["slug"], user_id=comp_uid,
                                 arguments=resolve["arguments"], confirmed=False)
            val = _dig(rr, resolve["path"])
            if val is None:
                return DispatchResult(reply_text="Uy, no pude ubicar la hoja de la planilla. Probemos de nuevo.",
                                      done=False, state_patch={"pending": None})
            arguments[resolve["into"]] = val
        res = gateway.execute(pending["slug"], user_id=comp_uid,
                              arguments=arguments, confirmed=True)
        ok = bool(res.get("successful", False))
        then = pending.get("then")
        if ok and then:
            data = res.get("data") if isinstance(res.get("data"), dict) else {}
            cid_step2 = data.get(then["id_key"])
            if cid_step2 is None:
                m = re.search(rf'["\']{re.escape(then["id_key"])}["\']\s*:\s*["\']?([\w-]+)', str(res))
                cid_step2 = m.group(1) if m else None
            if cid_step2 is None:
                return DispatchResult(reply_text="Uy, no pude completar el segundo paso. Probemos de nuevo.",
                                      done=False, state_patch={"pending": None})
            res2 = gateway.execute(then["slug"], user_id=comp_uid,
                                   arguments={**then.get("arguments", {}), then["id_arg"]: cid_step2}, confirmed=True)
            ok = bool(res2.get("successful", False))
        txt = pending.get("ok_text", "Listo ✅") if ok else "Uy, no pude hacerlo. Probemos de nuevo."
        return DispatchResult(reply_text=txt, done=ok, state_patch={"pending": None})

    def _run(intent: Intent, state: dict, ctx: object) -> DispatchResult:
        action = intent.action
        ent = intent.entities or {}
        # ── recursos por-tenant: SIEMPRE de ctx (multitenant real, cero closure horneado) ───────────────────
        comp_uid = ctx.composio_user_id
        mpgw = ctx.mp_gateway
        mpcred = ctx.mp_cred_store
        mpseller = ctx.mp_seller_user_id
        mpwebhook = ctx.mp_webhook_base
        cid = ctx.cliente_id

        # ── confirmación / cancelación de una acción pendiente (genérico, todo servicio) ─────────────────
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
                return _execute_pending(pending, comp_uid=comp_uid, mpgw=mpgw, mpcred=mpcred,
                                        mpseller=mpseller, mpwebhook=mpwebhook, cid=cid,
                                        idem_key=ctx.idem_key)
            return DispatchResult(reply_text="¿Confirmás o cancelás?", choices=list(_CONFIRM_CHOICES))

        # ── Calendar: verbo 'book' (path probado E2E #97, INTACTO) ───────────────────────────────────────
        if action == "book":
            title = ent.get("title") or "Reunión"
            resolved = resolve_datetime(ent.get("date_raw"), ent.get("time_raw"),
                                        now_iso=now_iso_provider(), tz=tz)
            date, hhmm = resolved.get("date"), resolved.get("time")
            if not (date and hhmm):
                return DispatchResult(reply_text="¿Para qué día y hora querés agendarlo?")
            arguments = {"summary": title, "start_datetime": f"{date}T{hhmm}:00",
                         "end_datetime": _plus_minutes(date, hhmm, _DEFAULT_DURATION_MIN), "timezone": tz}
            pending = {"slug": CREATE_EVENT_SLUG, "arguments": arguments, "ok_text": "Listo, lo agendé ✅"}
            return DispatchResult(
                reply_text=f"Voy a agendar «{title}» para el {date} a las {hhmm} hs. ¿Confirmás?",
                choices=list(_CONFIRM_CHOICES), state_patch={"pending": pending},
                card=_service_card("googlecalendar"))

        # ── MercadoPago: cobrar por chat (confirm-gate → mp_gateway) ─────────────────────────────────────
        if action == "mp_charge":
            if mpgw is None or mpcred is None:
                return DispatchResult(reply_text="El cobro por MercadoPago todavía no está disponible en tu cuenta.")
            amount = ent.get("amount")
            if not amount:
                return DispatchResult(reply_text="¿Por qué monto querés el link de cobro?")
            concept = ent.get("concept") or "Cobro"
            pending = {"provider": "mercadopago", "amount": amount, "concept": concept}
            return DispatchResult(
                reply_text=f"Voy a generar un link de cobro de MercadoPago por ${amount} ({concept}). ¿Confirmás?",
                choices=list(_CONFIRM_CHOICES), state_patch={"pending": pending},
                card=_service_card("mercadopago"))

        # ── consultar la ACTIVIDAD de un rango de fecha libre (memoria de largo plazo → resumen LLM) ──────
        # El LLM emite range_raw CRUDO ('esta semana'); el dispatcher lo resuelve determinísticamente
        # (resolve_date_range con now_iso_provider) y trae la actividad EXHAUSTIVA del rango (recall_range, no
        # semántico top-K), luego la resume/analiza con el LLM (map-reduce adaptativo). Todo I/O acá corre
        # dentro de la activity dispatch_intent (fuera del sandbox del workflow) → replay-safe.
        if action == "consultar_actividad":
            mem = getattr(ctx, "memory_provider", None)
            if mem is None or llm is None:
                return DispatchResult(reply_text="Todavía no puedo consultarte la actividad pasada. Probemos en un rato.")
            rng = resolve_date_range(ent.get("range_raw"), now_iso=now_iso_provider(), tz=tz)
            if not rng:
                return DispatchResult(reply_text="¿De qué período querés que te cuente? Por ejemplo: hoy, ayer, "
                                                 "esta semana, el mes pasado, o 'del 1 al 5 de julio'.")
            episodes = mem.recall_range(cid, datetime.fromisoformat(rng["since"]),
                                        datetime.fromisoformat(rng["until"]))
            if not episodes:
                return DispatchResult(reply_text=f"No encontré actividad registrada en {rng['label']}. "
                                                 "Puede que todavía no haya quedado guardada.")
            summary = summarize_activity(episodes, question=ent.get("question") or intent.reply_es or "",
                                         label=rng["label"], llm=llm)
            return DispatchResult(reply_text=summary or f"No pude armar el resumen de {rng['label']} ahora mismo.")

        # ── servicios nuevos: action='tool_action' + entities{service, op, ...} → módulo plug-in ─────────
        if action == "tool_action":
            mod = services.by_service(ent.get("service"))
            if mod is None:
                return DispatchResult(reply_text=intent.reply_es or "Ese servicio todavía no lo tengo disponible.")
            out = mod.build(ent.get("op"), ent, now_iso=now_iso_provider())
            if out is None:
                return DispatchResult(reply_text=intent.reply_es or "Contame un poco más para poder hacerlo.")
            if isinstance(out, Proposal):
                pending = {"slug": out.slug, "arguments": out.arguments, "ok_text": out.ok_text}
                if out.then:
                    pending["then"] = out.then
                if out.resolve:
                    pending["resolve"] = out.resolve
                # `mod.TOOLKIT` (key REAL del catálogo: googledocs/gmail/…), NO `ent["service"]` (el nombre
                # corto que produce el LLM, ej "docs") — así el card trae la key que el frontend mapea a
                # ícono + nombre real (verificado E2E: "docs" daba una tarjeta sin ícono).
                return DispatchResult(reply_text=out.reply_text, choices=list(_CONFIRM_CHOICES),
                                      state_patch={"pending": pending}, card=_service_card(mod.TOOLKIT))
            if isinstance(out, Read):
                res = gateway.execute(out.slug, user_id=comp_uid, arguments=out.arguments, confirmed=False)
                return DispatchResult(reply_text=out.summarize(res))
            return DispatchResult(reply_text=intent.reply_es or "No pude procesar eso.")

        # ── cualquier otra cosa ──────────────────────────────────────────────────────────────────────────
        return DispatchResult(reply_text=intent.reply_es or "Contame qué necesitás y te ayudo.")

    def dispatch(intent: Intent, state: dict, ctx: object | None) -> DispatchResult:
        """Wrapper de robustez (bug 2026-07-04): un fallo de una tool externa (Composio) NUNCA debe propagarse
        como excepción del activity `dispatch_intent` → Temporal la reintentaría ∞ y colgaría el turno
        ('Pensando…' eterno). ConnectionRequired (cuenta no conectada) y ComposioExecutionError (fallo del
        servicio) se traducen a un DispatchResult de negocio (done=False → la charla sigue; pending limpio →
        no se re-dispara). El ctx None (error de programación, NO de negocio) queda FUERA del try → falla
        fuerte como antes, no lo enmascara este handler."""
        if ctx is None:
            raise ValueError("dispatch requiere ctx (context_factory) — dispatcher multitenant-only, sin "
                             "fallback single-tenant; verificá que el composition root registre context_factory")
        try:
            return _run(intent, state, ctx)
        except ConnectionRequired as e:
            return DispatchResult(
                reply_text=f"Para eso necesito que conectes {_friendly_toolkit(e.toolkit)} primero. "
                           "Andá a Conexiones, conectalo y volvé a pedírmelo 👌",
                done=False, state_patch={"pending": None})
        except ComposioExecutionError:
            return DispatchResult(
                reply_text="Uy, no pude completar esa acción con el servicio ahora mismo. "
                           "Probemos de nuevo en un ratito.",
                done=False, state_patch={"pending": None})

    return dispatch


# re-export para los tests/composition root
__all__ = ["make_dispatcher", "CREATE_EVENT_SLUG"]
