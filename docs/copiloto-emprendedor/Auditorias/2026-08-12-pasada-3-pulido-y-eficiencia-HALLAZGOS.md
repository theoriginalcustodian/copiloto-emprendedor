# Pasada 3 — Pulido y eficiencia · HALLAZGOS

> **2026-08-12, sesión auditoría (read-only).** Contra `origin/main @ 1b299a7c` (worktree `audit/pasada-3`).
> Método: greps dirigidos directos (P1, P2) + 1 sub-agente headless dirigido (P4 costo, P2 completitud,
> P3 estructura, P5 higiene). Mismas prohibiciones que Pasadas 1-2: read-only, no re-derivar lo ya
> contratado (C7, dedup MP, useChat como deuda), `git grep`/`git show origin/main` en vez de leer entero.

**Titular:** **Pasada 3 = casi todo control positivo. 0 P0 · 0 P1 · 3 P2 · 1 P3.** El único costo/turno real
es `perfil_provider` re-consultado por step del loop ReAct (asimétrico: `recall_memory` sí está cacheado).
La duplicación de UI es acotada: además de `useChat` (ya deuda), aparece **una** más (`hitlMapping.ts`).
El resto del repo está sano: catálogo de tools no se reconstruye por turno, 0 N+1 nuevos, 0 archivos
muertos, constantes de fuente única, TODOs con dueño. La beta no tiene deuda de eficiencia bloqueante.

---

## P1 · Cota de listas + virtualización del chat web — VERIFICADO OK (control positivo)

**Estado: RESUELTO, con evidencia.** No es un hallazgo — es la confirmación de que lo que frontend hizo
hoy (hereda C6) quedó bien puesto.
- **Cota aplicada en los 4 puntos de crecimiento** vía helper `acotarMensajes`/`acotarSeenIds`
  (`apps/copiloto-web/src/modules/chat/useChat.ts:130-136`, `slice(-MAX_MENSAJES_HISTORIAL)`):
  rehidratación (`:184`, `:190`), poll (`:233-234`), send (`:295`), sendAudio (`:337`). La constante se
  **importa** de `@copiloto/core` (`:3`) — cero drift de número con mobile.
- **Virtualización SÍ entró:** `MessageList.tsx:2,69` usa `@tanstack/react-virtual` (`useVirtualizer`),
  monta sólo lo visible + `OVERSCAN_FILAS`. Mockeado en tests (`test/setup.ts:19`).
- **Tests presentes:** `useChat.test.ts:281-324` ejercitan que `send`/rehidratación mantienen `messages`
  acotado a `MAX_MENSAJES_HISTORIAL` y que el persistido también se poda.

## P2 · Duplicación de código entre capas de UI — parcial (pendiente completitud del sub-agente)

- La duplicación grande **ya está identificada y contratada como deuda**: `useChat.ts` (web, 348 líneas)
  reimplementa `packages/core/src/chat/chatMachine.ts` en vez de importar `reducirChat`/`hidratarEstado`
  (mobile sí converge). Ratificada Opción B (convergencia como deuda con dueño=frontend) en el buzón hoy.
- **Respuesta a "¿hay OTRA dupe clase-`useChat`?": sí, exactamente una** → H-2. Web converge a
  `@copiloto/core` en **47 archivos** (auth, stores CRUD de todos los dominios, formateo, sesión); la
  reimplementación no es un patrón extendido, son 2 casos puntuales del módulo chat.

### H-2 · `hitlMapping.ts` (web) reimplementa a mano `hitl.ts` del core · P2
Dónde: `apps/copiloto-web/src/modules/chat/hitlMapping.ts:20-29` vs `packages/core/src/chat/hitl.ts:23-32`.
Falla: `isConfirmCancelPair`/`classifyChoices` (web) duplican exactamente `esParConfirmarCancelar`/
`clasificarChoices` (core) — mismas firmas, **sin** `import from '@copiloto/core'`. Un bug fijado en un
lado no se propaga al otro (misma causa raíz que `useChat`).
Clase: nombres exportados de `hitl.ts` → 2 funciones, ambas con contraparte manual en web, 0 imports de
`hitl` en `hitlMapping.ts`.
Dueño sugerido: frontend. Fix: importar de `@copiloto/core`, borrar la copia.

### H-3 · `motivoFallo.ts` del core no se consume en web · P2 informativo (control, no dupe)
Dónde: `packages/core/src/chat/motivoFallo.ts` existe · `apps/copiloto-web/src/` → 0 referencias en
cualquier forma (`git grep -c motivoFallo|motivo_fallo` = 0). No hay reimplementación equivalente tampoco.
Es el reverso de H-2: el módulo existe en core y web ni lo usa ni lo copia. Sin daño activo. Dueño: frontend (bajo).

