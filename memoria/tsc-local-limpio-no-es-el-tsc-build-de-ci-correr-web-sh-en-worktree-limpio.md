---
name: tsc-local-limpio-no-es-el-tsc-build-de-ci-correr-web-sh-en-worktree-limpio
description: "\"tsc limpio\" en mi máquina pasó con require/__dirname en un test web; CI (tsc --build --force, sin @types/node) lo rechazó. Se verifica con scripts/ci/web.sh en worktree sin node_modules."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8b4c92c0-372e-46d5-b6b5-3a55993f8120
  modified: 2026-10-14T09:20:44.069Z
---

El 2026-10-14, #1147 (avatar web con tokens) salió con el job `web` **rojo**: `Bubble.test.tsx` usaba
`require('fs')` y `__dirname`; `scripts/ci/web.sh` corre `tsc --build --force --noEmit` y el runner no
tiene `@types/node` (TS2580/TS2304). En mi máquina había pasado «tsc limpio» porque el `node_modules`
local los traía por transitividad.

**Why:** el `node_modules` de una PC con historia no es el del runner; «tsc limpio» medido ahí es una
afirmación sobre la máquina, no sobre el árbol. Es la misma clase que [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]:
el instrumento corrió en otro entorno que el que decide.

**How to apply:** antes de pushear un cambio web, correr `bash scripts/ci/web.sh` en un worktree **sin**
`node_modules` previo (hace `npm install` + `tsc --build --force` + vitest). Y para leer un `.css`/archivo
desde un test web, usar `import x from './archivo.css?raw'` — es el patrón del repo
(`authNoHexLiterals.test.ts`), no `fs`/`__dirname`. Grepear `?raw` ANTES de escribir `require`.
