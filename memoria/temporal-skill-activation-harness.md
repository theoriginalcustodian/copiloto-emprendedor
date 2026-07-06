---
name: temporal-skill-activation-harness
description: Cómo se activan las skills de Temporal sin citarlas a mano — regla 3 imperativa (CLAUDE.md) + hook validator de determinismo (harness global). Por qué dormían y la solución C+D.
metadata: 
  node_type: memory
  type: project
  originSessionId: 2482606c-a89b-44ac-a311-eae9c7d7e344
---

**Problema (2026-06-20):** las skills de Temporal (`temporal-developer`, `temporal-ai-patterns`) se activan por trigger **léxico sobre el prompt**, pero en unreal-copilot la "Temporal-ness" es **estructural** (todo el código lo es). El operador nunca dice "escribí un workflow Temporal" → el trigger no matchea → las skills quedaban dormidas pese a ser la columna vertebral. Gap simétrico: n8n y Supabase tenían validator PreToolUse, Temporal no.

**Solución C+D (operador autorizó "C+D"):**

- **C — doctrina (repo, versionado):** regla #3 del `CLAUDE.md` ascendida de mención pasiva a **directiva imperativa**: ANTES de escribir/editar cualquier workflow/activity/worker, invocar `temporal-developer` (+`temporal-ai-patterns` si es agente IA). Es el default no-negociable. **PR #30** (`docs/temporal-skill-discipline`).
- **D — red de seguridad (harness global `~/.claude`, fuera de git, en vivo):** hook `temporal_workflow_validator.mjs` (PreToolUse `Write|Edit|MultiEdit`) + config `temporal_workflow_triggers.json` (4 checks hot-reload: tiempo/random nativo, `asyncio.sleep`, I/O red·LLM·subprocess directo). Gate **content** (`@workflow.defn`) + **path** (`.py` con `workflow`/`loop_core`) → cross-project safe (un `.json` de n8n nunca matchea checks Python). Emite `decision:"ask"` con el fix + puntero a la skill embebido **solo en violación concreta** (anti banner-blindness). Smoke 6/6 PASS. **Requiere restart de sesión** (settings read-at-start). Detalle canónico en `~/.claude/HARNESS.md` §1.3 + §8 — NO duplicar acá.

**Cómo se refuerzan:** C me hace consultar la skill proactivamente (la leo al inicio); D me corrige si fallo. Juntos = activación automática sin citar las skills.

**Replicado a ARCA (2026-06-20):** ARCA ya migró a Temporal como motor único (ADR-050, 2026-06-15) → la regla aplica. Operador eligió aterrizarla **solo en `Agencia_IA_HyC/Aplicacion Arca/CLAUDE.md` (raíz)** — que **NO es repo git** (edición en vivo, unversionada) → así NO colisiona con su sesión paralela activa sobre el repo `aplicacion-arca-fe` (branch `sprint-B/TAREA-B23-...`, 23 uncommitted). **DRIFT consciente:** el canónico versionado `aplicacion-arca-fe/docs/GEMINI.md` (141 líneas) NO se tocó; hay 5 constituciones ARCA divergentes (3 GEMINI + 2 CLAUDE, todas md5 distintos). Si se reconcilia algún día, la fuente de verdad es el `docs/GEMINI.md`.

**Pendiente:** (a) reflejar la regla en el canónico `aplicacion-arca-fe/docs/GEMINI.md` vía PR cuando convenga (rama desde `main`, no desde sprint-B; `/framework-self-check` por ADR-006 §11). (b) `Agencia_IA_HyC/Temporal/CLAUDE.md` (el repo del motor Temporal) sigue sin la doctrina; el hook D ya lo cubre globalmente.

Análogo de harness global: [[harness-code-reviewer-audit-mejorados]].
