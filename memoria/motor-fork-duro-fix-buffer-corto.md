---
name: motor-fork-duro-fix-buffer-corto
description: Motor en FORK DURO (2026-07-07) + fix del buffer de corto plazo del motor react (no inyectaba self._history al prompt → amnesia entre turnos)
metadata:
  node_type: memory
  type: project
---

**LEER al tocar el motor conversacional o su relación con la fábrica.**

**FORK DURO del motor (2026-07-07).** `motor/` nació vendorizado del arquetipo `conversational_agent` de la fábrica `unreal-copilot` (vendorizar-con-sync). Desde el 2026-07-07 el copiloto **evoluciona el motor por su cuenta**: `scripts/sync-motor.sh` quedó **retirado** (stub fail-closed) — un `rsync --delete` desde la fábrica pisaría la divergencia. Fix del motor = **acá**; realinear algo puntual con la fábrica = a mano, diff dirigido, nunca sync ciego. Reconciliado en HANDOFF §6, CLAUDE §2, README, `_paths.py`, memoria. [[copiloto-graduacion-fase0-fase1]]

**El bug que gatilló el fork (`fix(motor-react)`).** Síntoma real (operador): "revisá gmail, últimos 100" → responde; luego "dame los últimos 100" → "¿a qué te referís? (¿actividades, Instagram, correos?)". Perdía el turno **inmediatamente anterior**.

**Causa raíz (empírica + lectura):** prod corre `COPILOTO_ENGINE_MODE=react` (verificado en `/proc/PID/environ` del worker vivo). El modo **react** armaba el scratchpad de cada turno con SOLO el mensaje actual (`messages=[{user}]`) y NUNCA inyectaba `self._history` al prompt — el buffer de corto plazo **existía** (state durable del `ConversationWorkflow`, sesión persistente por `conv-{channel}-{cliente}-{ref}` con `USE_EXISTING`) pero react no lo consumía. En cambio **dispatch** sí pasa `prior[-20:]` a `call_llm`. La única "memoria" cross-turno del react era el recall de Graphity (largo plazo, semántico top-K, que ni tiene el turno inmediato: `remember` persiste en batch de ≥20 msgs).

**Fix:** el turno react normal arranca `messages = self._history[-HISTORY_TAIL:]` (turnos previos en texto plano + el actual al final). **Replay-safe** (no cambia el Command sequence: mismo `call_llm_tools`, payload más rico) → seguro para sesiones permanentes en vuelo. `HISTORY_TAIL=20` ≤ `CARRY_TAIL=40` (el continue-as-new arrastra suficiente para que el contexto sobreviva la renovación).

**Reglas duras (que no vuelva):**
- **Paridad dispatch↔react en memoria de corto plazo:** todo motor de turno DEBE inyectar el buffer reciente al prompt. Engine/modo nuevo → replicá el `history[-N:]`.
- **Test multi-turno obligatorio:** los tests react verdes NO lo cazaron porque ejercitaban 1 turno + el gate confirm/cancel, nunca "turno 2 refiere al turno 1 SIN gate". Regresión: `test_react_second_turn_sees_prior_turn_history` (RED→GREEN). Mismo patrón que el bug histórico del recall cross-sesión (test que leía/escribía el mismo thread) → ejercitá la **condición crítica real**. [[no-codificar-la-esperanza-principio-raiz]]
- **Corto plazo ≠ Graphity:** corto = `self._history` en el workflow (Temporal); largo = Graphity. "No recuerda lo que acabo de decir" es Temporal, NO Graphity.

**Estado:** fix commiteado (`fix(motor-react)` en `chore/higiene-memoria-purga-fabrica`), 36/36 motor verde en el VPS. ⚠️ **Deploy a prod PENDIENTE** — auto-mode bloqueó el deploy; requiere OK explícito del operador (`deploy/copiloto/deploy.sh`). [[copiloto-motor-react-concatenadas]] [[copiloto-deploy-multitenant-vivo]]
