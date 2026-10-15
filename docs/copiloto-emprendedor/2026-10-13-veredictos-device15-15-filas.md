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
| 3 | `bloqueado` | DESVÍO | DESVÍO | «Pausar»/«Enviar» partidos en 2 líneas: **corregido (H6)**; el DESVÍO de la fila persiste por la columna de candado |
| 4 | `chat` | DESVÍO | DESVÍO | |
| 5 | `consent` | `NO_REPRODUCIBLE_SIN_EFECTO` | `NO_REPRODUCIBLE_SIN_EFECTO` | el sheet no se alcanza sin un efecto externo |
| 13 | `soporte` | **DESVÍO** | **COHERENTE** | «se ve»: desde Ajustes → «Soporte técnico» abre la pantalla (`s1ajustes`, `s2soporte`): marca + título, «Contesto al toque. Si no lo puedo resolver, abro un ticket y lo sigue una persona.», «Los tickets los responde una persona del equipo; todavía no tenemos un plazo de respuesta fijo…», aviso de privacidad, chat vacío, mic + composer «Contame qué pasó…». **Sigue sin** «Ver tickets anteriores (N) ›» y sin clip de adjuntos: el backend de ambos **ya existe** (`web.py:996`, `:1034`), falta el código de app. «Antes de 4 h hábiles»: enmienda (no hay SLA, `BL-O7`). No se abrió ningún ticket |
| 6 | `detalle` | DESVÍO | DESVÍO | monto/fecha bajo el pliegue: `NO_MEDIBLE` en esa parte |
| 5 | `consent` | **COHERENTE** | **DESVÍO** | alcanzado sin efecto externo con un **verbo que falla**: «arma un link de cobro de 1000 pesos» (Mercado Pago figura desconectado) → nace la card y el sheet (`k3resp`). Texto: «Conectá Mercado Pago», «Para hacer eso necesito acceso a Mercado Pago.», «• Leer tus cobros» + «Solo lectura», «• Armar links de cobro cuando vos confirmás» + «Nunca sin tu OK» (los calificadores del `alcance` **se ven**), «Apenas conectes, sigo: armar el link de cobro de $1.000.» (el pendiente viene del turno), botones «Conectar» / «Ahora no». Difiere del prototipo sólo en copy deliberado (voseo; «Leer tus cobros» sin «y movimientos»; subtítulo). **DESVÍO de COMP, defecto real: el composer y el botón de voz se pintan ENCIMA del sheet** — «Conectar» queda bajo el composer y un toque sobre «Ahora no» **enfoca el campo de texto** en vez de cerrar el sheet (`k6b`, `k7tap-ahorano`). Causa: el sheet es `position:absolute` y iba antes de sus hermanos en flujo. **Corregido en este PR** (último hijo de `ChatView`, test con mutante) y **verificado en device sobre `249f382b`** (Metro del PR, core del worktree): el sheet se ve entero con «Conectar» / «Ahora no» sin nada encima (`q1`) y un toque sobre «Ahora no» **cierra el sheet** y devuelve el composer (`q2`) |
| 7 | `entrada` | DESVÍO | `NO_MEDIBLE` | fondo medido; la animación no se resuelve con screencap |
| 8 | `esc` | `FUERA-DE-REFERENCIA` | COHERENTE | era: **incumple la decisión A** (reset a Mi día). **Corregido y re-medido 2026-10-13 (TRIAJE15 A)** — ver «TRIAJE15 (A)» |
| 9 | `feedback` | DESVÍO | DESVÍO | |
| 10 | `grabando` | DESVÍO | DESVÍO | sin reloj visible |
| 11 | `ingresos` | DESVÍO | COHERENTE | el mapeo decía «ninguna medida»; en device hay 3 diferencias de contenido |
| 12 | `reveal` | DESVÍO | DESVÍO | forma residual sobre el wordmark |
| 13 | `soporte` | DESVÍO | DESVÍO | card de ticket → `NO_REPRODUCIBLE_SIN_EFECTO` |
| 14 | `splash` | DESVÍO | DESVÍO | sin tagline |
| 15 | `tablero` | DESVÍO | DESVÍO | píldora «Reconectar» inerte: **corregida (H5)**; el DESVÍO de la fila persiste por el viewport de ≈120 dp y el destino fino |

