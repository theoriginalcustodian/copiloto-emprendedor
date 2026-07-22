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
from decimal import Decimal, InvalidOperation
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
# La lista de categorías y los límites de largo salen del store, no se re-declaran acá: el schema que ve
# el LLM y lo que la base acepta tienen que ser la MISMA lista o el modelo propone `stock`, el `POST`
# devuelve 400, y el emprendedor ve fallar algo que el copiloto le ofreció.
from gasto_store import CATEGORIAS, LIMITES, dos_decimales, hoy_del_negocio  # noqa: E402
# Mismo criterio para clientes. `LIMITES` colisiona con el de gastos y por eso viaja con alias: son dos
# tablas con dos topes distintos, y el día que uno cambie, importar el que no es recortaría un nombre a
# 200 caracteres porque así lo pide la columna de OTRA tabla.
# Las constantes de estado y de origen salen de los stores por el mismo motivo que las categorías de
# gasto: el enum que ve el LLM y lo que la base acepta tienen que ser la MISMA lista. Un `"aprobado"`
# literal acá y un rename allá se descubren en producción, cuando el copiloto marca y no pasa nada.
from cobro_store import COBRADA, ORIGEN_MANUAL  # noqa: E402
from presupuesto_store import (APROBADO, DESESTIMADO, TRANSICIONES,  # noqa: E402
                               TransicionInvalida)
from cliente_store import (DOC_CUIT, DOC_DNI, LIMITES as LIMITES_CLIENTE,  # noqa: E402
                          documento_incoherente, es_consumidor_final, inferir_doc_tipo,
                          normalizar_documento)
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


# 🔴 FUENTE ÚNICA de las expresiones de fecha, y **son las MEDIDAS** contra el resolvedor vivo el
# 2026-07-22 — no las que suenan razonables. De acá salen las tres cosas que las nombran: el aviso al
# emprendedor, las `description` que ve el LLM y el endpoint de capacidades que la app pinta como guía.
#
# Que sean una sola constante es lo que hace cierto **por construcción** el DoD «los ejemplos de la
# guía coinciden con la tabla medida». Verificarlo a mano funciona una vez; lo que falla es la segunda.
#
# ⚠️ NO agregar acá nada sin medirlo. El bug que esto cierra fue exactamente ese: la description
# prometía «el lunes», el resolvedor lo descartaba en silencio, y el gasto quedaba con fecha de hoy.
# **Una guía que promete de más es peor que no tener guía** — enseña a decir algo que falla.
FECHAS_QUE_ENTIENDO = ("hoy", "ayer", "anteayer", "hace una semana", "hace tres días",
                       "la semana pasada", "el mes pasado", "a principios de mes", "el 5 de julio")


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

REGISTRAR_GASTO_SCHEMA = {"type": "function", "function": {
    "name": "registrar_gasto",
    "description": "Anota un gasto que el emprendedor dictó ('pagué 15 mil de mercadería', 'gasté 3000 en "
                   "nafta'). NO lo guarda: arma una propuesta para que él la revise y confirme. Usala "
                   "siempre que mencione plata que SALIÓ. Si no dijo el monto, pedíselo antes de llamarla.",
    "parameters": {"type": "object", "properties": {
        "monto": {"type": "string", "description": "el monto en pesos, sólo el número, ej '15000'"},
        "categoria": {"type": "string", "enum": list(CATEGORIAS),
                      "description": "la categoría que mejor encaje; si ninguna, 'otros'"},
        "proveedor": {"type": "string", "description": "a quién le pagó, si lo dijo"},
        "medio_pago": {"type": "string", "description": "efectivo, transferencia, tarjeta… si lo dijo"},
        "descripcion": {"type": "string", "description": "lo que dictó, tal cual, para que pueda contrastarlo"},
        # 🔴 Los ejemplos son los que el resolvedor ENTIENDE DE VERDAD, medidos contra el vivo el
        # 2026-07-22 — no los que suenan naturales. Antes decía «el lunes», que NO se entiende: el
        # schema le ofrecía al modelo una forma que el backend descartaba en silencio, y el gasto
        # quedaba con fecha de hoy sin que nadie avisara. Si el resolvedor aprende más formas, esto
        # se amplía; mientras tanto prometer de menos es gratis y prometer de más miente.
        "fecha_raw": {"type": "string",
                      "description": "cuándo fue, en lenguaje natural. Entiendo: "
                                     + ", ".join(f"'{f}'" for f in FECHAS_QUE_ENTIENDO)
                                     + ". Omitilo si no lo dijo: se asume hoy."}},
        "required": ["monto"]}}}

REGISTRAR_CLIENTE_SCHEMA = {"type": "function", "function": {
    "name": "registrar_cliente",
    "description": "Guarda un cliente nuevo que el emprendedor dictó ('anotá un cliente, Panadería "
                   "Los Tilos, CUIT 30-71234567-8'). NO lo guarda: arma una propuesta para que él la "
                   "revise y confirme. Con el NOMBRE solo alcanza — no le pidas el CUIT si no lo dijo.",
    "parameters": {"type": "object", "properties": {
        "nombre": {"type": "string", "description": "cómo se llama el cliente o su negocio"},
        "doc_nro": {"type": "string", "description": "CUIT o DNI, sólo si lo dictó; los dígitos tal "
                                                     "como los dijo"},
        # 🔴 La PALABRA que usó, no el código. Si dijo «CUIT», eso es un dato y hay que conservarlo:
        # sin este campo, «CUIT 30-71234» (incompleto) se guardaba como DNI —los 7 dígitos que quedan
        # son un DNI válido— sin error ni aviso. Ver `documento_incoherente`.
        "tipo_doc": {"type": "string", "enum": ["CUIT", "DNI"],
                     "description": "si dijo la palabra «CUIT» o «DNI», ponela acá tal como la dijo. "
                                    "Omitilo si sólo dictó el número"},
        "domicilio": {"type": "string", "description": "la dirección, si la dijo"},
        "email": {"type": "string", "description": "el mail, si lo dijo"},
        "telefono": {"type": "string", "description": "el teléfono, si lo dijo"},
        "notas": {"type": "string", "description": "cualquier otra cosa que haya dicho de este cliente"}},
        "required": ["nombre"]}}}

