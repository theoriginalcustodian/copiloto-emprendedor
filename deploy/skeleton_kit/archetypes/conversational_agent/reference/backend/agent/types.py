"""Contratos AGNOSTICOS del agente conversacional durable (capa PLANTILLA, cosechable al skeleton_kit).

Cero dominio: ni clinica, ni Telegram. Define las formas de datos que viajan entre el canal (adapter),
el motor durable (ConversationWorkflow) y el dispatcher del dominio. Un agente de OTRO dominio reusa este
modulo tal cual; solo cambia el system prompt + el dispatcher + las tools (la capa cliente).

Serializacion: los workflows/activities de Temporal pasan dict JSON-serializable. Estas dataclasses son
para el codigo NO-workflow (adapter, dispatcher, tests); en los boundaries de Temporal se pasan dicts via
`.to_dict()` / `from_dict()`.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict


# ── Acciones que el LLM puede emitir (intent). AGNOSTICAS del dominio: un agente de turnos, de soporte o
#    de ventas usan el mismo verbo-set base. El dominio decide que hace con cada una (en su dispatcher). ──
ACTIONS = (
    "book", "reschedule", "cancel", "ask_info", "clarify",
    "confirm_pending", "out_of_scope", "emergency", "escalate_human",
    "callback",   # el interlocutor tocó un botón (inline keyboard); el valor va en entities['value'] — sin LLM
    "tool_action",  # agente multi-servicio: ejecutar una tool de un servicio; entities={service, op, ...} (ver dispatcher del dominio)
    "mp_charge",  # capacidad de 1ra clase con gateway PROPIO (cobro MercadoPago), como 'book' con Calendar; entities={amount, concept}
    "consultar_actividad",  # consultar la actividad de un rango de fecha libre (recall temporal); entities={range_raw, question}
)

# Acciones que SIEMPRE escalan a un humano (HITL), sea cual sea el dominio.
ESCALATING_ACTIONS = ("emergency", "escalate_human")


@dataclass
class NormalizedMessage:
    """Mensaje entrante normalizado por un ChannelAdapter. El motor es ciego al canal de origen."""
    channel: str          # 'telegram' | 'whatsapp' | 'voice' | ...
    channel_ref: str      # id estable del interlocutor en ese canal (chat_id de Telegram, msisdn, ...)
    text: str             # texto del mensaje (de una nota de voz: el transcript; de un botón: el value)
    kind: str = "text"    # 'text' | 'voice' | 'needs_stt' | 'callback' (botón tocado -> text = value, determinístico)

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "NormalizedMessage":
        return NormalizedMessage(channel=d["channel"], channel_ref=d["channel_ref"],
                                 text=d.get("text", ""), kind=d.get("kind", "text"))


@dataclass
class Intent:
    """Salida estructurada del LLM (parseada). `entities` es un dict libre cuyo shape lo define el dominio
    via su system prompt — el motor no lo interpreta, solo lo pasa al dispatcher."""
    action: str
    entities: dict = field(default_factory=dict)
    confidence: float = 0.0
    reply_es: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict | None) -> "Intent":
        d = d or {}
        action = d.get("action") or "clarify"
        if action not in ACTIONS:
            action = "clarify"
        try:
            conf = float(d.get("confidence", 0.0))
        except (TypeError, ValueError):
            conf = 0.0
        # entities/reply_es defensivos (2ª pasada adversarial 2026-07-04): el LLM puede emitir entities NO-dict
        # (string/lista) o reply_es no-string — degradar acá, en el boundary, evita un AttributeError en el
        # `ent.get()` de CUALQUIER dispatcher de dominio (misma clase de fallo que range_raw no-string).
        entities = d.get("entities")
        if not isinstance(entities, dict):
            entities = {}
        reply_es = d.get("reply_es")
        if not isinstance(reply_es, str):
            reply_es = ""
        return Intent(action=action, entities=entities, confidence=conf, reply_es=reply_es)


@dataclass
class DispatchResult:
    """Lo que el dispatcher del dominio devuelve al motor tras procesar un intent.
    El motor SOLO entiende estos campos genericos; la logica que los produce es del dominio."""
    reply_text: str                       # texto a enviar al interlocutor por el canal
    done: bool = False                    # True -> la conversacion llego a un estado terminal (cerrar workflow)
    escalate: bool = False                # True -> notificar a staff (HITL) y esperar decision humana
    escalate_reason: str = ""             # por que se escala (emergencia, baja confianza, ...)
    state_patch: dict = field(default_factory=dict)  # parche al estado de conversacion (ej. {'pending_slot': ...})
    choices: list = field(default_factory=list)  # opciones discretas a ofrecer [{label, value}]; cada canal las
    #                                              renderiza (Telegram=inline keyboard, WhatsApp=buttons, voz=lista)
    card: dict = field(default_factory=dict)  # metadata OPCIONAL de presentacion del reply: los canales ricos
    #                                           (web) la renderizan, los texto-only (Telegram/voz) la ignoran.
    #                                           Ej HITL: {'service': 'googledocs', 'label': 'Google Docs'}.

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "DispatchResult":
        return DispatchResult(
            reply_text=d.get("reply_text", ""),
            done=bool(d.get("done", False)),
            escalate=bool(d.get("escalate", False)),
            escalate_reason=d.get("escalate_reason", ""),
            state_patch=d.get("state_patch") or {},
            choices=d.get("choices") or [],
            card=d.get("card") or {},
        )


@dataclass
class ToolCall:
    """Un tool-call que el LLM emitió (tool-calling nativo). `arguments` ya parseado del JSON del modelo."""
    id: str                # tool_call_id de la API (para casar el tool-result)
    name: str              # nombre canónico de la tool (ej 'gmail_send', 'mp_charge', 'calendar_book')
    arguments: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "ToolCall":
        return ToolCall(id=d["id"], name=d["name"], arguments=d.get("arguments") or {})


@dataclass
class Artifact:
    """Artefacto clicable que produce una tool. `kind` decide el render; `data.url` redirige a la fuente."""
    kind: str              # 'payment_link'|'email_draft'|'doc'|'file'|'sheet'|'calendar_event'
    data: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict | None) -> "Artifact | None":
        if not d:
            return None
        return Artifact(kind=d["kind"], data=d.get("data") or {})


@dataclass
class ToolResult:
    """Resultado de ejecutar una tool. `observation` = proyección DESTILADA que ve el LLM (no el payload crudo).
    `status`: 'ok' | 'error' | 'rejected' | 'needs_confirmation' (write no confirmado → el workflow abre el gate).
    `tool_call_id` guarda el **idem_key** del write (ref de trazabilidad/dedup) — NO el id de la API: el scratchpad
    se casa con el `tc["id"]` real en el workflow (`_assistant_tool_call_msg`), no con este campo."""
    tool_call_id: str
    observation: dict = field(default_factory=dict)
    artifact: "Artifact | None" = None
    is_write: bool = False
    status: str = "ok"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["artifact"] = self.artifact.to_dict() if self.artifact else None
        return d

    @staticmethod
    def from_dict(d: dict) -> "ToolResult":
        return ToolResult(
            tool_call_id=d["tool_call_id"],
            observation=d.get("observation") or {},
            artifact=Artifact.from_dict(d.get("artifact")),
            is_write=bool(d.get("is_write", False)),
            status=d.get("status", "ok"))
