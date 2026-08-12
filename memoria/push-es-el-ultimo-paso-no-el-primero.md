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
