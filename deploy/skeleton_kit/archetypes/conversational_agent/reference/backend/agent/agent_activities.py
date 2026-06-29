"""agent_activities — activities GENERICAS del agente (capa PLANTILLA). Corren fuera del sandbox del workflow,
asi que SI pueden hacer I/O (LLM, DB, HTTP). Resuelven dominio/canal via el registry (agent_runtime).

El I/O bloqueante (HTTP del LLM, del canal) se corre en thread (asyncio.to_thread) para no bloquear el event
loop del worker — mismo patron que `infer` en la fabrica.
"""
from __future__ import annotations

import asyncio
import json

from temporalio import activity

from backend.agent.agent_runtime import get_channel, get_domain, get_staff_notifier, get_stt_provider
from backend.agent.types import DispatchResult, Intent


@activity.defn
async def call_llm(payload: dict) -> dict:
    """payload = {domain, user, history}. Devuelve {'parsed': dict|None, 'raw', 'model', 'failed_over'}."""
    dom = get_domain(payload["domain"])
    provider = dom["llm_provider"]
    return await asyncio.to_thread(
        provider.complete, dom["system_prompt"], payload["user"], history=payload.get("history"))


@activity.defn
async def dispatch_intent(payload: dict) -> dict:
    """payload = {domain, intent, state, conv}. Ejecuta el dispatcher del dominio (tools) -> DispatchResult dict."""
    dom = get_domain(payload["domain"])
    intent = Intent.from_dict(payload["intent"])
    ctx = dom["context_factory"](payload["conv"]) if dom["context_factory"] else None
    result = await asyncio.to_thread(dom["dispatcher"], intent, payload.get("state") or {}, ctx)
    return result.to_dict() if isinstance(result, DispatchResult) else result


@activity.defn
async def send_channel_message(payload: dict) -> dict:
    """payload = {channel, channel_ref, text, choices?}. Despacha al adapter del canal (choices opcional)."""
    adapter = get_channel(payload["channel"])
    res = await asyncio.to_thread(adapter.send, payload["channel_ref"], payload["text"], payload.get("choices"))
    return res if isinstance(res, dict) else {"sent": True}


@activity.defn
async def notify_staff(payload: dict) -> dict:
    """payload = {cliente_id, channel, channel_ref, reason, summary, reply_to_patient}. Avisa a staff (HITL)."""
    notifier = get_staff_notifier()
    if notifier is None:
        activity.logger.warning(f"[notify_staff] sin notifier registrado; escalacion perdida: {payload.get('reason')}")
        return {"notified": False}
    res = await asyncio.to_thread(notifier, payload)
    return res if isinstance(res, dict) else {"notified": True}


@activity.defn
async def transcribe_voice(payload: dict) -> dict:
    """payload = {channel, file_id}. Descarga el audio del canal y lo transcribe (STT). Devuelve {'text': str}.
    NUNCA cuelga la conversación: si no hay STT registrado o algo falla (descarga/transcripción/cuota), devuelve
    {'text': '', 'error': <motivo>} y el motor le pide al paciente que escriba. El I/O va en thread."""
    stt = get_stt_provider()
    if stt is None:
        return {"text": "", "error": "no_stt_provider"}
    try:
        adapter = get_channel(payload["channel"])
        audio = await asyncio.to_thread(adapter.download_file, payload["file_id"])
        text = await asyncio.to_thread(stt.transcribe, audio)
        # observabilidad de voz: el transcript queda en el log (journalctl) para auditar qué entendió el STT.
        # NOTA: en producción real con PHI sensible, gatear por env (un transcript puede traer datos del paciente).
        print("STT_TRANSCRIPT " + json.dumps(
            {"file_id": str(payload.get("file_id"))[:14], "bytes": len(audio), "text": text},
            ensure_ascii=False), flush=True)
        return {"text": text or ""}
    except Exception as exc:  # noqa: BLE001 -- un fallo de STT NO debe romper el hilo: el motor pide texto
        activity.logger.warning(f"[transcribe_voice] fallo STT: {exc}")
        return {"text": "", "error": str(exc)}
