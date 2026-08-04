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
    """payload = {domain, user, history, cliente_id?, thread_ref?}. Devuelve {'parsed': dict|None, 'raw', ...}.
    Si el dominio tiene memory_provider, antepone al system prompt el Context Block de recall (memoria de largo
    plazo del interlocutor). Best-effort: recall ya degrada a "" ante fallos; el try/except es defensa extra."""
    dom = get_domain(payload["domain"])
    provider = dom["llm_provider"]
    system = dom["system_prompt"]
    mem = dom.get("memory_provider")
    if mem is not None and payload.get("cliente_id"):
        try:
            # el mensaje ACTUAL del turno es el query del recall (graph-search sobre el user graph): así trae
            # los facts relevantes aunque sea una charla nueva. Sin `user` no hay con qué buscar → recall "".
            ctx = await asyncio.to_thread(
                mem.recall, payload["cliente_id"], payload.get("thread_ref", ""), payload.get("user", ""))
            if ctx:
                system = system + "\n\n" + ctx
        except Exception as exc:  # noqa: BLE001 — memoria best-effort: nunca romper el turno
            activity.logger.warning(f"[call_llm] recall degradado: {exc}")
    return await asyncio.to_thread(
        provider.complete, system, payload["user"], history=payload.get("history"))


@activity.defn
async def dispatch_intent(payload: dict) -> dict:
    """payload = {domain, intent, state, conv}. Ejecuta el dispatcher del dominio (tools) -> DispatchResult dict."""
    dom = get_domain(payload["domain"])
    intent = Intent.from_dict(payload["intent"])
    ctx = dom["context_factory"](payload["conv"]) if dom["context_factory"] else None
    result = await asyncio.to_thread(dom["dispatcher"], intent, payload.get("state") or {}, ctx)
    return result.to_dict() if isinstance(result, DispatchResult) else result


def _idem_key_de_la_activity() -> str:
    """Clave de idempotencia derivada de la PROPIA activity, no del payload.

    Una activity se reintenta: si el envío se concretó y el worker murió antes de reportarlo, Temporal
    la corre de nuevo y el usuario ve el mismo mensaje dos veces. La clave tiene que ser la misma en
    todos los intentos y distinta entre envíos — que es exactamente `activity_id`, asignado al agendar
    y reusado por cada reintento.

    **Se calcula acá y no se recibe por payload a propósito.** Sumar una clave al payload cambiaría el
    input de un `ScheduleActivityTask` de `ConversationWorkflow`, que tiene 78 ejecuciones vivas
    (sesiones permanentes con continue-as-new); derivarla adentro no toca ninguna. Y de paso no se
    puede olvidar: no depende de que el llamador la mande.

    `workflow_run_id` va incluido porque el continue-as-new reinicia la numeración de `activity_id`.
    """
    info = activity.info()
    return f"{info.workflow_id}:{info.workflow_run_id}:{info.activity_id}"


@activity.defn
async def send_channel_message(payload: dict) -> dict:
    """payload = {channel, channel_ref, text, choices?, cliente_id?}. Despacha al adapter del canal (choices
    opcional). `cliente_id` viaja per-request (tenant del workflow que originó el mensaje); los adapters que
    no lo necesitan (Telegram) lo ignoran -- ver ChannelAdapter.send.

    `idem_key` sale de la propia activity (ver `_idem_key_de_la_activity`): un reintento reusa la misma
    clave, así que el canal puede descartar el duplicado en vez de volver a escribirle al usuario."""
    adapter = get_channel(payload["channel"])
    res = await asyncio.to_thread(adapter.send, payload["channel_ref"], payload["text"], payload.get("choices"),
                                  cliente_id=payload.get("cliente_id"), card=payload.get("card"),
                                  idem_key=_idem_key_de_la_activity())
    return res if isinstance(res, dict) else {"sent": True}


