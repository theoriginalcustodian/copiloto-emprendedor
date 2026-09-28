# Contrato BL-Q3 v2 — la unidad de medición es **(id, camino)**, no el id

**Fecha:** 2026-09-28 · **Emite:** planificación · **Reemplaza:** el contrato de BL-Q3 v1 en todo lo
que se refiere a *qué* se mide. Los criterios de veredicto (COHERENTE / DESVÍO / NO_MEDIBLE) no cambian.

---

## 0. Por qué existe este v2 — el defecto es del contrato, no de quien midió

El v1 nombraba la **pantalla** (un id, p. ej. `factura`) y nada más. Cuando un id es alcanzable por
dos caminos que muestran **UI distinta**, dos mediciones contradictorias son **ambas válidas contra el
contrato**, y ningún gate puede decidir entre ellas. Eso no es un error de ejecución de FE1, FE2 ni
auditoría: es un contrato que no especifica su sujeto.

Se midió el alcance en vez de suponerlo (barrido read-only con tres controles positivos reproducidos,
`Auditorias/2026-09-28-barrido-caminos-de-acceso-de-los-54-ids.md`):

| clasificación | ids |
|---|---|
| CAMINO-UNICO | **19** |
| MULTI-PATH-UI-DISTINTA | **16** (uno latente) |
| MISMA-UI (varios accesos, misma pantalla) | el resto |

No eran «4 filas más `factura`». **Son 16.**

## 1. La regla, en una línea

> **Una fila de la matriz es un par (id, camino). Si un id tiene dos caminos con UI distinta, son dos
> filas, no una — y cada una declara su estado inicial.**

Y su consecuencia operativa:

> **Se mide el camino que el prototipo dibuja.** Si el prototipo dibuja dos, se miden los dos. Si el
> prototipo dibuja uno y la app tiene tres, se mide **ese** y los otros dos se declaran
> `FUERA-DE-REFERENCIA` — no son un desvío, son pantallas sin contraparte en el prototipo.

## 2. Campos obligatorios por fila

Ninguno es opcional. Una fila sin los cinco no se puede cerrar:

1. **`id`**
2. **`camino`** — el punto de entrada exacto, con `path:línea`. No «desde Ajustes»: `AjustesScreen.tsx:73`.
3. **`estado_inicial`** — qué tiene que haber en pantalla al llegar (vacío / precargado / con id / con
   la card armada). Es lo que hacía indistinguibles las lecturas de `card-presu`.
4. **`referencia_prototipo`** — qué dibuja el prototipo para *ese* camino, con línea de `index.html`.
5. **`plataforma`** — web / mobile / ambas. Varios ids divergen sólo en mobile.

## 3. Las 16 filas MULTI-PATH-UI-DISTINTA — cómo se parten

| id | caminos (cada uno es una fila) | estado inicial de cada uno |
|---|---|---|
| `card-presu` | «Nuevo presupuesto» `PresupuestosScreen.tsx:285,166-168` · mic de la función `:281,175` · card del chat `TarjetaPresupuestoPropuesto.tsx:98-99` | vacío · un campo precargado · armada. Mismo `FormularioPresupuesto`. Mobile: `PantallaPresupuestos.tsx:234,227` |
| `card-cliente` | «Nuevo cliente» `ClientesScreen.tsx:296,125-127` · mic `:292,134` · card del chat `TarjetaClientePropuesto.tsx:155-156` | ídem. Mobile: `PantallaClientes.tsx:320,313` |
| `card` · `card-cobro` | ídem patrón «+Nuevo» vs card del chat vs mic | ⚠️ en el prototipo `card-*` es la card **dentro de la función** tras dictar (`index.html:2862-2868,3661-3666`) y `card-cobro` es «Nuevo ingreso» (`:2877-2878`) |
| `card-factura` | card del chat `MessageList.tsx:280` · «Nueva factura» `PantallaFacturacion.tsx:483,381` | **no** entra en el patrón anterior: su card no es el formulario (`TarjetaFacturaPropuesta.tsx:1-12`) y Facturación no tiene mic |
| `factura` | sin id → listado `PantallaFacturacion.tsx:127` · desde presupuesto / card del chat → wizard con borrador `AppShell.tsx:140-143,218` · **tercer estado en mobile** | listado · wizard precargado · (mobile) |
| `(vacío)` Mi día | web pestaña por defecto `AppShell.tsx:31,220` · mobile portada `PantallaPrincipal.tsx:183` · ruta `/midia` (`app/midia.tsx:8`) | portada con fecha y avatar (`PantallaMiDia.tsx:517,521`) vs glass «Mi día» **sin** fecha (`:496-501`) |
| `chat` | pestaña `TabBar.tsx:63` · Mi día/Inteligencia `AppShell.tsx:219-220` · buzón de pendientes (`PantallaComoUsarLaApp.tsx:67`, `PreguntarInteligencia.tsx:20`, `AgendaScreen.tsx:98`) | ⚠️ por el buzón **manda un mensaje solo al montar** (`ChatScreen.tsx:69-72`) |
| `ingresar` | directo `EntradaSesion.tsx:32` · «Entrar» del reveal `:44` · «Entrar con otra cuenta» `:45` | `:44` precarga el email de la última sesión; los otros vacío |
| `caida` | Mi día `MidiaScreen.tsx:325-327` · badge en Conexiones | el prototipo lo ubica en **Mi día** |
| `fact-cae` | card del chat `MessageList.tsx:280` · fin del wizard `PantallaFacturacion.tsx:632` · historial `:494-495` | **tres componentes distintos** |
| `pres-voz` | dictado en el chat `MessageList.tsx:274` · mic de Presupuestos `PresupuestosScreen.tsx:281,175` | card armada vs formulario con un campo |
| `comousar` | Ajustes `AjustesScreen.tsx:72` · Mi cuenta `AccountScreen.tsx:166` → `AppShell.tsx:252-254` | con botón «‹ Ajustes» (`:61-67`) vs sin él. Mobile: un solo camino |
| `gastos` · `presu` · `clientes` | pestaña/tile · con id desde Actividad/Escritorio (`AppShell.tsx:213,130-133`, mobile `destinoActividad.ts:64,66,68`) | lista vs ficha/detalle abierto |

## 4. Dos cosas que NO son caminos, y se estaban contando como si lo fueran

- **`pres-hitl` y `card-presu` son dos ids para un solo componente** (`MessageList.tsx:274`). Medirlos
  como dos pantallas duplica trabajo y puede producir dos veredictos distintos del mismo píxel.
- **Hay dos componentes distintos llamados `Recibo`**: el de las 5 cards del chat y el de
  `Onboarding.tsx:101`. Buscar por nombre encuentra el que no es.

## 5. Un hallazgo que no es de medición y necesita dueño

**`/midia` no tiene ningún caller en el código.** Sólo se alcanza por deep link (`copiloto://`,
`app.json:5`). Es una segunda UI del mismo id, inalcanzable navegando. No es un desvío de fidelidad:
es una pantalla viva sin entrada. Va al backlog como fila propia, no a la matriz.

## 6. Qué queda invalidado de lo ya medido, y qué no

