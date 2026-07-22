---
name: disenar-contra-el-riesgo-temido-ciega-al-caso-normal
description: "Una regla escrita para evitar el caso raro que uno teme puede romper el caso del 90% sin que nadie lo note, porque funciona exactamente como se pidió. «El disparador siempre es un mensaje» durmió dos sesiones con la cola llena. LEER antes de escribir una regla, un prompt o un guard."
metadata:
  type: feedback
---

**Regla macro:** al escribir una regla, un prompt o un guard, **verificá qué hace en el caso normal —
el del 90%— y no sólo en el caso raro que te preocupa.** Un instrumento puede cumplir su
especificación al pie de la letra y **producir el fallo opuesto al que fue a evitar**.

## El caso que la originó (2026-07-22)

El prompt del vigía de las sesiones backend y frontend terminaba así:

> *«No abras un frente nuevo por tu cuenta: **el disparador siempre es un mensaje**.»*

**El riesgo que yo temía:** que las sesiones se dispersaran abriendo frentes no contratados.
**El caso normal que no miré:** el buzón vacío, que es el 90% de las corridas.

Resultado: sin mensaje nuevo → *«sin novedades»* → duerme tres minutos → repite. **Backend tenía cinco
cosas propias declaradas y sin terminar mientras su cron reportaba verde cada tres minutos.** El
instrumento corría puntual, hacía exactamente lo pedido, y **producía quietud**.

## Por qué no se detecta solo

- **La regla nunca falla**: hace lo que dice. No hay error, no hay excepción, no hay log.
- **Su daño es una ausencia** —trabajo que no ocurrió—, y las ausencias no disparan alarmas.
- **Y quien la escribió está sesgado a leerla bien**, porque conoce la intención: yo leía *«no abras
  frentes nuevos»*; la sesión leía *«no trabajes sin permiso»*. **Las dos lecturas son fieles al
  texto.**

## El control, y cuesta un minuto

Antes de dar por buena una regla o un prompt, **corré mentalmente los dos extremos**:

| | Preguntá |
|---|---|
| **Caso raro** (el que temés) | ¿lo previene? ← esto es lo único que solemos chequear |
| **Caso normal** (el del 90%) | **¿qué hace acá? ¿habilita o bloquea?** |
| **Caso vacío** (sin datos, sin mensajes, sin cambios) | ¿la salida por defecto es *seguir* o *frenar*? |

🔴 **El caso vacío es el que muerde.** Una regla escrita pensando en «demasiado» casi siempre falla
hacia «nada», porque el default silencioso de casi toda regla restrictiva es **no hacer**.

## La corrección que quedó

El paso nuevo del prompt no relaja la restricción — la **acota a lo que de verdad quería decir**:

> *«Sin novedades» describe el BUZÓN, no tu trabajo. Si hay algo tomado y sin terminar, seguilo: ya
> está contratado. **Lo prohibido es abrir un frente NO contratado, no trabajar.**»*

**«No abras un frente nuevo» ≠ «no trabajes».** Avanzar en lo ya asignado nunca necesita un mensaje
que lo dispare — y eso, que era obvio para mí, no estaba escrito en ninguna parte.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]]: allá el instrumento miente en verde,
acá **obedece perfecto y paraliza**. En los dos casos el instrumento está sano y el resultado es falso.
