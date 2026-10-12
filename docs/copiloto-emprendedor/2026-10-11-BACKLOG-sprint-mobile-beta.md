# Backlog detallado — Sprint MOBILE: la app lista para usuarios reales

> **Fecha:** 2026-10-11 · **Plan:** [`2026-10-11-PLAN-sprint-mobile-beta.md`](2026-10-11-PLAN-sprint-mobile-beta.md)
> **Para quién es:** las tres sesiones. Cada ítem se puede tomar leyendo **sólo su ficha**.
> **Issues:** `#999`–`#1021`, label `sprint-app-lista`.
>
> **Repo público.** Ningún ítem lleva emails, tokens ni URLs internas. Los defectos de dinero son
> **latentes**: al 2026-10-11 **no hay usuarios reales** (los tenants de la base son de prueba), así
> que ninguno causó daño — describen comportamiento del código, no un incidente.

---

## Cómo se lee una ficha

| campo | qué es |
|---|---|
| **Medido** | el hecho, con `path:línea`. Si no tiene `path:línea` ni corrida, no es un hecho: es una sospecha, y se marca `[SIN_VERIFICAR]` |
| **DoD** | **binario y verificable por alguien que no hizo el trabajo.** «Funciona» no es un DoD |
| **Evidencia** | qué artefacto hay que adjuntar. Sin eso el ítem no cierra, aunque el código esté bien |
| **Bloquea / Depende** | el orden forzado. No es preferencia: cada dependencia tiene su causa escrita |

**Y una regla que este repo ya pagó:** todo control de acceso o aislamiento necesita un **test
adversarial** (A intenta lo de B → se espera denegación), no sólo el happy-path. Un control
especificado y no ejercitado por un test hostil es indistinguible de uno ausente: el verde de «cada
uno ve lo suyo» sale igual si el aislamiento no existe.

---

# Bloque A · Instrumento confiable

*Dueño: **frontend** (dueño único del device). Nada de este bloque depende del operador.*

### A-1 · `#1010` — El toque de la pestaña del escritorio es intermitente

- **Medido (2026-10-11):** abre **4 de 6** ciclos; **al primer toque, 1 de 6**. El tap vive en el
  `onEnd` de un `Gesture.Pan()` — `apps/mobile/src/modules/escritorio/PanelFunciones.tsx:94-98`.
- **Historia que importa:** el issue nació diciendo «hacen falta dos gestos». **Eso fue retirado**
  (`H-60`): no son dos gestos, es **intermitencia**. La medición que decía «no abre» se había hecho
  con las **animaciones del sistema apagadas** —condición que el dump de UI exigía para alcanzar
  idle— y eso pone Reanimated en *reduced motion*, donde el toque no llega. **La precondición del
  instrumento era una variable sobre lo medido.**
- **DoD:** abre **al primer toque, 6 de 6 ciclos**, con las escalas de animación en **valor normal** y
  el sensor por píxeles. Si la corrida se hace con animaciones apagadas, **no cuenta**.
- **Evidencia:** las 6 corridas, cada una con su control positivo del arrastre. Si el control no mueve
  la pantalla, la corrida se declara `INVÁLIDA` — **no «no abre»**.
- **Antes de escribir código:** skill `swmansion-rn-gestures` (composición Pan/tap: un `Pan` que nunca
  se activa cambia qué callbacks corren) + el archivo equivalente de `documed-front`, que ya resolvió
  esta cáscara en device. Y **reutilizar** el sensor existente
  (`Auditorias/2026-10-11-toque-pestana-por-pixeles.py`) antes de escribir otro.
- **Bloquea:** A-2, F-1, F-2, F-3.

### A-2 · `#1012` — El eje A tiene 1 ruta verificada de 21

- **Medido:** **1 válida de 21.** 15 nunca se intentaron; 5 quedaron `NO_ATRIBUIBLE` al retirar `H-60`.
- **DoD:** las **21** con veredicto del vocabulario cerrado, medidas con animaciones en valor normal.
- **Evidencia:** por corrida, su control positivo. Un rojo sin control positivo válido es
  `NO_ATRIBUIBLE`, no un hallazgo.
