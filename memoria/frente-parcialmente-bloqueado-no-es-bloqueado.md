---
name: frente-parcialmente-bloqueado-no-es-bloqueado
description: Una espera CON disparador nombrable (device) se siente disciplinada y por eso esconde la rebanada adelantable que quedó adentro; separar antes de declararla.
metadata:
  type: feedback
---

Un frente **parcialmente** device-gated no es un frente device-gated. Esta sesión declaré dos veces que
lo que restaba de Carril B era "device de backend" y me detuve — una espera **con disparador nombrable**
(el teléfono), que por eso *se sintió disciplinada*. Pero adentro había una rebanada de **código puro,
adelantable**: el título tapeable del centro (`EncabezadoListado` → `/recientes`, PR #64), que el propio
`addendum_mi-dia` §4 daba "adelantable YA, UI pura" — el device sólo confirmaba el gesto/visual. Lo cazó
un ping de monitor de parálisis de planificación + releer el addendum, no yo.

**Por qué rinde.** El fallo espejo de [[una-espera-sin-disparador-nombrable-es-paralisis]]: aquella
vigila la espera SIN disparador (que envejece en silencio); ésta, la espera CON disparador que igual está
mal, porque **el disparador nombrable no cubre TODO el frente** — cubre las piezas de gesto (swipe-left,
expandir) y el `[PROVISIONAL]` (endpoint `/mi-dia`), no el título tapeable que vivía sobre el layout
actual. Nombrar un disparador real para PARTE del frente lo hace pasar por disparador de TODO, y ahí la
disciplina aparente tapa la falta de descomposición. Es la misma ceguera que
[[disenar-contra-el-riesgo-temido-ciega-al-caso-normal]]: fijarse en lo que sí está bloqueado (device)
y no correr el caso "¿qué de esto se hace sin device?".

**Cómo aplicar.** Antes de declarar un frente en espera: **descomponer y correr el caso adelantable** —
releer la fuente (contrato/addendum) buscando la etiqueta "adelantable / UI pura / cáscara", y separar
cada pieza por su disparador REAL (código-ya / endpoint-falta / device / decisión-de-otro). Si UNA pieza
es código puro sobre el layout de hoy, no está bloqueada: se hace. La espera se declara sólo sobre las
piezas cuyo disparador propio no llegó, nunca sobre el frente entero por contagio del disparador de la
pieza más visible.
