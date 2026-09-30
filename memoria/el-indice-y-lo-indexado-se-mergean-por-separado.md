---
name: el-indice-y-lo-indexado-se-mergean-por-separado
description: Un índice correcto en su rama es un índice roto en el tronco; y una cifra de cobertura no significa nada sin decir de qué copia del archivo salió.
metadata:
  type: reference
---

Una sesión me pasó 13 líneas de índice para pegar en mi PR. **12 apuntaban a archivos que no existían
en mi rama** — vivían en su worktree, en un PR sin mergear. `links a archivos inexistentes` daba
**0**; pegarlas lo habría llevado a **12**, y el gate habría roto su propio PR al mergear el mío.

**La regla: la línea del índice viaja con su archivo, en el mismo PR.** El índice y lo indexado se
mergean por separado, así que un índice correcto en su rama es un índice **roto** en el tronco.

## El corolario que explica por qué dos sesiones miden distinto

Ella reportó `326/339`, yo `332/332`, y **ninguna mentía**: son **cuatro archivos distintos** — su
worktree, el mío, el checkout compartido y el slug de auto-memory. **Antes de comparar cualquier cifra
del índice hay que decir de qué copia salió.** Pasó igual con la capacidad: me dijo que quedaban 42
chars libres cuando en mi copia quedaban 170. Las dos mediciones eran correctas sobre su propio archivo.

Es [[el-instrumento-respondio-sobre-otro-sujeto]] sin worktree roto y sin ningún error de nadie: el
sujeto simplemente **existe muchas veces**, y el nombre del archivo no lo desambigua.

## Me cazó dos veces en el mismo turno, en los dos sentidos

**Primero midiendo de menos.** Mi verde local (`332/332`) era de un árbol **atrasado respecto de
`main`**. CI midió el árbol mergeado y dio **341 entradas, 9 huérfanas**: nueve archivos de memoria
habían llegado a `main` por un PR ajeno **sin sus líneas de índice**. Mi medición no estaba mal
calculada — estaba hecha sobre el árbol equivocado, y el gate fue lo único que lo vio.

**Y después afirmando de más.** Le dije que sólo 3 de sus 12 líneas seguían faltando, porque yo había
indexado las otras 9. Ella midió el **tronco** y me corrigió: en `origin/main:memoria/MEMORY.md`
**faltan las 14**, porque mi índice corregido vive en mi rama y **el PR no está mergeado**. Exactamente
la clase que yo acababa de escribir, aplicada a mí: *un índice correcto en su rama es un índice roto en
el tronco*, y yo estaba contando desde mi rama.

## La salida que resuelve el orden de merge

Indexar las entradas nuevas en `HISTORIA.md` (que el medidor también cuenta) deja el tronco consistente
en **cualquiera** de los dos órdenes de merge, sin que ninguno de los dos PR dependa del otro. La
limpieza —quitar de `HISTORIA.md` lo que el índice cargado ya apunte— queda como deuda declarada con
dueño, y no bloquea el gate porque el medidor exige estar en **alguno** de los dos.

💡 **Al medir cobertura de un índice, la pregunta previa es *¿de qué copia hablo, y ésta incluye el
tronco?*** Si no, el número describe un estado que no va a existir después del merge.
