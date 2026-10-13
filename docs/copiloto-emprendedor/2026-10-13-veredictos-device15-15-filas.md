# Veredictos DEVICE15 — las 15 filas `nativa-con-device` del mapeo, medidas en el teléfono

**Fecha:** 2026-10-13 · **Contrato:** `2026-10-13_contrato_planificacion-a-frontend2_EL-DEVICE-TIENE-DEV-CLIENT-y-NO-hace-falta-rebuild-tu-frente-son-las-15-filas-con-device` ·
**Mapeo de origen:** [`2026-10-12-mapeo-prototipo-vs-nativo.md`](2026-10-12-mapeo-prototipo-vs-nativo.md) ·
**Sesión:** frontend2 (dueña única del device durante la medición)

## Qué se midió y sobre qué

| dato | valor |
|---|---|
| **SHA que servía Metro** | **`2610bb6b`** — working tree del worktree `wt-fe2-mapeo`, `apps/` sin tocar (`git status`: sólo `artefactos-build/` sin trackear) |
| Binario | dev-client ya instalado en el teléfono (`app.copiloto.emprendedor`); **no se compiló nada**, el JS llegó por Metro local por USB |
| Device | Samsung `RF8T318RN9T`, 720×1600 px (1 dp = 1,875 px) |
| Usuario | **`e2e-device@copiloto.test`** (el canónico); ningún otro |
| Gestos | `adb shell input motionevent DOWN/MOVE/UP`. **Nunca `input tap`**: no ejercita un `Gesture.Pan` de RNGH (memoria `adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan`) |
| Lectura | `uiautomator dump` (árbol, `resource-id`/texto/bounds) cuando hay idle; `screencap` crudo con hash cuando hay animación (el dump no consigue idle) |
| Capturas | locales en el scratchpad de la sesión, **no versionadas** (repo público; son pantallas del tenant de prueba). Reproducibles con los gestos de la tabla de cada fila |

## Cómo leer los veredictos

Vocabulario **cerrado** (otra palabra = veredicto sin definición):

| veredicto | significa |
|---|---|
| `COHERENTE` | medido en device y coincide con la referencia |
| `DESVÍO` | medido en device y **no** coincide; la divergencia está descrita |
| `NO_MEDIBLE` | no hay forma de medirlo con este instrumento; el **motivo** va escrito |
| `FUERA-DE-REFERENCIA` | la referencia (prototipo) no lo define; no hay contra qué comparar |
| `NO_REPRODUCIBLE_SIN_EFECTO` | existe, pero forzarlo exige un efecto irreversible o externo |
| `PENDIENTE_DEVICE` | falta device (ninguno quedó así) |
| `REQUIERE_TRIAGE` | hallazgo que no es de esta fila (ninguno quedó así: van a «Hallazgos») |
| `INCOMPLETO` | medido a medias (ninguno quedó así) |

**Un veredicto no cruza dos dimensiones.** Cada fila lleva dos: **CONT** (texto, copy, datos que se ven) y **COMP**
(estructura, forma, gesto, animación). «Sin comparación» **no** es «coincide»: lo que no pude comparar queda
como `NO_MEDIBLE`/`NO_REPRODUCIBLE_SIN_EFECTO` con motivo, no como `COHERENTE`.

⚠️ Lo que viene del **código** y no del teléfono va marcado `[código]` y **no cuenta** como medición de device.

## Resumen

