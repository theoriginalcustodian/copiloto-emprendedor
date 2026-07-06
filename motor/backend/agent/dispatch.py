"""dispatch — maquina de conversacion GENERICA confirm-gate (capa PLANTILLA, FIJA / fixed-mount R1).

Esta es la state-machine que TODO agente conversacional del arquetipo comparte:
    escalate -> confirm-gate (yes/no/ambiguo) -> reset-stale -> merge entities -> resolve target -> ofrecer confirmar
Es GENERICA: se parametriza con la closed-list del dominio (`valid_entities`), sus textos (`texts`, override sobre
DEFAULT_TEXTS) y las 4 HOJAS de logica del dominio (parse_confirmation / merge_entities / resolve_target /
execute_action). El dominio provee solo DATOS + esas hojas; la maquina se reusa TAL CUAL.

Por que FIJA y no rellenable por el musculo (R1, gap B 2026-07-01): la maquina codifica 5 invariantes acopladas
(no-ejecutar-ante-ambiguo, texto-fijo-de-escalada, no-pisar-entity-valida, cancelar-limpia-estado, yes-ejecuta-y-
cierra). Empiricamente el musculo no-frontier NO las sostiene todas a la vez: flash Y pro OSCILAN 2-3/5 sin converger
aun con budget + feedback localizado perfectos (spikes/deepseek-reasoning-maxtokens/spike_loop.py). Es el techo de la
regla 11 (rellenabilidad). Solucion canonica (R1): la maquina generica es un template FIJO gate-testeado UNA vez
(test_dispatch.py) y cada dominio la reusa via make_dispatcher; el musculo rellena solo las hojas (confirm/entities/
tools/context), que SI resuelve. El motor (ConversationWorkflow) sigue agnostico: invoca el dispatcher por el registry.
"""
from __future__ import annotations

from backend.agent.types import DispatchResult

# Textos por defecto (es-AR neutro). El dominio overridea via `texts=` para su tono/idioma; las claves son estables.
DEFAULT_TEXTS = {
    "escalate": "Te derivo con una persona del equipo.",
    "nothing_pending": "No tengo nada pendiente para confirmar.",
    "confirmed": "Listo, confirmado.",
    "cancelled": "Cancelado.",
    "reask_confirm": "¿Confirmás? Respondé sí o no.",
    "clarify": "¿Me lo repetís?",
    "out_of_scope": "Eso no lo puedo ayudar por acá.",
    "not_found": "No encontré eso. ¿Podés ser más específico?",
    "confirm_prompt": "¿Confirmás {name}?",
}
_CONFIRM_CHOICES = [{"label": "Confirmar", "value": "yes"}, {"label": "Cancelar", "value": "no"}]


def make_dispatcher(*, valid_entities, parse_confirmation, merge_entities, resolve_target, execute_action, texts=None):
    """Fabrica el `dispatch(intent, state, ctx) -> DispatchResult` de un dominio, cableando su closed-list, sus
    textos (override opcional sobre DEFAULT_TEXTS) y sus 4 hojas de logica. El closure es PURO/deterministico (no
    I/O: el I/O real vive en las hojas, que corren dentro de la activity `dispatch_intent`). Reusa el mismo cuerpo
    para todo dominio -> la maquina se testea UNA vez (test_dispatch.py)."""
    t = {**DEFAULT_TEXTS, **(texts or {})}

    def dispatch(intent, state, ctx) -> DispatchResult:
        state = dict(state or {})
        action = intent.action

        # 1) escalada critica -> texto FIJO del sistema, nunca el reply_es del LLM (puede minimizar/inventar).
        if action in ("escalate_human", "emergency"):
            return DispatchResult(reply_text=t["escalate"], done=False, escalate=True,
                                  escalate_reason=action, state_patch=state)

        # 2) confirm-gate: un tramo 'awaiting=confirm' pendiente manda sobre el routing normal.
        if state.get("awaiting") == "confirm":
            callback_value = intent.entities.get("value") if action == "callback" else None
            text_value = intent.entities.get("confirmation") if action != "callback" else None
            decision = parse_confirmation(text_value, callback_value)
            if decision == "yes":
                target = state.get("pending_target")
                result = execute_action(ctx, target, confirmed=True)
                new_state = dict(state)
                new_state.pop("awaiting", None)
                new_state.pop("pending_target", None)
                if result.get("status") == "needs_confirmation":
                    return DispatchResult(reply_text=t["nothing_pending"], done=False, state_patch=new_state)
                return DispatchResult(reply_text=t["confirmed"], done=True, state_patch=new_state)
            if decision == "no":
                new_state = dict(state)
                new_state.pop("awaiting", None)
                new_state.pop("pending_target", None)
                return DispatchResult(reply_text=t["cancelled"], done=False, state_patch=new_state)
            # ambiguo/None -> NUNCA ejecutar "por las dudas": re-preguntar sin tocar el estado pendiente.
            return DispatchResult(reply_text=t["reask_confirm"], done=False, state_patch=state,
                                  choices=list(_CONFIRM_CHOICES))

        if action == "clarify":
            return DispatchResult(reply_text=intent.reply_es or t["clarify"], done=False, state_patch=state)
        if action == "out_of_scope":
            return DispatchResult(reply_text=intent.reply_es or t["out_of_scope"], done=False, state_patch=state)

        # 3) reset de estado stale: un tramo nuevo descarta un awaiting/pending viejo (un "dale" posterior no debe
        #    ejecutar algo que ya no es lo que el usuario quiere).
        new_state = dict(state)
        new_state.pop("awaiting", None)
        new_state.pop("pending_target", None)

        # 4) absorber entities validadas contra la closed-list (una entity invalida no pisa una valida previa).
        new_state = merge_entities(new_state, intent.entities, valid_entities)

        # 5) punto de decision: resolver el target contra la closed-list -> ofrecer confirmacion (botones).
        hint = new_state.get("target") or intent.entities.get("target")
        target = resolve_target(ctx, hint)
        if not target:
            return DispatchResult(reply_text=t["not_found"], done=False, state_patch=new_state)
        new_state["awaiting"] = "confirm"
        new_state["pending_target"] = target
        return DispatchResult(reply_text=t["confirm_prompt"].format(name=target["name"]), done=False,
                              state_patch=new_state, choices=list(_CONFIRM_CHOICES))

    return dispatch
