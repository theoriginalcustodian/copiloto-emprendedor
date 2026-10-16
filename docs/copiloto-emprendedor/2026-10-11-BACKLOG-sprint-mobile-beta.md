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

## Estado de las 26 fichas — ESTE es el registro de verdad

**No se marca a mano.** La sesión que termina pone la evidencia en su `cierre_` (`FICHA:` · `SHA:` ·
`DOD:` una línea por punto); el estado lo **escribe el script**:

```
python -I -X utf8 scripts/sprint-estado.py --marcar SM-B3 --estado TERMINADO --cierre "merge <sha> - DoD(1) … - DoD(2) …"
python -I -X utf8 scripts/sprint-estado.py --check    # el gate; corre en scripts/ci/lint.sh
```

`TERMINADO` **exige el DoD completo**, no el merge commit: el sha es una de las evidencias. Si hay
código en main pero el DoD no está cerrado, el estado es `DOD-PARCIAL` **con `Falta:`**. La norma
completa y el por qué están en `CLAUDE.md §3.quater.bis`.
<!-- TABLA-ESTADO:INICIO (generada por scripts/sprint-estado.py --tabla - NO editar a mano) -->

| Ficha | Issue | Estado | Que falta del DoD / evidencia de cierre |
|---|---|---|---|
| **SM-A1** | `#1010` | ✅ TERMINADO | merge ea810b7a (#1178) - DoD(1) abre al primer toque 6 de 6 ciclos con pestana visible, escalas de animacion en valor… |
| **SM-A2** | `#1012` | ✅ TERMINADO | evidencia docs/copiloto-emprendedor/Auditorias/2026-10-14-SM-A2-eje-A-las-21-rutas-en-device.md (medido contra main e… |
| **SM-B1** | `#1014` | ✅ TERMINADO | merge 6d3b3579 (PR #1023, 12-10) - CI 6/6 SUCCESS (gh pr view 1023) - DoD: el pago MercadoPago deja de contarse dos v… |
| **SM-B2** | `#1015` | ✅ TERMINADO | merge 6d3b3579 (PR #1023, 12-10) - CI 6/6 SUCCESS - DoD: la fila vale nota_credito y la app ya no ofrece anular una NC |
| **SM-B3** | `#1003` | ✅ TERMINADO | merge bf8eb87e (PR #1045, 13-10) - CI 6/6 SUCCESS - DoD: un predicado en apps/copiloto/afip_rules.py + test_facturado… |
| **SM-B4** | `#1004` | ✅ TERMINADO | merge bf8eb87e (PR #1045, 13-10) - CI 6/6 SUCCESS - DoD: la NC reserva por el mismo mecanismo que la factura (test_af… |
| **SM-C1** | `#999` | ✅ TERMINADO | sin-codigo - decision del operador 12-10 registrada en ff42a5f7 (PR #1028); el DoD de esta ficha es explicitamente 'n… |
| **SM-C2** | `#1000` | ✅ TERMINADO | merge ec54c998 (#1275, web: la puerta al alta sin ?signup=1) + 6c63bf8d (#1162, camino real GoTrue+Postgres signup->l… |
| **SM-C3** | `#1016` | ✅ TERMINADO | merge bb42cfe0 (mobile) y f037307e (web) en main; medido 15-10 contra 2e7d2af5 con el canonico: DoD(1) predicado unic… |
| **SM-C4** | `#1001` | 🗳️ CERRADO-POR-DECISION | [TERMINAL - cerrada por decision del operador 2026-10-15] NO_MEDIBLE por DECLARAR (operador 15/10): falta UNA CUENTA … |
| **SM-C5** | `#1002` | ⏭️ DIFERIDO | bloqueada en el OPERADOR: SMTP espera dominio/DNS (avance_ backend 14-10, sin cambio desde 07-25). El DoD 'el usuario… |
| **SM-D1** | `#1017` | 🟧 DOD-PARCIAL | device con el sustrato REAL (las 2 choices de confirmacion se ven y se eligen + artefacto post-confirmacion con su en… |
| **SM-D2** | `#1018` | 🗳️ CERRADO-POR-DECISION | [TERMINAL - cerrada por decision del operador 2026-10-15] (1) portada.mes.facturado == detalle CON filas en el mes EN… |
| **SM-D3** | `#1019` | ✅ TERMINADO | merge 7d27fcc4 - DoD(1) rama (b) ejecutada: retirados de web la pantalla modules/apps, modeStore, ModeButton y el chi… |
| **SM-D4** | `#1021` | ✅ TERMINADO | merge 84edfa11 - DoD(1) las tres filas (Idioma, Notificaciones, Privacidad del historial) retiradas de la UI de Mi cu… |
| **SM-D5** | `#1007` | ✅ TERMINADO | merge 2d198a96 (PR #1165) + device medido por frontend2 contra main@ea810b7a, cierre_ SM-D5/SM-D7 en buzon |
| **SM-D6** | `#1008` | ✅ TERMINADO | merge 2d198a96 - DoD(1) el mensaje refleja el resultado real de la escritura: TarjetaPropuesta.escrituraFallida.test.… |
| **SM-D7** | `#1009` | ✅ TERMINADO | merge 2d198a96 (PR #1165) + device medido por frontend2 contra main@ea810b7a, cierre_ SM-D5/SM-D7 en buzon |
| **SM-D8** | `GASTOSCATEG` | ✅ TERMINADO | merge 4c405783 (PR #1201, cierre_ de frontend2 del 14-10, ancestro de origin/main verificado) - DoD(1) control positi… |
| **SM-E1** | `#1005` | ✅ TERMINADO | merge 1966c340 - 4 puntos del DoD enmendado (8f578bfd) en main con tests: mobile 4 pass / web 5 pass, control positiv… |
| **SM-E2** | `#1006` | ✅ TERMINADO | 716e63da4460cf02abaa7b6ee825124e697e8c43 |
| **SM-E3** | `#1020` | 🗳️ CERRADO-POR-DECISION | [TERMINAL - cerrada por decision del operador 2026-10-15] CODIGO COMPLETO y DEVICE MEDIDO 7/7 el 15-10 (cierre_ de fr… |
| **SM-F1** | `#1011` | ✅ TERMINADO | Las 6 cadenas con veredicto y medido_contra main@ea810b7a/prod 9e536c38: 4,5,6 COHERENTE; 3 COHERENTE manual + MP NO_… |
| **SM-F2** | `M-02` | 🗳️ CERRADO-POR-DECISION | [TERMINAL - cerrada por decision del operador 2026-10-15] quedan 14 sin comparar en mobile: (home) sin ningun veredic… |
| **SM-F3** | `M-03` | 🗳️ CERRADO-POR-DECISION | [TERMINAL - cerrada por decision del operador 2026-10-15] onb-cumplida: NO_MEDIBLE, exige Mercado Pago y Google conec… |
| **SM-F4** | `#1013` | ✅ TERMINADO | merge aeeb3eab (PR #1157, la receta) - DoD(1) la receta existe: docs/copiloto-emprendedor/2026-10-14-receta-rebuild-d… |
| **SM-F5** | `M-04` | ⏭️ DIFERIDO | — |

<!-- TABLA-ESTADO:FIN -->

# Bloque A · Instrumento confiable

*Dueño: **frontend** (dueño único del device). Nada de este bloque depende del operador.*

### SM-A1 · `#1010` — El toque de la pestaña del escritorio es intermitente

- **Estado:** TERMINADO
- **Dueno-activo:** frontend2
- **Cierre:** merge ea810b7a (#1178) - DoD(1) abre al primer toque 6 de 6 ciclos con pestana visible, escalas de animacion en valor normal (null) y sensor por pixeles, device RF8T318RN9T, medido_contra main@2927faa6 - DoD(2) control positivo en la corrida: arrastre de 1000 px mueve la franja 26,7 pct; original 0 de 4 ciclos (12 toques) con Metro reiniciado entre variantes
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
- **Bloquea:** SM-A2, SM-F1, SM-F2, SM-F3.

### SM-A2 · `#1012` — El eje A tiene 1 ruta verificada de 21

- **Estado:** TERMINADO
- **Dueno-activo:** frontend2
- **Cierre:** evidencia docs/copiloto-emprendedor/Auditorias/2026-10-14-SM-A2-eje-A-las-21-rutas-en-device.md (medido contra main ea810b7a, prod 9e536c38) - DoD(1) las 21 rutas con veredicto del eje A: 19 LLEGA, 1 NO_LLEGA (/midia: cero call-sites), 1 NO_ATRIBUIBLE (/agenda: Calendar caido en el tenant) - DoD(2) animaciones en valor normal; control positivo (tile abre) y negativo (toque en zona vacia, captura byte-identica) en la misma corrida
- **Medido:** **1 válida de 21.** 15 nunca se intentaron; 5 quedaron `NO_ATRIBUIBLE` al retirar `H-60`.
- **DoD:** las **21** con veredicto del vocabulario cerrado, medidas con animaciones en valor normal.
- **Evidencia:** por corrida, su control positivo. Un rojo sin control positivo válido es
  `NO_ATRIBUIBLE`, no un hallazgo.
- ⚠️ **`Auditorias/2026-10-11-receta-device-resultado.json` es un artefacto pre-retracción.** Sus
  celdas `NO_LLEGA` para `/gastos` e `/ingresos` están invalidadas. No citarlo como estado.
- **Depende de:** SM-A1. **Causa:** hasta que el gesto de apertura sea confiable, el instrumento no
  separa «la ruta no responde» de «mi gesto se perdió», y los 21 veredictos habría que repetirlos.

---

# Bloque B · El dinero

*Dueño: **backend**. Arranca **hoy**: no depende de ninguna decisión del operador ni del alta.*

### SM-B1 · `#1014` — Un pago de MercadoPago se cuenta dos veces en «Entró» · ✅ MERGEADO (12/10)

- **Estado:** TERMINADO
- **Cierre:** merge 6d3b3579 (PR #1023, 12-10) - CI 6/6 SUCCESS (gh pr view 1023) - DoD: el pago MercadoPago deja de contarse dos veces
- **Medido:** `apps/copiloto/mp_web.py:53-71` escribe en **las dos** tablas que el `UNION ALL` de
  `apps/copiloto/inteligencia_queries.py:43-49` une. Presente desde el 06/10.
- **Y la mitad que estaba mal:** este ítem también afirmaba «cero veces en Ingresos». **Era falso** —
  salió de un **comentario** del código, no de la función que escribe. El doble conteo sí era real.
  *Lección:* grepeá quién **escribe** el campo, no quién lo lee ni quién lo comenta.
- **DoD:** un pago MP insertado aparece **una** vez en «Entró» y **una** en Ingresos, con test que lo
  **cuente** (no que verifique «aparece»: aparecer dos veces también es aparecer).
- **Evidencia:** **2297 passed / 0 failed** en el VPS, más control positivo: revertido el fix caen
  2 tests con los números del defecto. Medido sobre la rama de entonces; **la procedencia citable
  hoy es el merge commit** `6d3b3579` (PR #1023), porque esa rama ya no existe.
- ✅ **CERRADO:** mergeado en `main` en `6d3b3579` (PR #1023); issue cerrado el 12/10. La rama
  `backend/entro-cuenta-el-pago-mp-dos-veces` ya no existe ⇒ **citá el merge commit**, no
  `ba1f8cbd`, que no se resuelve en un clon.

### SM-B2 · `#1015` — Ninguna fila valía `nota_credito`, y la app ofrecía anular una nota de crédito · ✅ MERGEADO (12/10)

- **Estado:** TERMINADO
- **Cierre:** merge 6d3b3579 (PR #1023, 12-10) - CI 6/6 SUCCESS - DoD: la fila vale nota_credito y la app ya no ofrece anular una NC
- **Medido:** el store escribía `estado` con un default único; **ninguna** fila podía valer
  `nota_credito`, así que una NC quedaba indistinguible de una factura y los fronts le ofrecían
  «Anular». Era la **raíz** de tres síntomas, no tres defectos.
- **DoD:** una NC se guarda como `nota_credito` y ningún front le ofrece «Anular». Un `estado`
  explícito pasado por el llamador **sigue ganando** a la derivación (si no, el fix rompe a quien ya
  lo pasaba).
- **Evidencia:** 17/17 en el VPS + control positivo fallando con `'emitida' != 'nota_credito'`, en
  `apps/copiloto/afip_comprobante_store.py`. Procedencia citable: `6d3b3579` (PR #1023).
- ✅ **CERRADO:** mergeado en `6d3b3579` (PR #1023) junto con SM-B1; issue cerrado el 12/10. Mismo criterio de
  procedencia: el merge commit, no `fca3abae`.

### SM-B3 · `#1003` — «Lo facturado» se calcula con cuatro predicados distintos

- **Estado:** TERMINADO
- **Cierre:** merge bf8eb87e (PR #1045, 13-10) - CI 6/6 SUCCESS - DoD: un predicado en apps/copiloto/afip_rules.py + test_facturado_predicado_unico.py pide el MISMO mes a las 4 superficies y exige la MISMA cifra (caso discriminante: factura anulada + NC)
- **Medido:** cuatro lugares responden «qué facturó este mes» con **cuatro** criterios diferentes
  según quién pregunte.
- **DoD:** **un** predicado, en un solo lugar, y los cuatro llamadores lo usan. Test que compare las
  cuatro respuestas **para el mismo mes** y exija igualdad.
- **Bloquea:** SM-D2. **Causa:** portar el bloque «facturado del mes» a mobile antes de unificar
  importa la ambigüedad al teléfono, y después hay que arreglarla en dos lugares.

### SM-B4 · `#1004` — La nota de crédito se emite sin número reservado

- **Estado:** TERMINADO
- **Cierre:** merge bf8eb87e (PR #1045, 13-10) - CI 6/6 SUCCESS - DoD: la NC reserva por el mismo mecanismo que la factura (test_afip_anulacion_workflow.py +44)
- **Medido:** la NC no reserva número; la factura sí. **El fix ya existe en el otro call-site.**
- **DoD:** la NC reserva por el **mismo** mecanismo que la factura. **Propagar el fix existente, no
  diseñar uno nuevo** — y grepear el patrón del fix para ver si hay un tercer call-site.
- **Depende de:** SM-B2 (la NC tiene que ser distinguible antes de tratarla distinto).

---

# Bloque C · El alta

*Dueño: **backend** + **frontend**. **Las decisiones del operador bloquean el CIERRE de este bloque,
no el arranque del sprint.***

> **Por qué el bloque C no para a nadie:** `_email_en_allowlist` (`apps/copiloto/web.py:581`) gobierna
> el **alta**, no el **login** de una cuenta existente. La prueba estaba a la vista: el usuario
> canónico viene corriendo smokes y **no está** en la allowlist — si ésta gobernara el login, nunca
> habría podido entrar. Los bloques A, B, D y F corren con ese usuario, hoy.

### SM-C1 · `#999` — Altas manuales en beta: la allowlist se queda, y eso es una DECISIÓN

- **Estado:** TERMINADO
- **Cierre:** sin-codigo - decision del operador 12-10 registrada en ff42a5f7 (PR #1028); el DoD de esta ficha es explicitamente 'ninguno de codigo'
- **Medido:** `apps/copiloto/web.py:1433` corta el autoprovisioning con
  `403 "alta por invitación: email no habilitado"`, y el comentario del propio código dice por qué:
  *«el chequeo de proveedor OAuth de arriba NO es una barrera de alta — sin esto, cualquier cuenta de
  Google del planeta se autoprovisionaba un tenant»*. El proceso vivo tiene **4 entradas**, todas del
  operador. **No se publican las direcciones:** es dato personal, va la cantidad.
- **⚠️ Lo que este renglón decía antes y era un mal encuadre:** *«con la app perfecta, hoy un usuario
  externo no entra, ni por Google»*. Es verdad como hecho y **falso como defecto**. El **ingreso**
  funciona —Google y email— y está probado; lo cerrado es el **alta de alguien nuevo**, y está cerrado
  **a propósito**. Confundir las dos cosas hizo que este bloque se leyera como roto.
- **DECISIÓN DEL OPERADOR (2026-10-12):** en beta las altas se hacen **a mano**, sólo para personas
  cercanas. Los permisos de login los otorga el operador. **La allowlist se queda tal cual** y la UI
  para cargarla **sale del alcance** de este sprint.
- **DoD:** ninguno de código. Este renglón cierra **por decisión**, no por implementación.
- **Ya NO bloquea SM-C3.** Lo único que seguía abierto del alta era qué se le pide a la persona la
  primera vez, y eso es SM-C3.

### SM-C2 · `#1000` — El alta por email de web no se puede completar

- **Estado:** TERMINADO
- **Cierre:** merge ec54c998 (#1275, web: la puerta al alta sin ?signup=1) + 6c63bf8d (#1162, camino real GoTrue+Postgres signup->login->/me) + f3b60672 (#1206, gate invite_token retirado del backend) - DoD(1) alta por email punta a punta: puerta visible en la entrada (App.test.tsx monta App entero y llega al alta sin ?signup=1), POST /auth/signup {email,password} sin invite_token (SignupScreen.tsx -> web.py SignupIn, mismo shape; test_alta_email_camino_real.py:100 lo postea identico), login encadenado y /me; adversarial sin invite no crea user ni tenant - DoD(2) test del camino real por composition root: test_alta_email_camino_real.py (backend, GoTrue+Postgres reales) + App.test.tsx (web) - desplegado 16-10: prod sirve data-build-sha=ec54c998 y el bundle index-CVTd4rjL.js contiene 'Crear una nueva cuenta' (curl); NO se corrio un alta real en prod (fabricaria un usuario de produccion): la costura UI->API se verifico por contrato leido en ambos lados, no por una corrida unica
- **Medido:** el backend exige `invite_token` y el cliente **nunca lo manda**; además el formulario
  sólo se abre con `?signup=1` en la URL.
- **DoD:** alta por email de punta a punta, con test del **camino real** — el de producción, por el
  composition root, no un happy-path mockeado. *Causa:* un test que no usa el camino de producción no
  puede verlo fallar.
- **Bloquea:** SM-C3.

### SM-C3 · `#1016` — El gate del primer ingreso existe; lo que falta es QUÉ pide

- **Estado:** TERMINADO
- **Dueno-activo:** frontend2
- **Cierre:** merge bb42cfe0 (mobile) y f037307e (web) en main; medido 15-10 contra 2e7d2af5 con el canonico: DoD(1) predicado unico faltantesDelPerfilMinimo/perfilMinimoCompleto en packages/core/src/api/onboarding.ts importado por las dos apps; DoD(2) device y web: 409 real -> paso perfil, vacio/espacios/un solo campo NO entra; DoD(3) tests adversariales PantallaOnboarding.test.tsx:269,282 y Onboarding.test.tsx:299; DoD(4) control positivo: los dos llenos entran al shell en device y web
- **⚠️ Este renglón decía «Mobile no tiene alta de cuenta». Medido el 2026-10-12: es FALSO.** El gate
  del primer ingreso está **implementado en las dos apps, con predicado único**:

  | | |
  |---|---|
  | predicado | `packages/core/src/api/onboarding.ts:18` — `debeMostrarOnboarding`, **una** definición |
  | web | `App.tsx` enruta por `me.onboarding_completado` · tests `App.test.tsx:181,189` |
  | mobile | `apps/mobile/app/_layout.tsx:98` + `Guard` · tests `Guard.test.tsx:73,80` |
  | se cierra con | `POST /me/onboarding/completar` → `TenantOnboardingStore` |

  Cómo entró el error: el mapa de 109 endpoints marcó `POST /auth/signup` como sólo-web, y de ahí
  concluí «mobile no tiene alta». El endpoint sí es sólo-web — pero el **primer ingreso** no pasa por
  él cuando el alta la hace el operador. Un nombre, dos referentes.

- **Lo que el onboarding pide hoy son CONEXIONES, no datos:** `PantallaOnboarding.tsx:24-25` ofrece
  Mercado Pago y Google, pasos `promesa` → `recibo`. Los **datos del negocio** son otra cosa y viven
  en Ajustes (`perfil_negocio_store.py:54`, 10 campos), **todos opcionales y con default**
  (`_DEFAULTS:59`) — el core declara explícito que vacío *«no es un error: es el estado normal del
  primer día»*.

- **DECISIÓN (2026-10-12, delegada por el operador: «de momento algunos básicos, podés decidirlos
  vos»).** Obligatorios para pasar del onboarding a la app: **`que_vende` y `nombre_comercial`.**
  Dos campos de texto, una vez, ~10 segundos.
  - **`que_vende`** — de él depende todo lo que el copiloto *hace*: la descripción de un comprobante,
    la categorización de un gasto, el tono de una respuesta. Es el campo de mayor valor por carácter
    tipeado.
  - **`nombre_comercial`** — va en los comprobantes y en cómo el copiloto nombra al negocio.

- **🔴 Por qué `a_quien` NO entra, aunque sea el que más querría:** cambia el tipo de comprobante
  (A vs B) y sería el tercero natural. **Pero su default es `"ambos"`** y `upsert` *«crea la fila con
  los DEFAULTS del resto»* (`perfil_negocio_store.py:97-99`), así que después del primer POST el campo
  vale `"ambos"` **haya elegido o no**. Un check de «no vacío» sobre él **siempre pasa**: sería un gate
  hueco, de la familia de *un degradado prudente hacia el caso benigno envenena la medición*. Para
  exigirlo hace falta un **tercer estado** (columna nullable o flag `perfil_completado`), y eso es
  diseño de schema. **Deuda nombrada, no silenciada.**
  Los dos elegidos **no** tienen ese problema: su default es `""`, así que «no vacío» es señal real.

- **DoD:**
  1. El predicado vive en **UN** solo lugar, al lado de `debeMostrarOnboarding` en
     `packages/core/src/api/onboarding.ts`, y las dos apps lo importan. *Causa:* hoy mismo se pagó que
     `esAnulable` estuviera definido dos veces y el fix llegara a una sola mitad.
  2. Con `que_vende` o `nombre_comercial` vacío, **ninguna** de las dos apps deja pasar al shell.
  3. Test **adversarial** por app: perfil con uno de los dos vacío ⇒ no entra. Sin eso el control
     queda `[UNVERIFIED]` — el happy-path pasa igual si el gate no existe.
  4. Control positivo en el mismo test: con los dos llenos, entra.
- **No hay pantalla nueva que construir** en ninguna de las dos apps: el paso existe y los campos ya
  tienen editor en Ajustes.
- **Ya no depende de SM-C1** (cerrado por decisión) ni de SM-C2 (es el alta por **email de web**, camino
  distinto). **Sigue siendo el criterio 1 del DoD del sprint.**

### SM-C4 · `#1001` — La aceptación legal no condiciona nada, y mobile no la cablea

- **Estado:** CERRADO-POR-DECISION
- **Falta:** [TERMINAL - cerrada por decision del operador 2026-10-15] NO_MEDIBLE por DECLARAR (operador 15/10): falta UNA CUENTA CON LA ACEPTACION LEGAL PENDIENTE para ver el boton de aceptar de mobile y la version guardada tras aceptar; el canonico e2e-device@copiloto.test ya acepto la version vigente (2026-09-22) y no se toca. La mitad hostil (canario invertido, los dos lados) esta en main (#1183 c8cbc21b)
- **Decision:** operador, 2026-10-15 - DECLARAR: cierra sin la evidencia de device porque exige una cuenta con la aceptacion legal pendiente y el canonico no se toca. Ver docs/copiloto-emprendedor/2026-10-15-decisiones-del-operador-cierre-del-sprint-mobile.md §2
- **Medido, en dos mitades distintas:**
  1. La **pantalla de lectura de mobile ya existe** — `apps/mobile/src/modules/ajustes/PantallaLegal.tsx:31`,
     montada en `apps/mobile/app/legal.tsx:17`. ⚠️ Este issue decía antes «mobile no tiene pantalla de
     aceptación legal» y habría mandado a alguien a **construir una pantalla que existe**. Lo que
     falta es el **botón de aceptar** y la llamada a `POST /me/legal/aceptar` (`web.py:1143`).
  2. La aceptación **no condiciona nada en ninguna plataforma**: se puede operar sin haber aceptado.
     ✅ **Desde el 13-10 eso dejó de ser el defecto y pasó a ser el comportamiento DECIDIDO** — se mide
     para confirmarlo, no para corregirlo.
- **DoD (VIGENTE, reescrito 2026-10-14 al aplicar `LEGALNOOPERA`):** mobile **muestra** los terminos
  (`apps/mobile/src/modules/ajustes/PantallaLegal.tsx:31`), tiene **boton de aceptar** que llama
  `POST /me/legal/aceptar` (`apps/copiloto/web.py:1253`) y **guarda la version aceptada**; Mi cuenta
  distingue sus tres estados. La aceptacion **INFORMA, no bloquea**: una cuenta con
  `legal_aceptado=false` **opera igual**, y eso no es un agujero — es la decision.
- **Su mitad hostil, en la forma que corresponde — CANARIO INVERTIDO, y YA ESTA EN `main`:** ningun
  camino de produccion lee la aceptacion para decidir acceso, y el dia que alguien agregue el guard
  se pone **rojo**. `apps/copiloto/tests/test_legal_no_bloquea_canario.py` (AST, backend) +
  `packages/core/src/legalNoBloquea.canario.test.ts` (core + mobile + web), los dos con control
  positivo sobre fuentes mutadas en memoria y denominadores > 0 exigidos. Entraron en **#1183
  `c8cbc21b`** (14-10 15:15).
- 🔻 **SUPERSEDED — el DoD anterior pedia lo contrario y mandaba a construir un guard RETIRADO.**
  Decia «un alta nueva **no puede operar** sin aceptar» + «una cuenta sin aceptacion vigente es
  **rechazada** al operar», con dueno «backend (el guard que rechaza)», apoyado en la decision del
  **12-10** («obligatoria en las dos plataformas»). La decision del **13-10** —`LEGALNOOPERA`, v2
  «Informar», `docs/copiloto-emprendedor/2026-10-06-lo-que-espera-tu-decision.md:44-45`— es
  **posterior y la reemplaza**. Entre el 13-10 y hoy el doc siguio pidiendo el guard: **frontend2 lo
  cazo y no lo invento** (`dato_` del 14-10), que es exactamente lo correcto — la contradiccion era
  del contrato, no suya.
- ⚠️ **Y la regla dura de `CLAUDE.md` §Seguridad NO se esta salteando.** Exige test adversarial para
  todo control de **acceso/aislamiento**; aca la decision del operador es precisamente que la
  aceptacion **no es un control de acceso**. Cuando lo que hay que proteger es la **ausencia** de un
  guard, su test adversarial **es** el canario invertido: un test que exigiera el rechazo naceria
  rojo y se volveria escudo de los rojos propios
  (`memoria/el-primer-test-rojo-mata-la-suite-y-el-rojo-ajeno-se-vuelve-escudo-del-propio.md`).
- ✅ **De la decision del 12-10 sobrevive su otra mitad, y SIGUE VIGENTE:** se cablea YA
  **con el texto provisorio marcado como tal**; no se espera al abogado, y cuando llegue el texto
  definitivo se reemplaza el **contenido**, no el mecanismo. Lo que `LEGALNOOPERA` retiro es solo
  el «obligatoria / rechazada», no esto. **El marcado va VISIBLE en la pantalla**, no en un
  comentario del codigo: un comentario que declara un estado no lo comunica a nadie que no lea el
  fuente ([[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]]).
- **Falta, y es lo UNICO que falta:** **evidencia de device** del boton de aceptar y de la version
  guardada. **Nada de guard, nada de backend.** Dueno: **frontend2**, con su `cierre_`.
- ⚠️ **Hueco nombrado, NO bloqueante — es del operador:** la decision del 13-10 se tomo sobre «que
  hace la app si **la version aceptada ≠ la vigente**», y #1183 la aplico al caso **amplio** (incluye
  «nunca acepto»). Es coherente con «informa, no bloquea» y es el estado que **ya vive en `main`**,
  pero el caso «alta nueva que nunca acepto» no fue decidido con esas palabras — es
  [[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]. Si el operador quiere que el alta si exija
  el tilde, eso es `v1` y entra **por el mismo endpoint, sin trabajo nuevo de mecanismo**. **Default
  hasta que diga otra cosa: lo que esta en `main`.** Esto NO frena el cierre de SM-C4.

### SM-C5 · `#1002` — Sin SMTP no hay recuperación de contraseña

- **Estado:** DIFERIDO
- **Falta:** bloqueada en el OPERADOR: SMTP espera dominio/DNS (avance_ backend 14-10, sin cambio desde 07-25). El DoD 'el usuario recupera su clave sin intervencion de nadie' sigue sin cumplirse
- **Decision:** operador, 2026-10-15 - «lo de smtp y domino queda diferido al proximo sprint». Era el unico item del sprint bloqueado en el operador. Ver docs/copiloto-emprendedor/2026-10-15-decisiones-del-operador-cierre-del-sprint-mobile.md §3
- **Diferido-a:** proximo sprint (junto con el DNS SPF/MX/DKIM, que no tiene ficha propia)
- **Medido:** no hay proveedor configurado ⇒ ni recuperación de clave ni cambio de email.
- **DoD:** el usuario recupera su clave **sin intervención de nadie**.
- ✅ **DECIDIDO (2026-10-12) — DIFERIDO a pre-prod: en beta el operador resetea las claves a mano.**
  Coherente con el alta manual: quien otorga los accesos de ~4 personas cercanas también resetea su
  clave. Cero costo, cero DNS, y el sprint no espera a un proveedor.
- ⚠️ **Lo que esta decisión NO hace: cumplir el DoD.** «El usuario recupera su clave **sin
  intervención de nadie**» sigue **sin cumplirse** — se cumple su negación: depende enteramente de
  una persona. **#1002 queda ABIERTO**, no cerrado por decisión. Dueño: operador. Disparador: antes
  de abrir a cualquier usuario que no sea cercano. Escribirlo como «resuelto» sería exactamente el
  tipo de cierre que el próximo lector cita sin verificar.
- **Arrastra a `POST /auth/cambiar-email`** (ver SM-E3): sin proveedor no se puede verificar una
  dirección nueva, así que su diferimiento tiene **causa**, no desprolijidad.

---

# Bloque D · Paridad mobile

*Dueño: **frontend**. **No depende del bloque C**: se mide con el usuario canónico, que ya entra.*

### SM-D1 · `#1017` — El chat de mobile no tiene renderer de artefactos ni desambiguación multi-opción

- **Estado:** DOD-PARCIAL
- **Dueno-activo:** operador
- **Falta:** device con el sustrato REAL (las 2 choices de confirmacion se ven y se eligen + artefacto post-confirmacion con su enlace). MEDIDO el 2026-10-15 por frontend2 en device RF8T318RN9T sobre prod 2e7d2af5, bundle de origin/main 9123bf52: NO_MEDIBLE, y la causa esta nombrada -- el usuario canonico no tiene NINGUNA app externa conectada (Gmail responde 'no esta conectado' en el chat; MP y Google Calendar caidos en Mi dia), y las acciones que piden confirmacion con choices son justamente las de herramientas externas, asi que el agente contesta 'conecta X' antes de proponer nada. Recorrido el hilo completo del canonico (15:34 a 16:40): cero filas con el par Confirmar/Cancelar; la tarjeta de presupuesto propuesto es otra cosa (TarjetaPresupuestoPropuesto, card editable, no el par choices). Fabricar el estado (conectar Gmail al canonico o sembrar un gate) es lo que las decisiones del 15-10 prohiben. DISPARADOR: una cuenta de prueba con Gmail conectado -- DUENO: el operador, porque reconectar es OAuth de Composio, ya abierto como frente propio. Las piezas 2 (componente 3+) y 3 (canario invertido) del DoD enmendado YA estan en main (39818828).
- **Medido, y lo declara el propio código:** `apps/mobile/src/modules/chat/Burbuja.tsx:23` y
  `apps/mobile/src/modules/chat/ListaMensajes.tsx:356`.
- **Consecuencia:** una respuesta con **3+ opciones** no se puede elegir en el teléfono, y un artefacto
  post-confirmación no se muestra. Es la pieza más grande del criterio 7.
- **DoD (ENMENDADO 2026-10-14 — el sustrato que pedia no existe):** el DoD original exigia medir
  en device un `choices` de **3+** opciones. **Medido el 14-10: ningun camino de produccion lo emite.**
  El unico productor es `_CONFIRM_CHOICES` (`apps/copiloto/dispatcher_emprendedor.py:33`) y tiene
  **exactamente 2** (Confirmar/Cancelar); el `choices` del agente (`motor/backend/agent/types.py:91`)
  nace vacio. Pedirlo en device obligaba a **sembrar un backend falso**, o sea a medir un sistema que
  no es el nuestro. Queda en tres piezas, y las tres son verificables:
  1. **Device, con el sustrato REAL:** las 2 choices de confirmacion se ven y se eligen, y un
     artefacto post-confirmacion se muestra con su enlace. Es lo que un usuario puede encontrar hoy.
  2. **3+ choices: test de COMPONENTE**, que inyecta 3/4/5 sin backend — ahi se mide lo que el DoD
     queria saber de verdad (que la UI no se rompe ni recorta).
  3. **CANARIO INVERTIDO:** ningun productor emite mas de 2, y **el dia que alguien emita 3 se pone
     rojo**. Sin el, ese dia la UI queda sin medir **en silencio** — que es el modo de fallar que
     esta enmienda podria introducir si no se cierra. Patron ya en el repo dos veces:
     `test_hitl_card_editable_canario.py` (#1146) y `test_legal_no_bloquea_canario.py` (#1183),
     con su control positivo (una fuente mutada que emita 3 TIENE que acusar).
- **Contexto que desbloquea esto:** el motor corre en modo **`react`** en web y en worker — medido en
  el **proceso vivo**, no deducido del repo (donde el default es `dispatch`). ⇒ las cards propuestas
  son alcanzables y el criterio 7 **no** está bloqueado por configuración.
  *Lección:* una propiedad que decide un criterio y vive sólo en el ambiente **no se deduce del
  código**; se mide con un comando sobre el proceso.

### SM-D2 · `#1018` — Mobile no tiene los bloques de agregado que web sí

- **Estado:** CERRADO-POR-DECISION
- **Falta:** [TERMINAL - cerrada por decision del operador 2026-10-15] (1) portada.mes.facturado == detalle CON filas en el mes EN CURSO, en vivo: el canonico tiene 0 filas en 2026-10 y el e2e sale 3 (no discrimina); barra==detalle SI verificado en 2026-08 y 2026-09; la igualdad entre las 4 superficies para el mismo mes la prueba backend test_facturado_predicado_unico.py (B-3, Postgres del VPS). (2) device: los dos bloques medidos en el telefono. (3) hallazgo abierto: el resumen Esperando respuesta se deriva de GET /presupuestos con limit=50 por defecto (presupuestos_web.py:41), con mas de 50 vigentes subcuenta sin avisar
- **Decision:** operador, 2026-10-15 - DECLARAR: cierra sin la igualdad en el mes EN CURSO porque el canonico tiene 0 filas en 2026-10 y no se fabrican datos. Ver docs/copiloto-emprendedor/2026-10-15-decisiones-del-operador-cierre-del-sprint-mobile.md §2
- **Medido:** faltan «facturado del mes» y el resumen de presupuestos.
- **DoD:** los dos bloques existen **y su cifra coincide con la del detalle** para el mismo mes.
- **Depende de:** SM-B3 (el predicado único). **Es el criterio 6 del DoD del sprint.**

### SM-D3 · `#1019` — «Tus apps» y los modos están escritos e inalcanzables en web

- **Estado:** TERMINADO
- **Cierre:** merge 7d27fcc4 - DoD(1) rama (b) ejecutada: retirados de web la pantalla modules/apps, modeStore, ModeButton y el chip de modo del composer - DoD(2) mode del send() limpiado (Composer.onSend(text), SendOptions, body de sendChat) - DoD(3) precondicion de runtime: 0 montajes sobre AppShell y DesktopShell reales pulsando 23 y 27 controles, control de ceguera >10, CI 6/6
- **Medido:** `'apps'` **no está** en `TABS`; los dos shells de web lo declaran ellos mismos. No
  existe en mobile.
- **Por qué es el ítem que ahorra trabajo:** parecía una feature de web **para portar**. Portarla
  habría sido construir en el teléfono algo que en web **no se puede ni probar**. Es un ítem de
  **decisión**, no de implementación.
- **DoD:** ejecutado en **una** de las dos direcciones, sin tercera:
  **(a)** cableado y alcanzable en web + portado a mobile, **o**
  **(b)** retirado de web — pantalla, `modeStore`, `ModeButton` y el chip del composer — con el `mode`
  del `send()` limpiado.
- ✅ **DECIDIDO (2026-10-12) — rama (b): se RETIRA de las dos.** Nadie puede usarla hoy ni la
  extraña, y mantener código muerto que **parece** disponible es lo que manda al próximo a «portarlo
  a mobile». Se va con ella el chip de modo del composer, que hoy tampoco puede activarse porque esa
  pantalla era el único lugar donde se elige un modo.
- 🔴 **PRECONDICIÓN, no advertencia:** confirmar la inalcanzabilidad **en runtime** antes de borrar.
  La medición es estática y el issue la marca `NO_PUDE_DETERMINAR`. Es fuerte —la declara el propio
  código en `AppShell.tsx:116-121` y `DesktopShell.tsx:89-91`— pero «el código dice que no tiene
  caller» y «no tiene caller» no son la misma afirmación, y acá la diferencia se paga borrando.
- **Dueño:** frontend. **No confundir con `ConnectionsScreen.tsx:38`** («Apps»), que sí funciona, sí
  tiene par en mobile (`PantallaApps.tsx:111`) y **no se toca**: son dos pantallas distintas con el
  mismo nombre de cara al usuario, y ése es exactamente el tipo de colisión que hace que un retiro
  se lleve puesta la pantalla equivocada.

### SM-D4 · `#1021` — Tres filas de «Mi cuenta» en web prometen y no hacen nada

- **Estado:** TERMINADO
- **Cierre:** merge 84edfa11 - DoD(1) las tres filas (Idioma, Notificaciones, Privacidad del historial) retiradas de la UI de Mi cuenta web, canario negativo en AccountScreen.test - DoD(2) el docstring de AccountScreen ya no las cita como capacidad existente, CI 6/6
- **Medido:** dos `<div>` **sin `onClick`** y un toggle **sin endpoint**. Estaban por portarse a mobile
  **así como están**.
- **DoD:** cada una **se cablea o se retira de la UI**. Ninguna queda visible prometiendo. Y el
  docstring de `AccountScreen` deja de citarlas como capacidad existente — *si el comentario sigue
  afirmándolas, el próximo las vuelve a portar.*

### SM-D5 · `#1007` — La card de confirmación queda activa después de responderla

- **Estado:** TERMINADO
- **Cierre:** merge 2d198a96 (PR #1165) + device medido por frontend2 contra main@ea810b7a, cierre_ SM-D5/SM-D7 en buzon
- **DoD:** la card responde **una vez** y queda resuelta; un segundo toque **no reenvía**.
- **Criterio 7 del DoD del sprint.** El mecanismo canónico de las cards por voz dice que nunca se
  pregunta dos veces: una card que sigue activa lo viola de hecho.

### SM-D6 · `#1008` — La app dice «No lo anotamos.» sobre un ingreso que sí quedó guardado

- **Estado:** TERMINADO
- **Cierre:** merge 2d198a96 - DoD(1) el mensaje refleja el resultado real de la escritura: TarjetaPropuesta.escrituraFallida.test.tsx (6 tests ingreso+gasto: rechazado/caido/no_disponible/reintento exitoso) - DoD(2) test del caso en que la escritura si ocurrio: el reintento tras un fallo termina en Gasto anotado/formulario-completo; mutante catch-llama-onCancelar muerto
- **DoD:** el mensaje refleja el resultado **real** de la escritura. Test del caso en que la escritura
  **sí** ocurrió — es la mitad que el happy-path no cubre: hoy el camino feliz y el fallido muestran
  el mismo texto.

### SM-D7 · `#1009` — Anular un comprobante falla en silencio

- **Estado:** TERMINADO
- **Cierre:** merge 2d198a96 (PR #1165) + device medido por frontend2 contra main@ea810b7a, cierre_ SM-D5/SM-D7 en buzon
- **Medido:** `try/finally` **sin `catch`** ⇒ la excepción se pierde y el usuario no ve nada.
- **DoD:** el fallo **se ve** (el usuario recibe el error) y el estado no queda a medias.
- **Criterio 3 del DoD del sprint.**

---

# Bloque E · Promesas sin rama

### SM-D8 · `GASTOSCATEG` — el desglose por categoría de `gastos` EXISTE y no lo fija ningún test

- **Estado:** TERMINADO
- **Cierre:** merge 4c405783 (PR #1201, cierre_ de frontend2 del 14-10, ancestro de origin/main verificado) - DoD(1) control positivo porCategoria:[] -> ResumenMes.test.tsx:32 «con 0 gastos no rompe» - DoD(2) >=3 categorias ordenadas mayor a menor y anchos normalizados sobre la suma REAL -> :41 y :66 (50/30/20 ⇒ 50%/30%/20%; 3x33,3 ⇒ 100/3 cada una, no 99,9) - DoD(3) mutante de UNA categoria cambia el render -> porCategoria.slice(0,1) dio 3 de 5 ROJOS, restaurado 5/5 verde - DoD(4) CI 6/6 por ci-verde.sh 1201. Limite dicho a proposito: el caso multi-categoria NO se fotografio en prod porque cargar gastos de >=2 categorias mutaria al usuario canonico
- **Dueño-activo:** frontend2
- **Medido:** ⚠️ **la premisa original de esta fila es FALSA, y la refutó su propia dueña antes de
  escribir una línea.** La fila nació como «la tarjeta de gastos no tiene el desglose por categoría
  con barras que el prototipo promete» (FE2, 2026-10-07, PWA servido `9e344bdf`) y estuvo **15 días**
  escalada al operador como *capacidad de producto faltante*. **El 2026-10-14, con el operador ya
  decidiendo «entra a la beta», FE2 volvió a medir y el desglose YA EXISTÍA — y ya existía en el
  mismo `9e344bdf` de la medición original** (`#237`, `0dba3bef`): `ResumenMes.tsx:47` emite
  `gastos-resumen-barra-<cat>` y `GastosScreen.tsx:232` lo monta (verificado también por
  planificación con `git grep` sobre `origin/main`, no citado de su reporte).
- **Causa del falso positivo — y es la parte que hay que no repetir:** octubre del usuario canónico
  tiene **todos** los gastos en la categoría `otros`, así que `GET /gastos/resumen` devuelve
  `por_categoria: [{otros, 100%}]` y la tarjeta pinta **una** barra. **Una barra se leyó como
  ninguna.** El instrumento era correcto y el dato también; lo que falló fue inferir *ausencia del
  mecanismo* de una *forma degenerada del dato*. Mismo patrón que
  `un-supuesto-cuya-falla-parece-un-estado-legitimo`: la pregunta que faltaba era *¿cómo se vería
  esto si el render SÍ existiera y el mes tuviera una sola categoría?* — exactamente igual.
  único caso que cubre `GastosScreen.test.tsx` es `porCategoria: []`, o sea el camino en que las
  barras **no se pintan**. El orden descendente, la normalización sobre la suma real y el caso de
  ≥2 categorías **no están fijados por nada**, y un render sin test que lo ejercite se puede
  romper sin que ninguna suite se ponga roja.
- **DoD:** tests de `ResumenMes` en web, sin inventar UI nueva: (1) **control positivo primero**,
  `porCategoria: []` — la tarjeta no rompe (ya cubierto: se mantiene, no se duplica); (2) **≥3
  categorías**, assert de que salen **ordenadas de mayor a menor** y de que los anchos normalizan
  sobre la suma real; (3) **mutante**: con **una sola categoría** el render **cambia** — *si no
  cambia, el test no está mirando el mecanismo*. CI 6/6 y el sha de `main` contra el que se corrió.
- **Lo que este DoD NO pide, y es deliberado:** cargar gastos de varias categorías en prod para
  verlo en vivo. Eso **mutaría el usuario canónico**, que es a fuego
  (`usuario-de-prueba-canonico-uno-solo-a-fuego`). FE2 lo planteó y se rechaza por esa razón: el
  mecanismo se fija con tests, no ensuciando el único canónico que tenemos.

### SM-E1 · `#1005` — Un Responsable Inscripto lee «ya podés facturar» y la emisión explota

- **Estado:** TERMINADO
- **Cierre:** merge 1966c340 - 4 puntos del DoD enmendado (8f578bfd) en main con tests: mobile 4 pass / web 5 pass, control positivo motivo ausente; selector sin RI; core expone motivoNoPuedeFacturar (afip.ts:298,698); RI no fabricable, no medido en device
- **Medido:** la promesa se muestra y la emisión levanta `NotImplementedError`.
- **DoD:** **o** la emisión funciona para ese caso, **o** la promesa no se muestra. **Nunca las dos.**
- **Como se MIDE la mitad frontend (ENMENDADO 2026-10-14):** el DoD decia «medido en device con una
  cuenta RI con perfil cargado», y **esa cuenta no se puede fabricar**: el propio fix de backend
  rechaza RI con 422 (`CONDICIONES_EMISOR_SOPORTADAS = {MONOTRIBUTO, EXENTO}`,
  `apps/copiloto/afip_rules.py:124`). El caso quedo inalcanzable **por el arreglo**, no por falta de
  trabajo. Pero el front no lee un tenant: lee un **contrato**, y un contrato se ejercita con el
  valor. Entonces:
  1. **Test de componente** sobre las dos `PantallaFacturacion.tsx` con `puedeFacturar:false` +
     `motivo:"condicion_iva_no_soportada"`: dice que la facturacion A/B aun no esta disponible, y
     **NO** el CTA «todavia no configuraste tu facturacion» — que para un RI con perfil cargado es un
     **lazo**: le pide configurar lo que ya configuro.
  2. **Control positivo en el mismo test:** con `puedeFacturar:false` y motivo **ausente** (el caso
     «de verdad no configuro»), el CTA de configurar **SI** aparece. Sin ese control, un test que
     solo mira el caso RI pasa igual si la pantalla dejo de distinguir y muestra siempre lo mismo.
  3. `packages/core/src/api/afip.ts:262-263,660-661`: exponer `motivoNoPuedeFacturar` (sin eso lo
     demas no tiene de donde leerlo).
  4. Las dos `PantallaAfipSetup.tsx` (`mobile …:74`, `web …:37`) ofrecen «Responsable inscripto» y
     guardarla hoy da **422**: retirarla del selector. Es la mitad mas barata y la mas visible.
  **Lo que esta enmienda NO hace:** declarar el caso cubierto en device. Si alguna vez RI entra a
  `CONDICIONES_EMISOR_SOPORTADAS`, el caso vuelve a ser fabricable y **hay que medirlo ahi**.

### SM-E2 · `#1006` — El catálogo de apps anuncia herramientas que fueron podadas

- **Estado:** TERMINADO
- **Cierre:** 716e63da4460cf02abaa7b6ee825124e697e8c43
- **DoD:** lo anunciado y lo cableado coinciden, **ítem por ítem** (no «en general»).

### SM-E3 · `#1020` — Cinco capacidades del backend cableadas que nadie llama

- **Estado:** CERRADO-POR-DECISION
- **Falta:** [TERMINAL - cerrada por decision del operador 2026-10-15] CODIGO COMPLETO y DEVICE MEDIDO 7/7 el 15-10 (cierre_ de frontend2 sobre prod 72b85cba, receta SM-E3): el UNICO punto abierto es POST /auth/cambiar-email, bloqueado por SMTP = SM-C5, que es del operador. Las 5 capacidades quedaron clasificadas, ninguna en el medio: (1) PUT /gastos/{id}/imputacion -> CABLEADA el 14-10, merge ddd68358 (PR #1180): gasto.imputacion en el tipo Gasto de core, imputarGasto/desimputarGasto contra gastos_web.py:161, leerTrabajos para el selector y el bloque de imputacion en DetalleGasto de los DOS fronts (web paso de 0 a 8 tests). (2) GET /trabajos/{eslabon}/{ref}/margen -> CABLEADA: imputacionDeTrabajos en packages/core/src/api/inteligencia.ts (8 casos, mutante 6 rojos/31 verdes) y las dos TarjetaMargenTrabajo gemelas pintan el conteo siempre que haya barra (web GraficosInteligencia.tsx:151 + mobile :163), que es el DoD de UI del hallazgo 2. (3) POST /inteligencia/chat -> RETIRADA, entro en 9e536c38 (PR #1166); 0 ocurrencias de preguntarInteligencia en packages/apps/motor de origin/main (git grep 14-10). (4) POST /mi-dia/tarjetas -> CABLEADA el 14-10, merge 274af593 (PR #1181): crearTarjetaMiDia (miDia.ts:240) deja de estar sin consumidor, con formulario en MidiaScreen (web, 29 tests) y PantallaMiDia (mobile, 67 tests), y el 400 del backend convertido en ESTADO de la UI en vez de promesa (46 tests de core). (5) POST /auth/cambiar-email -> clasificada 'se cablea' pero BLOQUEADA por SMTP (SM-C5, operador): unico punto que no cierra por codigo. Backend previo: merge e7601bc6 (PR #1154) + LECTURA de la imputacion en merge b392389b (PR #1175), GET /gastos y GET /gastos/{id} con gasto.imputacion {gasto_id,presupuesto_ref,comprobante_ref,cobro_ref}, misma forma que el retorno del PUT (adversarial + canario + mutante, VPS). FALTA PARA TERMINAR: la pasada de device de los dos flujos nuevos (imputar un gasto y anotar una tarjeta), con receta escrita de 7 veredictos, en manos de frontend2 -- contrato_ del 14-10 en el buzon. HALLAZGO que NO reabre esta ficha (DEC-18): la rama modo:'detalle' de leerGraficoMargenTrabajo (inteligencia.ts:503-512, tipada DetalleMargenTrabajo con trabajo: unknown [PROVISIONAL]) no tiene consumidor -- GraficosInteligencia.tsx:153 la llama sin params y siempre cae en modo:'lista', y hay 0 ocurrencias de DetalleMargenTrabajo en todo apps/. Mi barrido conto FUNCIONES de red sin consumidor (71 en core, 0 huerfanas) y por construccion no podia ver una RAMA muerta del retorno de una funcion que si se consume: va como hallazgo propio, no como hueco de SM-E3.
- **Decision:** operador, 2026-10-15 - DECLARAR: las 5 capacidades estan clasificadas (4 cableadas + cambiar-email espera SMTP, diferido con SM-C5), y clasificar ES el DoD. Ver docs/copiloto-emprendedor/2026-10-15-decisiones-del-operador-cierre-del-sprint-mobile.md §2
- **Evidencia de device (2026-10-15, frontend2):** `coordinacion/evidencia/SM-E3-2026-10-15/` + el
  `cierre_frontend2-a-planificacion_SM-E3-7-de-7-...`. **B1-B3** (anotar tarjeta: el campo vacío no
  promete, la tarjeta entra y el contador pasa 2→3, y PERSISTE tras `force-stop` + relanzar) y **A1-A4**
  (imputar un gasto: estado inicial honesto, la lista trae trabajos reales del tenant, imputar y
  desimputar persisten contra un GET fresco) → **7 COHERENTES de 7**.
- ⚠️ **Límite del instrumento, declarado:** `uiautomator dump` responde `could not get idle state` en
  TODA pantalla con animación continua, así que los `[ver]` de la receta **no corrieron**: la evidencia
  es captura de pantalla + `input motionevent` (nunca `input tap`). **Los testIDs NO quedaron
  comprobados** — cualquier DoD que dependa de un testID sigue sin medir, y no lo cubre este 7/7.
- **Medido:** 5 endpoints que **ninguna** app consume; **3** de ellos ya tienen la función del cliente
  compartido escrita y **sin consumidor**.
- **DoD:** cada una clasificada **explícitamente**: se cablea (con dueño y pantalla) o se retira
  (endpoint + función del core). **Ninguna queda en el medio** — una capacidad a medias es la que el
  próximo relevamiento vuelve a contar como hueco.
- ✅ **DECIDIDO (2026-10-12) — se cablean CUATRO; `POST /inteligencia/chat` se RETIRA.**
- 🔄 **La decisión se corrigió el mismo día, y vale registrar por qué:** el operador dijo primero «las
  cinco, ninguna se retira». Al medir cómo ejecutarlo apareció que  **no es una
  capacidad que falta: es una que el producto reemplazó a propósito.** Con esa evidencia el operador
  decidió retirarla. Lo que cambió no fue el criterio, fue el sujeto — la lista decía «capacidades sin
  consumidor» y una de las cinco era **el camino viejo de una capacidad que sí funciona**.

**Hallazgo 1 — no son cinco ítems, son cuatro más una cadena.** `PUT /gastos/{id}/imputacion` y
`GET /trabajos/{eslabon}/{ref}/margen` **son un solo flujo**: el margen se calcula sobre gastos
imputados, así que si nadie imputa, **todos** los márgenes salen incompletos. Cablear el margen sin la
imputación entrega una pantalla que muestra números sistemáticamente falsos. **Orden forzado:
imputación primero.**

**Hallazgo 2 — el propio endpoint ya declara el requisito de UI, y es de honestidad, no de estilo.**
`apps/copiloto/gastos_web.py:183` lo dice en su docstring: devuelve `gastos_imputados` **al lado del
número, siempre**, porque *«un trabajo con 2 de 5 gastos imputados muestra un margen excelente y es
falso: un margen incompleto se ve igual que uno bueno, y sin el conteo la pantalla no tiene con qué
avisar»*. ⇒ **DoD de UI:** ninguna pantalla muestra margen sin el conteo al lado.

**Dónde encaja cada una** — medido contra `modules/` de los dos fronts, no supuesto:

| capacidad | módulo destino | costo real |
|---|---|---|
| `PUT /gastos/{id}/imputacion` | `gastos` — **existe en los dos** | bajo: bloque en pantalla existente |
| `GET /trabajos/{eslabon}/{ref}/margen` | ⚠️ **no existe módulo `trabajos` en ningún front** | **el más alto: pantalla nueva, o bloque en `inteligencia`/`presupuestos` — a decidir** |
| `POST /inteligencia/chat` | `inteligencia` — existe en los dos | medio, y **revierte una decisión previa**: mobile removió `PreguntarInteligencia` **a propósito** (`PreguntarInteligencia.tsx:12`). Leer POR QUÉ antes de rehacerlo, o se repite el motivo |
| `POST /mi-dia/tarjetas` | `midia` — existe en los dos | bajo: la función del core ya está (`miDia.ts:156`) |
| `POST /auth/cambiar-email` | `account`/`ajustes` | 🔴 **BLOQUEADO por la decisión 3** |

- 🔄 **Remedido el 2026-10-14 — la fila del margen de esta tabla estaba RANCIA, y mi propia escalación
  con ella.** Decía «no existe módulo `trabajos` en ningún front ⇒ **el más alto: pantalla nueva**», y
  sobre eso escalé «el margen no tiene módulo en ningún front, es MAYOR». Medido con `git grep` contra
  `origin/main` el 14-10: **`TarjetaMargenTrabajo` existe en los DOS fronts** —
  `apps/copiloto-web/src/modules/inteligencia/graficos/GraficosInteligencia.tsx:151` y
  `apps/mobile/src/modules/inteligencia/graficos/GraficosInteligencia.tsx:163`, las dos montadas por
  `GraficosInteligencia`. O sea: la opción «bloque en `inteligencia`» que la tabla dejaba *a decidir*
  **ya se había tomado de hecho**, y lo que faltaba no era una pantalla sino **pintar el conteo**. El
  `margen` del nombre engaña al grep: en los dos fronts `margen` es además el token de *spacing* del
  tema (`apps/mobile/src/theme/tokens.ts`), así que contar archivos que lo mencionan da falsos
  positivos — el control que sirve es quién llama al endpoint (`/margen`) o a `leerGraficoMargenTrabajo`.
- ⚠️ **Y la cadena del hallazgo 1 sigue abierta por el OTRO extremo:** `PUT /gastos/{id}/imputacion`
  (`apps/copiloto/gastos_web.py:161`) **no tiene función en `packages/core`** (0 ocurrencias de
  `imputar`/`imputacion` fuera de un comentario) ni bloque en la pantalla de gastos de ningún front ⇒
  **hoy nadie puede imputar**, y por eso el conteo recién cableado va a decir «sin ningún gasto
  imputado» siempre. Eso no lo invalida: es exactamente lo que el DoD quería que la pantalla
  **confiese** en vez de mostrar un margen falso que se ve bien.
- 🔴 **La colisión con la decisión 3, nombrada y no resuelta en silencio:** `cambiar-email` **no se
  puede cablear** mientras SMTP esté diferido — no hay forma de verificar la dirección nueva, y
  cambiar un email sin verificarlo entrega la cuenta a una dirección tipeada con un error. ⇒ queda
  **cableada en cuanto haya SMTP**, con el mismo disparador que #1002. Las otras cuatro no dependen
  de nada.
- **Las cinco necesitan renglón propio en la tabla de hitos.** Ninguna queda «decidida pero sin
  renglón»: lo que no está en la tabla no existe, y una capacidad decidida sin dueño vuelve a
  contarse como hueco en el próximo relevamiento.
- **Nota aparte, fuera de alcance:** `POST /warm` también es SOLO_WEB. Mobile no pre-calienta el chat
  ⇒ primera respuesta más lenta. Es rendimiento, no capacidad: no bloquea ningún criterio.

---

# Bloque F · Evidencia en device

*Dueño: **frontend**, dueño **único** del device. **Es el criterio 8: sin este bloque el sprint no
cierra, aunque los otros siete estén verdes.***

### SM-F1 · `#1011` — Las 6 cadenas de negocio nunca se midieron de punta a punta en device

- **Estado:** TERMINADO
- **Dueno-activo:** frontend2
- **Cierre:** Las 6 cadenas con veredicto y medido_contra main@ea810b7a/prod 9e536c38: 4,5,6 COHERENTE; 3 COHERENTE manual + MP NO_MEDIBLE; 2 camino de error COHERENTE + exito NO_MEDIBLE; 1 REQUIERE_TRIAGE (token ARCA invalido en la emision). Doc docs/copiloto-emprendedor/Auditorias/2026-10-14-SM-F1-las-6-cadenas-de-negocio-en-device.md
- **DoD:** las 6 con veredicto del vocabulario cerrado y su `medido_contra:`.
- **Depende de:** SM-A1.

### SM-F2 · `M-02` — Medir en device los 46 ids que faltan

- **Estado:** CERRADO-POR-DECISION
- **Falta:** [TERMINAL - cerrada por decision del operador 2026-10-15] quedan 14 sin comparar en mobile: (home) sin ningun veredicto + 13 cubiertos sin comparacion = agenda bi-vacio chat consent vacio vacio-visto (cuenta de estado/ajeno al fiscal) y los 6 fiscales declarados NO_MEDIBLE (card-factura fact-cae fact-hitl pres-ciclo pres-hitl recibo) que esperan la decision A/B del operador (perfil fiscal en el canonico) · onb-cumplida NO_MEDIBLE (exige MP+Google, OAuth externo)
- **Decision:** operador, 2026-10-15 - DECLARAR: los 14 ids sin comparar son NO_MEDIBLE con el usuario canonico (perfil fiscal, MP+Google) o no tienen frente propio. Ver docs/copiloto-emprendedor/2026-10-15-decisiones-del-operador-cierre-del-sprint-mobile.md §2
- **Cierre:** lotes de frontend2 (26 filas, SM-F2) + 4 ids de device (hablar factura presu grabando) medidos 15-10 y registrados en #1268; criterio 3 mobile: cubiertos 53 de 54, comparados de verdad 40 (falta-en-mobile.py @410250ec)
- **Medido:** `scripts/evidencia/falta-en-mobile.py` los lista por nombre. Mobile: **8** comparados de
  verdad · **5** cubiertos sin comparación · **41** sin nada ⇒ **46 a medir**.
- **Por qué 46 y no 41:** la cifra que circulaba, «mobile 13/54», cuenta como cubiertos 5 ids cuyos
  únicos veredictos son `PENDIENTE_DEVICE`/`NO_MEDIBLE` — **cubiertos, nunca comparados**. La cifra era
  correcta y engañosa a la vez.
- **DoD:** cada id con veredicto del vocabulario cerrado y su `medido_contra:`. Por lotes, con un
  `avance_` por lote.
- **🔄 REMEDIDO 2026-10-14 @`95d7963f`** (mismo instrumento, mismo sujeto de 54): **12** comparados de verdad · **4** cubiertos sin comparación · **38** sin nada ⇒ **42 a medir**. Avanzaron 4 ids desde que se escribió la ficha y nadie volvió a correr el medidor — el mismo patrón que `SM-B3`/`SM-B4`. La cifra de arriba **no se retira**: era correcta a su fecha.
- **Dueñas:** frontend1 + frontend2, por **lotes disjuntos** (el device es de dueño único).
- **Depende de:** SM-A1.

### SM-F3 · `M-03` — Los 5 ids cubiertos sin comparación

- **Estado:** CERRADO-POR-DECISION
- **Falta:** [TERMINAL - cerrada por decision del operador 2026-10-15] onb-cumplida: NO_MEDIBLE, exige Mercado Pago y Google conectados en la cuenta y el canonico no los tiene; la destraba la decision del operador sobre el estado de la cuenta canonica
- **Decision:** operador, 2026-10-15 - DECLARAR: onb-cumplida exige MP y Google conectados en el canonico, y cambiar el usuario canonico es MAYOR. Ver docs/copiloto-emprendedor/2026-10-15-decisiones-del-operador-cierre-del-sprint-mobile.md §2
- **Cierre:** evidencia en el cierre_frontend2 SM-F3 del 15-10: vozchat, pres-voz y preg medidos en device con veredicto DESVIO; falta-en-mobile.py los deja comparados de verdad
- `cobro-voz` · `fact-voz` · `onb-cumplida` · `pres-voz` · `vozchat`.
- **DoD:** veredicto real y **salen de esa población** (que `falta-en-mobile.py` los deje de listar).
- **🔄 REMEDIDO 2026-10-14 @`95d7963f`**: **`cobro-voz` y `fact-voz` YA salieron** de la población (están comparados de verdad). Quedan **4**: `onb-cumplida` · `preg` · `pres-voz` · `vozchat` — y `preg` no estaba en la lista original. **2 de 5 ya estaban hechos sin registrar.**
- **Dueña:** frontend1.

### SM-F4 · `#1013` — El APK de dev-client se evapora de EAS a los 14 días

- **Estado:** TERMINADO
- **Cierre:** merge aeeb3eab (PR #1157, la receta) - DoD(1) la receta existe: docs/copiloto-emprendedor/2026-10-14-receta-rebuild-dev-client-eas.md en origin/main desde aeeb3eab, con las 4 trampas que cobro al ejercitarla. DoD(2) ejercitada una vez y el ARTEFACTO EXISTE: build d6cecf02 FINISHED con apk (expo.dev/artifacts/eas/TeAkIfKPu5wY88WZuXHt9-fhFEHZGR53jO7KNarb9q4.apk), procedencia git=93d792d2 (sha de main), expira 2026-10-28; medido 2026-10-14 12:07 con el disparador literal del doc (npx --yes eas-cli@24.13.0 build:list --platform android --json), no con autoevaluacion -- el bloque RESULTADO-EJERCICIO quedo remedido a FINISHED en el PR #1166.
- **DoD:** la receta de reconstrucción existe **y se ejercitó una vez**. Una receta no ejercitada es
  una promesa.
- **Dueña:** planificación — no necesita el teléfono para la parte de build, así que no compite por el device.

### SM-F5 · `M-04` — Tester externo con video

- **Estado:** DIFERIDO
- **Decision:** operador, 2026-10-15 - diferida antes que cerrada por declaracion: el tester externo con video depende de una persona ajena al equipo. Ver docs/copiloto-emprendedor/2026-10-15-decisiones-del-operador-cierre-del-sprint-mobile.md §3
- **Diferido-a:** proximo sprint, con el DoD intacto
- **DoD:** el video existe y **cada hallazgo entra como fila** del registro, con id y veredicto — no
  como impresión en prosa. Una impresión no se puede volver a medir.

---

## Dependencias, en una tabla

| ítem | depende de | causa de la dependencia |
|---|---|---|
| SM-A2 | SM-A1 | sin gesto confiable, un rojo no se puede atribuir |
| SM-F1 SM-F2 | SM-A1 | ídem: habría que repetir las mediciones |
| SM-B4 | SM-B2 | la NC tiene que ser distinguible antes de tratarla distinto |
| SM-D2 | SM-B3 | portar el bloque antes de unificar importa la ambigüedad |
| SM-C3 | — | ya no depende de nada: SM-C1 cerró por decisión y SM-C2 es el alta por email de web, otro camino |
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
| ✅ **RESUELTO — SM-B1 y SM-B2 están MERGEADOS** | `6d3b3579` (PR #1023), issues #1014/#1015 cerrados el 12/10. Ya no es un riesgo: el fix está en `main`, verificado por contenido (`cobro_store.py` · `afip_comprobante_store.py` · `inteligencia_queries.py` + sus tests) |
| ⚠️ **`PantallaFacturacion.tsx` del checkout compartido está ATRASADO** | commitearlo tal como está revierte **+102 líneas** de la rama en vuelo. Medir el **signo** por archivo, contra `main`. Los 4 rojos y 8 errores de `tsc` de la suite mobile (986/991) caen todos ahí y **no son defecto de `main`** |
| ✅ **REFUTADO: `/actividad?q=` NO da 400** | medido el 11/10 contra el handler: `apps/copiloto/actividad_web.py:99` declara `q: str = ""`, `:112` dice «`q` YA está implementada: ILIKE sobre título+detalle», `:120` la pasa al store. Lo del 400 lo afirmaba un **comentario** de mobile, ya corregido. **Tercer caso del día** de un comentario que declara un estado, sobrevive al cambio y el próximo lector le cree (los otros dos: SM-B1 y `#1001`). **No hay nada que esperar de backend acá** |
| 🆕 **Asimetría de búsqueda web↔mobile** | medido: web busca **global** (`ActividadScreen.tsx:84`), mobile sólo **por función** (`BuscadorActividad.tsx:77`). Las dos pasan `q` y `q` funciona ⇒ no es un defecto, es una **decisión de UX sin dueño**: el docstring de mobile argumenta su lado y nadie comparó. Clasificar antes de cerrar la paridad |
| ✅ **RESUELTO: `app/recientes.tsx` SÍ es alcanzable** | medido el 11/10: `apps/mobile/src/shell/PantallaPrincipal.tsx:179` cablea `onVerRecientes={() => empujarUnaVez('/recientes')}` al encabezado **tapeable** «Actividad reciente», con test verde (`PantallaPrincipal.test.tsx:146`). El `_layout.tsx` decía «queda inalcanzable» — **rancio, ya corregido**. **Sin tile ≠ inalcanzable.** ⚠️ Ese comentario invitaba a **borrar una pantalla alcanzable**; el único caso realmente inalcanzable de esa lista es `'apps'` (`#1019`). **Cuarto caso del día** del mismo mecanismo. (Y mi fila anterior citaba `PantallaPrincipal.tsx:179` sin su directorio: el archivo vive en `src/shell/`, no en `modules/principal/`) |
| Paridad de **parámetros** no medida | un endpoint que las dos apps llaman puede invocarse con menos capacidad de un lado, y la tabla de 109 lo marca `AMBAS` igual. Segundo pase si ese eje importa |
| 🆕 **49 comentarios declaran un estado TEMPORAL y nadie los verificó** | `scripts/evidencia/comentarios-que-declaran-un-estado.py` (nuevo, 11/10) los lista con `path:línea`. Nace de que **cuatro** afirmaciones falsas entraron a estos docs hoy por el mismo mecanismo: un comentario declara un estado, el código cambia, nadie actualiza el comentario. Los 4 cayeron **al medir contra el código que escribe o navega**, ninguno leyendo con más cuidado. ⚠️ **No es una lista de comentarios falsos: es la superficie a verificar.** Sólo en mobile hay **5** `[CONNECT]`. No bloquea ningún criterio; se toma por lotes cuando se toca cada módulo |
| `/admin/*` **fuera de alcance** | 12 endpoints + `AdminScreen.tsx:114`. Es herramienta del operador, no del emprendedor: su ausencia en mobile **no es** hueco de paridad |
| `web` cuenta 54/54, de los cuales **9 sin comparación** | dato, no acción: `DEC-18`, un hallazgo nuevo **no reabre** un criterio cerrado |

---

**Mantenimiento de este backlog:** los issues se abren/sincronizan con
`scripts/abrir-issues-sprint.sh`, idempotente — compara por **título exacto** contra abiertos **y**
cerrados antes de crear. ⚠️ **Si corregís el título de un issue por `gh`, sincronizá el script**: su
idempotencia se decide por ese título, y uno desactualizado **fabrica duplicados**. Ya pasó hoy: tres
títulos editados a mano habrían creado tres duplicados en la corrida siguiente.
