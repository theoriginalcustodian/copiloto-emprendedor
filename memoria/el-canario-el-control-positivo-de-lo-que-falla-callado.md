---
name: el-canario-el-control-positivo-de-lo-que-falla-callado
description: Cuanto mejor construido está un sistema, menos informativo es el silencio de su vigilancia — "no falla nada" y "el detector está roto" producen el mismo log. Un canario dispara el fallo a propósito por el camino real para que el silencio vuelva a significar algo
metadata:
  type: feedback
---

**El planteo del operador (2026-08-01):** *"si hacemos las cosas bien y configuramos todo el sistema
bien, la superficie de errores es mínima y el autohealing trabaja poco… pero debe estar sí o sí,
aunque trabaje poco."*

Correcto, y tiene un corolario que no es obvio: **cuanto menos trabaja un vigilante, menos dice su
silencio.** El ciclo de autosanación devuelve `{"estado": "sin_traumas"}` cuando no hay nada que
reparar — y **exactamente lo mismo** cuando el cable de detección está cortado. En régimen sano ese
desenlace es el 99%, así que el estado normal del sistema es también su modo de fallo indistinguible.

No es teórico: el mismo día se descubrió que la costura HTTP **nunca** había depositado un error en
producción ([[la-costura-leia-un-campo-que-nadie-escribe]]). Cuatro días, suite en verde, cero
síntomas.

## El canario, y las cuatro decisiones que lo hacen servir

`POST /salud/canario` lanza un error **deliberado** por el camino de producción. La costura lo captura
y lo deposita como a cualquier otro. Que sea trivial no lo hace obvio — cada decisión responde a una
forma de arruinarlo:

1. **Autenticado, no en `/healthz`.** Sin `require_tenant` no hay tenant declarado, y sin tenant la
   costura no deposita. Un canario público habría medido **un camino distinto del que dice vigilar**
   — el error clásico del control que verifica una versión de juguete de lo que le importa.
2. **Sale como un 500 normal, sin trato especial.** Si el canario tuviera su propia rama en la
   costura, probaría esa rama y no la de producción.
3. **Excluido de REPARARSE, no de REGISTRARSE.** Su error es deliberado: no hay bug. Sin la exclusión
   el forjador le escribiría un parche a un `raise` puesto a propósito y abriría un PR basura por
   cada prueba de vida — y [[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]. Su valor está en
   la fila que deja, no en curarse.
4. **Encendido por default.** Un vigilante que nace apagado no vigila **y nadie se entera de que no
   vigila**: el default silencioso otra vez ([[disenar-contra-el-riesgo-temido-ciega-al-caso-normal]]).

## La métrica correcta no es cuántos arregló: es hace cuánto pasó

Cero reparaciones es la **meta**, así que no puede ser el indicador de salud. El indicador es *¿cuándo
fue la última vez que el camino completo funcionó de punta a punta?*, con **vigencia** (7 días acá):
un canario que pasó hace un mes prueba que el cable estaba sano hace un mes — la evidencia vence
([[la-evidencia-vence-y-el-documento-no-lo-dice]]). Vive en
`deploy/copiloto/verificar-autosanacion.py`.

## Cuándo replicarlo

Cualquier mecanismo que **falle hacia el silencio**: DLQs, colas de reintento, alertas, gates,
auditores, backups, replicación. La pregunta que lo dispara es la misma de siempre —*¿qué devolvería
este instrumento si lo que mide estuviera roto?*
([[instrumentos-que-confirman-en-vez-de-verificar]])— y cuando la respuesta es *"lo mismo que ahora"*,
no alcanza con mirar mejor: **hay que inyectar el caso positivo a propósito**.

Es el mismo principio que [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] (todo gate necesita un
control positivo), aplicado al sistema vivo en vez de a la suite de tests.

## El bonus que no esperaba

**El canario encontró el fallo antes de existir.** Diseñarlo obligó a preguntar cómo entra realmente
un error al sistema — y esa pregunta destapó que no entraba ninguno. Diseñar el detector es, en sí,
una auditoría del camino que va a vigilar.