| # | fila | CONT | COMP | nota |
|---|---|---|---|---|
| 1 | `(home)` | DESVÍO | DESVÍO | agenda «Ahora» inline → `NO_REPRODUCIBLE_SIN_EFECTO` |
| 2 | `bi-refresh` | DESVÍO | DESVÍO | el refresh se dispara **antes** del UP |
| 3 | `bloqueado` | DESVÍO | DESVÍO | botones «Pausar»/«Enviar» partidos en 2 líneas |
| 4 | `chat` | DESVÍO | DESVÍO | |
| 5 | `consent` | `NO_REPRODUCIBLE_SIN_EFECTO` | `NO_REPRODUCIBLE_SIN_EFECTO` | el sheet no se alcanza sin un efecto externo |
| 6 | `detalle` | DESVÍO | DESVÍO | monto/fecha bajo el pliegue: `NO_MEDIBLE` en esa parte |
| 7 | `entrada` | DESVÍO | `NO_MEDIBLE` | fondo medido; la animación no se resuelve con screencap |
| 8 | `esc` | `FUERA-DE-REFERENCIA` | DESVÍO | **incumple la decisión A del operador** (reset a Mi día) |
| 9 | `feedback` | DESVÍO | DESVÍO | |
| 10 | `grabando` | DESVÍO | DESVÍO | sin reloj visible |
| 11 | `ingresos` | DESVÍO | COHERENTE | el mapeo decía «ninguna medida»; en device hay 3 diferencias de contenido |
| 12 | `reveal` | DESVÍO | DESVÍO | forma residual sobre el wordmark |
| 13 | `soporte` | DESVÍO | DESVÍO | card de ticket → `NO_REPRODUCIBLE_SIN_EFECTO` |
| 14 | `splash` | DESVÍO | DESVÍO | sin tagline |
| 15 | `tablero` | DESVÍO | DESVÍO | píldora «Reconectar» inerte |

**Cuadratura:** 15 filas / 15 con veredicto del vocabulario cerrado / 0 `PENDIENTE_DEVICE` / 0 `INCOMPLETO`.
Por dimensión COMP: DESVÍO 12 · COHERENTE 1 · `NO_MEDIBLE` 1 · `NO_REPRODUCIBLE_SIN_EFECTO` 1 (=15).

---

## Fila por fila

### 1. `(home)` — Mi día en reposo

**Gesto / cómo:** arranque en frío (`force-stop` + deep link del dev-client) → Mi día; scroll vertical con
`DOWN (360,1000) → MOVE… → UP (360,500)` para ver el cuerpo (`home-tope`, `home-scroll1/2`).

**Observado** (`2610bb6b`): pestaña superior con rótulo **«FUNCIONES»**; wordmark «Odobi» + fecha; tarjeta «En caja»
con chip «Al 13 de octubre» y Entró / Salió / Por cobrar; resumen «8 para hoy · 0 en curso · 1 crítico»; solapas
Para hoy / Haciendo / Hechas. El hint del panel de chat dice **«ESCRIBILE A ODOBI»** en las 13 volcadas del árbol.

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | el prototipo (`index.html:1639`) dice «Baja para tus funciones»; el nativo, «FUNCIONES». No existe el vínculo «Ver tablero ›» (el tablero se fusionó en las solapas) |
| COMP | **DESVÍO** | «Para hoy» + tablero aparte del prototipo → solapas con chips por categoría; el grip es una pestaña, no un asidero con texto |
| agenda «Ahora» inline | **`NO_REPRODUCIBLE_SIN_EFECTO`** | requiere Google Calendar conectado; hoy está desconectado (la propia pantalla lo dice) y reconectarlo es un OAuth externo |

### 2. `bi-refresh` — tirar para actualizar en Inteligencia

**Gesto / cómo:** `deep copiloto://inteligencia`; `DOWN (360,700)` + 15 `MOVE` hasta `y=1300` + `UP`, con un muestreo
de `screencap` crudo en un hilo aparte (franja del texto de estado, hash por muestra, periodo medio 0,94 s).
`t_DOWN=1,5 s · t_UP=5,3 s`.

**Observado:** el texto de estado recorre **4 estados distintos**: «Tirá para actualizar» (0,0–0,8 s) → «Actualizando…»
(1,9–2,8 s) → «Al día · recién» (3,7–5,5 s) → «Tirá para actualizar» (6,3 s en adelante). Los dos cambios
ocurren **mientras el dedo sigue apoyado** (antes del UP a 5,3 s).

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | línea permanente «Tirá para actualizar» siempre visible sobre el scroll; el prototipo la muestra sólo durante el arrastre |
| COMP | **DESVÍO** | indicador del sistema (`RefreshControl`), no el propio que crece 0→64 px con flecha que gira; «Al día · recién» se sostuvo **≥1,8 s observado** (el código fija `MS_AL_DIA=3000` ms `[código]`) vs 700 ms del prototipo; la fase «Soltá» no es alcanzable en Android `[código]` |

