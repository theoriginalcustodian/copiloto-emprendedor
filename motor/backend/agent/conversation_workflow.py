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
import json
import re
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
HISTORY_TAIL = 20                           # mensajes del buffer de corto plazo que el turno react inyecta al prompt (<= CARRY_TAIL)
# `self._react_transcript` (fix narra-sin-hacer v2, Parte 2 -- [[copiloto-narra-la-accion-sin-ejecutarla]]):
# durable, paralelo a self._history pero con el shape NATIVO de OpenAI (assistant tool_calls / role='tool'),
# no texto plano. self._history sigue siendo SOLO texto (alimenta memoria/Graphity, que filtra por content
# str -- ver memory_provider.remember); react_transcript alimenta el SEED de `messages` de cada turno react,
# para que el LLM vea la EVIDENCIA estructural de sus propias tool_calls pasadas, no solo su relato en texto.
REACT_TAIL = 30                             # entradas del transcript estructural que siembran un turno react
REACT_CARRY_TAIL = 60                       # entradas que arrastra el continue-as-new (>= REACT_TAIL, mismo ratio 2x que CARRY_TAIL/HISTORY_TAIL)
MAX_TURNS_PER_RUN = 200                     # backstop de continue-as-new si is_continue_as_new_suggested no dispara
STAFF_TIMEOUT = timedelta(hours=4)          # espera de decision humana (HITL) antes de seguir
ACTIVITY_TIMEOUT = timedelta(seconds=120)   # LLM puede tardar (reasoning) -> margen amplio
# Activities del loop (STT/LLM/dispatch/envío/HITL): retry ACOTADO. Sin retry_policy usan el DEFAULT de
# Temporal = reintentos ILIMITADOS → un fallo PERMANENTE (ej. una tool de Composio que se propaga como
# excepción) reintenta ∞ y cuelga el turno ('Pensando…' eterno, bug 2026-07-04). 5 intentos absorben blips
# transitorios reales; un error permanente falla en tiempo ACOTADO en vez de colgar. Es la red de seguridad:
# la raíz del caso Composio ya se ataja en el dispatcher (no propaga ConnectionRequired). Best-effort de
# memoria usa su propio _MEMORY_RETRY (max=1), NO este.
# `non_retryable_error_types` (FIX HIGH, review final): un 401/insufficient_quota de la API LLM
# (`clients.agent.providers.llm.NonRetryableError`) NO se arregla reintentando (credencial/cupo inválidos) →
# Temporal matchea por el NOMBRE de la clase de la excepción (str), no por el objeto — sin esto la activity
# quemaba los 5 intentos completos contra una API rota antes de fallar igual (mismo resultado final, tiempo
# desperdiciado + 5x requests ruidosos a una cuenta ya sabida rota).
LOOP_RETRY = RetryPolicy(maximum_attempts=5, non_retryable_error_types=["NonRetryableError"])
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
        self._react_transcript: list[dict] = []   # scratchpad react DURABLE, shape nativo (tool_calls/role='tool') -- fix narra-sin-hacer v2
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
            self._react_transcript = list(carry.get("react_transcript") or [])
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
                    "react_transcript": self._react_transcript[-REACT_CARRY_TAIL:],
                    "state": self._state,
                    "pending": self._inbox[self._cursor:],          # mensajes recibidos aún sin procesar (incl. este turno)
                    "remembered_upto": max(0, self._remembered_upto - tail_start),  # cuántos del tail ya están en Graphity
                    "turns_before": self._turns_before + self._cursor,
                }
                await workflow.wait_condition(workflow.all_handlers_finished)   # no perder signals en vuelo
                workflow.continue_as_new({**config, "carryover": carryover})    # raises: sale de run()

            msg = self._inbox[self._cursor]
            self._cursor += 1
            # Un turno que revienta NO puede matar la sesión. Esta es una sesión PERMANENTE: si la
            # excepción sale de `run()`, el workflow queda `Failed` y el emprendedor se queda con un
            # chat que acepta lo que escribe y nunca contesta — sin error, sin card, sin nada que
            # mirar. Ya pasó, y el síntoma fue exactamente ése: un `429 insufficient_quota` del LLM
            # tumbó la conversación y sólo se vio mirando el journal del worker
            # (`agente-no-responde-revisar-cuota-llm`). Un fallo de UN turno es un fallo de ese turno.
            #
            # Versionado porque el `except` agenda una activity que no está en el history de las
            # ejecuciones que ya venían corriendo (78 medidas contra el Temporal del VPS): en un
            # replay, `patched` devuelve False y toman el camino de siempre; de su próximo turno
            # NUEVO en adelante, el fix ya las cubre.
            if workflow.patched("un-turno-roto-no-mata-la-sesion"):
                try:
                    done = await self._despachar_turno(config, msg, domain, channel, channel_ref,
                                                       cliente_id)
                except Exception as exc:  # noqa: BLE001 — el turno, no la sesión
                    # `Exception` y no `BaseException`: `CancelledError` y el `ContinueAsNewError`
                    # tienen que seguir subiendo, son control de flujo de Temporal, no fallas.
                    workflow.logger.error("turno fallido, la sesión sigue viva: %s", exc)
                    await self._avisar_turno_fallido(channel, channel_ref, cliente_id)
                    done = False
            else:
                done = await self._despachar_turno(config, msg, domain, channel, channel_ref,
                                                   cliente_id)

            # Memoria de largo plazo: persistir en BATCH (~20 msgs ≈ 10 turnos) para no saturar la extracción
            # LLM server-side de Graphity (cada add_messages dispara una extracción). Gate config['memory'].
            # Común a AMBOS modos (dispatch/react): ambos apendean a self._history dentro de su _run_*_turn.
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

            if done:
                self._closed = True
                break

        # Flush final: persistir el remanente al cerrar la sesión (salidas: idle-reap, close, done). Gate
        # config['memory'] dentro de _flush_memory. Sin esto, el último batch (<20 msgs) se perdería.
        await self._flush_memory(config, domain, cliente_id, channel_ref)
        return {"closed": self._closed, "turns": self._turns_before + self._cursor, "state": self._state}

    async def _despachar_turno(self, config: dict, msg: dict, domain: str, channel: str,
                               channel_ref: str, cliente_id: str) -> bool:
        """Elige el motor del turno. Extraído para que la rama versionada y la de compatibilidad
        despachen por el MISMO camino: duplicar el `if engine_mode` en las dos era garantizar que
        alguna futura corrección tocara sólo una."""
        if config.get("engine_mode") == "react":
            return await self._run_react_turn(config, msg, domain, channel, channel_ref, cliente_id)
        return await self._run_dispatch_turn(config, msg, domain, channel, channel_ref, cliente_id)

    async def _avisar_turno_fallido(self, channel: str, channel_ref: str, cliente_id: str) -> None:
        """Le dice al usuario que ESE mensaje no salió, sin prometer nada que no pasó.

        El aviso importa tanto como no morirse: un turno que falla en silencio es indistinguible de
        uno que el copiloto todavía está pensando, y la persona se queda esperando. Y si el propio
        aviso no se puede entregar, se traga — quedarse sin canal no puede ser motivo para matar la
        sesión, que es justo lo que este bloque vino a evitar.
        """
        try:
            await workflow.execute_activity(
                "send_channel_message",
                {"channel": channel, "channel_ref": channel_ref, "cliente_id": cliente_id,
                 "text": "Uf, algo se me trabó procesando ese mensaje 😖. ¿Me lo repetís?",
                 "choices": []},
                start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
        except Exception as exc:  # noqa: BLE001
            workflow.logger.error("tampoco se pudo avisar del turno fallido: %s", exc)

    # ── modo 'dispatch': intent-based, el motor ORIGINAL (byte-identical) ────────────────────────────
    async def _run_dispatch_turn(self, config: dict, msg: dict, domain: str, channel: str,
                                 channel_ref: str, cliente_id: str) -> bool:
        """Turno del motor INTENT-BASED (modo 'dispatch', default): STT si hace falta -> call_llm (clasifica
        intent) -> dispatch_intent (dominio) -> HITL si escala -> responder por el canal. Devuelve `done`
        (True -> cerrar la sesión). Es EXACTAMENTE el cuerpo de turno que vivía en `run()` antes de la
        bifurcación por engine_mode (Task 11) — cero cambio de comportamiento, solo extraído a método."""
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
                return False
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
                 "text": reply, "choices": result.choices, "card": result.card},
                start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)

        return result.done

    # ── modo 'react': loop tool-calling con gate cross-turn (Task 12, el corazón) ────────────────────
    REACT_MAX_STEPS = 8   # hard-cap del loop dentro de un turno (guardrail terminación §5.5)

    async def _run_react_turn(self, config: dict, msg: dict, domain: str, channel: str,
                              channel_ref: str, cliente_id: str) -> bool:
        """Loop ReAct de UN turno. El scratchpad (messages) es durable en self._state['react']. Un write abre
        el gate cross-turn: parquea + card + sale; el callback confirm/cancel reingresa por este mismo método.
        `turn_ix` = índice de turno GLOBAL y monótono (sobrevive continue-as-new) → base del idem_key único."""
        kind = msg.get("kind", "text")
        user_text = msg.get("text", "")

        # Nota de voz (turno normal, NUNCA la reentrada callback — needs_stt jamás llega con kind='callback'):
        # transcribir ANTES de seguir (el `text` traía el file_id, no el contenido). Gap MEDIUM del review: sin
        # este bloque el motor mandaba el file_id crudo al LLM como si fuera texto del usuario. Si no se pudo
        # transcribir -> pedir texto y cortar el turno, sin tocar ningún gate abierto (lo supersede la rama de
        # abajo una vez `kind` pasa a 'text' — mismo criterio que un mensaje de texto nuevo).
        if kind == "needs_stt":
            stt = await workflow.execute_activity(
                "transcribe_voice", {"channel": channel, "file_id": user_text},
                start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
            transcript = ((stt or {}).get("text") or "").strip()
            if not transcript:
                await workflow.execute_activity(
                    "send_channel_message",
                    {"channel": channel, "channel_ref": channel_ref, "cliente_id": cliente_id,
                     "text": "Uy, no pude escuchar tu audio 🙉. ¿Me lo escribís?", "choices": []},
                    start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
                return False
            user_text = transcript              # de acá en más es texto normal (lo procesa el loop react)
            kind = "text"

        parked = self._state.get("react")
        conv = {"cliente_id": cliente_id, "channel": channel, "channel_ref": channel_ref}

        # ── callback STALE sin gate parqueado (FIX LOW, review final): el gate que lo emitió ya se resolvió
        #    (doble-click tardío sobre una card vieja, o un callback mal-dirigido). El `user_text` acá es el
        #    TOKEN interno del gate (ej 'confirm:1:0'), NUNCA texto real del interlocutor -- dejarlo caer al
        #    turno normal lo mandaría al LLM como si fuera un mensaje de usuario (fuga del mecanismo interno
        #    del gate al scratchpad). Corte determinístico, sin LLM, sin tocar el estado.
        if kind == "callback" and not parked:
            await self._react_send(channel, channel_ref, cliente_id, "Listo 👍", None)
            return False

        # ── reingreso de confirmación (callback determinístico, SIN LLM) ──────────────────────────
        if parked and kind == "callback":
            pend = parked["pending"]                 # {tool_call, turn_ix, step}
            # HIGH (bug de dinero): el value trae `action:token` con token=f'{turn_ix}:{step}' del gate que lo
            # emitió (ver _react_loop). Un doble-click, una card vieja, o un confirm que llega tras encadenar al
            # SIGUIENTE gate ya NO matchea el pending vigente -> no-op fail-closed: el pending NO se toca, la
            # card correcta (la del gate VIGENTE) sigue siendo la única que puede resolverlo.
            expected_token = f'{pend["turn_ix"]}:{pend["step"]}'
            action, _, token = user_text.partition(":")
            if token != expected_token:
                return False
            self._state.pop("react", None)
            messages = list(parked["messages"])
            idem = self._react_idem_key(pend["turn_ix"], pend["step"])   # MISMA key que el gate (B1)
            if action == "confirm":
                tr = await workflow.execute_activity(
                    "execute_tool",
                    {"domain": domain, "name": pend["tool_call"]["name"], "arguments": pend["tool_call"]["arguments"],
                     "conv": conv, "confirmed": True, "idem_key": idem},
                    start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
                tc_msg = _assistant_tool_call_msg(pend["tool_call"])
                # minor (defensa): indexado directo `tr["observation"]` -> KeyError = no-determinismo que
                # cuelga la corrida; `.get(...) or {}` es la misma defensa que ya usa el resto del loop.
                tr_msg = _tool_result_msg(pend["tool_call"]["id"], tr.get("observation") or {})
                messages.append(tc_msg)
                messages.append(tr_msg)
                self._react_transcript.append(tc_msg)   # fix narra-sin-hacer v2 Parte 2: evidencia estructural durable
                self._react_transcript.append(tr_msg)
                return await self._react_loop(config, domain, conv, channel, channel_ref, cliente_id,
                                              messages, start_turn_ix=pend["turn_ix"], start_step=pend["step"] + 1,
                                              last_artifact=tr.get("artifact"),
                                              # sembrado: esta tool YA ejecutó (confirmed=True, arriba) ANTES de
                                              # entrar al loop -- sin esto el marcador del cierre "olvida" el
                                              # tool_call que resolvió el gate de confirmación.
                                              tool_trace=[pend["tool_call"]["name"]])
            # cancel -> CORTE DETERMINÍSTICO (spike B): 1 llamada tool_choice='none', solo texto.
            cancel_tc_msg = _assistant_tool_call_msg(pend["tool_call"])
            cancel_tr_msg = _tool_result_msg(pend["tool_call"]["id"], {"status": "cancelled_by_user"})
            messages.append(cancel_tc_msg)
            messages.append(cancel_tr_msg)
            # honesto y útil: deja constancia estructural de que la tool se PROPUSO y se CANCELÓ (no que
            # ejecutó) -- un turno futuro no debe imitar "se ejecutó" sobre algo que el usuario rechazó.
            self._react_transcript.append(cancel_tc_msg)
            self._react_transcript.append(cancel_tr_msg)
            closing = await workflow.execute_activity(
                "call_llm_tools",
                {"domain": domain, "messages": messages, "tool_choice": "none",
                 "system_extra": self._state.get("react_mem_ctx", ""),
                 # `cliente_id` para que la activity cargue el perfil del negocio del tenant. Va en el
                 # PAYLOAD y no como comando nuevo: agregar un execute_activity acá rompería el replay
                 # de las sesiones en vuelo, que al ser permanentes son todas.
                 "cliente_id": cliente_id},
                start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
            await self._react_finish(channel, channel_ref, cliente_id,
                                     closing.get("content") or "Listo, lo cancelé.", None)
            return False

        # ── turno de TEXTO con un gate abierto = supersede (major #5): el pending viejo se descarta ────
        #    (nunca sobrevive a un turno nuevo → una card stale ya no puede re-disparar el write abandonado).
        if parked and kind != "callback":
            self._state.pop("react", None)   # cancel implícito; la card vieja queda inerte (spike B S4: replanifica)

        # ── turno normal: recall de memoria 1×/turno (major #3), luego arranca el scratchpad ──────────
        turn_ix = self._turns_before + self._cursor            # global y monótono (base del idem_key, B1)
        await self._react_recall(config, domain, cliente_id, channel_ref, user_text)
        self._history.append({"role": "user", "content": user_text})   # memoria/CAN (major #4)
        self._react_transcript.append({"role": "user", "content": user_text})
        # Scratchpad del turno arranca con el BUFFER DE CORTO PLAZO reciente, NO solo el mensaje actual: sin esto
        # el LLM react no veía el turno anterior → perdía referencias cortas ('dame los últimos 100' tras 'revisá
        # gmail' → '¿a qué te referís?'). Acotado (no crece sin cota); el continue-as-new arrastra el tail.
        #
        # fix narra-sin-hacer v2 Parte 2 [[copiloto-narra-la-accion-sin-ejecutarla]]: `self._react_transcript`
        # (shape NATIVO -- assistant tool_calls / role='tool', no texto plano) reemplaza a `self._history` como
        # fuente cuando el patch está activo. self._history solo texto imitable ("Anoté...") sin evidencia de
        # tool_call al lado -- el LLM aprendía que decir la frase ES hacer la acción (PR#85 lo midió 2/2, PR#88
        # 3/3). react_transcript le da al turno siguiente la MISMA evidencia estructural que ya atiende el LLM
        # dentro de un turno (parallel_tool_calls=false, mensajes role='assistant'/tool_calls y role='tool').
        # `workflow.patched(...)` (defensivo, igual criterio que el marcador de PR#85 -- comment :22-27 de este
        # archivo: enriquecer el payload de una activity YA EXISTENTE no cambia el Command sequence, replay-safe
        # de por sí; se versiona igual por auditabilidad de sesiones en vuelo).
        if workflow.patched("react-structural-transcript"):
            messages = list(self._react_transcript[-REACT_TAIL:])
        else:
            messages = list(self._history[-HISTORY_TAIL:])
        return await self._react_loop(config, domain, conv, channel, channel_ref, cliente_id,
                                      messages, start_turn_ix=turn_ix, start_step=0, last_artifact=None)

    def _react_idem_key(self, turn_ix: int, step: int) -> str:
        """idem_key único por (sesión, turno, paso) y ESTABLE para el retry at-least-once del MISMO activity
        (B1). workflow_id es constante en la sesión; turn_ix es global/monótono (sobrevive CAN) → dos cobros
        en turnos distintos NUNCA colisionan; el retry del mismo cobro reusa la misma key → dedup correcto."""
        return f"{workflow.info().workflow_id}-{turn_ix}-{step}"

    async def _react_recall(self, config: dict, domain: str, cliente_id: str, channel_ref: str,
                            user_text: str) -> None:
        """Recall de memoria de largo plazo 1×/TURNO (no por iteración → preserva el prefijo de prompt-cache,
        gate-blocker #3). Best-effort (max=1, jamás cuelga). Persiste el Context Block en self._state para que
        sobreviva la pausa del gate y el continue-as-new. Gate config['memory']."""
        if not config.get("memory"):
            self._state["react_mem_ctx"] = ""
            return
        try:
            out = await workflow.execute_activity(
                "recall_memory",
                {"domain": domain, "cliente_id": cliente_id, "thread_ref": channel_ref, "query": user_text},
                start_to_close_timeout=MEMORY_TIMEOUT, retry_policy=_MEMORY_RETRY)
            self._state["react_mem_ctx"] = (out or {}).get("context", "") or ""
        except ActivityError:
            self._state["react_mem_ctx"] = self._state.get("react_mem_ctx", "")   # best-effort: no romper el turno

    async def _react_loop(self, config: dict, domain: str, conv: dict, channel: str, channel_ref: str,
                          cliente_id: str, messages: list, *, start_turn_ix: int, start_step: int,
                          last_artifact, tool_trace: list | None = None) -> bool:
        step = start_step
        last_sig = None                                          # detección de no-progreso (major #7)
        # tools YA ejecutadas de este turno (fix narra-sin-hacer): sembrado con lo que ejecutó el reingreso de
        # confirmación (_run_react_turn) antes de entrar acá, y se sigue completando abajo con cada tool que
        # este loop resuelve. Viaja a _react_finish para que el marcador cubra TODO el turno, no solo esta pasada.
        trace = list(tool_trace) if tool_trace else []
        while step < self.REACT_MAX_STEPS:
            resp = await workflow.execute_activity(
                "call_llm_tools",
                {"domain": domain, "messages": messages, "tool_choice": "auto",
                 "system_extra": self._state.get("react_mem_ctx", ""),
                 # `cliente_id` para que la activity cargue el perfil del negocio del tenant. Va en el
                 # PAYLOAD y no como comando nuevo: agregar un execute_activity acá rompería el replay
                 # de las sesiones en vuelo, que al ser permanentes son todas.
                 "cliente_id": cliente_id},
                start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
            tool_calls = resp.get("tool_calls") or []
            if not tool_calls:                                   # el modelo cerró con texto
                content = resp.get("content") or "Listo."
                # TODO(narra-guardrail, backend, 2026-07-23): deuda GESTIONADA -- se retira cuando la CURA
                # (Parte 2, react_transcript arriba) pase el retest adversarial en sesión limpia. Ver
                # memoria/copiloto-narra-la-accion-sin-ejecutarla.md.
                #
                # fix narra-sin-hacer v2 Parte 1 [[copiloto-narra-la-accion-sin-ejecutarla]]: el LLM cerró SIN
                # tool_call pero el texto afirma una acción completada ("anoté", "listo", ...) -- la mentira
                # medida 3/3 en device (spike-b, PR#88). Se la rechaza y se re-pregunta UNA vez con
                # tool_choice="required" para forzar la llamada real. Scopeado por la MENTIRA (el texto), no
                # por intención de turno: una aclaración honesta ("¿qué categoría fue?") no usa estos verbos y
                # no dispara esto -- y si tras el `required` la tool devuelve un resultado honesto de negocio
                # ("no encontré"), ESE es el output correcto, el guardrail no fuerza a mentir en sentido inverso.
                # `not trace`: si el turno YA ejecutó una tool más temprano en este mismo loop, un cierre
                # "Listo, ..." es VERDAD (hay tool_call real detrás, en trace) -- sin este guard, un cierre
                # honesto tras una ejecución real dispararía un required espurio.
                if workflow.patched("narra-guardrail-required-retry") and not trace and _narra_completitud(content):
                    resp = await workflow.execute_activity(
                        "call_llm_tools",
                        {"domain": domain, "messages": messages, "tool_choice": "required",
                         "system_extra": self._state.get("react_mem_ctx", ""), "cliente_id": cliente_id},
                        start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
                    tool_calls = resp.get("tool_calls") or []
                    content = resp.get("content") or content
                if not tool_calls:
                    await self._react_finish(channel, channel_ref, cliente_id, content, last_artifact,
                                             tool_trace=trace)
                    return False
            tc = tool_calls[0]                                   # parallel_tool_calls=false -> 1
            sig = _tool_signature(tc)                            # no-progreso: misma tool+args 2× consecutivas
            if sig == last_sig:
                await self._react_finish(channel, channel_ref, cliente_id,
                                         "Me quedé trabado repitiendo lo mismo, ¿lo intentamos de otra forma?", None,
                                         tool_trace=trace)
                return False
            last_sig = sig
            tr = await workflow.execute_activity(
                "execute_tool",
                {"domain": domain, "name": tc["name"], "arguments": tc["arguments"], "conv": conv,
                 "confirmed": False, "idem_key": self._react_idem_key(start_turn_ix, step)},
                start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)
            if tr.get("status") == "needs_confirmation":         # GATE: parquear + card + salir del turno
                self._state["react"] = {"messages": messages,
                                        "pending": {"tool_call": tc, "turn_ix": start_turn_ix, "step": step}}
                obs = tr.get("observation") or {}
                preview = obs.get("preview") or "¿Confirmás esta acción?"
                # FIX HIGH (review final): la card debe llevar el `service` — el frontend keyea el badge de
                # riesgo (Mercado Pago/Instagram) y el monto por `card.service` (`hitlMapping.ts`); sin esto
                # TODO gate react degradaba a card vacía. El motor (capa PLANTILLA, domain-blind) NO conoce
                # nombres de toolkit: solo re-empaqueta lo que el executor de dominio ya puso en `observation`
                # (mismo patrón que `DispatchResult.card` en el modo dispatch, cero conocimiento nuevo acá).
                card = {"kind": "confirm", "service": obs.get("service", ""), "label": obs.get("label", "")}
                await self._react_send(channel, channel_ref, cliente_id, preview, tr.get("artifact"),
                                       choices=_confirm_choices(start_turn_ix, step),  # token por gate (HIGH)
                                       card=card)
                return False                                     # el confirm/cancel reingresa por _run_react_turn
            tc_msg = _assistant_tool_call_msg(tc)
            tr_msg = _tool_result_msg(tc["id"], tr.get("observation") or {})
            messages.append(tc_msg)
            messages.append(tr_msg)
            self._react_transcript.append(tc_msg)   # fix narra-sin-hacer v2 Parte 2: evidencia estructural durable
            self._react_transcript.append(tr_msg)
            trace.append(tc["name"])                            # llegó hasta acá -> execute_tool corrió de verdad
            if tr.get("artifact"):
                last_artifact = tr["artifact"]
            step += 1
        # tope de pasos: cerrar con texto de fallo (guardrail, jamás loop silencioso)
        await self._react_finish(channel, channel_ref, cliente_id,
                                 "Se me hizo largo esto, ¿lo intentamos de nuevo por partes?", None,
                                 tool_trace=trace)
        return False

    async def _react_finish(self, channel: str, channel_ref: str, cliente_id: str, text: str, artifact,
                            tool_trace: list | None = None) -> None:
        """Cierre TERMINAL del turno (texto final, no la card del gate): apendea a self._history para memoria/CAN
        (major #4) y despacha por el canal con el artifact clicable.

        `tool_trace` (fix narra-sin-hacer, [[copiloto-narra-la-accion-sin-ejecutarla]]): nombres de las tools
        que el turno EJECUTÓ de verdad (`execute_tool` ya resuelto, no el `needs_confirmation` parqueado) antes
        de cerrar. Sin esto, self._history solo guardaba el texto final ("listo, lo hice ✅") y el scratchpad de
        un turno posterior veía el patrón "usuario pide X -> assistant dice que lo hizo" SIN ningún tool_call en
        el medio -- el LLM lo imita y en un turno futuro narra sin ejecutar. El marcador determinístico que se
        apendea junto al texto es la evidencia de que hubo tool_call real EN ESE turno.

        `workflow.patched(...)`: no es necesario para el replay en sí -- enriquecer `content` (mismo shape de
        dict, mismo Command sequence) es tan replay-safe como el precedente de `cliente_id` en el payload de
        `call_llm_tools` (comment :22-27, de-riskeado además con Replayer.replay_workflow contra CAN real, ver
        avance_backend_de-risk-narra-sin-hacer). Se usa igual por contrato: versiona explícitamente el momento
        en que una sesión EN VUELO empieza a narrar con evidencia, y deja un `TemporalChangeVersion` auditable
        para buscar sesiones viejas vs nuevas sin tener que leer el history a mano."""
        content = text
        if tool_trace and workflow.patched("history-tool-trace-marker"):
            content = f"{text}\n{_tool_trace_marker(tool_trace)}"
        self._history.append({"role": "assistant", "content": content})
        # fix narra-sin-hacer v2 Parte 2: cierre del turno en el transcript estructural -- el texto final queda
        # DESPUÉS de los tool_call/tool_result reales que ya se apendearon arriba (en _react_loop/_run_react_turn),
        # así que un turno futuro ve la secuencia completa (pidió X -> tool_call -> tool_result -> texto), no solo
        # el texto suelto que el marcador de PR#85 intentaba compensar sin éxito.
        self._react_transcript.append({"role": "assistant", "content": text})
        await self._react_send(channel, channel_ref, cliente_id, text, artifact)

    async def _react_send(self, channel: str, channel_ref: str, cliente_id: str, text: str, artifact, *,
                          choices=None, card=None) -> None:
        # `card` explícito (FIX HIGH gate needs_confirmation) tiene prioridad; sin él, se deriva del artifact
        # como antes (cierre terminal con artifact real, ej payment_link/email_draft — 'pending' se filtra:
        # nunca es una card presentable, solo el marcador interno del executor).
        if card is None:
            card = dict(artifact) if artifact and artifact.get("kind") != "pending" else {}
        await workflow.execute_activity(
            "send_channel_message",
            {"channel": channel, "channel_ref": channel_ref, "cliente_id": cliente_id,
             "text": text, "choices": choices or [], "card": card},
            start_to_close_timeout=ACTIVITY_TIMEOUT, retry_policy=LOOP_RETRY)


# ── helpers module-level (fuera de la clase, deterministas, sin I/O) ─────────────────────────────────
def _confirm_choices(turn_ix: int, step: int) -> list[dict]:
    """Choices Confirmar/Cancelar con el token del gate (`turn_ix:step`) embebido en el `value` (HIGH, bug de
    dinero): ata el callback al gate ESPECÍFICO que lo emitió. Sin esto, un doble-click, una card vieja, o un
    confirm que llega tarde tras encadenar al siguiente gate podía aprobar un write que el usuario nunca vio."""
    token = f"{turn_ix}:{step}"
    return [{"label": "Confirmar", "value": f"confirm:{token}"}, {"label": "Cancelar", "value": f"cancel:{token}"}]


def _assistant_tool_call_msg(tc: dict) -> dict:
    """Mensaje 'assistant' con el tool_call, en el shape que la API espera para reinyectar el scratchpad."""
    return {"role": "assistant", "content": None, "tool_calls": [
        {"id": tc["id"], "type": "function",
         "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"])}}]}


def _tool_result_msg(tool_call_id: str, observation: dict) -> dict:
    return {"role": "tool", "tool_call_id": tool_call_id, "content": json.dumps(observation, ensure_ascii=False)}


def _tool_signature(tc: dict) -> str:
    """Firma canónica de un tool-call (nombre + args ordenados) para la detección de no-progreso. Determinista."""
    return tc.get("name", "") + "|" + json.dumps(tc.get("arguments") or {}, sort_keys=True, ensure_ascii=False)


def _tool_trace_marker(tool_names: list) -> str:
    """Marcador determinístico de tools EJECUTADAS en el turno, para self._history (fix narra-sin-hacer).
    Texto plano (no JSON): el LLM lo lee como parte del scratchpad, no como una tool nueva a parsear."""
    return "[" + " ".join(f"tool:{name}→ok" for name in tool_names) + "]"


# Palabras de CIERRE que afirman una acción YA completada (fix narra-sin-hacer v2, Parte 1 -- guardrail).
# Set de formas EXACTAS (no prefijos): un stem como "aprob" matchearía también "¿aprobás?"/"aprobar" -- una
# PREGUNTA legítima del copiloto pidiendo confirmación, no una mentira. Sólo las formas de HECHO CONSUMADO
# (pasado 1ra persona / participio) entran acá. Lista ajustable con lo que se vea en payloads reales -- el
# spec de planificación la deja abierta a propósito.
_PALABRAS_DE_CIERRE = frozenset({
    "anoté", "anote", "anotado", "anotada",
    "registré", "registre", "registrado", "registrada",
    "guardé", "guarde", "guardado", "guardada",
    "marqué", "marque", "marcado", "marcada",
    "listo", "lista",
    "hecho", "hecha",
    "aprobado", "aprobada",
    "enviado", "enviada", "mandé", "mande", "mandado", "mandada",
    "actualicé", "actualice", "actualizado", "actualizada",
})


def _narra_completitud(texto: str) -> bool:
    """¿El texto final del turno AFIRMA que una acción ya se completó? Detección léxica acotada a los verbos
    de cierre del dominio, por PALABRA EXACTA -- no dispara en turnos de aclaración honestos (ej. "¿aprobás
    el presupuesto?" no matchea "aprobado"). Scopeado por la MENTIRA (el texto), no por intención de turno
    (ver _react_loop, Parte 1 del fix v2)."""
    palabras = re.findall(r"[a-záéíóúñ]+", (texto or "").lower())
    return any(p in _PALABRAS_DE_CIERRE for p in palabras)
