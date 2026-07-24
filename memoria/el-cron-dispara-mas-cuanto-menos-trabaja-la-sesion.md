---
name: el-cron-dispara-mas-cuanto-menos-trabaja-la-sesion
description: Un cron no interrumpe un turno en curso, así que dispara MÁS en la sesión más ociosa — medido 42 vs 5. Un turno disparado por cron mide OCIO, no vida; y una sesión está sorda al buzón justo mientras trabaja.
metadata:
  type: project
---

Medido el 2026-07-24 contando disparos de cron en los transcripts de las tres sesiones paralelas:

| sesión | disparos | último |
|---|---|---|
| **frontend** — ociosa, esperando el device ajeno | **42** | cadencia perfecta cada 3 min |
| **backend** — implementando | **5** | y después nada por ~40 min |
| planificación | 8 | ídem |

**Causa:** un cron **no puede interrumpir un turno en curso**. Backend entró en un tramo largo (spike
→ pedido al buzón → lectura de código) y sus disparos se perdieron mientras trabajaba. No se le murió
el cron: se lo comió su propio trabajo.

## La inversión — y por qué envenena cualquier métrica de vida

**El cron dispara más en la sesión que trabaja menos.** Un turno disparado por cron **mide OCIO, no
vida**. De ahí:

- **Una sesión está sorda al buzón justo mientras trabaja.** El vigía de 3 min sólo se cumple estando
  ociosa — o sea exactamente cuando no hace falta. Nadie puede confiar en *"se lo mando y en 3 minutos
  lo lee"*.
- **Cualquier sensor basado en "¿hubo un turno?" lee el inverso de lo que cree.** El mtime del
  transcript se mantiene fresco **para siempre** con un cron de 3 min: el marcapasos garantiza pulso
  aunque el cuerpo no haga nada. Frontend parecía la más viva **por ser la más ociosa**.
  Ésta es la causa raíz única de los 3 fallos de `no-ocio-check.sh` del mismo día
  ([[instrumentos-que-confirman-en-vez-de-verificar]] casos 11-12).

**El fix del sensor:** medir **PRODUCCIÓN** = minutos desde el último `Write`/`Edit`, leído del
timestamp de la línea JSONL. Alarma `🌀 GIRA EN VACÍO` = transcript fresco + sin mutar nada hace ≥30 min.

**El fix del proceso** (`regla_..._el-buzon-se-revisa-en-cada-frontera-de-trabajo`): revisar el buzón
**antes de abrir un tramo nuevo** —terminar un PR, arrancar un E2E, cerrar una sub-tarea— no cuando el
cron despierte. Engancha el chequeo a una acción que ya vas a hacer, en vez de a un evento externo que
puede no llegar ([[atar-la-accion-a-un-momento-no-a-un-estado]]), y cae **antes** de invertir 20
minutos en una dirección que un mensaje sin leer podría haber corregido — que es lo que pasó dos veces
el mismo día (el `urgente_` de pausa en hito 8 y el fork del gate en hito 9).

El cron no se retira: es el piso mientras la sesión está ociosa y lo que la devuelve a la cola cuando
termina. Lo que cambia es que **deja de ser el único mecanismo**.
