---
name: merge-encadenado-tras-pr-create-mergea-sin-ci
description: "`gh pr create && gh pr checks --watch; gh pr merge` mergea SIN CI: recién creado no hay checks, --watch sale rc≠0 al instante y el merge no estaba condicionado"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-21T22:46:14.707Z
---

El 2026-09-21 el PR #584 se mergeó con backend/mobile/web en `pending`: encadené
`gh pr create … && gh pr checks --watch …; gh pr merge`. Un PR recién creado todavía no tiene
checks registrados → `--watch` devuelve rc=1 («no checks reported») al instante, y el `;` dejó
pasar el merge igual. Viola «merge sólo con checks en pass».

**Why:** el rc del watch no distingue «falló» de «todavía no existe»; y un `;` no condiciona nada.

**How to apply:** en el script de merge, primero esperar a que existan checks (loop con
`gh pr checks <n> --json name --jq length` > 0), después `--watch`, y el merge SÓLO con `&&`
sobre el rc del watch. Si ya se mergeó sin CI: esperar el resultado y revertir si falla.
