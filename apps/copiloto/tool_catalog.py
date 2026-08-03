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

import asyncio
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
from mi_dia_tarjeta_store import HACIENDO, HECHA, PARA_HOY, EstadoInvalido  # noqa: E402
from presupuesto_store import (APROBADO, DESESTIMADO, TRANSICIONES,  # noqa: E402
                               TransicionInvalida)
from cliente_store import (DOC_CUIT, DOC_DNI, LIMITES as LIMITES_CLIENTE,  # noqa: E402
                          documento_incoherente, es_consumidor_final, inferir_doc_tipo,
                          normalizar_documento)
# Hito 9 — facturar por voz. El gate de "completa" es la MISMA función pura que usa el workflow para
# `estado().faltantes` (afip_factura_workflow.py:99): una verdad, un solo lugar (respuesta de
# planificación al fork del turno-1, 2026-07-24). Nada de esto toca red/DB — son dataclasses + reglas.
from afip_rules import (BorradorFactura, Concepto, CondicionIVA, DatosVenta,  # noqa: E402
                        Item, Receptor, TipoDoc, determinar_tipo_comprobante, validar_factura_completa,
                        validar_perfil)
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
                   "sábado'). NO lo guarda: arma una propuesta para que él la revise y confirme. Lo "
                   "ÚNICO obligatorio es el monto — si no lo dijo, pedíselo antes de llamarla. Si lo "
                   "que cobró es una factura que ya emitió, usá `marcar_factura_cobrada` en vez de ésta.",
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

# ── hito P — presupuesto por voz (contrato hito-P) ──────────────────────────────────────────────────

REGISTRAR_PRESUPUESTO_SCHEMA = {"type": "function", "function": {
    "name": "registrar_presupuesto",
    "description": "Arma un presupuesto dictado ('hacele un presupuesto a Juan por dos sillas a 8000 "
                   "cada una', 'presupuestale a la panadería el service por 15000'). NO lo guarda: "
                   "arma una propuesta para que él la revise y confirme. Necesita de qué se trata, a "
                   "quién y al menos un ítem.",
    "parameters": {"type": "object", "properties": {
        "concepto": {"type": "string", "description": "de qué se trata el presupuesto, en pocas palabras"},
        "cliente_nombre": {"type": "string", "description": "a quién se lo hace"},
        "cliente_documento": {"type": "string", "description": "CUIT o DNI del cliente, si lo dijo"},
        "cliente_tipo_doc": {"type": "string", "enum": ["CUIT", "DNI"],
                             "description": "si dijo la palabra «CUIT» o «DNI». Omitilo si sólo dictó "
                                            "el número o no dijo documento"},
        "contacto": {"type": "string", "description": "teléfono o mail del cliente, si lo dijo"},
        "items": {"type": "array", "description": "lo que le va a vender — al menos uno",
                  "items": {"type": "object", "properties": {
                      "descripcion": {"type": "string", "description": "qué le va a vender"},
                      "cantidad": {"type": "string", "description": "cuántos, sólo el número. Si no "
                                                                     "lo dijo, asumí 1"},
                      "precio_unitario": {"type": "string", "description": "precio de cada uno, sólo "
                                                                          "el número, si lo dijo"}}}}},
        "required": ["concepto", "cliente_nombre", "items"]}}}

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

# ── hito 9 — facturar por voz (contrato §1-§2) ──────────────────────────────────────────────────────

EMITIR_FACTURA_SCHEMA = {"type": "function", "function": {
    "name": "emitir_factura",
    "description": "Arma una factura AFIP a partir de lo dictado ('facturale 50 mil a Juan por el "
                   "service', 'facturale a la panadería dos tortas a 8000 cada una'). NO la emite: "
                   "la deja lista para que él la revise y confirme desde una tarjeta, o la termine a "
                   "mano si falta algo. Necesita como mínimo a quién le factura y qué le vendió.",
    "parameters": {"type": "object", "properties": {
        "cliente_nombre": {"type": "string", "description": "a quién le factura"},
        "cliente_documento": {"type": "string", "description": "CUIT o DNI del cliente, si lo dijo"},
        "cliente_tipo_doc": {"type": "string", "enum": ["CUIT", "DNI"],
                             "description": "si dijo la palabra «CUIT» o «DNI». Omitilo si sólo dictó "
                                            "el número o no dijo documento"},
        "items": {"type": "array", "description": "lo que vendió — al menos uno",
                  "items": {"type": "object", "properties": {
                      "descripcion": {"type": "string", "description": "qué vendió"},
                      "cantidad": {"type": "string", "description": "cuántos, sólo el número. Si no "
                                                                     "lo dijo, asumí 1"},
                      "precio_unitario": {"type": "string", "description": "precio de cada uno, sólo "
                                                                          "el número"}},
                      "required": ["descripcion", "precio_unitario"]}},
        "concepto": {"type": "string", "enum": ["productos", "servicios"],
                    "description": "si vendió productos o prestó un servicio. Si no lo dijo, productos"},
        "fecha_raw": {"type": "string",
                      "description": "cuándo fue, en lenguaje natural. Entiendo: "
                                     + ", ".join(f"'{f}'" for f in FECHAS_QUE_ENTIENDO)
                                     + ". Omitilo si no lo dijo: se asume hoy."}},
        "required": ["cliente_nombre", "items"]}}}

