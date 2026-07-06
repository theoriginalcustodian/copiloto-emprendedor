"""Catálogo de tools del motor ReAct (capa CLIENTE). Ensambla los TOOL_SCHEMAS de los módulos de servicio
(discovery) + las 2 tools de 1ra clase (calendar_book, mp_charge), el índice tool_name→destino y el set de
writes (para el gate). Fuente única: sumar un servicio en services/*.py lo agrega acá sin editar este módulo.

El `ensure_paths()` del motor va ACÁ arriba de todo (no en cada módulo de servicio): `TOOL_INDEX`/`WRITE_TOOLS`
se computan a nivel de módulo (import time) y disparan `services.modules()` -> discovery -> import de CADA
services/<x>.py, que a su vez importa `clients.agent.providers.composio_gateway` del motor. Sin `ensure_paths()`
ANTES de esa discovery, `import tool_catalog` en aislamiento (sin conftest/entrypoint que ya lo haya corrido)
haría fallar el import de cada servicio dentro del try/except silencioso de `services._discover()` -> catálogo
vacío. El mount único vive en `_paths.py` (Fase 1 — boundary del motor); acá solo se dispara temprano.

También expone `make_tool_executor` (Task 6): dado un nombre de tool + argumentos, ejecuta la acción real
(read directo · write con confirm-gate · then/resolve de 2 pasos) y devuelve un `ToolResult` — nunca una
excepción de negocio (retry ∞ del workflow), ver `agente-loop-tool-failure-retry-infinito`."""
from __future__ import annotations

import re
import secrets
import sys
from datetime import datetime, timedelta
from pathlib import Path

from _paths import ensure_paths
ensure_paths()

import services  # noqa: E402  — dispara discovery; el motor ya está en el path por ensure_paths()
from services.base import Proposal, Read  # noqa: E402
from backend.agent.types import Artifact, ToolResult  # noqa: E402
from clients.agent.datetime_resolver import DEFAULT_TZ, resolve_datetime, resolve_date_range  # noqa: E402
from clients.agent.providers.composio_gateway import ComposioExecutionError, ConnectionRequired  # noqa: E402
from clients.agent.providers.mercadopago_gateway import MercadoPagoError  # noqa: E402

from activity_summary import summarize_activity  # noqa: E402
from calendar_policy import CREATE_EVENT_SLUG  # noqa: E402
# reusa el mapeo humano toolkit->nombre (mismo dominio 'emprendedor', sin duplicar el dict) — FIX HIGH card.
from dispatcher_emprendedor import _friendly_toolkit  # noqa: E402


def _obs_service(toolkit: str) -> dict:
    """Metadata de servicio para la `observation` del gate `needs_confirmation` (FIX HIGH, review final): el
    frontend keyea el badge de riesgo (Mercado Pago/Instagram) y el monto por `card.service` (`hitlMapping.ts`
    lee `message.card.service`); sin esto TODO gate del motor react degradaba a una card genérica sin ícono ni
    riesgo. Mismo shape que `dispatcher_emprendedor._service_card` (reusa `_TOOLKIT_NAMES` vía `_friendly_toolkit`
    para que dispatch/react muestren el mismo nombre humano) — no se importa `_service_card` en sí porque esa
    devuelve `{service, label}` sin el resto de la observation (`preview`), que este helper preserva al fusionarse."""
    return {"service": (toolkit or "").lower(), "label": _friendly_toolkit(toolkit)}


# ── tools de 1ra clase (gateways propios, no vía módulo de servicio) ─────────────────────────────
CALENDAR_BOOK_SCHEMA = {"type": "function", "function": {
    "name": "calendar_book",
    "description": "Agenda un evento en Google Calendar. Devuelve un link clicable al evento.",
    "parameters": {"type": "object", "properties": {
        "title": {"type": "string"}, "date_raw": {"type": "string", "description": "fecha en lenguaje natural"},
        "time_raw": {"type": "string", "description": "hora, ej '15'"}},
        "required": ["title", "date_raw", "time_raw"]}}}

MP_CHARGE_SCHEMA = {"type": "function", "function": {
    "name": "mp_charge",
    "description": "Genera un link de cobro de MercadoPago. Devuelve el link (init_point) para compartir/pagar.",
    "parameters": {"type": "object", "properties": {
        "amount": {"type": "number", "description": "monto en pesos"},
        "concept": {"type": "string", "description": "qué se cobra"}},
        "required": ["amount"]}}}

