"""agent_runtime — registry de dominios y canales del agente (capa PLANTILLA).

El motor (ConversationWorkflow) invoca activities genericas POR NOMBRE; esas activities consultan ESTE
registry para resolver el system prompt + dispatcher del dominio y el adapter del canal. El worker puebla el
registry al arrancar (registra 'clinic' + 'telegram' + el notifier de staff). Asi el motor queda agnostico y
agregar un dominio/canal nuevo no toca el workflow.

Contratos:
  - llm_provider: objeto con .complete(system, user, *, history) -> {'parsed': dict|None, ...}
  - dispatcher(intent: Intent, state: dict, context) -> DispatchResult   (ejecuta las tools del dominio)
  - context_factory(conv: dict) -> context                                (crea lo que el dispatcher necesita: DB client, etc.)
  - channel adapter: objeto con .send(channel_ref, text) -> dict
  - staff_notifier(payload: dict) -> dict                                  (avisa a staff de una escalacion HITL)
"""
from __future__ import annotations

_DOMAINS: dict[str, dict] = {}
_CHANNELS: dict[str, object] = {}
_STAFF_NOTIFIER = {"fn": None}
_STT_PROVIDER = {"provider": None}    # transcripción de voz (agnóstica del dominio); la usa la activity transcribe_voice


def register_domain(name: str, *, system_prompt: str, llm_provider, dispatcher, context_factory=None) -> None:
    _DOMAINS[name] = {"system_prompt": system_prompt, "llm_provider": llm_provider,
                      "dispatcher": dispatcher, "context_factory": context_factory}


def get_domain(name: str) -> dict:
    if name not in _DOMAINS:
        raise KeyError(f"dominio no registrado: {name!r} (registrados: {list(_DOMAINS)})")
    return _DOMAINS[name]


def register_channel(name: str, adapter) -> None:
    _CHANNELS[name] = adapter


def get_channel(name: str):
    if name not in _CHANNELS:
        raise KeyError(f"canal no registrado: {name!r} (registrados: {list(_CHANNELS)})")
    return _CHANNELS[name]


def register_staff_notifier(fn) -> None:
    _STAFF_NOTIFIER["fn"] = fn


def get_staff_notifier():
    return _STAFF_NOTIFIER["fn"]


def register_stt_provider(provider) -> None:
    """Registra el provider de transcripción de voz (objeto con `.transcribe(audio_bytes) -> str`). Global y
    agnóstico al dominio: cualquier dominio con canal de voz lo reusa. Lo cablea el worker al arrancar."""
    _STT_PROVIDER["provider"] = provider


def get_stt_provider():
    return _STT_PROVIDER["provider"]


def reset_registry() -> None:
    """Solo para tests: limpia el registry entre casos."""
    _DOMAINS.clear()
    _CHANNELS.clear()
    _STAFF_NOTIFIER["fn"] = None
    _STT_PROVIDER["provider"] = None
