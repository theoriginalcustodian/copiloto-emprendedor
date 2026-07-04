"""ConversationWorkflow — motor conversacional DURABLE y AGNOSTICO (capa PLANTILLA, cosechable).

Una instancia por (cliente_id x canal x interlocutor). Sobrevive cortes (Temporal): el hilo de conversacion
es durable. El motor NO sabe NADA del dominio ni del canal: orquesta un loop
    recibir mensaje (signal) -> call_llm (intent) -> dispatch_intent (dominio) -> responder / escalar (HITL)
invocando activities POR NOMBRE. El dominio (system prompt + dispatcher + tools) y el canal (adapter) los
provee el worker via un registry (backend.agent.agent_runtime). Clonar a otro dominio = registrar otro
dominio; este workflow se reusa TAL CUAL.

Determinismo (regla 3): cero I/O / random / time nativo aca. Todo I/O (LLM, DB, envio, notificacion) va en
activities. La espera es workflow.wait_condition con timeout DURABLE (timer Temporal), nunca asyncio.sleep.

SESION PERMANENTE via CONTINUE-AS-NEW (2026-07-04): la conversacion NO se cierra por history — cuando el
history de Temporal crece (`is_continue_as_new_suggested()`, o el backstop `MAX_TURNS_PER_RUN`), el workflow
se RENUEVA a si mismo arrastrando el contexto reciente (`CARRY_TAIL` mensajes) + el estado + los mensajes en
vuelo. Es transparente para el interlocutor: NO resetea el buffer (a diferencia de cerrar+reabrir), y elude
el `HistorySizeLimitExceeded`. Antes de renovar, flushea lo no-persistido a la memoria larga (no se pierde
nada). El unico cierre es: signal `close`, `done` del dominio, o `idle_timeout` (REAP de sesiones ABANDONADAS
— largo por defecto en apps tipo copiloto; invisible al uso activo). El idle-timeout es CONFIGURABLE por app
(`config['idle_timeout_seconds']`) → un bot de turnos usa corto, un copiloto usa dias.

Nota de replay (skill temporal-developer, doc oficial de versioning): agregar una key a un dict de payload de
un activity call YA EXISTENTE NO altera el Command sequence -> replay-safe. El cambio a continue-as-new se
diseño replay-safe para sesiones EN VUELO: el default de `idle_timeout_seconds` reproduce el timer viejo
(30 min), el chequeo de continue-as-new NO emite command hasta que dispara (history chico -> no dispara), y
el warm sigue gateado igual. Lo que SÍ requeriria Patching: cambiar el NOMBRE/ORDEN/NUMERO de activities del
camino normal (no se toca).
"""
from __future__ import annotations

import asyncio
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ActivityError

with workflow.unsafe.imports_passed_through():
    from backend.agent.types import DispatchResult

