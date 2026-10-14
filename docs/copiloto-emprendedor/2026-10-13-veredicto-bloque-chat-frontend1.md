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
| 5 | `card-factura` | ✅ + 📝 | «Emitir» → «Emitir la factura» | mic en Facturación → 📝 `mic-facturacion` (enmienda: emitir es irreversible) |
| 6 | `factura` | ✅ + 📝 | «Facturado este mes» | chip de conteo, composer/mic → 📝 `mic-facturacion` (enmienda: emitir es irreversible) |
| 7 | `gastos` | ✅ + 📝 | importe **y %** por categoría · dictado → campos extraídos (#1065) | rótulo «Gastado en <período>» |
| 8 | `presu` | ✅ + 📝 | resumen «Esperando respuesta» + estado por fila | «Enviado · 5 días» (sin dato) |
| 9 | `pres-hitl` | ✅ + 📝 | nota «a tu cliente no le llega nada» | formulario completo, «Cancelar» |
| 10 | `pres-voz` | ✅ + 📝 | chip `m:ss` · dictado desde la función → card extraída (#1065) | hora, separadores con mes |
| 11 | `vozchat` | ✅ + 📝 | chip `m:ss` | chip dentro de la burbuja, copy del resultado |
| 12 | `card` | ✅ + 📝 | botón «Guardar el gasto» (#1056) · extracción (#1065) | hoja inferior |
| 13 | `card-cliente` | ✅ + 📝 | botón «Guardar el cliente» (#1056) · extracción (#1065) | 7 campos |
| 14 | `card-cobro` | ✅ + 📝 | etiquetas ya coincidían · botón «Anotar que me pagaron» (#1056) · extracción (#1065) · chips WhatsApp/mail del link (adenda) | — |
| 15 | `card-presu` | 📝 | **medida**: DIVERGE | formulario completo vs 3 filas kv |
| 16 | `onb-promesa` | ✅ + 📝 | copy de la fila Google + «desde Ajustes» | pantalla completa, un botón por permiso |
| 17 | `hitl` | ✅ + 📝 | puente tarjeta → chat: verbo pulsable, texto sembrado, chip «Desde tu aviso», «Volver al tablero» | «Editar» (no medido: ítem `EDITARMUERTO`). **«Volver al tablero →» dentro del recibo: ✅ a.4, 2026-10-14** |
| 18 | `clientes` | ✅ + 📝 | monto · «N comprobantes» · «Sin CUIT cargado» / «Todavía sin comprar» · condición IVA en el subtítulo | «Con movimiento», «Se agregó solo», pill vs botón, inputbar vs «Buscar» |
| 19 | `caida` | ✅ + 📝 | kv «Se cayó · Hoy, 9:12» desde `datos.desde` (sólo con instante real) | rótulo «En caja», copy del aviso, fecha de corte |
| 20 | `cobro-voz` | 📝 | divergencia #5: el motivo escrito, en el doc y en el código | — |
| 21 | `fact-voz` | ✅ + 📝 | meta «hora ✓✓ recibido» bajo la burbuja propia | avatar del asistente: FUERA-DE-REFERENCIA |

**Cuenta honesta:** 21 filas con veredicto (las 16 del bloque + las 5 pendientes de `backend + nativa`: BLOQUENATIVO5). **Ninguna** queda «sin veredicto». **Ninguna** queda con una
dependencia abierta (las filas 5 y 6 llevaban ⛓️ por `mic-facturacion` y pasaron a 📝 por enmienda fundada,
MICFACTENM, 2026-10-13 — ver §Dependencias). Hasta la re-medición de abajo
eran 7: las filas 7, 10, 12, 13 y 14 colgaban de una dependencia (extracción por destino) y de un copy
que **ya estaban en `main`** cuando se escribieron las pendientes. Que tengan veredicto no quiere decir
que estén hechas.

## Re-medición de cláusulas (post #1056 / #1050 / #1065) — qué estaba rancio y qué sigue vigente

Medida **cláusula por cláusula**, con `path:línea` de los dos lados, sobre `origin/main` `c4a26381`. La
causa común: las pendientes se escribieron leyendo el mapeo del 2026-10-12 (anterior a tres PRs del
2026-10-13) y la fila quedó describiendo un defecto que ya no existe. **Una pendiente cuyo defecto ya no
existe infla el denominador igual que una enmienda falsa lo deflaciona.**

| fila | cláusula | estado | prototipo | nativo |
|---|---|---|---|---|
| `card` | dictar desde la función precarga sólo `{descripcion: texto}` | 🔴 RANCIA | `index.html:2864` (`DESTINO`) | `PantallaGastos.tsx:79,161-163` — `useDictadoPorFuncion('gasto')` + `inicialesDeGasto(propuesta)`; el texto crudo es sólo el degradado (`:163`). #1065 |
| `card` | «Guardar» vs «Guardar el gasto» | 🔴 RANCIA | `index.html:2872` (`b:'Guardar el gasto'`) | `FormularioGasto.tsx:213` dice «Guardar el gasto». #1056 |
| `card` | hoja inferior vs formulario que reemplaza la lista | 📝 VIGENTE | `index.html:2869` («la card es el formulario real precargado») | `PantallaGastos.tsx:166` (`setVista('formulario')`) |
| `card-cliente` | el dictado vuelca todo en `nombre` | 🔴 RANCIA | `index.html:2880` | `PantallaClientes.tsx:105,196-199` — `useDictadoPorFuncion('cliente')`; `{nombre: texto}` sólo si cae. #1065 |
| `card-cliente` | «Dar de alta» vs «Guardar el cliente» | 🔴 RANCIA | `index.html:2881` | `FormularioCliente.tsx:389` dice «Guardar el cliente». #1056 |
| `card-cobro` | campos «Cuánto te pagaron / De quién / …» vs Monto/Cliente/Cómo te pagó | 🔴 RANCIA (**dos referentes**) | `CARDS.cobro` `index.html:2875`: Monto · Cliente · Cómo te pagó — **los mismos que la app**; los otros cuatro rótulos son del *formulario* del prototipo, no de su card | `FormularioIngreso.tsx:201-225` |
| `card-cobro` | «Anotar» vs «Anotar que me pagaron» | 🔴 RANCIA | `index.html:2875` (`b:'Anotar que me pagaron'`) | `FormularioIngreso.tsx:309` — el formulario que **monta la card**; también `PantallaIngresos.tsx:218` (la cita `:184` era de antes del PR). #1056 |
| `card-cobro` | el dictado precarga sólo `concepto` | 🔴 RANCIA | `index.html:2874` | `PantallaIngresos.tsx:76,132-134` — `inicialesDeIngreso(propuesta)`. #1065 |
| `gastos` | dictar abre el formulario con la transcripción cruda | 🔴 RANCIA | `index.html:2861` | `PantallaGastos.tsx:161-163` (la cita `:149` era de antes del PR) |
| `gastos` | importe por categoría y no el % | 🔴 RANCIA | `index.html:1903-1925` | `ResumenMes.tsx:51` — «importe · %» (ya cerrada en la fila 7) |
| `gastos` | «Gastado en <período>» vs «Gastado este mes» | 📝 VIGENTE | `index.html:1903` | `ResumenMes.tsx:39` — el período es variable (selector) |
| `pres-voz` | dictar desde Presupuestos abre `FormularioPresupuesto` con `concepto` crudo | 🔴 RANCIA | `index.html:2864` | `PantallaPresupuestos.tsx:85,164-167` — `inicialesDePresupuesto(propuesta)`. #1065 |
| `pres-voz` | hora + «por voz» vs «Por voz · 7s» | 📝 VIGENTE — **decisión firmada** | `index.html:3352` (`'09:31 · por voz'`) | `Burbuja.tsx:71-73` — el chip `m:ss` lo especificó BL-J7 (H-A3-7), `chatMachine.ts:52-54`. El prototipo **choca con un ítem firmado**: no es un fix, es del operador |
| `pres-voz` | separadores «Hoy/Ayer/lunes 20 de …» vs «Lunes 20» | 📝 VIGENTE | `index.html:3351` | `separadoresFecha.ts:30-38` — incluye el mes (sin él es ambiguo en un historial largo) |
| `factura` | no tiene resumen mensual («Facturado este mes») | 🔴 RANCIA | `index.html:2036` | `PantallaFacturacion.tsx:46,212,645-648` — `ResumenFacturado` al tope (ya cerrada en la fila 6; #1048) |
| `factura` | sin composer ni mic | 📝 VIGENTE | `index.html:2060` («Facturale a alguien, o hablá…») | `PantallaFacturacion.tsx`: **0** `<MicFuncion` (control positivo: `PantallaGastos.tsx` tiene 1). **Y backend lo excluyó a propósito**: `dictado_destinos.py:43-44` — «`factura` NO está, y no es casualidad: emitir es irreversible ante ARCA». ⛓️ `mic-facturacion` deja de ser «falta una forma»: es una decisión |
| `card-factura` | «Emitir» vs «Emitir la factura» | ✅ VIGENTE → **CORREGIDA acá** | `index.html:2876` (`b:'Emitir la factura'`) | `TarjetaFacturaPropuesta.tsx:268` (mobile) y su gemelo web `:240` — rótulo y aviso (`:189`/`:179`) |
| `card-factura` | compuerta de sólo lectura, sin Editar/Cambiar ni Cancelar | 📝 **POR DISEÑO** | `index.html:2876` | `TarjetaFacturaPropuesta.tsx:26,35` — gate + handoff; el docstring ya lo declara. Enmienda, no fix |
| `card-factura` | muestra ítems y Total en vez de Cliente/Monto/Concepto | 📝 VIGENTE | `index.html:2876` | lo que se emite **es** el borrador del backend, con sus ítems (fila 5) |

**Resultado:** de 19 cláusulas medidas, **10 estaban rancias** (6 por #1065, 3 por #1056, 1 por #1048; una
de ellas —`card-cobro` campos— era de **dos referentes** y no de un cambio de código), **1 se corrige
acá** y **8 siguen vigentes** (las 8 como enmienda con su motivo: `mic-facturacion` era la única
dependencia real y pasó a enmienda fundada el 2026-10-13, MICFACTENM). El padrón **no se toca por mano**: los símbolos de las filas 5, 7, 10, 12, 13 y 14 de
este documento son lo que lee el medidor, y es el medidor el que recalcula.

### Qué rama describe cada cláusula del dictado (`card` · `card-cliente` · `gastos`)

El camino nuevo del dictado tiene **dos ramas** y un verde sobre una no absuelve a la otra: la
**extraída** (el motor devuelve la card y el formulario abre con los campos ya cargados) y la **cruda**
(el camino está apagado o falló: abre con el texto en un campo y el hook deja un `aviso` que lo dice).
Una cláusula está **rancia** si describe la rama cruda como el **único** comportamiento; está
**vigente** sólo si describe el degradado. Medido en el código y en los tests de **ambas** ramas:

| fila | cláusula | rama que describe | veredicto | código | test de la rama extraída · de la cruda |
|---|---|---|---|---|---|
| `card` | «dictar precarga sólo `{descripcion: texto}`» | **cruda, como única** | 🔴 rancia | `PantallaGastos.tsx:158-167` (`propuesta !== null ? inicialesDeGasto(propuesta) : { descripcion: texto }`) | `PantallaGastos.test.tsx:482` · `:503` (la cruda **avisa**: `gastos-dictado-aviso`) |
| `gastos` | «dictar abre el formulario con la transcripción cruda» | **cruda, como única** | 🔴 rancia | ídem | ídem |
| `card-cliente` | «el dictado vuelca todo el texto en `nombre`» | **cruda, como única** | 🔴 rancia | `PantallaClientes.tsx:192-199` (`propuesta !== null ? propuesta : { nombre: texto }`) | `PantallaClientes.test.tsx:750` · `:765` (la cruda **avisa**: `clientes-dictado-aviso`) |

Ninguna de las tres describe el degradado, así que ninguna sobrevive como enmienda. Lo que sí queda
fuera de la fila y **vigente** es que el degradado **existe y se declara** (no es silencioso): eso lo
sostienen los dos tests `🔴 si el motor no devuelve la card, cae al texto crudo … Y LO DICE`.

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
- **«Emitir» vs «Emitir factura»:** copy → **corregido** (ver fila 5): el rótulo pasó a «Emitir la factura».
- **La nota** es `AVISO_FACTURA_ANULACION` («se anula con una nota de crédito») y no la del prototipo: es
  la que protege contra duplicar un comprobante fiscal real (H-23).

### 5 · `card-factura` — ✅ + 📝

Nada nuevo en código. Divergencias y su estado:
- Compuerta de sólo lectura, sin Editar/Cambiar ni Cancelar → 📝 (ver fila 4).
- «Emitir» vs «Emitir la factura» → ✅ **corregido**: `TarjetaFacturaPropuesta.tsx:268` (+ aviso `:189`,
  «tocá Emitir la factura») y el gemelo web `:240`/`:179`. Test: el rótulo exacto en mobile y web.
  «Emitiendo…» no cambia: el prototipo no define el estado en vuelo.
- Muestra ítems y Total en vez de Cliente/Monto/Concepto → 📝: lo que se emite **es** el borrador que el
  backend armó, con sus ítems; resumirlo en tres filas ocultaría lo que se factura.
- **Dictar desde Facturación hacia una card no existe** (`PantallaFacturacion` no monta `MicFuncion`) →
  📝 **`mic-facturacion`** (enmienda fundada, MICFACTENM) — 🔴 y **backend lo dejó fuera a propósito** del dictado por destino
  (`apps/copiloto/dictado_destinos.py:43-44`: emitir es irreversible, la transcripción cruda no precarga
  nada), así que no falta una forma: falta una **decisión** (no es la fila `fact-voz`, que planificación resolvió en `2b43e5a3`: el contrato del hito 9 manda y la card HITL de `factura_propuesta` es el camino). No lo implementé: sin contrato, el mic sólo podría precargar la transcripción
  cruda en el wizard — lo que es **inventar la forma** del handoff (`[ASSUMED_PENDING_VERIFY]`).

> ✅ **Enmienda fundada — MICFACTENM (2026-10-13).** Esta nota decía que el DoD de la fila («el elemento
> ausente existe y se ve») NO se cumplía y la dejaba como dependencia «en vez de cerrarse con una enmienda
> que no tiene motivo propio». El motivo propio existe y está en `main`: `apps/copiloto/dictado_destinos.py:43-44` («`factura` NO está, y no es casualidad: emitir es irreversible ante ARCA, así que la transcripción cruda no precarga nada»; `_DESTINOS` lista sólo las cuatro reversibles: `gasto`/`ingreso`/`presupuesto`/`cliente`). Es una **decisión**,
> no una forma que falte, y planificación la concedió textual en el contrato
> `…tus-dos-pedidos-YA-estan-contestados…` §5 («es decisión, no forma; eso es enmienda fundada y la cláusula
> del padrón sobra»). El mic **no se construye** en Facturación: emitir sigue yendo por la card HITL de
> `factura_propuesta` y el wizard. Si el operador reabre la exclusión, esta fila vuelve a ⛓️.

### 6 · `factura` — ✅ + 📝

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

**Enmienda** — composer «Facturale a alguien, o hablá…» y mic → 📝 **`mic-facturacion`**: la misma razón y la
misma cita que la fila 5 (`dictado_destinos.py:43-44`, emitir es irreversible ante ARCA). Concedida por
planificación; ver la nota de la fila 5.

> ⚠️ **Dependencia con F1.** La cifra mostrada hoy usa el predicado que tenga `main`. Cuando backend
> mergee F1.4 (predicado único, NC resta) el **número cambia** sin que esta pantalla se toque — eso es lo
> correcto, pero quien compare «antes/después» tiene que saberlo.

### 7 · `gastos` — ✅ + 📝

**Resuelto**
- Importe **y porcentaje** por categoría: `gastos/ResumenMes.tsx:51` → «$15.000,50 · 100%». Test en
  `PantallaGastos.test.tsx`.
- **Dictar desde la función abre la card con los campos extraídos** (antes ⛓️): `PantallaGastos.tsx:79`
  (`useDictadoPorFuncion('gasto')`), `:161-163` (`inicialesDeGasto(propuesta)`; `{descripcion: texto}`
  sólo si el camino cae, con `AvisoDictado`). Backend: `dictado_destinos.py` (#1050). App: #1065.
  Test: `PantallaGastos.test.tsx` (dictado con propuesta / degradado).

**Enmienda** — rótulo «Gastado en <período>» vs «Gastado este mes»: el período es **variable** (hay
selector); el literal del prototipo sólo es cierto para el mes en curso.

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

### 10 · `pres-voz` — ✅ + 📝  *(confianza declarada baja-media por planificación)*

**Resuelto**
- Chip `Por voz · 0:07` (m:ss) con **una sola definición**: `util/formatearDuracion.ts` usada por
  `chat/Burbuja.tsx:72` y `voz/MicFuncion.tsx:157`. Antes cada una armaba su «7s». Tests:
  `formatearDuracion.test.ts`, `ListaMensajes.test.tsx`, `MicFuncion.test.tsx`.

- **Dictar desde Presupuestos abre la card con la propuesta extraída** (antes ⛓️):
  `PantallaPresupuestos.tsx:85` (`useDictadoPorFuncion('presupuesto')`), `:164-167`
  (`inicialesDePresupuesto(propuesta)`). #1065.

**Enmienda**
- **Hora «09:31 · por voz»:** 🔴 además de la consistencia, el chip `Por voz · m:ss` **lo especificó BL-J7
  (H-A3-7)** y está en el contrato del tipo (`chatMachine.ts:52-54`): el prototipo choca con un ítem
  firmado, y una decisión firmada no se re-decide desde un desvío. Reabrible **sólo** por el operador.
- (antes, sin la cita firmada) la consistencia: *ninguna* burbuja del chat muestra hora (grep `toLocaleTimeString|HH:mm` en
  `chat/*.tsx` = 0). Ponerla sólo en las de voz rompe la consistencia. Los separadores de día cubren el
  «cuándo».
- Separadores «Hoy / Ayer / lunes 20 de octubre» vs «Lunes 20»: `separadoresFecha.ts` incluye el mes,
  que sin él es ambiguo en un historial largo.

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

### 12 · `card` — ✅ + 📝

- Hoja inferior sobre la función vs formulario que reemplaza la lista → 📝: la card **es el formulario
  real precargado** (mismo comentario del prototipo, `index.html:2869`); una hoja nueva sería un segundo
  componente que mantener.
- «Guardar» vs «Guardar el gasto» → ✅ **resuelto** (#1056): `gastos/FormularioGasto.tsx:213`.
- Dictado desde la función precarga sólo `{descripcion: texto}` → ✅ **resuelto** (#1065):
  `PantallaGastos.tsx:161-163` (ver fila 7).

### 13 · `card-cliente` — ✅ + 📝

- 7 campos vs 3 → 📝: es el formulario real de alta (`clientes/FormularioCliente.tsx`); los 3 del
  prototipo son los que se **dictan**, el resto son opcionales.
- «Dar de alta» vs «Guardar el cliente» → ✅ **resuelto** (#1056): `FormularioCliente.tsx:389`.
- El dictado vuelca todo el texto en `nombre` → ✅ **resuelto** (#1065): `PantallaClientes.tsx:105,196-199`
  (`useDictadoPorFuncion('cliente')`; `{nombre: texto}` sólo si el camino cae).

### 14 · `card-cobro` — ✅ + 📝

- **Las etiquetas ya coincidían** — el mapeo estaba desactualizado: `ingresos/FormularioIngreso.tsx:201-225`
  dice «Cuánto te pagaron / De quién / Cómo te pagaron / Por qué trabajo».
- «Anotar» vs «Anotar que me pagaron» → ✅ **resuelto** (#1056): `FormularioIngreso.tsx:309`, el
  formulario que monta la card (y `PantallaIngresos.tsx:218`).
- Dictado desde la función precarga sólo `concepto` → ✅ **resuelto** (#1065):
  `PantallaIngresos.tsx:76,132-134` (`inicialesDeIngreso(propuesta)`).
- **Adenda de planificación (2026-10-13) — chips de la card del link de cobro: ✅ en código.**
  `chat/TarjetaLinkDeCobro.tsx` pinta «Compartilo por WhatsApp» (`-compartir`, hoja del sistema vía
  `compartirLink`), «Mandalo por mail» (`-mail`, `mailto:` con `mailtoLinkDeCobro`) y «Abrir»; los
  deriva la card de `artifact.kind == "payment_link"` — `choices` no los trae
  (`motor/backend/agent/conversation_workflow.py:746,761,766`). Tests en `TarjetaLinkDeCobro.test.tsx`.
- 🚫 **Prohibidas y NO pintadas** (la card lleva un test que lo ejecuta): «vence en 7 días» — la
  preference de MP no manda `expires` (`motor/clients/agent/providers/mercadopago_gateway.py:86-96`),
  el link no vence — y «cuando pague, te aviso» — no hay push de cobro acreditado. Lo que sí dice
  (`-nota`): «Cuando Mercado Pago apruebe el pago, lo anoto como ingreso», cierto porque
  `apps/copiloto/mp_web.py:55-60` sólo registra el ingreso con `status == "approved"`.
- 📝 Si el operador quiere vencimiento, baja como `contrato_` con `artifact.data.expira_at` y la card
  lo pinta **leyendo** ese campo.

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

### 17 · `hitl` — ✅ + 📝

*(BLOQUENATIVO5 §1. Las divergencias de la fila: el puente tarjeta → chat, el chip de contexto, la card
«Recordatorio a Lucía», el recibo «Mandado a Lucía» y la salida «Volver al tablero».)*

**Resuelto**
- **El puente existe** (C-D5 Opción A: texto sembrado, 0 backend). El `verbo` del detalle expandido ya no es un
  `Text` inerte: es un botón cuando la tarjeta la detectó una regla y hay a dónde llevarlo
  (`PantallaMiDia.tsx:748`, regla en `packages/core/src/chat/avisoAlChat.ts`). Lleva el aviso al chat
  **sembrado en el composer, sin mandarlo** (`Composer.tsx:89,152`): lo manda quien lo lee, que es el último
  punto donde puede corregir un mail a un tercero.
- **Chip «Desde tu aviso · Presupuestos · Lucía»** + **«Volver al tablero»** (`ChatView.tsx`,
  testIDs `chat-contexto-aviso*`). El chip nombra sólo lo que la tarjeta sabe: sin categoría o sin cliente esa
  parte no aparece (nunca «Cliente» inventado).
- **El contexto se cierra** al volver al tablero y al bajar el chat por gesto (`PantallaPrincipal.tsx:163-167`
  + `PanelDeslizable.tsx` `senalBajar`).
- **La card «Recordatorio a Lucía» (b) y el recibo «Mandado a Lucía · 9:41»** ya estaban resueltos por C-D3
  para el piloto Gmail (fila 1 `recibo`). **Aceptado por planificación, no se reabre.**

**Enmienda**
- 📝 **El chip es sólo UI; el contexto viaja en el texto.** `POST /chat` no tiene campo de contexto
  (`ChatIn {session_id, text, kind}`). Si alguna vez se hace la Opción B (`ChatIn.contexto`), el contexto de
  tarjeta y el hint de destino del dictado (`kind = "dictado:<destino>"`) tienen que entrar por UN mecanismo.
- 📝 **No es `dejarPendiente`.** El buzón de `mensajePendiente` *manda* el texto; acá se siembra. Motivo arriba.
- 📝 **La tarjeta manual (sin `regla`) no tiene puente.** Su verbo es «Borrar»: una acción sobre la propia
  tarjeta, no un pedido al agente.
- ✅ **«Volver al tablero →» dentro del recibo — a.4, 2026-10-14** (prototipo `index.html:2774`). Antes esta
  línea era una enmienda («la salida vive en el chip»); el contrato `a.4` la reabrió y se implementó: el
  `Recibo` de `ListaMensajes.tsx` lleva su `enlace` y tocarlo llama `onVolverAlTablero({ tarjetaId, resultado:
  'hecha' })` — que es lo que `a.5` ya sabía cerrar. 🔴 **Sólo el recibo POSTERIOR al aviso** (cuenta desde
  cuántos mensajes había cuando ESE aviso entró, con el estado hidratado): el recibo de una tarea vieja del
  historial no es el resultado de este aviso. El chip sigue volviendo SIN cerrar la tarjeta. **Acotación
  honesta:** cualquier recibo posterior al aviso la cierra, no sólo el del verbo exacto de la tarjeta — el
  backend no ata el recibo a la tarjeta, así que no hay forma de distinguirlos sin un campo nuevo.
- 📝 **La ruta glass `/midia` queda sin puente a propósito**: sin `onAvisoAlChat` el verbo sigue siendo
  rótulo, y hay un test que lo fija.

**Probado** — `avisoAlChat.test.ts` (6), `PantallaMiDia.test.tsx`, `Composer.test.tsx`, `ChatView.test.tsx`,
`PanelDeslizable.test.tsx`, `PantallaPrincipal.avisoAlChat.test.tsx` (costura de punta a punta en el shell
real) y `PantallaPrincipal.avisoBajarGesto.test.tsx`. **12 mutantes, 12 muertos** (M5/M5b por cuelgue: un
mutante que manda el aviso solo genera un bucle de envío y jest no termina; cuenta como muerto, y lo digo).

**[sin ver en device]** El movimiento real del panel (`senalSubir`/`senalBajar`: reanimated está stubbeado en
jest), el aspecto del chip y que el verbo se pueda tocar sin querer abrir/cerrar la tarjeta. Un mutante que
rompa «el chat sube al tocar el verbo» **no es detectable en jest**: es DoD de device.

**No medido por nadie:** el «Editar» de la card HITL (backend lo declara así). Si se lo cruza, se reporta.

### 18 · `clientes` — ✅ + 📝

*(BLOQUENATIVO5 §2. Divergencias 1-5 de la fila.)*

**Resuelto**
- **#1 · El monto (C-D1).** Mobile pinta la columna derecha con la **misma regla del core que la web**
  (`facturacionDeCliente` → `textoMontoCliente` + `estadoFacturacionCliente`, `TarjetaCliente.tsx:63-70`):
  «$importe · N comprobantes», «—» + «Sin CUIT cargado» (nunca un número aunque el wire traiga `"0.00"`),
  «Todavía sin comprar» si el neto es cero, y sin el par declarado (backend previo) cae al conteo o a «—».
  Las reglas de texto ahora viven en `packages/core/src/api/clientes.ts` y la web las consume de ahí: había
  **dos copias** y la de mobile no existía (0 hits de `montoFacturado|facturacionDeCliente` en mobile, con la
  web en 5).
- **#3 · La condición IVA en el subtítulo** (`subtituloDeCliente`, core): «CUIT 30712345678 · Resp.
  Inscripto». Sin documento cae al primer dato que identifique.
- **Corrección de cita (#1079).** El `cierre_` de C-D1/C-D4 decía que mobile no pintaba el monto por «una
  decisión documentada en su docstring». **No lo estaba**: el docstring hablaba del documento, del subtítulo
  y del `origen`, no del slot. Ahora el monto está pintado **y** la decisión sobre cada chip está escrita en
  el docstring (`TarjetaCliente.tsx`).

**Enmienda**
- 📝 **#2 · «Con movimiento» no se pinta.** El rótulo afirma que lo de abajo tuvo movimiento; la lista es la
  **cartera entera, alfabética** (`clientesOrdenados`). C-D1 decidió que el servidor NO ordena ni filtra por
  movimiento (deuda `CLIENTMOV`), y el prototipo trae un único rótulo sin sección «sin movimiento» — o sea
  espera una lista *ordenada por movimiento*, que hoy nadie puede darle. Pintar el rótulo sobre una lista
  alfabética sería decir algo que no se midió. Se retoma con `CLIENTMOV`.
  ⚠️ **La web SÍ pinta «Con movimiento»** (`ClientesScreen.tsx:290`) sobre `ordenarAlfabetico`. Es el mismo
  defecto y no lo toco desde acá: queda como pedido (§Pedidos).
- 📝 **«Se agregó solo» no se pinta en mobile** (`.estado.auto` del prototipo). El derivado es el *default* de
  la cartera: etiquetar el caso mayoritario es ruido, y ese conteo ya lo da el BloqueCifra («N se agregaron
  solos este mes»). Se descarta el chip `auto` y sólo sobreviven los estados MEDIDOS. Reabrible.
- 📝 **#4 · «Nuevo cliente» es botón primario, no pill** (`PantallaClientes.tsx:339-340`). El pill del
  prototipo (`.nuevo`) comparte fila con el rótulo «Con movimiento» (#2): sin rótulo no tiene fila donde vivir.
  El botón primario es el patrón de las funciones hermanas (`PantallaGastos.tsx:277`) y es el alta que
  ofrece también la cartera vacía. Mismo `testID` (`clientes-nuevo`) que la web.
- 📝 **#5 · «Buscar» es un campo visible con etiqueta, no el inputbar «Buscá un cliente, o hablá…»**
  (`PantallaClientes.tsx:381`). En el prototipo el inputbar es la barra compartida buscar/dictar; acá el
  dictado vive en `MicFuncion` (fila de arriba) y la búsqueda es un `CampoTexto` cuya etiqueta no desaparece
  al tipear, con búsqueda en backend con debounce de 350 ms. La web hace lo mismo (`ClientesScreen.tsx`,
  label «Buscar») — es una decisión de la app, no de mobile.

**Probado** — `TarjetaCliente.test.tsx` (7, nuevo), `PantallaClientes.test.tsx` (el subtítulo cambió a
propósito), `clientes.test.ts` (reglas de texto y subtítulo) y los tests web de `TarjetaCliente`. Mutantes:
K1-K6 muertos, 6/6.

**[sin ver en device]** El layout de la columna derecha en pantalla angosta (nombre largo + «$ importe ·
N comprobantes» en una línea) y el truncado con `numberOfLines`.

### 19 · `caida` — ✅ + 📝

*(BLOQUENATIVO5 §3. El dato ya estaba cumplido y probado en backend, en las dos ramas.)*

**Resuelto**
- **El kv «Se cayó · hora»** (`index.html:3658`, `<div class="kv"><span>Se cayó</span><b>Hoy, 9:12</b></div>`).
  Lee `datos.desde` (`packages/core/src/api/miDia.ts`: `instanteDe`, sólo un ISO parseable) y lo formatea con
  `formatearInstanteDeCaida` («Hoy, 9:12» · «Ayer, 21:40» · «9 de octubre, 8:00»). Se agrega al detalle sólo
  para `regla === 'conexion_caida'`, y sólo si la tarjeta no trae ya un kv «Se cayó»
  (`PantallaMiDia.tsx:740-743`).
- 🔴 **Sin `datos.desde` no hay fila, y nunca se rellena con `creada_en`**: es cuándo corrió el detector, no
  cuándo cayó la conexión. Composio no guarda el instante (`conexiones_salud.py:33`) → campo **ausente**, y
  eso es lo que el test de core fija.

**Enmienda**
- 📝 **#3 · El rótulo queda «En caja»** (el prototipo lo cambia a «Entró esta semana»,
  `index.html:3645`). La cifra de abajo es `portada.caja.saldo` (`PortadaNegocio.tsx:37`): un **saldo**, no
  lo que entró en una ventana. Rotularla «Entró esta semana» afirmaría un período que el número no mide. Lo
  que declara que está incompleta es el aviso de debajo (`AVISO_CAJA_INCOMPLETA`, K-09).
- 📝 **#4 · El copy del aviso es distinto, el hecho es el mismo.** Prototipo (`index.html:1651`): «faltan los
  cobros de hoy — Mercado Pago está caído». Nativo (`core/midia/caja.ts`): «Se cayó la conexión con Mercado
  Pago: faltan los cobros de hoy, así que estos números pueden estar incompletos». Mismos dos datos (qué
  falta, cuál conexión); el nativo agrega la consecuencia, que es la regla dura del repo (el dato que falta
  se DICE, no se disfraza). Está en el core: web y mobile dicen lo mismo.
- 📝 **#5 · El chip pierde la variación y conserva la fecha de corte.** Coincide en lo que el prototipo
  oculta: `.p-delta` es «−18% vs julio» (`index.html:1648`) y con la portada incompleta lo esconde
  (`:3648`); `chipDeCaja` también la omite (`incompleta === true`, test `caja.test.ts:59`). Lo que el nativo
  conserva, «Al 19 de agosto», **no está en el prototipo**: es el K-03 y dice hasta cuándo es bueno el
  saldo, justo lo que importa cuando falta una conexión.

**Probado** — `instanteCaida.test.ts` (4), `miDia.test.ts` («`datos.desde`», 3), `PantallaMiDia.test.tsx`
(«caida», 4). Mutantes C1-C5 muertos, 5/5.

**[sin ver en device]** Que «Hoy, 9:12» use la hora del reloj del teléfono como la lee el emprendedor, y el
aspecto del kv dentro del detalle.

### 20 · `cobro-voz` — 📝

*(BLOQUENATIVO5 §4 + el contrato de seguimiento de planificación, que aportó el motivo medido. Era la
**única** divergencia abierta de la fila: la #5.)*

**#5 · La card reemplaza la burbuja, el texto no se pinta → ENMIENDA FUNDADA.**

1. **El dictado del emprendedor no se pierde.** `ListaMensajes.tsx:329` renderiza `role === 'user'` como
   burbuja *antes* de toda rama de card. Lo que la card reemplaza es el texto del **copiloto**, no el dictado.
   La frase «la card reemplaza la burbuja» es cierta, pero apunta a otro sujeto del que uno asume al leerla.
2. **El prototipo no modela esta tarjeta en el hilo.** `index.html`: `Compartir`/`Abrir`/`artefacto`/
   `init_point`/`payment` → 0 hits, con control positivo en `cobrar`. Mercado Pago aparece sólo como app
   conectada (`:2342`).
3. **El `kind` `payment_link` ES el contenido.** La card trae monto, concepto y Compartir/Abrir, que es el DoD
   de `BL-F2`; una burbuja arriba («acá está el link») sería redundante.
4. **Por eso la asimetría con `datos_negocio` es legítima:** esa rama sí lleva burbuja + card porque ahí hay
   referencia de prototipo y su propio comentario la cita (`ListaMensajes.tsx:440`).

El motivo quedó **también escrito en el código**, junto a la rama (`ListaMensajes.tsx` sobre
`leerLinkDeCobro`): el razonamiento no viaja con el código copiado.

**Probado** — `ListaMensajes.test.tsx` («cobro-voz #5»): el mensaje del usuario sigue siendo burbuja, la card
está, y el texto del asistente no. Mutante F10 (la rama vuelve a llevar burbuja) muerto.

⚠️ **Hallazgo ajeno, no corregido:** la cita de `BL-F2` al prototipo (`index.html:3134-3139`) es **rancia** —
ahora apunta al gesto de swipe de los avisos. Es de planificación/Martín, no mía. Y la evidencia de `BL-F2`
(«mobile no porta el renderer de artefactos … grep vacío») también está rancia: hoy `payment_link|init_point`
aparece en 3 archivos de `apps/mobile`.

### 21 · `fact-voz` — ✅ + 📝

*(BLOQUENATIVO5 §5. Las divergencias (a)-(c) ya las resolvió backend: gana el contrato del hito 9, no el
prototipo. Quedaban (d) y (e), sin dueño; las decidió planificación.)*

**(d) Resuelta — la meta «10:12 ✓✓ recibido» bajo la burbuja PROPIA.** Es paridad real: el prototipo la pinta
(`index.html:2164,2167,2170`, `:3192`) y la web la tiene (`Bubble.tsx:63`).
- `Burbuja.tsx:87` (`chat-bubble-recibido`, tono `exito`, alineada a la derecha, fuera de la burbuja), con la
  hora del dispositivo (`formatearHoraDeMensaje`); sin `creadoEn` queda «✓✓ recibido» a secas, sin inventar
  una hora.
- 🔴 **«Recibido» es una afirmación sobre el servidor, y la web no la condiciona (`Bubble.tsx:63`, siempre).**
  Mobile sí: el mensaje del usuario es optimista (`useChat`), así que mientras `POST /chat` está en vuelo
  (`sending`) o falló (`error`, con reintento) el **último** mensaje propio NO se rotula recibido
  (`idMensajeSinConfirmar`, core). Con `waiting`/`timeout` el envío ya lo aceptó el servidor.
- Cableado en el chat y en Soporte (el prototipo la muestra también en `#s-soporte`).

**(e) Enmienda — FUERA-DE-REFERENCIA, con la cita de planificación.** «Sin avatar ISO del asistente» declara
ausente algo que el prototipo **tampoco tiene**: la clase `avatar` existe sólo en el `header` (`index.html:1616`
y `:1643`) y es la **M del usuario** con su punto de notificación (el acceso a Mi cuenta). Las burbujas
(`mio` / `suyo`) no llevan avatar. Verificado de nuevo acá, con control positivo (los dos `header`). No se
implementa; un avatar del asistente sería diseño nuevo y va al backlog.

**Probado** — `horaMensaje.test.ts` (6), `ListaMensajes.test.tsx` (6 de «recibido», incluido el re-render en el
que **sólo** cambia `sendStatus`), `ChatView.test.tsx` (3, la costura con el `useChat` real) y
`PantallaSoporte.test.tsx` (1). Mutantes F1-F9 muertos, 9/9; F5 (la fila no depende de `sendStatus`) lo
dejaba pasar un `onChoice` nuevo por render y se corrigió el test.
**Sobrevive F11** («el usuario deja de ser burbuja si trae card»): es **equivalente** — un mensaje del usuario
no lleva `card` por contrato, así que no hay entrada que lo distinga.

**[sin ver en device]** El tamaño y el color de la meta contra el glass, y que no choque con el chip «Por voz».


---

## Dependencias (⛓️) — lo que NO cierra frontend

| contrato | filas | qué falta | dueño |
|---|---|---|---|
| ~~**`mic-facturacion`** — mic/composer dentro de `PantallaFacturacion` (≠ fila `fact-voz`, ya resuelta en `2b43e5a3`)~~ | ~~5, 6~~ | **una decisión, no sólo una forma**: backend excluyó `factura` del dictado por destino a propósito (`dictado_destinos.py:43-44`, emitir es irreversible). Qué hace el mic en Facturación sin precargar un borrador | — **enmienda fundada (MICFACTENM, 2026-10-13)**: planificación la concedió; las filas 5 y 6 pasaron a 📝. Sólo vuelve a ⛓️ si el operador reabre la exclusión |
| ~~**Extracción de campos por destino al dictar desde una función**~~ | ~~7, 10, 12, 13, 14~~ | **RESUELTA**: backend #1050 (`kind=dictado:<destino>`) + app #1065 (`useDictadoPorFuncion`). Es la variante «(b) rutear al chat con un hint» y el turno no toca el hilo (`useDictadoPorFuncion.ts:70-72`) | — |
| **F1.4** — predicado único de facturado | 6 | sólo para saber que la cifra va a cambiar | backend (en curso) |

## Pedidos que salen de este bloque

1. ~~**Copy de botones** de los formularios que reusan las cards~~ → **hecho** (#1056).
2. **Web gemela del onboarding** (`apps/copiloto-web/.../Onboarding.tsx:23,146`): el copy de Google
   cambió acá y la web dice otra cosa.
3. **Formato de duración en la web:** `Por voz · Ns` vs `m:ss` — si el prototipo manda, la web también.
4. **«Con movimiento» en la web** (`ClientesScreen.tsx:290`): rotula una lista alfabética con una afirmación
   que nadie midió. O se retira hasta `CLIENTMOV`, o se ordena por movimiento. (`clientes` #2.)
5. **«✓✓ recibido» sin condición en la web** (`Bubble.tsx:63`): lo pinta aun con el envío fallido. La regla ya
   está en el core (`idMensajeSinConfirmar`); la web puede consumirla. (`fact-voz` d.)

## Qué NO verifiqué (explícito)

- **Nada en teléfono.** Los gestos, el aspecto del check SVG, el wrap de las líneas de detalle y el
  tamaño del chip son `[sin ver en device]`.
- **El resumen de Facturación contra datos reales:** el test usa un mock de `leerPortada`. No corrí la
  pantalla contra el backend.
- **El chip «Mandalo por mail» con un Doc real:** el test prueba que abre un `mailto:` con el link; no
  que el cliente de mail del teléfono lo reciba bien.
- **Las filas 17-21 (BLOQUENATIVO5), nada en teléfono.** El movimiento real del panel al sembrar el aviso,
  la columna derecha de `TarjetaCliente` en pantalla angosta, la hora del kv «Se cayó» y la meta «recibido»
  contra el glass son `[sin ver en device]`. El device tiene dueño único y no es esta sesión.
- **`hitl`: el «Editar» de la card** — no lo midió nadie. Y el alcance de (b) es **un servicio piloto (Gmail)**,
  aceptado por C-D3.
- **`tsc` de todo el paquete:** el junction a `@copiloto/core` del worktree está desactualizado y da
  errores en archivos que no toqué (`acciones`, `alertaDobleEmision`, `idemKey`). Filtrado a mis
  archivos no hay errores nuevos; la verificación formal es `scripts/gate.sh`.