**Cuadratura:** 15 filas / 15 con veredicto del vocabulario cerrado / 0 `PENDIENTE_DEVICE` / 0 `INCOMPLETO`.
Por dimensión COMP: DESVÍO 11 · COHERENTE 2 · `NO_MEDIBLE` 1 · `NO_REPRODUCIBLE_SIN_EFECTO` 1 (=15). *(Antes de TRIAJE15 (A): DESVÍO 12 · COHERENTE 1; la fila 8 pasó por una re-medición en device, no por edición del veredicto.)*

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
| COMP | **DESVÍO** | texto cortado en los botones (defecto visual, no de copy) **→ corregido, ver H6 en «TRIAJE15 (A)»**; sin pista de columna de candado (persiste); con 130 px (69 dp) **no** fija: al soltar, **envía** (es el diseño, H7 → enmienda) |

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
| COMP | **COHERENTE** *(re-medido 2026-10-13, TRIAJE15 A; antes **DESVÍO**)* | era: **contra la decisión A, no sólo contra el prototipo**: el escritorio no se cerraba al bajar el chat. Ahora se cierra (medición en «TRIAJE15 (A)») y su pestaña «VOLVER A TU DÍA» queda sobre la tira del chat, visible |
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
| COMP | **DESVÍO** | la píldora «Reconectar» no hace nada **→ corregido, ver H5 en «TRIAJE15 (A)»**; con los avisos, el viewport útil de la lista queda ≈120 dp (persiste) |

---

## Hallazgos (la causa **no** está atribuida salvo donde se indica)

| # | hallazgo | dónde | gravedad |
|---|---|---|---|
| H1 | **`esc` incumple la decisión A del operador**: el escritorio no se cierra al bajar el chat, y su pestaña de vuelta queda tapada → **corregido y COHERENTE 2026-10-13, «TRIAJE15 (A)»** | fila 8 | alta (decisión firmada) |
| H2 | **Crash nativo en arranque en frío logged-out**: `SIGSEGV` en `libreactnative` (`MountingCoordinator::pullTransaction`, hilo `mqt_v_js`) entre ~20 y ~36 s; **1 de 2** en la medición original → **reproducido 2 de 24 con `screencap` concurrente, 0 de 12 sin él** (sección «H2 — CRASHFRIO» abajo). Causa **del binario, no del JS**: stack idéntico al de react-native-screens#4654, fix upstream en `react-native-screens` ≥ 4.28.0 (#4413), **no verificado en nuestro binario** | arranque | alta (binario: requiere rebuild EAS → escalada a planificación) |
| H3 | El chat arranca **arriba** con hint «ESCRIBILE A ODOBI» pese a `arrancaAbajo` (3/3 en la ventana previa) → **corregido y COHERENTE 2026-10-13, «TRIAJE15 (B)»** | filas 1, 4 | media |
| H4 | El refresh de Inteligencia **se dispara durante el arrastre**, antes del UP → **corregido y COHERENTE 2026-10-13 (6 pantallas), «TRIAJE15 (B)»** | fila 2 | media |
| H5 | «Reconectar» del banner es una píldora **inerte** (`clickable=false`) → **H5a corregido; H5b (destino fino) DESVÍO declarado, «TRIAJE15 (A)»** | fila 15 | media |
| H6 | «Pausar»/«Enviar» **partidos en dos líneas** («Paus/ar», «Env/ar») en la grabación fijada → **corregido y COHERENTE 2026-10-13, «TRIAJE15 (A)»** | fila 3 | media |
| H7 | Una grabación de 130 px (69 dp, **bajo** el umbral) al soltar **envía** en vez de descartar → **enmienda (C) 2026-10-13: es el diseño; asentado en el mapeo** | fila 3 | baja (es el diseño: soltar sin fijar envía) |
| H8 | Forma residual (anillo/mancha) en reposo sobre el wordmark del reveal → **corregido y COHERENTE 2026-10-13, «TRIAJE15 (B)»** (las filas 12 y 14 siguen DESVÍO por otras causas) | filas 12, 14 | media |
| H9 | El teclado no se cierra al bajar el chat → **declarado (C) 2026-10-13, sin fix; con disparador** | observación | baja |
| H11 | En el arranque en frío los primeros cuadros son **gris oscuro** antes de la pantalla crema → **declarado (C) 2026-10-13, sin fix; con disparador** | filas 12, 14 | baja (no atribuido) |
| H10 | El mapeo decía «ninguna medida» para `ingresos`; hay 3 diferencias de contenido → **enmienda (C) 2026-10-13: el mapeo ya lo registra** | fila 11 | baja |

**Lo que este documento no acredita:** no implementa ningún fix **por sí mismo** (los de H1/H3/H4/H5/H6/H8 viven en el
código y se re-midieron en «TRIAJE15 (A)» y «TRIAJE15 (B)»). Los DESVÍO reales se reportan a planificación para decidir cuáles se baja a código y
cuáles son enmienda (el prototipo es una hoja de estados, no un spec).

## TRIAJE15 (A) — re-medición en device de H1 · H5 · H6 (2026-10-13)