- ⚠️ **`Auditorias/2026-10-11-receta-device-resultado.json` es un artefacto pre-retracción.** Sus
  celdas `NO_LLEGA` para `/gastos` e `/ingresos` están invalidadas. No citarlo como estado.
- **Depende de:** A-1. **Causa:** hasta que el gesto de apertura sea confiable, el instrumento no
  separa «la ruta no responde» de «mi gesto se perdió», y los 21 veredictos habría que repetirlos.

---

# Bloque B · El dinero

*Dueño: **backend**. Arranca **hoy**: no depende de ninguna decisión del operador ni del alta.*

### B-1 · `#1014` — Un pago de MercadoPago se cuenta dos veces en «Entró» · ✅ FIX ESCRITO

- **Medido:** `apps/copiloto/mp_web.py:53-71` escribe en **las dos** tablas que el `UNION ALL` de
  `apps/copiloto/inteligencia_queries.py:43-49` une. Presente desde el 06/10.
- **Y la mitad que estaba mal:** este ítem también afirmaba «cero veces en Ingresos». **Era falso** —
  salió de un **comentario** del código, no de la función que escribe. El doble conteo sí era real.
  *Lección:* grepeá quién **escribe** el campo, no quién lo lee ni quién lo comenta.
- **DoD:** un pago MP insertado aparece **una** vez en «Entró» y **una** en Ingresos, con test que lo
  **cuente** (no que verifique «aparece»: aparecer dos veces también es aparecer).
- **Estado:** ✅ **fix escrito y verificado** — **2297 passed / 0 failed** en el VPS, más control
  positivo: revertido el fix caen 2 tests con los números del defecto. Rama
  `backend/entro-cuenta-el-pago-mp-dos-veces`, commit `ba1f8cbd`.
- **Lo que falta:** **mergear.** Mientras no se mergee, el defecto sigue en `main` aunque el issue
  parezca atendido. Gate: `scripts/gate.sh` → recibo del SHA → `ci-verde.sh <PR>`.

### B-2 · `#1015` — Ninguna fila valía `nota_credito`, y la app ofrecía anular una nota de crédito · ✅ FIX ESCRITO

- **Medido:** el store escribía `estado` con un default único; **ninguna** fila podía valer
  `nota_credito`, así que una NC quedaba indistinguible de una factura y los fronts le ofrecían
  «Anular». Era la **raíz** de tres síntomas, no tres defectos.
- **DoD:** una NC se guarda como `nota_credito` y ningún front le ofrece «Anular». Un `estado`
  explícito pasado por el llamador **sigue ganando** a la derivación (si no, el fix rompe a quien ya
  lo pasaba).
- **Estado:** ✅ **fix escrito y verificado** — 17/17 en el VPS + control positivo fallando con
  `'emitida' != 'nota_credito'`. `apps/copiloto/afip_comprobante_store.py`, commit `fca3abae`.
- **Lo que falta:** **mergear**, igual que B-1.

### B-3 · `#1003` — «Lo facturado» se calcula con cuatro predicados distintos

- **Medido:** cuatro lugares responden «qué facturó este mes» con **cuatro** criterios diferentes
  según quién pregunte.
- **DoD:** **un** predicado, en un solo lugar, y los cuatro llamadores lo usan. Test que compare las
  cuatro respuestas **para el mismo mes** y exija igualdad.
- **Bloquea:** D-2. **Causa:** portar el bloque «facturado del mes» a mobile antes de unificar
  importa la ambigüedad al teléfono, y después hay que arreglarla en dos lugares.

### B-4 · `#1004` — La nota de crédito se emite sin número reservado

- **Medido:** la NC no reserva número; la factura sí. **El fix ya existe en el otro call-site.**
- **DoD:** la NC reserva por el **mismo** mecanismo que la factura. **Propagar el fix existente, no
  diseñar uno nuevo** — y grepear el patrón del fix para ver si hay un tercer call-site.
- **Depende de:** B-2 (la NC tiene que ser distinguible antes de tratarla distinto).

---

# Bloque C · El alta

*Dueño: **backend** + **frontend**. **Las decisiones del operador bloquean el CIERRE de este bloque,
no el arranque del sprint.***

