---
name: la-alarma-de-worktree-huerfano-sugiere-borrar-lo-que-hay-que-salvar
description: El gate marca un worktree como "candidato a git worktree remove" mirando sólo si su PR se mergeó, sin ver commits posteriores no pusheados.
metadata:
  type: feedback
---

`vigilancia-check.sh` marca `WORKTREE HUÉRFANO — PR #NNN ya MERGEADO, candidato a 'git worktree remove'`
usando **una sola señal: el estado del PR**. No mira si la rama tiene commits que no están en `origin`.

El 2026-09-07, obedecer esa sugerencia en `wt-d9` habría destruido un commit del **2026-08-19** que no
vivía en ninguna rama de origin: la auditoría D9 completa (163 líneas midiendo que el `testTimeout`
global **no** era la causa del flake — 22 de 22 timeouts fueron de 30000 ms, cero del global) más el
`jest.config.js` que se derivaba de ella. 19 días invisible. Preservado en `origin/fix/d9-diagnostico-real`
@ `5602386b` y recién ahí removido el worktree.

**Antes de `git worktree remove`, siempre: `git log origin/main..HEAD`.** Si devuelve algo, se pushea la
rama primero. La rama es gratis; el trabajo no.

**Why:** la alarma y su remedio venían del mismo instrumento, y el remedio era destructivo — un caso
peor que un instrumento que sólo miente, porque la acción sugerida borra la evidencia de que mentía.
El PR mergeado prueba que *algo* de esa rama llegó a main, no que *todo* lo haya hecho; los commits
posteriores al merge son exactamente el punto ciego.

**How to apply:** ante cualquier alarma cuyo remedio sea borrar (worktree, rama, archivo, tabla),
verificar la precondición con un comando propio antes de ejecutarla. No confiar en que el instrumento
que detectó ya chequeó lo que hace falta para reparar. Emparenta con
[[instrumentos-que-confirman-en-vez-de-verificar]] y [[el-device-no-corre-main-corre-lo-que-metro-sirve]].