CONSULTAR_ACTIVIDAD_SCHEMA = {"type": "function", "function": {
    "name": "consultar_actividad",
    "description": "Consulta y resume la actividad PASADA del usuario en un período (hoy, ayer, esta semana, un "
                   "mes, o un rango de fechas). Usala cuando pregunta qué hizo, qué pasó, o pide un resumen de su "
                   "actividad. Es de SOLO LECTURA (no requiere confirmación).",
    "parameters": {"type": "object", "properties": {
        "range_raw": {"type": "string", "description": "período en lenguaje natural, ej 'hoy', 'esta semana', 'del 1 al 5 de julio'"},
        "question": {"type": "string", "description": "la pregunta puntual del usuario, si la hay (opcional)"}},
        "required": ["range_raw"]}}}

_FIRST_CLASS_WRITES = frozenset({"calendar_book", "mp_charge"})


def _service_index() -> dict:
    """tool_name -> ('service', module, op). El write/read se decide con la POLICY del módulo (write ⇒ gate)."""
    idx = {}
    for mod in services.modules().values():
        for tool_name, op in mod.TOOLS.items():
            idx[tool_name] = ("service", mod, op)
    return idx


def _service_writes() -> set:
    """Un tool de servicio es write si su op está en `mod.WRITE_OPS` (declaración EXPLÍCITA por módulo — cada
    módulo DEBE exponerla). Sin heurística por POLICY.write: eso confundiría op con slug y marcaría reads como
    writes. Un módulo sin WRITE_OPS falla explícito (AttributeError) en vez de degradar a 'todo es write'."""
    writes = set()
    for mod in services.modules().values():
        write_ops = mod.WRITE_OPS   # requerido: si falta, el import del catálogo revienta (fail-fast, no silencioso)
        for tool_name, op in mod.TOOLS.items():
            if op in write_ops:
                writes.add(tool_name)
    return writes


def _required_of(tool_name: str) -> list:
    """Los campos `required` del JSON-schema de una tool (para la validación mínima del executor, Task 6)."""
    for s in build_tool_catalog():
        if s["function"]["name"] == tool_name:
            return list(s["function"].get("parameters", {}).get("required", []))
    return []


def build_tool_catalog() -> list[dict]:
    schemas = [CALENDAR_BOOK_SCHEMA, MP_CHARGE_SCHEMA, CONSULTAR_ACTIVIDAD_SCHEMA]
    for mod in services.modules().values():
        schemas.extend(mod.TOOL_SCHEMAS)
    return schemas


# consultar_actividad NO va en WRITE_TOOLS a propósito: es read puro (recall + resumen) → sin gate HITL.
TOOL_INDEX = {**_service_index(), "calendar_book": ("calendar",), "mp_charge": ("mp",),
              "consultar_actividad": ("activity",)}
WRITE_TOOLS = frozenset(_service_writes()) | _FIRST_CLASS_WRITES


# artifact por tool-name → {kind, data.url} (§5.4). Cada kind con código real (major #10). El shape EXACTO del
# `res` de cada tool se confirma al implementar mirando el dump real de Composio (los paths de acá son los
# conocidos de validate_toolkit; si un toolkit devuelve otra key, ajustar en su commit — NO dejar None mudo).
def _artifact_for(name: str, res: dict, arguments: dict) -> "Artifact | None":
    data = res.get("data") if isinstance(res.get("data"), dict) else {}
    if name == "gmail_send":
        # link al hilo/borrador en Gmail (el spec pide `url`); si el res no trae id, cae al inbox del remitente
        mid = data.get("id") or data.get("threadId") or data.get("messageId")
        url = f"https://mail.google.com/mail/u/0/#all/{mid}" if mid else "https://mail.google.com/mail/u/0/"
        return Artifact(kind="email_draft", data={"url": url, "to": arguments.get("to"),
                                                  "subject": arguments.get("subject")})
    if name == "docs_create_doc":
        url = data.get("documentUrl") or data.get("webViewLink") or (
            f"https://docs.google.com/document/d/{data.get('documentId')}" if data.get("documentId") else None)
        return Artifact(kind="doc", data={"url": url}) if url else None
    if name.startswith("sheets_"):
        sid = data.get("spreadsheetId") or data.get("spreadsheet_id")
        url = data.get("spreadsheetUrl") or (f"https://docs.google.com/spreadsheets/d/{sid}" if sid else None)
        return Artifact(kind="sheet", data={"url": url}) if url else None
    if name.startswith("drive_"):
        url = data.get("webViewLink") or data.get("webContentLink")
        return Artifact(kind="file", data={"url": url}) if url else None
    if name.startswith("instagram_"):
        url = data.get("permalink") or data.get("media_url")
        return Artifact(kind="file", data={"url": url}) if url else None
    if name == "calendar_book":
        return Artifact(kind="calendar_event", data={"url": data.get("htmlLink"),
                                                     "fields": {"title": arguments.get("title")}})
    # hubspot y demás reads no producen artifact clicable (o se agrega su kind cuando exista una url canónica)
    return None


