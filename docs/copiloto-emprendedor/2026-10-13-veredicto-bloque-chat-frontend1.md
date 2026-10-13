# Veredicto del bloque CHAT — 16 filas sin device (frontend-1)

**Fecha:** 2026-10-13 · **Contrato:** `2026-10-13_contrato_planificacion-a-frontend1_bloque-CHAT-16-filas-sin-device-del-mapeo` ·
**Mapeo de origen:** [`2026-10-12-mapeo-prototipo-vs-nativo.md`](2026-10-12-mapeo-prototipo-vs-nativo.md) (procedencia: merge `ca392f6a`) ·
**Rama:** `frontend1/bloque-chat-mapeo`

## Cómo leer esto

Cada fila termina en uno de cuatro estados. **Ninguno es «listo» a secas.**

| estado | qué significa |
|---|---|
| ✅ **RESUELTA** | el elemento que la fila declara ausente/distinto **existe y se ve en el código**, con `path:línea` y un test que lo ejercita |
| 📝 **ENMIENDA** | la divergencia se **mantiene a propósito**, con el motivo escrito. Reabrible por el operador |
| ⛓️ **DEPENDE** | no se cierra desde frontend: falta un contrato/decisión de otra sesión. Se nombra cuál y quién |
| ⚠️ **PARCIAL** | mezcla de los anteriores dentro de la misma fila — cada divergencia lleva su estado |

**Nivel de verificación de TODO lo de abajo:** test de componente (jest + RNTL) **y** gates de paridad
(`testid_paridad.py`, `idemkey_paridad.py`). **Ninguna fila fue vista en un teléfono.** El contrato lo
declara «sin device»; un verde de jest **no** acredita el aspecto ni el gesto. Lo que sólo se vería en
device queda anotado en cada fila como *«[sin ver en device]»*.

## Resumen

| # | fila | estado | lo que cerró | lo que queda |
|---|---|---|---|---|
| 1 | `recibo` | ✅ + 📝 | check, líneas de datos, enlace | hora y «Promo mandada» (sin contraparte) |
| 2 | `pres-ciclo` | ✅ + 📝 | recibo con N°/total/receptor/Doc + chip «Mandalo por mail» | rehidratación; «me aprobaron» |
| 3 | `fact-cae` | ✅ + 📝 | «Guardar» → «Abrir PDF/Drive» | «Mandala por mail» (sin contacto en el dato) |
| 4 | `fact-hitl` | ✅ + 📝 | encabezado «Factura C · ARCA» desde el dato | filas no editables, sin Cancelar, «Emitir» |
| 5 | `card-factura` | 📝 + ⛓️ | — | mic en Facturación → `fact-voz` |
| 6 | `factura` | ✅ + 📝 + ⛓️ | «Facturado este mes» | chip de conteo, composer/mic → `fact-voz` |
| 7 | `gastos` | ✅ + 📝 + ⛓️ | importe **y %** por categoría | dictado → campos extraídos |
| 8 | `presu` | ✅ + 📝 | resumen «Esperando respuesta» + estado por fila | «Enviado · 5 días» (sin dato) |
| 9 | `pres-hitl` | ✅ + 📝 | nota «a tu cliente no le llega nada» | formulario completo, «Cancelar» |
| 10 | `pres-voz` | ✅ + 📝 + ⛓️ | chip `m:ss` | hora, dictado desde la función |
| 11 | `vozchat` | ✅ + 📝 | chip `m:ss` | chip dentro de la burbuja, copy del resultado |
| 12 | `card` | 📝 + ⛓️ | — | hoja inferior, botón, extracción |
| 13 | `card-cliente` | 📝 + ⛓️ | — | 7 campos, «Dar de alta», extracción |
| 14 | `card-cobro` | ✅ + 📝 + ⛓️ | etiquetas ya coincidían | botón «Anotar», extracción |
| 15 | `card-presu` | 📝 | **medida**: DIVERGE | formulario completo vs 3 filas kv |
| 16 | `onb-promesa` | ✅ + 📝 | copy de la fila Google + «desde Ajustes» | pantalla completa, un botón por permiso |

