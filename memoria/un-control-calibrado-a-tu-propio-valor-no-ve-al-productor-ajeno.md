---
name: un-control-calibrado-a-tu-propio-valor-no-ve-al-productor-ajeno
description: Grepeé el ancho que usa mi generador para buscar mediciones ajenas; el otro usaba otro número, así que el 0 era estructural. Un control positivo tiene que ser tan general como la clase que buscás, no tan específico como lo que vos producís
metadata:
  type: feedback
---

**El caso (2026-09-29).** Tenía que contestar si los 38 veredictos previos habían medido contra una
referencia de escritorio. Grepeé `1440` sobre los dos lotes: **0 hits en los dos**. Declaré «ninguno
midió a ancho de escritorio», con el límite escrito y una pregunta de una línea despachada a FE1 por
las dudas.

**FE1 midió los archivos: 30 de 35 estaban a 1280×900.** Verificado después por mí leyendo el IHDR de
los 54 PNG. **11 de las 20 filas del lote A habían medido a escritorio.**

**Por qué mi grep no podía encontrarlo:** `1440` es el ancho que usa **mi** generador
(`criterio3-matriz.mjs:54`). FE1 capturaba a **1280**. El `0` no decía «no hubo comparación de
escritorio» — decía «**no hubo comparación con *mi* escritorio**». Era un cero estructural: ninguna
medición ajena podía producir ese token, hiciera lo que hiciera.

## La regla

**Un control positivo tiene que ser tan general como la CLASE que buscás, nunca tan específico como
el valor que vos producís.** Buscaba «¿midió a ancho de escritorio?», que es una clase; usé el
literal de mi propia implementación, que es un miembro. Lo correcto era el predicado general: leer la
**dimensión de los archivos**, que cualquier productor tiene que dejar, en vez del número que sólo
deja el mío.

El chequeo antes de confiar en un cero: **«¿este patrón podría matchear algo producido por otro, o
sólo por mí?»** Si la respuesta es «sólo por mí», el cero no mide el mundo: mide mi ausencia en él.

## Por qué se siente like rigor

Un grep de un literal exacto parece más duro que uno amplio — es preciso, es verificable, no tiene
falsos positivos. Y por eso mismo es el que peor falla acá: **precisión sobre el eje equivocado**. El
falso negativo no da síntoma, y el resultado («0 en ambos lotes, control positivo verde en mi propio
documento») **se lee como una medición limpia**.

Lo que salvó el caso no fue el instrumento: fue **declarar el límite** («los nombres no declaran el
ancho, así que lo medido es "no hubo comparación de dos anchos"») y **despachar la pregunta de una
línea**. El hábito de escribir qué NO prueba tu medición es lo que hace que alguien pueda refutarla.

Hermana de [[el-canario-tiene-que-ser-tan-nuevo-como-lo-que-buscas]]: allá el sesgo entra por la
**edad** del control, acá por su **calibración**. Misma familia:
[[vacio-no-es-hallazgo-correr-el-control]] · [[un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo]] ·
[[el-universo-externo-del-instrumento-tiene-su-propio-denominador-incompleto]] ·
[[contar-un-simbolo-no-dice-en-que-rol-aparece]].
