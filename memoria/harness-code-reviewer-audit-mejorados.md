---
name: harness-code-reviewer-audit-mejorados
description: Injertos al HARNESS GLOBAL (~/.claude) del 2026-06-19 — code-reviewer user-level nuevo + audit-claude-md con Dim 6 de seguridad. NO viven en el repo del proyecto.
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**2026-06-19: dos injertos al harness GLOBAL del operador (`~/.claude`, NO el repo unreal-copilot — no se versionan acá).** Derivados de evaluar el repo ECC y el PDF build-a-loop.

1. **`~/.claude/agents/code-reviewer.md` (NUEVO, user-level).** Antes no existía agente custom; usabas `feature-dev:code-reviewer` del plugin (no editable, se pierde en updates). Este override preserva tu esqueleto conciso (confidence ≥80, severidad, output `file:line`) + injerta 3 bloques de ECC: **Pre-Report Gate** (4 preguntas) + **CRITICAL/HIGH Require Proof** · **lista de ~12 falsos positivos** que los LLM reviewers mis-flaggean · **AI-Generated Code Review Addendum** con cost-awareness y reward-hacking del gate (directo al gate de Unreal Copilot). NO trae el bloat de checklists de ECC. **Se activa al reabrir sesión** (los agentes se indexan al boot); falta confirmar precedencia sobre el del plugin.

2. **`~/.claude/commands/audit-claude-md.md` (EXTENDIDO).** Nueva **Dimensión 6 — Seguridad de la superficie de ataque del harness** (secretos en config, `Bash(*)`, command injection en hooks, MCP supply-chain / lethal trifecta). Read/Grep nativo, **sin instalar AgentShield** (npm de terceros; su modo `--opus` exfiltra tu config a la API — inaceptable).

**Origen:** repo **ECC** (`github.com/affaan-m/ECC`, 218K stars, MIT, 271 skills/67 agents/92 commands) evaluado como mina de patrones — **NO adoptar entero** (over-engineering + token bloat, contra tu disciplina anti-bloat); sí canibalizar piezas puntuales. El PDF `Loops/build-a-loop.md` también se canibalizó, pero al REPO (regla 9 del CLAUDE.md "done verificable por test" + spec casa §3.1 "disciplina ejecutor/reporte") — ver [[durabilidad-cross-corte-validada]] (misma sesión). Su loop (gate por auto-revisión en sesión "for hours") se descartó por inferior a gate-por-test + Temporal.