def _dig(obj, path):
    """Extrae obj[path[0]][path[1]]... con claves str (dict) o índices int (list). None si no existe.
    Serializable (no callables) → apto para el state durable del workflow. Copiado de
    `dispatcher_emprendedor._dig` (mismo contrato, usado por el pre-paso `resolve`)."""
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


def _execute_proposal(gateway, comp_uid, out) -> tuple:
    """Ejecuta un Proposal con confirmed=True, honrando resolve (pre-paso read→inyectar) y then (2do write).
    Devuelve (ok, res_del_write_principal). Fail-closed: sin successful=True, ok=False."""
    arguments = dict(out.arguments)
    if out.resolve:                                   # pre-paso: resolver un valor (ej nombre real de la hoja)
        rr = gateway.execute(out.resolve["slug"], user_id=comp_uid,
                             arguments=out.resolve["arguments"], confirmed=False)
        val = _dig(rr, out.resolve["path"])
        if val is None:
            return False, {}
        arguments[out.resolve["into"]] = val
    res = gateway.execute(out.slug, user_id=comp_uid, arguments=arguments, confirmed=True)
    ok = bool(res.get("successful", False))
    if ok and out.then:                               # 2do paso (ej instagram create→publish)
        data = res.get("data") if isinstance(res.get("data"), dict) else {}
        step2_id = data.get(out.then["id_key"])
        if step2_id is None:
            m = re.search(rf'["\']{re.escape(out.then["id_key"])}["\']\s*:\s*["\']?([\w-]+)', str(res))
            step2_id = m.group(1) if m else None
        if step2_id is None:
            return False, res
        res2 = gateway.execute(out.then["slug"], user_id=comp_uid,
                               arguments={**out.then.get("arguments", {}), out.then["id_arg"]: step2_id},
                               confirmed=True)
        ok = bool(res2.get("successful", False))
    return ok, res


def _run_calendar_book(name, arguments, ctx, confirmed, idem_key, gateway, now_iso_provider):
    r = resolve_datetime(arguments.get("date_raw"), arguments.get("time_raw"),
                         now_iso=now_iso_provider(), tz=DEFAULT_TZ)
    date, hhmm = r.get("date"), r.get("time")
    if not (date and hhmm):
        return ToolResult(tool_call_id=idem_key, status="error",
                          observation={"error": "faltó fecha/hora del evento"})
    if not confirmed:
        return ToolResult(tool_call_id=idem_key, is_write=True, status="needs_confirmation",
                          observation={"preview": f"agendar «{arguments.get('title')}» {date} {hhmm}",
                                       **_obs_service("googlecalendar")})
    end = (datetime.fromisoformat(f"{date}T{hhmm}:00") + timedelta(minutes=60)).strftime("%Y-%m-%dT%H:%M:%S")
    args = {"summary": arguments.get("title") or "Reunión", "start_datetime": f"{date}T{hhmm}:00",
            "end_datetime": end, "timezone": DEFAULT_TZ}
    res = gateway.execute(CREATE_EVENT_SLUG, user_id=ctx.composio_user_id, arguments=args, confirmed=True)
    ok = bool(res.get("successful", False))
    return ToolResult(tool_call_id=idem_key, is_write=True, status="ok" if ok else "error",
                      observation={"result": "agendado" if ok else "no se pudo agendar"},
                      artifact=_artifact_for(name, res, arguments) if ok else None)