# ── hito 7 — el Kanban "Mi día" por voz (contrato §2.4) ────────────────────────────────────────────

CREAR_TARJETA_MI_DIA_SCHEMA = {"type": "function", "function": {
    "name": "crear_tarjeta_mi_dia",
    "description": "Agrega una tarjeta a 'Mi día' cuando el emprendedor pide que le recuerden algo "
                   "('recordame llamar a Juan', 'anotá que tengo que pasar por el banco'). Es una "
                   "tarea manual, no un aviso del sistema — nace en 'Para hoy'.",
    "parameters": {"type": "object", "properties": {
        "texto": {"type": "string", "description": "la tarea, en las palabras del emprendedor"}},
        "required": ["texto"]}}}

MOVER_TARJETA_MI_DIA_SCHEMA = {"type": "function", "function": {
    "name": "mover_tarjeta_mi_dia",
    "description": "Cambia de columna una tarjeta de 'Mi día' cuando el emprendedor cuenta que "
                   "arrancó o terminó algo ('ya llamé a Juan', 'estoy yendo al banco'). Sólo para "
                   "tarjetas SIN acción rastreable por el sistema (las que sí tienen — cobrar una "
                   "factura, responder un presupuesto — se cierran solas al hacerse).",
    "parameters": {"type": "object", "properties": {
        "tarjeta": {"type": "string", "description": "cómo la nombró: alguna palabra del texto de la tarjeta"},
        "estado": {"type": "string", "enum": [PARA_HOY, HACIENDO, HECHA],
                   "description": "a qué columna la mueve"}},
        "required": ["tarjeta", "estado"]}}}

BORRAR_TARJETA_MI_DIA_SCHEMA = {"type": "function", "function": {
    "name": "borrar_tarjeta_mi_dia",
    "description": "Borra una tarjeta de 'Mi día' cuando el emprendedor pide que la saque ('sacá lo "
                   "de Juan', 'borrá esa tarjeta'). Irreversible — si hay más de una que coincide, "
                   "no elige sola, pregunta.",
    "parameters": {"type": "object", "properties": {
        "tarjeta": {"type": "string", "description": "cómo la nombró: alguna palabra del texto de la tarjeta"}},
        "required": ["tarjeta"]}}}

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
# el catálogo que se le arma al LLM (`build_tool_catalog()`, NO `TOOL_INDEX`). La distinción costó un
# bug 2026-07-22: filtrar por `TOOL_INDEX` publicaba `consultar_cliente` en la guía DESPUÉS de podarla
# del catálogo, porque una tool podada conserva su entrada de índice. Entonces la poda del hito 2 y el
# alta de `emitir_factura` (hito 9) actualizan la guía **solas**, y el DoD «los ejemplos coinciden con
# lo que existe» pasa a ser cierto por construcción — verificar a mano funciona una vez.
#
# `_CAPACIDADES` puede listar tools que HOY no están en el catálogo (`emitir_factura`, hito 9): el
# filtro las excluye hasta que existan, y el día que se agreguen aparecen solas. Lo que NO puede es
# listar algo que ya no va a volver — por eso `consultar_cliente` se sacó de acá cuando la poda la
# retiró: dejarla sería prometer una fila muerta que el filtro esconde pero el próximo lector cree viva.
_CAPACIDADES = (
    ("registrar_gasto", "Gastos", ("pagué 15 mil de mercadería", "gasté 3.000 en nafta ayer")),
    ("registrar_ingreso", "Ingresos", ("me pagaron 85 mil",
                                       "cobré 40 mil de la panadería en efectivo")),
    ("marcar_factura_cobrada", "Facturas", ("me pagaron la factura 42",)),
    ("marcar_presupuesto", "Presupuestos", ("me aprobaron el de la panadería",)),
    ("registrar_presupuesto", "Presupuestos", ("hacele un presupuesto a Juan por dos sillas a 8000",)),
    ("registrar_cliente", "Clientes", ("anotá un cliente, Panadería Los Tilos",)),
    ("crear_tarjeta_mi_dia", "Mi día", ("recordame llamar a Juan",)),
    ("mover_tarjeta_mi_dia", "Mi día", ("ya llamé a Juan",)),
    ("borrar_tarjeta_mi_dia", "Mi día", ("sacá lo de Juan",)),
    # `emitir_factura` queda declarada aunque todavía no exista (hito 9): es una capacidad FUTURA que
    # aparecerá sola. Es el control vivo del guard `test_facturar_por_voz_NO_esta_en_la_guia_todavia`
    # — sin una entrada así, el filtro pasaría siempre sin filtrar nada.
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
               MARCAR_FACTURA_COBRADA_SCHEMA, MARCAR_PRESUPUESTO_SCHEMA,
               REGISTRAR_PRESUPUESTO_SCHEMA,
               EMITIR_FACTURA_SCHEMA,
               CREAR_TARJETA_MI_DIA_SCHEMA, MOVER_TARJETA_MI_DIA_SCHEMA,
               BORRAR_TARJETA_MI_DIA_SCHEMA]
    for mod in services.modules().values():
        schemas.extend(mod.TOOL_SCHEMAS)
    return schemas


