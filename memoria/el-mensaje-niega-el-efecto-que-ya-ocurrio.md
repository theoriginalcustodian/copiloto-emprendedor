---
name: el-mensaje-niega-el-efecto-que-ya-ocurrio
description: La card guardó el gasto y mostró "esta función no está disponible" — el usuario reintenta y duplica
metadata:
  type: project
---

**LEER al escribir el manejo de errores de cualquier acción que ESCRIBE (guardar, emitir, cobrar), y
al consumir un endpoint nuevo.**

E2E en device (2026-07-22): dicté un gasto, toqué **Guardar**, y:

| | |
|---|---|
| **En la base** | ✅ `id=7 · 8500.00 · transporte · origen=voz` — guardado, una vez, correcto |
| **En la pantalla** | 🔴 *«Los gastos todavía no están disponibles en tu copiloto»*, y la card seguía diciendo *«todavía no lo anoté»* |

**Por qué es caro y no cosmético.** El usuario lee que no se guardó **y que la función ni existe**. La
única acción razonable es **tocar Guardar otra vez**. Y `POST /gastos` no puede ser idempotente —dos
gastos iguales el mismo día son un caso legítimo—, así que el segundo toque **crea un duplicado**. Es
[[idempotencia-con-un-if-tiene-ventana]] mudado a la UI: allá fueron dos facturas con CAE; acá son dos
gastos, y el que los muestra inflados es el resumen del mes.

**El mecanismo general, que es el punto.** Todo el rigor de este repo apunta a *no declarar éxito sin
evidencia*. Éste es el **caso espejo y no estaba cubierto**: declarar **fracaso** sobre un efecto que
**ya ocurrió**. Es peor que el falso verde, porque el falso verde deja al usuario quieto y éste lo
empuja a **actuar de nuevo sobre un sistema que ya cambió**.

## La causa real (FRONTEND, commit `522726b`) — y no era la que yo sospechaba

Yo aposté al `201` en vez de `200`. **Era la envoltura.** `POST /gastos` y `GET /gastos/{id}` devuelven
el gasto **pelado**; el cliente exigía `'gasto' in raw` —calcado del de presupuestos, que sí envuelve—
y con esa condición falsa devolvía `no_disponible` sobre una respuesta perfectamente buena.

El barrido de los 8 endpoints consumidos encontró **exactamente dos** con esa forma. O sea: no era una
clase, era un caso — pero **sólo se supo barriendo**, no razonando.

## Las dos lecciones que valen más que el bug

**1. La sonda propia ya había medido la forma correcta.** Verificaba las 9 claves del gasto **sobre la
respuesta cruda** —o sea, midió que venía pelado— y el cliente se escribió esperando envoltura. **El
dato estaba en el output propio y nadie cruzó la medición contra el código.**

**2. Los 19 tests pasaban porque el fixture envolvía, igual que el código.** Los dos salieron de la
misma suposición. **Un test escrito desde la misma creencia que el código no lo verifica: lo
confirma.** Y abajo había un hueco peor: ningún test de `crearGasto` miraba la **respuesta** —todos
assertaban sobre lo que se manda—, así que el camino que rompió en device **no tenía cobertura**.

El fix se validó con **control diferencial**: los tests nuevos contra el código viejo → 2 fallan; con
el fix → 20/20. Verde por discriminar, no por casualidad.

**Regla para el que escribe el endpoint:** si dos endpoints hermanos difieren en si envuelven la
respuesta, eso es una trampa puesta para el consumidor. Elegir una forma y declararla en el contrato.

**Regla para el que lo consume:** la condición que decide "no disponible" no puede ser una propiedad
del **cuerpo** — tiene que serlo del **status** o del transporte. Si no se puede confirmar que la
escritura falló, **no se puede decir que falló**.

Hermanas: [[instrumentos-que-confirman-en-vez-de-verificar]] · [[catch-all-vuelve-no-desplegado-indistinguible-de-roto]] · [[verificar-que-el-camino-recomendado-existe]]