CONSULTAR_CLIENTE_SCHEMA = {"type": "function", "function": {
    "name": "consultar_cliente",
    "description": "Responde qué le compró un cliente: cuánto facturó, cuántos presupuestos tiene y "
                   "cuáles fueron sus últimas operaciones. Usala cuando pregunte por UN cliente en "
                   "particular ('¿cuánto me compró la panadería?', '¿qué le facturé a Pérez?'). "
                   "Busca por nombre PARCIAL. Es de SOLO LECTURA.",
    "parameters": {"type": "object", "properties": {
        "nombre": {"type": "string", "description": "el nombre o parte del nombre, como lo dijo el "
                                                    "emprendedor ('la panadería', 'Pérez')"}},
        "required": ["nombre"]}}}

REGISTRAR_INGRESO_SCHEMA = {"type": "function", "function": {
    "name": "registrar_ingreso",
    "description": "Anota plata que ENTRÓ y que no viene de una factura puntual ('me pagaron 85 mil', "
                   "'cobré 40 mil de la panadería', 'me transfirieron 12000 por el trabajo del "
                   "sábado'). LA GUARDA de una vez. Lo ÚNICO obligatorio es el monto: no le pidas "
                   "cliente, medio de pago ni concepto antes de anotar — se piden después. Si lo que "
                   "cobró es una factura que ya emitió, usá `marcar_factura_cobrada` en vez de ésta.",
    "parameters": {"type": "object", "properties": {
        "monto": {"type": "string", "description": "el monto en pesos, sólo el número, ej '85000'"},
        "cliente": {"type": "string", "description": "quién le pagó, si lo dijo"},
        "medio_pago": {"type": "string", "description": "efectivo, transferencia, tarjeta… si lo dijo"},
        "concepto": {"type": "string", "description": "por qué le pagaron, si lo dijo"},
        # Mismos ejemplos medidos que en `registrar_gasto` — ver el comentario de aquel schema.
        "fecha_raw": {"type": "string",
                      "description": "cuándo fue, en lenguaje natural. Entiendo: "
                                     + ", ".join(f"'{f}'" for f in FECHAS_QUE_ENTIENDO)
                                     + ". Omitilo si no lo dijo: se asume hoy."},
        "confirmar_duplicado": {"type": "boolean",
                                "description": "sólo si ya te avisé de un ingreso parecido y él "
                                               "confirmó que es OTRO cobro distinto"}},
        "required": ["monto"]}}}

COMPLETAR_INGRESO_SCHEMA = {"type": "function", "function": {
    "name": "completar_ingreso",
    "description": "Agrega los datos que faltaban a un ingreso que YA anotaste en este mismo turno "
                   "('fue de la panadería', 'me pagaron en efectivo'). Completa EL MISMO ingreso, no "
                   "crea otro. Usala SIEMPRE que él conteste el aviso de lo que faltó — nunca vuelvas "
                   "a llamar `registrar_ingreso` para eso.",
    "parameters": {"type": "object", "properties": {
        "cliente": {"type": "string", "description": "de quién fue el cobro"},
        "medio_pago": {"type": "string", "description": "efectivo, transferencia, tarjeta…"},
        "concepto": {"type": "string", "description": "por qué le pagaron"},
        "ingreso_id": {"type": "integer", "description": "el id, si lo tenés a mano; si no, omitilo y "
                                                         "se completa el último que anotaste"}},
        "required": []}}}

MARCAR_FACTURA_COBRADA_SCHEMA = {"type": "function", "function": {
    "name": "marcar_factura_cobrada",
    "description": "Registra que le pagaron una factura que ya emitió ('me pagaron la factura de la "
                   "panadería', 'cobré la 42'). La saca de «te deben». Si no aclara cuál y hay varias "
                   "impagas, te devuelvo la lista para que le preguntes.",
    "parameters": {"type": "object", "properties": {
        "factura": {"type": "string", "description": "cómo la nombró: el número ('la 42') o el "
                                                     "cliente ('la de la panadería')"},
        "monto": {"type": "string", "description": "sólo si fue un pago PARCIAL; omitilo si le pagaron "
                                                   "todo, que es lo normal"},
        "medio_pago": {"type": "string", "description": "efectivo, transferencia… si lo dijo"},
        "fecha_raw": {"type": "string", "description": "cuándo le pagaron, en lenguaje natural. "
                                                       "Omitilo si no lo dijo: se asume hoy."}},
        "required": []}}}

MARCAR_PRESUPUESTO_SCHEMA = {"type": "function", "function": {
    "name": "marcar_presupuesto",
    "description": "Mueve el estado de un presupuesto cuando el emprendedor cuenta cómo salió ('me "
                   "aprobaron el de la panadería', 'ese no va', 'lo rechazaron'). Usala apenas lo "
                   "mencione: si no, todos quedan «pendientes» para siempre.",
    "parameters": {"type": "object", "properties": {
        "presupuesto": {"type": "string", "description": "cómo lo nombró: el número o el cliente"},
        "estado": {"type": "string", "enum": [APROBADO, DESESTIMADO],
                   "description": "'aprobado' si se lo aceptaron, 'desestimado' si no va"}},
        "required": ["estado"]}}}

# `registrar_gasto` NO está en WRITE_TOOLS, y no es un descuido: **no escribe nada**. Devuelve una
# propuesta que la app pinta como card editable, y el `POST /gastos` lo dispara el emprendedor al tocar
# Guardar. Meterla en WRITE_TOOLS la mandaría al confirm-gate de sí/no, que es justo el mecanismo que el
# contrato §5 descarta: confirmar sí/no re-ejecuta los MISMOS argumentos, así que un "quince mil" que
# Whisper transcribió como "cincuenta mil" sólo se puede aceptar o repetir el dictado entero. La card
# editable existe para poder tocar el monto ahí mismo — y ése es el único punto donde el error se
# detecta, porque después lo que se mira es el total, no el gasto.
_FIRST_CLASS_WRITES = frozenset({"calendar_book", "mp_charge"})


