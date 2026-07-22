---
name: medicion-de-estado-volatil-vence
description: "Una medicion de estado EXTERNO y volatil (device conectado, servicio arriba, rama en el remoto, cuota) tiene fecha de vencimiento. `adb devices` vacio a las 23:35 y con aparato a las 23:45: la conclusion correcta se volvio falsa en 10 min. LEER antes de decidir sobre un dato medido hace rato."
metadata:
  node_type: memory
  type: feedback
---

**Una medición correcta que quedó vieja es más peligrosa que una equivocada: viene con su evidencia
adjunta, y por eso nadie la vuelve a correr.**

**El caso (2026-07-22).** FRONTEND midió, con método impecable —corrió el comando, mostró la salida,
no asumió nada—:

```
$ adb devices
List of devices attached          ← vacío
```

y concluyó, **correctamente para ese momento**: *«no hay aparato, la corrida en device no la puedo
hacer»*. **Diez minutos después el teléfono estaba conectado** (el operador lo enchufó en el medio) y
esa conclusión —archivada, con su comando y su salida— habría dejado el frente trabado *«porque está
medido»*.

## Por qué el rigor no protege de esto

Las reglas de este repo atacan la **asunción**: no afirmar sin medir, correr el control, leer el
contrato. Todas mejoran la **calidad** de la medición y **ninguna dice nada sobre su antigüedad**. Un
dato bien medido se siente definitivo justamente porque está bien medido — la evidencia adjunta es lo
que apaga la sospecha.

Y el error tiene una forma tranquilizadora: quien lo comete **hizo todo bien**. No hay descuido que
señalar, y por eso no hay señal que dispare la revisión.

## La regla

**Antes de decidir sobre una medición de estado externo y volátil, volvé a correrla.** Cuesta un
comando. Aplica a: dispositivo conectado · servicio arriba · rama en el remoto · PR mergeable ·
cuota disponible · proceso escuchando un puerto · sesión autenticada · archivo que otra sesión está
editando.

**No aplica** a lo que sólo cambia si alguien lo cambia deliberadamente y quedaría registrado —el
contenido de un archivo del repo, un valor de config commiteado—: ahí la medición vale hasta que
haya un commit.

**Y al reportar una medición volátil, fechala.** *«`adb devices` a las 23:35: vacío»* es un dato
honesto; *«no hay aparato»* es una conclusión que no envejece bien. La diferencia la paga el que la
lea después.

## El corolario que apareció con este caso

FRONTEND **re-midió bien** cuando el aparato apareció, y de ahí saltó a **usarlo** — que es lo que
provocó [[device-fisico-exige-dueno-unico]]. Su propia frase lo cierra:

> **Medir que algo está disponible no es lo mismo que medir que me toca.**

Disponibilidad y permiso son dos preguntas distintas, y el comando sólo contesta la primera.

[[instrumentos-que-confirman-en-vez-de-verificar]] [[no-codificar-la-esperanza-principio-raiz]]
