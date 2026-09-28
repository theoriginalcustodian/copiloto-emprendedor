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
