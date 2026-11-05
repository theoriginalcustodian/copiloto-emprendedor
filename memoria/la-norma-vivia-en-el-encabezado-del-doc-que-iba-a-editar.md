---
name: la-norma-vivia-en-el-encabezado-del-doc-que-iba-a-editar
description: Inventé ids SM-A* y el script escribió en la ficha ajena; la norma que lo prohibía estaba en el encabezado del mismo doc que iba a editar.
metadata:
  type: feedback
---

Inventé los ids `SM-A1`/`SM-A2`/`SM-A3` para fichas nuevas y emití tres contratos con ellos.
`sprint-estado.py --marcar SM-A2 --estado TERMINADO` **escribió en la ficha equivocada**: `SM-A2` ya
existía en el backlog del sprint mobile («El eje A tiene 1 ruta verificada de 21», `#1012`), y
`SM-A1` también (`#1010`). El gate salió `rc=0` las dos veces: un id válido de otra ficha es
indistinguible de un id correcto.

**El encabezado del doc que estaba por editar ya lo prohibía, textual:** *«Por qué las letras
arrancan en `G`. Las seis del sprint mobile (`A`–`F`) están agotadas… Reusar una letra haría que
`SM-B3` tuviera dos referentes, que es exactamente el defecto que este repo midió el 2026-10-14»*.
No lo leí: fui directo a la ficha que me interesaba.

**Why:** una norma escrita en el encabezado de un doc no se lee cuando se entra al doc por una
sección puntual — y los ids se inventan al principio, cuando todavía no se abrió el doc. El gate no
puede suplirlo: sólo verifica que el id exista, no que signifique lo que creés. El costo real fue
que tres peers trabajaron un día entero citando ids ambiguos, y hubo que renombrar 5 archivos del
buzón con sus citas.

**How to apply:** antes de inventar un id nuevo, `grep` del id contra **todos** los backlogs
versionados, no sólo el del sprint en curso, y leer el encabezado del doc donde va a vivir **antes**
de escribir la primera ficha. Si el doc explica por qué su numeración empieza donde empieza, esa
explicación es la norma. Ver [[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]] y
[[el-registro-no-se-marcaba-porque-su-id-no-circulaba]].
