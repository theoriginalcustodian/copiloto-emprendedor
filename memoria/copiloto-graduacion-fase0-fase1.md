---
name: copiloto-graduacion-fase0-fase1
description: Graduación del Copiloto a repo propio — Fase 0 (consolidar) + Fase 1 (boundary del motor) HECHAS; cutover VIVO desde el repo (2026-07-06), memoria migrada + HANDOFF (Fase 0/1/2/2.5 completas)
metadata: 
  node_type: memory
  type: project
  originSessionId: b42dfd95-a9b9-4970-83ba-eb6cd59742ce
---

**Graduación del Copiloto del Emprendedor a repo propio — Fase 0 + Fase 1 completas (2026-07-06).** Driver = separación comercial/producto. Plan completo (auditoría 4 frentes + decisiones + Fase 2) en `docs/copiloto-emprendedor/2026-07-06-graduacion-plan-fase0-fase1.md`.

**Boundary del motor (F1, el corazón):** los **92 `sys.path.insert` hardcodeados en 56 archivos** de `apps/copiloto` se colapsaron a UN mecanismo — `apps/copiloto/_paths.py` (fuente única; resuelve el motor desde `UC_MOTOR_REF_PATH` env o default in-repo) + `apps/copiloto/conftest.py` (cubre los 41 tests). **Al graduar (Fase 2) SOLO cambia el default en `_paths.py`** — cero ediciones en los 56 archivos. `grep sys.path.insert apps/copiloto` = 0. Gate VPS: **333 colección = baseline + 37 unit verdes, 0 fallos** (staging aislado, ya limpiado).

**2 PRs MERGEADOS en main (2026-07-06):** **#144** (rescate 24 docs + plan) · **#145** (boundary motor + config IaC). Fase 0+1 **100% en main**; Fase 2 destrabada. Worktrees consolidados a 2 (root=main + `uc-fabrica-local` diferido).

**Decisiones LOCKEADAS:** motor = **vendorizar-con-sync** (fleet-platform) en Fase 2 · `dispatcher_emprendedor` queda **divergente** del genérico R1 (deuda visible) · `fabrica-local-containerizada` **diferida** (no es del copiloto; única rama con código real sin mergear) · historia = **filter-repo** en Fase 2.

**Assets DIFERIDOS a Fase 2** (NO en git): dirs de diseño + zips + `Copiloto App.html` MOVIDOS a `../_copiloto-assets-fase2/` (sibling del repo, con README). `es-ar-listen/` (28MB spike voz — permission-denied al mover, algún handle abierto) + PNGs dup/QA + `.claude/settings.json` siguen untracked en el worktree raíz. ⚠️ **NO `git clean -fdx`** en root hasta resolver destino (git-lfs/externo).

**Realidad del VPS (para Fase 2):** el copiloto vivo corre desde **`/opt/uc-repos/copiloto`** (scp-seeded, NO git checkout), NO `/opt/unreal-copilot` (huérfano). Venv `/opt/uc-copiloto-venv` (py3.12). Drift código VPS↔git = 0. El systemd setea `PYTHONPATH=.../reference:.../deploy/worker` (el mount en runtime no depende de los inserts). [[deploy-factory-code-vps]] [[tests-se-corren-en-vps]]

**Fase 2 HECHA (2026-07-06):** repo **`github.com/theoriginalcustodian/copiloto-emprendedor`** (PRIVADO) creado vía `git filter-repo` (**123 commits, historia/blame preservada**). Motor **vendorizado en `motor/`** (`_paths.py` default → `motor/`; `scripts/sync-motor.sh check|sync` mantiene alineado con la fábrica). Scaffolding: CLAUDE.md + README + .gitignore + `requirements.txt` (pin del venv prod) + CI (.github). Gate verde en el VPS con el layout nuevo (333 colección + 37 unit). Checkout local: **`../copiloto-emprendedor`**. Los 68MB de assets → `../_copiloto-assets-fase2/` (externos, gitignored).

**Fase 2.5 HECHA (2026-07-06 — CUTOVER VIVO):** (a) deploy reconciliado al layout `motor/` — `reference→motor` en `deploy.sh`, ambos units (PYTHONPATH), `sync-test-backend.sh`, `gotrue/deploy-gotrue.sh` (grep-first, 5 archivos); spike de mount en el VPS = **333 colección VERDE**. (b) **Cutover ejecutado**: el copiloto vivo corre desde el repo graduado — `deploy/copiloto/deploy.sh` corrido DESDE `../copiloto-emprendedor` sobre `/opt/uc-repos/copiloto`; PYTHONPATH del proceso vivo = `.../motor` (verificado en `/proc/PID/environ`); `deploy/skeleton_kit/.../reference` viejo BORRADO; **smoke E2E 10/10 BETA-READY** post-switch (signup·login·/me·/catalog·/warm·chat·ReAct·connect gmail/mp·refresh). Backup del origen previo: `/opt/uc-repos/copiloto.bak-pre-graduacion-20260706T141252Z` (157M; borrar tras estabilidad). (c) **Memoria migrada** al repo (`memoria/` 113+checkpoints, versionada) + `scripts/seed-memory.sh` (siembra al slug de Claude Code) + `HANDOFF.md` (init cero-fricción). Todo en **PR #1** del repo nuevo. **Falta: Fase 3 = infra 3-nodos.** [[copiloto-deploy-multitenant-vivo]] [[copiloto-dominio-duckdns]] [[factory-identidad-automatizacion-ia]]
