# HANDOFF → sesión BACKEND · F5 y F6 implementadas, E2E VERDE desde el teléfono

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Rama:** `feat/mobile-first-cascara-glass` · commits `bbeb858`, `c96cde3`, `1c7c2a9`, `fb5c3e2`, `cb2506f`, `ed348a9`
> **Estado:** 🟢 **Emitir y anular funcionan desde el device, con CAE real.** Falta sólo el alta con la
> clave fiscal del operador, que es la parte que ningún script puede probar por él.

Gracias por la cuenta de pruebas y por los tres cambios de contrato: los tres entraron limpio y
ninguno me obligó a un workaround.

---

## 1. La evidencia

E2E completo desde el teléfono (SM-A217M), con `pruebas-facturacion@copiloto.test`:

| Comprobante | CAE | Estado |
|---|---|---|
| Factura C 0006-00000005 · $1500 | 86290619793525 | **anulada**, `cbte_asoc_nro=5` |
| Nota de crédito N° 5 | 86290619803431 | emitida |

Camino recorrido a mano en el device: **gate `puede_facturar` → datos de venta → ítem → cliente →
resumen con el ambiente → confirmar → CAE → Mis comprobantes → anular → nota de crédito.** Verificado
después contra `GET /afip/comprobantes`, no sólo contra lo que mostraba la pantalla.

265/266 jest verdes, `tsc` limpio, cero hex literales, ambos temas.

---

## 2. Cuatro defectos que **sólo** aparecieron facturando de verdad

Los cuatro pasaban jest en verde. Los pongo porque son el argumento más fuerte que tengo para que el
cierre con el operador se haga en device y no por script.

**a. El paso Cliente trababa el flujo entero.** Exigía documento **Y** nombre **Y** domicilio siempre.
El caso más común de todos —venta a consumidor final— no necesita ninguno de los tres, y el botón
"Continuar" quedaba deshabilitado **en silencio**, sin decir qué faltaba. Lo aisló el control: repetí
los mismos datos por HTTP contra su backend y pasó a `esperando_confirmacion` sin chistar, así que la
regla de más estaba de mi lado. Ahora la app exige exactamente lo que exige `validar_receptor` y nada
más. **Su contrato estaba bien; el mío duplicaba reglas fiscales, que además envejecen mal.**

**b. El aviso de "emitida sin PDF" se pintaba en ROJO de peligro.** El texto decía *"se emitió
correctamente"* y el color decía falla. Y salió en la **primera emisión real**, no en un caso raro:
tu factura N° 5 no generó PDF. Es justo el escenario del que me advertiste; el copy estaba bien y el
color lo contradecía. Nadie lee un cartel rojo hasta el final — el usuario habría vuelto a facturar.

**c. El botón "Anular" se comía la fila** y quedaba flotando sin decir sobre qué comprobante actuaba.
Un botón destructivo sin sujeto es peligroso, no feo.

**d. Un separador huérfano** en el resumen cuando el cliente no tiene nombre ni domicilio.

---

## 3. Lo que hice con cada cosa que pidieron

- **`motivo_codigo`**: la UI ramifica por el código, nunca por la frase. `motivo` se muestra tal cual.
- **`emitida_sin_pdf`**: éxito con advertencia, CAE bien visible, sin la palabra "falló". Confirmado
  por ustedes y ahora también visto en device.
- **409 sin certificado**: no llega casi nunca porque el gate `puede_facturar` corta antes, pero está
  tipado (`SinCertificadoError`) y **no** se colapsa con `no_disponible` — son estados opuestos.
- **El ambiente en el resumen**: hecho, y va más allá de lo que pidieron. En producción el botón dice
  **"Emitir factura real"** en vez de "Confirmar y emitir", con el aviso en rojo de que anularlo
  requiere una nota de crédito. En homologación aclara que es una prueba. Y si el ambiente **no** se
  puede confirmar, la pantalla lo dice: no asume homologación, porque asumir "la opción segura" es
  exactamente lo que produce el error caro.
- **`ambientes_vinculados`**: el selector de Ajustes muestra el activo como "Activo", el otro vinculado
  como **tocable** ("Usar este" → `POST /afip/ambiente`), y el no vinculado como "Vincular" → alta.

---

## 4. Dos defectos que encontré en MI propia capa, por si les sirve el patrón

Los dos eran silenciosos y los cazó construir la pantalla encima:

- `ConectarArcaRequest.ambiente` estaba tipado `'homologacion'|'produccion'`. Ustedes usan
  `'dev'|'prod'`, y **pydantic ignora las claves que no entiende**: la app habría mandado un valor que
  el backend descarta sin error, dejando el alta en el ambiente equivocado. Cero excepciones, cero
  logs, comportamiento incorrecto.
- `estadoAfip` armaba un objeto literal de 5 claves y descartaba `ambiente`/`ambientes_vinculados`
  antes de que la pantalla los viera. El día que ustedes los subieran —hoy— el selector habría seguido
  degradado y el síntoma no habría apuntado a ese archivo por ningún lado.

Ambos con test de regresión ahora.

---

## 5. Lo que queda, y es de ustedes + el operador

**El alta ARCA desde el teléfono con la clave fiscal real del operador.** Es lo único del flujo que no
pude ejercitar: la cuenta de pruebas ya venía vinculada, así que F5 está construida y verificada en
render (los tres bloques, el flujo de 3 pasos, el aviso de la clave, el polling con progreso real y su
corte a los 10 minutos) pero **el alta en sí nunca corrió desde la app**. Está declarado, no escondido.

Cuando coordinen con el operador, avísenme y lo acompaño en el device.

---

## 6. Supuestos que hice sobre el contrato

- **`condicion_venta`** viaja como texto libre: Contado / Cuenta corriente / Tarjeta / Transferencia.
  Me confirmaron que AFIP no exige vocabulario cerrado para Factura C.
- **`EstadoAnulacion` no tiene `motivo_codigo`** — lo documentaron sólo para la factura, así que no lo
  agregué "por simetría". Si en algún momento lo suman, la UI lo aprovecha sin cambios.
- **El tope de consumidor final sin identificar lo decide el backend**, con el total real. La app no
  lo replica: no quiero una copia del límite envejeciendo acá.

## 7. Ningún workaround forzado por el backend

No hay deuda de ustedes en este frente. Los tres cambios que pedí llegaron antes de que los
necesitara, y el único cambio de comportamiento (el 409) me llegó ya implementado.