**Qué se midió:** el **árbol de trabajo** de la rama `fe2/triaje15-a-esc-reconectar-pausar-enviar` (base `a9a87761`),
servido por Metro local sobre el dev-client ya instalado — **sin rebuild** (no autorizado). Cambios:
`PanelDeslizable.tsx` (`alBajar` al *empezar* a bajar), `PanelFunciones.tsx` (`senalCerrar` + capa sobre la tira del
chat), `PantallaPrincipal.tsx` (cableado), `ControlesFlotantes.tsx` (ancho), `PantallaMiDia.tsx` (píldora pulsable).
Mismo device `RF8T318RN9T`, usuario canónico, gestos `adb input motionevent` `DOWN/MOVE/UP`, animaciones del sistema
en 0 para `uiautomator dump`. Capturas: `h1-0`, `h1-1-escritorio`, `h1-2-chat-arriba`, `h1-3-tras-bajar`,
`h5-mi-dia`, `h5-tras-tap`, `h6-bloqueado`, `h6-pausado`.

| # | hallazgo | antes | después (medido) | instrumento | veredicto |
|---|---|---|---|---|---|
| **H1** | `esc`: el escritorio no se cierra al bajar el chat | con el chat bajado el escritorio seguía abierto y «VOLVER A TU DÍA» quedaba **tapada** | secuencia idéntica a `esc-0…esc-10`: (1) escritorio abierto arrastrando `panel-funciones-pestana` desde y=75 → `panel-funciones-capa` `[0,0][720,1450]`, pestaña «Cerrar funciones» `[0,1368][720,1450]`; (2) chat arriba (`panel-handle` `[0,47][720,152]`); (3) chat bajado → `panel-funciones-capa` `[0,0][720,83]`, pestaña «Ver funciones» `[0,1][720,83]`, `pantalla-midia` visible. **Escritorio cerrado, reposo = Mi día.** Con escritorio abierto y chat abajo (`h1-1-escritorio`) se ven a la vez «VOLVER A TU DÍA» y el asidero «ESCRIBILE A ODOBI». Reabrir y cerrar con su pestaña funciona (sin estado trabado) | `uiautomator dump` con idle + `screencap` | **COHERENTE** |
| **H5a** | «Reconectar» inerte (`clickable=false`) | píldora sin acción | `midia-alerta-111-accion` (`content-desc` «Reconectar», `[60,1161][246,1217]`); `motionevent` DOWN/UP en su centro (153,1189) → **abre Ajustes** (`h5-tras-tap`: «Tu negocio / La app / Ayuda», entre ellas «Apps conectadas») | `uiautomator dump` + `screencap` | **COHERENTE** |
| **H5b** | la acción lleva a la **pantalla fina** (Apps conectadas / ARCA) | — | **No.** Lleva a Ajustes (lo único que `PantallaMiDia` ya sabe abrir). Un destino por `regla` exige que la tarjeta traiga `destino` (`TarjetaMiDia` no lo tiene, `packages/core/src/api/miDia.ts`) y hoy no hay tabla `regla → ruta` en el contrato | — | **DESVÍO declarado** → `pedido_`; no se inventa la tabla |
| **H6** | «Pausar»/«Enviar» partidos en dos líneas | «Paus/ar», «Env/ar» | grabación fijada con **240 px** (`h6-bloqueado`) y en pausa (`h6-pausado`): «Pausar»/«Reanudar» y «Enviar» **en una línea**, botones repartidos a ancho completo; «Eliminar» aparte | **`screencap`** (no `dump`: la onda animada impide el idle de `uiautomator`, sin árbol en todos los intentos) | **COHERENTE** |

**Causa de raíz de H6** (no «se achicó la fuente»): `overlayVoz` centra (`alignItems:'center'`) y los botones llevan
`flex:1`; sin un contenedor que estire, el ancho colapsa a *min-content* y el texto parte. Arreglo: el contenedor de
`ControlesFlotantes` pasa a `alignSelf:'stretch'`.

**Qué NO acredita esta sección:**
- **Rótulos de asidero / `ASOMO=62`** (parte de la fila 8 que no era la decisión A): no se tocaron ni se re-midieron;
  siguen como estaban.
- **H5 no es «la fila 15 COHERENTE»:** el viewport de ≈120 dp con dos avisos y «Mi día» vs «Tu día» persisten.
- **H6 no es «la fila 3 COHERENTE»:** persisten la columna de candado ausente, el reloj y los botones de texto vs
  tacho + onda del prototipo (CONT).
- El historial del usuario canónico contiene notas «Por voz» de pasadas anteriores de esta ventana: el gesto de
  130 px **envía** por diseño (H7). Por eso esta medición usó 240 px y terminó con «Eliminar» (cero envíos nuevos).
- jest `apps/mobile` (shell, midia, chat, theme): 468/470 con **1 rojo ajeno** (`TarjetaPresupuestoPropuesto` ›
  «al guardar, llama a `onResolver`…»: `render function has not been called`, a los 20 s bajo carga paralela);
  **aislado pasa 45/45** junto con `PantallaMiDia`. Es un timeout de suite completa, no del cambio. `tsc` rc=0,
  `eslint` rc=0, paridad de testID rc=0.

## TRIAJE15 (B) — re-medición en device de H3 · H4 · H8 (2026-10-13)