**Cuenta honesta:** 16 filas con veredicto. **Ninguna** queda «sin veredicto», pero **7 no están cerradas
del todo** (⛓️: filas 5, 6, 7, 10, 12, 13 y 14 dependen de dos contratos — ver §Dependencias). Que
tengan veredicto no quiere decir que estén hechas.

---

## Fila por fila

### 1 · `recibo` — ✅ + 📝

**Resuelto**
- Check de éxito: `chat/Recibo.tsx:40-55` (SVG, no glifo; sólo con `tono="exito"` — «no lo anotamos» no es
  una confirmación).
- Líneas de datos bajo el título (`t2` del `REC`): `Recibo.tsx:64-72` · prop `detalle`.
- Slot de enlace a la derecha (`.link`): `Recibo.tsx:74-85` · prop `enlace`.
- Consumo real, no sólo definido: `chat/TarjetaPresupuestoPropuesto.tsx:88-121`.
- Test: `chat/TarjetaPresupuestoPropuesto.test.tsx` («al guardar…», «con Doc generado…»).

**Enmienda** — la línea «34 clientes · Gmail · 14:41» y el recibo «Promo mandada» del prototipo son del
flujo de **importación de clientes / mailing masivo**. Ese flujo no existe como card del chat (el mapeo
midió cero hits de «promo»). No es una divergencia de UI: es una feature que el producto no tiene.

### 2 · `pres-ciclo` — ✅ + 📝

**Resuelto** (prototipo `index.html:3367-3374`)
- Recibo «Presupuesto anotado — N° 12» + `$145.000,00 · Fernández` + «Doc listo para mandar» + enlace
  «Doc»: `chat/TarjetaPresupuestoPropuesto.tsx:88-121`.
- Chip **«Mandalo por mail»**: `TarjetaPresupuestoPropuesto.tsx:98-117`. Misma acción que el detalle
  (`DetallePresupuesto.tsx:435`): abre el `mailto:` con el link del Doc; **no manda nada solo**. Sólo
  aparece si el backend manda `sugerencias.mandarPorMail`.
- «Armá la factura»: ya existía — `chat/ChipArmarFactura.tsx:20`, montado en `ListaMensajes.tsx:322`.
- Tests: `TarjetaPresupuestoPropuesto.test.tsx` — chip con sugerencia (abre `mailto:` con el link) **y**
  control negativo sin sugerencia (no aparece).

**Enmienda**
- **Rehidratación.** Tras recargar la app el recibo trae sólo título + N°, sin las líneas de datos, el
  enlace ni el chip: lo que persiste en el mensaje es `numero` (GUARDM, `TarjetaPresupuestoPropuesto.tsx:70`). Persistir el `Presupuesto` entero cambia el contrato de persistencia del mensaje. No se hace
  acá.
- **«Me aprobaron»** no está en el chat: `DetallePresupuesto.tsx:201` lo omite a propósito.

### 3 · `fact-cae` — ✅ + 📝

**Resuelto**
- El botón decía «Guardar» pero llama `abrirLink` — no guarda nada (el mapeo lo midió). Ahora dice
  **«Abrir PDF»** / **«Abrir en Drive»**: `facturacion/comprobante.tsx:120`. El `testID` `-guardar` se
  conserva por E2E.

**Enmienda** — «Mandala por mail» para una factura **no se implementa**: `EstadoFacturaResp.receptor` es
`ReceptorInput` (`packages/core/src/api/afip.ts:428-434`: condición IVA, doc, nombre, domicilio) — **no
trae contacto ni mail**. Un `mailto:` saldría sin destinatario, que es lo que ya hace «Compartir»
(`comprobante.tsx:126`). Si backend agrega el contacto al estado, es un cambio chico.

### 4 · `fact-hitl` — ✅ + 📝