@activity.defn
async def notify_staff(payload: dict) -> dict:
    """payload = {cliente_id, channel, channel_ref, reason, summary, reply_to_patient}. Avisa a staff (HITL)."""
    notifier = get_staff_notifier()
    if notifier is None:
        activity.logger.warning(f"[notify_staff] sin notifier registrado; escalacion perdida: {payload.get('reason')}")
        return {"notified": False}
    # Misma clave que en `send_channel_message`, y por el mismo motivo: un reintento no puede volver a
    # despertar a una persona por la misma escalación. Se agrega al dict ACÁ —no en el workflow— para
    # no tocar el input de un `ScheduleActivityTask` con ejecuciones vivas. Un notifier que la ignore
    # queda como está: es aditivo.
    res = await asyncio.to_thread(notifier, {**payload, "idem_key": _idem_key_de_la_activity()})
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


async def _registrar_metering(dom: dict, *, cliente_id: str | None, session_id: str, model: str,
                              tokens: int | None, evento: str) -> None:
    """Best-effort (BETA-1b): el boundary `metering_sink` del dominio, si existe. Nunca rompe el turno
    -- metering es telemetría, no correctitud, mismo criterio que `perfil_provider` arriba."""
    sink = dom.get("metering_sink")
    if sink is None or not cliente_id:
        return
    try:
        await asyncio.to_thread(sink, cliente_id, session_id, model, tokens, evento)
    except Exception as exc:  # noqa: BLE001
        activity.logger.warning("metering_sink falló (cliente=%s, evento=%s): %s", cliente_id, evento, exc)


def componer_system_extra(bloque_estable: str, contexto_del_turno: str) -> str:
    """Une el bloque ESTABLE del tenant (perfil) con el VARIABLE (memoria), en ESE orden.

    El orden no es estético: el perfil cambia una vez por mes y la memoria cambia en cada turno. Con lo
    estable primero, el prefijo del prompt se mantiene cacheable; invertido se invalida el prompt-cache
    en cada turno. No rompe nada visible — sólo se nota en la factura del LLM. Es la misma razón por la
    que el recall corre 1×/turno y no por iteración."""
    partes = [p for p in (bloque_estable or "", contexto_del_turno or "") if p.strip()]
    return "\n\n".join(partes)


@activity.defn
async def call_llm_tools(payload: dict) -> dict:
    """payload = {domain, messages, tool_choice?, system_extra?, cliente_id?, session_id?}. Tool-calling
    nativo ReAct.

    Antepone al system: (1) el bloque ESTABLE del tenant vía `perfil_provider` del dominio, y (2) el
    Context Block de memoria que arma el workflow 1×/turno (`system_extra`). En ese orden — ver
    `componer_system_extra`.

    Por qué el perfil se lee ACÁ y no en el workflow: la sesión es PERMANENTE (continue-as-new), y todo
    lo que se guarde en `config` o en el estado del workflow SOBREVIVE al CAN — un perfil cacheado ahí
    quedaría congelado para siempre y el usuario cambiaría sus ajustes sin efecto, sin error y sin log.
    Leerlo en la activity además NO agrega un comando nuevo a la historia, así que no rompe el replay de
    las sesiones en vuelo (que, siendo permanentes, son todas).

    Devuelve {'tool_calls','content','finish_reason','model','failed_over'}."""
    dom = get_domain(payload["domain"])
    provider = dom["llm_provider"]
    system = dom["system_prompt"]
    extra = payload.get("system_extra") or ""
    perfil_provider = dom.get("perfil_provider")
    cliente_id = payload.get("cliente_id")
    if perfil_provider is not None and cliente_id:
        try:
            bloque = await asyncio.to_thread(perfil_provider, cliente_id)
        except Exception as exc:  # noqa: BLE001 -- el perfil es contexto, no correctitud: nunca romper el turno
            activity.logger.warning("perfil del negocio no disponible (cliente=%s): %s", cliente_id, exc)
            bloque = ""
        extra = componer_system_extra(bloque or "", extra)
    if extra:
        system = system + "\n\n" + extra
    tools = dom.get("tool_schemas") or []
    result = await asyncio.to_thread(
        provider.complete_tools, system, payload.get("messages") or [], tools,
        tool_choice=payload.get("tool_choice", "auto"))
    await _registrar_metering(
        dom, cliente_id=cliente_id, session_id=payload.get("session_id", ""),
        model=result.get("model", ""), tokens=(result.get("usage") or {}).get("total_tokens"),
        evento="llm_turno")
    return result


