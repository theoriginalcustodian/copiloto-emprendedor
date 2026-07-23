---
name: propagar-cierre-a-docs-maestros
description: "Al cerrar trabajo, propagar el estado a TODOS los docs maestros narrativos (ROADMAP + ARCHITECTURE), no solo CLAUDE.md §5 + memorias — si no, acumulan drift silencioso"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**2026-06-22:** al preguntar el operador "¿actualizamos toda la documentación?", se descubrió que `docs/ROADMAP.md` y `docs/ARCHITECTURE.md` estaban **stale desde 2026-06-20** — la disciplina de cierre del ciclo 06-21/06-22 actualizó `CLAUDE.md §5` + las memorias en cada PR, **pero no los docs maestros narrativos**, que acumularon ~10 PRs de drift (memoria-grafo, mega-sprint, build-incremental, self-test-kit, flujo-C, loop-desarrollo, stack-canónico, SP7). Peor: el ROADMAP seguía llamando "SP7" al intake autónomo cuando SP7 ya se había redefinido como kit+SeniorWorkflow (el intake pasó a SP8) → drift de numeración. Reconciliado en PR #59.

**Why:** el estado en `§5`/memorias ≠ el estado en ROADMAP/ARCHITECTURE, y estos últimos son **exactamente lo que un agente nuevo lee para orientarse** (el ROADMAP es "la fuente de verdad del qué sigue", ARCHITECTURE es el doc maestro). Una fuente-de-verdad stale **desinforma en silencio** — es deuda invisible ([[cero-deuda-no-gestionada]]): el próximo agente paga el interés de orientarse mal. El drift no avisa; se acumula PR a PR.

**How to apply:** al cerrar CUALQUIER trabajo no trivial, propagar el estado a **TODOS** los docs maestros, no solo a `§5` + memorias: `CLAUDE.md §5` + `docs/ROADMAP.md` + `docs/ARCHITECTURE.md` + memoria + reporte de cierre. La reconciliación es mecánica — `§5` + `git log --since=<última reconciliación>` son la verdad-base (no inventar números de PR). Verificar adversarialmente contra el git log (sin overclaim, sin residuos stale, PR# correctos). `HANDOFF.md` el operador lo despriorizó (2026-06-22) → opcional. Señal de que se viene drift: varios PRs cerrados con "actualicé §5 + memoria" sin tocar ROADMAP/ARCHITECTURE. Relacionado:.