# ── lo que el copiloto SABE HACER, para que la guía sea una proyección y no una lista a mano ─────
#
# 🔴 Frontend lo pidió con el caso exacto: una pantalla de ayuda con las frases escritas adentro es
# **el mismo objeto que Apps** ([[verificar-que-el-camino-recomendado-existe]]) — un catálogo estático
# mientras lo vivo cambia por su cuenta, cada lado verificando su mitad y la junta sin dueño. La guía
# ya nació con ese bug: prometía «facturale 80 mil a la panadería» y `emitir_factura` NO EXISTE.
#
# Acá cada capacidad declara su rótulo y sus ejemplos, **y sólo se publica si su tool está viva** en
# `TOOL_INDEX`. Entonces la poda del hito 2 y el alta de `emitir_factura` (hito 9) actualizan la guía
# **solas**, y el DoD «los ejemplos coinciden con lo que existe» pasa a ser cierto por construcción en
# vez de algo que alguien tiene que acordarse de verificar. Verificar a mano funciona una vez.
_CAPACIDADES = (
    ("registrar_gasto", "Gastos", ("pagué 15 mil de mercadería", "gasté 3.000 en nafta ayer")),
    ("registrar_ingreso", "Ingresos", ("me pagaron 85 mil",
                                       "cobré 40 mil de la panadería en efectivo")),
    ("marcar_factura_cobrada", "Facturas", ("me pagaron la factura 42",)),
    ("marcar_presupuesto", "Presupuestos", ("me aprobaron el de la panadería",)),
    ("registrar_cliente", "Clientes", ("anotá un cliente, Panadería Los Tilos",)),
    ("consultar_cliente", "Consultas", ("¿cuánto me compró la panadería?",)),
    ("emitir_factura", "Facturar", ("facturale 80 mil a la panadería",)),
)


def capacidades_vivas() -> dict:
    """Lo que el copiloto puede hacer HOY, servido para la pantalla de ayuda.

    Una capacidad cuya tool no está en el **catálogo que se le arma al LLM** no se publica: prometer de
    más es peor que no tener guía, porque enseña a decir algo que falla y quema la confianza en todo lo
    demás. Prometer de menos es gratis — si el emprendedor dice algo que anda y no estaba, gana.

    🔴 **El filtro es `build_tool_catalog()`, NO `TOOL_INDEX`, y la diferencia costó un bug.**
    `TOOL_INDEX` mapea *toda* tool que el executor sabe ejecutar a su kind de artifact, e incluye las
    que el catálogo NO le ofrece al agente (una consultiva podada sigue teniendo su `_run_*` y su
    entrada de índice). Filtrar por ahí publicaba `consultar_cliente` en la pantalla de ayuda **después
    de podarla del catálogo** (medido contra el vivo, 2026-07-22). La lista que hay que respetar es la
    ÚNICA que el emprendedor puede efectivamente disparar: la que el LLM recibe.

    Las expresiones de fecha salen de `FECHAS_QUE_ENTIENDO`, que es la tabla **medida** contra el
    resolvedor vivo. Es la misma fuente que usan las `description` del LLM y el aviso al emprendedor:
    las tres no pueden divergir porque son la misma constante.
    """
    ofrecidas = {s["function"]["name"] for s in build_tool_catalog()}
    return {
        "capacidades": [{"tool": tool, "rotulo": rotulo, "ejemplos": list(ejemplos)}
                        for tool, rotulo, ejemplos in _CAPACIDADES if tool in ofrecidas],
        "fechas": {"entiendo": list(FECHAS_QUE_ENTIENDO),
                   "si_no_esta": "Para cualquier otro día, tocá la fecha en la tarjeta."},
    }


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
    # Poda del hito 2 — «el copiloto ejecuta, Inteligencia de Negocio explica»: las dos tools
    # CONSULTIVAS se fueron. Actividad y Clientes ya son pantallas propias, y preguntárselas al agente
    # gastaba una tool del presupuesto de routing para llegar peor a un dato que ya está a un toque.
    # Los `_run_consultar_*` y sus schemas quedan definidos: no cuesta nada y el día que Inteligencia
    # de Negocio necesite responder por chat, se re-enchufan acá sin reescribirlos.
    schemas = [CALENDAR_BOOK_SCHEMA, MP_CHARGE_SCHEMA,
               REGISTRAR_GASTO_SCHEMA, REGISTRAR_CLIENTE_SCHEMA,
               REGISTRAR_INGRESO_SCHEMA, COMPLETAR_INGRESO_SCHEMA,
               MARCAR_FACTURA_COBRADA_SCHEMA, MARCAR_PRESUPUESTO_SCHEMA]
    for mod in services.modules().values():
        schemas.extend(mod.TOOL_SCHEMAS)
    return schemas


# consultar_actividad NO va en WRITE_TOOLS a propósito: es read puro (recall + resumen) → sin gate HITL.
TOOL_INDEX = {**_service_index(), "calendar_book": ("calendar",), "mp_charge": ("mp",),
              "consultar_actividad": ("activity",), "registrar_gasto": ("gasto",),
              # Ninguna de las dos va en WRITE_TOOLS: `registrar_cliente` PROPONE (el POST lo dispara
              # el emprendedor al tocar Guardar) y `consultar_cliente` es read puro.
              "registrar_cliente": ("cliente",), "consultar_cliente": ("cliente_consulta",),
              # Las cuatro del hito 3 PERSISTEN (a diferencia de gasto y cliente, que proponen) y aun
              # así NO van en WRITE_TOOLS. El confirm-gate es sí/no sobre los MISMOS argumentos: acá
              # no protege de nada —el riesgo real no es "¿lo hago?" sino "¿a cuál?", y eso ya lo
              # cubre `_elegir_uno`, que se niega a elegir— y sí agrega la fricción que el addendum
              # §2 prohíbe explícitamente para anotar plata que entró. Todo esto es reversible:
              # borrar el ingreso, deshacer el cobro, volver a mover el presupuesto.
              "registrar_ingreso": ("ingreso",), "completar_ingreso": ("ingreso_completar",),
              "marcar_factura_cobrada": ("factura_cobrada",),
              "marcar_presupuesto": ("presupuesto_estado",)}
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


def _monto_dictado(bruto) -> "Decimal | None":
    """El monto tal como sale de un dictado, o None si no hay número usable.

    Whisper y el LLM devuelven cosas como `"15.000"`, `"$ 15000"`, `"15000,50"`. El punto es separador
    de miles en Argentina y la coma es el decimal — al revés que en Python. Interpretar `"15.000"` como
    quince pesos convierte un gasto de quince mil en uno de quince y **nadie lo nota**, porque lo que se
    mira después es el total del mes.
    """
    if bruto is None:
        return None
    texto = re.sub(r"[^\d,.\-]", "", str(bruto))
    if not texto:
        return None
    if "," in texto:                      # coma = decimal argentino; los puntos son miles
        texto = texto.replace(".", "").replace(",", ".")
    elif texto.count(".") == 1 and len(texto.split(".")[1]) != 2:
        texto = texto.replace(".", "")    # un punto que NO deja 2 decimales es separador de miles
    elif texto.count(".") > 1:
        texto = texto.replace(".", "")
    try:
        monto = Decimal(texto)
    except InvalidOperation:
        return None
    return monto if monto > 0 else None


