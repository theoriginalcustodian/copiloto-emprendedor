---
name: copiloto-narra-la-accion-sin-ejecutarla
description: El copiloto dice «listo, ya lo marqué» sin haber llamado la tool — el historial que siembra el turno siguiente descarta los tool_calls y el modelo imita su propio texto
metadata:
  type: project
---

**LEER cuando una tool «no funciona» pero el copiloto contesta que sí.** El síntoma no es un error:
es una confirmación en voz alta de algo que no pasó.

## Qué se midió (2026-07-22, E2E de voz del hito 3)

Cinco turnos contra el copiloto vivo, mismo usuario, misma sesión:

| # | Se dictó | Qué hizo |
|---|---|---|
| 1 | «Me pagaron 85 mil» | **ejecutó** `registrar_ingreso` ✅ |
| 2 | «Fue de la Panadería, en efectivo» | **ejecutó** `completar_ingreso` ✅ |
| 3 | una pregunta cualquiera | nada ✅ |
| 4 | «Me pagaron 85 mil de la Panadería» | *«Listo, ya marqué el pago»* — **no había ninguna factura impaga**, así que la tool habría dicho *«no encontré»*. Narró. |
| 5 | «Me aprobaron el presupuesto de la panadería» | *«He marcado como aprobado el presupuesto»* — el estado en la base siguió en `pendiente`. Narró. |

**Los primeros turnos ejecutan; los últimos narran.** Y el error es de la peor clase disponible: no
hay excepción, no hay 500, la respuesta suena perfecta. El emprendedor se queda tranquilo con una
factura sin cobrar y un presupuesto que sigue figurando pendiente.

## La causa, leída en el código y no deducida

`motor/backend/agent/conversation_workflow.py:407` lo dice literal: el buffer de corto plazo que
siembra el turno siguiente lleva *«user/assistant en texto plano — NUNCA el scratchpad interno de
tool_calls»*. Y `:498` guarda sólo el texto final: `{"role": "assistant", "content": text}`.

Entonces, a partir del tercer o cuarto turno, el modelo ve un historial lleno de mensajes suyos que
dicen *«anoté el ingreso de $85.000»* **sin ningún `tool_call` al lado**. Por imitación de su propia
conversación aprende que **decir la frase ES hacer la acción** — y en la conversación que él ve, lo
es: no hay evidencia de otra cosa.

Es un problema del **motor**, transversal a TODAS las tools. No lo introdujeron las del hito 3: se
descubrió con ellas porque son las primeras cuyo efecto se puede verificar en una tabla propia
inmediatamente después. Con `gmail_send` el mismo fallo se lee como *«ya te lo mandé»* y nadie
revisa la bandeja de salida.

## Cómo se aisló (el método, que es reusable)

Tres instrumentos rotos antes de llegar al hallazgo, y los tres se leían como fallo del producto:

1. **El lector de `/reply` miraba `row["text"]`; la clave es `reply_text`.** Reportó «sin respuesta
   en el timeout» en cuatro turnos mientras las tools ejecutaban perfecto.
2. **El diferencial abrió la conexión sin `autocommit`.** Los `conn_factory` reales lo ponen en
   `True` (`worker_b.py:240`, `serve.py:97`), así que el `UPDATE` quedó sin commitear y el
   `detalle()` —otra conexión— leyó el valor viejo: parecía que `cambiar_estado` no escribía.
3. **El `journalctl` del worker no loguea tools**, así que el vacío no significaba «no se ejecutó».
   El control (`wc -l` del rango) mostró 7 líneas, todas de arranque.

Lo que finalmente decidió fue el **test diferencial con la configuración de producción**: correr la
tool sin LLM contra los mismos datos. Devolvió `'estado': 'aprobado'` → la tool funciona → lo que
falla está antes, en quién decide llamarla.

## Por qué NO se parcheó

Un renglón en el system prompt (*«nunca digas que hiciste algo sin ejecutar la herramienta»*) taparía
el síntoma sin tocar la causa, y dejaría el fallo latente para cada tool futura. La raíz es la forma
del historial, que viaja en el **estado durable** de una sesión permanente (continue-as-new): tocarla
es un cambio con implicancias de replay y de workflows en vuelo → **MAYOR, se escala**.

[[instrumentos-que-confirman-en-vez-de-verificar]] [[vacio-no-es-hallazgo-correr-el-control]]
[[conversacion-permanente-continue-as-new]] [[copiloto-motor-react-concatenadas]]
