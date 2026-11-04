---
name: un-falta-que-no-se-recorta-al-pagarse-fabrica-cola-inexistente
description: Un Falta que enumera puntos ya cumplidos no da sintoma y se reasigna como trabajo pendiente; dos clasificadores distintos lo midieron igual porque ninguno estaba roto.
metadata:
  type: feedback
---

Cuando un punto del `Falta:` de una ficha se cumple, **se recorta del `Falta:` en el mismo commit
que lo cumple**. Dejarlo enumerado «por completitud» convierte deuda pagada en cola nueva.

**Why:** medido el 2026-11-04 con `SM-H5` y `SM-I4`. Mi primer filtro de las 22 fichas abiertas leyó
la **palabra** «device» en el `Falta:` y dio 15 bloqueadas. Manejo-de-errores reclasificó por
**instrumento** —*¿qué instrumento cierra lo que queda?*, la pregunta correcta— y bajó a 3
ejecutables, así que la acepté y despaché H5 e I4 como cola real. Las dos estaban hechas: el punto de
lectura de H5 estaba cumplido (`mockups/06-presupuestos/index.html:243`, `4c2bd865`/#1607) y el punto
(a) de I4 había sido **retirado por falso** (el crema en piel oscura es inversión deliberada,
`tokens.ts:477-479`, afirmada por `BloqueCifra.test.tsx:46-50`).

Lo que hace a esto difícil de ver: **ninguno de los dos clasificadores estaba roto**. El mío hacía la
pregunta pobre, el suyo la buena — y los dos midieron el mismo `Falta:` envejecido. Cambiar de
instrumento no detecta un corpus mentiroso; un corpus mentiroso se lee igual de pendiente con
cualquier lente. El síntoma no existe: un `Falta:` largo parece diligencia, no deuda.

Y el costo no es sólo el despacho equivocado. Un `Falta:` inflado **sube el techo aparente del
sprint**: se reporta trabajo abierto que no existe, y el operador planifica horas contra una cifra
falsa. Es [[un-criterio-que-crece-con-cada-medicion-no-se-puede-alcanzar]] por el otro extremo — ahí
el criterio crecía, acá la deuda no se achica al pagarse.

**How to apply:** el commit que cumple un punto del DoD lo borra del `Falta:`; si el punto se
descubre falso, se retira con la medición escrita, no se deja tachado. Antes de reasignar una ficha
por su `Falta:`, abrí la ficha y verificá **cada punto contra el código**: el `Falta:` es un resumen,
y un resumen con fecha vieja miente sin avisar. Relacionado:
[[el-registro-no-se-marcaba-porque-su-id-no-circulaba]].
