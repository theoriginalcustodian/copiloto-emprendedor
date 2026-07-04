"""ConversationWorkflow — motor conversacional DURABLE y AGNOSTICO (capa PLANTILLA, cosechable).

Una instancia por (cliente_id x canal x interlocutor). Sobrevive cortes (Temporal): el hilo de conversacion
es durable. El motor NO sabe NADA del dominio ni del canal: orquesta un loop
    recibir mensaje (signal) -> call_llm (intent) -> dispatch_intent (dominio) -> responder / escalar (HITL)
invocando activities POR NOMBRE. El dominio (system prompt + dispatcher + tools) y el canal (adapter) los
provee el worker via un registry (backend.agent.agent_runtime). Clonar a otro dominio = registrar otro
dominio; este workflow se reusa TAL CUAL.

Determinismo (regla 3): cero I/O / random / time nativo aca. Todo I/O (LLM, DB, envio, notificacion) va en
activities. La espera es workflow.wait_condition con timeout DURABLE (timer Temporal), nunca asyncio.sleep.
Loop ACOTADO (MAX_TURNS) + history acotado para no reventar el history del workflow (patron del repo).

Nota de replay (skill temporal-developer, doc oficial de versioning): agregar una key a un dict de payload de
un activity call YA EXISTENTE (ej. `cliente_id` en `send_channel_message`) NO altera el Command sequence
-> replay-safe SIEMPRE, sin Patching API. Lo que SÍ requeriría Patching: cambiar el NOMBRE de la activity, el
ORDEN de las llamadas, o el NÚMERO de invocaciones (eso sí cambia la secuencia de Commands comparada en replay).
"""
from __future__ import annotations

import asyncio
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ActivityError

with workflow.unsafe.imports_passed_through():
    from backend.agent.types import DispatchResult

MAX_TURNS = 40                              # cota anti-history (cada turno = 1 mensaje procesado)
IDLE_TIMEOUT = timedelta(minutes=30)        # sin actividad -> cerrar la conversacion (durable)
STAFF_TIMEOUT = timedelta(hours=4)          # espera de decision humana (HITL) antes de seguir
ACTIVITY_TIMEOUT = timedelta(seconds=120)   # LLM puede tardar (reasoning) -> margen amplio
# Activities del loop (STT/LLM/dispatch/envío/HITL): retry ACOTADO. Sin retry_policy usan el DEFAULT de
# Temporal = reintentos ILIMITADOS → un fallo PERMANENTE (ej. una tool de Composio que se propaga como
# excepción) reintenta ∞ y cuelga el turno ('Pensando…' eterno, bug 2026-07-04). 5 intentos absorben blips
# transitorios reales; un error permanente falla en tiempo ACOTADO en vez de colgar. Es la red de seguridad:
# la raíz del caso Composio ya se ataja en el dispatcher (no propaga ConnectionRequired). Best-effort de
# memoria usa su propio _MEMORY_RETRY (max=1), NO este.
LOOP_RETRY = RetryPolicy(maximum_attempts=5)
# Memoria best-effort: cubre el worst-case de UN intento del cliente Graphity (max_attempts=1: warm ~15s,
# remember ensure_user+ensure_thread+add_messages ~55s). retry SIEMPRE max=1 → un timeout NO dispara los
# reintentos ILIMITADOS del default de Temporal (footgun que colgaría run()/el loop bajo Graphity LENTO).
MEMORY_TIMEOUT = timedelta(seconds=75)
_MEMORY_RETRY = RetryPolicy(maximum_attempts=1)   # sin reintentos: memoria best-effort, jamás debe colgar el turno


