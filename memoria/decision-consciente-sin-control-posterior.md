---
name: decision-consciente-sin-control-posterior
description: Escribir datos de prueba en la base del operador fue deliberado — y eso no vale nada si nadie lo controla después
metadata:
  type: feedback
---

**LEER cuando estés por hacer algo que sabés que ensucia estado compartido "sólo por un rato".**

Corriendo el E2E en el teléfono del operador dicté un gasto de $8.500. El device está logueado como
él: **no hay otra forma de correr ese E2E**. Fue una decisión consciente, la anoté, y la limpié en la
misma corrida (`antes: [(7, 8500.00)] · borrados: 1 · después: (0, 0)`).

**Pero PLANIFICACIÓN preguntó por ese gasto antes de saber que yo lo había limpiado.** Y ése es el
punto entero: si no lo hubiera limpiado, la pregunta llegaba igual. **La decisión consciente no era la
salvaguarda; el control externo sí.**

**El mecanismo.** "Lo hago a propósito y me acuerdo de limpiarlo" se siente como gestión de riesgo y
es **memoria de una persona**. Lo que la hace fallar no es mala fe: el paso de limpieza ocurre
**después** del trabajo interesante, cuando la atención ya se fue al resultado. Una deuda deliberada
que nadie mira es indistinguible de una olvidada — el mismo animal que [[cero-deuda-no-gestionada]], a
escala de una sesión.

**La forma correcta, en orden de preferencia:**

1. **Que no haga falta** — tenant de prueba dedicado (es lo que se provisionó para los E2E
   automáticos: `sub=e2e7e57e-...`).
2. Si no hay alternativa: **declararlo ANTES en el buzón, no después en el reporte.** Declararlo
   después es pedir perdón; declararlo antes es habilitar el control.
3. Limpiar **en la misma corrida** y **verificar el efecto** contando filas, no el exit code.

**Lo que hay que resistir** es tratar el "me acordé de limpiarlo" como prueba de que el proceso
funciona. Funcionó **esta vez**. Ver [[copiloto-tests-ensuciaban-la-base]], donde 552 filas huérfanas
muestran qué pasa cuando nadie controla — y donde casi se diagnostica un bug de cifrado inexistente
por muestrear basura propia.

**Corolario para el device:** ahí no hay tenant de prueba posible, porque el aparato está logueado
como el operador. Entonces el punto 2 no es una alternativa: es **obligatorio**.