**Resuelto**
- Encabezado «**Factura C · ARCA**»: `chat/TarjetaFacturaPropuesta.tsx` (primer hijo del cuerpo, testID
  `-tipo`). El tipo es `propuesta.tipoComprobante` — el que manda el backend (`tipo_comprobante`,
  `packages/core/src/chat/facturaPropuesta.ts:43`). **No se escribe «C» a mano.** Sin tipo, sin encabezado.
- Tests: encabezado con `B` (prueba que no es fijo) y control negativo con `null`.

**Enmienda** (decisión de diseño ya documentada, no nueva)
- **Filas no editables y sin «Cancelar»:** la card es una *compuerta + handoff*, no un formulario
  (`TarjetaFacturaPropuesta.tsx:25-29`). Emitir es un acto fiscal irreversible y no hay camino
  `descartado` (`:64-66`); «Completar a mano» navega al wizard, donde sí se edita. ⚠️ Es una decisión de
  producto que el prototipo contradice; la dejo anotada para que el operador la pueda reabrir.
- **«Emitir» vs «Emitir factura»:** copy.
- **La nota** es `AVISO_FACTURA_ANULACION` («se anula con una nota de crédito») y no la del prototipo: es
  la que protege contra duplicar un comprobante fiscal real (H-23).

### 5 · `card-factura` — 📝 + ⛓️

Nada nuevo en código. Divergencias y su estado:
- Compuerta de sólo lectura, sin Editar/Cambiar ni Cancelar → 📝 (ver fila 4).
- «Emitir» vs «Emitir la factura» → 📝 copy.
- Muestra ítems y Total en vez de Cliente/Monto/Concepto → 📝: lo que se emite **es** el borrador que el
  backend armó, con sus ítems; resumirlo en tres filas ocultaría lo que se factura.
- **Dictar desde Facturación hacia una card no existe** (`PantallaFacturacion` no monta `MicFuncion`) →
  ⛓️ **`fact-voz`**. No lo implementé: sin contrato, el mic sólo podría precargar la transcripción
  cruda en el wizard — lo que es **inventar la forma** del handoff (`[ASSUMED_PENDING_VERIFY]`).

> ⚠️ **El DoD de esta fila dice «el elemento ausente existe y se ve». NO se cumple.** Está declarada
> aquí, con su dependencia, en vez de cerrarse con una enmienda que no tiene motivo propio.

### 6 · `factura` — ✅ + 📝 + ⛓️

**Resuelto**
- «**Facturado este mes**»: `facturacion/ResumenFacturado.tsx` montado al tope en
  `PantallaFacturacion.tsx:644`. La cifra es `portada.mes.facturado`
  (`packages/core/src/api/inteligencia.ts:55`, `apps/copiloto/inteligencia_queries.py:246`) — **la misma
  que ve Inteligencia, con el predicado de «facturado» definido una sola vez en el servidor.** No se suma
  el listado en el cliente: habría sido una segunda definición, la divergencia que F1 existe para cerrar.
- Sin dato (`no_disponible`, error, `null`) **no se pinta nada**: un «$0» afirmaría que no se facturó
  nada. Se relee con el tirón y al terminar una emisión.
- Tests: `ResumenFacturado.test.tsx` (5), `PantallaFacturacion.test.tsx` (mock por defecto a
  `no_disponible`).

**Enmienda**
- **Chip «6 facturas · 1 impaga»:** la portada no trae conteos; derivarlos del listado paginado daría un
  número que depende de cuántas páginas se bajaron.
- **«Te deben»** lo agrega el nativo y el prototipo no lo tiene: es un superset, se mantiene.
- **Wizard tras el pill «Nueva factura»** (`PantallaFacturacion.tsx`, fila fija) en vez del composer: es
  el único camino de alta que existe y está verificado.

**Depende** — composer «Facturale a alguien, o hablá…» y mic → ⛓️ **`fact-voz`** (fila 5).

