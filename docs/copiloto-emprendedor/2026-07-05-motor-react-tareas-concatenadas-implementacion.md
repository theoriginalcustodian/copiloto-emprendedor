# Motor ReAct para tareas concatenadas — Reporte de implementación

> **Fecha:** 2026-07-05 · **Autor:** operador + agente (subagent-driven) · **Estado:** ✅ **DESPLEGADO VIVO** en producción (VPS `unreal-copilot`, copiloto del emprendedor) · **PR #134 MERGEADO a `main`** (`81b3023`)
> **Branch:** `feat/motor-react-agente` (29 commits + merge de `main`, 57 archivos, +7898/−128 LOC)
> **Spec:** `docs/superpowers/specs/2026-07-04-motor-react-agente-conversacional-design.md`
> **Plan:** `docs/superpowers/plans/2026-07-04-motor-react-agente-conversacional-plan.md`

---

## 1. Resumen ejecutivo

El copiloto del emprendedor pasó de un motor **intent-based** (1 mensaje → 1 acción, `dispatch`) a un **motor ReAct durable** que **encadena varias herramientas en un mismo turno** ("agendá la reunión, mandale el mail y cobrale la seña"). El loop ReAct vive **dentro del `ConversationWorkflow` de Temporal** — conserva la durabilidad cross-corte que es el moat del proyecto: si el proceso muere a mitad de una cadena de tools, Temporal la reanuda exactamente donde estaba.

La migración es **strangler-fig**: el motor viejo (`dispatch`) queda intacto y byte-identical; el nuevo (`react`) se activa por **flag de entorno** (`COPILOTO_ENGINE_MODE`), con rollback sin redeploy. Hoy el flag está en `react` para el dominio `emprendedor`.

**Verificado con evidencia ejecutable** (regla 9 "no codificar la esperanza"): 22 tests contra el código exacto desplegado (14 bifurcación + 6 wiring + 2 E2E con LLM real), servicios arrancando limpio, DDL aplicada e idempotente. **Pendiente**: smoke E2E con tráfico real del operador (auth JWT + canal real) y PR a `main`.

---

## 2. El problema que resuelve

El motor `dispatch` clasificaba el mensaje en **un** intent y ejecutaba **una** acción. Una instrucción compuesta ("hacé A, después B, después cobrá C") requería 3 turnos del usuario. El motor ReAct razona-actúa-observa en loop hasta completar la cadena en **un** turno, con el patrón canónico:

```
call_llm_tools → (tool_calls) → execute_tool [gate en escrituras] → observación → repetir → respuesta final
```

---

## 3. Arquitectura

### 3.1 Bifurcación por `engine_mode` (strangler-fig)

`ConversationWorkflow.run()` bifurca al tope de cada turno:

```python
if config.get("engine_mode") == "react":
    done = await self._run_react_turn(...)
else:
    done = await self._run_dispatch_turn(...)   # motor ORIGINAL, byte-identical
```

- `_run_dispatch_turn` es el cuerpo de turno que vivía en `run()` **extraído sin cambios** (Task 11) — cero cambio de comportamiento para el motor viejo.
- El `engine_mode` se fija **en el `config` del `start_workflow`**, que lo toma del flag `COPILOTO_ENGINE_MODE` (leído por `web.py`). El registro del dominio en el worker (`register_domain(..., engine_mode="react")`) provee `tool_schemas`/`tool_executor`, pero **la bifurcación la decide el config del start** → el flag controla el rollout.

### 3.2 Flag de rollout (`COPILOTO_ENGINE_MODE`)

- `web.py`: `COPILOTO_ENGINE_MODE = os.environ.get("COPILOTO_ENGINE_MODE", "dispatch")`, propagado en `extra_config` de `/chat` y `/chat/audio`.
- **Default `dispatch`** → se despliega sin activarse. Se prende seteando `COPILOTO_ENGINE_MODE=react` en el env + restart. Se apaga volviendo a `dispatch` — **rollback sin redeploy**.
- Los workflows ya corriendo mantienen su `engine_mode` de arranque (continue-as-new lo arrastra); el cambio afecta sesiones nuevas.

### 3.3 Componentes nuevos (capa cliente + arquetipo)