### 3. `bloqueado` — grabación fijada

**Gesto / cómo:** sobre `boton-voz` (centro 360,1347): `DOWN` → sostener 1,2 s → 8 `MOVE` hacia arriba (130 px = 69 dp,
**bajo** el umbral de 80 dp) → `UP`; repetido con **~240 px** para fijar de verdad; y una diagonal (`diag-*`) para
medir qué eje gana. Capturas `v2-fijando`, `v2-bloqueado`, `diag-*`.

**Observado** (`v2-bloqueado`): ecualizador de ancho completo, y debajo **«Pausar» y «Enviar» partidos en dos líneas
(«Paus/ar», «Env/ar»)** dentro de botones que no les alcanzan; «Eliminar» con tacho en una píldora aparte. **Sin
cronómetro. Sin candado/caret. Sin «desliza para cancelar».** En diagonal, **el candado gana** (no hay eje dominante).

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | botones de texto «Pausar/Enviar/Eliminar» vs tacho + onda + «En pausa» + mic-como-enviar del prototipo (`index.html:2924`) |
| COMP | **DESVÍO** | texto cortado en los botones (defecto visual, no de copy); sin pista de columna de candado; con 130 px (69 dp) **no** fija: al soltar, **envía** |

### 4. `chat` — el panel de chat vacío

**Gesto / cómo:** reposo del chat; arrastre del asidero `panel-handle` con `DOWN/MOVE/UP` (x=360, y≥70).

**Observado:** estado vacío con isotipo (`marca`), «¿En qué te ayudo?», rodillo con «Gasté 15 lucas en nafta», nota
«Antes de ejecutar algo importante, te lo muestro para que lo confirmes.», placeholder «Escribí, o hablá…», indicador
«Pedir confirmación».

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | grip: el prototipo dice «Baja para volver a Mi día» (`index.html:1873`); el nativo, «ESCRIBILE A ODOBI» en ambas posiciones. Rodillo y placeholder: iguales `[código]` |
| COMP | **DESVÍO** | isotipo del vacío 120 px de caja (≈64 dp) vs 96 px del prototipo |

### 5. `consent` — hoja «Conectá {servicio}»

**Gesto / cómo:** se intentó llegar con pedidos reales por el chat (texto): «Mercado Pago» y «HubSpot». El agente
contestó **texto**, sin emitir la card `requiere_conexion` que monta el sheet.

**Por qué no se alcanza:** el sheet sólo se monta con una card backend `requiere_conexion` y ésta debe ser **el último
mensaje del asistente** (`conexionPendienteDelHilo`). Forzarla exige provocar una tool que falle por falta de
conexión (conectar/desconectar una cuenta de Composio): efecto externo.

| dim | veredicto | porqué |
|---|---|---|
| CONT | **`NO_REPRODUCIBLE_SIN_EFECTO`** | el sheet existe y no se pudo ver sin tocar una integración real |
| COMP | **`NO_REPRODUCIBLE_SIN_EFECTO`** | ídem |

`[código]` (no es medición): copy nativo «Conectá {label}» / «Para hacer eso necesito acceso a {label}.» + viñetas «• »,
vs «Conectar Mercado Pago» / «Esto es lo que voy a poder hacer:» + filas con negrita y «Solo lectura»/«Nunca sin tu OK»
del prototipo (`index.html:2604-2625`). **Esa diferencia queda declarada como lectura, no como DESVÍO medido.**

### 6. `detalle` — fila expandida de Mi día

**Gesto / cómo:** tap (`DOWN/UP` motionevent) sobre la primera tarjeta de Para hoy → expandida; scroll para
ver el resto (`detalle-expandida`, `detalle-scrolled`).

