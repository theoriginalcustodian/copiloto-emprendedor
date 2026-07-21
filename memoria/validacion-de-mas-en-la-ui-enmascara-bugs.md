---
name: validacion-de-mas-en-la-ui-enmascara-bugs
description: "Duplicar reglas del servidor en el cliente no sólo envejece mal: ENMASCARA bugs de las dos capas y traba el caso más común"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T17:15:36.750Z
---

**Regla:** la UI exige **exactamente** lo que exige el backend, ni un campo más. El gate duro es del
servidor; el cliente sólo anticipa lo evidente.

**El caso que la pagó (2026-07-21, facturación AFIP).** El paso "Cliente" pedía documento **Y** nombre
**Y** domicilio siempre. El backend (`afip_rules.validar_receptor`) no exige ninguno de los tres para
consumidor final. Consecuencias, en orden de gravedad:

1. **Trababa el caso más común del producto** —venta mostrador a consumidor final— con el botón
   "Continuar" **deshabilitado en silencio**, sin decir qué faltaba. Indistinguible de una función rota.
2. **Enmascaró un bug del backend**: el WSFE autoriza esa factura sin esos campos, pero el template del
   PDF los exige. Nadie lo vio en todo el sprint porque la UI nunca dejaba pasar el caso. Apareció en la
   primera emisión real: CAE válido, sin comprobante imprimible.
3. **Enmascaró un bug propio**: como todas las emisiones caían en `emitida_sin_pdf`, la rama del
   comprobante CON PDF nunca se ejercitó — y ahí había otro defecto (polling que cortaba antes de que
   el PDF llegara).

**Una validación de más no es conservadora: es un tapón.** Deja de ejercitar caminos y los bugs se
acumulan detrás, en las dos capas a la vez.

**How to apply:**
1. Antes de escribir un `puedeContinuar`/`listo`, **leer la función de validación del backend** y
   copiar su criterio, no inventar uno más estricto "por las dudas".
2. Si el botón se deshabilita, la UI tiene que **decir qué falta**. Un control apagado sin explicación
   es el peor modo de fallo: no hay error que buscar.
3. Ante la duda, **correr el control por HTTP** con los mismos datos: si el backend los acepta, la
   regla de más está en el cliente. Eso aisló este caso en dos minutos.
4. Las reglas fiscales/de negocio del servidor **no se replican** en el cliente: envejecen mal (cambia
   un mínimo y la copia bloquea ventas legítimas sin que nadie sepa por qué).

[[gate-jsdom-no-ve-gestos-tactiles]] · [[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[no-codificar-la-esperanza-principio-raiz]]
