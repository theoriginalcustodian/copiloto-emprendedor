---
name: el-registro-no-se-marcaba-porque-su-id-no-circulaba
description: Un registro no se deja de marcar por descuido - se deja de marcar cuando su id no circula en el trabajo
metadata:
  type: feedback
---

El operador reclamó que el backlog «no sirve de nada» si nadie marca lo terminado. La lectura
natural —falta de disciplina— era falsa. Medido el 2026-10-14 sobre el buzón completo (460
`cierre_`, control negativo 0, ids con delimitador y no por subcadena):

> **18 de las 26 fichas nunca fueron nombradas por ninguna sesión.**

No es que la casilla no se marcara: **el id de la ficha no circulaba**. Las sesiones citaban ids
propios (`KVCAIDASALE`, `EXHAUSTIVEDEPSON`, `DRIVECERO`, `A7`, `BL-*`), así que el trabajo era
inatribuible a una ficha y su casilla no entraba al circuito de cierre. Consecuencia: el mismo
sprint se leía con **tres porcentajes incompatibles** (7% / 9% / 67%) según qué registro mirabas, y
dos fichas (`SM-B3`, `SM-B4`) llevaban un día **hechas y sin registrar**.

Debajo había una causa mecánica que nadie buscó: **`scripts/ci/atribucion.sh` nunca leyó el backlog
firmado.** Su `RE_DOC_PADRON` filtra con `grep -E '(backlog|…)'` **case-sensitive** y el doc se llama
`2026-10-11-BACKLOG-sprint-mobile-beta.md`; además su `RE_ID` sólo admitía `BL-*`/`DEC-*`/`M-*`. El
instrumento que ata commits a ids autorizados no podía atribuir **ni un solo** commit de una ficha.
Dos decisiones correctas cruzándose en un agujero, y el agujero vivía en el par.

**Why:** un registro que no se marca tiene dos causas posibles y se parecen desde afuera —nadie
marca (disciplina) o *nada puede marcarse* (el id no viaja al commit, el instrumento no lee el doc)—.
Atacar la primera cuando la causa es la segunda produce recordatorios y crones que no cambian nada:
el día del desvío medido (forense 08/10) los crones **estaban prendidos**. Y el síntoma es
silencioso: cada sesión ve su propio trabajo cerrado y correcto, nadie ve que la casilla quedó muda.

**How to apply:** ante «esto no se está marcando», **primero medí si el id circula**: grepeá el id de
la ficha —con delimitador, nunca por subcadena: `A-1` da 14 falsos positivos— en los commits de
`main` y en el buzón, y verificá que el instrumento de atribución **lea el doc** (control positivo:
¿aparece ese id en el padrón?). Si el id no circula, la corrección no es un recordatorio: es (1)
hacer que el commit/PR **cite el id**, (2) que el padrón lo acepte, y (3) que un **script** derive y
escriba el estado desde la evidencia, porque lo mecánico no se delega a la disciplina
([[buzon-se-ordena-por-janitor-no-por-disciplina]]). Prefijá los ids para que sean tokens reales
(`SM-B3`, no `B-3`) y chequeá que no colisionen con otro padrón: `D7` del mapeo y `SM-D7` del backlog
nombran cosas distintas ([[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]).

**Y el criterio de marcado es del operador, no del instrumento:** *«las tareas se marcan como
terminadas cuando el dod está hecho completo»* (2026-10-14). El merge commit es **una** de las
evidencias, no el criterio — de ahí el estado `DOD-PARCIAL` para «código en main, DoD incompleto»,
que es el que faltaba y el que impide el error que este repo ya pagó
([[una-orden-cerrada-exige-evidencia-de-device]]). Norma: `CLAUDE.md §3.quater.bis`; instrumento:
`scripts/sprint-estado.py` (`--check` en `scripts/ci/lint.sh`, `--autotest` 9/9).