> ⚠️ **Dependencia con F1.** La cifra mostrada hoy usa el predicado que tenga `main`. Cuando backend
> mergee F1.4 (predicado único, NC resta) el **número cambia** sin que esta pantalla se toque — eso es lo
> correcto, pero quien compare «antes/después» tiene que saberlo.

### 7 · `gastos` — ✅ + 📝 + ⛓️

**Resuelto**
- Importe **y porcentaje** por categoría: `gastos/ResumenMes.tsx:51` → «$15.000,50 · 100%». Test en
  `PantallaGastos.test.tsx`.

**Enmienda** — rótulo «Gastado en <período>» vs «Gastado este mes»: el período es **variable** (hay
selector); el literal del prototipo sólo es cierto para el mes en curso.

**Depende** — al dictar desde la función, `alDictarGasto` (`PantallaGastos.tsx:149`) precarga la
**transcripción cruda** en `descripcion`; el prototipo muestra monto/categoría/proveedor ya extraídos.
La card **del chat** sí extrae (lo hace el backend); la de la función no tiene esa vía → ⛓️ **extracción
de campos por destino** (ver §Dependencias).

### 8 · `presu` — ✅ + 📝

**Resuelto**
- Resumen «**Esperando respuesta $325.000 · 2 sin contestar · 1 aceptado**»:
  `presupuestos/PantallaPresupuestos.tsx:258` + `presupuestos/resumenEspera.ts`. Derivado del listado que
  la pantalla ya tiene (sin endpoint nuevo), en **centavos enteros**; `estado: null` → no hay resumen.
- Estado en la fila: `presupuestos/TarjetaPresupuesto.tsx:40` (+ `etiquetaEstado` en
  `resumenEspera.ts`) → «Aceptado» / «Esperando respuesta» / «Sin respuesta hace más de un mes».
- Tests: `resumenEspera.test.ts`, `TarjetaPresupuesto.test.tsx`, `PantallaPresupuestos.test.tsx`
  (incluye control negativo: sin `estado` no se dibuja nada).

**Enmienda**
- «**Se enfría · 31 días / Enviado · 5 días**»: `Presupuesto` **no distingue «enviado» de «pendiente»** ni
  trae los días (`sinRespuesta` es un booleano de >30 días). Afirmar «Enviado» sería inventar un estado.
