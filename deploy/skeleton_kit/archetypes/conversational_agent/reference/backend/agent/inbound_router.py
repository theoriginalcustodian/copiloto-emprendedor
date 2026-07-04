"""inbound_router — rutea mensajes entrantes al ConversationWorkflow (capa PLANTILLA, agnostica del canal).

Patron start-or-signal (validado en spike S1, WorkflowIDConflictPolicy.USE_EXISTING): un mensaje a un
interlocutor nuevo CREA su ConversationWorkflow y le manda el primer signal; un mensaje a una conversacion ya
viva REUSA el mismo workflow (no arranca otro). El workflow_id es deterministico por (canal, tenant, ref) ->
idempotente. El router es agnostico: recibe un ChannelAdapter (lo normaliza) y el `domain` (lo despacha).
"""
from __future__ import annotations

import asyncio

from temporalio.common import WorkflowIDConflictPolicy

from backend.agent.conversation_workflow import ConversationWorkflow


def workflow_id_for(channel: str, cliente_id: str, channel_ref: str) -> str:
    return f"conv-{channel}-{cliente_id}-{channel_ref}"


async def route_inbound(client, *, adapter, cliente_id: str, domain: str, task_queue: str,
                        raw_update: dict, extra_config: dict | None = None) -> str | None:
    """Normaliza un update del canal y lo rutea (start-or-signal). Devuelve el workflow_id, o None si el
    update no es procesable (p.ej. un update sin mensaje de texto).

    `extra_config` (opcional): flags que se mergean al config de arranque del workflow (ej. {'memory': True}
    para activar la memoria de largo plazo). AGNÓSTICO: la plantilla no hardcodea nombres de dominio; la app
    decide qué flags pasar. Sólo aplica al ARRANCAR el workflow (USE_EXISTING no re-configura uno vivo)."""
    msg = adapter.normalize_inbound(raw_update)
    if msg is None:
        return None
    wf_id = workflow_id_for(msg.channel, cliente_id, msg.channel_ref)
    await client.start_workflow(
        ConversationWorkflow.run,
        {"cliente_id": cliente_id, "channel": msg.channel, "channel_ref": msg.channel_ref,
         "domain": domain, **(extra_config or {})},
        id=wf_id, task_queue=task_queue,
        id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING,
        start_signal="receive_message", start_signal_args=[msg.to_dict()])
    return wf_id


async def poll_loop(client, *, adapter, cliente_id: str, domain: str, task_queue: str,
                    stop_event: asyncio.Event | None = None, logger=None) -> None:
    """Loop de long-poll (getUpdates) -> route_inbound. Corre como task del worker. El offset avanza para no
    re-procesar updates. Un fallo de ruteo de un update NO tumba el loop (se loguea y se sigue)."""
    offset = None
    while stop_event is None or not stop_event.is_set():
        try:
            updates = await asyncio.to_thread(adapter.get_updates, offset)
        except Exception as exc:  # noqa: BLE001 -- caida transitoria del canal -> reintentar
            if logger:
                logger.warning(f"[poll_loop] getUpdates fallo: {exc}")
            await asyncio.sleep(3)
            continue
        for upd in updates:
            offset = upd.get("update_id", 0) + 1
            try:
                await route_inbound(client, adapter=adapter, cliente_id=cliente_id, domain=domain,
                                    task_queue=task_queue, raw_update=upd)
            except Exception as exc:  # noqa: BLE001 -- un update malo no tumba el loop
                if logger:
                    logger.warning(f"[poll_loop] route fallo (update {upd.get('update_id')}): {exc}")
