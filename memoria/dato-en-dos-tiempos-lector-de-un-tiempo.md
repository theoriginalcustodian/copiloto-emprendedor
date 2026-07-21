---
name: dato-en-dos-tiempos-lector-de-un-tiempo
description: "Un recurso que se completa por partes (CAE, luego PDF, luego Drive) y un lector que asume un solo tiempo: el estado leido es real pero prematuro y nadie da error. Incluye el caso en que la propia bandera `terminado` miente. LEER al poletear o al agregar un paso al final de un flujo."
metadata: 
  node_type: memory
  type: project
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T19:50:42.773Z
---

**LEER al poletear cualquier estado que se complete por partes.**

**Forma del bug:** un recurso llega en **dos tiempos** y el lector asume **uno solo**. No hay excepción,
no hay log, el estado leído es *real* — sólo que prematuro. Es primo del vacío-que-no-protesta: duele
menos que un error y por eso se canoniza.

**Los dos casos que aparecieron el mismo día (2026-07-21, facturación AFIP), uno de cada lado:**

- **Frontend:** el polling de emisión cortaba en `estado === 'emitida'`. El PDF se genera **después**
  del CAE, así que ese corte cae justo en la ventana intermedia: la app mostraba *"el PDF no está
  disponible"* mientras `GET /afip/comprobantes` ya devolvía `pdf_url`. `emitida` y `entregada` son
  estados distintos precisamente por esto. **Fix: cortar por `terminado`**, que además cubre los otros
  estados finales sin enumerarlos — si el backend agrega uno, el loop no queda girando.
- **Backend:** la activity que adjuntaba el PDF reusaba el upsert completo del comprobante, cuyo
  `estado` tiene default `"emitida"`. Si una anulación caía en esa misma ventana, el PDF **pisaba** el
  estado y la factura anulada volvía sola a vigente.

**3er caso, y corrige el consejo #2 de abajo (2026-07-21, tarde — archivado en Drive):** cortar por
`terminado` **tampoco alcanzaba**, porque `terminado` se DERIVABA de una lista de estados terminales y
la factura se marca `entregada` ANTES de archivarse en Drive. El lector cortaba ahí y leía `drive:
null` para siempre. Al agregar un tercer tiempo (CAE → PDF → Drive), la bandera que ya existía quedó
mintiendo sola, sin que nadie la tocara.

Y fallaba en el borde opuesto: una factura sin PDF queda en `emitida`, que NO figuraba entre los
terminales → `terminado` nunca se volvía `true` y el cliente poleaba para siempre un workflow cerrado.

**Fix de raíz: `terminado` dejó de ser una deducción y pasó a ser un flag explícito** que el workflow
setea justo antes de cada `return` — "no voy a escribir nada más". Una bandera derivada de estados hay
que acordarse de actualizarla cada vez que se agrega un paso; una que el propio flujo enciende al
terminar no se puede olvidar.

**Lo caro fue cómo apareció:** lo destapé escribiendo el E2E de la feature nueva, cometiendo el MISMO
error que el frontend había documentado 6 horas antes. Conocer el patrón no inmuniza: hay que
preguntarse por él en cada lector nuevo.

**How to apply:**
1. Antes de elegir la condición de corte, preguntar: **¿este recurso se completa de una o por partes?**
   Si hay un artefacto derivado (PDF, thumbnail, transcripción, índice), casi siempre son dos tiempos.
2. Cortar por el estado **terminal declarado** (`terminado`, `done`) — pero **auditar cómo se calcula
   esa bandera**. Si sale de una lista de estados, es deuda: el próximo paso que alguien agregue al
   final la vuelve prematura sin tocar una línea del lector. Que la encienda el flujo al terminar.
3. **Al agregar un paso al final de un flujo, revisar quién declara "terminado".** Es el punto ciego:
   el paso nuevo se prueba, la bandera vieja no.
4. **Correr el control**: si la UI dice que algo falta, consultar el backend directo. Si el dato está,
   el problema es el momento de la lectura, no el dato.
5. Al escribir de a partes, que cada escritura **toque sólo su campo** (`adjuntar_pdf()`,
   `adjuntar_drive()`), nunca un upsert completo con defaults.

[[vacio-no-es-hallazgo-correr-el-control]] · [[validacion-de-mas-en-la-ui-enmascara-bugs]] ·
[[copiloto-facturacion-afip]]
