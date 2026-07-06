---
name: agente-loop-tool-failure-retry-infinito
description: Bug+fix (PR
metadata: 
  node_type: memory
  type: project
  originSessionId: 53c58a53-271e-474c-9267-f7720a2c6820
---

**Síntoma (vivo, 2026-07-04):** el chat web del copiloto quedaba en **"Pensando…" para siempre** y dejaba de procesar mensajes tras pedir una acción de una tool no conectada (crear doc en Google Docs).

**Causa raíz (evidencia dura en logs):** `dispatch_intent` en **attempt 89/92** = reintento ILIMITADO de Temporal. Cadena: dispatcher ejecuta la tool Composio → Composio 400 `ConnectedAccountNotFound` (cuenta no conectada = **permanente**) → el dispatcher deja que suba como **excepción del activity** → `dispatch_intent` **sin `retry_policy`** → Temporal reintenta ∞ → el workflow queda **trabado en ese turno** → nunca procesa los mensajes siguientes. `ConversationWorkflow` era la **única anomalía sin retry_policy del repo**. **Mismo patrón** que el finding crítico ya arreglado para la memoria (warm/remember), pero en el CORE del loop — el review adversarial de la memoria fue demasiado estrecho y no lo vio como **sistémico de la plantilla**. [[copiloto-memoria-provider-ladrillo]]

**Fix 3 capas (PR #114, branch `fix/agente-conversacional-tool-failure-no-cuelga`, desplegado vivo):**
1. **gateway** (`composio_gateway.py`): `ConnectionRequired` (subclase de `ComposioExecutionError`) distingue "cuenta no conectada" (permanente) de fallo transitorio; `_is_connection_missing` detecta el slug `ConnectedAccountNotFound` (agnóstico del SDK, por texto).
2. **dispatcher** (`dispatcher_emprendedor.py`): wrapper que traduce `ConnectionRequired`/`ComposioExecutionError` → `DispatchResult` de negocio (*"conectá X primero"* con nombre humano del toolkit / *"probemos de nuevo"*), `done=False` + `pending` limpio → **NUNCA propaga**. El `ctx None` (error de programación) queda FUERA del try → sigue fallando fuerte.
3. **conversation_workflow** (`conversation_workflow.py`): `LOOP_RETRY(maximum_attempts=5)` en las **6** `execute_activity` del loop (STT/LLM/dispatch/envío×2/HITL) = red de seguridad para cualquier fallo permanente futuro. Replay-safe (agregar retry_policy no altera la secuencia de Commands). El best-effort de memoria conserva su `_MEMORY_RETRY(max=1)`.

**REGLA (aplica a TODA app del arquetipo `conversational_agent`, clínica incluida):** (a) toda `execute_activity` del loop de un workflow durable lleva `retry_policy` ACOTADA — sin ella, el default de Temporal es reintento ILIMITADO y un fallo permanente cuelga el turno; (b) un error de NEGOCIO de una tool (400 no-reintentable) se traduce a un `DispatchResult`, NUNCA se propaga como excepción de activity.

**Lección de PROCESO (no menor):** el wiring de memoria dejó `test_web_app`/`test_audio` ROTOS (los fakes `_fake_route_inbound` no aceptaban el `extra_config` nuevo) y **llegó a main (PR #113)** porque la corrida de "56 verdes" NO incluyó esos archivos → **correr la suite COMPLETA del módulo tocado, no solo los tests nuevos/adyacentes.** Arreglado en el mismo PR #114. [[cierre-del-aprendizaje-no-opcional]]

**Evidencia:** 242 passed en el VPS; deploy vivo con worker sano (0 reintentos nuevos); las sesiones que estaban colgadas pasaron a **COMPLETED** al reiniciar (el reintento en curso encontró la cuenta ya conectada + el código nuevo). [[composio-gateway-ladrillo]] [[agente-conversacional-hardening-3-lentes]] [[no-codificar-la-esperanza-principio-raiz]]