# consultar_actividad NO va en WRITE_TOOLS a propósito: es read puro (recall + resumen) → sin gate HITL.
TOOL_INDEX = {**_service_index(), "calendar_book": ("calendar",), "mp_charge": ("mp",),
              "consultar_actividad": ("activity",), "registrar_gasto": ("gasto",),
              # Ninguna de las dos va en WRITE_TOOLS: `registrar_cliente` PROPONE (el POST lo dispara
              # el emprendedor al tocar Guardar) y `consultar_cliente` es read puro.
              "registrar_cliente": ("cliente",), "consultar_cliente": ("cliente_consulta",),
              # De las cuatro del hito 3, sólo `marcar_factura_cobrada`/`marcar_presupuesto` PERSISTEN
              # directo (transiciones de estado, no formularios). `registrar_ingreso` pasó a PROPONER
              # (hito 8 §1, revierte el guarda-primero de §2.bis — relocalizado al modo automático,
              # contrato §4); `completar_ingreso` sigue viva sólo para esa rama futura. Ninguna va en
              # WRITE_TOOLS: el confirm-gate es sí/no sobre los MISMOS argumentos, y acá no protege de
              # nada —el riesgo real no es "¿lo hago?" sino "¿a cuál?", ya cubierto por `_elegir_uno`,
              # que se niega a elegir— y sólo agrega la fricción que el addendum §2 prohíbe. Todo esto
              # es reversible: borrar el ingreso, deshacer el cobro, volver a mover el presupuesto.
              "registrar_ingreso": ("ingreso",), "completar_ingreso": ("ingreso_completar",),
              "marcar_factura_cobrada": ("factura_cobrada",),
              "marcar_presupuesto": ("presupuesto_estado",),
              # Hito P — PROPONE, igual que `registrar_cliente`: el POST /presupuestos lo dispara el
              # emprendedor al tocar Guardar desde la card, no la tool.
              "registrar_presupuesto": ("presupuesto",),
              # Hito 7 — mismo criterio que arriba: PERSISTEN, sin gate (el riesgo es "¿a cuál
              # tarjeta?", cubierto por `_elegir_uno`, no "¿lo hago?").
              "crear_tarjeta_mi_dia": ("mi_dia_crear",),
              "mover_tarjeta_mi_dia": ("mi_dia_mover",),
              "borrar_tarjeta_mi_dia": ("mi_dia_borrar",),
              # Hito 9 — PROPONE, igual que `registrar_gasto`/`registrar_ingreso`: emitir es un acto
              # fiscal irreversible, así que ni siquiera en confirm-gate sí/no — la única acción que
              # persiste algo (abrir el borrador) la dispara la propia tool, pero el borrador NO emite
              # nada hasta que el usuario toca Emitir desde la card (gate de dominio: token_confirmacion).
              "emitir_factura": ("factura_dictado",)}
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
        # perdería creyendo los dos que estaba hecho. [[copiloto-narra-la-accion-sin-ejecutarla]] spike (b):
        # la instrucción en prosa ("decíselo en una línea corta") dejaba que el LLM parafraseara con
        # "anoté...revisalo" (verbo de hecho consumado) — medido en device, 2/2 turnos siguientes lo
        # imitaban. Ahora se prohíbe el verbo explícitamente y se da la frase EXACTA a relayar.
        observation={"result": f"Propuse el gasto (${gasto['monto']}, {categoria}) y se lo muestro en "
                               f"una tarjeta para que la revise. TODAVÍA NO está guardado — NO digas "
                               f"\"anoté\", \"listo\" ni \"guardado\" porque no es cierto. Decile "
                               f"exactamente: \"Te armé un borrador de ${gasto['monto']} en {categoria}, "
                               f"revisalo y confirmalo cuando quieras.\""
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
        # spike (b) [[copiloto-narra-la-accion-sin-ejecutarla]]: mismo patrón que registrar_gasto —
        # verbo prohibido explícito + frase exacta para relayar, en vez de una instrucción en prosa
        # que el LLM parafraseaba a "anoté" (verbo de hecho consumado).
        observation={"result": f"Propuse el cliente «{nombre}» y se lo muestro en una tarjeta para "
                               f"que la revise. TODAVÍA NO está guardado — NO digas \"anoté\", "
                               f"\"listo\" ni \"guardado\" porque no es cierto. Decile exactamente: "
                               f"\"Te armé un borrador de {nombre}, revisalo y confirmalo cuando "
                               f"quieras.\"{aviso}"},
        artifact=Artifact(kind="cliente_propuesto", data=cliente))


