---
name: sp6-observabilidad
description: "SP6 (observabilidad de la fabrica: costo real + dashboard CLI + /pending) — diseñado, implementado vía workflow ultracode y commiteado en feat/sp6-observabilidad; PENDIENTE verificar en el VPS + E2E. Scope A; el intake autonomo de Hermes se difirio a SP7."
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**SP6 = observabilidad de la fabrica.** Sub-proyecto siguiente de [[casa-fabrica-features-diseno]] tras SP4/SP5. **Scope A elegido por el operador (2026-06-20):** SOLO observabilidad; el **intake autonomo de Hermes** (NL → encolar) se difiere a **SP7** (es la pieza nueva, riesgosa, con superficie de ataque + 2 spikes). Spec `docs/superpowers/specs/2026-06-20-sp6-observabilidad-costo-dashboard-design.md` + plan `docs/superpowers/plans/2026-06-20-sp6-observabilidad-costo-dashboard.md`.

**El hallazgo que lo motiva (workflow de analisis ultracode, 8 agentes):** el `$/feature` que el `FeatureWorkflow` ya emitia **mentia 2-10×** — descartaba el costo DOMINANTE: `plan_feature` capturaba `_usage` pero el workflow lo tiraba; `materialize_scaffold` ni lo capturaba. Solo el nivel-3 (raro) llegaba a `cost_by_level`. El ~$0.34-0.60 de Claude (plan+andamiaje) era invisible.

**Semantica de costo (dato del operador):** Claude Code corre con **suscripcion Max ($200/mes FIJO), NO API por uso**. Por eso el costo se reporta en 2 naturalezas, nunca sumadas como un solo out-of-pocket: `cost.real_usd` = DeepSeek (OpenRouter, sale del bolsillo) vs `cost.claude_equiv_usd` = Claude (plan+scaffold+fill, costo-sombra equivalente-API, **$0 marginal bajo Max**). El corte real/sombra = corte por proveedor (ya existente en el trace) → separacion natural.

**Hallazgos del analisis que moldearon el scope:**
- **Push de gates al movil = YA resuelto por SP3** (Telegram es movil, bot dedicado, botones, dispatch, guards). NO se rehace; solo se agrega `/pending` (bandeja).
- **Search Attributes BLOQUEADOS en este stack** (`dynamicconfig.yaml` `advancedVisibilityWritingMode:"off"` + backend SQL postgres → los SA custom NO persisten). Desbloquear = Elasticsearch (~1-2GB RAM en el CX33 8GB). **Descartado** → dashboard = Temporal UI nativa (tunel) + script CLI que itera `list_workflows` + `query state()`.
- Costo en vivo (mid-run via query) + cap de costo + Prometheus/SigNoz = **condicionales** ("activar por metrica, no por proyeccion").

**Descomposicion (4 piezas, sin spikes):** SP6.1 instrumentar costo Claude completo (helpers puros `_cost_of`/`_add`/`_cost_block`/`_aggregate` en `feature_workflow.py`; `materialize_scaffold` devuelve `_usage`; bloque `cost` en `completed` y `failed_needs_human`) · SP6.5 delimitar `feature_description` en `<feature_request>` (anti-injection) · SP6.6 `deploy/ops/dashboard.py` (CLI read-only, temporalio import LAZY para testear los puros sin SDK) · SP6.7 `/pending` en `deploy/hitl/listener.py`.

**Estado (2026-06-20): ✅ CERRADO — validado E2E + deployado + mergeado a main (PR #31 `efc8950`).** Implementado via **workflow ultracode** (4 tasks: implementer sonnet + reviewer adversarial + review final 4-lentes opus, todos `approved`/LIMPIO) + **2 gaps cerrados** + deploy al VPS + E2E vivo. Branch **`feat/sp6-observabilidad`** (6 commits). **Suite VPS: 28 passed** (`/opt/uc-worker-venv`). **E2E vivo `feature-sp6e2e1` (`rejected_gate2`):** el return trae `cost` desglosado REAL — `claude_equiv_usd=$0.900` (plan $0.52 + scaffold $0.38, sombra Max **$0 marginal**) vs `real_usd=$0.0000689` (flash DeepSeek, out-of-pocket). **Confirma EN VIVO el hallazgo:** el costo dominante de Claude que antes se descartaba en `rejected_gate2` (el caso comun) ahora es visible y separado del real. `dashboard.py` lista la cola con cost (pre-SP6 = `-` None-safe); `/pending` listo `feature-sp6pending → gate1` contra Temporal real. Servicios reiniciados (worker + listener importa `dashboard` OK). **✅ MERGEADO a main** (PR #31 squash `efc8950`); GitHub + local + VPS sincronizados.

**Gaps cerrados (cazados por el review final):**
1. **Cost en early-returns (commit `e709fec`):** `rejected_gate2`/`timeout`/`integration_failed` ahora emiten el bloque cost (acumuladores `plan_usage`/`scaffold_usage`/`traces`/`results` inicializados temprano + helper `_cost()` puro, replay-safe). `rejected_gate2` es el caso MAS comun del E2E → sin esto el dashboard "mentia por omision". Validado E2E ($0.90 visible).
2. **Escape del tag de cierre (commit `b09faaf`):** `_plan_prompt` neutraliza un `</feature_request>` embebido (zero-width space) → no hay breakout. Test de breakout verde.

**Gotcha del deploy:** un test que el workflow escribio (`test_failed_needs_human_reports_partial_cost`) usaba `>= pytest.approx(0.60)` → `TypeError` (approx no soporta `>=`); el review no lo cazo porque NO se corre en la PC (sin temporalio). Solo aparecio al correr la suite REAL en el VPS → refuerza: los tests del FeatureWorkflow se verifican en el VPS, no local (commit `fix` del assert a `== 0.97`).

**Reporte de cierre:** `docs/Implementaciones terminadas/2026-06-20_sp6-observabilidad_reporte.md` (PR #35) — problema medido, proceso ultracode, evidencia E2E, los 2 gaps, gotchas y economía Max. Cubre también el contexto del día (SP4 #28 / SP5 #29 + Hermes gpt-4o-mini + alineación de doc #32-#34).

**⚠️ Incidente git + leccion portable:** el workflow de implementacion commiteo los 4 SP6 a **`main` LOCAL** (no a una feature branch) porque el branch activo de la sesion era `main`. NO se pusheo (origin/main intacto en `f356473`). Reorganizado: `git branch feat/sp6-observabilidad` + `git branch -f main origin/main`. **Leccion: los subagentes de un Workflow heredan el branch activo del repo; si es `main`, commitean a `main` local. Verificar/crear la feature branch ANTES de lanzar un Workflow que commitea.**