def _run_registrar_gasto(arguments, ctx, idem_key, now_iso_provider):
    """Propone un gasto dictado. NO persiste — ver el comentario de `_FIRST_CLASS_WRITES`.

    Devuelve un `Artifact(kind='gasto_propuesto')` que el motor entrega tal cual como `card` del reply
    (`conversation_workflow._react_send`: sin card explícita, la card ES el artifact). La app la pinta
    editable y hace el `POST /gastos` con `origen: "voz"` cuando el emprendedor toca Guardar.
    """
    monto = _monto_dictado(arguments.get("monto"))
    if monto is None:
        # El contrato §5.3: falta el monto —y SÓLO el monto— se repregunta. Todo lo demás se asume y
        # queda editable. Se devuelve `ok` y no `error` a propósito: no falló nada, falta un dato, y el
        # loop react tiene que poder preguntarlo en vez de disculparse.
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "Falta el monto. Preguntale cuánto fue, sin repetir "
                                                 "el resto: lo demás ya lo tengo."})

    categoria = (arguments.get("categoria") or "").strip().lower()
    if categoria not in CATEGORIAS:
        categoria = "otros"               # el modelo inventó un rubro: cae en otros, no falla

    # "Hoy" sale del reloj INYECTADO (`now_iso_provider`), no de `datetime.now()`. Dos razones y las
    # dos costaron: (1) es el mismo reloj con el que se resuelve `fecha_raw` más abajo, así que "hoy" y
    # "ayer" quedan consistentes entre sí; (2) con el reloj de pared el test era **verde por
    # casualidad** — pasaba mientras el día real coincidiera con el instante del test, y rompió solo al
    # cruzar la medianoche. Ver `guard-caza-algo-distinto-de-lo-que-vigilaba`.
    fecha, fecha_ok = _fecha_dictada(arguments.get("fecha_raw"), now_iso_provider)

    def recortar(clave: str) -> str:
        return str(arguments.get(clave) or "").strip()[:LIMITES[clave]]

    # `fecha_entendida` + `fecha_dictada` viajan en la card para que el ⚠️ se pinte PEGADO al campo
    # que lo arregla. La app no infiere cuándo la fecha es dudosa: si lo decidiera por su cuenta, el
    # aviso y el dato saldrían de dos lugares distintos y divergirían.
    gasto = {"monto": dos_decimales(monto), "fecha": fecha.isoformat(), "categoria": categoria,
             "fecha_entendida": fecha_ok,
             "fecha_dictada": (arguments.get("fecha_raw") or "") if not fecha_ok else "",
             "proveedor": recortar("proveedor") or None, "medio_pago": recortar("medio_pago") or None,
             "descripcion": recortar("descripcion") or None, "origen": "voz"}
    return ToolResult(
        tool_call_id=idem_key, is_write=False, status="ok",
        # Lo que el LLM lee. Se le dice explícitamente que NO está guardado para que no cierre el turno
        # con "listo, ya lo anoté" — el emprendedor leería eso, no tocaría Guardar, y el gasto se
        # perdería creyendo los dos que estaba hecho.
        observation={"result": f"Propuse el gasto (${gasto['monto']}, {categoria}) y se lo muestro en "
                               f"una tarjeta para que la revise. TODAVÍA NO está guardado: decíselo en "
                               f"una línea corta y pedile que confirme o corrija."
                               # Sin aviso de fecha a propósito: la card lo muestra pegado al campo,
                               # y preguntarlo por chat mandaría la respuesta al mismo resolvedor que
                               # ya falló. `hay_card=True` lo deja mudo.
                               f"{_aviso_de_fecha(fecha_ok, arguments.get('fecha_raw'), hay_card=True)}"},
        artifact=Artifact(kind="gasto_propuesto", data=gasto))


def _run_registrar_cliente(arguments, ctx, idem_key):
    """Propone un cliente dictado. NO persiste — mismo patrón exacto que `registrar_gasto`.

    **Con el nombre solo alcanza, y eso es deliberado.** El contrato §7 lo dice y el DoD lo mide: si
    esta tool exigiera el CUIT, el camino por voz sería más estricto que el formulario, y el
    emprendedor que dicta *«anotá a la panadería de la esquina»* —el caso más común— no podría
    guardarlo. Exigir de más en la puerta de entrada es el tapón que este repo tiene prohibido.

    El documento **no se descarta si viene raro**: viaja igual, con `doc_tipo` en null y un aviso.
    Whisper transcribe mal los números largos, y un CUIT dictado que no da 11 dígitos es justamente
    el que hay que mostrarle para que lo corrija. Borrarlo en silencio haría desaparecer el error
    junto con el dato, y el alta saldría "bien" con un cliente sin CUIT que él creyó haber cargado.
    """
    nombre = str(arguments.get("nombre") or "").strip()[:LIMITES_CLIENTE["nombre"]]
    if not nombre:
        # `ok` y no `error`: no falló nada, falta el único dato obligatorio. Con `error` el loop se
        # disculpa; con esto puede preguntarlo y seguir.
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "Falta el nombre. Preguntale cómo se llama el "
                                                 "cliente o su negocio."})

    doc = normalizar_documento(arguments.get("doc_nro"))[:LIMITES_CLIENTE["doc_nro"]]
    doc_tipo = inferir_doc_tipo(doc) if doc else None
    if es_consumidor_final(doc_tipo):
        doc_tipo, doc = None, ""      # §3.1: un cliente NUNCA es 99 (no debería llegar; barato igual)

    # 🔴 Lo que la persona DIJO gana sobre lo que el largo sugiere — y cuando se contradicen, no gana
    # ninguno: gana la pregunta.
    #
    # Caso medido en el vivo: *«Anotá un cliente, CUIT 30-71234»* (un CUIT a medias) quedaba
    # normalizado en `3071234`, siete dígitos, que es un **DNI perfectamente válido**. El derivador
    # decía 96, la card se veía impecable y el cliente entraba con el tipo equivocado. Ni error, ni
    # aviso, ni nada raro que mirar: la única señal de que algo estaba mal era la palabra que la
    # persona había usado, y yo no tenía dónde guardarla.
    dicho = {"CUIT": DOC_CUIT, "DNI": DOC_DNI}.get(str(arguments.get("tipo_doc") or "").upper())
    contradice = bool(doc) and dicho is not None and documento_incoherente(dicho, doc)
    if contradice:
        doc_tipo = None               # ninguno de los dos: que lo resuelva él, con el número a la vista
    elif dicho is not None:
        doc_tipo = dicho              # lo dijo y es posible → se respeta, no se re-deriva

    def recortar(clave: str) -> str:
        return str(arguments.get(clave) or "").strip()[:LIMITES_CLIENTE[clave]]

    cliente = {"nombre": nombre, "doc_tipo": doc_tipo, "doc_nro": doc or None,
               "condicion_iva": None, "domicilio": recortar("domicilio") or None,
               "email": recortar("email") or None, "telefono": recortar("telefono") or None,
               "notas": recortar("notas") or None, "origen": "voz"}

    aviso = ""
    if contradice:
        # El aviso NOMBRA la contradicción en vez de decir «revisá el documento»: la persona dijo
        # «CUIT», el número no puede serlo, y lo único que la saca del error es que alguien le diga
        # exactamente eso. Un «revisalo» genérico se lee y se ignora — no tiene con qué chocar.
        palabra = "CUIT" if dicho == DOC_CUIT else "DNI"
        aviso = (f" OJO: dijo «{palabra}» pero {documento_incoherente(dicho, doc)}. Decíselo con esas "
                 f"palabras y pedile el número completo; quedó en la tarjeta para que lo corrija.")
    elif doc and doc_tipo is None:
        aviso = (f" OJO: dictó «{doc}» como documento y eso no tiene forma de CUIT (11 dígitos) ni "
                 f"de DNI (7 u 8). Pedile que lo confirme; puede corregirlo en la tarjeta.")
    return ToolResult(
        tool_call_id=idem_key, is_write=False, status="ok",
        observation={"result": f"Propuse el cliente «{nombre}» y se lo muestro en una tarjeta para "
                               f"que la revise. TODAVÍA NO está guardado: decíselo en una línea "
                               f"corta y pedile que confirme o corrija.{aviso}"},
        artifact=Artifact(kind="cliente_propuesto", data=cliente))


