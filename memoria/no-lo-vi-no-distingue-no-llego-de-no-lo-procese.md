---
name: no-lo-vi-no-distingue-no-llego-de-no-lo-procese
description: Backend explicó su falla como "me falta un chequeo periódico" — el chequeo existía y le había entregado los 3 mensajes. La sesión que falló no puede diagnosticar el canal desde adentro; sólo el transcript distingue.
metadata:
  type: feedback
---

El 2026-07-24 backend no reaccionó a un `urgente_` ni a la orden de FRENO del operador durante ~20
minutos, y siguió abriendo PRs. Cuando se le pidió explicar, dio un diagnóstico honesto, detallado y
**equivocado en el punto que importaba**: *«no tengo un chequeo periódico que se dispare durante un
tramo largo de tool calls»*, y propuso construirlo.

**Ese chequeo ya existía y había funcionado.** El transcript lo prueba: 8 bloques `<buzon-nuevo>`
entregados, entre ellos el `urgente_` **dos veces** (11:48 y 11:49) y el FRENO (11:59), con el nombre
completo del archivo y `priority="high"`. El aviso llegó al contexto y no produjo conducta.

**Por qué la sesión no podía saberlo:** su evidencia interna es *«no lo vi»*, y eso es **igualmente
compatible** con «no llegó» y con «llegó y no lo procesé». Desde adentro las dos se sienten idénticas
— por eso el relato de fallo de un agente es un **testimonio**, no una medición, y hay que contrastarlo
con el transcript antes de rediseñar nada. Si le hubiera creído, habría construido un segundo canal de
entrega para un problema que no era de entrega, y el fallo habría vuelto igual.

**La causa real:** un bloque de texto **uniforme** dentro de un tool result no interrumpe. Todos los
avisos se veían iguales —misma cabecera, misma lista, misma explicación del formato— y la nota de
prioridad estaba sepultada en la última línea. Un aviso que se ve igual siempre se lee igual siempre:
se archiva como contexto, no como orden.

**Fix aplicado** (`~/.claude/hooks/buzon_watcher.mjs`): `urgente_` y `contrato_` emiten un bloque de
**forma distinta** — `priority="max"`, sin lista larga ni explicación del formato, imperativo y corto:
*«🛑 PARÁ … abrilo AHORA, antes de tu próxima tool call … si es una orden de detenerse, detenerse ES la
tarea»*. El resto conserva el tono informativo y dice explícitamente que puede esperar a la próxima
frontera. Verificado con control positivo y negativo.

Hermana de [[mensaje-entregado-donde-nadie-mira]] — pero un grado más fino y más incómodo: **acá el
mensaje se entregó exactamente donde había que mirar, y aun así no actuó.** Probar el cable no alcanza;
hay que probar que el aviso *cambia la conducta*.