**Observado:** «La factura 3 de Cliente Seed Mi Dia sigue impaga hace 31 días.», verbo «Reclamar el pago» (texto,
no pulsable `[código]`), «Cliente Seed Mi Dia». La línea de monto/fecha queda **bajo la franja del chat** y el scroll
no la trae a la vista.

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | sin chip «31 días sin respuesta», sin filas kv «Monto/Enviado», sin píldora de acción |
| COMP | **DESVÍO** | sin tile de color; las acciones son swipe, no CTA |
| línea monto · fecha | **`NO_MEDIBLE`** | motivo: queda bajo el pliegue del panel de chat y no se pudo llevar a la vista con el instrumento (salvedad de la fila, no «coincide») |

### 7. `entrada` — pantalla de verificación de sesión

**Gesto / cómo:** arranque en frío logged-out y con sesión; muestreo `screencap` crudo (`entrada-f00..f09`).

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | fondo **crema** (`tema.color.fondo`) vs **blanco** fijo `#FFFFFF` del prototipo (`index.html:2438`): visible en `entrada-montaje` |
| COMP | **`NO_MEDIBLE`** | motivo: el periodo de muestreo de `screencap` (~0,5–1 s) no resuelve una animación de 1,5 s con `translateX/scaleX`; con las escalas de animación del sistema en 0, Reanimated entra en *reduced motion* y mide otra cosa |

### 8. `esc` — escritorio de funciones y reposo único

**Decisión vigente (2026-10-12, operador, opción A):** al bajar el chat el escritorio **se cierra** y se vuelve a Mi día;
el reposo es único.

**Gesto / cómo:** abrir el escritorio arrastrando la pestaña `panel-funciones-pestana` (arrastre vertical con `DOWN/MOVE/UP` en x=360,
y≥70 para no abrir la cortina de notificaciones); subir el chat (`DOWN` en `panel-handle` → arriba); bajarlo otra vez.
`esc-0 … esc-10`.

**Observado** (`esc-10`): con el escritorio abierto y el chat **bajado**, el escritorio sigue abierto («Funciones»,
6 tiles, «Actividad reciente»). La pestaña de vuelta («VOLVER A TU DÍA») **no se ve**: queda tapada por la franja del chat.

| dim | veredicto | porqué |
|---|---|---|
| COMP | **DESVÍO** | **contra la decisión A, no sólo contra el prototipo**: el escritorio no se cierra al bajar el chat. Es un incumplimiento de una decisión firmada, no una divergencia de estilo |
| CONT | **`FUERA-DE-REFERENCIA`** | la fila es de comportamiento y el prototipo no define la regla (`index.html:2688-2692`: las 4 funciones tocan una sola capa). Observación menor: la etiqueta «Presupuestos» se parte en «Presupuesto/s» dentro del tile |

### 9. `feedback`

**Gesto / cómo:** `deep copiloto://ajustes-cuenta` → «Feedback» (el engranaje del dev-client cubre `avatar-cuenta`).
Lectura de árbol + `ajustes-feedback.png`.

**Observado:** título «Feedback»; «¿Qué le cambiarías?»; «Contanos qué te gustaría que mejoremos, o grabá un audio si
preferís hablarlo.»; rótulo **«TU FEEDBACK»** sobre el campo; botón «Enviar»; luego la card **«¿Algo no funciona?» →
Soporte técnico**; luego mic redondo «Tocá para grabar»; luego «Lo pediste vos» con estado «Enviado».

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | título «Contanos qué tal» vs «Feedback»; rótulo extra «TU FEEDBACK»; botón «Mandar» vs «Enviar»; «Lo pediste vos» muestra «Enviado», el prototipo el mes («Julio») |
| COMP | **DESVÍO** | la derivación a Soporte va **antes** y como card, el prototipo la pone **después** de «Lo pediste vos» como nota; «Dictarlo» inline vs botón mic de 64 px |

### 10. `grabando` — grabación en curso (sin fijar)

**Gesto / cómo:** `DOWN` sobre `boton-voz` y mantener 2,5 s sin deslizar; luego 130 px a la izquierda sin soltar
(armar cancelación) y `UP` a la izquierda (`v2-grabando-quieto`, `v2-cancelando`, `v2-tras-cancelar`).

