---
name: la-premisa-no-medida-de-la-receta-falla-cuando-el-recurso-caro-ya-esta-comprometido
description: Una receta para un recurso escaso (device, operador, ventana de deploy) cuya premisa no se midió no falla al escribirse: falla cuando el recurso ya está comprometido, y ahí cuesta la pasada entera.
metadata:
  type: feedback
---

Una receta escrita para ejercitar un **recurso escaso** —el teléfono, la atención del operador, una
ventana de deploy— se verifica **antes** de pedir el recurso, premisa por premisa. Toda premisa que la
receta no midió (un testID, que un tenant sirva, que una ruta permita un alta) se mide con un grep o
una consulta **en el momento de escribirla**, no cuando el recurso esté en la mano.

**Por qué:** el error no se manifiesta al escribir la receta. Se manifiesta en el minuto en que el
recurso caro ya está comprometido, y ahí el costo no es el del grep: es la pasada entera. Medido el
2026-11-04 con las dos recetas de device del sprint mobile: ambas llegaron con premisas **declaradas
como no verificadas por sus propios autores** —honestamente declaradas, que es lo que hizo posible
cazarlas— y verificarlas costó un grep cada una. Una de las dos era **falsa**: la receta de `SM-N19`
mandaba tocar un botón «Corregir» que en esa superficie no existe (el de `DetallePresupuesto.tsx:294`
es de otra pantalla; la corrección real es editando el formulario in situ,
`FormularioPresupuesto.tsx:355-373`). Con 17 fichas esperando **una** pasada y `adb devices` vacío, esa
premisa falsa habría costado el día del teléfono.

**Cómo aplicarlo:** si la receta dice «tocar X», grepeá X. Si dice «usar el tenant T», consultá T. Si
dice «el alta permite Y», leé el handler. Y **la premisa de la corrección también es una premisa**: el
2026-11-04 el paso que reemplazó al tenant equivocado apoyaba en otra afirmación sin medir («que el
alta sin documento esté permitida por la ruta manual»), o sea el mismo defecto una capa más abajo.
Corregir sin medir mueve el error, no lo saca.

**El contraste que lo vuelve regla y no prudencia:** una premisa no medida en una receta de device es
distinta de una premisa no medida en código. En código, el test la caza gratis y en segundos. Acá no
hay test posible —lo táctil no se mecaniza— así que el único control disponible es haberla medido
antes, y el único momento en que es barato es antes. Es [[gate-de-device-se-corre-con-receta-no-con-ventana-viva]]
visto desde su otro filo: no alcanza con que la receta sea asíncrona y corrible por otro; tiene que ser
**verdadera**, y eso se comprueba, no se redacta. Relacionado: [[supuesto-cuya-falla-parece-un-estado-legitimo]]
y [[el-contrato-afirma-el-mecanismo-que-no-opero]] — una receta que afirma un gesto sobre un control
que no existe es exactamente un contrato que afirma un mecanismo que nadie operó.