@workflow.defn
class ConversationWorkflow:
    """Config de arranque: {cliente_id, channel, channel_ref, domain}. El `domain` selecciona el toolset
    + system prompt + dispatcher registrados en el worker. Los mensajes entran por signal `receive_message`."""

    def __init__(self) -> None:
        self._inbox: list[dict] = []          # mensajes recibidos (NormalizedMessage dict)
        self._cursor: int = 0                 # cuantos se procesaron
        self._history: list[dict] = []        # [{role:'user'|'assistant', content}] para el LLM (da contexto)
        self._state: dict = {}                # estado de conversacion (ej. pending_slot) — lo patchea el dispatcher
        self._staff_decision: dict | None = None
        self._closed: bool = False
        self._awaiting_staff: bool = False
        self._remembered_upto: int = 0        # cursor de memoria: hasta dónde se persistió self._history en Graphity

    # ── signals / query ───────────────────────────────────────────────────────────────────────────
    @workflow.signal
    def receive_message(self, payload: dict) -> None:
        """El router inbound llama esto con un NormalizedMessage dict ({channel, channel_ref, text, kind})."""
        self._inbox.append(payload)

    @workflow.signal
    def staff_decision(self, payload: dict) -> None:
        """Staff resuelve una escalacion HITL: {reply: '<texto a enviar>', ...}."""
        self._staff_decision = payload

    @workflow.signal
    def close(self) -> None:
        self._closed = True

    @workflow.query
    def state(self) -> dict:
        return {"closed": self._closed, "awaiting_staff": self._awaiting_staff,
                "turns": self._cursor, "conversation_state": self._state,
                "history_len": len(self._history)}

    def _pending(self) -> bool:
        return len(self._inbox) > self._cursor

    # ── el loop durable ───────────────────────────────────────────────────────────────────────────
    @workflow.run
    async def run(self, config: dict) -> dict:
        domain = config["domain"]
        channel = config["channel"]
        channel_ref = config["channel_ref"]
        cliente_id = config["cliente_id"]

        # Memoria de largo plazo (opt-in por app vía config['memory']): precalentar el grafo del interlocutor
        # al ABRIR la sesión (1 sola vez — un signal a un workflow vivo NO re-invoca run()). Best-effort (la
        # activity nunca propaga). Gate config['memory'] => apps sin memoria NO emiten esta command NUEVA
        # (replay-safe para sesiones en vuelo: su config no trae la key -> secuencia de Commands intacta).
        if config.get("memory"):
            try:
                await workflow.execute_activity(
                    "warm_memory", {"domain": domain, "cliente_id": cliente_id},
                    start_to_close_timeout=MEMORY_TIMEOUT, retry_policy=_MEMORY_RETRY)
            except ActivityError:
                pass   # best-effort: un warm lento/caído (timeout, sin reintentos) NO deja mudo al agente

        for _turn in range(MAX_TURNS):
            try:
                await workflow.wait_condition(lambda: self._pending() or self._closed, timeout=IDLE_TIMEOUT)
            except asyncio.TimeoutError:
                break                                   # idle -> cerrar (sin dejar el workflow colgado)
            if self._closed and not self._pending():
                break

            msg = self._inbox[self._cursor]
            self._cursor += 1
            user_text = msg.get("text", "")
            kind = msg.get("kind", "text")

            # Nota de voz: transcribir ANTES de seguir (el `text` traía el file_id, no el contenido). El STT va
            # en una activity (I/O). Si no se pudo transcribir -> pedir texto, sin romper el hilo ni el history.
            if kind == "needs_stt":
                stt = await workflow.execute_activity(
                    "transcribe_voice", {"channel": channel, "file_id": user_text},
                    start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
                transcript = ((stt or {}).get("text") or "").strip()
                if not transcript:
                    await workflow.execute_activity(
                        "send_channel_message",
                        {"channel": channel, "channel_ref": channel_ref, "cliente_id": cliente_id,
                         "text": "Uy, no pude escuchar bien tu audio 🙉. ¿Me lo escribís?", "choices": []},
                        start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
                    continue
                user_text = transcript                  # de acá en más es texto normal (lo clasifica el LLM)
                kind = "text"

            prior = list(self._history)                 # contexto ANTES de este mensaje (resuelve confirmaciones cortas)
            self._history.append({"role": "user", "content": user_text})

            # 1) intent. Un botón (kind='callback') es una decisión DETERMINÍSTICA: el value ya es conocido ->
            #    NO se llama al LLM (puro, replay-safe). Texto/voz -> el LLM lo clasifica.
            if kind == "callback":
                intent = {"action": "callback", "entities": {"value": user_text},
                          "confidence": 1.0, "reply_es": ""}
            else:
                llm = await workflow.execute_activity(
                    "call_llm", {"domain": domain, "user": user_text, "history": prior[-20:],
                                 "cliente_id": cliente_id, "thread_ref": channel_ref},
                    start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
                intent = llm.get("parsed") or {
                    "action": "clarify", "entities": {},
                    "reply_es": "Disculpá, no te entendí bien. ¿Me lo podés repetir?"}

            # 2) dispatcher del dominio -> DispatchResult (ejecuta las tools de dominio: resolve/slots/book/...)
            disp = await workflow.execute_activity(
                "dispatch_intent",
                {"domain": domain, "intent": intent, "state": self._state,
                 "conv": {"cliente_id": cliente_id, "channel": channel, "channel_ref": channel_ref,
                          "user": user_text}},
                start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
            result = DispatchResult.from_dict(disp)
            if result.state_patch:
                self._state.update(result.state_patch)
            reply = result.reply_text

            # 3) HITL: escalar a staff y esperar su decision (event-driven, durable)
            if result.escalate:
                await workflow.execute_activity(
                    "notify_staff",
                    {"cliente_id": cliente_id, "channel": channel, "channel_ref": channel_ref,
                     "reason": result.escalate_reason, "summary": user_text, "reply_to_patient": reply},
                    start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
                self._awaiting_staff = True
                try:
                    await workflow.wait_condition(lambda: self._staff_decision is not None, timeout=STAFF_TIMEOUT)
                except asyncio.TimeoutError:
                    pass
                self._awaiting_staff = False
                if self._staff_decision:
                    reply = self._staff_decision.get("reply") or reply
                    self._staff_decision = None

            # 4) responder por el canal (con choices si el dominio ofrece opciones discretas; vacío tras HITL)
            if reply:
                self._history.append({"role": "assistant", "content": reply})
                await workflow.execute_activity(
                    "send_channel_message",
                    {"channel": channel, "channel_ref": channel_ref, "cliente_id": cliente_id,
                     "text": reply, "choices": result.choices},
                    start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)

            # Memoria de largo plazo: persistir en BATCH (~20 msgs ≈ 10 turnos) para no saturar la extracción
            # LLM server-side de Graphity (cada add_messages dispara una extracción). Gate config['memory'].
            if config.get("memory") and len(self._history) - self._remembered_upto >= 20:
                try:
                    await workflow.execute_activity(
                        "remember_memory",
                        {"domain": domain, "cliente_id": cliente_id, "thread_ref": channel_ref,
                         "messages": self._history[self._remembered_upto:]},
                        start_to_close_timeout=MEMORY_TIMEOUT, retry_policy=_MEMORY_RETRY)
                    self._remembered_upto = len(self._history)   # cursor avanza SOLO si persistió
                except ActivityError:
                    pass   # best-effort: remember lento/caído NO cuelga el loop; el cursor NO avanza →
                           # el remanente se reintenta en el próximo batch/flush (no se pierden mensajes)

            if result.done:
                self._closed = True
                break

        # Flush final: persistir el remanente al cerrar la sesión (cubre las 4 salidas del loop: idle-timeout,
        # closed, done, MAX_TURNS agotado). Sin esto, el último batch (<20 msgs) se perdería. Gate config['memory'].
        if config.get("memory") and self._remembered_upto < len(self._history):
            try:
                await workflow.execute_activity(
                    "remember_memory",
                    {"domain": domain, "cliente_id": cliente_id, "thread_ref": channel_ref,
                     "messages": self._history[self._remembered_upto:]},
                    start_to_close_timeout=MEMORY_TIMEOUT, retry_policy=_MEMORY_RETRY)
                self._remembered_upto = len(self._history)
            except ActivityError:
                pass   # best-effort: si el flush final falla, se pierde el último batch (aceptable) — NO cuelga
        return {"closed": self._closed, "turns": self._cursor, "state": self._state}