**Observado:** overlay flotante con **ecualizador/onda**; al armar la cancelación aparece **«Soltá para cancelar»**.
Soltar a la izquierda descarta sin enviar. **No hay reloj visible** en ningún momento.

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | falta el reloj `0:07` y «desliza para cancelar» del prototipo; el texto sólo aparece cuando ya se armó la cancelación («Soltá para cancelar») |
| COMP | **DESVÍO** | el prototipo transforma la barra del composer (punto rec + reloj + lock-col); el nativo es un overlay |

### 11. `ingresos`

**Gesto / cómo:** `deep copiloto://ingresos`; lectura de árbol + `ingresos.png`.

**Observado:** título «Ingresos»; tarjeta oscura «Cobraste este mes» / «$0,00» / chip «Mes anterior: $30.000,00»;
mic circular con ecualizador + botón «Anotar que me pagaron» lado a lado; rótulo **«BUSCAR»** + campo «Buscar un
ingreso»; filas con importe, concepto, fecha y «Borrar».

El mapeo decía «ninguna medida» (enmienda PR #614 sobre el mic). **En device hay diferencias de contenido que el mapeo no registraba:**

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | (1) sin período junto al título («Agosto» en el prototipo, `index.html:2247`); (2) el rótulo «Últimos» se reemplaza por «BUSCAR» + buscador; (3) sin la nota «Los cobros por MercadoPago todavía no entran solos…» — causa no atribuida (puede ser deliberado, el prototipo la escribió para un estado anterior) |
| COMP | **COHERENTE** | resumen oscuro + acción «Anotar que me pagaron» + lista de filas; el mic es el de la enmienda #614 (mismo `BotonVoz`) |

### 12. `reveal` — «volver a entrar» / primera vez

**Gesto / cómo:** cerrar sesión (animaciones normales, «Sí, cerrar sesión») y arranque en frío logged-out; muestreo
`screencap` crudo (`logout-f00..f11`, `reveal-frio-*`, `reveal-frio2-f00..f25`).

**Observado** (montaje `reveal-secuencia`, cuadros f04/f08/f12/f16/f20/f25 de `reveal-frio2`): los primeros
cuadros son **gris oscuro** (antes de montar la pantalla); luego fondo crema con el isotipo de arcos; luego
«se dice o-DO-bi» **antes** que el wordmark, con una forma terracota grande a la derecha; estado final: isotipo-tile
+ «dobi» (la «o» es el tile) y **un anillo y una mancha terracota residuales superpuestos al «bi»**; una sola
acción «Empecemos». **No hay botón de pronunciar** (altavoz).

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | sin «Crear una nueva cuenta» (decisión documentada para `primeraVez`, `EntradaSesion.tsx:17-21` `[código]`); wordmark 40 dp `#B04A2E` vs 46 terracota `[código]` |
| COMP | **DESVÍO** | forma residual en reposo sobre el wordmark; sin botón pronunciar (`rv-say`, `index.html:2549`) |

### 13. `soporte`

**Gesto / cómo:** `deep copiloto://ajustes-cuenta` → «Soporte técnico»; árbol + `ajustes-soporte.png`.

**Observado:** título «Soporte técnico»; marca + «Soporte técnico» / «Contesto al toque. Si no lo puedo resolver,
abro un ticket y lo sigue una persona.»; «Los tickets los responde una persona del equipo; todavía no tenemos un plazo
de respuesta fijo…»; chat vacío; mic y composer. **No aparece «Ver tickets anteriores».**

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | «todavía no tenemos un plazo de respuesta fijo» vs «Antes de 4 h hábiles» del prototipo; sin «Ver tickets anteriores (3) ›» |
| COMP | **DESVÍO** | sin clip de adjuntos; entrada por hold-to-record + composer |
| card «Ticket #… · Abierto · Sobre · Te contestan» | **`NO_REPRODUCIBLE_SIN_EFECTO`** | aparece al abrir un ticket real: el equipo lo recibe junto a la cuenta (efecto externo). No se abrió |

### 14. `splash` — identidad de entrada

**Gesto / cómo:** arranque en frío, muestreo de `screencap` (`reveal-frio-f00..f10`, `reveal-frio2-*`).

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | **no existe** la tagline «Tu copiloto emprendedor» en ningún cuadro; sólo «se dice o-DO-bi». Acciones: sólo «Empecemos» (secundaria omitida en `primeraVez`) |
| COMP | **DESVÍO** | la forma que debería «aterrizar» como «O» queda **residual** sobre el «bi» en el estado final; formas de color sólido (el prototipo usa gradientes y radios asimétricos `[código]`) |
| wordmark letra por letra con rebote | **`NO_MEDIBLE`** | motivo: cuadros cada ~1 s (periodo de `screencap`) no resuelven una animación por letra; el mapeo lo declaraba ausente y **no se confirma ni se refuta** |

### 15. `tablero`

**Gesto / cómo:** `deep copiloto://midia`; tap sobre la solapa y sobre «Reconectar»; scroll.

**Observado** (`midia-abierto`, `detalle-expandida`): título **«Mi día»** con ícono; tarjeta «En caja»; resumen de
texto «8 para hoy · 0 en curso · 1 crítico» **fuera** de las solapas; banner oscuro «Se me cayó la conexión con Mercado
Pago…» con píldora **«Reconectar» no pulsable** (`clickable=false`); solapas «Para hoy / Haciendo / Hechas» **sin
contador**; viewport de `midia-lista` ≈120 dp con 2 avisos activos.

| dim | veredicto | porqué |
|---|---|---|
| CONT | **DESVÍO** | «Mi día» vs «Tu día»; solapas sin contador; falta la nota «Las que detecta Odobi se cierran solas…» |
| COMP | **DESVÍO** | la píldora «Reconectar» no hace nada; con los avisos, el viewport útil de la lista queda ≈120 dp |

---

## Hallazgos (la causa **no** está atribuida salvo donde se indica)

| # | hallazgo | dónde | gravedad |
|---|---|---|---|
| H1 | **`esc` incumple la decisión A del operador**: el escritorio no se cierra al bajar el chat, y su pestaña de vuelta queda tapada | fila 8 | alta (decisión firmada) |
| H2 | **Crash nativo en arranque en frío logged-out**: `SIGSEGV` en `libreactnative` (`MountingCoordinator::pullTransaction`, hilo `mqt_v_js`) entre ~20 y ~36 s; **1 de 2** en la medición original → **reproducido 2 de 24 con `screencap` concurrente, 0 de 12 sin él** (sección «H2 — CRASHFRIO» abajo). Causa **del binario, no del JS**: stack idéntico al de react-native-screens#4654, fix upstream en `react-native-screens` ≥ 4.28.0 (#4413), **no verificado en nuestro binario** | arranque | alta (binario: requiere rebuild EAS → escalada a planificación) |
| H3 | El chat arranca **arriba** con hint «ESCRIBILE A ODOBI» pese a `arrancaAbajo` (3/3 en la ventana previa) | filas 1, 4 | media |
| H4 | El refresh de Inteligencia **se dispara durante el arrastre**, antes del UP | fila 2 | media |
| H5 | «Reconectar» del banner es una píldora **inerte** (`clickable=false`) | fila 15 | media |
| H6 | «Pausar»/«Enviar» **partidos en dos líneas** («Paus/ar», «Env/ar») en la grabación fijada | fila 3 | media |
| H7 | Una grabación de 130 px (69 dp, **bajo** el umbral) al soltar **envía** en vez de descartar | fila 3 | baja (es el diseño: soltar sin fijar envía) |
| H8 | Forma residual (anillo/mancha) en reposo sobre el wordmark del reveal | filas 12, 14 | media |
| H9 | El teclado no se cierra al bajar el chat | observación | baja |
| H11 | En el arranque en frío los primeros cuadros son **gris oscuro** antes de la pantalla crema | filas 12, 14 | baja (no atribuido) |
| H10 | El mapeo decía «ninguna medida» para `ingresos`; hay 3 diferencias de contenido | fila 11 | baja |

**Lo que este documento no acredita:** no implementa ningún fix. Los DESVÍO reales se reportan a planificación
para decidir cuáles se baja a código y cuáles son enmienda (el prototipo es una hoja de estados, no un spec).

## H2 — CRASHFRIO: reproducción, stack y atribución (2026-10-13, tarde)

**Qué se midió.** Mismo device (`RF8T318RN9T`), JS servido por Metro del SHA `2610bb6b` (el worktree `48d26a59`
tiene `apps/` idéntico: `git diff --stat 2610bb6b HEAD -- apps` vacío), Metro con `EXPO_PUBLIC_API_BASE` y `--clear`,
app **logged-out** tras cierre voluntario (reveal «volver»), animaciones del sistema normales. Cada arranque:
`logcat -c` → `am force-stop` → `am start` del deep link del dev-client → ventana de 50 s → `logcat -d -b all` a
**archivo completo** (nunca por `tail`) + `dumpsys activity exit-info`. Receta versionada:
[`2026-10-13-receta-crashfrio.py`](2026-10-13-receta-crashfrio.py). Los archivos crudos por corrida **no** se versionan
(≈600 KB cada uno); viven en el scratchpad de la sesión.

| serie | condición | crash / N |
|---|---|---|
| A | sin `screencap` concurrente | **0 / 12** |
| B | con `screencap` concurrente (la condición del hallazgo original) | **1 / 12** (corrida 7) |
| C | idem B, segunda serie | **1 / 12** (corrida 2) |
| control + | `kill -11` sobre el proceso vivo (desaparece a los 17,4 s del arranque) | **1 / 1** detectado: `code 0 (SI_USER from pid 8000, uid 10249)` |

Con `screencap`: **2 de 24 (≈8 %)**; sin él: 0 de 12. **No se puede afirmar que el `screencap` cause nada**: 0/12 vs 2/24
no es distinguible (Fisher exacto ≈ 0,5). Combinadas las tres series dan **2 de 36 (≈5,6 %)**. La corrida verde de la
serie A **no refuta**: es la tasa. El control positivo descarta que el instrumento esté ciego (distingue el `SI_USER`
del control del `SEGV_MAPERR/ACCERR` real). Sin fix: no hay medición «después» todavía (ver «Qué falta»).

**Stack citado** (corrida 7, `logcat`, `Process uptime: 20s`; `BuildId: 884bb48b4aec8d62f7f2bbbc4a4211097536d038`):

```
Fatal signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x370a3d3e5a1cac in tid 11504 (mqt_v_js), pid 11406 (oto.emprendedor)
backtrace:
  #00 pc 00000000011a4c70  libreactnative.so (facebook::react::MountingCoordinator::pullTransaction(bool) const+520)
  #01 pc 0000000000cc6c1c  libreactnative.so (facebook::react::FabricUIManagerBinding::schedulerDidFinishTransaction(...)+72)
  #02 pc 000000000122da84  libreactnative.so (facebook::react::Scheduler::uiManagerDidFinishTransaction(...)+100)
  #03 pc 0000000001286bb0  libreactnative.so (facebook::react::UIManager::shadowTreeDidFinishTransaction(...) const+116)
  #04 pc 00000000011ad47c  libreactnative.so (facebook::react::ShadowTree::mount(facebook::react::ShadowTreeRevision, bool) const+144)
  #05 pc 00000000011ade34  libreactnative.so (facebook::react::ShadowTree::tryCommit(...) const+1556)
  #06 pc 00000000011ad784  libreactnative.so (facebook::react::ShadowTree::commit(...) const+228)
  ...
  #14 pc 00000000011bd878  libreactnative.so (facebook::react::ShadowTreeRegistry::visit(int, ...) const+180)
  #15 pc 00000000012849cc  libreactnative.so (facebook::react::UIManager::completeSurface(int, ...)
  ...
  #21..#27 libhermesvm.so  →  #28 facebook::jsi::Function::call  →  #30 facebook::react::Task::execute
```

Corrida 2 de la serie C (`Process uptime: 36s`, mismo `BuildId`): `Fatal signal 11 (SIGSEGV), code 2 (SEGV_ACCERR),
fault addr 0x7c7a1a26e8 in tid 15093 (mqt_v_js)`; `#00 pc 0000000003a816e8 [anon:libc_malloc]` (**salto al heap**) y
`#01 …MountingCoordinator::pullTransaction(bool) const+524`, con la misma cadena `schedulerDidFinishTransaction` →
`ShadowTree::commit` → `UIManager::completeSurface`.

**Lectura (de lo medido, sin interpretar más).** Los dos crashes caen en el hilo JS (`mqt_v_js`) dentro de
`MountingCoordinator::pullTransaction` (+520 / +524), llamado desde un `completeSurface` que dispara el JS; el fault es
una dirección basura (`0x370a3d3e5a1cac`) o un salto a heap. Es **código nativo de React Native/Fabric** operando
sobre un objeto inválido: **ninguna línea de TSX aparece en el stack**.

**Atribución externa (NO verificada en nuestro binario).** El stack coincide con
[react-native-screens#4654](https://github.com/software-mansion/react-native-screens/issues/4654) (mismo frame
`pullTransaction+524`, `[anon:scudo:primary]` «jumped into the heap», RN 0.85.3/0.86.0, screens **4.25.2** — la versión
fijada acá: `apps/mobile/package.json:37` y lockfile) y con
[reanimated#10734](https://github.com/software-mansion/react-native-reanimated/issues/10734). La causa que dan los
mantenedores: `ScreensModule` registra su delegate dos veces en paralelo y el listener «is created lazily without a
lock, so the two calls can race» (carrera en el arranque en frío). Fix: **react-native-screens#4413, incluido desde
4.28.0**; verificado por terceros con «0 crashes en 115 lanzamientos» (parche local, tasa previa 1/60) y «no crashes en
400 cold launches» (4.28.0). Reportan además que sólo lo vieron en **debug** (0/225 en release): **no medimos release**,
porque no hay binario release en el device. Expo SDK 57 fija `react-native-screens` por debajo de 4.28.0.

**Veredicto H2:** `REPRODUCIDO (≈5,6 % por arranque en frío, 2 de 36)`; **causa en el binario nativo, no en el JS**;
atribución a la carrera de `react-native-screens` = hipótesis fuerte por stack idéntico y versión idéntica, **sin
verificación propia**. La observación **no se retira**. Un fix de TSX sería a ciegas: **no se hizo**.

**Qué falta (y de quién es).** Cambia de dueño y de costo: subir `react-native-screens` a ≥ 4.28.0 (o aplicar #4413
como parche) **exige rebuild EAS** del dev-client (y, para producción, del binario release). Eso no es de esta fila: vuelve
a planificación como escalada (`pedido_`). La verificación «después» queda definida: **mismo device, misma receta,
`SAMPLER=1`, N ≥ 60 sobre el binario nuevo**; con una tasa de ≈5,6 % la probabilidad de 0 crashes por azar en 60
arranques es ≈3 %, así que 0/60 sería evidencia, y N=12 no lo es.

## Efectos colaterales de la medición (declarados)

El device **escribe en la base** del usuario canónico. Quedó registrado en su tenant:

1. **2 mensajes de voz reales** al chat (ventana previa): gesto de 130 px (< umbral de 80 dp) → soltar sin fijar
   envía. Chip «Por voz · 0:52», con respuesta del agente. Modo «Pedir confirmación»: **sin tools ejecutadas**.
2. **2 mensajes de texto reales** («Mercado Pago», «HubSpot») para intentar alcanzar `consent`.
3. **Cierre de sesión y relogin** con el usuario canónico (para medir `reveal`/`splash`).
4. **Escalas de animación del sistema** modificadas durante la medición (`window/transition/animator_duration_scale`);
   restauradas a sus valores previos al terminar.

No se compiló, no se publicó nada a un usuario, no se tocó una integración real (ni conectar ni desconectar).
