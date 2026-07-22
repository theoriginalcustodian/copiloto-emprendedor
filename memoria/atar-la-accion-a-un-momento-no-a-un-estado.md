---
name: atar-la-accion-a-un-momento-no-a-un-estado
description: Una regla que dispara ante un ESTADO no ocurre — nadie va a mirar; hay que atarla a un MOMENTO en el que la sesión ya está ahí
metadata:
  type: feedback
---

**Una regla cuyo disparador es un estado (*«cuando X esté listo»*, *«el que vea las dos líneas»*) no se
ejecuta.** Para notar un estado hay que **ir a mirar**, y nadie va a mirar algo que ya consumió o que
no es su tarea del momento. Hay que atar la acción a un **momento** en el que la sesión ya tiene el
artefacto delante.

**Dos casos el mismo día (2026-07-22), y ninguno se veía como falla** — en los dos, cada sesión
cumplía la letra:

| Regla escrita | Disparador | Qué pasó | Corrección |
|---|---|---|---|
| *«el que ve las dos líneas de acuse lo mueve a `cerrado/`»* | estado | `abierto/` tenía **32 archivos y sólo 3 sin acusar** — la carpeta cuya única función es decir qué está pendiente mentía 10× | contar los acuses **antes de escribir el tuyo**; si el tuyo completa, `mv` en la misma operación |
| *«backend prueba en el device cuando frontend termine»* | estado | trabajo implementado y sin probar durante días, con los dos tableros en verde | frontend emite un `listo_` **al cerrar el hito** — un artefacto que se escribe en un momento concreto |

**Por qué es invisible.** Nadie decide incumplirla: el segundo en acusar **sí ve** la línea del
primero, pero en ese instante su tarea es *acusar*, no *archivar*, y la acción queda para un después
que no llega. El resultado no se parece a un incumplimiento — se parece a que el sistema está al día.
Es hermana de [[mensaje-entregado-donde-nadie-mira]]: ahí el mensaje llegaba a un lugar que nadie
mira; acá la acción espera un momento que nadie tiene.

**How to apply:** al escribir cualquier regla de proceso, preguntarse *«¿en qué instante concreto,
haciendo qué otra cosa, alguien ejecuta esto?»*. Si la respuesta es *«cuando note que…»*, la regla no
va a ocurrir: hay que engancharla a una acción que ya se hace igual (escribir el acuse, cerrar el
hito, abrir el PR).

**El corolario que hace la regla decidible cuando hay duda** (aporte de FRONTEND): **archivar/cerrar de
más es peor que de menos**. Un pendiente que sobra **se ve y molesta**; una pregunta archivada **no la
ve nadie nunca**, y quien la hizo espera una respuesta que ya no está enfrente de nadie. Los dos
errores no cuestan igual → ante la duda, no mover. *(Caso: archivé un mensaje cuyo cuerpo me
preguntaba algo a mí, contando los acuses que pedía el nombre. Que ya estuviera resuelto fue suerte,
no el mecanismo — **el nombre puede mentir sobre a quién le toca responder**.)*