# Reap de sesiones ABANDONADAS: default 30 min (retro-compatible con clínica/bots de turnos). Un copiloto
# pasa `idle_timeout_seconds` largo (p.ej. 7 días) → la sesión es efectivamente permanente para el uso
# activo y solo se cierra si nadie la toca por mucho tiempo. NO es "cerrar la charla cada rato": el history
# lo acota continue-as-new, no el idle-timeout.
IDLE_TIMEOUT_DEFAULT_S = 30 * 60
CARRY_TAIL = 40                             # mensajes recientes que arrastra el continue-as-new (contexto del LLM)
MAX_TURNS_PER_RUN = 200                     # backstop de continue-as-new si is_continue_as_new_suggested no dispara
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
    + system prompt + dispatcher registrados en el worker. Los mensajes entran por signal `receive_message`.
    Opcionales: `memory` (bool, memoria de largo plazo), `idle_timeout_seconds` (int, reap de sesión
    abandonada), `carryover` (dict, lo inyecta el continue-as-new — NO lo pasa la app)."""

    def __init__(self) -> None:
        self._inbox: list[dict] = []          # mensajes recibidos (NormalizedMessage dict)
        self._cursor: int = 0                 # cuantos se procesaron EN ESTA corrida (se resetea en cada continue-as-new)
        self._history: list[dict] = []        # [{role:'user'|'assistant', content}] para el LLM (da contexto)
        self._state: dict = {}                # estado de conversacion (ej. pending_slot) — lo patchea el dispatcher
        self._staff_decision: dict | None = None
        self._closed: bool = False
        self._awaiting_staff: bool = False
        self._remembered_upto: int = 0        # cursor de memoria: hasta dónde se persistió self._history en Graphity
        self._turns_before: int = 0           # turnos acumulados en corridas anteriores (continue-as-new) — para la query

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
                "turns": self._turns_before + self._cursor, "conversation_state": self._state,
                "history_len": len(self._history)}

    def _pending(self) -> bool:
        return len(self._inbox) > self._cursor

    # ── memoria de largo plazo: flush del remanente no-persistido (best-effort) ─────────────────────
    async def _flush_memory(self, config: dict, domain: str, cliente_id: str, channel_ref: str) -> None:
        """Persiste en Graphity el remanente de history aún no persistido. Best-effort: NUNCA propaga (una
        caída/lentitud de la memoria no debe colgar ni tumbar el workflow). El cursor avanza SOLO si persistió
        → si falla, el remanente se reintenta en el próximo flush (no se pierde salvo en el flush final/pre-CAN
        que sí lo puede perder, aceptable — mismo invariante best-effort de siempre)."""
        if not (config.get("memory") and self._remembered_upto < len(self._history)):
            return
        try:
            await workflow.execute_activity(
                "remember_memory",
                {"domain": domain, "cliente_id": cliente_id, "thread_ref": channel_ref,
                 "messages": self._history[self._remembered_upto:]},
                start_to_close_timeout=MEMORY_TIMEOUT, retry_policy=_MEMORY_RETRY)
            self._remembered_upto = len(self._history)
        except ActivityError:
            pass

    # ── el loop durable ───────────────────────────────────────────────────────────────────────────
    @workflow.run
    async def run(self, config: dict) -> dict:
        domain = config["domain"]
        channel = config["channel"]
        channel_ref = config["channel_ref"]
        cliente_id = config["cliente_id"]
        idle_timeout = timedelta(seconds=int(config.get("idle_timeout_seconds") or IDLE_TIMEOUT_DEFAULT_S))
        max_turns_per_run = int(config.get("max_turns_per_run") or MAX_TURNS_PER_RUN)   # backstop de CAN (tuneable/testeable)

        # Continuación de una corrida anterior (continue-as-new): sembrar el estado ANTES de cualquier await
        # (corre entero antes de que el event loop entregue un signal handler → no pisa mensajes que lleguen).
        # El tail arrastrado YA está en Graphity (se flusheó antes del continue-as-new) → remembered_upto viene
        # calculado relativo al tail. Los `pending` son mensajes recibidos y aún sin procesar de la corrida previa.
        carry = config.get("carryover") or {}
        if carry:
            self._history = list(carry.get("history") or [])
            self._state = dict(carry.get("state") or {})
            self._inbox = list(carry.get("pending") or [])
            self._remembered_upto = int(carry.get("remembered_upto") or 0)
            self._turns_before = int(carry.get("turns_before") or 0)

        # Memoria de largo plazo (opt-in por app vía config['memory']): precalentar el grafo del interlocutor
        # al ABRIR la sesión REAL (1ra corrida — `not carry`; un continue-as-new NO re-warmea, el grafo ya está
        # caliente por la actividad reciente). Best-effort (la activity nunca propaga). Gate config['memory'].
        if config.get("memory") and not carry:
            try:
                await workflow.execute_activity(
                    "warm_memory", {"domain": domain, "cliente_id": cliente_id},
                    start_to_close_timeout=MEMORY_TIMEOUT, retry_policy=_MEMORY_RETRY)
            except ActivityError:
                pass   # best-effort: un warm lento/caído (timeout, sin reintentos) NO deja mudo al agente

        while True:
            try:
                await workflow.wait_condition(lambda: self._pending() or self._closed, timeout=idle_timeout)
            except asyncio.TimeoutError:
                break                                   # sesión ABANDONADA (idle_timeout) -> reap (flush + close)
            if self._closed and not self._pending():
                break                                   # cerrada y sin pendientes -> salir (drena pendientes antes)

            # Sesión PERMANENTE sin reventar el history de Temporal. El chequeo va al TOPE del loop A PROPÓSITO:
            # así lo alcanza TODO camino del turno — ningún `continue` río abajo (p.ej. el de STT vacío) puede
            # saltearlo y dejar el history creciendo sin cota (regresión que el review adversarial cazó cuando el
            # chequeo vivía al final). Cuando el history crece (is_continue_as_new_suggested) o como backstop
            # (cursor>=max_turns_per_run), el workflow se RENUEVA con continue-as-new arrastrando el contexto
            # reciente + el estado + los mensajes en vuelo (incluye el de este turno, aún sin procesar) → NO
            # cierra la sesión, NO resetea el buffer. Antes de renovar, flushea lo no-persistido a la memoria larga.
            if not self._closed and (
                    self._cursor >= max_turns_per_run or workflow.info().is_continue_as_new_suggested()):
                await self._flush_memory(config, domain, cliente_id, channel_ref)
                tail = self._history[-CARRY_TAIL:]
                tail_start = len(self._history) - len(tail)
                carryover = {
                    "history": tail,
                    "state": self._state,
                    "pending": self._inbox[self._cursor:],          # mensajes recibidos aún sin procesar (incl. este turno)
                    "remembered_upto": max(0, self._remembered_upto - tail_start),  # cuántos del tail ya están en Graphity
                    "turns_before": self._turns_before + self._cursor,
                }
                await workflow.wait_condition(workflow.all_handlers_finished)   # no perder signals en vuelo
                workflow.continue_as_new({**config, "carryover": carryover})    # raises: sale de run()

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

        # Flush final: persistir el remanente al cerrar la sesión (salidas: idle-reap, close, done). Gate
        # config['memory'] dentro de _flush_memory. Sin esto, el último batch (<20 msgs) se perdería.
        await self._flush_memory(config, domain, cliente_id, channel_ref)
        return {"closed": self._closed, "turns": self._turns_before + self._cursor, "state": self._state}