- Mic junto al botón «Nuevo presupuesto» en vez de composer: **confirmado por el operador** (contrato
  2026-10-12 §2, PR #614).
- Buscador y toggle de historial: superset.

### 9 · `pres-hitl` — ✅ + 📝

**Resuelto**
- Nota «**Al guardar, a tu cliente no le llega nada: se lo mandás vos**»:
  `TarjetaPresupuestoPropuesto.tsx:125` (en el `aviso`). *Verificado:* no hay envío de mail en
  `apps/copiloto/*.py` (grep `GMAIL_SEND|send_email` = 0); el chip «Mandalo por mail» abre un `mailto:` y
  lo manda el usuario. **Alcance del grep:** sólo `apps/copiloto/*.py` de primer nivel; el agente ReAct
  puede mandar mail por Composio **si el usuario se lo pide** — eso no es el guardado de esta card.
- Test: `TarjetaPresupuestoPropuesto.test.tsx` («dice explícitamente que TODAVÍA no se guardó»).

**Enmienda**
- **Formulario completo y editable** (filas con agregar/quitar, catálogo) en vez de la card de lectura:
  decisión del operador, 2026-07-24, documentada en `TarjetaPresupuestoPropuesto.tsx:19-24`.
- «**Cancelar**» vs «Descartar»: el formulario es **el mismo** que usa la pantalla
  (`FormularioPresupuesto.tsx:422`); «Descartar» sería incorrecto allá.
- «**Total aproximado — el definitivo lo calcula el sistema**» (`FormularioPresupuesto.tsx:401`) vs «suma
  de ítems»: el copy nativo es el honesto; no se cambia.
- Chip «Docs»: sin dato que lo respalde en la propuesta.

### 10 · `pres-voz` — ✅ + 📝 + ⛓️  *(confianza declarada baja-media por planificación)*

**Resuelto**
- Chip `Por voz · 0:07` (m:ss) con **una sola definición**: `util/formatearDuracion.ts` usada por
  `chat/Burbuja.tsx:72` y `voz/MicFuncion.tsx:157`. Antes cada una armaba su «7s». Tests:
  `formatearDuracion.test.ts`, `ListaMensajes.test.tsx`, `MicFuncion.test.tsx`.

**Enmienda**
- **Hora «09:31 · por voz»:** *ninguna* burbuja del chat muestra hora (grep `toLocaleTimeString|HH:mm` en
  `chat/*.tsx` = 0). Ponerla sólo en las de voz rompe la consistencia. Los separadores de día cubren el
  «cuándo».
- Separadores «Hoy / Ayer / lunes 20 de octubre» vs «Lunes 20»: `separadoresFecha.ts` incluye el mes,
  que sin él es ambiguo en un historial largo.

**Depende** — dictar desde la función Presupuestos abre `FormularioPresupuesto` con `concepto` =
transcripción cruda (`PantallaPresupuestos.tsx:156-159`) mientras el prototipo manda el dictado a la
card (`DESTINO.presu`, `index.html:2863`) → ⛓️ **ruteo del dictado por destino** (§Dependencias).

### 11 · `vozchat` — ✅ + 📝

**Resuelto** — chip `m:ss` (ver fila 10).

**Enmienda**
- **Chip dentro de la burbuja del usuario**, no aparte «sin burbuja»: la transcripción **visible** es la
  cita contra la que se contrasta la card («Esto entendí…», `TarjetaGastoPropuesto.tsx:82`). Sin ella
  el usuario no puede ver qué entendió mal.
- **Card = formulario editable**, no filas kv con Editar/Cambiar: el propio prototipo lo declara —
  *«La card es el formulario real precargado — mecanismo canónico del repo»* (`index.html:2869`).
- Resultado «Gasto anotado: $X» vs «Listo, lo anoté en Gastos.»: el nativo lleva el **monto**
  (`TarjetaGastoPropuesto.tsx:70`) — más informativo.

### 12 · `card` — 📝 + ⛓️

- Hoja inferior sobre la función vs formulario que reemplaza la lista → 📝: la card **es el formulario
  real precargado** (mismo comentario del prototipo, `index.html:2869`); una hoja nueva sería un segundo
  componente que mantener.
- «Guardar» vs «Guardar el gasto» → 📝 copy (ver §Pedidos: el copy vive en formularios de otros módulos).
- Dictado desde la función precarga sólo `{descripcion: texto}` → ⛓️ extracción por destino.

### 13 · `card-cliente` — 📝 + ⛓️

- 7 campos vs 3 → 📝: es el formulario real de alta (`clientes/FormularioCliente.tsx`); los 3 del
  prototipo son los que se **dictan**, el resto son opcionales.
- «Dar de alta» (`FormularioCliente.tsx:389`) vs «Guardar el cliente» → 📝 copy, **archivo de
  `modules/clientes`, fuera de mi lista** → `pedido_`.
- El dictado vuelca todo el texto en `nombre` (`PantallaClientes.tsx:191`) → ⛓️ extracción.

### 14 · `card-cobro` — ✅ + 📝 + ⛓️

- **Las etiquetas ya coincidían** — el mapeo estaba desactualizado: `ingresos/FormularioIngreso.tsx:201-225`
  dice «Cuánto te pagaron / De quién / Cómo te pagaron / Por qué trabajo».
- «Anotar» (`FormularioIngreso.tsx:309`) vs «Anotar que me pagaron» → 📝 copy, archivo de
  `modules/ingresos` → `pedido_`.
- Dictado desde la función precarga sólo `concepto` → ⛓️ extracción.

### 15 · `card-presu` — 📝  *(esta fila no tenía medida; ahora sí)*

El contrato exige que la fila diga **COINCIDE** o **nombre la divergencia**. **Medido contra
`index.html:2878`:**

| | prototipo | nativo |
|---|---|---|
| título | «Nuevo presupuesto» | sin título propio (sólo el aviso del shell) |
| campos | Cliente · Monto · Detalle (3 filas kv con Cambiar/Editar) | formulario completo: receptor (nombre/doc/contacto) + concepto + filas de ítems |
| botón | «Guardar el presupuesto» | «Guardar presupuesto» (`FormularioPresupuesto.tsx:416`) |

**Veredicto: DIVERGE.** Enmienda por la decisión del operador (2026-07-24): la card reusa
`FormularioPresupuesto` **entero** y las filas editables se quedan
(`TarjetaPresupuestoPropuesto.tsx:19-24`). No es «sin comparación».

### 16 · `onb-promesa` — ✅ + 📝

**Resuelto**
- Fila Google: título «**Mail · Agenda · Archivos**» + detalle «Google · Gmail, Calendar, Drive, Docs,
  Sheets» + botón «Conectar Google»: `onboarding/PantallaOnboarding.tsx:25-29`.
- Nota «…desde **Ajustes**» (`:159`). *Verificado:* `Apps` se alcanza desde Ajustes
  (`app/ajustes.tsx:32`, `apps: '/apps'`). *No verificado:* que **Mercado Pago** también se corte desde
  ahí (asumí que sí porque va por el mismo catálogo de `PantallaApps`).

**Enmienda**
- **Pantalla completa, no hilo:** es la puerta de entrada (`app/_layout.tsx:97-98`) y pide permisos
  reales, no una burbuja.
- **Un botón por permiso** vs «Conectar Google» único: Mercado Pago y Google son OAuth independientes.
- **Sin catálogo (`permisos: null`) las filas no se dibujan** (`:129`): fail-closed, no inventa permisos.

---

## Dependencias (⛓️) — lo que NO cierra frontend

| contrato | filas | qué falta | dueño |
|---|---|---|---|
| **`fact-voz`** — dictar desde Facturación | 5, 6 | forma del handoff mic → borrador de factura | planificación + backend |
| **Extracción de campos por destino al dictar desde una función** | 7, 10, 12, 13, 14 | hoy `precarga = transcripción cruda`; el prototipo manda el dictado a la card con campos ya extraídos. Dos caminos posibles: (a) endpoint de extracción por destino, (b) rutear el dictado al chat con un hint de destino | **decisión MAYOR** → operador |
| **F1.4** — predicado único de facturado | 6 | sólo para saber que la cifra va a cambiar | backend (en curso) |

## Pedidos que salen de este bloque

1. **Copy de botones** de los formularios que reusan las cards («Guardar» → «Guardar el gasto»,
   «Anotar» → «Anotar que me pagaron», «Dar de alta» → «Guardar el cliente»): los archivos son de
   `modules/gastos|ingresos|clientes`, fuera de mi lista; además el copy alcanza al gemelo web.
2. **Web gemela del onboarding** (`apps/copiloto-web/.../Onboarding.tsx:23,146`): el copy de Google
   cambió acá y la web dice otra cosa.
3. **Formato de duración en la web:** `Por voz · Ns` vs `m:ss` — si el prototipo manda, la web también.

## Qué NO verifiqué (explícito)

- **Nada en teléfono.** Los gestos, el aspecto del check SVG, el wrap de las líneas de detalle y el
  tamaño del chip son `[sin ver en device]`.
- **El resumen de Facturación contra datos reales:** el test usa un mock de `leerPortada`. No corrí la
  pantalla contra el backend.
- **El chip «Mandalo por mail» con un Doc real:** el test prueba que abre un `mailto:` con el link; no
  que el cliente de mail del teléfono lo reciba bien.
- **`tsc` de todo el paquete:** el junction a `@copiloto/core` del worktree está desactualizado y da
  errores en archivos que no toqué (`acciones`, `alertaDobleEmision`, `idemKey`). Filtrado a mis
  archivos no hay errores nuevos; la verificación formal es `scripts/gate.sh`.
