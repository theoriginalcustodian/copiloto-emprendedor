---
name: un-control-de-ceguera-ubicado-despues-del-guard-que-dispara
description: El control que distingue «no veo» de «no hay» existía y estaba bien escrito, pero corría después del ratchet que la ceguera hace fallar, así que el rojo acusaba 14 renombres inexistentes.
metadata:
  type: feedback
---

El job `lint` de mi PR se puso rojo con **«DOCUMENTOS: EL PISO QUEDÓ VIEJO — 14 declarado(s) como
medición que el glob ya no encuentra»**, nombrando 14 archivos que existen perfectamente. El mensaje
mandaba a buscar renombres, borrados o un parser que dejó de ver. Ninguna de las tres.

La causa: `coordinacion/` está gitignoreada, así que **en CI el corpus no existe**. El glob da 0
candidatos y entonces `perdidos = MEDICIONES_DECLARADAS - {} = los 14`.

**Y el control que distingue esas dos cosas ya existía, bien escrito.** `docs_control()`, con este
docstring:

> «Sin esto, un glob que no matchea nada (ruta mal armada, buzón movido, permisos) devuelve 0
> candidatos, pasa los dos ratchets y reporta «0 de 54» como si fuera el dato. Es el mismo
> vacío-que-no-es-hallazgo de siempre: un 0 del instrumento leído como un 0 del corpus.»

Describe el fallo exacto. **Corría al final de la función, después de los ratchets** (línea 524 contra
462), así que con el corpus ausente nunca se alcanzaba: el guard disparaba primero y el control quedaba
muerto.

## La lección

**Un control de ceguera colocado después del guard que la ceguera hace fallar no protege nada.** No es
que falte el control: está, es correcto, y su posición lo vuelve decorativo. El orden **es** el arreglo.

Y el síntoma engaña porque el sistema **falla cerrado** — rojo, no verde — sólo que acusando la causa
equivocada. Es [[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]] con el
agravante de que la causa elegida **manda a trabajar sobre un problema inexistente**: pasé el primer
minuto buscando qué se había renombrado.

**El arreglo estructural, no el parche:** el control de ceguera va **primero**, y su fallo sale por el
código que en ese script ya significa «no puedo medir» (acá `exit 2`, el mismo de «no encontré la
matriz» y «no encontré la spec»), nunca por el código de hallazgo. Un `exit` de hallazgo sobre un
sujeto que no se pudo ver es una afirmación sobre datos que nadie leyó.

## Dos corolarios del mismo incidente

**1. La ruta absoluta hardcodeada era la que fabricaba la ceguera.** `COORD =
Path("C:/Proyectos/.../coordinacion")` no existe en Linux, y sin parámetro **la ceguera no se puede
provocar a propósito en la única máquina donde se corre el control** — la que sí tiene el corpus.
Un control de ceguera necesita que la ceguera sea inducible: `COPILOTO_COORD` con default. El
hardcoding no era sólo deuda, acá era el mecanismo.

**2. El skip del test detectaba por el TEXTO del mensaje, y el refactor lo cambió.** El test tenía
`grep -qE "ABORTA: no encontré..."` para saltearse cuando no hay corpus. Ese mensaje dejó de imprimirse
cuando el control pasó a decir «CONTROL DEL DESCUBRIMIENTO FALLA», así que **el skip quedó muerto sin
dar un solo síntoma** — y el día que la ceguera ocurrió, se leyó como hallazgo. El código de salida es
el contrato estable entre un script y su test; el texto es prosa que se reescribe. Mismo mecanismo que
[[la-costura-leia-un-campo-que-nadie-escribe]]: el lector esperaba algo que el escritor dejó de producir.

⚠️ **Lo que no hay que concluir:** que los ratchets estén mal. Son correctos y siguen. Lo que estaba
mal era creerles cuando su entrada era un conjunto vacío que nadie verificó.
