---
name: flujo-c-esqueleto-provisto
description: "Modo aditivo \"esqueleto provisto\" del FeatureWorkflow — el operador andamia stubs+tests, la fábrica saltea plan+scaffold y solo rellena"
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**Flujo C "esqueleto provisto" — segundo modo ADITIVO del FeatureWorkflow ([[casa-fabrica-features-diseno]]). Validado E2E 2026-06-21. ✅ MERGEADO PR #51.** Rama `feat/flujo-c-esqueleto-provisto`.

**Qué:** `req["mode"]=="skeleton"` → el operador andamia stubs+tests a mano (desde su Claude Code interactivo del IDE) en `skeleton/`; la fábrica **saltea `plan_feature`+`materialize_scaffold`** y solo rellena los cuerpos contra los **tests del operador**. El flujo Claude (default) queda 100% intacto (lo usa SP7). El control del músculo sigue siendo el **gate de tests objetivo**, no un Claude supervisando.

**Principio rector:** `read_skeleton` deja el root con el **mismo layout que `materialize_scaffold`** (stubs+tests flat, `skeleton/` gitignored) → **todo downstream (relleno/integrate/gate2/open_pr) byte-por-byte idéntico**. `integrate`/`open_pr`/`loop_core` NO se tocan.

**Piezas:** `read_skeleton` + `checkout_existing_branch` (activities, `feature_activities.py`) · branch por `mode` (var local de req, replay-safe) en `feature_workflow.py` + `meta_by_id` · `factory_kit.build_unit` (forma+import-patch, **paga deuda de duplicación**, emite `id`==`unit_id` para verify_plan) + `factory_kit.imports_module` (regex anclado, evita dep fantasma). `read_skeleton` COPIA (no mueve), no borra `skeleton/` → idempotente ante `_RETRY=5`.

**Disciplina:** spike-first (lógica pura 12/12 + **git real VPS**: `prep_branch -B` DESTRUYE / `checkout` sin `-B` PRESERVA) → map+critique ultracode (2 CRÍTICOS pre-impl: prep_branch destructivo + verificador mudo por unit_id/id) → spec → plan → impl (temporal-developer) → **review ultracode 4 findings de raíz** (.gitignore por línea no token-split / dep fantasma `from X import <stem>` / missing_signature en modo C). 153 passed + 1 skipped; 59 tras fixes.

**E2E `flujo-c-e2e1` ✅ (clics reales gate1+gate2):** músculo rellenó `mathx.add=a+b` + `calc.total` que **usa `add` real de mathx** (dep cross-unit resuelta), commit `f688976`. Único fallo = `open_pr` por repo demo **local sin remote GitHub** (open_pr NO es flujo C, ya validado PR #47). Operador: validado, no re-correr (= caso `exprkit`).

**Convención:** `X.py`=stub · `test_X.py`=test obligatorio (sin test → RuntimeError, regla #9) · `heldout_X.py`=opcional · `test_integration.py`=soportado · `conftest.py`=NO soportado v1 (warning surface, deuda gestionada) · stdlib-shadow → RuntimeError.

Reporte: `docs/Implementaciones terminadas/2026-06-21-flujo-c-esqueleto-provisto_reporte.md` · spec/plan en `docs/superpowers/`.
