---
name: seniorworkflow-durable-sp7
description: "SP7 sub-proyecto 2 — SeniorWorkflow durable (loop del senior generar→validar real→heal→merge-gate HITL→merge), validado E2E con clic real del operador"
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**2026-06-22, ✅ MERGEADO a `main` PR #55 (squash; rama `feat/sp7-seniorworkflow`, commit `e4abb57`).** Sub-proyecto 2 de **SP7**: orquesta el **loop del senior** en un workflow Temporal **durable**, para que deje de vivir en la sesión efímera de Claude Code y sobreviva cortes (incidente 529). La fábrica ya orquestaba el loop del músculo; esto orquesta el del **arquitecto**.

**Arquitectura:** `SeniorWorkflow` (`shared/senior_workflow.py`) **envuelve** al `FeatureWorkflow` como child y agrega: `validate_real` → `heal` bounded → merge-gate HITL → `merge_pr`. El merge va **DESPUÉS** de validar ("una vez validado todo se hace el redeploy").
- **Flag `subordinate`** en FeatureWorkflow (aditivo, standalone byte-idéntico): auto-aprueba gate1+gate2 + `open_pr` con `auto_merge=False` (PR draft). El único HITL es el merge-gate del padre.
- **`validate_real`**: corre el `validate.py` **provisto por el senior** (decisión: la validación real es parte del plano, como el esqueleto) contra instancias reales, en el control-plane (frontera A, post-gate), creds por env, **redact por valor** (no solo PATs — cubre Supabase JWT/OpenRouter).
- **`heal`**: Claude headless bounded (`max_heal_turns=3`), feedback localizado del fallo.
- **merge-gate**: `wait_condition`+signal `decide` (request_id="merge"); `notify_approval` + el listener ya eran GENÉRICOS → cero cambios.
- **Intake sin Hermes**: `deploy/ops/run_senior_loop.py` (Hermes relegado a observación, decisión del operador).

**Decisiones (no re-litigar):** scope A (plano humano: el operador provee esqueleto + validate.py) · frontera A (validación en control-plane post-gate, deuda gestionada) · gates A (HITL solo merge final). NO Hermes.

**Validado E2E (evidencia ejecutable, repo `uc-senior-e2e`):** el loop completo corrió con **clic real del operador** en el merge-gate: generar (subordinate→músculo rellenó `calc.add`) → `validate_real` pass (sin heal) → merge-gate → operador autoriza → merge a `main` (`def add: return a+b` en main). **El E2E cazó un bug REAL que los fakes enmascaraban** (valida la división del operador): `merge_pr` fallaba con `Pull Request is still a draft` (el PR nace draft por `auto_merge=False`) → **fix de raíz: `gh pr ready` antes de merge** + test no-regresión. Como el `await` sync del stack canónico — el gate/fakes enmascaran, el E2E real caza lo cross-capa.

**Tests:** subordinate 51 passed (cero regresión) · senior_activities 6 · SeniorWorkflow 5 (determinismo replay-safe). **Review opus Wave 1:** APPROVE, **cero violaciones de determinismo**; Important (scrubber no cubría Supabase/OpenRouter) fixeado por valor.

**Gotcha de uso:** el flujo C espera que la rama EXISTA con el esqueleto antes de disparar (el operador la crea desde su IDE). `run_senior_loop` NO crea la rama (`checkout_existing_branch` sin `-B`). El primer E2E falló por no preparar la rama (no bug del código).

**Skills Temporal usadas** (regla #3): `temporal-developer` + `temporal-ai-patterns` (child-workflow + signal-HITL + ReAct bounded). El FeatureWorkflow es el ejemplo canónico in-repo que el SeniorWorkflow reusa.

**Cerrado:** PR #55 mergeado + reporte de cierre (`docs/Implementaciones terminadas/2026-06-22-seniorworkflow-durable-sp7_reporte.md`) + CLAUDE.md §5 + README. **SP7 COMPLETO** (sub-proyecto 1 kit canónico PR #54 + sub-proyecto 2 este). **Mejora futura:** ~~arquetipo `validate.py` en el [[kit-canonico-skeleton]]~~ ✅ HECHO (molde `reference/validate_reference.py`, PR #57 `240e6f9`) · re-correr units tras heal (deuda spec §9) · `run_senior_loop` podría crear la rama (hoy el operador la crea) · un `SeniorWorkflow`→`completed` de una corrida limpia no se re-disparó (las piezas validadas individualmente; el bug del draft hizo que e2e2 terminara FAILED, fix validado mergeando ese PR). **Próximo: SP8** (intake autónomo: NL → create_project + features encadenadas, con el SeniorWorkflow como sustrato durable). Ver spec/plan `docs/superpowers/{specs,plans}/2026-06-22-seniorworkflow-durable*`.
