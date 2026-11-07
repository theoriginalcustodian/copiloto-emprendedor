---
name: un-pr-en-conflicto-no-corre-checks-y-medirlos-da-vacio-para-siempre
description: Un PR DIRTY no dispara CI, así que medir sus checks devuelve vacío con rc=0 — indistinguible de «todavía pendiente»
metadata:
  type: feedback
---

**Un PR en conflicto con `main` (`mergeStateStatus = DIRTY`) NO dispara los checks.** Y
`gh pr checks <n>` sobre él devuelve `no checks reported on the branch` **con rc=0** — no con error.
Un vigilante que espera `pend=0` sobre eso **gira para siempre**: «vacío» y «todavía pendiente» se
ven idénticos.

**Why:** medido el 2026-11-07 con #1793 (marcado de SM-P23). El vigilante de merge dio **16 intentos
con `total=vacio`**. Su control positivo —no mergear si `total` no es numérico— funcionó y evitó un
merge a ciegas, pero **no distinguía las dos causas**, así que no avisaba: sólo contaba. La causa real
era que el squash-merge de #1786 había metido en `main` el mismo archivo de backlog, la rama divergió
y GitHub no corre CI sobre un PR conflictuado. Sin canario, eso se lee como «el CI tarda».

El diagnóstico lo dio **el control positivo cruzado**: el MISMO comando sobre #1786 devolvía `6`.
Eso separa «mi comando está mal» de «este PR no tiene checks». Y `gh run list --branch` lo confirmó
por el otro lado: había runs para los commits anteriores y **ninguno para el nuevo sha**.

**How to apply:**
1. En todo vigilante de merge, contá las mediciones vacías CONSECUTIVAS. A las ~4, **no sigas
   esperando**: medí `mergeStateStatus`, corré el control positivo contra un PR que sí tiene checks, y
   mirá `gh run list --branch` por sha. Un reintento más no es información; el canario sí.
2. Si está `DIRTY`, **no se resuelve tomando un lado** (`--ours`/`--theirs` descarta una mitad y no
   converge → [[resolver-tomando-un-lado-nunca-converge]]). Cuando el artefacto es **derivable** —la
   tabla del sprint es una función del cuerpo del doc— se **rehace**: rama limpia desde `origin/main`
   y re-ejecutar el script de marcado. Control de que el camino no cambia el resultado: las dos vías
   dieron `16/23 = 69,6%` y `21/23 = 91,3%`.
3. Esto respeta CANON 9 sin excepciones: ningún `rebase`/`reset`/`checkout` sobre el checkout
   compartido — worktree nuevo y listo.

Emparenta con [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] (el control que frena bien pero calla),
[[instrumento-que-no-mira-nunca-falla]], [[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]
y [[la-cita-de-procedencia-muere-en-el-merge]] (el squash es el que crea el conflicto).
