---
name: copiloto-motor-react-concatenadas
description: "Motor ReAct para tareas concatenadas del copiloto — DESPLEGADO VIVO, strangler-fig por flag engine_mode"
metadata: 
  node_type: memory
  type: project
  originSessionId: 38945149-5747-498a-82da-7451c7081075
---

> **✅ TESTEADO + CERRADO — NO es un frente de trabajo abierto.** El motor ReAct está desplegado vivo con smoke E2E verificado en vivo, `consultar_actividad` como tool en react, y prompt afinado. Si un tablero/resumen lo lista como pendiente, está **desactualizado → reconciliar, no re-investigar**. **Único residuo = 2 deudas de higiene ya registradas** (NO bloqueantes, NO re-abren el motor): gate anti-drift runtime↔main · rollback a dispatch degradado.

Motor **ReAct** (razona→actúa→observa en loop, encadena N tools por turno) dentro del `ConversationWorkflow` de Temporal (conserva durabilidad cross-corte). **DESPLEGADO VIVO** en prod para el dominio `emprendedor`. Reporte: `docs/copiloto-emprendedor/2026-07-05-motor-react-tareas-concatenadas-implementacion.md`.

**LEER al tocar el motor conversacional, agregar tools, o retomar react/dispatch.**

**Arquitectura (strangler-fig):** `ConversationWorkflow.run()` bifurca por `config.get("engine_mode")` → `_run_react_turn` vs `_run_dispatch_turn` (motor viejo extraído byte-identical). El `engine_mode` lo fija el **config del `start_workflow`**, tomado del flag `COPILOTO_ENGINE_MODE` (env, leído por `web.py`, default `dispatch`). El `register_domain(engine_mode="react")` del worker solo provee tool_schemas/executor — **la bifurcación la decide el flag del start**. Rollback = `COPILOTO_ENGINE_MODE=dispatch` + restart (sin redeploy).

**Reglas duras:**
- **Gate por token:** confirmación HITL atada a `f"{action}:{turn_ix}:{step}"`; fail-closed si no matchea → un click stale NO aprueba la siguiente escritura encadenada. + **corte determinístico post-reject** (`tool_choice="none"` → el modelo no encadena otra escritura).
- **Dedup MP app-side:** MP **no** deduplica links de cobro → `uc_factory.mp_link_dedup` keyed por `(cliente_id, idem_key)`, `idem_key = f"{workflow_id}-{turn_ix}-{step}"` (global/monótono, sobrevive continue-as-new). **Link de cobro ≠ cobro directo** (el receptor debe abrir y pagar) → riesgo real = doble-link, no doble-cobro. [[mercadopago-gateway-impl-followup]]
- **Executor nunca-excepción**: captura ConnectionRequired/ComposioExecutionError/MercadoPagoError/catch-all → `status="error"` como observación (no cuelga el chat). [[agente-loop-tool-failure-retry-infinito]]

**⚠️ REGLA dura (LECCIÓN cara):** un deploy desde un branch atrasado respecto a main sobreescribe features vivas de OTRA sesión en prod (pasó con GoTrue/OAuth/recall) — el worktree aislado NO aísla el estado compartido del runtime. **Antes de sync-to-runtime SIEMPRE `git fetch origin main` + verificar `git rev-list --count HEAD..origin/main`==0; si >0, mergear main PRIMERO.** Detección: md5 runtime-vs-origin/main por archivo. [[tests-se-corren-en-vps]] [[copiloto-gotrue-dedicada-cutover]]

**Prompt del motor:** `SYSTEM_PROMPT_REACT` con guardas "hacé SOLO lo pedido" + "si falta un dato, pedílo (no inventes)" — SIN lenguaje de gate (rompe tool-calling; el test `test_system_prompt_react` lo prohíbe: no `confirm/pendiente/aprob/botón`). En react el prompt **NO** concatena los `PROMPT_FRAGMENT` de servicios (formato dispatch = ruido; los `TOOL_SCHEMAS` ya describen cada tool). Dispatch sí los usa. **⚠️ Deuda:** el domain registra UN system_prompt (react) para AMBAS activities → rollback a `engine_mode=dispatch` corre el dispatcher con prompt react (degradado). Pago = armar prompt+engine_mode por `COPILOTO_ENGINE_MODE` en `build_worker_config`. [[frentes-abiertos-tablero]]

**Tools de 1ra clase (no-Composio):** patrón = schema + `TOOL_INDEX[name]=(kind,)` + runner `_run_*` + branch en `make_tool_executor` (ej. `calendar_book`/`mp`, `mp_charge`/`mp`, `consultar_actividad`/`activity`). Read → NO va en `WRITE_TOOLS` (sin gate); write → sí (gate HITL). **`consultar_actividad`** (recall temporal por fecha "qué hice ayer") ya es tool READ en react — reusa la lógica del dispatcher con el `llm` cableado al executor. [[copiloto-recall-temporal]]

**Why:** primer motor que encadena tools por turno manteniendo el moat (durabilidad Temporal); base de todo agente de acción compuesta del copiloto. **How to apply:** al agregar un servicio Composio → exponer TOOL_SCHEMAS/TOOLS/WRITE_OPS; tool de 1ra clase → el patrón de arriba. [[copiloto-emprendedor-roadmap]] [[agente-conversacional-hardening-3-lentes]] [[conversacion-permanente-continue-as-new]]