def _run_mp_charge(name, arguments, ctx, confirmed, idem_key, now_iso_provider, mp_dedup_factory):
    """Genera un link de cobro MercadoPago. Dedup app-side (spike C, Task 7): MP /checkout/preferences NO
    deduplica, así que un retry at-least-once de Temporal con el mismo `idem_key` cachea (SELECT) antes de
    volver a llamar a la gateway (POST) — nunca un 2do link para el mismo paso del workflow."""
    amount = arguments.get("amount")
    concept = arguments.get("concept") or "Cobro"
    if ctx.mp_gateway is None or ctx.mp_cred_store is None:
        return ToolResult(tool_call_id=idem_key, status="error",
                          observation={"error": "MercadoPago no esta disponible en tu cuenta"})
    if not amount:
        return ToolResult(tool_call_id=idem_key, status="error", observation={"error": "falta el monto"})
    if not confirmed:
        return ToolResult(tool_call_id=idem_key, is_write=True, status="needs_confirmation",
                          observation={"preview": f"generar link de cobro por ${amount} ({concept})",
                                       **_obs_service("mercadopago")})
    creds = ctx.mp_cred_store.get(ctx.mp_seller_user_id)
    if not creds:
        return ToolResult(tool_call_id=idem_key, status="error",
                          observation={"error": "conecta tu cuenta de MercadoPago primero"})
    dedup = mp_dedup_factory(ctx.cliente_id) if mp_dedup_factory else None
    if dedup:                                             # spike C: MP no deduplica -> dedup app-side
        cached = dedup.get(idem_key)
        if cached:
            return ToolResult(tool_call_id=idem_key, is_write=True, status="ok",
                              observation={"result": "link de cobro listo", "init_point": cached["init_point"]},
                              artifact=Artifact(kind="payment_link",
                                                data={"url": cached["init_point"], "amount": amount, "concept": concept}))
    ext_ref = f"copiloto-{secrets.token_hex(4)}"
    notif = f"{ctx.mp_webhook_base}/mp/webhook?cid={ctx.cliente_id}&seller={ctx.mp_seller_user_id}"
    link = ctx.mp_gateway.create_payment_link(creds["access_token"], amount=amount,
                                              external_reference=ext_ref, notification_url=notif, title=concept)
    # FIX MEDIUM (money path, review final): un 200/201 sin `init_point` (dict "raro" de la gateway) NO puede
    # llegar al dedup.save -- la columna es NOT NULL, así que guardar None dispararía IntegrityError y el
    # retry at-least-once de Temporal reintentaría el POST completo (2do link real creado para el mismo turno).
    # Cortamos ANTES del save: error de negocio como observación, nunca excepción.
    if not link.get("init_point"):
        return ToolResult(tool_call_id=idem_key, status="error",
                          observation={"error": "el cobro no devolvió un link válido; probá de nuevo"})
    if dedup:
        dedup.save(idem_key, preference_id=link.get("id"), init_point=link["init_point"], external_reference=ext_ref)
    return ToolResult(tool_call_id=idem_key, is_write=True, status="ok",
                      observation={"result": "link de cobro listo", "init_point": link["init_point"]},
                      artifact=Artifact(kind="payment_link",
                                        data={"url": link["init_point"], "amount": amount, "concept": concept}))


def _run_consultar_actividad(arguments, ctx, idem_key, now_iso_provider, llm):
    """Recall temporal por rango de fecha (READ puro → sin gate). Reusa la MISMA lógica del dispatcher
    (`dispatcher_emprendedor` consultar_actividad): resuelve el período natural determinísticamente, trae la
    actividad EXHAUSTIVA del rango (recall_range, no semántico top-K) y la resume/analiza con el LLM. Cero
    lógica nueva. Devuelve el resumen como `observation.result` → el loop react lo incorpora a la respuesta."""
    mem = getattr(ctx, "memory_provider", None)
    if mem is None or llm is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "no puedo consultar la actividad pasada ahora mismo"})
    rng = resolve_date_range(arguments.get("range_raw"), now_iso=now_iso_provider(), tz=DEFAULT_TZ)
    if not rng:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "especificá un período: hoy, ayer, esta semana, o 'del 1 al 5 de julio'"})
    episodes = mem.recall_range(ctx.cliente_id, datetime.fromisoformat(rng["since"]),
                                datetime.fromisoformat(rng["until"]))
    if not episodes:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": f"No encontré actividad registrada en {rng['label']}."})
    summary = summarize_activity(episodes, question=arguments.get("question") or "", label=rng["label"], llm=llm)
    return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                      observation={"result": summary or f"No pude armar el resumen de {rng['label']} ahora."})


