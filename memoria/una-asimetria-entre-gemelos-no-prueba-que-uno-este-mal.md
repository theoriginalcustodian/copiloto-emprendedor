---
name: una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal
description: Dos filas sobre el mismo componente con veredictos distintos parecen "el fix llegó a uno de los dos" — pero pueden estar preguntando cosas distintas, y entonces la asimetría es información. Antes de emparejar, escribí qué pregunta hace cada lado
metadata:
  type: feedback
---

**El caso (2026-09-29, auditoría, fila C3-1).** Encontré dos filas de medición sobre **el mismo
componente, el mismo testid y el mismo nodo de app** (`midia-vacio`) con clasificaciones distintas:
`vacio` = `NO_REPRODUCIBLE_SIN_EFECTO`, `vacio-visto` = `DESVÍO` con nota «RECLASIFICADO». Reporté
🔴 **ALTA**: *«el fix llegó a uno de los dos gemelos»*, con el argumento de que un veredicto que
desactiva trabajo exige más evidencia que los otros.

**Era un falso positivo.** La asimetría es **correcta**, y lo es por una razón que ninguna de las dos
sesiones había escrito: **las dos filas preguntan cosas distintas.**

| fila | su pregunta | ¿se responde sin alcanzar el estado? |
|---|---|---|
| `vacio-visto` | ¿existe la variante «explicación retirada» tras N días? | **sí** — por **ausencia de mecanismo**: no hay contador equivalente, el cuerpo nunca cambia |
| `vacio` | ¿el cuerpo renderizado coincide con el del prototipo? | **no** — hay que **ver la pantalla vacía** |

Una se contesta leyendo código; la otra necesita el estado sembrado. Mismo nodo, dos comparaciones.

## Lo que casi hice, y por qué es peor que el error

Iba a «arreglar» la asimetría moviendo `vacio` a `DESVÍO` para emparejar. Eso habría **inventado una
comparación que nadie hizo** — la fila declara literalmente `N/A — no hubo comparación`. Emparejar por
simetría no corrige un veredicto: **fabrica el que falta**, y queda indistinguible de uno medido.

Lo que lo frenó fue una secuencia que impuso planificación, no mi prudencia: **primero escribir cuál es
la razón declarada de la reclasificación, después evaluar cada lado por separado.** Con la razón en la
mano (estaba escrita textual, y el criterio real no era «¿es reproducible?» sino **«¿la comparación ya
tiene resultado?»**), la asimetría se explicó sola.

## La regla

**Antes de emparejar dos filas gemelas, escribí qué pregunta hace cada una.** Si las preguntas difieren,
la asimetría es información, no defecto. Y el **orden** es lo que decide: razón primero, comparación
después. Al revés, la simetría se vuelve la hipótesis de trabajo y cualquier diferencia parece error.

El parecido de los sujetos es justo lo que engaña: mismo componente, mismo testid, mismo archivo. Cuanto
más gemelos son, más fuerte se siente el argumento de simetría — y menos dice sobre si sus preguntas
coinciden.

## El defecto de fondo: elegí el patrón por familiaridad

«El fix llegó a uno de los dos gemelos» es un patrón **real** y ya me sirvió otras veces
([[el-mismo-defecto-vivia-dos-veces-el-fix-en-la-capa-compartida-no-alcanzo]],
[[el-fix-ya-existe-en-otro-call-site]]). Lo apliqué sin verificar su precondición: que ambos lados
estuvieran respondiendo lo mismo.

**Segunda vez el mismo día con esa forma.** Por la mañana elegí un canario por disponibilidad
([[el-canario-tiene-que-ser-tan-nuevo-como-lo-que-buscas]]); acá elegí una plantilla de diagnóstico por
familiaridad. En los dos casos el rigor estaba puesto —controles horneados, evidencia citada— pero
aplicado **dentro** de un molde que nadie había validado para el caso. Una plantilla que funcionó antes
se siente como método; es una hipótesis, y tiene precondición.

**Y el hallazgo real apareció sólo después de retirar el falso.** El cajón de `vacio` sí está mal, pero
por otra razón: el estado **es** reproducible sin efecto externo (un UPDATE local en el tenant de
prueba, con el seed ya escrito), así que `NO_REPRODUCIBLE_SIN_EFECTO` lo archiva en un cajón que apaga
trabajo. Severidad más baja, id igual de perdido. El falso positivo me estaba tapando el verdadero.
