---
name: push-es-el-ultimo-paso-no-el-primero
description: Un squash-merge toma el HEAD REMOTO de la rama, no tu último commit local — si arreglás algo DESPUÉS de pushear y no repusheás, el merge reintroduce lo que ya habías corregido
metadata:
  type: project
---

# 🔀📤 `push` es el ÚLTIMO paso antes de mergear, no el primero

**Medido el 2026-08-12** (Lote B, PR #407). Corregí un assert mal hardcodeado (`chars: 38`→`36`,
commit `121e271`) EN MI WORKTREE LOCAL y corrí `scripts/gate.sh` ahí mismo → 5/5 verde. Pero nunca
volví a pushear antes de `gh pr create` + `gh pr merge --squash`. El squash tomó el HEAD REMOTO real
de la rama — que seguía en el commit viejo, con el assert roto — y lo mergeó a `main` tal cual.

Verifiqué localmente algo que después NO fue lo que se publicó. Es
[[git-push-puede-salir-exit-0-sin-haber-pusheado]] con el signo cambiado: ahí el `push` miente sobre
haber pusheado; acá el `push` fue honesto la PRIMERA vez, y el error fue confiar en que seguía
siendo cierto después de un commit nuevo encima.

## El control

`git push` es el ÚLTIMO paso antes de `gh pr create`/`gh pr merge`, nunca antes de un fix posterior
al primer push. Si corregís algo después de pushear, repusheá y confirmá con
`git log origin/<rama> -1` (o `git rev-parse HEAD` contra `git ls-remote origin refs/heads/<rama>`)
antes de tocar el PR — "ya pusheé" deja de ser cierto en cuanto hay un commit nuevo encima.

## Costo real

`main` quedó roja en Actions; dos sesiones distintas arreglaron el MISMO bug por separado sin verse
(un PR ajeno y uno propio), y el propio quedó redundante y en conflicto contra el que ya había
mergeado. El gate no mentía — medía un árbol que no era el que se publicó.

## ADENDA 2026-09-29 — el control de un squash es el CONTENIDO, y `--is-ancestor` puede acertar por casualidad

`git merge-base --is-ancestor <commit> origin/main` da **rojo aunque el contenido esté mergeado**: en un
squash-merge el contenido viaja y el commit no. Rojo correcto de un hecho falso.

Dos casos el mismo día, y el segundo es el que enseña:

- **Auditoría:** el `--is-ancestor` frenó el borrado de una rama ya mergeada. Correcto por accidente.
- **Planificación:** midió los commits de FE2 (`4a9f4f7c`, `f9ee1ec9`) con `--is-ancestor` → rojo; pero
  midió **además** el contenido (`grep -c dc.html` sobre `origin/main:docs/ASSETS-EXTERNAL.md`) y ahí se
  vio lo que pasaba. **Quedándose en el `--is-ancestor` habría llegado a la conclusión correcta por
  casualidad** — y la próxima vez, con el mismo método, a la equivocada.

**La regla:** después de un squash-merge, el control es el **contenido, archivo por archivo**
(`grep` de una marca del cambio sobre `origin/main:<path>`, o `git show origin/main:<path> | diff -`),
nunca la pertenencia del commit. Y el corolario más caro: **un instrumento que acierta por casualidad
no se distingue de uno que funciona** hasta que falla — por eso el control de contenido va igual cuando
el `--is-ancestor` ya te dio la respuesta que esperabas.

Ver también [[un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado]] (ejercitá la función, no el log).
