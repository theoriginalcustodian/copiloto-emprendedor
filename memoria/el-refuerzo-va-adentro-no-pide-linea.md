---
name: el-refuerzo-va-adentro-no-pide-linea
description: El índice llegó a su techo porque cada lección nueva reclama una línea; si la lección REFUERZA una entrada existente va dentro de su topic file y cuesta 0 chars de índice.
metadata:
  type: feedback
---

El índice tiene un techo duro y **cada entrada nueva reclama una línea**. Pero muchas lecciones no
son nuevas: son la **segunda ocurrencia** de una que ya está indexada. Esas van **adentro** del
topic file que ya existe — el índice no cambia, el recall no se degrada y el costo es **0 chars**.

**La pregunta que decide:** *¿esto cambia lo que haría alguien que ya leyó la entrada existente?*
Si la respuesta es «no, lo confirma con otro mecanismo» → es refuerzo, va adentro.

## La medición que lo hizo evidente (2026-09-30)

El índice estaba en **24000 / 24000 chars** y 188 / 200 líneas: margen **0**, con `rc=0` — el
medidor avisa pero no frena, así que el próximo que escriba una lección se come el rojo por deuda
ajena. Al medir de qué está hecho el presupuesto:

```
paths (slug.md)              7650 chars   31.9%
texto visible de los links   7239 chars   30.2%
  de ellos, ganchos que repiten ≥60% de las palabras de su propio slug: 118 de 152 enlaces
⇒ el par título↔slug se lleva ~13.200 chars = 55% del índice diciendo la MISMA frase dos veces
```

**Las dos salidas que la cabecera ofrecía estaban agotadas**, y una era falsa:

- **«Fusionar hermanas bajo un gancho»** ahorra líneas, **no chars** (~3 por fusión: el `- ` y el
  newline). Y el techo que apretaba era el de chars, así que optimizaba el techo que no apretaba.
  Peor: una fusión gasta 80-143 chars **sólo en punteros**, de modo que las **10 de 10** líneas
  fusionadas violan el techo de 160 que el mismo párrafo exige. Dos reglas del mismo encabezado que
  no se pueden cumplir juntas — [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]] aplicado a
  una convención.
- **Comprimir los ganchos** degrada justo la señal de recall: el gancho es lo que la sesión LEE; el
  slug es sólo la dirección. Y tampoco es alcanzable: en una entrada medida, slug (66) + título (66,
  que dicen lo mismo) ya consumen 132 de los 160 disponibles.

**Lo que NO rindió, y es dato:** reducir el índice bajando las lecciones que ya están cableadas a un
gate (si un test la hace cumplir, la memoria no tiene que recordarla) daba **1 entrada de 357**, 168
chars. El índice no es reducible por esa vía porque **sus lecciones son de criterio, no de
mecanismo** — es lo que el activo es, no un defecto suyo.

**Por eso el refuerzo importa tanto acá:** con margen para ~1 entrada, tres de las cuatro lecciones
de esa sesión entraron como aporte dentro de topics existentes y no costaron nada.

## Y lo que queda abierto, que es del operador

Reducir el 55% de verdad es **cambiar el formato** del índice (dejar de pagar el slug dos veces), y
eso es MAYOR: toca el activo que toda sesión carga al arrancar. Mientras no se decida, el techo se
sostiene con refuerzos y con bajadas a `HISTORIA.md`, que sí pierden recall.

⚠️ No confundir con [[el-indice-truncado-fabrica-duplicados]]: ahí el daño es que la cola **no
existe** para la sesión. Acá el índice entra completo; lo que se agotó es el espacio para crecer.