---

## P4 · Costo operativo por request/turno

### H-1 · `perfil_provider` re-consultado en cada step del loop ReAct, no 1×/turno · P2
Dónde: `motor/backend/agent/agent_activities.py:167-171` (`call_llm_tools`) +
`apps/copiloto/worker_b.py:106-112` (`_perfil_provider` → `PerfilNegocioStore.get()`).
Costo: `call_llm_tools` se invoca 1× por `step` dentro de `_react_loop` (hasta `REACT_MAX_STEPS=8`,
`conversation_workflow.py:368`); cada invocación dispara un SELECT a `PerfilNegocioStore` sin cache. Un
turno con 3-4 tool_calls paga 3-4 SELECTs idénticos del mismo tenant, en cada conversación de cada tenant.
Clase: `recall_memory` (misma clase de dato "estable del tenant") **sí** está cacheado 1×/turno vía
`_react_recall` (`conversation_workflow.py:511`, comentario explícito "no por iteración → preserva prefijo
de prompt-cache"); `perfil_provider` no tiene ese resguardo — protección asimétrica, mismo patrón.
Dueño sugerido: backend. Fix: cachear el perfil 1×/turno igual que `recall_memory`.

## P3 · Estructura backend — 109 módulos planos, propuesta de agrupamiento (sin mover nada)

### H-4 · `apps/copiloto/` es root plano sin subpaquetes · P3 (propuesta, no bug)
Dónde: `apps/copiloto/*.py`. Agrupamiento por dominio propuesto (conteo sobre `git ls-tree origin/main`,
109 módulos no-test): `afip_*`=11 · `mp_*`=5 · `soporte_*`=7 · grafo/memoria=10 · `mi_dia_*`=6 ·
`admin_*`=6 · self-healing (autosanacion/ciclo/forjador/auditor/canario/trauma/deposito/fingerprint/
taxonomia)=11 · stores de negocio=12 · web/http (`*_web.py`, `app.py`, `serve.py`)=15 · Temporal
(worker/dispatch/workflow/activities)=16 · infra transversal (auth/errores/interceptor/rate_limit/log/
latido/_paths)=9 · perfil/prompts/catalog/contexto/onboarding=18 · observabilidad
(activity_summary/auditoria_store/metering_store)=3. Es refactor de organización, **cero urgencia**;
riesgo alto de romper imports si se hace mal → sólo cuando haya ventana y con dueño backend.

## P5 · Higiene del repo — limpio (control positivo)
`git grep` de `.bak/.old/_copy/deprecated/_v2/_backup` en `apps/copiloto/` → **0 archivos muertos**.
Constantes `MAX_MENSAJES_HISTORIAL` y `TIMEOUT_HTTP_MS` de **fuente única** en `packages/core`, sin copia
local en ningún consumidor. Sólo **2 TODOs** en `apps/copiloto/`+`motor/`, ambos con dueño y fecha (regla
"atajo = TODO + dueño + fecha" cumplida). Sin hallazgo.

---

## Evidencia de lo que está BIEN (control positivo — no relleno)
- **Catálogo de tools NO se reconstruye por turno:** `build_tool_catalog()`/`TOOL_INDEX`/`WRITE_TOOLS`
  (`tool_catalog.py:392-471`) son module-level (import-time); nada dentro de `_react_loop`/`call_llm_tools`
  los rearma.
- **`recall_memory` (grafo) cacheado 1×/turno** explícitamente por prompt-cache (`conversation_workflow.py:511`).
- **0 N+1 nuevos** dentro del loop de reply (los únicos `list_connections` son los 5 sitios de C7 ya
  contratados, sin instancias nuevas).
- **0 LLM duplicado en el flujo ReAct.** Los dos `llm.complete` de `inteligencia_chat.py:143/164` son un
  módulo aparte (chat consola planner→executor), arquitectura intencional, no redundancia.
- **Web converge a `@copiloto/core` en 47 archivos.** La reimplementación de lógica es sólo `useChat`
  (deuda conocida) + `hitlMapping` (H-2); no es un patrón extendido.

## Fuera de alcance (declarado)
- Read-only: no se mutó código (los fixes los baja planificación como contratos). No se re-verificó lo
  ya contratado en Pasadas 1-2 (C7 Composio, dedup MP, catch-all ReAct, pool, tests adversariales).
- P4 no corrió profiling en vivo: los costos se identificaron por lectura de código contra `origin/main`,
  no por medición de latencia real. Un profiling en prod podría revelar costos que el grep no ve.