def make_tool_executor(gateway, *, now_iso_provider, mp_dedup_factory=None, llm=None):
    """Ejecuta UNA tool y devuelve ToolResult. El gate lo abre el propio executor (write sin confirmed →
    needs_confirmation SIN ejecutar). Errores de negocio → status='error' (nunca excepción → retry ∞).
    `llm` (opcional): el LlmProvider compartido que usa `consultar_actividad` para resumir la actividad."""

    def tool_executor(name, arguments, ctx, *, confirmed, idem_key):
        if ctx is None:
            raise ValueError("tool_executor requiere ctx (context_factory)")
        try:
            entry = TOOL_INDEX.get(name)
            if entry is None:
                return ToolResult(tool_call_id=idem_key, status="error",
                                  observation={"error": f"tool desconocida: {name}"})
            kind = entry[0]

            # ── 1ra clase: mp_charge (dedup app-side, spike C) ────────────────────────────────────
            if kind == "mp":
                return _run_mp_charge(name, arguments, ctx, confirmed, idem_key,
                                      now_iso_provider, mp_dedup_factory)   # Task 8
            # ── 1ra clase: calendar_book ──────────────────────────────────────────────────────────
            if kind == "calendar":
                return _run_calendar_book(name, arguments, ctx, confirmed, idem_key,
                                          gateway, now_iso_provider)
            # ── 1ra clase: consultar_actividad (recall temporal por rango, READ → sin gate) ────────
            if kind == "activity":
                return _run_consultar_actividad(arguments, ctx, idem_key, now_iso_provider, llm)

            # ── servicio (Composio vía módulo plug-in) ────────────────────────────────────────────
            _, mod, op = entry
            out = mod.build(op, arguments, now_iso=now_iso_provider())
            if out is None:
                return ToolResult(tool_call_id=idem_key, status="error",
                                  observation={"error": "faltan datos para ejecutar la acción"})
            if isinstance(out, Read):
                res = gateway.execute(out.slug, user_id=ctx.composio_user_id, arguments=out.arguments, confirmed=False)
                return ToolResult(tool_call_id=idem_key, is_write=False,
                                  observation={"result": out.summarize(res)})
            if isinstance(out, Proposal):
                if not confirmed:
                    return ToolResult(tool_call_id=idem_key, is_write=True, status="needs_confirmation",
                                      observation={"preview": out.reply_text, **_obs_service(mod.TOOLKIT)},
                                      artifact=Artifact(kind="pending", data={"reply_text": out.reply_text}))
                ok, res = _execute_proposal(gateway, ctx.composio_user_id, out)   # then/resolve (B2)
                return ToolResult(tool_call_id=idem_key, is_write=True, status="ok" if ok else "error",
                                  observation={"result": out.ok_text if ok else "no se pudo completar"},
                                  artifact=_artifact_for(name, res, arguments) if ok else None)
            return ToolResult(tool_call_id=idem_key, status="error", observation={"error": "resultado inesperado"})
        except ConnectionRequired as e:
            return ToolResult(tool_call_id=idem_key, status="error",
                              observation={"error": f"servicio no conectado: {e.toolkit}", "needs_connect": e.toolkit})
        except ComposioExecutionError:
            return ToolResult(tool_call_id=idem_key, status="error",
                              observation={"error": "el servicio falló; reintentá en un rato"})
        except MercadoPagoError:
            # cobro MP falló (HTTP != 201, etc.): error de NEGOCIO como observación, nunca excepción propagada
            # (el contrato del executor promete "nunca excepción → retry ∞"; alinea con la regla dura PR #114).
            return ToolResult(tool_call_id=idem_key, status="error",
                              observation={"error": "no pude generar el cobro ahora; probá de nuevo en un rato"})
        except Exception:
            # FIX LOW (review final, contrato "nunca excepción → observación"): cualquier excepción NO prevista
            # (bug de un módulo de servicio, KeyError de un shape inesperado de Composio, etc.) NO debe propagar
            # -- un raise acá dispararía los 5 retries de LOOP_RETRY contra la MISMA excepción determinística
            # (no la arregla reintentar) y, sin try/except en el workflow que la contenga, tumbaría la sesión
            # entera (regla dura PR #114). `ctx is None` queda AFUERA de este try a propósito: es error de
            # PROGRAMACIÓN (context_factory mal cableado), debe fallar fuerte, no degradar silencioso.
            return ToolResult(tool_call_id=idem_key, status="error",
                              observation={"error": "no pude completar la acción; probá de nuevo"})

    return tool_executor
