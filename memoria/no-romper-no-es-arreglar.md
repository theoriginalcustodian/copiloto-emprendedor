---
name: no-romper-no-es-arreglar
description: Un gate de no-regresión aprueba con honores un parche que no arregla nada — un no-op no rompe. Lo único que separa "arregla" de "no rompe" es un test que FALLA antes del parche y PASA después. Y las fallas del instrumento no pueden rechazar al evaluado.
metadata:
  type: feedback
---

# 🩺🟢 "No rompió nada" no es "arregló algo" — y la suite verde no distingue

El 2026-08-01 el ciclo de auto-reparación abrió su primer PR solo. CI **5/5**, `mergeState: CLEAN`,
mergeable. Y el parche era esto:

```diff
-partes = (workflow or "", error_type or "", (error_message or "")[:_LARGO])
+partes = (workflow or "", error_type or "", (error_message or "")[:_LARGO] if error_message is not None else "")
```

`(error_message or "")` **ya** cubría `None`. El cambio es semánticamente equivalente al original:
un **no-op**. Y pasó todos los gates, porque un no-op es justamente lo que mejor puntúa en un gate
de no-regresión: no rompe nada, no puede romper nada.

## La forma del error

El gate contestaba una sola pregunta —*¿rompe?*— y su respuesta se estaba leyendo como si
contestara otra —*¿arregla?*. Las dos se ven idénticas desde afuera: **verde**. Y no hay ninguna
señal que las separe, porque el parche correcto y el inocuo producen exactamente el mismo veredicto.

Lo que las separa es un solo instrumento: **un test que falla ANTES del parche y pasa DESPUÉS**. Sin
él, "aceptado por el gate" significa *no empeoró*, que es mucho menos de lo que la palabra sugiere.

Nada de esto era desconocido: estaba escrito como deuda en el docstring del módulo, con su solución
nombrada. Lo que faltaba no era la idea, era el caso. **Un riesgo razonado no mueve a nadie; un
riesgo con número de PR sí.**

## Los dos matices que hacen que el arreglo no se vuelva otro problema

Al construir el gate aparecen dos trampas, y las dos son de diseño, no de código:

**1. Las fallas del INSTRUMENTO no pueden rechazar al evaluado.** Si el test no corre, o pasa sin el
parche, eso dice algo del *test*, no del *parche*. Si un forjador flojo escribiendo tests pudiera
tumbar parches correctos, el ciclo se apagaría solo — y como falla hacia el "no", no daría síntoma
([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]). De cinco desenlaces posibles, **uno solo rechaza**:
que el test siga fallando con el parche puesto. Los demás degradan a "no demostrado" y el ciclo
igual propone, diciéndolo.

**2. Un criterio que sólo se puede cumplir mintiendo premia al que miente.** El E2E fabrica un
trauma sobre un archivo **sano**. Exigirle ahí `arreglo_demostrado = True` obligaría al modelo a
inventar un test que "falla" por cualquier motivo. Así que el criterio no es *que demuestre*, es
**que se pronuncie**: el desenlace tiene que traer el veredicto, y `False` con su motivo es una
respuesta correcta. Lo mismo en el prompt: *"si no podés escribir un test que falle hoy por esta
causa, NO inventes uno"* — la abstención tiene que ser una salida disponible, o se fuerza el fraude.

## La pregunta que lo caza en cualquier gate

> **¿Este verde lo sacaría también alguien que no hizo nada?**

Si la respuesta es sí, el gate mide ausencia de daño, no presencia de valor. Sirve —y hace falta—
pero no es lo que su nombre sugiere, y en el momento de leerlo nadie va a recordar la diferencia.

## Hermanas

- [[instrumentos-que-confirman-en-vez-de-verificar]] — el instrumento que siempre absuelve.
- [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] — por qué el rechazo automático es peligroso acá.
- [[el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional]] — formato válido ≠ contenido correcto.
- [[idempotente-no-es-convergente]] — misma familia: la palabra promete más que el mecanismo.