> **Por qué el bloque C no para a nadie:** `_email_en_allowlist` (`apps/copiloto/web.py:581`) gobierna
> el **alta**, no el **login** de una cuenta existente. La prueba estaba a la vista: el usuario
> canónico viene corriendo smokes y **no está** en la allowlist — si ésta gobernara el login, nunca
> habría podido entrar. Los bloques A, B, D y F corren con ese usuario, hoy.

### C-1 · `#999` — La allowlist es fail-closed: sin esa env no entra ningún email

- **Medido:** `apps/copiloto/web.py:581-583`. El proceso vivo tiene **4 entradas**, todas del operador.
  (Son 4, no 1 como decía el doc de arranque.) **No se publican las direcciones:** es dato personal,
  va la cantidad.
- **Consecuencia:** con la app perfecta, hoy un usuario externo **no entra**, ni por Google.
- **DoD:** un email nuevo completa el alta **sin que nadie edite una env var ni la DB**.
- **Depende del operador:** decisión 1 del §7 del plan (beta por invitación con UI, o alta abierta).

### C-2 · `#1000` — El alta por email de web no se puede completar

- **Medido:** el backend exige `invite_token` y el cliente **nunca lo manda**; además el formulario
  sólo se abre con `?signup=1` en la URL.
- **DoD:** alta por email de punta a punta, con test del **camino real** — el de producción, por el
  composition root, no un happy-path mockeado. *Causa:* un test que no usa el camino de producción no
  puede verlo fallar.
- **Bloquea:** C-3.

### C-3 · `#1016` — Mobile no tiene alta de cuenta

- **Medido:** `POST /auth/signup` (`apps/copiloto/web.py:1294`) es **sólo-web** en el mapa de 109
  endpoints; el propio código de mobile lo dice en
  `apps/mobile/src/modules/cuenta/PantallaCuenta.tsx:58`.
- **DoD:** un email nuevo completa el alta **desde el teléfono**, acepta el legal, y entra.
- **Depende de:** C-1 + C-2. **Causa:** construir la pantalla contra un contrato de alta que todavía
  no cierra es codificar la esperanza.
- **Es el criterio 1 del DoD del sprint.**

### C-4 · `#1001` — La aceptación legal no condiciona nada, y mobile no la cablea

- **Medido, en dos mitades distintas:**
  1. La **pantalla de lectura de mobile ya existe** — `apps/mobile/src/modules/ajustes/PantallaLegal.tsx:31`,
     montada en `apps/mobile/app/legal.tsx:17`. ⚠️ Este issue decía antes «mobile no tiene pantalla de
     aceptación legal» y habría mandado a alguien a **construir una pantalla que existe**. Lo que
     falta es el **botón de aceptar** y la llamada a `POST /me/legal/aceptar` (`web.py:1143`).
  2. La aceptación **no condiciona nada en ninguna plataforma**: se puede operar sin haber aceptado.
- **DoD:** un alta nueva **no puede operar** sin aceptar, en las dos plataformas; mobile llama el
  endpoint y guarda la versión aceptada. **Test del caso hostil:** una cuenta sin aceptación vigente
  es **rechazada** al operar — no sólo «la que aceptó puede».
- **Depende del operador:** decisión 2 del §7 (el texto legal está declarado **PROVISORIO** hasta
  revisión de un abogado). El **cableado** no espera ese texto; el **cierre** sí.

### C-5 · `#1002` — Sin SMTP no hay recuperación de contraseña

- **Medido:** no hay proveedor configurado ⇒ ni recuperación de clave ni cambio de email.
- **DoD:** el usuario recupera su clave **sin intervención de nadie**.
- **Depende del operador:** decisión 3 del §7 (proveedor + DNS).

---

# Bloque D · Paridad mobile

*Dueño: **frontend**. **No depende del bloque C**: se mide con el usuario canónico, que ya entra.*

### D-1 · `#1017` — El chat de mobile no tiene renderer de artefactos ni desambiguación multi-opción

- **Medido, y lo declara el propio código:** `apps/mobile/src/modules/chat/Burbuja.tsx:23` y
  `apps/mobile/src/modules/chat/ListaMensajes.tsx:356`.
