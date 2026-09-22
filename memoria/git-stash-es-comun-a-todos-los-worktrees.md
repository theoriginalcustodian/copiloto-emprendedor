---
name: git-stash-es-comun-a-todos-los-worktrees
description: refs/stash vive en el .git COMÚN, no en el worktree — un stash de una sesión lo levanta el `stash pop` de otra; para controles negativos usar patch + apply -R
metadata:
  type: feedback
---

`git stash` no es local al worktree. Medido el 2026-09-22 con
`git rev-parse --path-format=absolute --git-path refs/stash` desde `wt-plan2` y desde `wt-fe2-arreglos`:
los dos resuelven a `…/copiloto-emprendedor/.git/refs/stash`, mientras `HEAD` resuelve a
`.git/worktrees/<wt>/HEAD`, que sí es propio. La pila de stash es **una sola para las 20+ worktrees**
de las sesiones paralelas. En la misma medición había una entrada huérfana de otra sesión
(`wip-anterior-sesion-antes-de-actualizar-a-origin-main`, sin rama): el próximo `git stash pop` de
cualquier sesión, en cualquier árbol, la aplicaba ahí.

**Why:** FE2 verificó el rojo→verde de BL-D6 con `git stash` en su worktree (avance del
2026-09-22 05:22), creyendo que era aislado. La regla de `COORDINACION.md` prohíbe `stash` en el
checkout compartido, pero el riesgo real es más ancho: el ref es compartido desde **cualquier**
worktree. El worktree aísla el árbol y el `HEAD`, no las refs (misma familia que
[[hookspath-absoluto-apaga-el-pre-push-de-todos-los-worktrees]]: el `.git/config` también es común).

**How to apply:** para un control negativo (revertir el fix, correr el test, ver el rojo) usar
`git diff > /tmp/fix.patch && git apply -R /tmp/fix.patch`, correr y después `git apply /tmp/fix.patch`,
o un commit descartable en una rama propia. Nunca `stash`/`stash pop` en ninguna worktree de este
repo. Ante la duda de si algo es por-worktree: `git rev-parse --git-path <ref>` lo dice.
