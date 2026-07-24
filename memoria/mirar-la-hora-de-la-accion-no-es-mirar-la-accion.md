---
name: mirar-la-hora-de-la-accion-no-es-mirar-la-accion
description: Una sesión con timestamp fresco puede estar repitiendo `ls` cada 3 minutos. "Última acción hace 0 min" mide latido, no trabajo — hay que leer QUÉ hizo, y si se repite entre ciclos.
metadata:
  type: feedback
---

El 2026-07-24, veinte minutos después de escribir la regla *«mirá QUÉ acción es, no sólo cuándo:
`ls`/`cat`/`date` repetidos durante varios ciclos = gira en vacío»*, reporté **«frontend trabajando,
0 min»** durante varios ciclos seguidos. Frontend estaba imprimiendo, cada 3 minutos, la misma línea:
*«idéntico al tick anterior — sin novedades, cola vacía»*. Lo vio el operador en pantalla, no yo.

**El instrumento estaba bien y la regla estaba escrita: fallé al leer.** La salida trae dos columnas
—hora y acción— y sólo miré la hora, porque un `0min` responde la pregunta que uno cree tener
(«¿está viva?») en vez de la que importa («¿avanza?»).

**Por qué es tan fácil de repetir:** un timestamp fresco es una señal *nítida y numérica*; la acción
es texto que hay que interpretar y comparar **contra el ciclo anterior**. Ante dos señales, gana la
que no exige memoria. Por eso la trampa sobrevive a tener el dato a la vista: no falta información,
falta el paso de comparar.

**El chequeo que lo caza, y cuesta una línea:** *¿la última acción es distinta de la del ciclo
anterior?* Si tres ciclos muestran el mismo comando, la sesión tiene pulso y no tiene trabajo — que
es [[cero-tiempo-ocioso-tres-estados]] visto desde afuera.

Y cuando eso pasa, la causa casi nunca es que no haya trabajo: es que la sesión **declara una espera
que no la bloquea**. Frontend decía *«espero el E2E device de hito 9»* — un frente exclusivo de
backend que no tocaba una sola línea suya, con dos hitos propios listos para arrancar. Ver
[[una-espera-sin-disparador-nombrable-es-paralisis]]: la espera hay que auditarla, no aceptarla,
porque suena razonable desde adentro y desde afuera.

Familia de [[instrumentos-que-confirman-en-vez-de-verificar]] y de
[[la-regla-que-te-obliga-a-mirar-el-instrumento-equivocado]]: acá el instrumento no mintió — mintió
la lectura rápida de un instrumento honesto.
