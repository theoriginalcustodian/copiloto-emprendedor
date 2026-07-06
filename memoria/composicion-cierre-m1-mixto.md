---
name: composicion-cierre-m1-mixto
description: Cierre del frente composición — M1 boundary linter (ast) + régimen mixto E2E con pieza Temporal + gotcha workflow.sleep
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**Sprint de cierre del frente composición (2026-06-23, rama `feat/cierre-composicion`, `/ejecutar-con-eficiencia` + ultracode).** 3 frentes + 2 fixes de raíz cazados en vuelo:

- **M1 — fitness function del boundary de pieza:** `verify_piece_boundary()` PURA en `shared/factory_kit.py` (cada pieza solo importa el FACADE `clients/` de otra, nunca sus internals `backend/`/`frontend/`); **gate DURO en el molde `validate.py`** (boundary roto = `exit≠0`). Decisión MAYOR del operador: **función pura reusando `cage_for_path`+`imports_module`, NO import-linter upstream** (cero dep, cero spike grimp, testeable en la PC) — "la rueda más cercana ya es nuestra".
- **Hardening por review adversarial (ultracode):** un Workflow de 3 finders + adjudicador opus cazó **5 huecos REALES** verificados empíricamente en el linter → cerrados migrando `_imported_modules` de regex a **`ast`**: falso negativo de imports RELATIVOS cross-pieza (HIGH, el trabajo central del linter), coma/semicolon, falso positivo piece-root, filtro basename. 41 tests verde VPS. *El review pagó: una fitness function con bug da falsa confianza en una fábrica autónoma.*
- **Régimen mixto E2E (`uc-mixed-system`):** la fábrica generó+validó un sistema compuesto de 3 piezas (crm + notify + **scheduler-Temporal**) por flujo C → `validate.py` **ALL PASS** contra lo vivo (cross-pieza + tenancy bidireccional + ReminderWorkflow COMPLETED en cluster real + boundary M1). Demuestra **cage temporal E2E** (no solo unit test) + **M1 sobre internals reales** (`backend/`). Tablas propias `mixed_*` (cada pieza dueña de sus tablas, invariante Comp-1). El E2E es el fixture vivo de M1.
- **Causa raíz cazada por el E2E + fix SISTÉMICO:** la pieza Temporal no se rellenaba (flash→pro→claude todos rojo) porque el músculo no-frontier escribía `asyncio.sleep(3600)` (cuelga el time-skipping) en vez de `workflow.sleep`. Diag empírico (`diag_reminder.py`) confirmó: `asyncio.sleep` TIMEOUT >85s vs `workflow.sleep` 0.9s. Fix en el **`enrich_task` del cage temporal** (gotcha explícito para TODA pieza Temporal futura — *dale el plano, no la orden*); re-run rellenó el reminder con `workflow.sleep`. NO toca `loop_core`.
- **Deuda pre-existente resuelta (operador: cero deuda):** `test_consistency` del kit fallaba por drift PC↔VPS — `gen_skeleton_uc_stack_real` hardcodeado viejo en el VPS vs los archetypes (el Frente 1 endureció el D-3 de `frontend_render`). Re-baselinado el golden + `gen` DRY sincronizado al VPS. Kit verde en ambos.

`open_pr` falló (repo demo local sin remote GitHub) = patrón esperado, no invalida nada. Evidencia: `spikes/composicion-3-mixed/RESULT.md`. [[composicion-por-codigo-implementada]] [[costo-incertidumbre-precision-ratchet]] [[no-codificar-la-esperanza-principio-raiz]]