**Qué se midió:** el árbol de trabajo de `fe2/triaje15-a-esc-reconectar-pausar-enviar` servido por Metro local sobre
el dev-client ya instalado — **sin rebuild** (no autorizado). Mismo device `RF8T318RN9T`, usuario canónico, gestos
`adb input motionevent` `DOWN/MOVE/UP`. **Techo declarado:** los tres cierran con la medición en device; ninguno cierra
por «se ve bien». Skill `swmansion-rn-gestures` consultada **antes** del tercer intento de H4 (regla de dos fallos).

| # | hallazgo | antes | después (medido) | instrumento | veredicto |
|---|---|---|---|---|---|
| **H3** | el chat arranca arriba pese a `arrancaAbajo` | 3/3 arranques en frío con el panel **arriba** y el hint «ESCRIBILE A ODOBI» (ventana previa). Con un `console.log` en `onLayout`: un único layout, `h=853 insetsTop=24 recorrido=0` — el `if (recorrido.value > 0)` **nunca entraba** | 3/3 arranques en frío: tras el único layout, `panelY 0 → 773,33` (abajo) y Mi día visible (`h3-arranque-en-frio.png`, volcados `h3-dump-r2/r3`) | `logcat` de `ReactNativeJS` con marcadores + `uiautomator dump` con idle | **COHERENTE** (arranque en frío; ver el 2º camino abajo) |
| **H3b** (re-login, mismo proceso) | tras «Cerrar sesión» → «Entrar con otra cuenta» → login, el chat llega **arriba** con el hint «ESCRIBILE A ODOBI» y el asidero no baja. Con la instrumentación temporal: nueva instancia (`MONTA`), un único `onLayout` (`h=853,33 insetsTop=24 medido=773,33`), `panelY 0 → 773,33` en el hilo de UI y sin escrituras posteriores — **el modelo dice «abajo», la vista nativa queda en `translateY` 0** (2/2 re-logins) | la escritura inicial se difiere un frame (`requestAnimationFrame`): **3/3 re-logins** con el chat abajo y Mi día visible (`r5-tras-login`, `r9-ciclo2`, `r9-ciclo3`), **3/3 arranques en frío** abajo (`c1-frio`…`c3-frio`) y el asidero sube el chat (`c3-sube`) | `logcat`/log de Metro con `[H3B]`/`[H3C]` + `screencap`, mismo disparador (logout → login) | **COHERENTE** (techo: causa de fondo no aislada) |
| **H4** | el refresh se dispara durante el arrastre | Gastos, 4 corridas `DOWN` → 10 `MOVE` → 6 s sostenido → `UP`: **0/4 correctas** — 1 disparó `onRefresh` **0,3 s después del DOWN** (con el dedo apoyado); 3 **nunca** dispararon (ni tras el UP) | Gastos **3/3** (+1 corrida de control): `onRefresh` a **≈0,2 s después del UP** (UP 38,618 → 38,821 · 52,033 → 52,238 · 05,423 → 05,632). Inteligencia, Clientes, Ingresos, Presupuestos y Facturación: 1/1 cada una | marcadores `log -t H4MARK` (`h4-gesto.sh`) + `logcat`; `h4-durante-hold.png` / `h4-fix-durante-hold.png` | **COHERENTE** (6 pantallas) |
| **H8** | forma residual sobre el wordmark | `screencap` ≥ 9 s tras «Sí, cerrar sesión» (`h8-antes-6.png`, sha1 `9b88d075…`): disco blanco con anillo beige y halo terracota **pegado a la «i»**, estable | misma secuencia (`h8-d4-2.png` muestra las formas **en vuelo**, colapsando; `h8-d4-final.png`, sha1 `17b5f7b9…`): sólo isotipo + «dobi» + «se dice o-DO-bi»; los cuadros 4-8 son estables | `screencap` crudo cada 1,2 s con **animaciones ON**, mismo disparador (logout) | **COHERENTE** |

**Causa de raíz**
- **H3:** leer un shared value en el hilo JS **inmediatamente después de escribirlo** devuelve el valor viejo (la
  escritura viaja al hilo de UI). El fix usa el valor medido en una variable local. No es un problema de
  `arrancaAbajo`: era el `if` que lo aplicaba.
- **H3b:** con el valor ya correcto, en el camino logout → login (instancia nueva de `PanelDeslizable` en el mismo
  proceso) la escritura hecha **dentro** del `onLayout` llega al modelo pero no a la vista; diferida un frame sí aplica.
  **Techo declarado:** no se aisló por qué se pierde (update de estilo animado durante el montaje); la medición
  acredita el comportamiento, no el mecanismo. Si reaparece en otra pantalla con `arrancaAbajo`, el síntoma es
  «`panelY` correcto en el log, vista sin moverse».
- **H4:** el `ScrollView` de RNGH hace `waitFor` sobre el **`RefreshControl` de RNGH**; con el de `react-native` el
  árbitro no lo conoce y `onRefresh` salía a mitad del arrastre (o no salía). Las 6 pantallas con tirar-para-refrescar
  pasan al de `react-native-gesture-handler` (`ListaActividad` no: es `FlatList` RN + `RefreshControl` RN, par coherente).