- **Consecuencia:** una respuesta con **3+ opciones** no se puede elegir en el teléfono, y un artefacto
  post-confirmación no se muestra. Es la pieza más grande del criterio 7.
- **DoD:** un `choices` de 3+ opciones se renderiza y es **elegible** en mobile, y un artefacto
  post-confirmación se muestra. **Medido en device**, no en el emulador.
- **Contexto que desbloquea esto:** el motor corre en modo **`react`** en web y en worker — medido en
  el **proceso vivo**, no deducido del repo (donde el default es `dispatch`). ⇒ las cards propuestas
  son alcanzables y el criterio 7 **no** está bloqueado por configuración.
  *Lección:* una propiedad que decide un criterio y vive sólo en el ambiente **no se deduce del
  código**; se mide con un comando sobre el proceso.

### D-2 · `#1018` — Mobile no tiene los bloques de agregado que web sí

- **Medido:** faltan «facturado del mes» y el resumen de presupuestos.
- **DoD:** los dos bloques existen **y su cifra coincide con la del detalle** para el mismo mes.
- **Depende de:** B-3 (el predicado único). **Es el criterio 6 del DoD del sprint.**

### D-3 · `#1019` — «Tus apps» y los modos están escritos e inalcanzables en web

- **Medido:** `'apps'` **no está** en `TABS`; los dos shells de web lo declaran ellos mismos. No
  existe en mobile.
- **Por qué es el ítem que ahorra trabajo:** parecía una feature de web **para portar**. Portarla
  habría sido construir en el teléfono algo que en web **no se puede ni probar**. Es un ítem de
  **decisión**, no de implementación.
- **DoD:** ejecutado en **una** de las dos direcciones, sin tercera:
  **(a)** cableado y alcanzable en web + portado a mobile, **o**
  **(b)** retirado de web — pantalla, `modeStore`, `ModeButton` y el chip del composer — con el `mode`
  del `send()` limpiado.
- **Depende del operador:** decisión 4 del §7.
- ⚠️ **Medido estáticamente** (no está en `TABS`), no ejecutando la app. Si se elige (b), confirmar en
  runtime antes de borrar.

### D-4 · `#1021` — Tres filas de «Mi cuenta» en web prometen y no hacen nada

- **Medido:** dos `<div>` **sin `onClick`** y un toggle **sin endpoint**. Estaban por portarse a mobile
  **así como están**.
- **DoD:** cada una **se cablea o se retira de la UI**. Ninguna queda visible prometiendo. Y el
  docstring de `AccountScreen` deja de citarlas como capacidad existente — *si el comentario sigue
  afirmándolas, el próximo las vuelve a portar.*

### D-5 · `#1007` — La card de confirmación queda activa después de responderla

- **DoD:** la card responde **una vez** y queda resuelta; un segundo toque **no reenvía**.
- **Criterio 7 del DoD del sprint.** El mecanismo canónico de las cards por voz dice que nunca se
  pregunta dos veces: una card que sigue activa lo viola de hecho.

### D-6 · `#1008` — La app dice «No lo anotamos.» sobre un ingreso que sí quedó guardado

- **DoD:** el mensaje refleja el resultado **real** de la escritura. Test del caso en que la escritura
  **sí** ocurrió — es la mitad que el happy-path no cubre: hoy el camino feliz y el fallido muestran
  el mismo texto.

### D-7 · `#1009` — Anular un comprobante falla en silencio

- **Medido:** `try/finally` **sin `catch`** ⇒ la excepción se pierde y el usuario no ve nada.
- **DoD:** el fallo **se ve** (el usuario recibe el error) y el estado no queda a medias.
- **Criterio 3 del DoD del sprint.**

---

# Bloque E · Promesas sin rama

### E-1 · `#1005` — Un Responsable Inscripto lee «ya podés facturar» y la emisión explota

- **Medido:** la promesa se muestra y la emisión levanta `NotImplementedError`.
- **DoD:** **o** la emisión funciona para ese caso, **o** la promesa no se muestra. **Nunca las dos.**

### E-2 · `#1006` — El catálogo de apps anuncia herramientas que fueron podadas

- **DoD:** lo anunciado y lo cableado coinciden, **ítem por ítem** (no «en general»).