@activity.defn
async def execute_tool(payload: dict) -> dict:
    """payload = {domain, name, arguments, conv, confirmed, idem_key}. Ejecuta UNA tool del dominio via su
    tool_executor. Devuelve ToolResult dict. Los errores de negocio ya vienen como status='error' del executor
    -- NUNCA se propagan (retry ilimitado colgaria el turno, leccion PR #114)."""
    dom = get_domain(payload["domain"])
    executor = dom.get("tool_executor")
    if executor is None:
        return {"tool_call_id": payload.get("idem_key", ""), "status": "error",
                "observation": {"error": "dominio sin tool_executor"}, "artifact": None, "is_write": False}
    ctx = dom["context_factory"](payload["conv"]) if dom["context_factory"] else None
    result = await asyncio.to_thread(
        executor, payload["name"], payload.get("arguments") or {}, ctx,
        confirmed=bool(payload.get("confirmed", False)), idem_key=payload["idem_key"])
    result_dict = result.to_dict() if hasattr(result, "to_dict") else result
    conv = payload.get("conv") or {}
    # `evento` lleva el status adentro ("tool_call:ok"/"tool_call:error"/...) -- es lo que le permite a
    # la query de error-rate (BETA-1b DoD) filtrar `LIKE 'tool_call:%'` y agrupar por resultado, sin
    # una columna nueva en `copiloto_metering`.
    await _registrar_metering(
        dom, cliente_id=conv.get("cliente_id"), session_id=conv.get("channel_ref", ""),
        model=f"tool:{payload['name']}", tokens=None,
        evento=f"tool_call:{result_dict.get('status', 'ok')}")
    return result_dict


@activity.defn
async def recall_memory(payload: dict) -> dict:
    """payload = {domain, cliente_id, thread_ref, query}. Recall de memoria de largo plazo para el motor ReAct
    (lado INPUT; el motor lo invoca 1x/turno). Devuelve {'context': <Context Block o "">}. No-op si el dominio
    no tiene memory_provider. Best-effort: NUNCA propaga (una caida/lentitud de la memoria no cuelga el turno).
    Reusa el mismo `recall` que call_llm usa en modo dispatch (memory_provider.recall)."""
    mem = get_domain(payload["domain"]).get("memory_provider")
    if mem is None:
        return {"context": ""}
    try:
        ctx = await asyncio.to_thread(mem.recall, payload["cliente_id"], payload.get("thread_ref", ""),
                                      payload.get("query", ""))
        return {"context": ctx or ""}
    except Exception as exc:  # noqa: BLE001 — memoria best-effort: nunca romper el turno
        activity.logger.warning(f"[recall_memory] degradado: {exc}")
        return {"context": ""}


@activity.defn
async def warm_memory(payload: dict) -> dict:
    """payload = {domain, cliente_id}. Precalienta el grafo de memoria del interlocutor al ABRIR la sesión.
    No-op si el dominio no tiene memory_provider. Best-effort: NUNCA propaga (un warm fallido no bloquea la
    conversación). El I/O (HTTP a Graphity, cliente SYNC) va en thread (no bloquea el event loop del worker)."""
    mem = get_domain(payload["domain"]).get("memory_provider")
    if mem is None:
        return {"warmed": False}
    try:
        warmed = await asyncio.to_thread(mem.warm, payload["cliente_id"])
        return {"warmed": bool(warmed)}
    except Exception as exc:  # noqa: BLE001
        activity.logger.warning(f"[warm_memory] fallo: {exc}")
        return {"warmed": False, "error": str(exc)}


@activity.defn
async def remember_memory(payload: dict) -> dict:
    """payload = {domain, cliente_id, thread_ref, messages}. Persiste el batch de mensajes en la memoria de
    largo plazo. No-op si el dominio no tiene memory_provider. Best-effort: NUNCA propaga. El I/O va en thread."""
    mem = get_domain(payload["domain"]).get("memory_provider")
    if mem is None:
        return {"remembered": False}
    try:
        await asyncio.to_thread(mem.remember, payload["cliente_id"], payload.get("thread_ref", ""),
                                payload.get("messages") or [])
        return {"remembered": True}
    except Exception as exc:  # noqa: BLE001
        activity.logger.warning(f"[remember_memory] fallo: {exc}")
        return {"remembered": False, "error": str(exc)}
