---
name: reutilizacion-es-regla-el-inventario-va-antes-del-diseno
description: Cómo se ENUNCIA el problema decide si se reutiliza o se inventa — "X no encaja en Y" invita a construir de cero; todo contrato abre con el inventario de lo que ya existe
metadata:
  type: feedback
---

Instrucción del operador, 2026-07-24: *"No intentes reinventar la rueda. Si ya hay mecanismos iguales
que resuelven el problema, usalos de ejemplo. **El mecanismo de reutilización debe ser REGLA** — porque
si no, terminamos construyendo cosas que ya tenemos resueltas."*

**Por qué "acordate de reutilizar" NO alcanza — el hallazgo real.** La forma en que se **enuncia el
problema** decide el resultado antes de que empiece el diseño. Mi recon de hito 9 se tituló *"la factura
**NO encaja** en el patrón card"*. Cada afirmación era verdadera y estaba medida contra el código… y aun
así la frase **invita a construir de cero**, porque pregunta *"¿encaja?"* (sí/no → si no, inventá) en vez
de *"**¿qué mecanismos que YA existen resuelven cada pieza?**"* (→ inventario). **La misma evidencia, con
la segunda pregunta, produce reutilización.** El sesgo no está en la voluntad: está en el enunciado.

**Ejemplo concreto de lo que ese enunciado casi tira a la basura:** `TarjetaPresupuestoPropuesto` ya
maneja una **lista de ítems editables fila a fila** — el precedente más cercano que existe a una factura
multi-ítem. "No encaja" lo hacía invisible; el inventario lo pone primero.

**La regla, hecha estructural (COORDINACION §4.2.septies):** todo `contrato_` —y todo recon que lo
preceda— **abre con `§0 Reutilización`**, una fila por pieza:

| Pieza que necesita el hito | Qué YA existe (path:línea) | Qué resuelve | Qué parametrizar/extender | Si no existe: por qué |

- **Un `contrato_` sin `§0` no se despacha** (precondición, como el contrato lo es para capas `ambas`).
- **"No existe nada reusable" es conclusión válida — pero hay que haberla BUSCADO y escrito**, con los
  paths donde se buscó. Sin esa evidencia es una suposición disfrazada de diseño.
- **Prohibido enunciar como "X no encaja en Y".** Se enuncia: *"para la pieza P, lo más cercano que
  existe es M (path); le falta N"*.
- **El precedente PARCIAL cuenta.** Si algo resuelve el 70%, va al inventario igual: **extender un
  mecanismo probado gana a estrenar uno** (menos superficie de bug, menos deuda nueva).

Es la verificación #2 de las 6 del `CLAUDE.md` global (*REUTILIZAR*) movida al **momento de diseñar**,
no sólo al de proponer. Hermana de [[cero-deuda-no-gestionada]] (cada mecanismo nuevo es superficie que
alguien mantiene) y de [[consultar-documed-siempre-antes-de-implementar]] (misma regla, aplicada al repo
canónico de UI: *portar adaptando, no reinventar*).

---

## Refuerzo (2026-10-05, auditoría): el inventario va antes de **citar**, no sólo antes de diseñar — y lo primero a inventariar es **lo que ya publicó tu propio rol**

Esta entrada dice que todo diseño abre con inventario. **Citar también**, y el día que lo cobré fueron
cuatro casos seguidos, todos con la misma forma: *el dato que necesitaba ya existía, publicado por mí
o para mí, y no lo busqué.*

1. **Corregí un puntero citando el tablero de otra sesión, y la refutación vivía en la carpeta que
   estaba editando** — mi propio re-veredicto, de seis días antes, medía lo contrario. Mergeé la
   corrección mal atribuida y necesité un PR más para retirarla.
2. **Iba a entregar una fila que mi propio rol ya había reportado Y CERRADO ese mismo día.** La cacé
   con un `find` por `*cierre_auditoria*` antes de escribir el cierre — el inventario, literal. Si no
   lo hubiera corrido, entregaba trabajo duplicado con mi firma.
3. **Y la fila tenía además la causa falsa:** citaba una línea del índice de memoria que ya no existía
   en disco (ver [[memoria-repo-vs-slug-drift]]). Dos defectos en una fila que el inventario de 1
   línea destapaba.
4. **El espejo, desde otra sesión:** un aviso me daba un SHA para repushear (`ae850b3c`) que **no
   existía en ningún lado** del repo — ni objeto, ni ref, ni reflog, ni `fsck`. Quien lo escribió
   tampoco inventarió lo que citaba.

**El control, de una línea, antes de escribir cualquier fila:**
`find coordinacion -name "*<tema>*"` y `grep -rl "<el id o la cifra>" docs/ memoria/`. Si el tema ya
tiene un `cierre_`, tu fila no es un hallazgo: es un duplicado que inflará el tablero y mandará a
trabajar sobre algo hecho ([[el-contrato-que-manda-a-hacer-algo-ya-hecho]]).

**Y el matiz que aportó la sesión dueña del tablero, que es más general que mi conclusión:** en el
caso 1 el error de fondo no fue mi atribución — fue que **la cifra no llevaba unidad**. Una cifra sin
unidad se deja citar para cualquier pregunta, así que alguien la va a citar para la equivocada. Las
dos cosas son verdad a la vez: publicá la cifra con su unidad, **y** inventariá antes de citarla.
