---
name: conversacion-permanente-continue-as-new
description: ConversationWorkflow = sesión PERMANENTE vía continue-as-new (no cierra por history). LEER al tocar el loop del agente conversacional o su ciclo de vida de sesión. Incluye la lección del bug del valve.
metadata:
  node_type: memory
  type: project
  originSessionId: 53c58a53-271e-474c-9267-f7720a2c6820
---

**El `ConversationWorkflow` (plantilla `conversational_agent`) es una sesión PERMANENTE** (PR #122, 2026-07-04, deployado; `deploy/skeleton_kit/archetypes/conversational_agent/reference/backend/agent/conversation_workflow.py`). Antes cerraba por idle a los 30 min y al reabrir arrancaba con el **buffer vacío** (perdía el contexto reciente) — sin sentido para un copiloto (una charla siempre viva).

**Diseño:** el history de Temporal se acota con **continue-as-new**, NO con el cierre. Loop `while True` que RENUEVA cuando `workflow.info().is_continue_as_new_suggested()` (método, temporalio 1.28) o el backstop `max_turns_per_run` (default 200, configurable). El `carryover` arrastra: `history[-CARRY_TAIL:]` (40, contexto del LLM) + `state` + `pending=inbox[cursor:]` (mensajes en vuelo, incl. el del turno) + `remembered_upto` (recalculado relativo al tail) + `turns_before`. **NO cierra, NO resetea el buffer.** Flushea lo no-persistido a la memoria larga ANTES de renovar. Único cierre real: signal `close`, `done` del dominio, o **idle-reap** de sesión ABANDONADA.

- **idle CONFIGURABLE por app** (`config['idle_timeout_seconds']`, default 30 min retro-compatible → clínica/bots de turnos intactos). El copiloto pasa **7 días** (`web.py` `COPILOTO_IDLE_TIMEOUT_S`) → permanente para el uso activo, reap solo de abandonadas. Una plantilla, dos comportamientos.
- **Warm gateado en `not carry`** (el CAN no re-warmea; el grafo ya está caliente por la actividad reciente).

**🔑 REPLAY-SAFE verificado (no asumido) con el `Replayer` de Temporal contra las 17 historias reales** (incl. el workflow EN VUELO del operador): 17/17 OK. Claves de replay-safety: default idle (30 min) reproduce el timer viejo; el chequeo de CAN **no emite command hasta disparar** (history chico → no dispara); warm gateado igual. **Patrón reutilizable: ante un cambio de workflow con sesiones en vuelo, correr `Replayer` sobre las historias vivas ANTES de deployar** (`from temporalio.worker import Replayer`; `list_workflows` + `fetch_history` + `replay_workflow`). Es el gold-standard, no "confío en el diseño".

**🐛 LECCIÓN (bug cazado por el review adversarial 3-lentes+verify, fixeado ANTES del cierre):** al reemplazar el cap `for range(MAX_TURNS)` por `while True` con el valve de continue-as-new al **FINAL** del loop, un `continue` río arriba (el path `needs_stt`-vacío: nota de voz que transcribe vacío → `continue`) **salteaba el valve** → history crecía sin cota → `HistorySizeLimitExceeded` (justo lo que el CAN previene). El `for range` viejo acotaba TODO camino (un `continue` igual avanza el contador); el `while True` con valve-abajo no. **Regla:** un cap de history / valve de continue-as-new va al **TOPE del loop** (lo alcanza todo camino), nunca al final donde un `continue` lo puede saltear. El copiloto era inmune (STT en el front-door `/chat/audio`, solo despacha `text`), pero la plantilla (Telegram/clínica con voz → `needs_stt`) no. Otros 4 hallazgos del review REFUTADOS (carryover/señales/`close`-durante-CAN correctos: los signal handlers son SÍNCRONOS → `all_handlers_finished` siempre True → sin task-boundary entre snapshot y `continue_as_new` → sin pérdida de señales).

**Tests:** `deploy/skeleton_kit/archetypes/conversational_agent/test_continue_as_new.py` (4 CAN: contexto-preservado/no-pierde-mensajes/idle-reap/**stt-vacío-igual-renueva** por cambio de run_id) — 15 archetype verdes + 203 copiloto + Replayer 17/17.

[[copiloto-memoria-provider-ladrillo]] [[agente-loop-tool-failure-retry-infinito]] [[no-pelear-con-la-fabrica-hand-fix-primero]] [[copiloto-deploy-multitenant-vivo]]
