---
name: el-error-apunta-a-un-parametro-que-nunca-mandaste
description: LEER al agregar un sub-recurso de texto (/resumen, /export, /activos) a un recurso con id — y al debuggear un 422 que se queja de un parámetro que el cliente no mandó.
metadata:
  type: project
---

`GET /presupuestos/resumen` devuelve **422 `int_parsing` sobre `presupuesto_id`** — un parámetro que
el cliente **nunca mandó**. Medido contra el servicio vivo el 2026-07-21.

La causa: FastAPI resuelve por **orden de registro**. Con `/{presupuesto_id}` declarado antes que
`/resumen`, el segmento textual `resumen` cae en la ruta del id, no parsea como entero, y muere ahí.
El handler del resumen nunca se ejecuta.

**Por qué esto manda a buscar el bug del lado equivocado.** El error nombra un parámetro que no existe
en la llamada, así que la primera hipótesis razonable es *"el cliente está mandando algo de más"* — y
se va a revisar el cliente, que está bien. La ruta correcta ni siquiera aparece en el stack: no hubo
`404`, no hubo "ruta no encontrada", hubo una **validación exitosa de otra ruta** que resultó fallar.

**Ningún test de unidad lo caza.** Ahí se llama al handler directo y el routing no participa: el
resumen responde perfecto en el test y muere en producción. Sólo lo ve una llamada **por HTTP** — y
por eso el DoD tiene que pedir explícitamente *"`GET /x/resumen` devuelve el resumen, no un 422"*.

**Las dos mitades del arreglo:**

- **Backend:** declarar el segmento textual **antes** que el `{id}`. Es cambiar el orden de dos
  decoradores, y sale con un test **por HTTP** que arma el mismo par en los dos órdenes y exige
  `200` vs `422`.
- **Cliente:** validar la respuesta por **forma**, no por status. `if (!('periodo' in raw))` →
  no disponible. Un `200` que no trae la clave que el contrato promete **no lo contestó ese
  endpoint** — vale igual para este caso y para el catch-all del SPA, que devuelve `200` con HTML
  sobre cualquier ruta inexistente.

Se cazó **antes de que existiera el código de gastos**, midiendo la ruta hermana que ya estaba viva
(`/presupuestos/resumen`) mientras se revisaba el contrato. Ese es el momento barato: cambiar el orden
de dos decoradores en un contrato no escrito cuesta una línea; descubrirlo en device cuesta una tarde
buscando en el cliente.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]] y de
[[vacio-no-es-hallazgo-correr-el-control]]: acá el instrumento **acusa con precisión** —status, tipo,
nombre del campo— y todo lo que dice apunta al lugar equivocado.
