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
## Refuerzo 2026-10-15 — el disparador puede ser **inventado por la pregunta**, y entonces la espera es perfecta

La entrada vigila el disparador que **no cubre todo** el frente. Este caso es un grado peor: el
disparador **no existía**, y lo fabriqué yo al escalar.

#1233 (SM-C4) quedó estacionado con el `lint` rojo del gate de paridad y yo escalé al operador una
**DECISIÓN 5**: *«el gate no tiene casillero para un id deliberadamente sólo-mobile — ¿agregamos un
campo `solo_mobile`?»*. La espera se sentía impecable: disparador nombrable (su respuesta), dueño
claro (él decide sobre un gate), y hasta una recomendación escrita. **El casillero existía desde el
2026-09-22**: `scripts/ci/testid-paridad-excepciones.json`, con `motivo` por entrada y trinquete en
`testid_paridad.py:13-14`. Propuse agregarle a un gate el campo que el gate ya tenía, leyendo el
script de al lado para medir el rojo.

Y el segundo supuesto también era falso: la asimetría no era «sólo-mobile por diseño» sino **dos
mitades con la decisión tomada hacia lados distintos** — `AccountScreen.tsx:114-115` declara en el
código, desde BL-O6, *«Sólo muestra; qué se hace cuando no es la vigente es decisión del operador,
no de esta fila»*. Mobile implementó **actuar**; web había decidido **mostrar**. Ese es justo el caso
que el archivo de excepciones existe para registrar, con su dueño y su disparador adentro.

**Por qué no dio síntoma, que es lo importante.** Una espera por un **bug** envejece y alguien la
nota. Una espera por una **decisión del operador** no envejece: es el estado más respetable del
tablero. Nadie audita un «escalado», porque auditar un escalado parece desautorizar al humano. Por
eso un escalado mal fundado es el lugar más seguro donde puede esconderse trabajo propio sin medir —
y encima **consume un renglón de la cola del operador**, que es el recurso más escaso que hay acá.

**La pregunta que lo caza, y vale para toda escalación:** *¿medí el mecanismo que digo que falta, o
estoy pidiendo permiso para no haberlo buscado?* Una escalación es una **afirmación de alcance**
(«esto no se puede resolver acá») y por CANON 1 exige la misma evidencia que cualquier otra. Un
`grep` + un `ls` del gate la habrían retirado antes de escribirla. Hermana de
[[el-fix-ya-existe-en-otro-call-site]] y de [[supuesto-cuya-falla-parece-un-estado-legitimo]]: acá el
estado legítimo que la falla imita es **«esperando al operador»**.
