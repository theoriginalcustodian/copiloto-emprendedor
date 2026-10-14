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
| **SM-A2** | `#1012` | ⬜ PENDIENTE | — |
| **SM-B1** | `#1014` | ✅ TERMINADO | merge 6d3b3579 (PR #1023, 12-10) - CI 6/6 SUCCESS (gh pr view 1023) - DoD: el pago MercadoPago deja de contarse dos v… |
| **SM-B2** | `#1015` | ✅ TERMINADO | merge 6d3b3579 (PR #1023, 12-10) - CI 6/6 SUCCESS - DoD: la fila vale nota_credito y la app ya no ofrece anular una NC |
| **SM-B3** | `#1003` | ✅ TERMINADO | merge bf8eb87e (PR #1045, 13-10) - CI 6/6 SUCCESS - DoD: un predicado en apps/copiloto/afip_rules.py + test_facturado… |
| **SM-B4** | `#1004` | ✅ TERMINADO | merge bf8eb87e (PR #1045, 13-10) - CI 6/6 SUCCESS - DoD: la NC reserva por el mismo mecanismo que la factura (test_af… |
| **SM-C1** | `#999` | ✅ TERMINADO | sin-codigo - decision del operador 12-10 registrada en ff42a5f7 (PR #1028); el DoD de esta ficha es explicitamente 'n… |
| **SM-C2** | `#1000` | 🟧 DOD-PARCIAL | frontend: el formulario web no manda invite_token (campo + copy) y ?signup=1 es la unica puerta. Backend medido por c… |
| **SM-C3** | `#1016` | 🟧 DOD-PARCIAL | mitad web (frontend2, apps/copiloto-web/.../Onboarding.tsx: mismo paso) y medicion en device del paso mobile (409 rea… |
| **SM-C4** | `#1001` | 🟧 DOD-PARCIAL | hay codigo (packages/core/src/legal.ts + apps/mobile/src/modules/ajustes/PantallaCuenta.tsx, @004ee3ce) pero el DoD N… |
| **SM-C5** | `#1002` | ⬜ PENDIENTE | bloqueada en el OPERADOR: SMTP espera dominio/DNS (avance_ backend 14-10, sin cambio desde 07-25). El DoD 'el usuario… |
| **SM-D1** | `#1017` | 🟧 DOD-PARCIAL | medido en DEVICE: un choices de 3+ opciones se ve y se elige en el teléfono, y un artefacto post-confirmación (evento… |
| **SM-D2** | `#1018` | 🟧 DOD-PARCIAL | (1) portada.mes.facturado == detalle CON filas en el mes EN CURSO, en vivo: el canonico tiene 0 filas en 2026-10 y el… |
| **SM-D3** | `#1019` | ✅ TERMINADO | merge 7d27fcc4 - DoD(1) rama (b) ejecutada: retirados de web la pantalla modules/apps, modeStore, ModeButton y el chi… |
| **SM-D4** | `#1021` | ✅ TERMINADO | merge 84edfa11 - DoD(1) las tres filas (Idioma, Notificaciones, Privacidad del historial) retiradas de la UI de Mi cu… |
| **SM-D5** | `#1007` | 🟧 DOD-PARCIAL | medido en DEVICE (segundo toque sobre una card ya respondida no dispara nada). Codigo y tests en main/PR: la card se … |
| **SM-D6** | `#1008` | ✅ TERMINADO | merge 2d198a96 - DoD(1) el mensaje refleja el resultado real de la escritura: TarjetaPropuesta.escrituraFallida.test.… |
| **SM-D7** | `#1009` | 🟧 DOD-PARCIAL | medido en DEVICE: forzar un fallo de anular/confirmar y ver el texto de error en el panel (código y tests jest/vitest… |
| **SM-E1** | `#1005` | 🟧 DOD-PARCIAL | medido en DEVICE: con una cuenta RI con perfil cargado, la pantalla de Facturación muestra el aviso y no el CTA «Conf… |
| **SM-E2** | `#1006` | ✅ TERMINADO | 716e63da4460cf02abaa7b6ee825124e697e8c43 |
| **SM-E3** | `#1020` | 🟧 DOD-PARCIAL | CODIGO COMPLETO, FALTA DEVICE (+1 punto bloqueado por el operador). Las 5 capacidades quedaron clasificadas, ninguna … |
| **SM-F1** | `#1011` | ⬜ PENDIENTE | — |
| **SM-F2** | `M-02` | ⬜ PENDIENTE | — |
| **SM-F3** | `M-03` | ⬜ PENDIENTE | — |
| **SM-F4** | `#1013` | ✅ TERMINADO | merge aeeb3eab (PR #1157, la receta) - DoD(1) la receta existe: docs/copiloto-emprendedor/2026-10-14-receta-rebuild-d… |
| **SM-F5** | `M-04` | ⬜ PENDIENTE | — |

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

- **Estado:** PENDIENTE
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

- **Estado:** DOD-PARCIAL
- **Falta:** frontend: el formulario web no manda invite_token (campo + copy) y ?signup=1 es la unica puerta. Backend medido por camino real GoTrue+Postgres (PR #1162): signup->login->/me verde, adversarial sin invite no crea user ni tenant
- **Medido:** el backend exige `invite_token` y el cliente **nunca lo manda**; además el formulario
  sólo se abre con `?signup=1` en la URL.
- **DoD:** alta por email de punta a punta, con test del **camino real** — el de producción, por el
  composition root, no un happy-path mockeado. *Causa:* un test que no usa el camino de producción no
  puede verlo fallar.
- **Bloquea:** SM-C3.

### SM-C3 · `#1016` — El gate del primer ingreso existe; lo que falta es QUÉ pide

- **Estado:** DOD-PARCIAL
- **Falta:** mitad web (frontend2, apps/copiloto-web/.../Onboarding.tsx: mismo paso) y medicion en device del paso mobile (409 real -> paso -> entra)
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

- **Estado:** DOD-PARCIAL
- **Falta:** hay codigo (packages/core/src/legal.ts + apps/mobile/src/modules/ajustes/PantallaCuenta.tsx, @004ee3ce) pero el DoD NO se verifico punto por punto: que la aceptacion CONDICIONE algo, y la evidencia de device. Lo acredita frontend2 con su cierre_
- **Medido, en dos mitades distintas:**
  1. La **pantalla de lectura de mobile ya existe** — `apps/mobile/src/modules/ajustes/PantallaLegal.tsx:31`,
     montada en `apps/mobile/app/legal.tsx:17`. ⚠️ Este issue decía antes «mobile no tiene pantalla de
     aceptación legal» y habría mandado a alguien a **construir una pantalla que existe**. Lo que
     falta es el **botón de aceptar** y la llamada a `POST /me/legal/aceptar` (`web.py:1143`).
  2. La aceptación **no condiciona nada en ninguna plataforma**: se puede operar sin haber aceptado.
- **DoD:** un alta nueva **no puede operar** sin aceptar, en las dos plataformas; mobile llama el
  endpoint y guarda la versión aceptada. **Test del caso hostil:** una cuenta sin aceptación vigente
  es **rechazada** al operar — no sólo «la que aceptó puede».
- ✅ **DECIDIDO (2026-10-12) — se cablea YA con el texto provisorio marcado como tal.** La
  aceptación pasa a ser **obligatoria en las dos plataformas**; no se espera al abogado. Cuando
  llegue el texto definitivo se reemplaza el **contenido**, no el mecanismo — y eso es justamente lo
  que hace que cablear ahora no sea trabajo tirado.
- **El DoD no cambia, y su mitad hostil es la que importa:** «una cuenta sin aceptación vigente es
  **rechazada** al operar». Sin ese test el control es indistinguible de su ausencia: el happy-path
  («la que aceptó puede operar») sale verde igual si el guard no existe. Es la regla dura de
  `CLAUDE.md` §Seguridad, no una preferencia de cobertura.
- **Dueño:** frontend (botón + `POST /me/legal/aceptar` en mobile) + backend (el guard que rechaza).
  **El marcado del texto va visible en la pantalla**, no en un comentario del código: un comentario
  que declara un estado no lo comunica a nadie que no lea el fuente.

### SM-C5 · `#1002` — Sin SMTP no hay recuperación de contraseña

- **Estado:** PENDIENTE
- **Falta:** bloqueada en el OPERADOR: SMTP espera dominio/DNS (avance_ backend 14-10, sin cambio desde 07-25). El DoD 'el usuario recupera su clave sin intervencion de nadie' sigue sin cumplirse
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
- **Falta:** medido en DEVICE: un choices de 3+ opciones se ve y se elige en el teléfono, y un artefacto post-confirmación (evento/doc/planilla/archivo/borrador) se muestra con su enlace. Código y tests (13 jest + parser core + web ArtifactView) en main; el DoD pide device.
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

### SM-D2 · `#1018` — Mobile no tiene los bloques de agregado que web sí

- **Estado:** DOD-PARCIAL
- **Falta:** (1) portada.mes.facturado == detalle CON filas en el mes EN CURSO, en vivo: el canonico tiene 0 filas en 2026-10 y el e2e sale 3 (no discrimina); barra==detalle SI verificado en 2026-08 y 2026-09; la igualdad entre las 4 superficies para el mismo mes la prueba backend test_facturado_predicado_unico.py (B-3, Postgres del VPS). (2) device: los dos bloques medidos en el telefono. (3) hallazgo abierto: el resumen Esperando respuesta se deriva de GET /presupuestos con limit=50 por defecto (presupuestos_web.py:41), con mas de 50 vigentes subcuenta sin avisar
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

- **Estado:** DOD-PARCIAL
- **Falta:** medido en DEVICE (segundo toque sobre una card ya respondida no dispara nada). Codigo y tests en main/PR: la card se reemplaza por un Recibo sin botones al responderla (ListaMensajes) y useChat.send descarta un segundo callback sobre una card ya marcada hitlRespondido (dos toques en el mismo frame); test con mutante muerto
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

- **Estado:** DOD-PARCIAL
- **Falta:** medido en DEVICE: forzar un fallo de anular/confirmar y ver el texto de error en el panel (código y tests jest/vitest en main: las 3 vías de silencio cerradas en mobile y web)
- **Medido:** `try/finally` **sin `catch`** ⇒ la excepción se pierde y el usuario no ve nada.
- **DoD:** el fallo **se ve** (el usuario recibe el error) y el estado no queda a medias.
- **Criterio 3 del DoD del sprint.**

---

# Bloque E · Promesas sin rama

### SM-E1 · `#1005` — Un Responsable Inscripto lee «ya podés facturar» y la emisión explota

- **Estado:** DOD-PARCIAL
- **Falta:** medido en DEVICE: con una cuenta RI con perfil cargado, la pantalla de Facturación muestra el aviso y no el CTA «Configurar»; y el selector de condición IVA no ofrece RI. Backend HECHO en b705a403; frontend (core motivo, PantallaFacturacion y PantallaAfipSetup web+mobile, par con/sin motivo, 2 mutantes muertos) en este PR.
- **Medido:** la promesa se muestra y la emisión levanta `NotImplementedError`.
- **DoD:** **o** la emisión funciona para ese caso, **o** la promesa no se muestra. **Nunca las dos.**

### SM-E2 · `#1006` — El catálogo de apps anuncia herramientas que fueron podadas

- **Estado:** TERMINADO
- **Cierre:** 716e63da4460cf02abaa7b6ee825124e697e8c43
- **DoD:** lo anunciado y lo cableado coinciden, **ítem por ítem** (no «en general»).

### SM-E3 · `#1020` — Cinco capacidades del backend cableadas que nadie llama

- **Estado:** DOD-PARCIAL
- **Falta:** CODIGO COMPLETO, FALTA DEVICE (+1 punto bloqueado por el operador). Las 5 capacidades quedaron clasificadas, ninguna en el medio: (1) PUT /gastos/{id}/imputacion -> CABLEADA el 14-10, merge ddd68358 (PR #1180): gasto.imputacion en el tipo Gasto de core, imputarGasto/desimputarGasto contra gastos_web.py:161, leerTrabajos para el selector y el bloque de imputacion en DetalleGasto de los DOS fronts (web paso de 0 a 8 tests). (2) GET /trabajos/{eslabon}/{ref}/margen -> CABLEADA: imputacionDeTrabajos en packages/core/src/api/inteligencia.ts (8 casos, mutante 6 rojos/31 verdes) y las dos TarjetaMargenTrabajo gemelas pintan el conteo siempre que haya barra (web GraficosInteligencia.tsx:151 + mobile :163), que es el DoD de UI del hallazgo 2. (3) POST /inteligencia/chat -> RETIRADA, entro en 9e536c38 (PR #1166); 0 ocurrencias de preguntarInteligencia en packages/apps/motor de origin/main (git grep 14-10). (4) POST /mi-dia/tarjetas -> CABLEADA el 14-10, merge 274af593 (PR #1181): crearTarjetaMiDia (miDia.ts:240) deja de estar sin consumidor, con formulario en MidiaScreen (web, 29 tests) y PantallaMiDia (mobile, 67 tests), y el 400 del backend convertido en ESTADO de la UI en vez de promesa (46 tests de core). (5) POST /auth/cambiar-email -> clasificada 'se cablea' pero BLOQUEADA por SMTP (SM-C5, operador): unico punto que no cierra por codigo. Backend previo: merge e7601bc6 (PR #1154) + LECTURA de la imputacion en merge b392389b (PR #1175), GET /gastos y GET /gastos/{id} con gasto.imputacion {gasto_id,presupuesto_ref,comprobante_ref,cobro_ref}, misma forma que el retorno del PUT (adversarial + canario + mutante, VPS). FALTA PARA TERMINAR: la pasada de device de los dos flujos nuevos (imputar un gasto y anotar una tarjeta), con receta escrita de 7 veredictos, en manos de frontend2 -- contrato_ del 14-10 en el buzon. HALLAZGO que NO reabre esta ficha (DEC-18): la rama modo:'detalle' de leerGraficoMargenTrabajo (inteligencia.ts:503-512, tipada DetalleMargenTrabajo con trabajo: unknown [PROVISIONAL]) no tiene consumidor -- GraficosInteligencia.tsx:153 la llama sin params y siempre cae en modo:'lista', y hay 0 ocurrencias de DetalleMargenTrabajo en todo apps/. Mi barrido conto FUNCIONES de red sin consumidor (71 en core, 0 huerfanas) y por construccion no podia ver una RAMA muerta del retorno de una funcion que si se consume: va como hallazgo propio, no como hueco de SM-E3.
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

- **Estado:** PENDIENTE
- **DoD:** las 6 con veredicto del vocabulario cerrado y su `medido_contra:`.
- **Depende de:** SM-A1.

### SM-F2 · `M-02` — Medir en device los 46 ids que faltan

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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
