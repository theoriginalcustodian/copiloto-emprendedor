---
name: una-rama-con-commits-pre-squash-conflictua-con-main-se-rearma-con-cherry-pick
description: tras un squash-merge de un PR hermano, una rama que tenía esos commits conflictúa al mergear main; no se resuelve tomando un lado ni se pushea el merge a medias — se rearma desde origin/main con cherry-pick de lo propio
metadata:
  type: feedback
---

**Síntoma (2026-10-13):** `git merge origin/main` sobre una rama de trabajo conflictuó en
`scripts/ci/testid-paridad-excepciones.json`: la rama conservaba los commits **originales** de un PR ya squash-mergeado
(mismo contenido, otro sha), así que git los veía como cambios divergentes de los de main.

**Why:** el squash reescribe la historia; lo que main tiene no es ancestro de lo que la rama tiene. Resolver en el
archivo "tomando un lado" descarta una mitad ([[resolver-tomando-un-lado-nunca-converge]]), y pushear el merge a medio
resolver deja un PR roto con trabajo ajeno adentro.

**How to apply:** `git merge --abort`; rama nueva desde `origin/main`; `git cherry-pick` sólo de los commits que **no**
están en main (`git log origin/main..rama` no sirve tras un squash: compará por contenido/`git cherry`); correr paridad,
jest y tsc antes de pushear. Cerrar el PR viejo con `--delete-branch`. Costó un PR de más (#1099 → #1101).
