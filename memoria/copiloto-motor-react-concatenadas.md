---
name: copiloto-motor-react-concatenadas
description: "Motor ReAct para tareas concatenadas del copiloto — DESPLEGADO VIVO, strangler-fig por flag engine_mode"
metadata: 
  node_type: memory
  type: project
  originSessionId: 38945149-5747-498a-82da-7451c7081075
---

> **✅ TESTEADO + CERRADO — NO es un frente de trabajo abierto.** El motor ReAct está desplegado vivo con smoke E2E verificado **en vivo** (#141) + `consultar_actividad` como tool en react (#137) + prompt afinado (#142) — reconfirmado por el operador **2026-07-06**. Si un tablero / resumen lo lista como "smoke pendiente / falta testear / no portado `consultar_actividad`", está **desactualizado → reconciliar, no re-investigar**. **Único residuo = 2 deudas de higiene ya registradas** (NO bloqueantes, NO re-abren el motor): Task 16 gate anti-drift runtime↔main · rollback a dispatch degradado.

Motor **ReAct** (razona→actúa→observa en loop, encadena N tools por turno) dentro del `ConversationWorkflow` de Temporal (conserva durabilidad cross-corte). **DESPLEGADO VIVO** en prod 2026-07-05 para el dominio `emprendedor`. **PR #134 MERGEADO a main** (`81b3023`, 2026-07-05) → drift reconciliado durable (main = runtime). Reporte: `docs/copiloto-emprendedor/2026-07-05-motor-react-tareas-concatenadas-implementacion.md`.

**LEER al tocar el motor conversacional, agregar tools, o retomar react/dispatch.**

**Arquitectura (strangler-fig):** `ConversationWorkflow.run()` bifurca por `config.get("engine_mode")` → `_run_react_turn` vs `_run_dispatch_turn` (motor viejo extraído byte-identical). El `engine_mode` lo fija el **config del `start_workflow`**, tomado del flag `COPILOTO_ENGINE_MODE` (env, leído por `web.py`, default `dispatch`). El `register_domain(engine_mode="react")` del worker solo provee tool_schemas/executor — **la bifurcación la decide el flag del start**. Rollback = `COPILOTO_ENGINE_MODE=dispatch` + restart (sin redeploy).

**Reglas duras (de los spikes A/B/C — 2 refutaron):**
- **Gate por token** (spike B): confirmación HITL atada a `f"{action}:{turn_ix}:{step}"`; fail-closed si no matchea → un click stale NO aprueba la siguiente escritura encadenada. + **corte determinístico post-reject** (`tool_choice="none"` → el modelo no encadena otra escritura).
- **Dedup MP app-side** (spike C): MP **no** deduplica links de cobro → `uc_factory.mp_link_dedup` keyed por `(cliente_id, idem_key)`, `idem_key = f"{workflow_id}-{turn_ix}-{step}"` (global/monótono, sobrevive continue-as-new). SELECT→POST→INSERT ON CONFLICT. **Link de cobro ≠ cobro directo** (el receptor debe abrir y pagar) → riesgo real = doble-link, no doble-cobro. [[mercadopago-gateway-impl-followup]]
- **Executor nunca-excepción**: captura ConnectionRequired/ComposioExecutionError/MercadoPagoError/catch-all → `status="error"` como observación (no cuelga el chat). [[agente-loop-tool-failure-retry-infinito]]
- **`NonRetryableError` cableado** en `LOOP_RETRY` (verificado que el código cumple el docstring).

**Deploy (evidencia):** DDL `mp_link_dedup` aplicada a prod (`fusion`/`uc_factory` vía DATABASE_URL, confirmada por operador) · sync a `/opt/uc-repos/copiloto` (NO git checkout → scp+restart, [[deploy-factory-code-vps]]) · flag react activada · **22 tests verdes contra el código desplegado** (14 bifurcación + 6 wiring + 2 E2E gpt-4o-mini real). Backup: `/opt/uc-repos/copiloto.bak-pre-motor-react-20260705T130355Z`.

**Drift reconciliado:** el runtime corría versión huérfana = `30add97` (pre-continue-as-new) + `"card"` (= lo que main ya tenía). CAN ausente por **base vieja, no revert deliberado** (era el cutover GoTrue de esa madrugada). Replay-safe verificado: 0 conv vivos + MpRefreshWorkflow idéntico. [[copiloto-gotrue-dedicada-cutover]]

**⚠️ REGRESIÓN vivida (LECCIÓN dura):** el 1er deploy usó el branch **9 commits atrás de main** → el sync-to-runtime sobreescribió auth.py/web.py/serve.py (GoTrue #130/OAuth #132) + dispatcher/activities/types/datetime_resolver (recall #125) con versiones VIEJAS → **revirtió 3 features vivas de OTRA sesión en prod** (OAuth roto, iss-enforcement perdido, recall degradado). Fix de raíz: `git merge origin/main` en el branch + resolver worker_b.py + **redeploy del merge**. **REGLA: antes de sync-to-runtime SIEMPRE `git fetch origin main` + verificar `git rev-list --count HEAD..origin/main`==0; si >0, mergear main PRIMERO** — el worktree aislado NO aísla el estado compartido del runtime (sesiones paralelas, doctrina CLAUDE.md global). Detección: md5 runtime-vs-origin/main por archivo. [[deploy-factory-code-vps]] [[tests-se-corren-en-vps]]

**Prompt del motor (PR #142):** `SYSTEM_PROMPT_REACT` con guardas "hacé SOLO lo pedido" + "si falta un dato, pedílo (no inventes)" — SIN lenguaje de gate (rompe tool-calling; el test `test_system_prompt_react` lo prohíbe: no `confirm/pendiente/aprob/botón`). En react el prompt **NO** concatena los `PROMPT_FRAGMENT` de servicios (formato dispatch `action=tool_action` = ruido; los `TOOL_SCHEMAS` ya describen cada tool — auditoría: 0 matiz único fuera del schema). Dispatch sí los usa. **⚠️ Deuda (pre-#134):** el domain registra UN system_prompt (react) para AMBAS activities → rollback a `engine_mode=dispatch` corre el dispatcher con prompt react (degradado). Pago = armar prompt+engine_mode por `COPILOTO_ENGINE_MODE` en `build_worker_config`. [[frentes-abiertos-tablero]]

**Tools de 1ra clase (no-Composio):** patrón = schema + `TOOL_INDEX[name]=(kind,)` + runner `_run_*` + branch en `make_tool_executor` (ej. `calendar_book`/`mp`, `mp_charge`/`mp`, `consultar_actividad`/`activity`). Read → NO va en `WRITE_TOOLS` (sin gate); write → sí (gate HITL). **`consultar_actividad`** (recall temporal por fecha "qué hice ayer") ya es tool READ en react (**PR #137**) — reusa la lógica del dispatcher (`resolve_date_range`+`recall_range`+`summarize_activity`) con el `llm` cableado al executor. [[copiloto-recall-temporal]]

**Why:** primer motor que encadena tools por turno manteniendo el moat (durabilidad Temporal); base de todo agente de acción compuesta del copiloto. **How to apply:** al agregar un servicio Composio → exponer TOOL_SCHEMAS/TOOLS/WRITE_OPS; tool de 1ra clase → el patrón de arriba. **PRs #134 (motor) + #137 (consultar_actividad) + #138 (doc) MERGEADOS.** ✅ **Smoke E2E verificado en vivo** (suplantación autorizada por JWT forjado con el secret del env, sin PII): consultar_actividad en react · encadenamiento 2 tools/turno · gate por token (`confirm:3:0`) + card servicio · write paró sin ejecutar. **Residuo de higiene (NO del motor, no bloqueante): Task 16 gate anti-drift + rollback dispatch degradado — ambos ya registrados en tablero+memoria.** [[copiloto-emprendedor-roadmap]] [[agente-conversacional-hardening-3-lentes]] [[conversacion-permanente-continue-as-new]]
