---
name: trabajar-en-un-pedido-lo-silencia
description: Un escalador que mide "última modificación" en vez de "sin respuesta desde" premia el abandono y castiga el trabajo — ampliar un pedido con evidencia lo borra del radar.
metadata:
  type: project
---

# 🔕⬆️ Trabajar en un pedido lo SILENCIA — el incentivo invertido del escalador

`scripts/escaladores-buzon.sh:61` mide la edad de un `pedido_` con `now - stat -c %Y` (última
modificación). Lo que quiere saber es **cuánto hace que está sin respuesta**. Esas dos cosas son la
misma sólo mientras nadie toque el archivo.

**Medido en vivo el 2026-08-06, dos ciclos seguidos del cron:**

| Hora | Evento | Lo que reportó el escalador |
|---|---|---|
| 09:51 | — | `PEDIDO SIN RESPUESTA (95min >= 30)` |
| 09:53 | le agregué una ADENDA con evidencia para que el operador pudiera decidir | — |
| 09:54 | — | **nada.** Edad recalculada: **1 min** |

Nadie respondió: el `pedido_` seguía en `abierto/` y `respuesta_.*odobi7` daba 0.

## Por qué es peor que su hermano ruidoso

La misma familia de defecto tiene dos caras en este script. La regla 3 (`EN-CURSO SIN AVANCE`) mira
sólo el `mtime` del contrato y **nunca** el `avance_` del frente, así que acusa de silencio a quien
acaba de reportar: una alarma que **sobra**. Molesta, pero se ve, y alguien la investiga.

Esta **falta**. Y la ausencia de una alarma no tiene síntoma —
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]. Nadie nota el escalador que dejó de sonar.

## El filo: el incentivo queda al revés

Agregar evidencia a un pedido para que el decisor pueda decidir es exactamente el trabajo correcto.
Y es justo lo que lo borra del radar. **Un pedido bien trabajado se vuelve invisible; uno abandonado
grita.** El instrumento premia el abandono.

Por eso no alcanza con "acordarse de no tocar el archivo": eso sería pedirle al operador del
instrumento que compense el defecto con disciplina, y la disciplina cae en el hueco entre tareas
— el mismo motivo por el que archivar a mano se reemplazó por un janitor determinista.

## La pregunta que lo caza antes

Ante cualquier reloj de escalación: **¿qué evento reinicia este contador, y es el mismo que resuelve
lo que mide?** Si "trabajar en el ítem" y "cerrar el ítem" reinician el mismo contador, el
instrumento no distingue avance de resolución.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]]: allá el instrumento nunca condena,
acá deja de condenar justo cuando más falta hace.

## Estado

Diagnosticado con el contrato leído (no deducido) y despachado a backend como cuarto ítem del
contrato de rescate de monitoreo del 2026-08-06, con DoD de dos direcciones. El camino
`git log --diff-filter=A` **no sirve**: `coordinacion/` está gitignoreado. La salida que no depende
de nada externo es un sidecar de estado con el primer avistamiento.
