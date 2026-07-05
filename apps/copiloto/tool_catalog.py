"""Catálogo de tools del motor ReAct (capa CLIENTE). Ensambla los TOOL_SCHEMAS de los módulos de servicio
(discovery) + las 2 tools de 1ra clase (calendar_book, mp_charge), el índice tool_name→destino y el set de
writes (para el gate). Fuente única: sumar un servicio en services/*.py lo agrega acá sin editar este módulo.

El sys.path.insert del ARCH ref va ACÁ (no en cada módulo de servicio): `TOOL_INDEX`/`WRITE_TOOLS` se computan
a nivel de módulo (import time) y disparan `services.modules()` -> discovery -> import de CADA services/<x>.py,
que a su vez importa `clients.agent.providers.composio_gateway` desde el ARCH ref. Sin este insert ANTES de esa
discovery, `import tool_catalog` en aislamiento (sin otro test que ya lo haya insertado antes) haría fallar el
import de cada módulo de servicio dentro del try/except silencioso de `services._discover()` -> catálogo vacío.

También expone `make_tool_executor` (Task 6): dado un nombre de tool + argumentos, ejecuta la acción real
(read directo · write con confirm-gate · then/resolve de 2 pasos) y devuelve un `ToolResult` — nunca una
excepción de negocio (retry ∞ del workflow), ver `agente-loop-tool-failure-retry-infinito`."""
from __future__ import annotations

import re
import secrets
import sys
from datetime import datetime, timedelta
from pathlib import Path

import services
from services.base import Proposal, Read

_REF = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(_REF))
from backend.agent.types import Artifact, ToolResult  # noqa: E402
from clients.agent.datetime_resolver import DEFAULT_TZ, resolve_datetime  # noqa: E402
from clients.agent.providers.composio_gateway import ComposioExecutionError, ConnectionRequired  # noqa: E402

from calendar_policy import CREATE_EVENT_SLUG  # noqa: E402

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
    schemas = [CALENDAR_BOOK_SCHEMA, MP_CHARGE_SCHEMA]
    for mod in services.modules().values():
        schemas.extend(mod.TOOL_SCHEMAS)
    return schemas


TOOL_INDEX = {**_service_index(), "calendar_book": ("calendar",), "mp_charge": ("mp",)}
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
                          observation={"preview": f"agendar «{arguments.get('title')}» {date} {hhmm}"})
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
                          observation={"preview": f"generar link de cobro por ${amount} ({concept})"})
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
    if dedup:
        dedup.save(idem_key, preference_id=link.get("id"), init_point=link["init_point"], external_reference=ext_ref)
    return ToolResult(tool_call_id=idem_key, is_write=True, status="ok",
                      observation={"result": "link de cobro listo", "init_point": link["init_point"]},
                      artifact=Artifact(kind="payment_link",
                                        data={"url": link["init_point"], "amount": amount, "concept": concept}))


def make_tool_executor(gateway, *, now_iso_provider, mp_dedup_factory=None):
    """Ejecuta UNA tool y devuelve ToolResult. El gate lo abre el propio executor (write sin confirmed →
    needs_confirmation SIN ejecutar). Errores de negocio → status='error' (nunca excepción → retry ∞)."""

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
                                      observation={"preview": out.reply_text},
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

    return tool_executor