def _plata(monto: str) -> str:
    """`"123456.00"` → `"$123.456,00"`. Miles con punto y decimales con coma, que es como se escribe
    la plata acá — y como el LLM la va a leer en voz alta."""
    entero, _, decimales = str(monto).partition(".")
    negativo = entero.startswith("-")
    miles = f"{int(entero.lstrip('-') or 0):,}".replace(",", ".")
    return f"{'-' if negativo else ''}${miles},{(decimales or '00')[:2]:0<2}"


def _run_consultar_cliente(arguments, ctx, idem_key, cliente_store_factory):
    """«¿Cuánto me compró la panadería?» — READ puro, sin gate. **Es la tool que justifica la función.**

    🔴 **Si el nombre coincide con varios, NO elige: devuelve la lista para que el agente pregunte.**
    Contestar el número del cliente equivocado es peor que preguntar, y es peor de una manera
    particular: el emprendedor no tiene cómo notarlo. Un total plausible del cliente que no era se
    parece exactamente a la respuesta correcta.
    """
    if cliente_store_factory is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "no puedo consultar la cartera ahora mismo"})
    nombre = str(arguments.get("nombre") or "").strip()
    if not nombre:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "Preguntale de qué cliente quiere saber."})

    store = cliente_store_factory(ctx.cliente_id)
    # 6 y no 5: con el tope justo en lo que se muestra, «hay 5» y «hay más de 5» se ven igual.
    candidatos, _ = store.listar(q=nombre, limit=6)
    if not candidatos:
        return ToolResult(
            tool_call_id=idem_key, is_write=False, status="ok",
            observation={"result": f"No encontré ningún cliente que se llame «{nombre}». Puede ser "
                                   f"que todavía no esté cargado, o que figure con otro nombre: "
                                   f"preguntale cómo lo tiene anotado."})
    if len(candidatos) > 1:
        nombres = ", ".join(f"«{c['nombre']}»" for c in candidatos[:5])
        cola = " (y hay más)" if len(candidatos) > 5 else ""
        return ToolResult(
            tool_call_id=idem_key, is_write=False, status="ok",
            observation={"result": f"Hay varios que coinciden con «{nombre}»: {nombres}{cola}. "
                                   f"Preguntale a cuál se refiere. NO elijas vos.",
                         "candidatos": [{"id": c["id"], "nombre": c["nombre"]} for c in candidatos]})

    resumen = store.resumen_operaciones(candidatos[0]["id"])
    if resumen is None:      # se borró entre el listado y el detalle; no es un error del emprendedor
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": f"No pude leer la ficha de «{nombre}» ahora mismo."})

    ficha = resumen["cliente"]
    partes = []
    if resumen["facturas_atribuibles"]:
        partes.append(f"facturado {_plata(resumen['facturado'])} en {resumen['facturas']} "
                      f"factura(s)")
        if resumen["notas_credito"]:
            partes.append(f"{resumen['notas_credito']} nota(s) de crédito YA DESCONTADAS del total")
    else:
        # 🔴 El punto de toda la tool. Sin documento no hay forma de atar las facturas a este cliente,
        # y decir «0» sería afirmar que no compró. El LLM tiene que poder decir «no lo puedo saber».
        partes.append("de facturas NO tengo cómo saberlo: este cliente no tiene CUIT/DNI cargado y "
                      "las facturas se atan por documento. NO digas que no compró — decí que "
                      "falta el documento y ofrecé cargarlo")
    partes.append(f"{resumen['presupuestos']} presupuesto(s) por {_plata(resumen['presupuestado'])}")

    ultimas = "; ".join(f"{o['fecha']} {o['detalle']} {_plata(o['monto'])}"
                        for o in resumen["operaciones"]) or "sin operaciones registradas"
    return ToolResult(
        tool_call_id=idem_key, is_write=False, status="ok",
        observation={"result": f"«{ficha['nombre']}»: {'; '.join(partes)}. Últimas: {ultimas}.",
                     "cliente": ficha, "resumen": resumen})


# ── hito 3: las cuatro tools que hacen que la plata se registre HABLANDO ─────────────────────────
# Las tres funciones del hito 3 —ingresos, factura cobrada, estado del presupuesto— ya viven por
# HTTP desde los PRs #14/#15/#16. Sin estas tools sólo existen para quien abre la pantalla y toca,
# que es justamente lo que este producto existe para no pedirle.


