"""Catálogo de tools del motor ReAct (capa CLIENTE). Ensambla los TOOL_SCHEMAS de los módulos de servicio
(discovery) + las 2 tools de 1ra clase (calendar_book, mp_charge), el índice tool_name→destino y el set de
writes (para el gate). Fuente única: sumar un servicio en services/*.py lo agrega acá sin editar este módulo.

El sys.path.insert del ARCH ref va ACÁ (no en cada módulo de servicio): `TOOL_INDEX`/`WRITE_TOOLS` se computan
a nivel de módulo (import time) y disparan `services.modules()` -> discovery -> import de CADA services/<x>.py,
que a su vez importa `clients.agent.providers.composio_gateway` desde el ARCH ref. Sin este insert ANTES de esa
discovery, `import tool_catalog` en aislamiento (sin otro test que ya lo haya insertado antes) haría fallar el
import de cada módulo de servicio dentro del try/except silencioso de `services._discover()` -> catálogo vacío."""
from __future__ import annotations

import sys
from pathlib import Path

import services
from services.base import Proposal

_REF = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(_REF))

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
