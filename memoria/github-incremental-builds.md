---
name: github-incremental-builds
description: "Build incremental GitHub — crear repos (b) + auto-merge gate2 (a) + deps cross-feature (3er pedazo), probado E2E"
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**2026-06-21 — Build incremental de la fábrica (la casa construye SISTEMAS, no features aisladas).** Rama **`feat/github-incremental-builds`** (commits `d95ebe5`+`2a4eecd`, **PR #47** base `feat/mega-sprint-palancas` — stack sobre #46; **✅ MERGEADO a main 2026-06-21**). Cierra el goal del operador "feature B compila contra el código REAL de feature A". Tres piezas + fixes:

- **(b) crear repos por PROYECTO** — `deploy/ops/create_project.py` (CLI, idempotente): `gh repo create --private` + clone a `/opt/uc-repos/<name>` + **onboardea Graphity** (`repo-<name>`, coincide con `graph_id` del workflow). Un proyecto = repo + memoria desde el día 0.
- **(a) auto-merge al aprobar gate2** — `_open_pr` hace `gh pr merge --squash --delete-branch` (solo corre tras integración verde + gate2 aprobado). La feature siguiente ramifica de `origin/main` (`_prep_branch` ya lo hacía) → ve el código mergeado.
- **(3er pedazo) deps cross-feature en el GATE** — el cable git (a) NO bastaba: el gate del músculo está aislado, así que si feature 2 importaba un módulo de feature 1, el gate fallaba → el músculo **inlineaba** (E2E lo cazó: `stats.py` no importaba `mathx`). Fix: `read_repo_context` (activity confiable) lee los módulos FLAT previos del repo; `_repo_deps_for_unit` (puro) da a cada unit SOLO los que importa → a `dep_files` del gate (reusa SP4) + a la suite de `_integrate`. **Ahora el músculo importa y verifica contra el código real.**

**Probado E2E (uc-demo-inc2):** F1(mathx) + F2(ops) ambas `completed` + auto-merged. **`ops.py` `from mathx import add, mul`; `OPS["+"] IS mathx.add` = True** (identidad: usa el OBJETO función REAL de feature 1, no copia). El gap del inline cerrado.

**Spikes:** `spikes/gh-incremental-cable/RESULT.md` (crear repo + merge + cable git). **Reviews ultracode:** (a)+(b) → 1 HIGH (idempotencia durable de `_open_pr`: retry post-merge con rama borrada no revienta el push — invariante cross-corte) + MEDIUM (`_safe_branch` anti argument-injection, relevante p/ SP7) + LOW (`_scrub` PATs en logs · guard clone parcial), **todos fixeados**. 3er pedazo → **APPROVE** (0 Crit/High/Med; determinismo+frontera regla 6 con doble validación en el sink+regresión byte-idéntica limpios) + 1 LOW (no-silent-cap: la truncación de `repo_context` loguea `repo_context_truncated`) **fixeado**. Evidencia: 58 tests verde + E2E identidad.

**Decisiones operador:** `--squash` · repos en cuenta personal `theoriginalcustodian` · `create_project` onboardea Graphity. Auto-merge ON al aprobar gate2.

🔐 **PATs en `~/.claude/secrets/github.env`** (fine-grained `GITHUB_PAT_FACTORY` en el gh del VPS + classic `GITHUB_PAT_CLASSIC` operativo) — **AMBOS pasaron por chat = comprometidos**, rotar pre-producción (decisión operador: no rotar en dev). El fine-grained tiene Admin/Contents/PR R&W + All repos.

**Deuda gestionada:** `_REPO_CTX_MAX=24` puede truncar en repos grandes → relevance-scoping vía Graphity = Capa-2 (cuando el repo crezca). Decision auto-merge vs branch-protection (review LOW): hoy la confianza es ordering+gate2; `--auto` + branch-protection server-side = hardening futuro. Construye sobre [[casa-fabrica-features-diseno]] + [[mega-sprint-palancas]] + [[memoria-grafo-fabrica-diseno]].
