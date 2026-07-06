---
name: batch-cambios-no-pr-por-tweak
description: El operador NO quiere commit/push/PR por cada cambio chico (es trabado) — batchear docs/cambios pequeños en menos PRs/commits con sentido
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**2026-06-22, feedback directo del operador:** *"no hagas commit push pr a cada rato... no nos sirve trabajar así, es muy trabado"*. En una sola sesión hice ~5 PRs separados (#57 #58 #59 #60 #61) por cambios chicos de docs, cada uno con su merge-gate → fricción.

**Why:** PR-por-cambio-chico = un merge-gate (atención del operador) por cada tweak → workflow trabado y lento. La ceremonia de merge tiene costo. Es exactamente el **M4 del retro** ("default 1-PR-por-unidad") que yo mismo había identificado y seguí violando.

**How to apply:** acumular cambios relacionados (sobre todo docs) y commitear/PRear en **lotes con sentido**, NO uno-por-edición. Cuando el operador itera conversacionalmente sobre docs/plan: **retener las ediciones y bundlear** — hacer todas las ediciones, después UN commit/PR (o pocos, lógicos), no un PR por doc. Sigue valiendo: nada de push directo a `main` (regla del proyecto) — pero batchear en menos ramas/PRs. La excepción es cuando el operador pide explícitamente cerrar/mergear algo puntual.

Tensión a no perder: batchear NO debe causar drift ni perder el registro — se sigue propagando todo ([[propagar-cierre-a-docs-maestros]]), solo que en menos commits. Relacionado: M4 en `docs/ROADMAP.md` (🗒️ ANOTADO).