def _fecha_dictada(fecha_raw, now_iso_provider) -> tuple:
    """`(fecha, entendida)`. La fecha que dictó, o hoy — **y si hubo que caer a hoy, lo dice.**

    El reloj es el INYECTADO, nunca `datetime.now()`: así "hoy" y "ayer" se resuelven contra el mismo
    instante, y el test no queda verde por casualidad hasta que alguien lo corre cruzando la medianoche.

    🔴 **`entendida` existe porque el resolvedor entiende menos de lo que prometemos, y medí cuánto.**
    Contra el vivo, el 2026-07-22: *«hace dos días»* —el caso textual del operador— **no se entiende**;
    *«el lunes»* tampoco, **y la description de `registrar_gasto` lo ofrece literalmente**. Sin este
    flag, el gasto de hace dos días quedaba con fecha de HOY y nadie se enteraba: no hay error, no hay
    hueco, y el número sale prolijo. Es la familia de *coherente y falso*.

    La regla del addendum: lo que no se entienda → **hoy + avisarlo**. Fallar el registro por una
    fecha ambigua pierde el gasto por un detalle corregible; inventar la fecha en silencio es peor,
    porque deja un dato preciso y falso.
    """
    fecha = hoy_del_negocio(datetime.fromisoformat(now_iso_provider()))
    if not fecha_raw:
        return fecha, True                    # no dictó fecha: hoy es lo correcto, no una suposición
    rng = resolve_date_range(fecha_raw, now_iso=now_iso_provider(), tz=DEFAULT_TZ)
    if not rng:
        return fecha, False
    return datetime.fromisoformat(rng["since"]).date(), True




def _aviso_de_fecha(entendida: bool, fecha_raw, *, hay_card: bool) -> str:
    """Lo que el copiloto dice cuando no pudo ubicar la fecha dictada — **si tiene que decir algo.**

    🔴 **Con card, no dice nada: el aviso viaja en el artifact y se pinta pegado al campo.** Preguntar
    por chat costaba dos turnos y, peor, **la respuesta volvía al MISMO resolvedor que acaba de
    fallar**: si contesta «el lunes», tampoco lo entiende, y ahí van tres turnos con el mismo error.
    Tocar la fecha en la tarjeta cuesta cero y no puede fallar, porque es una fecha elegida.

    Sin card —`registrar_ingreso` guarda directo, `marcar_factura_cobrada` también— **el chat es el
    único canal que queda**, así que ahí sí se avisa. Es la misma excepción que el modo automático.

    Y el aviso **trae la forma que funciona**, no sólo el problema: nadie lee la ayuda antes, todos
    leen el mensaje que aparece cuando algo salió raro. Es la única documentación con lectura
    garantizada.
    """
    if entendida or hay_card:
        return ""
    formas = "», «".join(FECHAS_QUE_ENTIENDO[1:4])
    return (f" OJO: no ubiqué «{fecha_raw}», así que quedó con fecha de HOY. Decíselo con esas "
            f"palabras y pedile que lo diga como «{formas}», o que lo corrija desde la pantalla.")


# Lo que el backend llama `falta`, dicho como lo diría una persona. El LLM lee esto y lo repite; si
# leyera las claves técnicas, el copiloto diría «faltó medio» — que no es español.
_FALTA_HUMANA = {"cliente": "de quién", "medio": "cómo te pagaron", "concepto": "de qué era"}


def _run_registrar_ingreso(arguments, ctx, idem_key, now_iso_provider, cobro_store_factory):
    """*«Me pagaron 85 mil»* → **queda guardado**, y recién después el copiloto dice qué faltó.

    🔴 **Guarda primero y pregunta después — al revés que `registrar_gasto`, y la asimetría es
    deliberada.** El addendum §2.bis lo fija con el diálogo textual del operador (*«Anotado, $85.000
    de hoy. No me dijiste de quién ni cómo te pagaron — ¿lo agregamos?»*) y el DoD lo mide en dos
    ítems: *se guarda* y *contestar completa el MISMO ingreso*. Un ingreso que espera confirmación
    para existir reintroduce la caja que miente: el emprendedor dicta, no toca nada, y la plata que
    entró no queda en ningún lado.

    El monto mal transcripto —el riesgo que en gastos justifica la card previa— acá se cubre por
    otro lado: el copiloto **dice el monto en voz alta** al confirmar (*«Anotado, $85.000»*), que es
    donde se escucha el error, y `DELETE /ingresos/{id}` deshace sin costo. Que borrar sea barato es
    lo que permite que guardar sea rápido.

    ⚠️ El **duplicado** sí se pregunta ANTES, y por eso está de este lado del `registrar_suelto`:
    un dato que falta se ve y se completa cuando aparezca; un ingreso de más infla la caja y no se
    ve nunca.
    """
    if cobro_store_factory is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "no puedo anotar ingresos ahora mismo"})
    monto = _monto_dictado(arguments.get("monto"))
    if monto is None:
        # `ok` y no `error`: no falló nada, falta el único dato obligatorio. Con `error` el loop se
        # disculpa; con esto puede preguntarlo y seguir. Mismo criterio que gasto y cliente.
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "Falta el monto. Preguntale cuánto fue, sin "
                                                 "repetir el resto: lo demás ya lo tengo."})

    store = cobro_store_factory(ctx.cliente_id)
    cliente = str(arguments.get("cliente") or "").strip()[:120]
    if not arguments.get("confirmar_duplicado"):
        candidato = store.posible_duplicado(monto=monto, cliente_nombre=cliente)
        if candidato:
            # No guarda y NO es un error: es una pregunta. El LLM vuelve a llamar la tool con
            # `confirmar_duplicado` si el emprendedor dice que son dos cobros distintos — él sabe
            # mejor que el sistema si le pagaron dos veces lo mismo. Avisa, no prohíbe.
            quien = f" de {candidato['cliente_nombre']}" if candidato.get("cliente_nombre") else ""
            return ToolResult(
                tool_call_id=idem_key, is_write=False, status="ok",
                observation={"result": f"OJO, todavía NO lo anoté: el {candidato['fecha']} ya "
                                       f"registré un ingreso de {_plata(candidato['monto'])}{quien}"
                                       f" ({candidato['origen']}). Preguntale si es OTRO cobro o el "
                                       f"MISMO. Si dice que es otro, volvé a llamar "
                                       f"`registrar_ingreso` con confirmar_duplicado=true.",
                             "candidato": candidato})

    fecha, fecha_ok = _fecha_dictada(arguments.get("fecha_raw"), now_iso_provider)
    ingreso = store.registrar_suelto(
        monto=monto, medio=str(arguments.get("medio_pago") or "").strip()[:40],
        fecha=fecha,
        cliente_nombre=cliente, concepto=str(arguments.get("concepto") or "").strip()[:500],
        # El `tool_call_id` como clave de idempotencia: la activity es at-least-once y un reintento
        # de Temporal con el mismo turno NO puede dejar dos ingresos. Lo garantiza el índice único
        # parcial `copiloto_cobros_idem_uk`, no un `if` — ver [[idempotencia-con-un-if-tiene-ventana]].
        idem_key=idem_key)

    falta = [_FALTA_HUMANA[c] for c in (ingreso.get("falta") or []) if c in _FALTA_HUMANA]
    aviso = (f" No te dijo {' ni '.join(falta)}: pedíselo en la MISMA línea, sin insistir. Si "
             f"contesta, usá `completar_ingreso` — NO vuelvas a llamar `registrar_ingreso`, "
             f"quedaría anotado dos veces.") if falta else ""
    # `is_write=True` acá y no en los returns de arriba: es el HECHO (esta rama persistió, las otras
    # no). El gate no se dispara por esto —depende de `WRITE_TOOLS`, donde la tool no está— así que
    # el flag puede decir la verdad sin cambiar el comportamiento.
    return ToolResult(
        tool_call_id=idem_key, is_write=True, status="ok",
        observation={"result": f"Anotado y GUARDADO: {_plata(ingreso['monto'])} del "
                               f"{ingreso['fecha']}. Confirmáselo en una línea corta diciendo el "
                               f"monto, para que pueda oír si entendí mal.{aviso}"
                               f"{_aviso_de_fecha(fecha_ok, arguments.get('fecha_raw'), hay_card=False)}",
                     "ingreso": ingreso},
        artifact=Artifact(kind="ingreso_guardado", data=ingreso))


