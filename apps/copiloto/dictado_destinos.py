"""dictado_destinos — UNA sola definición de a qué destinos se puede dictar desde una función.

Contrato 2026-10-13 (planificación → backend + frontend1, «el dictado desde una función va por el chat»):
la pantalla de Gastos / Ingresos / Presupuestos / Clientes manda el transcript a `POST /chat` con
`kind = "dictado:<destino>"`, y el backend resuelve DIRECTO la herramienta del destino —sin «¿qué querés
hacer?»— y devuelve el `*_propuesto` que ya sabe armar.

Por qué un módulo aparte y no una constante en `web.py`: la whitelist la leen DOS consumidores
(`POST /transcribir`, que valida el `contexto`, y `POST /chat`, que parsea el `kind`) y un tercero (la
activity que angosta las tools del turno). Dos listas con los mismos cuatro valores hoy son dos listas que
mañana difieren, y el síntoma sería «dictar desde Presupuestos funciona y desde Clientes no», sin error en
ningún log. Acá está la tabla; todos derivan de ella.

Cómo viaja el destino hasta la tool, sin tocar el workflow (replay-safe): el front-door namespacea el
`channel_ref` como `dictado:<destino>:<session_id>`; el `ConversationWorkflow` ya le pasa ese `channel_ref`
a `call_llm_tools` como `session_id`, y la activity lo resuelve vía el hook `session_scope` del dominio
(`scope_de_sesion`). Un workflow por (destino, session_id) además garantiza que el dictado NUNCA aparece en
el hilo del chat: el chat pollea su propio `session_id`.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from types import MappingProxyType

_log = logging.getLogger(__name__)

KIND_PREFIJO = "dictado:"
# El namespace del `channel_ref` coincide con el del `kind` a propósito: un solo literal que reservar.
SESSION_PREFIJO = KIND_PREFIJO

# Un dictado es de UN turno (se pinta la card y se terminó): no tiene sentido una sesión de días.
IDLE_TIMEOUT_DICTADO_S = int(os.environ.get("COPILOTO_DICTADO_IDLE_TIMEOUT_S", 15 * 60))


@dataclass(frozen=True)
class DestinoDictado:
    tool: str       # herramienta del catálogo que resuelve el destino (`tool_catalog`)
    pantalla: str   # cómo se llama la función para el usuario (sólo va al prompt del turno)


# `factura` NO está, y no es casualidad: emitir es irreversible ante ARCA, así que la transcripción cruda
# no precarga nada. Las cuatro de acá son las reversibles (su tool devuelve una card, no escribe).
_DESTINOS = MappingProxyType({
    "gasto": DestinoDictado(tool="registrar_gasto", pantalla="Gastos"),
    "ingreso": DestinoDictado(tool="registrar_ingreso", pantalla="Ingresos"),
    "presupuesto": DestinoDictado(tool="registrar_presupuesto", pantalla="Presupuestos"),
    "cliente": DestinoDictado(tool="registrar_cliente", pantalla="Clientes"),
})

DESTINOS_DICTADO = _DESTINOS
CONTEXTOS_TRANSCRIBIR = frozenset(_DESTINOS)


class DestinoDictadoInvalido(ValueError):
    """`dictado:<destino>` con un destino fuera de la lista. NUNCA se degrada al flujo genérico."""


def destino_de_kind(kind: str | None) -> str | None:
    """`None` si el kind NO es un dictado (text, callback, ...). El destino si es `dictado:<destino>` válido.
    Levanta `DestinoDictadoInvalido` si es un dictado con destino fuera de la lista (incluye vacío)."""
    if not isinstance(kind, str) or not kind.startswith(KIND_PREFIJO):
        return None
    destino = kind[len(KIND_PREFIJO):]
    if destino not in _DESTINOS:
        raise DestinoDictadoInvalido(destino)
    return destino


def session_de_dictado(destino: str, session_id: str) -> str:
    """`channel_ref` efectivo del dictado. Idempotente: el cliente re-envía el que ya recibió."""
    prefijo = f"{SESSION_PREFIJO}{destino}:"
    return session_id if session_id.startswith(prefijo) else f"{prefijo}{session_id}"


def es_session_reservada(session_id: str | None) -> bool:
    return isinstance(session_id, str) and session_id.startswith(SESSION_PREFIJO)


def destino_de_session(session_id: str | None) -> str | None:
    """`None` si no es una sesión de dictado; el destino si lo es; `DestinoDictadoInvalido` si el namespace
    está pero el destino no es de la lista."""
    if not es_session_reservada(session_id):
        return None
    destino = session_id[len(SESSION_PREFIJO):].split(":", 1)[0]
    if destino not in _DESTINOS:
        raise DestinoDictadoInvalido(destino)
    return destino


def scope_de_sesion(session_id: str | None) -> dict | None:
    """Hook `session_scope` del dominio (ver `agent_runtime.register_domain`). `None` = sesión normal,
    el turno corre como siempre. Si no, `{tool_names, system_extra}`: las tools que el turno puede usar.

    Un destino del namespace que no es de la lista devuelve `tool_names=[]`: el motor responde sin llamar al
    LLM (fail-closed). No es alcanzable por el front-door (rechaza antes, 422); es la defensa en profundidad."""
    try:
        destino = destino_de_session(session_id)
    except DestinoDictadoInvalido:
        # No es un error a propagar: es el fail-closed deliberado. Sin tools el motor contesta sin LLM y
        # sin caer al catálogo completo; el front-door ya rechazó este caso con 422, así que llegar acá
        # significa que algo escribió el namespace por fuera de `/chat` — se deja rastro para verlo.
        _log.warning("dictado: sesión con destino fuera de la lista: %r", (session_id or "")[:60])
        return {"tool_names": [], "system_extra": ""}
    if destino is None:
        return None
    d = _DESTINOS[destino]
    return {
        "tool_names": [d.tool],
        "system_extra": (
            f"DICTADO DESDE LA PANTALLA DE {d.pantalla.upper()}: la persona está en esa pantalla y dictó por "
            f"voz los datos que quiere cargar. Ya se sabe qué quiere hacer: NO preguntes «¿qué querés hacer?». "
            f"Extraé del texto lo que dictó y llamá a `{d.tool}` con eso. Si falta un dato imprescindible, la "
            f"herramienta te lo va a indicar: pedí sólo ese dato, en una frase corta."),
    }