### E-3 · `#1020` — Cinco capacidades del backend cableadas que nadie llama

- **Medido:** 5 endpoints que **ninguna** app consume; **3** de ellos ya tienen la función del cliente
  compartido escrita y **sin consumidor**.
- **DoD:** cada una clasificada **explícitamente**: se cablea (con dueño y pantalla) o se retira
  (endpoint + función del core). **Ninguna queda en el medio** — una capacidad a medias es la que el
  próximo relevamiento vuelve a contar como hueco.
- **Depende del operador:** decisión 5 del §7.
- **Nota aparte, fuera de alcance:** `POST /warm` también es SOLO_WEB. Mobile no pre-calienta el chat
  ⇒ primera respuesta más lenta. Es rendimiento, no capacidad: no bloquea ningún criterio.

---

# Bloque F · Evidencia en device

*Dueño: **frontend**, dueño **único** del device. **Es el criterio 8: sin este bloque el sprint no
cierra, aunque los otros siete estén verdes.***

### F-1 · `#1011` — Las 6 cadenas de negocio nunca se midieron de punta a punta en device

- **DoD:** las 6 con veredicto del vocabulario cerrado y su `medido_contra:`.
- **Depende de:** A-1.

### F-2 · `M-02` — Medir en device los 46 ids que faltan

- **Medido:** `scripts/evidencia/falta-en-mobile.py` los lista por nombre. Mobile: **8** comparados de
  verdad · **5** cubiertos sin comparación · **41** sin nada ⇒ **46 a medir**.
- **Por qué 46 y no 41:** la cifra que circulaba, «mobile 13/54», cuenta como cubiertos 5 ids cuyos
  únicos veredictos son `PENDIENTE_DEVICE`/`NO_MEDIBLE` — **cubiertos, nunca comparados**. La cifra era
  correcta y engañosa a la vez.
- **DoD:** cada id con veredicto del vocabulario cerrado y su `medido_contra:`. Por lotes, con un
  `avance_` por lote.
- **Depende de:** A-1.

### F-3 · `M-03` — Los 5 ids cubiertos sin comparación

- `cobro-voz` · `fact-voz` · `onb-cumplida` · `pres-voz` · `vozchat`.
- **DoD:** veredicto real y **salen de esa población** (que `falta-en-mobile.py` los deje de listar).

### F-4 · `#1013` — El APK de dev-client se evapora de EAS a los 14 días

- **DoD:** la receta de reconstrucción existe **y se ejercitó una vez**. Una receta no ejercitada es
  una promesa.

### F-5 · `M-04` — Tester externo con video

- **DoD:** el video existe y **cada hallazgo entra como fila** del registro, con id y veredicto — no
  como impresión en prosa. Una impresión no se puede volver a medir.

---

## Dependencias, en una tabla

| ítem | depende de | causa de la dependencia |
|---|---|---|
| A-2 | A-1 | sin gesto confiable, un rojo no se puede atribuir |
| F-1 F-2 | A-1 | ídem: habría que repetir las mediciones |
| B-4 | B-2 | la NC tiene que ser distinguible antes de tratarla distinto |
| D-2 | B-3 | portar el bloque antes de unificar importa la ambigüedad |
| C-3 | C-1 C-2 | la pantalla necesita un contrato de alta cerrado |
| **todo B** | **nada** | **arranca hoy; y va antes de C a propósito** |
| **todo D** | **nada de C** | se mide con el usuario canónico, que ya entra |

**Por qué B va antes de C**, aunque el alta sea el criterio 1: hoy no hay tráfico real, así que el
dinero mal contado es **latente**. Abrir el alta primero lo invierte — el primer usuario real pasa a
ser **quien descubre** que su cobro se cuenta dos veces. Un bloqueante del DoD no es automáticamente
lo primero de la cola.

---

## Recetas que ya existen (no redescubrir)

- **Iterar en device no compila nada:** dev-client ya instalado + Metro local por USB.
- **El device no corre `main`** — corre lo que Metro sirve, y Metro sirve el **checkout compartido**,
  no tu worktree. Pedile que se identifique antes de atribuir un resultado.
- **Gestos:** `adb input motionevent` DOWN/MOVE/UP. **Nunca `input tap`** — no ejercita un `Pan` de
  RNGH y produce un falso «no responde».
