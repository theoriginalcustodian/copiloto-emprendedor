---
name: el-indice-truncado-fabrica-duplicados
description: Un índice de memoria que no entra en el límite de carga no sólo esconde entradas — hace que la sesión siguiente las vuelva a escribir, y cada copia lo trunca más. Bucle que se realimenta y no da síntoma
metadata:
  type: feedback
---

**Medido el 2026-08-01.** `memoria/MEMORY.md` pesaba **49,4 KB en 222 líneas** y el sistema lo cargaba
**hasta la línea 108 (~25 KB)**: el 48% del índice —114 líneas— **no llegaba a ninguna sesión, nunca**.
Del lado invisible caían cinco secciones enteras, incluidas *Estado / decisiones activas* y *Tareas
futuras (gated)*. Es decir: se leía la doctrina y **no** lo operativo vivo.

**Lo que no era obvio: el índice truncado no sólo esconde — FABRICA.** En la poda aparecieron **tres
archivos para el mismo hecho del mismo día** (autorización permanente de merge/deploy, 2026-07-23) y
**dos** para el mismo gotcha de Metro. No fue descuido: dos de los tres eran huérfanos del índice, así
que la sesión siguiente buscó, no encontró nada, y volvió a escribirlo. El bucle:

> entrada invisible → la próxima sesión no la encuentra → **la reescribe** → el índice crece →
> se trunca más arriba → más entradas invisibles.

Se realimenta solo, y **cada vuelta se siente productiva**: escribir una memoria nueva parece trabajo
de más, no de menos.

**Por qué no da síntoma.** Un índice truncado no tira error, no rompe un test y no contradice nada:
simplemente **la sesión no sabe lo que no sabe**. Es el caso puro de [[vacio-no-es-hallazgo-correr-el-control]]
aplicado al propio contexto — el vacío es "no recordé", que se confunde con "no estaba escrito". Y es
hermano de [[instrumento-que-no-mira-nunca-falla]]: un índice que no se carga entero se comporta igual
que uno completo, hasta que le pedís algo de la mitad de abajo.

**El control (hornearlo, no recordarlo).** `scripts/medir-indice-memoria.py`:
1. **Presupuesto** — el índice debe entrar **completo bajo el límite de carga** (~25 KB medido). El
   número no es estético: arriba de eso, lo que escribís no existe.
2. **Cobertura** — todo `memoria/*.md` tiene línea en el índice **o** en `HISTORIA.md`. Buscar el link
   markdown **y** el `[[wikilink]]`: mirar sólo uno da falsos (la 1ª versión de este control reportó 25
   huérfanas donde había 24).
3. **Sentido inverso** — links del índice que apuntan a archivos que no existen. El `seed` del 08-01
   encontró 3 que vivían sólo en el slug del harness.
4. **Duplicados** — descripciones muy parecidas entre entradas: es la firma del bucle.

**La regla que se derivó.** Una línea de índice es un **gancho**, no un resumen: título + qué te hace
hacer distinto, en un renglón. El detalle vive en el topic file — repetirlo en el índice paga el costo
en **cada** sesión para que la mayoría de las veces no se lea. Cuando el índice llega al techo, la
salida no es indexar más chico indefinidamente: es **bajar a `HISTORIA.md`** (que no se carga y es
buscable) todo lo que ya no cambia una decisión futura.

Hermana de [[cero-deuda-no-gestionada]]: una entrada invisible es deuda que ni siquiera figura como
deuda — el equipo no la redescubre, la **re-paga**.
