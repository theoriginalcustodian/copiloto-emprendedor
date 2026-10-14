# Veredicto de las 6 filas `backend + nativa` — medido sobre el árbol, no sobre los `cierre_` (backend)

**Fecha:** 2026-10-13 · **Mapeo de origen:** [`2026-10-12-mapeo-prototipo-vs-nativo.md`](2026-10-12-mapeo-prototipo-vs-nativo.md)
(filas `caida` l.55 · `clientes` l.62 · `cobro-voz` l.63 · `fact-voz` l.72 · `hitl` l.78 · `preg` l.85) ·
**DoD:** [`2026-10-12-contratos-del-mapeo.md`](2026-10-12-contratos-del-mapeo.md) §`backend + nativa` ·
**Árbol medido:** `origin/main` @ `159f883b` (worktree limpio) · **Rama:** `backend/evidencia-buzon-6-filas`

> Documento hermano de [`2026-10-13-veredicto-bloque-chat-frontend1.md`](2026-10-13-veredicto-bloque-chat-frontend1.md) y de
> [`2026-10-13-veredicto-onb-cumplida-chat-frontend1.md`](2026-10-13-veredicto-onb-cumplida-chat-frontend1.md): mismo formato, mismos
> estados. El nombre lleva `chat` porque el medidor asigna cada doc a un brazo por el nombre
> (`scripts/evidencia/medir-mapeo-implementacion.py`, `corpus()`) y los encabezados `### N · \`id\` — …` son el formato de ese brazo.

## Por qué existe este doc

Las 6 filas salían `FUERA-DE-ESTE-CORPUS` porque su única evidencia eran `cierre_` del buzón, que **no está versionado**
(deuda `EVIDENCIABUZON`). Acá se reemplazan por **símbolos del código** (`archivo:línea`) medidos hoy sobre `origin/main`.

**Y la medición cambió la respuesta, que es lo que vale:** un `cierre_` de backend dice «mi lado está en main y desplegado»;
la fila dice «la divergencia entre el prototipo y la **pantalla nativa**». Son dos preguntas. En **5 de las 6** la mitad de
backend está en main y la mitad de app **no** (o nadie dio veredicto). Esas 5 **no** se marcan cerradas acá: se les nombra el
símbolo exacto que falta y quién lo tiene. Sólo una cierra.

## Cómo leer esto