- **Device con dueño único.** Dos ADB a la vez fabrican evidencia falsa.
- **Un solo usuario de prueba canónico, a fuego.** Ningún agente elige otro.
- **Gate antes de cualquier PR:** `scripts/gate.sh` escribe `.ci-recibos/<sha>.json`; el merge cita el
  recibo del SHA que mergea. GitHub verde es la **segunda** confirmación, no la única.
- **Checkout compartido:** `git add` con **rutas explícitas**. Nunca `-A`, `--amend`, `rebase`,
  `reset`, `checkout`, `pull`, `stash`, `clean`.

---

## Deudas y riesgos declarados

| | |
|---|---|
| ⚠️ **B-1 y B-2 están escritos, verificados y SIN MERGEAR** | el defecto sigue en `main` aunque el issue parezca atendido |
| ⚠️ **`PantallaFacturacion.tsx` del checkout compartido está ATRASADO** | commitearlo tal como está revierte **+102 líneas** de la rama en vuelo. Medir el **signo** por archivo, contra `main`. Los 4 rojos y 8 errores de `tsc` de la suite mobile (986/991) caen todos ahí y **no son defecto de `main`** |
| ✅ **REFUTADO: `/actividad?q=` NO da 400** | medido el 11/10 contra el handler: `apps/copiloto/actividad_web.py:99` declara `q: str = ""`, `:112` dice «`q` YA está implementada: ILIKE sobre título+detalle», `:120` la pasa al store. Lo del 400 lo afirmaba un **comentario** de mobile, ya corregido. **Tercer caso del día** de un comentario que declara un estado, sobrevive al cambio y el próximo lector le cree (los otros dos: B-1 y `#1001`). **No hay nada que esperar de backend acá** |
| 🆕 **Asimetría de búsqueda web↔mobile** | medido: web busca **global** (`ActividadScreen.tsx:84`), mobile sólo **por función** (`BuscadorActividad.tsx:77`). Las dos pasan `q` y `q` funciona ⇒ no es un defecto, es una **decisión de UX sin dueño**: el docstring de mobile argumenta su lado y nadie comparó. Clasificar antes de cerrar la paridad |
| ✅ **RESUELTO: `app/recientes.tsx` SÍ es alcanzable** | medido el 11/10: `apps/mobile/src/shell/PantallaPrincipal.tsx:179` cablea `onVerRecientes={() => empujarUnaVez('/recientes')}` al encabezado **tapeable** «Actividad reciente», con test verde (`PantallaPrincipal.test.tsx:146`). El `_layout.tsx` decía «queda inalcanzable» — **rancio, ya corregido**. **Sin tile ≠ inalcanzable.** ⚠️ Ese comentario invitaba a **borrar una pantalla alcanzable**; el único caso realmente inalcanzable de esa lista es `'apps'` (`#1019`). **Cuarto caso del día** del mismo mecanismo. (Y mi fila anterior citaba `PantallaPrincipal.tsx:179` sin su directorio: el archivo vive en `src/shell/`, no en `modules/principal/`) |
| Paridad de **parámetros** no medida | un endpoint que las dos apps llaman puede invocarse con menos capacidad de un lado, y la tabla de 109 lo marca `AMBAS` igual. Segundo pase si ese eje importa |
| `/admin/*` **fuera de alcance** | 12 endpoints + `AdminScreen.tsx:114`. Es herramienta del operador, no del emprendedor: su ausencia en mobile **no es** hueco de paridad |
| `web` cuenta 54/54, de los cuales **9 sin comparación** | dato, no acción: `DEC-18`, un hallazgo nuevo **no reabre** un criterio cerrado |

---

**Mantenimiento de este backlog:** los issues se abren/sincronizan con
`scripts/abrir-issues-sprint.sh`, idempotente — compara por **título exacto** contra abiertos **y**
cerrados antes de crear. ⚠️ **Si corregís el título de un issue por `gh`, sincronizá el script**: su
idempotencia se decide por ese título, y uno desactualizado **fabrica duplicados**. Ya pasó hoy: tres
títulos editados a mano habrían creado tres duplicados en la corrida siguiente.
