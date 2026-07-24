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