def _run_completar_ingreso(arguments, ctx, idem_key, cobro_store_factory):
    """La respuesta al aviso: *«fue de la panadería, en efectivo»* → completa **el mismo ingreso**.

    🔴 **Sin `ingreso_id` completa el último dictado, y eso no es una comodidad: es lo que hace que
    el turno funcione.** El id viaja en la observación del turno anterior, y el historial que siembra
    el turno siguiente no garantiza conservarlo. Si esta tool dependiera de que el modelo lo recuerde,
    fallaría justo en el caso que el DoD mide —contestar el aviso— y el fallo sería *crear otro
    ingreso*, que es el daño exacto que la función viene a evitar.
    """
    if cobro_store_factory is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "no puedo completar ingresos ahora mismo"})
    datos = {}
    for clave, campo in (("cliente", "cliente_nombre"), ("medio_pago", "medio"),
                         ("concepto", "concepto")):
        # `in arguments` y no `.get()`: la clave ausente NO se toca (parcial de verdad). Con `.get()`
        # una respuesta que sólo aclara el medio borraría el cliente que ya estaba puesto.
        if clave in arguments and str(arguments[clave] or "").strip():
            datos[campo] = str(arguments[clave]).strip()
    if not datos:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "No entendí qué dato agregar. Preguntale de quién "
                                                 "fue o cómo le pagaron."})

    store = cobro_store_factory(ctx.cliente_id)
    ingreso_id = arguments.get("ingreso_id")
    if not ingreso_id:
        dictados = [i for i in store.listar_ingresos(limite=20)["ingresos"]
                    if i.get("origen") == ORIGEN_MANUAL]
        if not dictados:
            return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                              observation={"result": "No encontré un ingreso dictado reciente para "
                                                     "completar. Preguntale a cuál se refiere."})
        ingreso_id = dictados[0]["id"]

    ingreso = store.completar(int(ingreso_id), datos)
    if ingreso is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "No pude completar ese ingreso. Puede que ya no "
                                                 "esté; preguntale si lo quiere anotar de nuevo."})
    falta = [_FALTA_HUMANA[c] for c in (ingreso.get("falta") or []) if c in _FALTA_HUMANA]
    cola = f" Todavía falta {' y '.join(falta)}, pero NO se lo vuelvas a pedir." if falta else ""
    return ToolResult(tool_call_id=idem_key, is_write=True, status="ok",
                      observation={"result": f"Listo, lo agregué al MISMO ingreso de "
                                             f"{_plata(ingreso['monto'])} (no creé otro). "
                                             f"Confirmáselo en una línea.{cola}",
                                   "ingreso": ingreso})


def _elegir_uno(candidatos, etiqueta, como_se_llama):
    """Uno solo, o la lista para que el agente pregunte. **Nunca elige por su cuenta.**

    Mismo criterio que `consultar_cliente`, y por el mismo motivo: acá el error no se ve. Marcar
    cobrada la factura equivocada o desestimar el presupuesto que no era se parece exactamente a
    haber hecho lo correcto — no hay ningún síntoma que le avise al emprendedor.
    """
    if not candidatos:
        return None, f"No encontré {etiqueta}. Preguntale a cuál se refiere."
    if len(candidatos) > 1:
        nombres = ", ".join(como_se_llama(c) for c in candidatos[:5])
        cola = " (y hay más)" if len(candidatos) > 5 else ""
        return None, (f"Hay varios que coinciden: {nombres}{cola}. Preguntale a cuál se refiere. "
                      f"NO elijas vos.")
    return candidatos[0], None


def _coincide(texto: str, *campos) -> bool:
    """¿El texto dictado aparece en alguno de los campos? Comparación laxa a propósito: el
    emprendedor dice «la panadería» o «la 42», no el nombre legal ni `0001-00000042`."""
    aguja = (texto or "").strip().lower()
    if not aguja:
        return False
    return any(aguja in str(c or "").lower() for c in campos)


