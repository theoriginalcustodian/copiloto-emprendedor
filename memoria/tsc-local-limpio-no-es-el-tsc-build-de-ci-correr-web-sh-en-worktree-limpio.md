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
(`authNoHexLiterals.test.ts`), no `fs`/`__dirname`. Grepear `?raw` ANTES de escribir `require`.**Refuerzo 2026-10-14 — el mismo mecanismo por otra puerta, y un control mas barato.** `#1180`
(SM-E3) salio con `web` rojo y el gate local en `web=0`: el test importaba
`@testing-library/user-event`, que resolvia en mi `node_modules` por **hoisting del monorepo**.
No era un `@types` traido por transitividad: era un **paquete entero que no esta declarado en ningun
`package.json` del repo** y que **ningun otro archivo de `apps/` ni `packages/` importa** (medido:
0). Mi propio docstring decia «mismo arnes que `GastosScreen.test.tsx`» — y ese arnes es `fireEvent`
de `@testing-library/react`, no `user-event`.

El control de arriba (correr `web.sh` en un worktree sin `node_modules`) lo caza, pero cuesta un
`npm install` entero. **Mas barato y previo: por cada import nuevo de un paquete externo en un test,
grepear que este declarado** (`grep -rn "<paquete>" */package.json`) **y que alguien mas del repo ya
lo use**. Cero uso previo + cero declaracion = resuelve por hoisting y CI lo va a rechazar. Y la
salida correcta no es agregar la dependencia: es usar el arnes que el repo ya tiene (CANON 3).