- **H8:** sólo la última forma (`egg`) colapsaba, y terminaba en opacidad 0,15; las otras tres quedaban fijas a
  opacidad 1. Ahora las cuatro colapsan al terminar de crecer, a opacidad final 0 — lo que `Splash.css` ya
  declara para la web (H-A4-2: «no queda como disco permanente»).

**Qué NO acredita esta sección**
- **«Antes» de H4 sólo medido en Gastos** (4 corridas) e Inteligencia. Clientes, Ingresos, Presupuestos y Facturación
  tienen el **mismo par estructural** (`RefreshControl` RN dentro de scroll RNGH), pero su «antes» **no se midió**:
  sólo el «después» (1/1 cada una). Es una inferencia por estructura, declarada como tal.
- **H8 no es «filas 12 y 14 COHERENTES»:** la fila 12 sigue DESVÍO por el botón «pronunciar» ausente, y la 14 por el
  tagline; no se tocaron.
- **H4 no es «fila 2 COHERENTE»:** persisten el indicador del sistema vs el propio del prototipo y `MS_AL_DIA=3000`
  vs 700 ms.
- **H3 no es «fila 4 COHERENTE»:** persiste el isotipo del vacío (120 px vs 96 px).
- **Sin guarda jest para H8:** el mock de Reanimated de `IdentidadEntrada.test.tsx` devuelve `useAnimatedStyle: () => ({})`
  y no ejecuta estilos animados; la guarda de esta corrección es la captura en device, no un test. jest
  `src/modules/splash` + `src/modules/auth` 40/40, `eslint` rc=0.
- **Una primera tanda de «después» de H8 se descartó** (`h8-despues-*`, `h8-d3-*`): apagar la escala de animación
  **después** de arrancar la app deja `useReducedMotion` en `true` y el reveal no monta las formas — esa tanda
  «pasaba» sin ejercitar el fix. La medición válida arranca el proceso con la escala en 1 y no la toca (control
  positivo: formas en vuelo en `h8-d4-2.png`).

## TRIAJE15 (C) — enmiendas, no código (2026-10-13)

Decisión de planificación (no se reabre): estos cuatro no se bajan a código.

| # | enmienda | dónde quedó asentada | disparador de reapertura |
|---|---|---|---|
| **H7** | soltar el dedo **sin** haber llegado al umbral de fijado **envía**; es el diseño del gesto, no un defecto | `2026-10-12-mapeo-prototipo-vs-nativo.md`, fila `bloqueado` («ACLARADO 2026-10-13») | que el operador declare que soltar-sin-fijar debe descartar |
| **H10** | el «ninguna medida» de `ingresos` era incompleto: el composer coincide, pero hay 3 diferencias de contenido (período, «BUSCAR» + buscador, nota de MercadoPago) | mapeo, fila `ingresos` («MEDIDA 2026-10-13»); detalle en la fila 11 de este doc | decidir cuáles de las 3 son deliberadas y cuáles se bajan |
| **H9** | el teclado no se cierra al bajar el chat. **Observación única**, ninguna fila del padrón la mide; sin fix | este documento | una fila del padrón que mida el cierre del teclado, o un reporte en uso real |
| **H11** | primeros cuadros **gris oscuro** en arranque en frío. **No atribuido**: no se separó si es la pantalla de carga del dev-client o la app. Hipótesis, **no medida**: sería la del dev-client (en `h8-estado2.png` la pantalla gris sólo trae el engranaje «Tools» del dev-client, sin árbol de la app) | este documento | el rebuild EAS ya autorizado (CRASHFRIO opción B): se re-mide en el binario nuevo; si persiste ahí, deja de ser del dev-client |

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

## H2 — CRASHFRIO: medición «después» sobre el binario con el parche (2026-10-13, noche)

**Decisión (planificación, opción B):** parchear `react-native-screens@4.25.2` con el diff de #4413 vía `patch-package`
y reconstruir el dev-client. Repo: `apps/mobile/package.json:59` (`postinstall`), `apps/mobile/package.json:49`
(`patch-package` 8.0.1), `apps/mobile/patches/react-native-screens+4.25.2.patch` y la deuda de retiro `PATCHSCREENS`
(`coordinacion/PLAN.md:324`: quitarlo al subir de Expo SDK). PR #1085 (`159f883b`).

**Control del ARTEFACTO (el control es el binario, no el disco).** Build EAS `ad2ce5e4-fd31-49af-9004-5ebd43962749`.
El APK **instalado en el device** y el del build son el mismo archivo (sha256 `f2e5cf8bcf1b55ce…`, 325 391 635 B);
el APK «antes» es otro (`0630fd38965ccfef…`). `lib/arm64-v8a/librnscreens.so` **difiere**: antes 347 448 B
(`752d3e05b1250558…`), después 352 344 B (`b1ad415060a8504e…`); el `.so` extraído del build es idéntico bit a bit al del
APK instalado. Lo que se mide es, por lo tanto, el binario con el parche — no un `node_modules` parcheado en disco.

