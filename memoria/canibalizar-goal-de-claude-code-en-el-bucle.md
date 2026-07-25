---
name: canibalizar-goal-de-claude-code-en-el-bucle
description: Candidato para retomar — 3 ideas de /goal (Stop hook prompt) para mejorar completion_evidence_gate.mjs, evaluado pero NO implementado
metadata:
  type: reference
---

**Handoff completo:** `docs/copiloto-emprendedor/2026-07-24-HANDOFF-canibalizar-goal-mecanismo-en-el-bucle.md`
**Fuente original (ingeniería inversa de `/goal`):** `C:\Proyectos\Claude\Claude code\unreal-copilot\docs\research\2026-06-21-goal-mecanismo-completo-reverse-engineering.md`

Charla exploratoria del 2026-07-24, cierre de sprint. **Nada implementado** — el operador pidió no
seguir esa sesión. Tres candidatos evaluados con complejidad:

1. **Bloquear sin frenar** (`preventContinuation:false`) para upgradear
   `completion_evidence_gate.mjs` de observabilidad pura a enforcement real de canon 8a. Complejidad
   baja, PERO con un supuesto crítico sin validar (spike-first pendiente): si un hook tipo `command`
   logra el mismo efecto que `/goal` logra con tipo `prompt`.
2. **Evaluador Haiku barato** (`json_schema` forzado + `thinking:disabled` + `tools:[]`) para
   reemplazar razonamiento caro en checks chicos. Complejidad baja, sin supuestos pendientes — el más
   fácil de arrancar.
3. **Verificador `agent` independiente** (corre el DoD real, no se autoevalúa) — mismo principio que
   A1/A2 pero a nivel de cada hito/PR. Complejidad alta (sub-agente con tools, no un script chico).

Ver el handoff para el detalle completo y el orden sugerido de retomada.

[[bucle-canonico-dos-auditorias-y-el-enganche]]
