---
name: el-mensaje-niega-el-efecto-que-ya-ocurrio
description: La card guardó el gasto y mostró "no disponible" → el usuario reintenta y duplica. Y por qué una suite verde no lo cazó — el test escrito desde la misma creencia que el código lo confirma, no lo verifica.
metadata:
  type: project
---

**LEER al escribir el manejo de errores de cualquier acción que ESCRIBE (guardar, emitir, cobrar), al
consumir un endpoint nuevo, y al calcar un cliente HTTP de otro.**

E2E en device (2026-07-22): dicté un gasto, toqué **Guardar**:

| | |
|---|---|
| **En la base** | ✅ `id=7 · 8500.00 · transporte · origen=voz` — guardado, una vez, correcto |
| **En la pantalla** | 🔴 *«Los gastos todavía no están disponibles en tu copiloto»*, la card seguía en *«todavía no lo anoté»* |

**Por qué es caro y no cosmético.** El usuario lee que no se guardó **y que la función ni existe**. La
única acción razonable es **tocar Guardar otra vez**. `POST /gastos` no puede ser idempotente —dos
gastos iguales el mismo día son legítimos—, así que el segundo toque **crea un duplicado**, y el que
los muestra inflados es el resumen del mes. Es [[idempotencia-con-un-if-tiene-ventana]] mudado a la UI.

**El mecanismo general, que es el punto.** Todo el rigor de este repo apunta a *no declarar éxito sin
evidencia*. Éste es el **caso espejo y no estaba cubierto**: declarar **fracaso** sobre un efecto que
**ya ocurrió**. Es peor que el falso verde, porque el falso verde deja al usuario quieto y éste lo
empuja a **actuar de nuevo sobre un sistema que ya cambió**.

## La causa — era la envoltura, no el status

`POST /gastos` y `GET /gastos/{id}` devuelven el gasto **pelado**; presupuestos y perfil lo **envuelven**
(`{gasto: …}`). Calqué el cliente de presupuestos, quedó exigiendo `'gasto' in raw`, la condición dio
falsa, y devolvió `no_disponible` sobre un `201` exitoso. Barrido de los 8 endpoints contra el vivo:
**exactamente dos** sin envoltura. No era una clase, era un caso — pero **sólo se supo barriendo**, no
razonando.

## Las lecciones que valen más que el bug

**1. La sonda propia ya había medido la forma correcta.** Verificaba las 9 claves del gasto **sobre la
respuesta cruda** —o sea, midió que venía pelado— y el cliente se escribió esperando envoltura. Que *la
respuesta tiene lo que necesito* no es que *mi cliente sabe leerla*: dos afirmaciones, sólo probé una.

**2. 🔴 Un test escrito desde la misma creencia que el código no lo verifica: lo confirma.** Los 19
tests pasaban porque el *fixture* envolvía, igual que el código — los dos salieron de la misma
suposición. **Una suite verde sólo prueba que el código y sus tests están de acuerdo**, trivialmente
cierto cuando los escribió la misma cabeza en la misma tarde. El fixture se copia de **una respuesta
real capturada**, no se escribe de memoria.

**3. Ningún test miraba la RESPUESTA.** Todos los de `crearGasto` asertaban sobre lo que se **manda**
(el request) o ramas de error; el camino feliz de vuelta —qué hace el cliente con un `201`— **no tenía
cobertura**. Punto ciego con forma: es cómodo testear el request (determinístico, recién escrito) y
aburrido testear que el resultado se interpretó bien.

## El control diferencial hace que el arreglo signifique algo

Corregir y ver 20/20 no prueba nada. **Control:** los tests nuevos contra el código anterior
(`git show HEAD:archivo`) → **2 fallan**; con el fix → 20/20. Y el primer intento falló **1 sola** vez
donde esperaba 2 — esa diferencia destapó que `crearGasto` no tenía test de respuesta. **Un control que
no da el resultado esperado es información, no ruido.**

## Reglas

- **Escritor del endpoint:** si dos endpoints hermanos difieren en si envuelven, es una trampa para el
  consumidor. Elegir una forma y declararla en el contrato.
- **Consumidor:** la condición que decide "no disponible" no puede ser una propiedad del **cuerpo** —
  tiene que serlo del **status**/transporte. Si no se puede confirmar que la escritura falló, **no se
  puede decir que falló**.
- **Al calcar un cliente:** la envoltura es lo PRIMERO a verificar — es invisible en el tipo
  (`get<{gasto:X}>` compila igual aunque el backend no envuelva). Y todo cliente necesita ≥1 test del
  **camino feliz de vuelta** (status ok + objeto normalizado).

Hermanas: [[instrumentos-que-confirman-en-vez-de-verificar]] (acá el instrumento era la suite entera) ·
[[catch-all-vuelve-no-desplegado-indistinguible-de-roto]] · [[verificar-que-el-camino-recomendado-existe]]