**Serie «después».** Mismo device `RF8T318RN9T`, misma receta
([`2026-10-13-receta-crashfrio.py`](2026-10-13-receta-crashfrio.py)), `SAMPLER=1` (la condición del hallazgo),
logged-out, animaciones normales, ventana de 50 s por arranque en frío, logcat `-b all` a archivo completo.

| serie | condición | crash / N |
|---|---|---|
| antes (A+B+C) | binario sin parche | **2 / 36 (≈5,6 %)** |
| después | binario con parche, `SAMPLER=1` | **0 / 60** |
| control + (después) | `kill -11` a los 17 s sobre el binario nuevo | **1 / 1** detectado: `code 0 (SI_USER from pid 26521, uid 10249)` |

Verificado con script sobre `serie.log`: 60 corridas, `crash:true` = 0, `vivo_al_final:false` = 0, hits de
`Fatal signal|SIGSEGV` = 0. Una corrida (la 8) no llegó a identificar la pantalla (`pantalla: ninguna`) pero la app
siguió viva sin hits: cuenta como arranque válido (el crash del hallazgo es del montaje, no de una pantalla).

**Lectura.** Con la tasa previa de ≈5,6 %, la probabilidad de 0 en 60 arranques por azar es ≈3 %
(`0,944^60`). **0/60 es evidencia a favor del parche, no una prueba**: la muestra no distingue una tasa residual < ≈4 %.
El control positivo muestra que el instrumento ve un SIGSEGV en el binario nuevo. **No se midió release** (no hay binario
release en el device; los terceros sólo lo vieron en debug). Veredicto H2: `CORREGIDO EN EL BINARIO DE DEBUG (0/60)`;
queda abierta la verificación en release cuando exista el binario.

## Efectos colaterales de la medición (declarados)

El device **escribe en la base** del usuario canónico. Quedó registrado en su tenant:

1. **2 mensajes de voz reales** al chat (ventana previa): gesto de 130 px (< umbral de 80 dp) → soltar sin fijar
   envía. Chip «Por voz · 0:52», con respuesta del agente. Modo «Pedir confirmación»: **sin tools ejecutadas**.
2. **2 mensajes de texto reales** («Mercado Pago», «HubSpot») para intentar alcanzar `consent`.
3. **Cierre de sesión y relogin** con el usuario canónico (para medir `reveal`/`splash`).
4. **Escalas de animación del sistema** modificadas durante la medición (`window/transition/animator_duration_scale`);
   restauradas a sus valores previos al terminar.

No se compiló, no se publicó nada a un usuario, no se tocó una integración real (ni conectar ni desconectar).

## Enmienda 2026-10-15 — CLASE B del contrato «las 10 filas de device»: `ingresos` y `reveal` frente a su DoD textual

Sin re-medir en teléfono y sin tocar ningún veredicto de arriba (las celdas CONT/COMP de las filas 11 y 12 quedan como se midieron
el 2026-10-13 sobre `2610bb6b`). Esto sólo deja escrito **contra qué DoD se leen** esas dos filas y dónde está la evidencia
(`2026-10-12-contratos-del-mapeo.md:50-51`).

- **`ingresos`** — DoD textual: *«la fila dice COINCIDE o nombra la divergencia»*. La fila 11 **nombra tres divergencias de
  contenido** (período junto al título; «BUSCAR» + buscador en lugar de «Últimos»; sin la nota de cobros por MercadoPago, causa
  no atribuida) y declara COMP **COHERENTE**. El DESVÍO de CONT es el contenido nombrado, no un incumplimiento del DoD: el DoD no
  pide coherencia, pide que la comparación esté hecha y escrita. Qué de las tres es deliberado queda como decisión de
  producto (H10, arriba), no como trabajo de medición.
- **`reveal`** — DoD textual: *«al menos UN consumidor real en `apps/mobile/src` fuera de su propio archivo y de sus tests, y se
  VE en la pantalla»*. Consumidor medido sobre `origin/main` `e8d193c1`: `apps/mobile/app/_layout.tsx:102` renderiza
  `<EntradaSesion />` y `apps/mobile/src/modules/auth/EntradaSesion.tsx:32` renderiza `<RevealEntrada>` (definido en
  `RevealEntrada.tsx:135`). Que se VE: la fila 12 lo observó en device (secuencia de `reveal-frio2`, cuadros f04–f25).
  Divergencias que la fila ya nombra: sin «Crear una nueva cuenta» (decisión documentada, `EntradaSesion.tsx:17-21`), wordmark
  40 dp `#B04A2E` vs 46 terracota, forma residual sobre el wordmark en reposo. El botón de pronunciar (`rv-say`) está `**D**`:
  espera el asset de audio del operador y **no es parte de este DoD**.