Invalidado por comparar otra pantalla: **`card`, `card-presu`, `card-cobro`** (FE1, contra las cards
del chat y el HITL de MP) · **`factura`** (FE1, medido como «form vacío» = comportamiento anterior a
**#644**) · **`caida`** (FE2, medido sobre Conexiones) — y ojo: FE2 midió en vivo contra prod y el testid real hoy es `midia-calendario-no-conectado`, **no** `midia-calendario-caida`: el tenant no está en el estado que la fila necesita (`catalog.py:104,146,153,161` → depende de `composio_caidos`, que resuelve backend). Si sembrar «googlecalendar caído» no se puede sin round-trip real a Composio, la fila se declara **NO_MEDIBLE con esa causa**, no se fuerza · y los ya corregidos por auditoría, `agenda` y
`presu`.

**No invalidado:** todo id CAMINO-UNICO. Los 19 siguen valiendo tal como se midieron —
`esc`, `apar`, `feedback`, `negocio`, `hablar`, `consent`, `onb-promesa`, `onb-cumplida`, `vozchat`,
`hitl`, `cuenta`, `agenda`, `entrada`, `reveal`, `volver`, `cobro-voz`, `fact-hitl`, `fact-voz`,
`pres-hitl`.

## 7. DoD de este contrato

- [ ] La matriz se reemite con una fila por par **(id, camino)** y los 5 campos completos.
- [ ] Las 6 filas invalidadas del §6 se re-miden **declarando el camino**, no antes.
- [ ] `/midia` sin caller entra al backlog como fila propia con dueño.
- [ ] Ningún id CAMINO-UNICO se re-mide: no hay motivo, y re-medirlo es la tercera pasada.

---

## 8. Cuatro correcciones de auditoría (2026-09-28, posteriores a la v2) — una invalida el esquema, no una fila

Lo aportado por auditoría tras medir el **prototipo** (no la app). Aclaración que corrige un error mío:
el multi-camino de este contrato es de `apps/copiloto-web/`; **el prototipo tiene una entrada por id**
(`?ver=<id>`, `index.html:3597`), así que un id multi-camino en la app no explica un fallo en el proto.
Los dos lados se miden distinto y este contrato manda sólo sobre el lado app.

### 8.1 ⚠️ `[data-testid=mic-funcion]` es el MISMO id en cuatro pantallas

Gastos, Ingresos, Presupuestos y Clientes. **Una fila que diga `mic-funcion` no identifica pantalla.**
Esto no es una fila mal medida: es un **agujero del esquema de testids**, y afecta a cualquier fila que
se ancle a ese selector — puede estar fotografiando otra pantalla sin que nada falle. Antes de cerrar
la matriz hay que decidir si los testids se desambiguan por pantalla o si esas filas se anclan a otro
selector. **Sin eso, el `camino` del §2 se declara pero el instrumento no lo verifica.**

### 8.1.bis Medido: **no hay testids duplicados y el gate no está roto** — es un hueco, y es peor

Fui a contar **definiciones, no usos**, y el hallazgo cambia de causa (y por lo tanto de arreglo):

- **`mic-funcion` tiene UNA sola definición en web** (`MicFuncion.tsx:83`) y una en mobile
  (`MicFuncion.tsx:113`). **No son cuatro testids copiados.** Es **un componente reusable**.
- Y se monta en **ocho** archivos en web, no cuatro: `Bubble.tsx`, `ChatScreen.tsx`, `MicButton.tsx`,
  `ClientesScreen.tsx`, `FotoFuncion.tsx`, `GastosScreen.tsx`, `IngresosScreen.tsx`,
  `PresupuestosScreen.tsx`. Una fila anclada a `mic-funcion` puede ser **cualquiera de ocho**.
- **El gate `scripts/ci/testid_paridad.py` no falla: no es su trabajo.** Su propósito es paridad
  web↔mobile por pantalla, y su **propiedad 4** lo dice explícitamente: *«la comparación es POR
  PANTALLA, no un set global: dos ids iguales en pantallas distintas no se dan por buenos entre sí»*.
  O sea que el gate **está diseñado para tolerar** el mismo id en varias pantallas — correctamente,
  para lo suyo.

**Por eso es peor que un gate roto:** un gate roto se arregla. Acá **nadie tiene el trabajo** de
verificar que un testid identifique una sola pantalla, y la propiedad que hace bien su tarea es la
misma que vuelve el problema invisible para la matriz. El hueco vive en la junta entre el gate de
paridad y el contrato de medición, y la junta no tenía dueño.

**Arreglo correcto (no el que sugería «desambiguar los cuatro»):** o el componente recibe el
contexto de pantalla en su testid (`mic-funcion@gastos`), o **la fila se ancla al contenedor de la
pantalla y al mic dentro de él**, nunca al mic solo. Lo segundo no requiere tocar código de app y es
lo que el §2 debería exigir: el campo `camino` con `path:línea` **más** un ancla que no sea ambigua.

### 8.2 `gastos` tiene **cuatro** caras, no dos

La tabla del §3 dice «lista vs ficha» y se queda corta:

1. blanco
2. voz
3. **foto-OCR** (`origen='foto'` + `gasto-monto-sugerido`)
4. **error de foto**, con banner

Cuatro filas, no dos.

### 8.3 `chat` es el peor caso, y el §3 lo subestimaba

Por el Rail arranca **vacío con empty-state**; entrando por el buzón de pendientes **auto-envía** el
mensaje al montar (`ChatScreen.tsx:69-72`) ⇒ burbuja + streaming. **No existe «el chat» sin declarar
camino:** son dos pantallas distintas con el mismo id.

### 8.4 Segunda cara latente: `presupuestoIdInicial`

Está escrito y **ningún shell lo pasa** (`PresupuestosScreen.tsx:62,139-147`). Aparece sola el día que
alguien cablee el prop. Es el **mismo patrón que `/midia` sin caller** (§5), así que ya son dos:

> **Clase nueva: UI escrita e inalcanzable.** No es un desvío de fidelidad ni una fila de la matriz —
> es código vivo sin entrada, que el día que se cablee aparece **sin haber sido medido nunca**.
> Ninguna auditoría de pantallas la encuentra, porque no se llega navegando.

### 8.5 Delta con el barrido: 8 de 31 vs 16 — no es contradicción

El sub-agente de auditoría contó **pantallas** con ≥2 caminos y UI distinta (8 de 31); el barrido de
planificación contó **pares (id, camino)** (16). Distinta granularidad, misma dirección. Se registran
los dos números con su definición al lado; ninguno se promedia.

### 8.6 ⛔ **RETIRADO** — el `waitUntil` NO era la causa; era el **server**. Y «arreglarlo» habría enterrado la causa real

Esta sección pedía cambiar `waitUntil:'load'` en `criterio3-matriz.mjs`. **No lo hagan.** Auditoría lo
midió en tres pasos y cada uno refutó al anterior:

1. **El prototipo está sano.** `MutationObserver` vía `addInitScript` + `pageerror`, 24 cargas:
   **24/24** con la marca puesta, 82-126 ms, **cero errores de JS**, `?ver=` nunca se pierde. Nada que
   arreglar en `index.html`.
2. **La hipótesis del `waitUntil` es falsa, y la mató el brazo de control.** Contra
   `python -m http.server`: `networkidle` 26/32 y `domcontentloaded` **31/32** — el `goto` se colgó
   **también** con `domcontentloaded`. Sin el brazo de control se veía «mejoró de 26 a 31» y se
   cantaba un arreglo falso.
3. **La causa es el server.** Lo delata que **los fallos se mueven de celda en celda entre corridas**
   (B1 vio `apar`/`soporte`/`esc` a desktop; la sonda de tasa, 6 celdas distintas; el A/B,
   `soporte@390` y `esc@desktop`). Id, viewport y prototipo son **fijos** entre intentos; lo único
   compartido que varía es el server. Con un server estático Node y el A/B idéntico: **32/32 en los
   dos `waitUntil`**.

**Arreglado donde vive — la precondición, no el generador:** `correr-criterio3.sh` levanta el server
Node, y si encuentra uno ajeno vivo **le mide la concurrencia** (8 pedidos en paralelo) antes de
confiar. Control positivo en las dos direcciones: contra python 1/8 fallidos ⇒ aborta; contra el
propio 0/8 ⇒ pasa. **Un control que sólo pregunta «¿contesta 200?» no distingue un server que va a
colgarse** — y la sonda de salud anterior lo declaraba sano tres veces por corrida.

> 🧩 **El patrón, que es lo más reutilizable del día:** *un fallo que **cambia de sujeto** entre
> corridas acusa al **recurso compartido**, no al sujeto.* Leer «falló `apar@desktop`» como un hecho
> sobre `apar` costó dos turnos de diagnosticar el prototipo y el timeout del selector, que estaban
> los dos bien.

**Y la lección para este contrato:** yo escribí el §8.6 original a partir de una hipótesis ajena sin
brazo de control, y lo redacté como una instrucción («arreglalo también en el generador»). Una
instrucción en un contrato se ejecuta; una hipótesis se prueba. **No van hipótesis en modo
imperativo.**

---

## §9 — Cuando el id es una PLANTILLA, el camino elige la instancia (y `caida` nunca fue una fila)

FE2 pidió a backend un `googlecalendar` en estado caído para capturar la celda `caida`. Backend midió
la cadena entera con `path:línea` y contestó, correctamente, que **no se puede fabricar**: el status
`EXPIRED` lo decide Composio server-side (`conexiones_salud.py:18-30` filtra `EXPIRED` sin `ACTIVE`
del mismo toolkit; el dato viene del SDK real en `composio_gateway.py:257-277`), y el único método de
escritura del gateway es `revoke()` (`composio_gateway.py:308-309`), que **borra** la conexión —
dejaría `nunca_conectado`, el estado opuesto al que se quiere capturar. Su conclusión fue
`NO_MEDIBLE` con causa, y cerró honestamente con «alternativa NO explorada por mí».

**Esa alternativa era mía de explorar, y el resultado da vuelta la respuesta: `NO_MEDIBLE` es el
veredicto equivocado, porque la pregunta estaba mal formulada.**

### Lo que se midió

1. **El testid es una plantilla, no un id.** `ServiceCard.tsx:119,127,135,183` emite
   `service-card-${service.key}`, `service-card-status-${service.key}`,
   `service-card-description-${service.key}`, `service-card-confirm-${service.key}`. No existe ningún
   id literal `…-googlecalendar` en el código: existe `${service.key}` interpolado.
2. **La rama de `caido` es UNA, y no se ramifica por proveedor.** `ServiceCard.tsx:45` —
   `if (service.status === 'caido') return 'reconnect'`. Una sola comparación, cero condicionales por
   `key`. El proveedor entra en el **id**, nunca en el **comportamiento**.
3. **Hay UNA definición de `ServiceCard`** (`apps/copiloto-web/src/modules/connections/ServiceCard.tsx`);
   el resto de los hits son su test, su css, su `index.ts` y `ConnectionsScreen.tsx` que la monta.
   Contar definiciones y no usos, otra vez, cambia el trabajo.
4. **`caido` SÍ es alcanzable con datos propios, por otra instancia.** `conexiones_salud.py` declara en
   su docstring **una sola definición** del estado para las tres caras que lo muestran (`/catalog`
   `status`, el detector de Mi día, `caja.incompleta` de la portada), y `conexiones_caidas()` produce
   `mercadopago` desde `MpCredentialStore.salud()` — tabla **nuestra** (`mp_credentials`), que el seed
   escribe. Ese camino ejercita la **misma** rama de la línea 45.

### La regla que se agrega al contrato

> **Cuando el id es una plantilla (`prefijo-${variable}`), la fila de la matriz es la PLANTILLA, y el
> `camino` elige qué instancia la ejercita. Una fila por valor de la variable no es una fila: es un
> dato.** Se mide la plantilla con la instancia **alcanzable con estado propio**, y se declara en la
> evidencia cuál se usó y por qué.

Aplicado: la fila se mide como `service-card-status-*` en estado `caido` **vía `mercadopago`**, y la
celda `googlecalendar` **se retira de la matriz** — no por no medible, sino porque nunca fue una fila
distinta. Cero fixture nuevo, cero inyección, cero riesgo en prod.

### Lo que NO se hace, y por qué queda escrito

El gateway **es** inyectable: composition root único en `serve.py:125`, pasado como parámetro
`composio_gateway=` a las tres apps (`serve.py:177,285,309`; receptores con default `None` en
`mi_dia_web.py:146` y `afip_web.py:157`). Sustituir el borde de terceros ahí habría sido
arquitectónicamente correcto. **No se hace igual**, porque con la plantilla medida por `mercadopago`
no compra nada, y el costo es un doble encendido en el servidor vivo con riesgo de quedarse puesto.
Queda registrado acá para que nadie lo re-descubra: **es deuda deliberada y visible, no un olvido.**

### Dueños

- **FE2** — mide `service-card-status-*` en `caido` por `mercadopago` y declara la instancia en la
  evidencia. **Si el seed de MP no logra el estado `caido`, volvé con eso**: la escribibilidad de
  `mp_credentials` es una afirmación de backend con `path`, no una medición mía.
- **Backend** — tu diagnóstico de Composio queda **vigente y citado**; lo que cambia es la pregunta,
  no tu respuesta. No hay trabajo nuevo para vos en esta celda.

> ⚠️ **El error de fondo, que es mío:** la matriz v1 tenía una fila por **proveedor** donde el código
> tiene una plantilla. Preguntamos «¿cómo fabrico este valor?» durante dos intercambios entre dos
> sesiones, cuando la pregunta era «¿qué mide realmente esta fila?». Una fila mal recortada convierte
> un dato en un bloqueo, y el bloqueo parece técnico.

### §9.bis — ⛔ `agenda` NO es `caida`: el criterio ya estaba escrito en el generador

**Límite de §9, y hay que leerlo antes de aplicarlo.** Son **dos matrices distintas** y casi las
mezclo: `scripts/evidencia/criterio3-matriz.mjs` mide **7 pantallas × 2 viewports**
(`detalle,agenda,ingresos,presu,negocio,afip,cuenta`, línea 125); `caida` pertenece a la matriz de
**testids** de BL-Q3. Una celda de una no es una fila de la otra.

Y el caso gemelo ya tenía criterio firmado **en el código, desde antes**
(`criterio3-matriz.mjs:17-21` y el warning de la línea 115):

> `agenda` → sub-vista de Mi día, visible sólo si Calendar está `'ok'`. El prototipo la muestra
> SIEMPRE conectada (mock); si el tenant no tiene Calendar, la app muestra «no conectado» y **se
> documenta, no se fuerza**.

**Nadie lo citó** — ni FE2 al pedir el estado, ni backend al diagnosticarlo, ni yo al escribir §9.
La respuesta a «¿qué hago si el estado depende de un tercero?» estaba en el generador que las tres
sesiones corren.

**Por qué los dos criterios no se contradicen**, que es lo único que hay que retener:

| | `agenda` | `caido` |
|---|---|---|
| ¿El comportamiento se ramifica por el valor? | **Sí** — la sub-vista existe o no existe | **No** — una sola rama (`ServiceCard.tsx:45`) |
| ¿Hay otra instancia alcanzable que lo produzca? | **No** | **Sí** — `mercadopago`, desde tabla propia |
| Criterio | **se documenta, no se fuerza** | **se mide por la instancia alcanzable** |

⛔ **No apliquen §9 a `agenda`.** Forzar un Calendar conectado para que la captura coincida con el
prototipo es fabricar el resultado que se está midiendo. La pregunta que separa los dos casos es
siempre la misma: **¿la rama es una sola?**

---

## §10 — La fila declara SUPERFICIE, o el veredicto no aplica (y tres filas quedan sin id)

Tercera vez hoy que el mismo defecto de contrato cambia de disfraz: **v1 no declaraba camino, v2 no
declaraba superficie.** Auditoría lo cazó midiendo el DOM del prototipo (commit `b765af0b`, control
positivo: `#card.dataset.card` coincidió con el `?ver=` pedido en 5/5).

| `?ver=` del prototipo | qué muestra | **dónde vive** |
|---|---|---|
| `card` · `card-presu` · `card-cobro` | «Nuevo gasto» · «Nuevo presupuesto» · «Nuevo ingreso» | `#card` **dentro de `#funcion`** |
| **`vozchat`** | «Nuevo gasto» | **`.hitl` en el CHAT** |
| `hitl` | **«Recordatorio a Lucía»** | `.hitl` en el chat, otro contenido |

En la app las cards viven **en el hilo** — verificado por mí, no transmitido:
`MessageList.tsx:274` retorna `TarjetaPresupuestoPropuesto` y `:304` retorna `HitlCard`, las dos
dentro del render del mensaje. Las cinco `card*` del prototipo montan en `#funcion` y **ninguna**
produce `.hitl` en el chat.

### Campo obligatorio nuevo de §2

> **`superficie`** — el contenedor del DOM donde vive lo que se compara, en **los dos** lados
> (`#funcion` / `.hitl` del chat / `#ajustes` / …). Sin superficie declarada en ambos lados, la fila
> **no admite veredicto**: no es COHERENTE, no es DESVÍO, es **no comparable**.

### Filas afectadas

- **`card`, `card-presu`, `card-cobro`** → ⛔ **la reasignación a `vozchat` quedó RETIRADA — ver §11.**
  Lo escribí antes de contar los componentes del hilo y estaba mal: hay **seis**, no uno.
  La superficie declarada sigue valiendo; el id nuevo, no. Los análisis ya
  hechos contra `#card` **no se tiran**: entran como `dato_` y sirven si se decide medir también
  `#funcion`, que es una fila **distinta**, no la misma con otro id.
- **`hitl`** → el lado app estaba bien elegido (`factura`, por el argumento de la capacidad ausente),
  pero el lado prototipo muestra un **recordatorio**, no una card de confirmación: **no tiene con qué
  comparar**. Queda en espera de declarar superficie **y contenido**.

### ⚠️ `card-cobro` arrastra la colisión del glosario — la fila se renombra

En el prototipo es **«Nuevo ingreso / Anotar que me pagaron»**: plata que **ya entró**. **No** es
generar un link de cobro de MercadoPago. Es la colisión que `CONTEXT.md` advierte con
`ingreso`/`cobro`/`pago`, y con el nombre actual el desvío que se reporte va a ser **del nombre, no
de la UI**. **La fila pasa a `card-ingreso`**; si además hay que medir el cobro MP, es **otra** fila
con su propio nombre. Un id que usa la palabra ambigua del glosario fabrica un falso desvío.

### H5 corregido — el guard de prudencia borró la única señal

Auditoría reportó `index.html:3470` (`if (ver === 'hitl') … const a = $('#accion-lucia'); if (a) a.click();`)
como «sin rama else: si el nodo no existe, la captura sale de la pantalla base sin error». **Lo
verifiqué y es peor que eso, por comparación con sus vecinas:**

```
3470  if (ver === 'hitl')   … const a = $('#accion-lucia'); if (a) a.click();   ← falla MUDA
3472  if (ver === 'cuenta') … $('#ajustes').classList.add('on'); …              ← falla con TypeError
3473  if (ver === 'apar')   … $('#ajustes').classList.add('on'); …              ← falla con TypeError
3474  if (ver === 'hablar') … $('#ajustes').classList.add('on'); …              ← falla con TypeError
```

Las tres vecinas **no** tienen guard de nulidad, y por eso dejan rastro: un `TypeError` en la consola
del browser. La línea 3470 **sí** lo tiene, y el `if (a)` escrito por prudencia **eliminó la única
señal disponible**. Un guard de nulidad sobre la acción que **es** la medición no protege nada:
convierte un fallo detectable en una foto perfecta de otra cosa.

**Control que se agrega al generador** (dueño: planificación, este sprint): leer
`page.on('console')` y abortar la celda si hubo error — caza las tres vecinas. **Para `hitl` no
alcanza**, porque no emite nada: ahí hace falta una **aserción positiva post-click** (que el
`.hitl` esperado exista) antes de sacar la foto. La regla general: **una acción que habilita la
medición necesita aserción propia, no un `if` que la saltee en silencio.**

---

## §11 — El veredicto declara su DIMENSIÓN: componente o contenido (y así se resuelve `hitl`)

⛔ **Retiro la reasignación de §10.** La escribí asumiendo que las cards del hilo eran una plantilla
con el tipo como variable — el patrón de §9. **Conté los componentes y son seis, cada uno con su
archivo y su rama:**

| línea | rama | componente |
|---|---|---|
| `MessageList.tsx:252` | `leerGastoPropuesto(message.card)` | `TarjetaGastoPropuesto` |
| `:269` | `leerIngresoPropuesto(...)` | `TarjetaIngresoPropuesto` |
| `:274` | `leerPresupuestoPropuesto(...)` | `TarjetaPresupuestoPropuesto` |
| `:277` | `leerFacturaPropuesta(...)` | `TarjetaFacturaPropuesta` |
| — | (cliente) | `TarjetaClientePropuesto` |
| `:304` | `classifyChoices(message.choices)` | `HitlCard` |

**`card`, `card-presu` y `card-ingreso` son tres filas legítimas**, no tres valores de una. La regla de
§9 se aplicó bien a `caido` (**una** rama en `ServiceCard.tsx:45`) y la iba a aplicar mal acá (**tres**
ramas, tres archivos). **La pregunta de §9 es la correcta; la respuesta se mide, no se supone.**

Y el comentario de `MessageList.tsx:245-249` declara dos cosas que ninguna fila estaba usando: las
cards `*_propuesto` **no llevan `choices`** y se chequean **antes** del gate HITL, en orden fijo
(gasto → cliente → ingreso → presupuesto → factura), **igual que
`apps/mobile/src/modules/chat/ListaMensajes.tsx`**. Es decir: las cards propuestas y `HitlCard` son
**mutuamente excluyentes por diseño**, y la paridad web/mobile del orden ya está escrita en el código.

### La colisión de `hitl`: dos sesiones, dos veredictos opuestos, ninguna equivocada

FE1 declaró `hitl` **COHERENTE** (§4, mismo componente, lado app = HITL de Mercado Pago). Auditoría midió
`?ver=hitl` del prototipo y encontró **«Recordatorio a Lucía»**, concluyendo **no comparable**. Medí la
pieza que faltaba: `classifyChoices` es un alias de `clasificarChoices`
(`hitlMapping.ts:24`) y clasifica **por `choices`, no por tipo de negocio** — así que **`HitlCard`
renderiza cualquier confirmación con opciones**, un cobro MP o un recordatorio.

**Los dos veredictos son verdaderos sobre dimensiones distintas:** mismo componente, contenido
distinto. No hay nada que dirimir, y el contrato no tenía dónde escribirlo.

### Campo obligatorio nuevo de §2

> **`dimension`** — `componente` · `contenido` · `ambas`. Un veredicto sin dimensión declarada es
> ambiguo: **COHERENTE-por-componente y no-comparable-por-contenido pueden ser ciertos a la vez**, y
> dos sesiones competentes van a firmar lo contrario sin contradecirse.

Aplicado a `hitl`: **COHERENTE en `dimension: componente`** (queda firme, es de FE1) · **no comparable
en `dimension: contenido`** (queda firme, es de auditoría). **Una sola fila no podía sostener las dos.**

### Lo que FE1 corrigió, y se toma

1. **`card-presu` ya estaba cubierto en la superficie correcta:** su `pres-hitl` = COHERENTE vía
   `MessageList.tsx:274`. Reasignarlo habría **duplicado** una fila ya medida.
2. **`vozchat` exige audio real** → `PENDIENTE_DEVICE` (ya así en su barrido del 22). Mi reasignación
   habría movido **tres filas medibles a un estado que el operador difirió al sprint siguiente** — el
   contrato habría empeorado el cierre en vez de destrabarlo.
3. **Nadie mezcló los sentidos de `cobro`:** FE1 comparó `ingresos-nuevo` contra `CARDS.cobro` del
   proto, los dos «Anotar que me pagaron». **El renombre a `card-ingreso` sigue en pie**, pero como
   **prevención del glosario, no como corrección de un error cometido** — mi §10 se lo imputó y no
   corresponde.

> ⚠️ **Tres correcciones en dos horas sobre el mismo contrato, y el patrón es uno:** cada vez que
> escribí una **prescripción** (cambien el `waitUntil` §8.6, reasignen a `vozchat` §10) resultaba
> refutada por una medición que no había hecho; cada vez que escribí una **regla de qué declarar**
> (camino §1, superficie §10, dimensión §11) sobrevivió. **Un contrato define qué hay que declarar; las
> asignaciones concretas las pone quien mide.**

---

## §9.ter — ⛔ `caida` está MEDIDA y COHERENTE, y mi ancla de §9 era falsa

FE2 volvió a medir en vivo antes de ejecutar §9 y **desarmó la base del problema**: `googlecalendar`
**ya viene con `status:"caido"` en prod**, consistente en 4 corridas limpias, para `e2e-device`, ahora.
No hacía falta fixture, ni backend, ni mi alternativa de `ServiceCard`, ni el gateway inyectable.

**La causa era un race en su propia medición, y nació de una decisión de producto CORRECTA.**
`useEstadoGoogleCalendar` arranca en `null`, y el docstring de `PanelCalendario`
(`MidiaScreen.tsx:305-312`) declara por qué: sin esa señal (`null`, catálogo caído o backend viejo) se
degrada al texto de «nunca conectada», **«el menos alarmante de los dos ante la duda»**. Su primer
ch equeo, con un timeout fijo de 1.5s, cayó en ese render transitorio. Con el settle correcto
(esperar la respuesta real de `/catalog`, e inspeccionar el body crudo como control) el estado final y
estable es **`midia-calendario-caida`**.

> ⚠️ **La clase, y es nueva:** *un degradado prudente hacia el estado benigno hace que el instrumento
> mida el caso benigno y no lo sepa.* «El menos alarmante ante la duda» es la decisión correcta para el
> emprendedor y **veneno para la medición**: no hay error, no hay vacío, hay una pantalla plausible del
> **otro** caso. Hermana directa del `if (a) a.click()` de §10: las dos convierten una falla detectable
> en una foto perfecta de otra cosa, y las dos fueron escritas por prudencia.

### Mi ancla de §9 era falsa — corregida acá, verificada por mí

Escribí «se mide `service-card-status-*` en estado `caido` vía `mercadopago`». **Ese testid no existe
en el estado caído:** `ServiceCard.tsx:134` lo guardea a `resolvedState === 'connected'` y adentro dice
`CONECTADO`. El estado caído se lee por **`data-state="reconnect"` en la card padre** (`:120`
`data-state={resolvedState}`, rama en `:152`); el badge «RECONECTAR» **no tiene testid propio**.

- **La regla de §9 sigue valiendo** (FE2 lo dice y coincido): cuando el id es una plantilla, la fila es
  la plantilla y el camino elige la instancia. **El ejemplo concreto que le puse era falso**, y un
  ancla falsa en un contrato es peor que ninguna.
- **La fila se cierra por el camino que §3 ya designaba** — Mi día, «porque el prototipo lo ubica
  ahí» — con `midia-calendario-caida`, evidencia `BLQ3-caida-mi-dia-FINAL.png`, texto real: «Se cayó
  la conexión con Google Calendar. Reconectala en Ajustes → Apps…». **COHERENTE.**
- Y `service-card-googlecalendar` **ya estaba** en `data-state="reconnect"` en Conexiones: los dos
  lados coincidían todo el tiempo.

### Cuatro de cuatro: el patrón ya no es anécdota

`§8.6` (cambien el `waitUntil`) · `§10` (reasignen a `vozchat`) · `§9` (midan por `mercadopago`) · y el
`NO_MEDIBLE` que estuve a punto de firmar: **cuatro prescripciones mías, cuatro refutadas por una
medición que no hice** — y las cuatro veces las refutó quien fue a medir. Las **reglas de qué
declarar** (camino §1, superficie §10, dimensión §11) sobrevivieron todas.

**Regla operativa que queda, y aplica a mí primero:** un contrato **no** asigna anclas concretas
(`path:línea`, ids, selectores) que su autor no midió. Si hace falta una, se escribe como
`[ASSUMED_PENDING_VERIFY]` y el que mide la reemplaza. **Una prescripción sin medición propia no es un
contrato: es una hipótesis con autoridad**, y la autoridad es justo lo que impide que la refuten a
tiempo.

---

## §12 — ⛔ Mis «ocho montajes» de `mic-funcion` eran CUATRO, y la afirmación original estaba bien

**Retiro la corrección del §8.1. El número bueno era el que ya estaba.** Dije que `mic-funcion` se
montaba en ocho pantallas; auditoría midió **4**, y mi 8 salió de contar el **símbolo** en vez de la
**forma**:

| archivo | aparece `MicFuncion` | monta `<MicFuncion` |
|---|---|---|
| `Bubble.tsx:18` | sí, **en un comentario** («mismo criterio que `MicFuncion` fuera del chat») | **0** |
| `MicButton.tsx:12` | sí, **en un comentario** (`MicFuncion` (BL-J7/K-10) mide la duración) | **0** |
| `ChatScreen.tsx` · `FotoFuncion.tsx` | sí, en el grep | **0** |
| `ClientesScreen` · `GastosScreen` · `IngresosScreen` · `PresupuestosScreen` | sí | **4 ← los reales** |

Lo que hace esto peor que un error de cuentas: **tengo la regla escrita**
(`memoria/contar-un-simbolo-no-dice-en-que-rol-aparece.md` y `el-guard-se-satisface-con-su-propio-comentario`)
y la violé igual, en un contrato, sobre un número que otra sesión iba a usar para decidir un arreglo.
**Un ancla falsa en un contrato es peor que ninguna** — y es la segunda vez hoy que escribo esa frase
sobre mí mismo (la primera fue §9.ter).

**Lo que NO se cae:** el punto de fondo del §8.1 sigue siendo el correcto — `mic-funcion` es **una
definición** de un componente reusable (`modules/voz/MicFuncion.tsx:83` web / `:113` mobile), no cuatro
testids copiados. El diagnóstico se arregla por ahí. Sólo la cifra estaba inflada.

**Y cómo se cazó, que es lo reutilizable:** auditoría horneó mi 8 como **control positivo** de un script
nuevo (`scripts/evidencia/anclas-ambiguas.py`). El script abortó en la primera corrida dando 4, y
**no tocó el umbral para que pasara** — fue a ver cuál de los dos estaba mal. El valor esperado era el
que estaba mal. Un control positivo con un esperado falso acusa al script; hay que poder sospechar del
esperado.

## §13 — 🆕 Campo obligatorio `ancla`: contenedor de pantalla + testid, aseverado ANTES de la captura

**Medido por auditoría: 954 testids (536 web + 418 mobile), 20 ambiguos.** No es una molestia de
nomenclatura — **rompe la unidad de medición de este contrato**, porque un testid que vive en 22
pantallas no identifica un camino.

| testid | en cuántas pantallas | definido en |
|---|---|---|
| `glass-handle` · `glass-titulo` · `glass-volver` · `glass-zona-arrastre-identidad` | **22 cada uno** | `apps/mobile/src/theme/glass/MarcoGlass.tsx:259-283` |
| `fila-botones` | 13 | `theme/glass/campos/FilaBotones.tsx:59` |
| `campo-texto` | 5 | `theme/glass/campos/CampoTexto.tsx:55` |
| `mic-funcion` · `mic-funcion-chip` (+ `-fijado` mobile) | 4 | `modules/voz/MicFuncion.tsx:83` web / `:113` mobile |
| `campo-select` · `marca` · `marca-isotipo` | 3 | — |
| `chat-vacio` · `message-list` · `separador-dia` · `presence-orb` | 2 | `MessageList.tsx:170-213` · `PresenceOrb.tsx:52` |

Más **un duplicado real**: `onda-flotante` está **escrito en dos archivos** (`ChatView.tsx:248` y
`PantallaSoporte.tsx:190`), el caso que el gate de paridad tolera por su propiedad 4.

**La regla, y por qué no hay alternativa cómoda.** Toda fila agrega el campo **`ancla`** =
`<contenedor-de-pantalla> + <testid>`, y el generador **asevera el contenedor antes de disparar la
captura**. Es el mismo patrón que `ASERCION_PROTO` del lado del prototipo, aplicado del lado de la app.

Yo había ofrecido esto como «una alternativa cómoda»; auditoría midió que **es la única que funciona**:
desambiguar cuatro testids montados en 22 pantallas cada uno significa tocar el marco de **toda** la app
mobile. El costo de la alternativa la descarta, no la preferencia.

**Consecuencia inmediata, para quien esté midiendo ahora:** `chat-vacio`, `message-list` y
`separador-dia` son ambiguos **en web**, y caen justo sobre el id `chat`. Una fila de `chat` anclada a
`message-list` sin nombrar el contenedor **no distingue** entre las dos pantallas que lo montan.

**Baja al contrato con `path:línea` exactos, no con paráfrasis:**
`python scripts/evidencia/anclas-ambiguas.py --json`.

---

## §14 — 🔴 El veredicto se emite POR DIMENSIÓN, y «14 filas» eran 20 mediciones

Los dos lotes volvieron completos y **no se pueden sumar todavía**. No por descuido de nadie: por dos
defectos de este contrato que sólo se ven cuando los dos lados entregan.

### 14.1 — Dos vocabularios para la misma cosa

| lote | palabra usada | cuántas |
|---|---|---|
| A (FE1) | **`DESVÍO`** (+ «leve», + «con salvedad de captura») | 8 |
| B (FE2) | **`DIFERENCIA`** / «DIFERENCIA (presentación)» | 2 |

El §2 fijó los campos y **nunca fijó el vocabulario de la columna `veredicto`**. Dos sesiones
competentes eligieron palabras distintas para lo mismo y ninguna se equivocó. Agregar esto mapeando
`DIFERENCIA→DESVÍO` en silencio sería inventar una equivalencia que nadie midió.

**Vocabulario cerrado, desde ahora:** `COHERENTE` · `DESVÍO` · `FUERA-DE-REFERENCIA` ·
`NO_REPRODUCIBLE_SIN_EFECTO` · `NO_MEDIBLE` · `PENDIENTE_DEVICE` · `NO_DISTINGUIBLE_POR_CONTENEDOR`.
Cualquier otra palabra es un veredicto **sin definición**, y un veredicto sin definición no se agrega.

### 14.2 — Un veredicto no puede cruzar dos dimensiones

`onb-promesa` salió **«DIFERENCIA (presentación)»** con `dimension: contenido (copy coincide)` y la
observación de que el componente **no es comparable 1:1** (el proto lo embebe en el hilo, la app es una
pantalla propia). Leído con el §11, eso **no es un veredicto**: son **dos**.

| dimensión | veredicto real |
|---|---|
| `contenido` | **COHERENTE** — el copy coincide |
| `componente` | **FUERA-DE-REFERENCIA** — el proto embebe en `#hilo`, la app monta pantalla propia |

Una sola palabra para las dos dimensiones tiene que **elegir una y callar la otra**, y la que se calla
es información medida que se pierde. **Regla:** el veredicto se escribe **con su dimensión**
(`contenido: COHERENTE · componente: FUERA-DE-REFERENCIA`). Si las dos dimensiones no coinciden, la fila
lleva **dos veredictos**, no un promedio.

Es el mismo defecto que el §11 arregló para el barrido —una fila sin la dimensión suficiente para
distinguirla de su vecina— reapareciendo **en la columna de salida** después de arreglarlo en la de
entrada.

### 14.3 — «Lote A = 14 filas» eran **20 mediciones**

Conté el reparto en **ids** cuando el §1 de este contrato declara que la unidad es **`id + camino`**.
Varios ids de lote A tienen dos caminos (`agenda` A/B, `clientes` listado/ficha, `apps`
connections/AppsScreen), así que las «14 filas» produjeron **20 veredictos**: 5 COHERENTE · 8 DESVÍO ·
5 NO_MEDIBLE · 2 FUERA-DE-REFERENCIA. Lote B: **11 y 11**, porque su reparto ya venía por camino único.

> **El contrato que define la unidad de medición repartió el trabajo en otra unidad.** Los números que
> circularon (12, 14, 30) eran de ids; los medidos son de caminos. Nadie midió mal: el reparto y el
> contrato contaban cosas distintas, y eso **no se ve** hasta que alguien suma.

**Total real de la segunda pasada: 31 mediciones** (20 + 11) **+ 5 de voz `PENDIENTE_DEVICE`.** El «30»
del título del reparto queda retirado como cifra y vive sólo como nombre del frente.

### 14.4 — Lo que NO se toca de lo entregado

Nada de esto invalida una sola fila. Los dos cierres traen el settle por fila, el dato crudo donde
importaba, y dos `[ASSUMED_PENDING_VERIFY]` correctamente marcados (`reveal` mobile · `pres-ciclo`
superficie del proto). **La reconciliación es de vocabulario y de unidad, no de medición** — y eso se
arregla renombrando columnas, no volviendo a medir.

---

## §14.5 — 🔢 Y aplicar el §14.2 cambió el total: **31 mediciones, 32 veredictos**

FE2 aplicó las dos correcciones y verifiqué el archivo: `tablero` → `DESVÍO`, y `onb-promesa` partido en
`contenido: COHERENTE · componente: FUERA-DE-REFERENCIA`, con sección de trazado propia. Las 6
apariciones restantes de `DIFERENCIA` son históricas («era DIFERENCIA GRAVE el 22/09») o de la sección de
corrección — **ninguna en una columna de veredicto**.

**Pero partir esa fila movió el total, y las dos cifras son distintas:**

| unidad | cuántas | por qué |
|---|---|---|
| **mediciones** (`id + camino`, la unidad del §1) | **31** | `onb-promesa` es **una** medición |
| **veredictos** | **32** | esa medición emite **dos**, uno por dimensión (§14.2) |

Las dos son correctas y **no son la misma cosa**. Ya di «31» a quien tiene que auditar el agregado, así
que lo corrijo antes de que cuente: si cuenta veredictos le va a dar 32 y va a concluir que mi conteo
está mal.

**La regla que faltaba:** cuando el §14.2 parte una fila, **sube el conteo de veredictos y NO el de
mediciones.** Todo número de esta matriz se escribe **con su unidad** — «31» y «32» sueltos son
indistinguibles de un error, y hoy ya circularon cuatro cifras de este frente (12, 14, 30, 31) que eran
todas de unidades distintas.

Es la séptima vez en el día que un número de este frente se cae por no llevar su unidad pegada. El patrón
no es de aritmética: **la unidad viaja en la cabeza del que contó y no en el papel.**

---

## §15 — ⛔ Auditoría dictaminó **NO** sobre el agregado, y las 4 acciones son de metadato. Con dos correcciones mías, medidas

Dictamen: `coordinacion/abierto/2026-09-28_dictamen_auditoria-a-planificacion_el-agregado-NO-alcanza-y-faltan-4-acciones-no-remedir.md`.
**El «no» no es por rigor de la medición** — auditoría lo dice explícito: las 36 filas están medidas con
evidencia y las limitaciones están **declaradas, no ocultas**. El «no» es por **un metadato ausente en 34
de 36 filas**: el **SHA medido** que el DoD de `BL-Q5` pidió y las filas no traen.

Y eso importa porque es **el antídoto exacto contra el modo de falla que ya tumbó esta matriz una vez**.
El dictamen del 23/09 cerró pidiéndolo textual: «cualquier DoD que diga "republicar la matriz" necesita
decir también **contra qué SHA** y **qué la invalida** — si no, se convierte en un documento que envejece
en silencio mientras todos lo citan como vigente». Se pidió, y no se puso.

### §15.1 — ⛔ Mi conteo era 31; son **36 mediciones / 37 veredictos**. Y el recorte coincidió con el punto ciego

`31 = 20 (lote A) + 11 (tabla del lote B)`. **Faltaban 5**: las de la sección en prosa del lote B
(`gastos`, `ingresos`, `presu`, `recibo`×2), firmadas con veredicto en el mismo documento. Conté la
**tabla** y la prosa quedó afuera.

Pero el error aritmético es lo menor. **Lo que importa es cuáles eran las 5:** tres cierran con
«Veredicto sin cambios (22/09)» — heredadas sin re-medir. Yo pregunté por «los tres firme-no-re-medido»
y **hay nueve**; tres de los que me faltaban son exactamente los que mi denominador no contaba.

> 🔴 **El recorte del denominador y el punto ciego coincidieron, y no es casualidad: una fila que no se
> cuenta tampoco se revisa.** Un conteo no es sólo un número — es la lista de lo que va a ser mirado.
> Cuando recorté el denominador por un criterio de formato (tabla sí, prosa no), recorté **también** el
> alcance de mi propia auditoría, y el recorte cayó justo sobre las filas más débiles. Ésta es la lección
> del §15, no la aritmética.

### §15.2 — 🆕 El campo es `medido_contra:`, no «el SHA», y se especifica en CUATRO formas

Poner «`sha_medido: <hash>`» y llamarlo hecho **reintroduce el problema con otra cara**, por dos cosas que
medí hoy y que el dictamen no podía ver:

**(a) Casi ninguna fila del lote B se midió capturando: se midió LEYENDO CÓDIGO.** El documento del lote B
cita **un solo** nombre de `.png` (`pres-ciclo-app.png`) para 16 mediciones. Para una fila leída en código,
el árbol que se leyó **es el worktree del medidor**, que puede diferir de `origin/main` **en los dos
sentidos** (commits propios sin pushear, y commits de `origin` sin mergear). Anotar `origin/main` ahí sería
anotar un árbol que nadie leyó.

**(b) Una fila puede mezclar dos fechas, y el campo tal cual registraría la que favorece.** `detalle` tiene
captura de **hoy** y su celda dice «descripción validada **22/09**; `?ver=detalle` exacto **no releído esta
pasada**». Un `sha_medido` tomado de la captura diría `b7fa0e23` (hoy 08:32) y la fila pasaría el control de
caducidad — cuando **la parte que sostiene el veredicto es del 22/09** y es justo la que los tres commits de
BL-V23 impactan. **El campo diseñado para impedir el envejecimiento silencioso lo CAUSARÍA.**

> ### Especificación del campo `medido_contra:`
>
> Obligatorio por medición (`id` + `camino`). Nombra **el árbol que se leyó o se sirvió**, no «el repo»:
>
> | forma | cuándo | qué se anota |
> |---|---|---|
> | `servido@<sha>` | la app se midió corriendo (captura) | 🆕 el `data-build-sha` del HTML servido — **se LEE**, no se infiere del calendario de deploys. Disponible desde el **2026-09-28T16:56:05Z**; una captura anterior a esa hora cae a la inferencia vieja (SHA de `origin/main` al `mtime` del PNG) y **se marca como techo** |
> | `leido@<rama>:<sha>` | la fila se midió leyendo código | SHA **del worktree donde se leyó**, más su rama. Si difiere de `origin/main`, agregar `merge-base=<sha>` |
> | `proto@<sha>` | el lado prototipo | SHA del commit que trae ese `index.html` |
> | `reconstruido@<path>:<ultimo-commit>` | 🆕 **la fila se mide HOY pero el veredicto es de una pasada ANTERIOR** (backfill) | el path que se leyó y el último commit que lo tocó **antes** de la fecha del veredicto. **Marca la fila como reconstrucción, no como medición** |
>
> 🆕 **La cuarta forma existe porque el spec NO es backfilleable, y eso lo midió auditoría, no yo.** Un veredicto escrito ayer sin el campo **no se puede completar hoy**: nadie sabe qué árbol tenía el worktree del medidor en ese momento. Si se reparte el backfill con las tres formas de arriba, lo que vuelve son `leido@` **aproximados presentados como medidos** — exactamente el modo de falla que el campo existe para prevenir, reintroducido por el remedio. Así que el backfill tiene su propia forma, y **es visiblemente distinta a simple vista**.
>
> **Su límite, escrito y no escondido:** `reconstruido@` dice *«esto es lo que el archivo dice HOY, y el veredicto es de ANTES»*. **No sostiene un veredicto por sí solo**: si entre el último commit citado y la fecha del veredicto el archivo cambió, la fila **no se reconstruye — se re-mide**. La prueba para elegir la forma es una sola pregunta: *¿abrí el archivo/la app ahora, o estoy completando el campo desde el historial?* Lo primero es `leido@`/`servido@`; lo segundo es `reconstruido@` **siempre**, aunque el resultado coincida. **Y la forma no se elige por lo prolijo que quedó el renglón:** una reconstrucción que se disfraza de `leido@` es peor que un hueco, porque el hueco se ve.
>
> ✅ **Ejemplo de uso correcto medido el 28/09 (frontend1, lote A):** FE1 tuvo el caso límite y eligió bien — declaró `leido@<rama>:<sha>`, **no** `reconstruido@`, y dejó escrito el por qué: *«es una lectura del contenido actual del archivo, hecha ahora, no una inferencia desde el historial de commits»*, y lo respaldó con `git diff HEAD origin/main` vacío sobre los paths citados. Esa es la distinción operativa, no la etiqueta más prolija.
>
> **Regla del eslabón más viejo (la que evita el (b)):** si el veredicto se apoya en **más de una** lectura
> y alguna es heredada, `medido_contra` anota **la más VIEJA de las que sostienen el veredicto**, nunca la
> más nueva. Test: *¿qué lectura, si estuviera desactualizada, cambiaría el veredicto?* Esa es la que se
> anota. Una fila con captura de hoy y descripción del 22/09 anota **el 22/09**.
>
> ⚠️ **Límite declarado, no escondido:** la app no expone ningún marcador de build — `/healthz`
> (`apps/copiloto/web.py:1319-1321`) devuelve `{"status": "ok"}` y no hay `VITE_BUILD`/`GIT_SHA` en el
> front. Así que `servido@<sha>` es un **techo**, no el SHA desplegado: si el deploy venía atrasado, la
> captura midió una superficie MÁS VIEJA que el SHA anotado, y el control de caducidad **falla abierto por
> exactamente el atraso del deploy**. Cerrar eso es un marcador de build (fila `BUILDSHA` del tablero), no
> un detalle de esta matriz.

### §15.2.bis — 🆕 ¿El CAMINO DE ACCESO cuenta como eslabón? **NO, salvo que el veredicto hable de él.** (decisión, no aclaración)

Auditoría **ejercitó** el spec en dos filas reales antes de repartir nada y encontró que la regla del
eslabón más viejo **no se puede aplicar sin ambigüedad** — y no por descuido del medidor. En la fila
`negocio` hay **dos lecturas con apoyo textual y cuatro días de diferencia**:

| lectura | qué considera eslabón | eslabón más viejo |
|---|---|---|
| **A** — sólo lo comparado | los 6 campos (`PantallaPerfilNegocio.tsx` `6d2726b8`) y `#s-negocio` del proto | `proto@54fac3ea` (09-21 12:09) |
| **B** — la superficie declarada | la columna `superficie` nombra `#ajustes`, cuyo equivalente mobile es `PantallaAjustes.tsx` | `leido@…:51437353` (**09-18** 17:33) |

**En un frente donde una fila caducó por HORAS, cuatro días deciden un control de caducidad.**

> ### Decisión (mía, planificación): **`medido_contra:` cubre sólo los eslabones de los que depende la AFIRMACIÓN del veredicto.** El camino de acceso queda **excluido por defecto**.
>
> La columna `superficie` es un **localizador** — dice dónde se miró —, **no** parte de lo afirmado.
> Que nombre el contenedor (`#ajustes › #s-negocio`) es para que otro encuentre la misma pantalla, no
> para afirmar algo sobre el contenedor.
>
> **Y la decisión no es arbitraria: la fuerza el test que ya estaba escrito.** *¿Qué lectura, si
> estuviera desactualizada, cambiaría el veredicto?* Si `PantallaAjustes.tsx` hubiera cambiado el 09-18,
> los 6 campos de `PantallaPerfilNegocio.tsx` **seguirían coincidiendo** con el proto y el `COHERENTE`
> quedaría igual. Entonces **no es un eslabón del veredicto**. La lectura A es la correcta *por la regla
> vigente*; lo que faltaba no era la regla sino **decir que la columna `superficie` no la activa**.
> Rechazo por eso el `camino_medido_contra:` que auditoría propuso como alternativa: un campo más para
> un dato que no sostiene ningún veredicto es **ceremonia**, y cada campo obligatorio nuevo es una
> celda más que se llena de memoria.
>
> ⚠️ **La excepción, y es la que importa:** si el veredicto **afirma algo sobre el camino** — «al
> enviar navega al chat sin responder inline», «el botón no tiene disparador alcanzable», «auto-envía
> al montar» — entonces el archivo del camino **SÍ es eslabón** y entra en el cálculo del más viejo.
> El discriminante no es dónde vive el archivo: es **si el renglón `Motivo:` lo menciona como parte de
> lo que se comprobó**. Filas ya existentes que hacen exactamente esto: `preg` (afirma la navegación),
> `apps`-AppsScreen (afirma la inalcanzabilidad), `chat`-camino-B (afirma el auto-send).
>
> 🆕 **Desempate por HORA, no por fecha** (lo pidió auditoría y es gratis): `54fac3ea` y
> `6d2726b8` son **los dos del 09-21** y los separan **6 h 44 m**. «La más vieja» entre dos commits del
> mismo día es indecidible con fecha sola, así que la comparación se hace con
> `git log -1 --date=iso` — y cuando la celda cita dos eslabones del mismo día, **lleva la hora**.

#### §15.2.ter — La fila que NO se destraba con un campo mejor: `pres-ciclo`

Auditoría eligió a propósito una fila que sospechaba que rompía el spec, y la rompió: `pres-ciclo`
tiene **`medido_contra` inescribible**, y no por pereza. No hay `proto@<sha>` porque **dos superficies
compiten por el id** (`HILOS['pres-ciclo']` `index.html:3365-3371`, un hilo de chat, vs. los chips de
lista `#presu` `:2088,2093,2098`) y **nadie decidió cuál es la referencia**: un SHA ahí anotaría el
archivo, no la superficie, y la fila seguiría comparando contra algo sin definir. Tampoco hay `leido@`
porque su propio veredicto dice *«firme, no re-medido»* — la lectura que lo sostiene es de otra pasada.

**Conclusión que vale como regla:** cuando `medido_contra` es inescribible, eso **no es un problema del
campo — es el campo funcionando**. Está diciendo que la fila no tiene referencia decidida. `pres-ciclo`
se destraba **decidiendo la superficie**, no rellenando la celda, y sigue siendo el único
`[ASSUMED_PENDING_VERIFY]` bloqueante. Rellenarla con el eslabón medible más cercano (los de la app,
`63c49cc9` / `63fd6f15`) sería anotar **un eslabón que no sostiene el veredicto**: el defecto (b) de
§15.2 con otra cara.

### §15.3 — 🔢 El SHA medido de las capturas de hoy: **81 de 82 son `b7fa0e23`**, y eso cambia las dos «caducadas»

Medido con el `mtime` de los 82 PNG de hoy contra la tabla de commits de `origin/main`, con **control
positivo en las dos mitades del instrumento** (ver §15.3.bis):

| tramo | SHA | capturas |
|---|---|---|
| 08:32:29 → 10:00:15 | **`b7fa0e23`** | **81** |
| 10:00:15 → 10:35:55 | `bead3e88` (docs de BL-Q4, no toca superficie) | 1 |

**El corte global de `2026-09-22 14:28` que auditoría tuvo que usar era cinco días y medio más
conservador que lo real.** Con el SHA medido:

| fila | auditoría (corte global) | con el SHA medido | por qué |
|---|---|---|---|
| `pres-hitl` | ⛔ CADUCA (3 commits) | ✅ **VIGENTE** | sus tres commits son `fc37dc3f` (22/09 14:29), `3ba91a2e` (22/09 22:06) y `03e9c200` (hoy **08:28:12**) — los tres **anteriores** a `b7fa0e23` (08:32:29). Una medición de 08:32 ya los incluye. Auditoría lo predijo: «con SHA por fila, `pres-hitl` podría salir vigente» |
| `detalle` | ⛔ CADUCA (3 commits) | ⛔ **CADUCA IGUAL** | sus tres commits son del **22/09** (17:23·21:22·21:55), anteriores a la captura de hoy… **pero por §15.2(b) esta fila anota el 22/09**, no hoy: su descripción es heredada del 22/09 y es la que sostiene el veredicto. La captura fresca no la salva |

> **`detalle` es lo peor del dictamen y sigue siéndolo.** El dictamen del **23/09** ya la listaba
> impactada por `e41a54fe`/`221de832` — y cinco días después se firmó COHERENTE. **No es una omisión
> nueva: es la reincidencia de un hallazgo escrito.** Falló el canal, no el medidor: el hallazgo viajó
> como `dato_`, y un `dato_` **nadie lo persigue**
> (`memoria/el-tipo-de-mensaje-decide-si-alguien-lo-persigue.md`). Fix estructural en §15.7.

### §15.3.bis — El control positivo cubría la mitad del instrumento, y la mitad sin cubrir dio un CERO falso

Mi primera corrida imprimió **`VACIO`** con 82 PNG en disco. Causa: le pasé a Python de Windows una ruta
de Git Bash (`/c/Proyectos/...`), y **`os.walk` sobre una ruta inexistente no lanza: itera cero veces**.

Yo había horneado control positivo — **tres anclas sobre la función del SHA**, y las tres pasaron. Lo que
no tenía control era **el descubrimiento de archivos**, y ahí estaba el defecto.

> ⚠️ **Un control positivo cubre la mitad que se sospecha, y la mitad restante queda muda.** Las tres
> anclas verdes daban una sensación de instrumento verificado que el instrumento no tenía. La regla no es
> «poner control positivo», es **preguntarse a qué afirmación NO se lo puso** — acá: «miré 82 archivos».
> Instrumentado: `if not os.path.isdir(base): abortar`. Clase:
> `memoria/instrumento-que-no-mira-nunca-falla.md` + `memoria/vacio-no-es-hallazgo-correr-el-control.md`.

### §15.4 — 🆕 La fila partida arranca con `PARTIDO:` (o se pierde ENTERA y sin avisar)

Auditoría midió que su primer contador dio **10** filas en la tabla del lote B en vez de 11: `onb-promesa`
cierra con `contenido: COHERENTE · componente: FUERA-DE-REFERENCIA`, celda que **arranca en minúscula**
mientras las otras diez arrancan con el veredicto. **La fila partida no se cuenta mal: desaparece — ni 1
ni 2, y sin error.**

**Formato obligatorio desde ahora:** `PARTIDO: contenido=<VEREDICTO> · componente=<VEREDICTO>`.
Y para todo contador de esta matriz: una fila de tabla que no rinde veredicto **se emite como
`SIN_VEREDICTO_PARSEABLE`**, nunca se omite — *un hueco se nombra, no se cuenta como cero.*

### §15.5 — 🆕 Los TRES cajones de «no comparé», y cuál corresponde

El cajón `NO_MEDIBLE` se estaba usando para tres cosas distintas, y **sólo una es una limitación de
medición**. Auditoría midió que 3 de las 11 no-comparaciones estaban **mal clasificadas**, no eran pereza:

| el hecho es… | cajón correcto | ejemplo medido |
|---|---|---|
| **no existe en el prototipo** — no hay con qué comparar | `FUERA-DE-REFERENCIA` | `clientes` (ficha): el proto no tiene vista de detalle · `card-factura`: `HILOS` no modela «incompleta» |
| **no hay camino al estado** — verificado, es un RESULTADO | `FUERA-DE-REFERENCIA` + hallazgo linkeado | `apps`-AppsScreen: «código muerto verificado» **es un hallazgo**, y meterlo en `NO_MEDIBLE` lo esconde dentro del cajón de lo no sabido |
| **existe y no lo puedo forzar sin efecto irreversible** | `NO_MEDIBLE` / `NO_REPRODUCIBLE_SIN_EFECTO`, con la limitación **declarada** | `afip` (vincular ARCA es irreversible) · `fact-cae` (emisión fiscal real) — `fact-cae` es el modelo de cómo se cierra bien |

> **Regla:** antes de escribir `NO_MEDIBLE`, contestar *«¿esto es algo que no sé, o algo que sí sé?»*. Si
> la celda contiene una comparación con resultado, el veredicto **no** es «no pude». `vacio-visto` es el
> caso: su celda dice que la app **no tiene** el contador `odobi-calma-dias` del proto — **eso es una
> comparación hecha, con resultado y por código**, y el veredicto decía «no reproducible».

### §15.6 — 🆕 Regla de `[ASSUMED_PENDING_VERIFY]` (de auditoría, §5 de su dictamen)

> **Una marca `[ASSUMED_PENDING_VERIFY]` no bloquea el cierre de su fila si y sólo si lo asumido NO es lo
> que el veredicto afirma.**
>
> - ✅ **Tolerada** cuando lo asumido es un **corroborante** (una línea no releída de la plataforma
>   análoga, un testid no re-verificado) y el veredicto se sostiene sin ella.
> - ⛔ **Bloqueante** cuando lo asumido **es el sujeto** del veredicto.
> - **Test operativo:** *¿si el supuesto fuera falso, cambiaría el veredicto?* Sí → bloqueante.
>
> **Aplicada:** `reveal` **tolerada** (lo asumido es la línea mobile; el veredicto es de contenido web).
> `pres-ciclo` **BLOQUEANTE**: lo asumido es *cuál de dos superficies del proto* es la referencia — y esa
> elección **es** lo que el veredicto compara.
>
> **Por qué no se prohíben:** prohibirlas no las elimina, las vuelve **invisibles**. La marca tiene que ser
> **barata de poner y cara de ignorar** — mismo motivo por el que un guard que grita en el caso normal se
> desarma solo.

### §15.7 — 🔴 Fix estructural: la fila carga su propia historia de caducidad

`detalle` se firmó COHERENTE cinco días después de que un dictamen escrito la nombrara impactada. El
medidor no fue negligente: **el hallazgo estaba en un `dato_` del buzón y quien midió la fila leyó el
contrato, no el buzón de hace cinco días.**

**Desde ahora, todo id que un dictamen declare impactado entra en una sección de este contrato —
`§CADUCIDADES CONOCIDAS` — con el commit y la fecha.** Medir una fila obliga a leer su propia línea ahí.
La razón es la asimetría de los canales: un `dato_` **se lee una vez y nadie lo persigue**; el contrato se
abre **cada vez** que se toca la fila. Poner el aviso en el canal que se relee no es redundancia: es la
diferencia entre un aviso y un aviso que llega.

#### §CADUCIDADES CONOCIDAS (al 2026-09-28)

| id | commits que impactan su superficie | declarado en |
|---|---|---|
| `agenda` (A y B) | `ef8ded27` (22/09 17:23) · `e41a54fe` (22/09 21:22) · `221de832` (22/09 21:55) | dictamen 23/09 |
| `detalle` | los mismos tres — **y por eso caduca: su descripción es del 22/09** | dictamen 23/09 **y reincidido 28/09** |
| `pres-hitl` | `fc37dc3f` · `3ba91a2e` · `03e9c200` — **todos anteriores a `b7fa0e23`** ⇒ vigente si se midió hoy ≥08:32 | dictamen 28/09, resuelto en §15.3 |

⚠️ 🆕 **Y una caducidad que no es de una fila sino de UNA FORMA ENTERA: `servido@<sha>` es hoy una INFERENCIA, no una lectura.** El instrumento toma el `mtime` del PNG y lo cruza contra el log de `origin/main`: eso **asume** que lo desplegado era `origin/main` a esa hora. **El supuesto ya falló, medido el 28/09:** el `placeholder="1500,50"` de #689 está **presente** en `origin/main` (`FormularioPresupuesto.tsx:350`, 1 ocurrencia) y **ausente del bundle servido** (0 ocurrencias) — producción estaba atrasada. Cuando la app corre código más viejo que `origin/main`, `servido@` anota un SHA **más nuevo** que la superficie fotografiada: el campo puesto contra el envejecimiento **falla abierto por exactamente el atraso del deploy**. Consecuencia para quien lee una fila: **un `servido@` no prueba que la captura sea de ese código, sólo que no es más nueva que él** — es un techo. Los `servido@` ya escritos quedan **sospechosos, no falsos**, y no se re-miden por este contrato. El remedio es el marcador de build (`contrato_ BUILDSHA`, fila del tablero, dueños backend+FE2): hasta que el HTML servido traiga `data-build-sha`, esta forma se lee con el techo a la vista.

🆕 **Y el matiz que lo vuelve peor, medido en el VPS el mismo día (auditoría): producción NO está atrasada — LO ESTABA.** Hubo un deploy a las **11:56:53 -03** entre las dos lecturas (bundle `index-Cr4NxCOh.js` → `index-BDcH8fIG.js`), así que mi 0 ocurrencias y su 1 ocurrencia **eran las dos verdad**: ningún instrumento falló, **el sujeto se movió entre las dos mediciones** ([[un-inventario-de-procesos-vivos-es-un-snapshot-no-un-estado]]). Y de ahí sale la conclusión que ninguna de las dos lecturas sola dejaba ver: **los 18 `servido@b7fa0e23` del lote A aciertan — pero aciertan por el CALENDARIO, no por el método.** `b7fa0e23` (08:32) es ancestro del SHA desplegado y las capturas son ANTERIORES al deploy, así que lo servido no tenía los 2 commits intermedios. **Si el deploy hubiera corrido a las 10:40, la misma inferencia escribía un SHA con 2 commits que la captura no mostraba, y sin un solo síntoma.** Un campo correcto por suerte es **indistinguible** de uno correcto por medición — y esa indistinguibilidad ES el defecto, no el riesgo residual. Corolario para el control de caducidad: **«la fila coincide» no valida el método que la escribió.**

---

## §15.6 · 🆕 El remedio LLEGÓ: `servido@` pasa de inferencia a lectura (2026-09-28, 16:56 Z)

La caducidad de forma de §15.5 decía: *«hasta que el HTML servido traiga `data-build-sha`, esta forma
se lee con el techo a la vista»*. **Ya lo trae.**

Medido por planificación **contra el sitio público**, no contra el reporte de quien deployó, con tres
fuentes independientes que coinciden:

| fuente | valor |
|---|---|
| `GET /healthz` → `.sha` | `8a2f883437a6c549d2805e8b2365ff8ee44b42ac` (`arrancado 2026-09-28T16:56:05Z`) |
| `data-build-sha` del `<html>` servido | `8a2f883437a6c549d2805e8b2365ff8ee44b42ac` |
| `git ls-remote origin refs/heads/main` | `8a2f883437a6c549d2805e8b2365ff8ee44b42ac` |

**Qué cambia, en una línea:** el instrumento **lee** de la superficie fotografiada qué código era, en
vez de **deducirlo** de la hora. Con eso muere el modo de falla que el contrato ya tenía escrito: un
`servido@` no era prueba de que la captura fuera de ese código, sólo de que no fuera más nueva — y
fallaba abierto por **exactamente** el atraso del deploy, que es el caso en que hace falta.

**Qué NO cambia, y es la parte que importa:** los `servido@` ya escritos **no se re-miden** por esto.
Los 18 `servido@b7fa0e23` del lote A siguen siendo correctos **por calendario** (las capturas son
anteriores al deploy de las 11:56:53 -03), y eso sigue siendo lo que son: correctos por suerte. Un
campo correcto por suerte es indistinguible de uno correcto por medición, **y esa indistinguibilidad
es el defecto** — lo que se arregló es que de acá en adelante no se pueda volver a acertar así.

**Regla operativa, desde ahora, para cualquier captura nueva:** el `sha` de `servido@` sale de
`data-build-sha` (o `/healthz.sha`) **en la misma corrida que toma la foto**. Si el instrumento no
puede leerlo, la fila **no** cae a la inferencia en silencio: escribe `servido@?` y eso es un hueco
declarado, no un techo disfrazado.

> ⚠️ Lo que **todavía** no está cerrado es el testigo del deploy: H1 dejó el manifiesto en `.jsonl`
> append-only, pero con **una sola** línea real no se distingue un append de un `cat >`. Backend lo
> dejó abierto explícitamente hasta el **segundo** deploy real, y tiene razón: un mecanismo verificado
> sintéticamente no reemplaza el ciclo real
> (`memoria/el-testigo-del-deploy-se-sobreescribe-y-borra-la-prueba-justo-cuando-dos-mediciones-difieren.md`).
