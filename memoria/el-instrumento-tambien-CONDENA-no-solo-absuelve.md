---
name: el-instrumento-tambien-CONDENA-no-solo-absuelve
description: Un instrumento roto no sólo da falsos verdes — también da falsos ROJOS, y ese error se siente como rigor
metadata:
  type: feedback
---

**Un instrumento mal hecho puede equivocarse en las DOS direcciones sobre la misma pregunta — y el
falso rojo es más difícil de cazar que el falso verde, porque se siente como rigor.**

**El caso (2026-07-29, retest del modo automático).** Un script medía si el copiloto sigue afirmando
acciones que no ejecutó, comparando el texto contra los `execute_tool` del history de Temporal. Tres
versiones, tres veredictos, sobre exactamente la misma realidad:

| | Dijo | Realidad |
|---|---|---|
| v1 | ✅ *"0/3, la cura sostiene"* | Las 3 rondas reventaron con `KeyError: 'text'` (el campo es `reply_text`) y el `except` las contaba como no-mentira → **no midió nada** |
| v2 | 🔴 *"1/3 mentiras"* | El contador buscaba `.endswith("ActivityTaskCompleted")`; el `eventType` real es `EVENT_TYPE_ACTIVITY_TASK_COMPLETED` → **daba 0 siempre** → toda afirmación parecía mentira |
| v3 | ✅ *"0/10"* | Contador validado: 2 `execute_tool` por sesión, filtrado por nombre de activity |

Con v1 se levantaba un flag de producto a ciegas. Con **v2 se dejaba puesto un flag que bloquea una
feature, y se declaraba fallida una cura que funciona** — durante meses, con toda la apariencia de
estar siendo prudente.

**Por qué el falso rojo es el más peligroso de los dos.** Un falso verde choca tarde o temprano con la
realidad: el bug aparece, el usuario se queja, algo se rompe. **Un falso rojo nunca choca con nada** —
la feature queda apagada, nadie la usa, no hay síntoma. Y encima se lleva bien con la propia
disciplina: *"lo mantengo bloqueado porque no tengo evidencia"* suena exactamente igual siendo
correcto que siendo el producto de un contador roto. [[instrumentos-que-confirman-en-vez-de-verificar]]
cubre el verde falso; esta cubre el rojo falso, que no tiene quien lo denuncie.

**El control, y es uno solo para las dos direcciones:** antes de creerle un veredicto a un
instrumento, preguntarle **qué mediría si la respuesta fuera la contraria**. Concreto:

- ¿Este contador **alguna vez cuenta**? Correrlo contra un caso donde el valor conocido **no** es cero.
- ¿Cuántas unidades **miró**, aparte de si pasó? Una corrida que revienta **no es evidencia de nada**:
  tiene que invalidar el veredicto entero, no contarse como "sin problema"
  ([[instrumento-que-no-mira-nunca-falla]]).
- ¿El nombre que estoy buscando **existe** en el dato real? El `eventType` no era el que yo suponía —
  y suponerlo por analogía es el mismo error que [[vacio-no-es-hallazgo-correr-el-control]] nombra.

**El arreglo va en el script, no en la cabeza de nadie.** En este caso quedaron horneados: una ronda
que revienta hace `return 2` (veredicto **inválido**, no "aprobado"), y el contador filtra por el
nombre exacto de la activity. La versión que te engañó no se olvida sola: si el arreglo vive en tu
memoria y no en el código, la v4 vuelve a mentir.