| Componente | Rol |
|---|---|
| `LlmProvider.complete_tools()` | Tool-calling nativo OpenAI (`parallel_tool_calls=false`), `tool_choice` configurable, `NonRetryableError` para errores no reintentables |
| `tool_catalog.py` | `build_tool_catalog()`, `TOOL_INDEX`, `WRITE_TOOLS`, `make_tool_executor()` — el executor lee tools directos, **gatea las escrituras**, arma artifacts |
| Activities `call_llm_tools` / `execute_tool` / `recall_memory` | Las 3 activities del loop (I/O de red fuera del workflow, determinismo Temporal) |
| `mp_dedup_store.py` + `uc_factory.mp_link_dedup` | Dedup app-side de links de cobro MP (spike C) |
| `_run_react_turn` / `_react_loop` / `_react_finish` / `_react_send` | El loop ReAct dentro del workflow, con gate HITL y corte determinístico post-rechazo |
| `SYSTEM_PROMPT_REACT` | Prompt del motor (instruye encadenar tools, sin lenguaje de gate ni "json") |
| `ArtifactView.tsx` (frontend) | Render de artefactos clicables por `card.kind` (payment_link → botón Web Share) |

Los 6 servicios Composio (`gmail, docs, drive, sheets, hubspot, instagram`) exponen `TOOL_SCHEMAS` / `TOOLS` / `WRITE_OPS` para el catálogo.

---

## 4. Spike-first: el gate que cerró antes de diseñar

Tres supuestos críticos validados contra la realidad **antes** de escribir el plan (doctrina spike-first). Dos se **refutaron** y cambiaron el diseño — capturados en la capa 0, no en producción:

| Spike | Supuesto | Resultado | Impacto en el diseño |
|---|---|---|---|
| **A** — prompt real | ¿gpt-4o-mini encadena tools de forma fiable con el prompt nuevo? | ✅ **CONFIRMADO** | Prompt viable → seguir |
| **B** — gate cross-turn | ¿el gate HITL sobrevive intacto al cruce de turnos? | ❌ **REFUTADO** | Un doble-click / tarjeta stale podía aprobar la **siguiente** escritura encadenada → **token por gate** (`confirm:{turn_ix}:{step}`) + **corte determinístico post-rechazo** (`tool_choice="none"` tras reject → el modelo no puede encadenar otra escritura) |
| **C** — idempotencia MP | ¿MercadoPago deduplica los links de cobro? | ❌ **REFUTADO** | MP **no** deduplica (ni `external_reference` ni `X-Idempotency-Key`); un retry at-least-once de Temporal crearía un 2º link → **dedup app-side** `uc_factory.mp_link_dedup` keyed por `(cliente_id, idem_key)` con `idem_key = f"{workflow_id}-{turn_ix}-{step}"` (global/monótono, sobrevive continue-as-new) |

> **Matiz MP (anotado por el operador):** un link de cobro **no es un cobro directo** — el receptor todavía tiene que abrir el link y pagar. El riesgo real de C es **doble-link accidental**, no doble-cobro automático. El dedup evita el link duplicado.

---

## 5. Seguridad (controles verificados)

