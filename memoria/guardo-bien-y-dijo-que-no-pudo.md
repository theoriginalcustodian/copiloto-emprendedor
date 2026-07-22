---
name: guardo-bien-y-dijo-que-no-pudo
description: LEER al escribir un cliente HTTP calcando otro, y al revisar por qué una suite verde no cazó un bug — el test escrito desde la misma creencia que el código no lo verifica, lo confirma.
metadata:
  type: project
---

La app **guardó el gasto** y mostró *«los gastos todavía no están disponibles en tu copiloto»*. La
fila estaba en la base; la pantalla decía que no existía la función.

**Por qué es caro y no cosmético:** el emprendedor lee eso y **vuelve a tocar Guardar**. `POST /gastos`
no es idempotente y no puede serlo —dos gastos iguales el mismo día son legítimos—, así que el segundo
toque **crea un segundo gasto**. El que los ve inflados es el resumen del mes, la única pantalla que
justifica la función. Es [[idempotencia-con-un-if-tiene-ventana]] mudada a la UI.

**La causa.** `POST /gastos` y `GET /gastos/{id}` devuelven el gasto **pelado**; presupuestos y perfil
lo **envuelven** (`{presupuesto: …}`). Calqué el cliente de presupuestos, quedó exigiendo
`'gasto' in raw`, la condición dio falsa, y devolvió `no_disponible` sobre un `201` exitoso.
Barrido de los 8 endpoints contra el vivo: **exactamente dos** sin envoltura.

## Lo que hay que aprender no es la envoltura — son las tres capas que fallaron a la vez

**1. Medí bien y no crucé la medición contra el código.** Mi propia sonda ya había verificado las 9
claves del gasto **sobre la respuesta cruda** — o sea, ya había medido que venía pelado. El dato
estaba en mi output. Verificar que *la respuesta tiene lo que necesito* no es verificar que *mi cliente
sabe leerla*: son dos afirmaciones y sólo probé una.

**2. 🔴 Un test escrito desde la misma creencia que el código no lo verifica: lo confirma.** Los 19
tests pasaban porque el *fixture* envolvía, igual que el código — los dos salieron de la misma
suposición (calcar presupuestos). **Una suite verde sólo prueba que el código y sus tests están de
acuerdo**, y eso es trivialmente cierto cuando los escribió la misma cabeza en la misma tarde. El
fixture tiene que salir de **la respuesta real medida**, no de lo que uno cree que devuelve.

**3. Ningún test miraba la respuesta.** Todos los de `crearGasto` asertaban sobre
`peticiones[0].cuerpoJson` —lo que se **manda**— o sobre ramas de error. El camino feliz de vuelta
—qué hace el cliente con un `201`— **no tenía cobertura**. Es un punto ciego con forma: es cómodo
testear el request (es determinístico y uno lo acaba de escribir) y aburrido testear que el resultado
se interpretó bien.

## El control que hace que el arreglo signifique algo

Corregir y ver 20/20 no prueba nada: los tests podrían seguir sin discriminar. **Control diferencial:
los tests nuevos contra el código anterior** (`git show HEAD:archivo` a un temporal) → **2 fallan**.
Con el fix → 20/20. Eso prueba que los tests *pueden* dar rojo por esta causa.

Y el primer intento del control mostró el hueco: falló **1 sola** vez donde yo esperaba 2 — y esa
diferencia fue lo que destapó que `crearGasto` no tenía test de respuesta. **Un control que no da el
resultado esperado es información, no ruido.**

## Cómo no repetirlo

- Al **calcar** un cliente de otro endpoint, la envoltura es lo primero a verificar, no lo último: es
  invisible en el tipo (`apiClient.get<{gasto: X}>` compila igual aunque el backend no envuelva).
- El fixture de un test de red **se copia de una respuesta real capturada**, no se escribe de memoria.
- Todo cliente necesita al menos un test del **camino feliz de vuelta**: status ok + el objeto
  normalizado. Si todos los tests miran el request, el cliente está sin probar.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]]: acá el instrumento no era una
herramienta sino **la suite entera**, y su verde significaba menos de lo que parecía.