def _run_marcar_factura_cobrada(arguments, ctx, idem_key, now_iso_provider, cobro_store_factory):
    """*«Me pagaron la factura de la panadería»* → registra el cobro y la saca de «te deben»."""
    if cobro_store_factory is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "no puedo registrar cobros ahora mismo"})
    store = cobro_store_factory(ctx.cliente_id)
    impagas = store.impagos()["comprobantes"]
    referencia = str(arguments.get("factura") or "").strip()
    candidatos = ([c for c in impagas if _coincide(referencia, c["nro"], c["receptor_nombre"])]
                  if referencia else impagas)

    factura, problema = _elegir_uno(
        candidatos, "ninguna factura impaga que coincida",
        lambda c: f"«{c['nro']} de {c['receptor_nombre'] or 'sin nombre'} "
                  f"por {_plata(c['saldo'])}»")
    if problema:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": problema,
                                       "candidatos": [{"nro": c["nro"], "saldo": c["saldo"],
                                                       "receptor": c["receptor_nombre"]}
                                                      for c in candidatos[:6]]})

    monto = _monto_dictado(arguments.get("monto")) if arguments.get("monto") else None
    fecha, fecha_ok = _fecha_dictada(arguments.get("fecha_raw"), now_iso_provider)
    cobro, resumen = store.registrar(
        factura["id"], monto=monto, medio=str(arguments.get("medio_pago") or "").strip()[:40],
        fecha=fecha, idem_key=idem_key)          # at-least-once: el retry NO puede cobrar dos veces la factura
    queda = ("" if resumen["estado"] == COBRADA
             else f" Todavía le quedan {_plata(resumen['saldo'])} por pagar.")
    return ToolResult(
        tool_call_id=idem_key, is_write=True, status="ok",
        observation={"result": f"Registré {_plata(cobro['monto'])} de la factura {factura['nro']}"
                               f" ({factura['receptor_nombre'] or 'sin nombre'}).{queda} "
                               f"Confirmáselo en una línea corta."
                               f"{_aviso_de_fecha(fecha_ok, arguments.get('fecha_raw'), hay_card=False)}",
                     "cobro": cobro, "resumen": resumen})


def _run_marcar_presupuesto(arguments, ctx, idem_key, presupuesto_store_factory):
    """*«Me aprobaron el presupuesto de la panadería»* / *«ese no va»* → mueve el estado.

    El estado del presupuesto es lo único de la cadena que **nadie descubre solo**: la factura se
    entera cuando se emite y el cobro cuando entra la plata, pero que un presupuesto se aprobó lo
    sabe una persona y no lo sabe el sistema. Si sólo se puede marcar tocando la pantalla, en dos
    semanas todos figuran «pendientes» y el aviso de *«3 presupuestos sin respuesta»* pasa a ser
    ruido — un estado que nadie actualiza es una mentira que envejece.
    """
    if presupuesto_store_factory is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "no puedo tocar los presupuestos ahora mismo"})
    nuevo = str(arguments.get("estado") or "").strip().lower()
    if nuevo not in (APROBADO, DESESTIMADO):
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "No me quedó claro si se lo aprobaron o lo "
                                                 "descartaron. Preguntáselo."})

    store = presupuesto_store_factory(ctx.cliente_id)
    referencia = str(arguments.get("presupuesto") or "").strip()
    # Sólo los que TODAVÍA se pueden mover: si entraran los ya resueltos, «la panadería» podría
    # resolverse al presupuesto que él aprobó el mes pasado y el copiloto respondería un 409 raro
    # en vez de trabajar sobre el que está esperando respuesta.
    abiertos = [p for p in store.listar(limit=100)
                if p["estado"] in TRANSICIONES and nuevo in TRANSICIONES[p["estado"]]]
    candidatos = ([p for p in abiertos if _coincide(referencia, p["numero"],
                                                    p["receptor"]["nombre"], p["concepto"])]
                  if referencia else abiertos)

    presupuesto, problema = _elegir_uno(
        candidatos, f"ningún presupuesto que se pueda marcar como {nuevo}",
        lambda p: f"«{p['numero']} de {p['receptor']['nombre'] or 'sin nombre'} "
                  f"por {_plata(p['total'])}»")
    if problema:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": problema,
                                       "candidatos": [{"numero": p["numero"], "total": p["total"],
                                                       "receptor": p["receptor"]["nombre"]}
                                                      for p in candidatos[:6]]})
    try:
        actualizado = store.cambiar_estado(presupuesto["id"], nuevo)
    except TransicionInvalida:
        # Se movió entre que lo listamos y lo escribimos (él desde el teléfono, el copiloto por voz).
        # Error de NEGOCIO como observación, nunca excepción: una excepción acá dispara el retry del
        # loop contra algo que reintentar no arregla. Ver `agente-loop-tool-failure-retry-infinito`.
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": f"Ese presupuesto ya no está pendiente — alguien lo "
                                                 f"movió recién. Decíselo y preguntá si igual quiere "
                                                 f"marcarlo {nuevo}."})
    if actualizado is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "No pude encontrar ese presupuesto. Preguntale a "
                                                 "cuál se refiere."})
    verbo = "aprobado" if nuevo == APROBADO else "descartado"
    return ToolResult(tool_call_id=idem_key, is_write=True, status="ok",
                      observation={"result": f"Marqué el presupuesto {actualizado['numero']} de "
                                             f"{actualizado['receptor']['nombre'] or 'sin nombre'} "
                                             f"({_plata(actualizado['total'])}) como {verbo}. "
                                             f"Confirmáselo en una línea corta.",
                                   "presupuesto": actualizado})


def make_tool_executor(gateway, *, now_iso_provider, mp_dedup_factory=None, llm=None,
                       cliente_store_factory=None, cobro_store_factory=None,
                       presupuesto_store_factory=None):
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
            # ── 1ra clase: registrar_gasto (PROPONE, no persiste → sin gate; ver _FIRST_CLASS_WRITES) ─
            if kind == "gasto":
                return _run_registrar_gasto(arguments, ctx, idem_key, now_iso_provider)
            # ── 1ra clase: clientes por voz (PROPONE / READ puro → sin gate, hito 5) ──────────────
            if kind == "cliente":
                return _run_registrar_cliente(arguments, ctx, idem_key)
            if kind == "cliente_consulta":
                return _run_consultar_cliente(arguments, ctx, idem_key, cliente_store_factory)
            # ── 1ra clase: hito 3 — la plata se registra hablando (persisten; sin gate, ver TOOL_INDEX) ─
            if kind == "ingreso":
                return _run_registrar_ingreso(arguments, ctx, idem_key, now_iso_provider,
                                              cobro_store_factory)
            if kind == "ingreso_completar":
                return _run_completar_ingreso(arguments, ctx, idem_key, cobro_store_factory)
            if kind == "factura_cobrada":
                return _run_marcar_factura_cobrada(arguments, ctx, idem_key, now_iso_provider,
                                                   cobro_store_factory)
            if kind == "presupuesto_estado":
                return _run_marcar_presupuesto(arguments, ctx, idem_key, presupuesto_store_factory)

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