## Enmienda 2026-10-15 (2) — CLASE A del contrato «las 10 filas de device»: re-medición en teléfono sobre `ac86a5bd`

**Medido contra:** `medido_contra: ac86a5bd` (= `/healthz` de prod al tomar el device). Mismo device `RF8T318RN9T`, usuario canónico
`e2e-device@copiloto.test`, gestos `adb input motionevent DOWN/MOVE/UP`, `screencap` (no `dump`). Bundle servido por Metro local
desde un worktree detached en `ac86a5bd`.

⚠️ **Límite de procedencia (declarado, no resuelto):** el sha citado es el del **worktree**. En un worktree `node_modules` es un
*junction* al del checkout compartido, y el bundle resolvía `@copiloto/core` desde ahí: el core servido **pudo ser el del checkout
compartido y no el de `ac86a5bd`** si no se corrige. Para esta ronda se **forzó** el resolver de `@copiloto/core` al
`packages/core/src` del worktree (override temporal de `metro.config.js`, no commiteado) — **verificado sólo porque Metro devolvió
200 con ese path; no hay un detector que lo pruebe en el bundle**. Las mediciones del 2026-10-13 «sobre `2610bb6b`» **no** tuvieron ese
override: no se sabe contra qué core se midieron. Si una fila cambia de veredicto con core fresco, se sabrá al re-medirla.

| # | fila | CONT | COMP | qué se midió (captura) |
|---|---|---|---|---|
| 2 | `bi-refresh` | **COHERENTE** | **DESVÍO** | reposo: **sin** línea permanente «Tirá para actualizar» (`r3intel`). Arrastre 450→900 px: sólo el disco del sistema, **sin «Actualizando…»** durante el arrastre (`p1drag`, `p2drag-largo`); tras `UP` a 0,4 s aparece «Actualizando…» (`p3up400`) → el refresh dispara **después** del UP. Residual: indicador del **sistema** (`RefreshControl`) y no el propio 0→64 px; la fase «Soltá» sigue no alcanzable en Android `[código]`. «Al día · recién»: a 2 s de soltar **no** se ve (`p4up2s`); no se muestreó entre 0,4 y 1,6 s |
| 3 | `bloqueado` | **COHERENTE** | **COHERENTE** | durante el hold: **columna de candado + caret** sobre el botón, cronómetro `0:01`→`0:03`, «Deslizá para cancelar ‹» (`b3hold`, `b4move`). Fijada: tacho + onda + `0:04` + pausa + enviar, una línea (`b1`). Pausada: «**En pausa**» + `0:06` + ▶ + enviar (`c2pausa`); tacho descarta (`c3discard`). Todo lo que la fila declaraba ausente (cronómetro, candado/caret, «desliza para cancelar», «En pausa», tacho+onda) existe. Residual no medido: eje dominante en diagonal |
| 4 | `chat` | **COHERENTE** | **`NO_MEDIBLE`** | grip del chat: «Bajá para volver a Mi día» (`b1`); grip de Mi día: «Bajá para tus funciones», pie «Escribile a Odobi» (`t1midia`) — el «ESCRIBILE A ODOBI» en ambas posiciones **ya no está** (voseo en vez de «Baja»: deliberado). **Isotipo del vacío 120 vs 96 px: `NO_MEDIBLE`** — el estado vacío no es alcanzable: el chat del canónico ya tiene historial y vaciarlo es un efecto sobre su base |
| 15 | `tablero` | **DESVÍO** | **COHERENTE** | contadores en solapas «Para hoy **2**» ✔; nota «Las que detecta Odobi se cierran solas…» ✔ (`t3scroll2`); resumen «2 para hoy · 0 en curso» fuera de las solapas (el prototipo lo trae como `estado-pag` con «1 crítico»). DESVÍO de CONT: título **«Odobi» + fecha** (no «Tu día» + «Lo que Odobi detectó…»), sin card de alerta con acción (el aviso de Calendar/MP es texto sin píldora, `t1midia`) — el tablero está fusionado en Mi día (decisión del mapeo). **El «viewport ≈120 dp» ya no existe:** la página entera scrollea y las 2 filas se leen completas. «Reconectar» y destino fino (H5b): **`NO_MEDIBLE`** — no hay alerta con acción en el estado de esta cuenta |
| 6 | `detalle` | **COHERENTE** (parcial) | **DESVÍO** | tarjeta expandida con el chat colapsado (`d3exp-scroll`): **prosa con importe** «Emitida hace 42 días. Son $50.000 que ya facturaste y todavía no entraron», **chip** «Emitida hace 42 días», **píldora** «Reclamar el pago», **kv** «Cliente · Cliente Seed Mi Dia». El backend de prod **sí** entrega `presentacion` (sin ella no habría chip ni prosa). Persiste: **sin tile de color**. El kv «Monto» **no es un faltante**: se retiró a propósito (contrato H12, «sacar Monto sin la prosa borra el importe» — el importe vive en la prosa, que se ve). El chip de la **factura** es «Emitida hace…», **no** «31 días sin respuesta» (ese texto es del presupuesto, no se expandió). La parte antes `NO_MEDIBLE` (monto/fecha) **se midió: está en la prosa** |

