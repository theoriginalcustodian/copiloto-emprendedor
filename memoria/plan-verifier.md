---
name: plan-verifier
description: "Verificador puro de descomposición de planes (#3 Self-Test Kit) — caza ciclos/deps-rotas/descartes antes del gate1, surface-no-block"
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**PR #49 (`feat/plan-verifier`, 2026-06-21) — implementado + probado + ✅ MERGEADO a main.** Primer lever del **Self-Test Kit** (la iniciativa "construir para nosotros mismos aprovechando el test"; el operador eligió 1+2 pero **#3 primero** por barato). Es dogfood de visión: lo construimos NOSOTROS (toca el control-plane durable → frontera), no la fábrica.

**Qué hace:** módulo PURO `deploy/worker/plan_verifier.py` (`verify_plan(raw_units, flat_units) -> list[issue]`) corre en la activity confiable `_plan_feature` (`plan["issues"]`) → se **SURFACE** en el `summary1` del gate1 via `_format_issues` (pura/replay-safe en `feature_workflow.py`). **Surface-no-block** (operador = autoridad del gate, coherente con B1). 7 checks: `cycle`/`broken_dep`/`self_dep`/`duplicate_id`/`basename_collision` (error) + `dropped_unit`/`missing_signature` (warning). Funda el ROI en comportamiento REAL: `_topo_sort` degrada ciclos/deps-rotas y gasta músculo; `_flatten_units` descarta en silencio.

**Review adversarial ultracode (3 lentes opus) cazó 1 CRITICAL + 3 important + 2 minor — TODOS fixeados de raíz:** ids no-string crasheaban `sorted()` y **tumbaban la activity confiable** → normalizar a `str` + cinturón try/except · `_basename` debía espejar `pathlib.Path().name` POSIX del worker Linux (NO normalizar `\`, backslash no es sep) → `PurePosixPath` · `by_id` **last-wins** (= `_topo_sort` dict-comprehension), no first-wins · `_detect_cycles` **iterativo** (sin RecursionError). Review final: **APPROVE 0 blockers**. Tradeoff MINOR gestionado (str-norm diverge de `_uid` en caso off-schema int-id+string-dep → no se paga, gold-plating en código frío).

**Evidencia:** 22/22 PC + **63/63 VPS** (módulo + anti-drift + integración + **workflow-path** que prueba el surface real al gate1) + worker UP 0 ImportError. `spikes/plan-verifier/RESULT.md` · reporte `docs/Implementaciones terminadas/2026-06-21-plan-verifier_reporte.md`.

**✅ E2E vivo full CERRADO** (tras re-auth de Claude, ver [[claude-headless-401-vps]]): `FeatureWorkflow` real sobre `repo-prueba` → Claude generó el plan (`maxer.py`) → `verify_plan` corrió en prod (`plan["issues"]=[]` leído del history) → gate1 SIN falsos positivos → `rejected_gate1`. Más el workflow-path (plan-con-ciclo → `summary` contiene `cycle`) = evidencia completa: corre, surfacea cuando hay issue, no inventa cuando no.

**Lección reusable:** patrón "módulo puro + held-out + anti-drift" + **fidelidad al worker REAL** (un módulo que ESPEJA otro debe replicar su semántica exacta — `pathlib.Path().name` en Linux, dict-comprehension last-wins — o el espejo miente). Lo reusan las piezas 1 (Golden Eval Harness) y 2 (stdlib interna `factory_kit`) del Self-Test Kit. Ladrillo `loop_core.py` INTACTO.