- **Gate en escrituras**: `execute_tool` gatea toda tool en `WRITE_TOOLS` → tarjeta HITL de confirmación antes de ejecutar (cobros, mails, publicaciones).
- **Token por gate** (spike B): la confirmación se ata a `f"{action}:{turn_ix}:{step}"`; al reingresar se valida el token (fail-closed si no matchea) → un click viejo/stale no aprueba una escritura distinta.
- **BOLA cross-tenant**: test adversarial (actor A intenta el recurso de B → denegación). El dedup y los stores filtran por `cliente_id` explícito.
- **Dedup MP fail-safe**: `SELECT → POST → INSERT ON CONFLICT DO NOTHING`; guard de `init_point` NOT NULL antes de persistir.
- **Contrato nunca-excepción del executor**: captura `ConnectionRequired` / `ComposioExecutionError` / `MercadoPagoError` / catch-all → `status="error"` como observación (un fallo de tool externa **no** cuelga el chat — regresión PR #114 respetada, `retry_policy` acotada + error de negocio no se propaga).
- **`NonRetryableError` cableado** en `LOOP_RETRY = RetryPolicy(maximum_attempts=5, non_retryable_error_types=["NonRetryableError"])` (el docstring lo prometía; se verificó que el código lo cumple).

---

## 6. Proceso de implementación (subagent-driven, cero deuda)

- **18 tasks TDD** ejecutadas por implementadores frescos + task-reviewer + fix-loop + ledger de progreso (`.superpowers/sdd/progress.md`).
- **Cero deuda técnica** (constraint explícito del operador): fixes integrados inline (no como secciones de parche), tests con código real (sin placeholders `...`), sin TODOs invisibles.
- **Reviews que cazaron gaps reales**:
  - Per-task: `docs_create` → `docs_create_doc` (el artifact nunca matcheaba el nombre real); `MercadoPagoError` no capturado por el executor.
  - **Whole-branch (opus)**: 5 gaps de integración cross-task **invisibles por-task** — token de gate no atado, `needs_stt` no portado a react, `NonRetryableError` no cableado, tarjeta sin `service` (badge de pago degradado), `init_point None` → violación NOT NULL. Todos cerrados en `9588114`.
- **Race de índice git** entre subagentes concurrentes en el mismo worktree (un `git commit` barrió archivos de otro subagente) → corregido y aprendido: no más implementadores concurrentes en el mismo worktree; los reviewers (read-only) sí paralelizan con un único committer.

---

## 7. Deploy a producción (2026-07-05)

### 7.1 Drift del runtime — diagnosticado y reconciliado

El runtime vivo (`/opt/uc-repos/copiloto`) corría una versión **huérfana** (no en ninguna rama git) de `conversation_workflow.py`. Diagnóstico por md5 contra la historia de `main`:

- El runtime = commit **`30add97`** (fix retry-infinito, con memoria de largo plazo, **anterior** al commit de continue-as-new `2b9c4bc`) **+ 1 línea** (`"card": result.card` en el reply sink) — que resultó ser **exactamente** el mismo cambio que `main` ya tenía commiteado.
- **Conclusión:** la ausencia de continue-as-new **no fue una decisión** — la otra sesión (cutover GoTrue dedicada de esa madrugada) simplemente deployó desde una base más vieja. Nada único del runtime se perdía al deployar. Mi branch es **superconjunto estricto** del runtime.

### 7.2 Replay-safety (verificado antes de tocar prod)

- **0 `ConversationWorkflow` conversacionales vivos** → ningún replay conversacional podía romperse con el código nuevo (CAN + react).
- Único workflow vivo: `MpRefreshWorkflow` → código **idéntico** (md5) en runtime y branch → replay seguro al reiniciar el worker.

### 7.3 Secuencia ejecutada (idempotente, con evidencia)

| Etapa | Acción | Evidencia |
|---|---|---|
| 0 | Backup del código runtime | `/opt/uc-repos/copiloto.bak-pre-motor-react-20260705T130355Z` (2.1M) |
| 1 | DDL `mp_link_dedup` a la DB de prod (`fusion`/`uc_factory`, vía `DATABASE_URL`) — **confirmado por el operador** | `mp_link_dedup: None → mp_link_dedup` (6 columnas); índices únicos ya existían (idempotente) |
| 2 | Sync código al runtime con flag **en dispatch** (overlay tar + CRLF→LF) + restart | md5 `conversation_workflow.py` runtime = branch (285 líneas, CAN+react); worker "up on agent-emprendedor", web "up on 127.0.0.1:8099", **sin tracebacks** |
| 3 | Activar `COPILOTO_ENGINE_MODE=react` (idempotente) + restart | servicios `active`; flag efectiva |

### 7.4 Regresión detectada y corregida (deploy de branch desactualizado)

Al ir a abrir el PR, el diff reveló que el branch estaba **9 commits atrás de `main`** — features que **otra sesión mergeó en paralelo** mientras el motor react se desarrollaba en un worktree aislado:

| Feature de `main` (no en el branch) | Archivos que el 1er deploy pisó en el runtime | Impacto |
|---|---|---|
| Google OAuth #132 | `auth.py`, `web.py` | login con Google roto |
| GoTrue dedicada iss-enforcement #130 | `auth.py`, `serve.py` | agujero SSO-by-accident reintroducido |
| Recall temporal #125 | `dispatcher_emprendedor.py`, `agent_activities.py`, `types.py`, `datetime_resolver.py` | "qué hice ayer" degradado |

**Causa raíz:** `sync-to-runtime` desde un branch cuya base era anterior a esos merges → el overlay sobreescribió los archivos con versiones viejas. El worktree aislado **no aísla el estado compartido** del runtime (riesgo de sesiones paralelas, doctrina del `CLAUDE.md` global).

**Fix de raíz (no parche):** `git merge origin/main` en el branch → conflicto único en `worker_b.py` resuelto integrando `tool_executor`/`engine_mode=react` con el `llm` compartido al `make_dispatcher` (recall temporal) → suite completa verde (35 + 286) → **redeploy del merge** → features restauradas (verificado por md5 runtime = `origin/main` en auth/serve/dispatcher, = `HEAD` en web/activities/worker_b/workflow). Deuda visible anotada: `consultar_actividad` aún no está como tool → recall-por-fecha no disponible en `engine_mode=react`.

**Regla incorporada:** antes de todo `sync-to-runtime`, `git fetch origin main` + verificar `git rev-list --count HEAD..origin/main == 0`; si es >0, mergear `main` primero.

---

## 8. Evidencia ejecutable (tests contra el código desplegado)

Corridos en el runtime real (`/opt/uc-repos/copiloto`, venv `/opt/uc-copiloto-venv`):

| Suite | Qué valida | Resultado |
|---|---|---|
| `test_conversation_workflow_react.py` | bifurcación `dispatch`/`react` (WorkflowEnvironment, LLM scripted) | **14 passed** |
| `test_worker_b_wiring.py` | dominio `emprendedor` en `engine_mode=react` con executor + schemas reales | **6 passed** |
| `test_e2e_react.py` | loop ReAct E2E con **gpt-4o-mini real** (cobro + mail con gate/confirm/reject) | **2 passed** (14.3s) |
| **suite completa post-merge** (arquetipo `backend/agent`) | react + memoria + todo el motor coexistiendo | **35 passed** |
| **suite completa post-merge** (`apps/copiloto/tests`) | `test_auth` (GoTrue/OAuth) + `test_recall_temporal` + `test_worker_b_wiring` (`make_dispatcher` con `llm`) + `test_mp_dedup` + `test_tool_catalog` + … | **286 passed, 37 skipped** (skipped = E2E que piden `OPENAI_API_KEY`) |

Además, en el branch: adversariales del DoD (replay crash-mid-loop, BOLA cross-tenant, provenance del gate `confirmed=True`).

---

## 9. Rollback

1. **Apagar react (sin redeploy):** `COPILOTO_ENGINE_MODE=dispatch` en `/etc/unreal-copilot/copiloto.env` + `systemctl restart uc-copiloto-worker uc-copiloto-web` → sesiones nuevas vuelven a `dispatch` byte-identical.
2. **Revertir el código:** restaurar desde `/opt/uc-repos/copiloto.bak-pre-motor-react-20260705T130355Z` + restart.
3. **DDL:** `DROP TABLE uc_factory.mp_link_dedup` (aditivo, sin impacto en el resto).

---

## 10. Estado y pendientes

**LIVE:** motor ReAct activo en producción para el dominio `emprendedor`; motor `dispatch` intacto como fallback por flag. **PR #134 mergeado a `main`** → drift reconciliado de forma durable (`main` = runtime).

**Cerrado después del deploy:**
- ✅ **`consultar_actividad` portada como tool** (PR #137): el recall temporal por-fecha ("qué hice ayer") ya funciona en `engine_mode=react` — tool de 1ra clase READ (sin gate) que reusa la lógica del dispatcher (`resolve_date_range` + `recall_range` + `summarize_activity`). 5 tests nuevos + desplegado vivo (17 tools en el catálogo). Comentario de deuda de §7.4 al día (PR #138).
- ✅ **Smoke E2E real verificado** (2026-07-05, suplantación autorizada del operador vía JWT forjado con el secret del env, sin exponer PII): (1) `consultar_actividad` ejecuta en react ("qué hice esta semana" → resuelve rango + recall + responde); (2) **encadenamiento** de 2 `consultar_actividad` (hoy+ayer) en un turno; (3) **gate por token** en un write ("agendá…" → `[Confirmar: confirm:3:0]` + card `Google Calendar`, el write PARÓ sin ejecutar). Cero efectos reales (ningún write confirmado).

**Pendientes (cierre):**
1. **Task 16 — gate anti-drift** (follow-up del plan): un check que falle si el runtime diverge de `main` en el archivo del corazón — habría cazado la regresión de §7.4 antes del deploy.

---

## 11. Referencias

- Spec: `docs/superpowers/specs/2026-07-04-motor-react-agente-conversacional-design.md`
- Plan (18 tasks TDD): `docs/superpowers/plans/2026-07-04-motor-react-agente-conversacional-plan.md`
- Spikes: `spikes/react-tool-chaining/` (A) · `spikes/mp-idempotency/` (C) · gate B en el plan §5.2/§5.5
- Ledger: `.superpowers/sdd/progress.md` (branch `feat/motor-react-agente`)
- Código: `deploy/skeleton_kit/archetypes/conversational_agent/reference/backend/agent/conversation_workflow.py` (corazón) · `apps/copiloto/{tool_catalog,mp_dedup_store,worker_b,web}.py`
