---
name: self-test-kit
description: "factory_kit (#2 lib pura interna) + Golden Eval Harness (#1 velocímetro regresivo) — construido para la fábrica misma"
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**PR #50 (`feat/self-test-kit`, 2026-06-21).** Levers #2 y #1 del Self-Test Kit (la iniciativa "construir para nosotros mismos aprovechando el test"; el operador eligió 1+2 pero ejecutados tras [[plan-verifier]] #3). Un sprint de 2 componentes, mismo patrón que #3 (módulo puro + evidencia ejecutable).

**#2 `factory_kit`** (`shared/factory_kit.py`) — librería **PURA** (re/pathlib) que centraliza la lógica pura compartida (layout: flatten_units/flat_basename + constantes · grafo: topo_sort/dep_closure/repo_deps_for_unit/enrich_task/uid/format_issues · seguridad: scrub/safe_branch · costo: sum_cost/cost_block/aggregate/trace_entry) entre `plan_verifier`/`feature_activities`/`feature_workflow`. **Paga la deuda de [[plan-verifier]]**: las constantes espejo + el test anti-drift se ELIMINARON (fuente única). El workflow durable la importa con `with workflow.unsafe.imports_passed_through()` (validado por **spike A**). Quedó inline lo que hace I/O (`_git`, `_read_lf`, `_safe_path`) y lo mono-consumidor (`_plan_prompt`).

**#1 Golden Eval Harness** (`deploy/eval/`) — **velocímetro regresivo**: casos golden contra la fábrica REAL → `score.py` (scorecard puro, reusa factory_kit.sum_cost) → baseline **POR MODO** (`baseline-{mode}.json`) → `compare_baseline` detecta regresiones (pass-rate ↓, held-out ↓, costo ↑). Multi-capa: **modo músculo** (default, barato/repetible: IterativeCodeWorkflow standalone + held-out en el gate Docker hardened, frontera intacta; `pass_rate=1.00, $0.00009, 9s` sobre 3 casos) + **modo full** (hito: FeatureWorkflow, gates auto-decididos gate1=approve/gate2=reject, ids `eval-*`). 3 casos golden: trivial · multi-unit (dep_files/SP4) · held-out anti-overfit (B1).

**Spikes (spike-first):** A — el workflow puede importar un módulo puro propio sin romper el sandbox (una v1 vía heredoc falló con `No spec for __main__` = artefacto del harness de prueba, no del producto → patrón fiel = workflow-en-módulo). B — modo-músculo ~2.6s/$0.00002, costo en `r["usage"]`.

**2 reviews adversariales:** Fase A (refactor) **APPROVE 0 blockers**; Fase B (harness) **changes_requested → todo fixeado**.

**Lecciones reusables:**
1. **No unificar funciones que PARECEN iguales:** había DOS `_basename` con semántica distinta (feature_workflow normalizaba `\`→`/` para determinismo cross-platform; plan_verifier usaba PurePosixPath para espejar `_flatten_units`). Se unificó a `flat_basename` SOLO tras confirmar equivalencia observable por tests + E2E (no por aserción). Invariante POSIX documentado para SP7.
2. **Medición honesta (no auto-engaño):** el review B cazó que el `held_out_passed` del modo full daba `True` aunque NINGÚN held-out corriera (`not [] = True`). Fix: solo afirmar desde evidencia real (units con held-out corrido); sin evidencia → `None` (se ignora en el agregado). Un velocímetro que se auto-engaña es peor que no tenerlo.
3. **Baseline por-modo:** comparar costo músculo ($0.0001) vs full ($0.0002) = manzanas/peras → `baseline-{mode}.json`.

Ladrillo `loop_core.py` **INTACTO**. Frontera intacta. Reporte `docs/Implementaciones terminadas/2026-06-21-self-test-kit_reporte.md`. **Próximo: SP7** (intake autónomo) ahora con velocímetro.