**Efecto sobre la base del canónico (el device escribe):** gestos de voz que sueltan sin fijar **envían** (H7). Aparecieron en su chat,
tras mis gestos, mensajes que no controlo (STT sobre audio ambiente; origen exacto del texto **no verificado**): «Música» (voz 0:05),
«gaste 1234 en librería» → **gasto $1.234,00 anotado**, «cuánto vendí esta semana» → respuesta del agente. «Salió» del mes pasó a
$51.234,00. Es la cuenta de prueba canónica; no se tocó ninguna integración.

## Enmienda 2026-10-15 (3) — `soporte`: el código ya existía; la ausencia medida era del DATO, no de la app

La fila 13 de la enmienda 2 dice que «Ver tickets anteriores (N) ›» y el clip siguen ausentes y que falta código de
app. **Eso era falso en el código y verdadero en la pantalla de ese momento**: la UI entró en #1115 (`e3d1efa3`,
13-10, ancestro de `ac86a5bd`), pero `TarjetaTicketSoporte` devuelve `null` sin ticket vigente ni anteriores, y el
tenant canónico no tenía tickets cuando se midió. Hoy tiene 5 (SOP-0001…SOP-0005) y la pantalla muestra la tarjeta
del vigente (SOP-0005, Abierto) y «Ver tickets anteriores (4) ›» desplegable (captura `s3`, Metro local sobre
`5678979e`; prod sirve `ac86a5bd`, que ya contiene #1115). El clip es el control `chat-foto` del composer
(`PantallaSoporte.tsx:286`): con SOP-0005 vigente abre «Foto del ticket · ¿De dónde sacamos la foto? Cancelar / Cámara / Galería»
(captura `clip1`); se canceló sin elegir, no se subió nada. El control negativo (0 tickets) no se midió en device: el canónico ya
tiene 5 y no hay DELETE; lo cubren los tests de `PantallaSoporte.test.tsx`. Los tickets los abrió otra sesión por el camino real, no esta.
**Método:** una ausencia en pantalla con un componente que se oculta sin datos no prueba ausencia de código — se
lee el componente antes de escribir «falta código». Re-marcado en `2026-10-13-veredictos-triaje15-capa-cascara-fe2.md`.

## Enmienda 2026-10-15 (4) — H12 DoD 6 en device: prosa con importe VISTA; las kv de la regla NO caben en ESTA fila

medido_contra: prod `72b85cba` (`/healthz` 15-10) · app: Metro local sobre `5678979e` (el lado app de H12 es #1110, ya en `ac86a5bd`) · canónico.

- **Factura impaga expandida** (`facturas_impagas_viejas`): se ve la **prosa con el importe** — «Emitida hace 42 días. Son $50.000 que ya facturaste y todavía no entraron.» —, el chip «Emitida hace 42 días», la acción «Reclamar el pago» y la kv «Cliente · Cliente Seed Mi Dia». **No se ven** las dos kv de la regla («Factura», «Emitida»).
- **Por qué faltan, y no es defecto de la app:** `_kv` descarta los valores vacíos (`mi_dia_presentacion.py:159-160`) y el presentador arma «Factura» con `datos.nro` y «Emitida» con `datos.fecha_emision` (`:179-180`). La tarjeta SÍ muestra el chip y la prosa «Emitida hace 42 días», que en ese mismo presentador sólo salen por el camino de respaldo `datos.dias` + días transcurridos (`:172-174`) — o sea que `fecha_emision` está vacío en esta fila (si no, «Emitida» saldría en las kv) y `nro` también. Es una tarjeta **sembrada antes de que el detector escribiera esos campos** (`mi_dia_detector.py:180-182` ya los escribe para las nuevas). Deducido de lo visto en device + el código, no leído de la respuesta cruda de la API.
- **El mecanismo H12 sí funciona de punta a punta:** la tarjeta de presupuesto expandida muestra prosa («No contestó. Un presupuesto que se enfría rara vez se recupera solo.»), acción y kv «Cliente · Juan Pérez» + «Monto · $50.000» (la kv «Monto» llega del backend, ya formateada).
- **Veredicto DoD 6:** prosa con importe ✔ en device; «las dos kv de la regla» **no medible con esta fila** — hace falta una factura impaga nacida con el detector actual (con `nro` y `fecha_emision`), y no se fabrica una: una factura de más de 30 días no se puede crear hoy sin backdatear en el canónico. Cubierto por backend: un caso por regla en `test_mi_dia_presentacion`. Observación aparte: el titular de esa tarjeta dice «hace 31 días» y la prosa «hace 42» — el titular se congela al alta, la prosa se recalcula al leer.