def _run_registrar_presupuesto(arguments, ctx, idem_key):
    """Propone un presupuesto dictado. NO persiste — mismo patrón que `registrar_gasto`/`registrar_cliente`
    (contrato hito-P). El receptor reutiliza la MISMA inferencia de `doc_tipo` que `_run_registrar_cliente`:
    lo dicho por la persona ("CUIT"/"DNI") gana sobre lo que el largo del número sugiere, y cuando
    contradicen no gana ninguno — gana la pregunta (mismo caso medido en el vivo, documentado ahí).
    """
    concepto = str(arguments.get("concepto") or "").strip()[:200]
    cliente_nombre = str(arguments.get("cliente_nombre") or "").strip()[:LIMITES_CLIENTE["nombre"]]
    items_dictados = [it for it in (arguments.get("items") or []) if isinstance(it, dict)]

    faltantes = []
    if not concepto:
        faltantes.append("de qué se trata")
    if not cliente_nombre:
        faltantes.append("a quién")
    if not items_dictados:
        faltantes.append("al menos un ítem")
    if faltantes:
        # `ok` y no `error` — mismo criterio que `_run_registrar_cliente`: no falló nada, falta un dato
        # obligatorio. Emitir la card igual sería peor: el validador del kind la descarta en silencio
        # (§2 del contrato) y el emprendedor ve una respuesta vacía sin saber por qué.
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": f"Falta {' y '.join(faltantes)} para armar el "
                                                 f"presupuesto. Preguntáselo antes de seguir."})

    doc = normalizar_documento(arguments.get("cliente_documento"))[:LIMITES_CLIENTE["doc_nro"]]
    doc_tipo = inferir_doc_tipo(doc) if doc else None
    if es_consumidor_final(doc_tipo):
        doc_tipo, doc = None, ""

    dicho = {"CUIT": DOC_CUIT, "DNI": DOC_DNI}.get(str(arguments.get("cliente_tipo_doc") or "").upper())
    contradice = bool(doc) and dicho is not None and documento_incoherente(dicho, doc)
    if contradice:
        doc_tipo = None
    elif dicho is not None:
        doc_tipo = dicho

    contacto = str(arguments.get("contacto") or "").strip()[:120] or None
    receptor = {"nombre": cliente_nombre, "doc_tipo": doc_tipo, "doc_nro": doc or None,
               "contacto": contacto}

    items = []
    for it in items_dictados:
        # Un ítem sin descripción NO se descarta — decisión explícita del operador (§1 del contrato):
        # viaja igual, vacío y editable, para que se corrija en la card en vez de desaparecer.
        precio = _monto_dictado(it.get("precio_unitario"))
        cantidad = _monto_dictado(it.get("cantidad")) or Decimal("1")
        items.append({"descripcion": str(it.get("descripcion") or "").strip()[:200],
                      "cantidad": dos_decimales(cantidad),
                      # Sin precio dictado → "" (blanco en la card), NUNCA inventado (§2 del contrato).
                      "precio_unitario": dos_decimales(precio) if precio is not None else ""})

    aviso = ""
    if contradice:
        palabra = "CUIT" if dicho == DOC_CUIT else "DNI"
        aviso = (f" OJO: dijo «{palabra}» pero {documento_incoherente(dicho, doc)}. Decíselo con esas "
                 f"palabras y pedile el número completo; quedó en la tarjeta para que lo corrija.")
    elif doc and doc_tipo is None:
        aviso = (f" OJO: dictó «{doc}» como documento y eso no tiene forma de CUIT (11 dígitos) ni "
                 f"de DNI (7 u 8). Pedile que lo confirme; puede corregirlo en la tarjeta.")

    return ToolResult(
        tool_call_id=idem_key, is_write=False, status="ok",
        # spike (b) [[copiloto-narra-la-accion-sin-ejecutarla]]: mismo patrón que registrar_gasto/cliente
        # — verbo prohibido explícito + frase exacta para relayar.
        observation={"result": f"Propuse un presupuesto de «{concepto}» para {cliente_nombre} y se lo "
                               f"muestro en una tarjeta para que la revise. TODAVÍA NO está guardado — "
                               f"NO digas \"anoté\", \"listo\" ni \"guardado\" porque no es cierto. "
                               f"Decile exactamente: \"Te armé un borrador de presupuesto para "
                               f"{cliente_nombre}, revisalo y confirmalo cuando quieras.\"{aviso}"},
        artifact=Artifact(kind="presupuesto_propuesto",
                          data={"concepto": concepto, "receptor": receptor, "items": items}))


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
    """*«Me pagaron 85 mil»* → propone, igual que `registrar_gasto`.

    🔴 **Hito 8 §1 revierte el guarda-primero del addendum §2.bis a propósito** (decisión del
    operador, MAYOR, tomada — contrato `hito8-card-para-todo...`): con cards para todo, el guardado
    directo dejó de ser la protección contra "la caja que miente" — ahora lo es la card editable
    misma. La doctrina de §2.bis no se pierde: se **relocaliza** al modo automático (contrato §4),
    donde si hay confirmación por voz, no hay card que corrija, y ahí SÍ hace falta guardar rápido y
    barato-de-deshacer. Hoy el modo es siempre confirmación, así que esta tool siempre propone.

    ⚠️ El **duplicado** sigue preguntándose ANTES de construir la card — no es un dato que falte y
    se vea en pantalla para corregir: es un ingreso de más que, si se muestra en una card ya
    prellenada, es fácil de confirmar sin mirar. Mismo criterio que antes, sólo que ahora "actuar"
    es armar la card en vez de persistir.
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
            # No arma la card y NO es un error: es una pregunta. El LLM vuelve a llamar la tool con
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

    def recortar(clave: str, tope: int) -> str:
        return str(arguments.get(clave) or "").strip()[:tope]

    # Mismos campos que `registrar_suelto` devolvía, sin `id` (contrato DoD): la card no persiste, y
    # la app hace el `POST /ingresos` (`afip_web.py`, ya existe) recién al Guardar.
    ingreso = {"monto": dos_decimales(monto), "fecha": fecha.isoformat(),
               "fecha_entendida": fecha_ok,
               "fecha_dictada": (arguments.get("fecha_raw") or "") if not fecha_ok else "",
               "medio": recortar("medio_pago", 40) or None, "cliente_nombre": cliente or None,
               "concepto": recortar("concepto", 500) or None, "origen": "voz"}
    return ToolResult(
        tool_call_id=idem_key, is_write=False, status="ok",
        # Mismo verbo prohibido que gasto/cliente [[copiloto-narra-la-accion-sin-ejecutarla]]: con la
        # card en pantalla, "anoté"/"listo"/"guardado" son falsos hasta que el emprendedor confirma.
        observation={"result": f"Propuse el ingreso (${ingreso['monto']}) y se lo muestro en una "
                               f"tarjeta para que la revise. TODAVÍA NO está guardado — NO digas "
                               f"\"anoté\", \"listo\" ni \"guardado\" porque no es cierto. Decile "
                               f"exactamente: \"Te armé un borrador de ${ingreso['monto']}, revisalo "
                               f"y confirmalo cuando quieras.\""
                               f"{_aviso_de_fecha(fecha_ok, arguments.get('fecha_raw'), hay_card=True)}"},
        artifact=Artifact(kind="ingreso_propuesto", data=ingreso))


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


# ── hito 9 — facturar por voz (contrato §1-§2) ──────────────────────────────────────────────────────

def factura_id_del_dictado(idem_key: str) -> str:
    """El `factura_id` del borrador que nace de UN DICTADO — DETERMINÍSTICO, no un `uuid4()`.

    Deriva de `idem_key` (`{workflow_id}-{turn_ix}-{step}`, ya armado por el motor react): `turn_ix`
    es global/monótono y sobrevive un continue-as-new real, verificado contra Temporal real (no
    deducido) por `test_turn_ix_sobrevive_continue_as_new_contra_temporal_real` — el spike bloqueante
    del contrato §4. Mismo criterio que `factura_id_de_presupuesto` (`presupuesto_store.py:82-99`):
    Temporal decide la idempotencia en el servidor, atómico, sin ventana `if ya_existe`.
    """
    return f"dictado-{idem_key}"


def _borrador_desde_dictado(arguments: dict, now_iso_provider) -> BorradorFactura:
    """Arma el `BorradorFactura` (dataclasses PURAS de `afip_rules`) con lo que dictó la voz, para
    correr `validar_factura_completa` — la MISMA función que usa el workflow. Nada de esto persiste.

    `now_iso_provider` viaja tal cual —MISMO criterio que `_run_registrar_gasto`/`_fecha_dictada`—, no
    un `date` ya resuelto: `_fecha_dictada` también llama a `resolve_date_range`, que espera el ISO
    completo, no sólo la fecha."""
    items = []
    for it in (arguments.get("items") or []):
        if not isinstance(it, dict):
            continue
        precio = _monto_dictado(it.get("precio_unitario"))
        cantidad = _monto_dictado(it.get("cantidad")) or Decimal("1")
        items.append(Item(descripcion=str(it.get("descripcion") or "").strip()[:200],
                          cantidad=cantidad, precio_unitario=precio or Decimal("0")))

    concepto = Concepto.SERVICIOS if arguments.get("concepto") == "servicios" else Concepto.PRODUCTOS
    fecha, fecha_ok = _fecha_dictada(arguments.get("fecha_raw"), now_iso_provider)
    datos_venta = DatosVenta(fecha=fecha, concepto=concepto, condicion_venta="Contado")

    nombre = str(arguments.get("cliente_nombre") or "").strip()[:200]
    doc = str(arguments.get("cliente_documento") or "").strip()
    tipo_doc_dicho = str(arguments.get("cliente_tipo_doc") or "").strip().upper()
    if doc and tipo_doc_dicho == "CUIT":
        receptor = Receptor(condicion_iva=CondicionIVA.CONSUMIDOR_FINAL, tipo_doc=TipoDoc.CUIT,
                            nro_doc=doc, nombre=nombre or "Consumidor Final")
    elif doc and tipo_doc_dicho == "DNI":
        receptor = Receptor(condicion_iva=CondicionIVA.CONSUMIDOR_FINAL, tipo_doc=TipoDoc.DNI,
                            nro_doc=doc, nombre=nombre or "Consumidor Final")
    else:
        # Sin documento identificable: consumidor final. `validar_receptor` sólo lo bloquea por encima
        # del tope (`TOPE_CONSUMIDOR_FINAL_SIN_IDENTIFICAR`) — la mayoría de las facturas dictadas caen
        # bien acá, no es un estado degradado (respuesta de planificación al fork del turno-1).
        receptor = Receptor(condicion_iva=CondicionIVA.CONSUMIDOR_FINAL,
                            nombre=nombre or "Consumidor Final")
    return BorradorFactura(datos_venta=datos_venta, items=items, receptor=receptor)


def _run_emitir_factura(arguments, ctx, idem_key, now_iso_provider,
                        afip_cred_store_factory, afip_perfil_store_factory,
                        abrir_borrador_dictado, consultar_factura_dictado, signal_factura_dictado,
                        buscar_borrador_dictado):
    """*«Facturale 50 mil a Juan»* → arma el borrador AFIP y lo propone en una card — NO emite. Mismo
    patrón que `registrar_gasto`/`registrar_ingreso`: emitir es un acto fiscal irreversible, así que la
    acción la dispara el usuario desde la card (Emitir con token fresco, o Completar a mano).

    Gate de "completa" — CERO heurística propia: se arma un `BorradorFactura` con lo dictado y corre
    `validar_factura_completa`, la MISMA función pura que calcula `faltantes` en
    `FacturaWorkflow.estado()` (`afip_factura_workflow.py:99`). Una verdad, un solo lugar (respuesta de
    planificación al fork del turno-1).

    Mecanismo de 2 pasos (contrato §1 + respuesta de planificación al fork del turno-2):
    1ª vez incompleta → PREGUNTA, sin card (pero el borrador SÍ se abre, silencioso — es lo que el
    turno 2 va a encontrar). 2ª vez (hay borrador abierto para este cliente) → CARD siempre, completa
    o no. `buscar_borrador_dictado` es Visibility de Temporal (no una tabla nueva) acotada por
    `StartTime` — ver su docstring en `web.py` para el porqué de la ventana.
    """
    if (abrir_borrador_dictado is None or consultar_factura_dictado is None
            or signal_factura_dictado is None or afip_cred_store_factory is None
            or afip_perfil_store_factory is None or buscar_borrador_dictado is None):
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "no puedo facturar por voz ahora mismo"})

    cuit = afip_cred_store_factory(ctx.cliente_id).primer_cuit()
    perfil = afip_perfil_store_factory(ctx.cliente_id).get(cuit) if cuit else None
    errores_perfil = validar_perfil(perfil)
    if errores_perfil:
        # Mensaje de negocio (DoD §5.5): el turno no se cae, y no es algo que se resuelva re-dictando.
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": errores_perfil[0].mensaje})

    hoy = hoy_del_negocio(datetime.fromisoformat(now_iso_provider()))
    borrador = _borrador_desde_dictado(arguments, now_iso_provider)
    errores_dictado = validar_factura_completa(perfil, borrador, hoy=hoy)

    async def _flujo():
        factura_id_existente = await buscar_borrador_dictado(ctx.cliente_id)
        continuando = factura_id_existente is not None
        factura_id = factura_id_existente or factura_id_del_dictado(idem_key)
        estado_previo = None
        if continuando:
            estado_previo = await consultar_factura_dictado(ctx.cliente_id, factura_id)
        else:
            # Segunda red (reutiliza `presupuestos_web.py:314-323`): `id_conflict_policy=FAIL` sólo
            # protege contra un run CORRIENDO — el default de `id_reuse_policy` (ALLOW_DUPLICATE,
            # validado contra doc oficial) permitiría reabrir sobre un id ya COMPLETADO con CAE. Con
            # `turn_ix` nuevo por turno esto es un borde de retry, no el camino normal — se cubre igual.
            previo = await consultar_factura_dictado(ctx.cliente_id, factura_id)
            if previo and (previo.get("resultado") or {}).get("cae"):
                return "ya_emitida", None, continuando, factura_id
            await abrir_borrador_dictado(ctx.cliente_id, cuit, factura_id)

        await signal_factura_dictado(ctx.cliente_id, factura_id, "cargar_datos_venta", {
            "fecha": borrador.datos_venta.fecha.isoformat(),
            "concepto": int(borrador.datos_venta.concepto),
            "condicion_venta": borrador.datos_venta.condicion_venta})
        # `agregar_item` ACUMULA, no reemplaza (mismo comentario que `presupuestos_web.py:327-329`):
        # sólo se cargan items si el borrador TODAVÍA no tiene ninguno, para no duplicarlos en la
        # continuación del turno 2. Limitación conocida: si el turno 2 corrige un ítem del turno 1
        # (no agrega uno nuevo), esa corrección no se aplica acá — se termina a mano en la pantalla.
        if borrador.items and not (estado_previo and estado_previo.get("items")):
            for item in borrador.items:
                await signal_factura_dictado(ctx.cliente_id, factura_id, "agregar_item", {
                    "descripcion": item.descripcion, "cantidad": str(item.cantidad),
                    "precio_unitario": str(item.precio_unitario)})
        await signal_factura_dictado(ctx.cliente_id, factura_id, "cargar_cliente", {
            "condicion_iva": int(borrador.receptor.condicion_iva),
            "tipo_doc": int(borrador.receptor.tipo_doc),
            "nro_doc": borrador.receptor.nro_doc, "nombre": borrador.receptor.nombre})

        estado = await consultar_factura_dictado(ctx.cliente_id, factura_id)
        return "ok", estado, continuando, factura_id

    resultado, estado, continuando, factura_id = asyncio.run(_flujo())
    if resultado == "ya_emitida":
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "esa factura ya se había emitido; no la reabrí"})

    faltantes_codigos = [e.get("codigo") for e in (estado.get("faltantes") or []) if e.get("codigo")]
    if faltantes_codigos and not continuando:
        # 1ª vez incompleta (DoD §5.1): pregunta, SIN card — el borrador quedó abierto (silencioso)
        # para que ESTA MISMA función lo encuentre si el emprendedor sigue dictando.
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": errores_dictado[0].mensaje if errores_dictado
                                                  else "Faltan datos para facturar."})

    tipo_comprobante = determinar_tipo_comprobante(perfil, borrador.receptor).name if perfil else None
    total = estado.get("total") or "0.00"
    completa = not faltantes_codigos
    texto_card = (f"Te armé la factura por ${total}, revisala y confirmala cuando quieras." if completa
                 else f"Esto entendí de la factura (${total}). Faltan datos — revisala y completala a mano.")
    return ToolResult(
        tool_call_id=idem_key, is_write=False, status="ok",
        observation={"result": f"Armé la factura (${total}) y se la muestro en una tarjeta para que "
                               f"la revise. TODAVÍA NO está emitida — NO digas \"emití\", \"listo\" ni "
                               f"\"la mandé\" porque no es cierto. Decile exactamente EXACTAMENTE: "
                               f"\"{texto_card}\""},
        artifact=Artifact(kind="factura_propuesta", data={
            "factura_id": factura_id, "faltantes": faltantes_codigos,
            "items": estado.get("items") or [],
            "cliente": {"razon_social": borrador.receptor.nombre,
                       "cuit": (borrador.receptor.nro_doc
                               if borrador.receptor.tipo_doc != TipoDoc.CONSUMIDOR_FINAL else None),
                       "condicion_iva": borrador.receptor.condicion_iva.name},
            "total": total, "tipo_comprobante": tipo_comprobante}))


# ── hito 7 — el Kanban "Mi día" por voz (contrato §2.4) ────────────────────────────────────────────
#
# Las tres PERSISTEN sin gate — mismo criterio que las del hito 3 (TOOL_INDEX): el riesgo real de
# `mover`/`borrar` no es "¿lo hago?" sino "¿a cuál tarjeta?", y eso lo cubre `_elegir_uno`. `crear`
# no tiene ese riesgo (siempre es una fila nueva). Todo reversible salvo `borrar` — de ahí el
# `EstadoInvalido` explícito en `mover` y que `borrar` nunca reintenta sobre un `id` adivinado.

def _tarjetas_activas(tarjeta_store) -> list[dict]:
    """`para_hoy` + `haciendo` — las que un swipe o una orden de voz todavía pueden tocar. Las
    `hecha` quedan afuera: mover o borrar algo que ya se cerró sería reabrir un caso resuelto."""
    tablero = tarjeta_store.listar_tablero()
    return tablero.get(PARA_HOY, []) + tablero.get(HACIENDO, [])


def _run_crear_tarjeta_mi_dia(arguments, ctx, idem_key, tarjeta_store_factory):
    """*«Recordame llamar a Juan»* → tarjeta manual en 'Para hoy' (contrato §2.4)."""
    if tarjeta_store_factory is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "no puedo tocar Mi día ahora mismo"})
    texto = str(arguments.get("texto") or "").strip()
    if not texto:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "No entendí qué anotar. Preguntale qué tarea es."})
    tarjeta = tarjeta_store_factory(ctx.cliente_id).crear_manual(texto)
    return ToolResult(tool_call_id=idem_key, is_write=True, status="ok",
                      observation={"result": f"Anoté «{texto}» en Mi día. Confirmáselo en una línea "
                                             f"corta.", "tarjeta": tarjeta})


def _run_mover_tarjeta_mi_dia(arguments, ctx, idem_key, tarjeta_store_factory):
    """*«Ya llamé a Juan»* → mueve la tarjeta de columna."""
    if tarjeta_store_factory is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "no puedo tocar Mi día ahora mismo"})
    nuevo = str(arguments.get("estado") or "").strip().lower()
    if nuevo not in (PARA_HOY, HACIENDO, HECHA):
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "No me quedó claro a qué columna moverla. "
                                                 "Preguntale."})
    store = tarjeta_store_factory(ctx.cliente_id)
    referencia = str(arguments.get("tarjeta") or "").strip()
    candidatos = ([t for t in _tarjetas_activas(store) if _coincide(referencia, t["texto"])]
                  if referencia else _tarjetas_activas(store))

    tarjeta, problema = _elegir_uno(
        candidatos, "ninguna tarjeta activa que coincida", lambda t: f"«{t['texto']}»")
    if problema:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": problema,
                                       "candidatos": [{"id": t["id"], "texto": t["texto"]}
                                                      for t in candidatos[:6]]})
    try:
        actualizada = store.mover(tarjeta["id"], nuevo)
    except EstadoInvalido:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "Ese estado no es válido. Preguntale de nuevo."})
    return ToolResult(tool_call_id=idem_key, is_write=True, status="ok",
                      observation={"result": f"Moví «{actualizada['texto']}» a {nuevo}. "
                                             f"Confirmáselo en una línea corta.",
                                   "tarjeta": actualizada})


def _run_borrar_tarjeta_mi_dia(arguments, ctx, idem_key, tarjeta_store_factory):
    """*«Sacá lo de Juan»* → borra la tarjeta. Irreversible: `_elegir_uno` nunca elige sola."""
    if tarjeta_store_factory is None:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "no puedo tocar Mi día ahora mismo"})
    store = tarjeta_store_factory(ctx.cliente_id)
    referencia = str(arguments.get("tarjeta") or "").strip()
    candidatos = ([t for t in _tarjetas_activas(store) if _coincide(referencia, t["texto"])]
                  if referencia else _tarjetas_activas(store))

    tarjeta, problema = _elegir_uno(
        candidatos, "ninguna tarjeta activa que coincida", lambda t: f"«{t['texto']}»")
    if problema:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": problema,
                                       "candidatos": [{"id": t["id"], "texto": t["texto"]}
                                                      for t in candidatos[:6]]})
    ok = store.borrar(tarjeta["id"])
    if not ok:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"result": "Esa tarjeta ya no estaba — alguien la borró recién."})
    return ToolResult(tool_call_id=idem_key, is_write=True, status="ok",
                      observation={"result": f"Borré «{tarjeta['texto']}» de Mi día. Confirmáselo en "
                                             f"una línea corta."})


def make_tool_executor(gateway, *, now_iso_provider, mp_dedup_factory=None, llm=None,
                       cliente_store_factory=None, cobro_store_factory=None,
                       presupuesto_store_factory=None, tarjeta_store_factory=None,
                       afip_cred_store_factory=None, afip_perfil_store_factory=None,
                       abrir_borrador_dictado=None, consultar_factura_dictado=None,
                       signal_factura_dictado=None, buscar_borrador_dictado=None):
    """Ejecuta UNA tool y devuelve ToolResult. El gate lo abre el propio executor (write sin confirmed →
    needs_confirmation SIN ejecutar). Errores de negocio → status='error' (nunca excepción → retry ∞).
    `llm` (opcional): el LlmProvider compartido que usa `consultar_actividad` para resumir la actividad.

    Los últimos 6 params (hito 9) son las 4 factories de Temporal + 2 de Postgres que necesita
    `emitir_factura`. Sin `client` en el composition root (tests, wiring puro) quedan en `None` y la
    tool degrada con error de negocio — mismo criterio que `cobro_store_factory is None`."""

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
            # ── 1ra clase: hito P — presupuesto por voz (PROPONE, no persiste → sin gate) ───────────
            if kind == "presupuesto":
                return _run_registrar_presupuesto(arguments, ctx, idem_key)
            # ── 1ra clase: hito 9 — facturar por voz (PROPONE; ver TOOL_INDEX) ─────────────────────
            if kind == "factura_dictado":
                return _run_emitir_factura(arguments, ctx, idem_key, now_iso_provider,
                                           afip_cred_store_factory, afip_perfil_store_factory,
                                           abrir_borrador_dictado, consultar_factura_dictado,
                                           signal_factura_dictado, buscar_borrador_dictado)
            # ── 1ra clase: hito 7 — el Kanban "Mi día" por voz (persisten; sin gate, ver TOOL_INDEX) ─
            if kind == "mi_dia_crear":
                return _run_crear_tarjeta_mi_dia(arguments, ctx, idem_key, tarjeta_store_factory)
            if kind == "mi_dia_mover":
                return _run_mover_tarjeta_mi_dia(arguments, ctx, idem_key, tarjeta_store_factory)
            if kind == "mi_dia_borrar":
                return _run_borrar_tarjeta_mi_dia(arguments, ctx, idem_key, tarjeta_store_factory)

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