| estado | qué significa |
|---|---|
| ✅ **CERRADA-EN-CODIGO** | la divergencia existe resuelta en el código con `path:línea` y un test que la ejercita |
| 📝 **ENMIENDA-FUNDADA** | la divergencia se **mantiene a propósito**, con el motivo escrito. Reabrible por el operador |
| ⚠ **ABIERTA** | al menos una divergencia **sin código y sin enmienda con motivo**. El encabezado de la fila lleva `⚠`: el medidor (desde #1086) la cuenta como `PENDIENTE-DECLARADA`, fuera del DoD y con su id nombrado |

**Nivel de verificación de TODO lo de abajo:** presencia de los símbolos en `origin/main` @ `159f883b` + los tests que los ejercitan
**existen** y viajaron en PR con CI verde (procedencia en cada `cierre_`). **No corrí jest ni la suite acá**, y **nada fue visto en un
teléfono**. Lo que sólo se vería en device queda anotado *«[sin ver en device]»*. Cada «0 hits» de ausencia lleva su control positivo
(la misma búsqueda sobre algo que sí existe), porque un grep vacío sin control no distingue «no está» de «busqué mal».

## Resumen

| # | fila | veredicto | lo que cierra / lo que falta | de quién es lo que falta |
|---|---|---|---|---|
| 1 | `preg` | ✅ + 📝 **CIERRA** | card `datos_negocio` pintada en mobile y web; la promo masiva es enmienda (BACKLOG/MAYOR) | — |
| 2 | `caida` | ✅ CERRADA-EN-CODIGO (sin desplegar) | el kv «Se cayó · hora» lo emite el presentador de backend (`11ce79ae`, #1124); #3-#5 de `PortadaNegocio` con veredicto de frontend2 en la tabla de abajo | falta deploy y device (frontend2) |
| 3 | `clientes` | ABIERTA | backend + core + **web** pintan el monto; **mobile no** (0 hits) y 4 divergencias sin veredicto | frontend1 (mobile) |
| 4 | `cobro-voz` | ABIERTA — casi | 6 de 7 divergencias con veredicto; falta **una**: la card reemplaza a la burbuja y no hay motivo escrito | frontend1 (`card-cobro`) |
| 5 | `fact-voz` | ABIERTA | backend + marca `del_registro` en ambas apps; **meta «✓✓ recibido» (mobile 0) y avatar ISO sin veredicto de nadie** | frontend1 / planificación |
| 6 | `hitl` | ABIERTA | (b) `detalle` + `recibo` en main, piloto Gmail; **(a) el puente tarjeta→chat no existe** (0 hits) | frontend (Opción A, 0 backend) |

**Cuenta honesta:** 6 filas · **1 cierra en código** (`preg`) · 5 abiertas, todas con la mitad backend ya en main. Medido con el
medidor de #1086 (`aea3a81f`) sobre `439c1c4c` + este doc: `CUMPLE EL DoD 28/54`, las 5 abiertas en `PENDIENTE DECLARADA` con su id
nombrado y `preg` en `CERRADA-EN-CODIGO`. **Es un movimiento chico y es el verdadero**: cualquier cifra más alta saldría de contar la
mitad de backend como la fila entera (el medidor anterior, sobre el mismo árbol, daba `40/54`: contaba las 5 como cumplidas).

> **Actualización 2026-10-13 (BLOQUENATIVO5, frontend1).** Las 5 filas abiertas de arriba eran abiertas **por la mitad
> app**, y esa mitad cerró: puente de `hitl`, monto de `clientes` en mobile, `datos.desde` de `caida`, meta «✓✓ recibido»
> de `fact-voz` y el motivo de `cobro-voz` #5. Los veredictos con `path:línea` están en [`2026-10-13-veredicto-bloque-chat-frontend1.md`](2026-10-13-veredicto-bloque-chat-frontend1.md) (filas 17-21). El cuerpo de
> cada fila de abajo **se conserva tal como se midió el 2026-10-13 @ `159f883b`** (es la historia de qué faltaba); lo que
> cambió son los **encabezados** y esta columna, que son lo que el medidor lee. El medidor une los símbolos de todos los
> docs del brazo, así que mientras acá quedara un `⚠` la fila seguía `PENDIENTE-DECLARADA` aunque el otro doc la resolviera.

---

## Fila por fila

### 1 · `preg` — ✅ + 📝

Una fila, dos divergencias (mapeo l.85). DoD: *«La pantalla EXISTE y se llega a ella navegando; el id `preg` del prototipo tiene
contraparte con `path:línea`. Escrita-e-inalcanzable NO cuenta.»*

#### #1 · la respuesta con card de datos no tiene componente (llegaría como texto plano) — ✅ CERRADA-EN-CODIGO

| capa | símbolo | test |
|---|---|---|
| backend, emite | `apps/copiloto/datos_card.py:35` (`KIND = "datos_negocio"`) · tool de LECTURA sin gate `apps/copiloto/tool_catalog.py:1006` (`_run_consultar_negocio`) | `apps/copiloto/tests/test_datos_card.py` (25, incl. adversarial multitenant) |
| core, parser | `packages/core/src/chat/datosNegocio.ts:49` (`leerDatosNegocio`) | `packages/core/src/chat/datosNegocio.test.ts:39` |
| mobile, pinta | `apps/mobile/src/modules/chat/TarjetaDatosNegocio.tsx:30` montada en `ListaMensajes.tsx:391` | `ListaMensajes.test.tsx:518` |
| web, pinta | `apps/copiloto-web/src/modules/chat/ArtifactView.tsx:29` | `ArtifactView.test.tsx:72` |

**Alcanzable navegando:** no es una pantalla propia, es la **respuesta del hilo**: se llega escribiendo o dictando en el composer
(`apps/mobile/src/modules/chat/Composer.tsx:186`). Antes del parser un `kind` desconocido llegaba como texto plano (así lo declara el
`cierre_` C-D5): lo que prueba que ya no cae ahí es `ListaMensajes.test.tsx:518` («pinta el texto del agente Y la card con sus
cifras»). *[sin ver en device]*. Procedencia del lado backend: PR #1061 (`beef6359`), con una medición
viva de 4 preguntas contra el LLM real (2 con card, 2 sin card y sin inventar) en el `cierre_` C-D5.

#### #2 · tampoco existe la capacidad «promo masiva a clientes» que el hilo supone — 📝 ENMIENDA-FUNDADA

**Motivo (C-D5, decidido por planificación):** `preg-promo` es un **envío irreversible a terceros** desde el Gmail del emprendedor,
y el acceso Composio a ese Gmail es total, incluido borrado: no se le hereda a un flujo masivo sin diseño de permisos. Y «4 ya
volvieron a comprar» por ventana de fechas sería una **cifra causal fabricada**: se leería como atribución y no lo es.
**Control de ausencia:** `[Pp]romo` en `apps/mobile/src` + `apps/mobile/app` + `apps/copiloto-web/src` → **0**; control positivo, la
misma búsqueda con `[Pp]resupuesto` → **287**.
**Reabrible, y es del operador:** MAYOR. Con diseño de permisos y contrato primero.

---

### 2 · `caida` — ✅ CERRADA-EN-CODIGO en `main` `11ce79ae` (la #2 la cerró el presentador de backend; **sin desplegar**: prod = `47c09040`; #3-#5 con el veredicto de frontend2 ya en la tabla)

DoD: *«El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:línea`, y se ve.»*

| # | divergencia (mapeo l.55) | estado | evidencia |
|---|---|---|---|
| 1 | cierre de la tarjeta: «Te aviso apenas vuelva» vs «Reconectala y sigo» | 📝 enmienda (gana el backend; se corrige el prototipo) | `apps/copiloto/mi_dia_orquestador.py:61`. «Te aviso» promete un push que se mide en **0**: `ExponentPushToken\|expo_push\|webpush\|send_push\|notificacion_push` sobre `motor/` + `apps/` → **0** (control: `create_payment_link` aparece en 7 archivos, así que el instrumento miraba donde debía). La tarjeta se cierra sola por el HECHO |
| 2 | kv «Se cayó · hora» | ✅ **CERRADA-EN-CODIGO** (`11ce79ae`, PR #1124; **no desplegada**) | **La cerró el presentador de backend, no la app** (corrige «dueño de Mi día» de la versión anterior de esta celda): `apps/copiloto/mi_dia_presentacion.py:283-290` (`se_cayo = _momento_texto(desde, hoy) if desde else None` → `_kv(("Servicio", nombre), ("Se cayó", se_cayo))`); la app ya pinta `presentacion.kv` genéricamente (`apps/mobile/src/modules/midia/PantallaMiDia.tsx:707`), así que **no se tocó** y así es correcto (H12/DETALLEKV: la app no arma la tabla regla→campo). El instante sigue viniendo de `apps/copiloto/mi_dia_detector.py:290` (`datos["desde"]` sólo con instante real; hoy sólo MercadoPago, ausente en Composio ⇒ **sin fila**, nunca `creada`). Tests de las DOS ramas: `apps/copiloto/tests/test_mi_dia_presentacion.py` (`…con_instante_real…` y `…SIN_instante_real…`) con control positivo (2 mutantes, 1 y 2 rojos). **Lo que NO está medido:** device ni deploy — `/healthz` = `47c09040`, anterior al merge |
| 3 | rótulo «En caja» vs «Entró esta semana» | 📝 enmienda **E10** (frontend2) | «En caja» se mantiene con el aviso de faltante: la cifra es `portada.caja.saldo`, un saldo al corte, y «Entró esta semana» nombra otra cantidad (ya es la celda «Entró» del trío). `PortadaNegocio.tsx:37-45` (mobile) · `caja.ts:55,62-71`. Motivo y punto discutible en `docs/copiloto-emprendedor/2026-10-13-veredicto-caida-cascara-portada-fe2.md` §2 |
| 4 | copy del aviso de la portada distinto | 🔁 duplicada (frontend2) | sin residuo propio: las tres piezas del prototipo (`index.html:3657-3659`) tienen dueño — «Te aviso» = #1, «Se cayó · hora» = #2, «Reconectá Mercado Pago» = `AVISO_CAJA_INCOMPLETA` (`caja.ts:62-71`). `docs/copiloto-emprendedor/2026-10-13-veredicto-caida-cascara-portada-fe2.md` §1 |
| 5 | el chip pierde la variación y conserva la fecha de corte | ✅ resuelta en código (frontend2) | `packages/core/src/midia/caja.ts:55` (`incompleta === true ? null : …`) + test `caja.test.ts:59` (devuelve «Al 19 de agosto» sin variación). `docs/copiloto-emprendedor/2026-10-13-veredicto-caida-cascara-portada-fe2.md` §1 |

**Qué falta, con dueño:** (2) **desplegar** (comparte el bloqueo del deploy; dueño: operador/regla Bash) y medir en device (frontend2). Lo de código está en `main` y probado en ambas ramas; (3)(4)(5) ya no tienen deuda documental.

---

### 3 · `clientes` — ✅ + 📝 (cerrada por BLOQUENATIVO5, 2026-10-13: mobile pinta el monto; ver fila 18 del doc de frontend1)

DoD: *«Cada divergencia listada en la fila queda resuelta en el código, o declarada enmienda fundada con su motivo escrito.
Ninguna queda sin veredicto.»* El mapeo apunta a **mobile** (`PantallaClientes.tsx:299`, `TarjetaCliente.tsx:38`).

| # | divergencia (mapeo l.62) | estado | evidencia |
|---|---|---|---|
| 1 | columna derecha: monto vendido · «N comprobantes» · «Todavía sin comprar» | **ABIERTA en mobile** | backend ✅ `apps/copiloto/cliente_store.py:310-319` (`monto_facturado` string decimal + `facturas_atribuibles` bool), predicado ÚNICO `apps/copiloto/afip_rules.py:75,81` consumido por conteo y monto (`cliente_store.py:15,48,57,74`, C-D4). core ✅ `packages/core/src/api/clientes.ts:112-139` y regla `facturacionDeCliente` `:164`. **web ✅** `apps/copiloto-web/src/modules/clientes/TarjetaCliente.tsx:34-53,103`. **mobile ✗:** `montoFacturado\|facturacionDeCliente` en `apps/mobile/src` → **0**; control positivo, el mismo patrón en `apps/copiloto-web/src` → **5** |
| 2 | sin sección «Con movimiento» | **sin veredicto en mobile** | C-D1 decidió que el servidor NO ordena por movimiento (deuda `CLIENTMOV`, disparador: el primer tenant que pase `LIMITE_LISTADO_MAX`); el seccionado es del cliente. `PantallaClientes.tsx` no lo implementa ni lo enmienda |
| 3 | el subtítulo omite la condición IVA | **sin veredicto** | `TarjetaCliente.tsx` (mobile) documenta por qué el subtítulo cae al primer dato identificatorio; **no** habla del IVA |
| 4 | «Nuevo cliente» es botón primario vs link | **sin veredicto** | `PantallaClientes.tsx:339` (`variante: 'primario'`) |
| 5 | campo «Buscar» visible vs inputbar | **sin veredicto** | `PantallaClientes.tsx:381` |
| 6 | `BloqueCifra` «Le vendiste a» y chip «N se agregaron solos» **sí** existen | ✅ | `PantallaClientes.tsx:312-321` |

⚠️ **Una cita a corregir en el buzón:** el `cierre_` de frontend1 (`C-D1/C-D4 lado app`, #1079) dice que mobile no pinta el monto por una
*«decisión documentada en su docstring»*. Leí el docstring de `apps/mobile/src/modules/clientes/TarjetaCliente.tsx` (l.8-31): habla del
documento, del subtítulo y de `origen: 'derivado'`; **no menciona el slot de monto**. La decisión puede existir en otro lado; en el código
mobile hoy no está escrita.

**Qué falta, con dueño:** frontend1 — pintar el monto en mobile con `facturacionDeCliente` (la regla ya está en el core) **o** declarar
la enmienda con su motivo; y un veredicto de las divergencias 2-5.

---

### 4 · `cobro-voz` — 📝 (cerrada por BLOQUENATIVO5, 2026-10-13: la #5 es enmienda fundada; ver fila 20 del doc de frontend1)

DoD: *«Cada divergencia listada en la fila queda resuelta en el código, o declarada enmienda fundada con su motivo escrito.»*
Archivo de la fila: `apps/mobile/src/modules/chat/TarjetaLinkDeCobro.tsx:28`.

| # | divergencia (mapeo l.63) | estado | evidencia |
|---|---|---|---|
| 1 | Tile «Link de cobro listo» + monto + concepto + Compartir/Abrir | ✅ | `TarjetaLinkDeCobro.tsx:62-109` (`:67` título, `:74` monto, `:79` concepto, `:89` Compartir, `:101` Abrir) |
| 2 | sin línea «Mercado Pago · Lorena» | 📝 | el contrato del artifact es `{url, amount, concept}` (`TarjetaLinkDeCobro.tsx:20`, `apps/copiloto/tool_catalog.py:669,686`): **no hay campo con el destinatario**; pintarlo sería inventarlo. Reabre con contrato |
| 3 | sin «vence en 7 días» | 📝 | `motor/clients/agent/providers/mercadopago_gateway.py:86-96` arma la preference **sin** expiración; `expiration_date_to\|"expires"\|expires=\|expiration_date` (excluidas las OAuth `expires_at/in`) sobre `motor/` + `apps/copiloto/` → **0** (control: `create_payment_link` en 7 archivos). **El link no vence**: la frase sería falsa. ⚠️ **Reabre si el operador decide D3 («¿el link vence?»)**: baja contrato con `artifact.data.expira_at` y se pinta LEYENDO ese campo |
| 4 | sin «Copiar» | 📝 | `TarjetaLinkDeCobro.tsx:15-18`: Compartir abre la hoja nativa, que ya trae «Copiar»; un botón propio exige `expo-clipboard`, dependencia nativa congelada (MAYOR) |
| 5 | la tarjeta REEMPLAZA la burbuja del asistente (el texto no se pinta) | **SIN VEREDICTO** | `apps/mobile/src/modules/chat/ListaMensajes.tsx:377-380` devuelve sólo la card. Ni está pintado el texto ni hay un motivo escrito de por qué no |
| 6 | chips WhatsApp / mail sin código nativo | ✅ | `TarjetaLinkDeCobro.tsx:89` («Compartilo por WhatsApp»), `:95` («Mandalo por mail», `mailtoLinkDeCobro` `:41`); los deriva el cliente de `artifact.kind == "payment_link"` (`choices=None`, `motor/backend/agent/conversation_workflow.py:746,761,766`) |
| 7 | «cuando pague te aviso» | 📝 | 0 push (control arriba). Se sustituye por `NOTA_ANOTA_AL_APROBAR` (`:38`), **cierta**: `apps/copiloto/mp_web.py:55-56` sólo anota `approved`. `AVISOCOBRO` queda en backlog; disparador: que exista cualquier mecanismo de notificación |

**Lado backend, además:** el LLM no puede prometer vencimiento ni aviso — `apps/copiloto/tool_catalog.py:117` (descripción de `mp_charge`),
`apps/copiloto/system_prompt.py:51` (prompt ReAct), y los tests `apps/copiloto/tests/test_cobro_sin_promesas.py:53,56,61`, con 3 mutantes
rojos cada uno por su causa (cierre #1047). **Límite declarado:** la suite usa un LLM guionado; mide que la prohibición *llega* al
modelo y que la *tool* no promete, no que un modelo real obedezca.

**Qué falta, con dueño:** la #5, de frontend1 (`card-cobro`): o pinta el texto del asistente junto a la card, o declara la enmienda con
motivo (p. ej. «el texto duplicaría monto y concepto que la card ya muestra»). **Yo no la declaro**: es una decisión de UX y no
tengo evidencia de por qué se hizo así. Con esa línea, la fila cierra.

---

### 5 · `fact-voz` — ✅ + 📝 (cerrada por BLOQUENATIVO5, 2026-10-13: (d) implementada, (e) fuera de referencia; ver fila 21 del doc de frontend1)

DoD: *«El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:línea`, y se ve.»*

El mapeo (l.72) **reformuló** la fila el 2026-10-13: las tres divergencias del RESUELTO — (a) el prototipo pregunta dos cosas juntas, (b) «¿es
factura C?», (c) «el CUIT del registro que tengo» — caen por contrato del hito 9. **Pero las dos que la fila declaraba originalmente (la
meta «✓✓ recibido» y el avatar ISO) no aparecen en esa resolución.**

| # | divergencia | estado | evidencia |
|---|---|---|---|
| a | el prototipo pregunta dos cosas juntas | 📝 gana el contrato | `apps/copiloto/tool_catalog.py:305-312`: «NO le preguntes al usuario por un campo que este schema no marca como "required" antes de llamarla … la tool está hecha para invocación parcial». Los faltantes viven en la card HITL (`:1536`, `:1562`) |
| b | «¿es factura C?» no debe existir como pregunta | ✅ | `determinar_tipo_comprobante(perfil, receptor)` en `tool_catalog.py:1544`; el tipo viaja en la card |
| c | lookup del CUIT del registro | ✅ | backend: `tool_catalog.py:1358` (`_cliente_del_registro`), uso `:1477`, marca `del_registro` `:1562-1569`; tests ADVERSARIALES `apps/copiloto/tests/test_facturar_cliente_del_registro.py:197` (dos clientes que matchean ⇒ **no** precarga) y `:222` (el cliente de B no entra en la factura de A). Apps: core `packages/core/src/chat/facturaPropuesta.ts:40,117`; web `TarjetaFacturaPropuesta.tsx:172,196`; mobile `TarjetaFacturaPropuesta.tsx:182,220` |
| d | sin meta «10:12 · por voz ✓✓ recibido» | **SIN VEREDICTO** | `recibido\|✓✓` en `apps/mobile/src` → **0**. Existe en **web** (`apps/copiloto-web/src/modules/chat/Bubble.tsx:63`); control positivo del patrón. El chip «Por voz» sí existe (17 hits) |
| e | sin avatar ISO del asistente | **SIN VEREDICTO** | no medido por nadie; no es de backend |

**Qué falta, con dueño:** (d) y (e) — un veredicto de frontend1 o la decisión de planificación de que quedan fuera de la fila. **Hasta
entonces la fila no cierra**, aunque lo que sí estaba decidido (a-c) esté en main.

---

### 6 · `hitl` — ✅ + 📝 (cerrada por BLOQUENATIVO5, 2026-10-13: el puente tarjeta → chat existe; ver fila 17 del doc de frontend1)

DoD: *«El elemento que la fila declara ausente existe en la pantalla que ya existe, con `path:línea`, y se ve.»* El mapeo (l.78) declara
**ausente** el puente tarjeta→chat.

| # | divergencia | estado | evidencia |
|---|---|---|---|
| a | NO EXISTE el puente tarjeta→chat («Escribirle» · ctx-chip «Desde tu aviso» · «Volver al tablero») | **ABIERTA** | `Escribirle\|Desde tu aviso\|Volver al tablero` en `apps/mobile/src` + `apps/mobile/app` + `apps/copiloto-web/src` + `packages/core/src` → **0**; control positivo, `Volver` → **120**. ⚠️ **Corregido 2026-10-13 (la cita anterior `:707-714` era rancia: ese rango es el cálculo del `detalle`/kv, no el verbo):** el mecanismo pulsable **YA EXISTE** — la acción del detalle expandido es un `Pressable` (`apps/mobile/src/modules/midia/PantallaMiDia.tsx:802-820`) y el `Text` del `verbo` es sólo el degradado cuando `accion == null` (`:821-828`). **No hay que construir otro botón.** Lo que falta es el **vocabulario de destino**: `rutaDeDestino` (`apps/mobile/src/modules/midia/destinoTarjeta.ts:17-24`) sólo conoce `conexion`; el backend ya emite `comprobante`/`presupuesto`/`trabajo`/`certificado` (`TIPOS_DESTINO_ACCION`, `apps/copiloto/mi_dia_presentacion.py:59-61`) y la app los trata como «no sé a dónde llevarte» ⇒ `rutaAccion == null` ⇒ la píldora queda **deshabilitada** (`:717`, `disabled={rutaAccion == null || …}`). No existe un destino «chat»: es contrato nuevo (enmienda del enum cerrado de H5B), ver `PUENTEDESTINO` en `PLAN.md`. C-D5 decidió **Opción A** (texto sembrado, 0 backend); **no está implementada** |
| b | la card genérica muestra `gate.markdown` como texto plano, sin kv ni «Editar», y sin recibo al responder | ✅ (piloto Gmail) | backend: `apps/copiloto/hitl_card.py:79,85` (`detalle_de`, `recibo_de`), cableado `tool_catalog.py:1763,1770`, a la card `motor/backend/agent/conversation_workflow.py:667-668`. core: `packages/core/src/chat/detalleGate.ts:59`, `reciboCard.ts:25`. mobile: `ListaMensajes.tsx:83-130` (`DetalleConfirmacion`), `:216`, recibo `:407-420`. test de que el `detalle` GANA sobre la regex: `packages/core/src/chat/hitl.test.ts:67`, `apps/copiloto-web/src/modules/chat/hitlMapping.test.ts:289` |
| b.bis | el «Editar» por campo de la card (prototipo `index.html:2757`, `:357`) | 📝 **FUERA-DE-FILA** → ítem `EDITARMUERTO` (`PLAN.md`) | no es de esta fila ni se cuenta como resuelta ni enmendada: `editable` es un campo de contrato **muerto en las 3 capas** (backend lo escribe `False` en `hitl_card.py:52-53`; core lo parsea estricto en `detalleGate.ts:29-30`; mobile y web no lo leen). Medición completa en el contrato `…hitl-el-puente-son-CINCO-pasos…` §5. Sin dueño asignado |

> **a.5 — la tarjeta de origen queda `hecha` al volver (frontend2, 2026-10-13): ABIERTA, sin disparador todavía.** El estado y el mecanismo ya existen y **no se crea un cuarto**: `cambiarEstadoTarjetaMiDia(id, 'hecha')` (`packages/core/src/api/miDia.ts:259`) persiste en el backend, que acepta cualquier transición válida (`mi_dia_tarjeta_store.py:135`), y una `hecha` no vuelve a alertar ni a ofrecerse (`filtroTablero.ts:48`, test `filtroTablero.test.ts:38`) ni tras un remount, porque la fuente de verdad es el servidor. `tarjeta_resuelta` (`chatMachine.ts:200,358`) **no sirve** para esto: pisa un flag local de un *mensaje de chat* (`*Resuelto`), no el estado de una tarjeta de Mi día. Lo que falta es **quién dispara**: el «volver» (a.4, frontend1) y el origen que viaja al chat (`PUENTEDESTINO`, operador) no existen; cablear la llamada hoy sería código inalcanzable.

**Alcance honesto de (b):** un solo servicio piloto (Gmail), por condición de C-D3; los otros cuatro caen al texto plano de antes. El
«Editar» de la card no lo medí.

**Qué falta, con dueño:** (a) — frontend, Opción A. **Cero backend.** Es la única de las 5 abiertas cuyo faltante es una **capacidad**
(el puente), no un veredicto; por eso es la que más pesa.

---

## Hallazgos que salen de esta medición

1. **Un `cierre_` de backend no cierra una fila `backend + nativa`.** 5 de 6 tienen «EN MAIN y DESPLEGADO» de backend y la pantalla sin
   cerrar. Las acreditaciones del buzón eran ciertas **de su mitad**; leerlas como la fila entera es lo que sobre-contaba.
2. **El medidor contaba `⛓` y `⚠` como `ENMIENDA-FUNDADA`** (`medir-mapeo-implementacion.py`, `clasificar()`: `"✅" in s` ⇒ CERRADA,
   cualquier otro símbolo ⇒ ENMIENDA; y un `✅` ganaba sobre el `⛓` de otra divergencia de la misma fila). Una fila con `⚠`
   («pendiente») cumplía el DoD para el medidor. Por eso, al medir sobre `439c1c4c`, estas 5 se dejaron **sin símbolo**: ponerles
   `⚠` las habría hecho «cumplir». Era una debilidad del instrumento, no de este doc; la corrigió planificación en #1086
   (clase `PENDIENTE-DECLARADA`: un `⛓`/`⚠` manda sobre el `✅` de las demás, no suma al DoD y nombra el id). Desde ahí las 5
   llevan `⚠`. **Sin #1086 en el medidor, ese `⚠` cuenta como cumplida.**
3. **`fact-voz` perdió dos divergencias en una reformulación**: el mapeo cambió de tres a otras tres sin dar veredicto a las dos
   originales. Un renglón reescrito puede borrar divergencias sin que ningún gate lo vea.

## Reproducir

```bash
# desde un árbol con este doc (CWD = raíz medida; la salida imprime ARBOL MEDIDO)
python scripts/evidencia/medir-mapeo-implementacion.py
# esperado (medidor con la clase PENDIENTE-DECLARADA, #1086): las 5 abiertas en PENDIENTE DECLARADA; `preg` y `onb-cumplida` en
# CERRADA-EN-CODIGO. La cifra global se cita SIEMPRE con su ARBOL MEDIDO y su SHA, nunca sola: cambia con cada doc que entra.
python scripts/evidencia/medir-mapeo-implementacion.py --canario   # cada brazo roto mueve la métrica
```

## Lo que NO está verificado

- Nada visto en teléfono ni contra el agente real (salvo la medición viva de `preg-datos` que cita el `cierre_` C-D5, no re-corrida hoy).
- No corrí jest ni la suite backend para este doc: los tests se citan por **existencia y procedencia**, no por una corrida de hoy.
- Las divergencias 3-5 de `caida` y 2-5 de `clientes` las leí por su símbolo en el árbol; no re-derivé qué dice el prototipo.
