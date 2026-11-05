# Backlog detallado — Sprint PULIDO FINAL

> **Fecha:** 2026-11-04 · **Origen:** el operador usando la app en device y reportando lo que ve.
> **Para quién es:** las tres sesiones (frontend1 / frontend2 / backend). Cada ficha se toma
> leyendo **sólo su ficha**.
> **Declarado por el operador:** *«este es el último sprint de pulido ya que el resto al parecer
> funciona bien»*. O sea: el alcance es **lo que está acá**, y lo que aparezca nuevo se anota como
> hallazgo, no se mete al sprint sin que él lo diga.

**Por qué la letra `P`.** `A`–`F` son del sprint mobile y `G`–`N` del de correcciones; sus ids
siguen circulando en commits y docs. Reusar una letra haría que un id tuviera **dos** referentes,
que es el defecto medido el 2026-10-14: se prueba A y se concluye B. `P` de pulido, sin usar.

**El id es la única referencia que circula.** Citá `SM-P3` en el commit y en el PR. Una ficha cuyo
id no circula no se marca: medido, 18 de 26 del sprint de octubre jamás fueron nombradas.

## 🔴 Tres premisas del operador que el código REFUTA — leídas antes de implementar

No son errores suyos: son cosas que la app **esconde** o que **ya están decididas**, y por eso las
ve así. Implementar contra ellas construiría de más.

1. **«En Facturación no está el campo+mic»** → **SÍ está**, condicionado:
   `apps/mobile/src/modules/facturacion/PantallaFacturacion.tsx:706` lo monta sólo con
   `gate.tipo === 'listo' && vista === 'listado'`. → `SM-P6`.
2. **«Tocar el campo en Mi día se va al chat»** → **es el diseño**, con cita al prototipo:
   `apps/mobile/src/shell/PantallaPrincipal.tsx:59,183` («el campo del dock de Mi día no se edita»,
   «tocar el campo sube el chat, como el prototipo `index.html:2717`»). → `SM-P9`, decisión suya.
3. **«Que Facturación tenga mic como las otras»** → el dictado a Facturación está excluido **a
   propósito**: `apps/copiloto/dictado_destinos.py:43` — *«`factura` NO está, y no es casualidad:
   emitir es irreversible ante ARCA, así que la transcripción cruda no precarga nada»*. Las cuatro
   que sí precargan son las reversibles. → `SM-P10`, decisión suya.

## 🟢 Y una que ahorra trabajo: el dock YA es un solo componente

`DockEntrada` (`apps/mobile/src/modules/chat/DockEntrada.tsx`) lo montan los tres: el chat
(`ChatView.tsx:264`), Mi día (`PantallaPrincipal.tsx:261`) y las funciones vía `DockFuncion`
(`voz/DockFuncion.tsx`), que a su vez envuelve `DockAlChat` para Facturación e Inteligencia.
**La diferencia visual que el operador ve no puede estar en el componente compartido: está en el
CONTENEDOR de cada pantalla.** Pista ya escrita: `PantallaMiDia.tsx:348-351` documenta que una
franja vacía debajo del scroll es *«exactamente lo que el operador lee como fondo alrededor del
campo»*.

<!-- TABLA-ESTADO:INICIO (generada por scripts/sprint-estado.py --tabla - NO editar a mano) -->

| Ficha | Issue | Estado | Que falta del DoD / evidencia de cierre |
|---|---|---|---|
| **SM-P1** | `sin-issue` | 🟧 DOD-PARCIAL | Falta: pasada de device (SM-P12) con e2e-device@copiloto.test; el release fb0fb9d3 no trae estos fixes. |
| **SM-P2** | `sin-issue` | 🟧 DOD-PARCIAL | Falta: pasada de device (SM-P12) con e2e-device@copiloto.test; el release fb0fb9d3 no trae estos fixes. |
| **SM-P3** | `sin-issue` | 🟧 DOD-PARCIAL | Falta: pasada de device (SM-P12) con e2e-device@copiloto.test; el release fb0fb9d3 no trae estos fixes. |
| **SM-P4** | `sin-issue` | 🟧 DOD-PARCIAL | Falta: pasada de device (SM-P12) con e2e-device@copiloto.test; el release fb0fb9d3 no trae estos fixes. |
| **SM-P5** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-P6** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-P7** | `sin-issue` | 🟧 DOD-PARCIAL | DoD 2 y 3: el aspecto visual (blur sobre el hilo, translucidez y contraste del texto) NO se verifico en navegador por… |
| **SM-P8** | `sin-issue` | ✅ TERMINADO | 82f8451e (#1651). Tabla medida: (a) puente Como usar NO APLICA: la web navega por tabs sin stack, PantallaComoUsarLaA… |
| **SM-P9** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | NADA de decision: lo que queda es IMPLEMENTACION y vive en otras fichas, no aca. SM-P5 (dock unico mobile, Mi dia edi… |
| **SM-P10** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | NADA de decision; la IMPLEMENTACION es de SM-P6, cuya pregunta cambio: ya no es -medir cual condicion oculta el dock-… |
| **SM-P11** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-P12** | `sin-issue` | ⬜ PENDIENTE | — |

<!-- TABLA-ESTADO:FIN -->

# Bloque P · Pulido final

### SM-P1 · `sin-issue` — «Cómo usar la app»: tocar una card no llega a destino, vuelve a Ajustes

- **Estado:** DOD-PARCIAL
- **Falta:** Falta: pasada de device (SM-P12) con e2e-device@copiloto.test; el release fb0fb9d3 no trae estos fixes.
- **Cierre:** 6a1ae914 (#1650): PantallaComoUsarLaApp deja la pregunta y hace dismissAll al chat, test PantallaComoUsarLaApp.test.tsx. Premisa confirmada por el operador 2026-11-04, textual: 'como el prototipo' (index.html:3614), las 5 cards llevan AL CHAT con la pregunta dicha, no a la funcion.
- **Dueño:** frontend1
- **Reportado por el operador (2026-11-04):** «cuando hago click en cualquier opción como cargar un
  gasto simplemente vuelve hacia atrás».
- **Medido:** `PantallaComoUsarLaApp.tsx:75-78` hace `dejarPendiente()` + `router.back()`. Pero la
  pantalla está apilada sobre **Ajustes** (`app/ajustes.tsx:35`), que a su vez está sobre el chat
  (`app/_layout.tsx:182`, ambos `transparentModal`), y `ChatView.tsx:152` toma el pendiente en un
  `useFocusEffect` **del chat**. `back()` devuelve el foco a Ajustes: la pregunta queda colgada
  hasta que el usuario cierra Ajustes también. Se ve como «no hizo nada».
- **Ampliación del operador:** el destino no es siempre el chat. «Emití tu primera factura»
  probablemente tiene que abrir el flujo de Facturación. **Verificar el destino card por card**
  contra el prototipo (`odobi-ui/prototipo/index.html` + `mapa-pantallas`, `s-comousar`).
- **Decidido y cerrado:** **NO** se mete un chat propio con RAG en esa pantalla (operador,
  2026-11-04). La Decisión C sigue en pie.
- **Mismo mecanismo, otros dos call-sites:** `midia/PantallaAgenda.tsx:89` y
  `onboarding/PantallaOnboarding.tsx:334`. Contar cuántos glass hay sobre el chat en **cada uno**
  antes de tocarlos; si es uno solo, `back()` está bien y no se toca.
- **DoD:**
  1. Cada card llega **a su destino** en un toque, con el destino verificado contra el prototipo y
     escrito en el cierre (tabla card → destino).
  2. Test que monte **dos glass apilados**. El actual es verde porque monta la pantalla sola: no
     ejercita la condición del defecto.
  3. Los otros dos call-sites **medidos** (no parcheados a ciegas) y dicho qué se hizo con cada uno.
  4. El docstring de `PantallaComoUsarLaApp.tsx:31` corregido: hoy afirma un comportamiento que la
     pantalla no tiene.
  5. Verificado en device.

### SM-P2 · `sin-issue` — El isotipo de mobile sale 4× más fino que el del mapa

- **Estado:** DOD-PARCIAL
- **Falta:** Falta: pasada de device (SM-P12) con e2e-device@copiloto.test; el release fb0fb9d3 no trae estos fixes.
- **Cierre:** 6a1ae914 (#1650): Marca.tsx corrige el trazo del isotipo (strokeWidth en unidades del viewBox, sin predividir por la escala); Marca.test.tsx.
- **Dueño:** frontend1
- **Reportado por el operador (2026-11-04):** «el isologo es diferente, tiene líneas más finas»,
  comparando el mapa de pantallas con el device.
- **Medido:** los dos lados dibujan el **mismo** path. El prototipo
  (`Prototipo frontend/odobi-ui/prototipo/index.html:1876`) declara `stroke-width 1.3` en unidades
  del `viewBox` de 24 y a 96 px rinde **5,2 px**. `apps/mobile/src/theme/Marca.tsx:68` predivide
  (`ISOTIPO_STROKE_BASE / escala`) dentro de un `<G scale={escala}>`: se cancelan y el trazo queda
  clavado en **1,3 px absolutos** a cualquier tamaño.
- **La mitad web YA ESTÁ HECHA:** frontend2, PR #1648 (`0bb87266`), CI 6/6.
- **Dos trampas escritas en el propio código:** el comentario de `Marca.tsx:30-40` **declara
  correcta** la predivisión citando un cierre de plano del 18-09 — es lo que apagó la búsqueda
  hasta hoy; y `Marca.test.tsx:78` es **verde por el bug** (afirma `1.3/4`).
- **Control gratis:** `modules/splash/EntradaDiaria.tsx:70,105` ya usa `strokeWidth={1.3}` sin
  predividir. La regla correcta está al lado. **No tocar `EntradaDiaria`.**
- **DoD:**
  1. `Marca.tsx` rinde el trazo **proporcional**: a 96 px, 5,2 px.
  2. `Marca.test.tsx` afirma la **proporcionalidad** (dos tamaños distintos, grosor relativo igual),
     no el valor absoluto.
  3. El comentario `:30-40` corregido diciendo por qué la predivisión estaba mal.
  4. Verificado en device contra la captura del mapa — el 4× se ve a simple vista.

### SM-P3 · `sin-issue` — El dictado del chat ENVÍA solo: no hay forma de arrepentirse

- **Estado:** DOD-PARCIAL
- **Falta:** Falta: pasada de device (SM-P12) con e2e-device@copiloto.test; el release fb0fb9d3 no trae estos fixes.
- **Cierre:** 6a1ae914 (#1650): ChatView.alAudio transcribe sin contexto y pega en el composer sin enviar (semilla), borrarArchivoLocal en finally; tests en ChatView.test.tsx y PantallaPrincipal.dockMiDia.test.tsx.
- **Dueño:** frontend1 (backend sólo si `SM-P11` resulta necesaria)
- **Orden del operador (2026-11-04):** «al apretar dictarlo debe aparecer el texto pegado en el
  campo de entrada de texto para enviarlo, no que se envíe directamente, porque no hay forma ahora
  de anular el audio si el usuario no lo quiere enviar».
- **Medido:** el dock del chat usa `sendAudio` → `POST /chat/audio`
  (`packages/core/src/api/audio.ts:24`), que transcribe **y** despacha en un paso.
- **🟢 El mecanismo ya existe y está en producción:** `POST /transcribir`
  (`packages/core/src/api/transcribir.ts:41`, `apps/copiloto/web.py:962`) transcribe **sin**
  despachar; `web.py:929` muestra que el tramo de voz es **común** a los dos. Lo usan las pantallas
  de función desde K-10, vía `DockFuncion` (`voz/DockFuncion.tsx`), que ya devuelve el texto por
  `onTexto`. **Esto es cambiar de endpoint en el cliente, no construir un flujo.**
- **Reusar también** `avisoErrorTranscripcion` para los errores. No escribir copias nuevas.
- **No tocar:** el dock de Mi día (`audioEntrante` → `ChatView.tsx:146`) ni el dictado de las
  funciones. La transcripción sigue siendo del backend (Groq), no del device.
- **DoD:**
  1. Dictar deja el texto **en el campo**, editable, sin mandar nada.
  2. **Dos salidas de descarte**, las dos con test: cancelar la grabación antes de transcribir, y
     borrar el texto después. Ningún mensaje llega al hilo en ninguna de las dos.
  3. Verificado en device con la voz del operador.
  4. Si backend tuvo que tocar algo, dicho en el cierre cuál fue y por qué (ver `SM-P11`).

### SM-P4 · `sin-issue` — Sacar la cámara del composer de Soporte

- **Estado:** DOD-PARCIAL
- **Falta:** Falta: pasada de device (SM-P12) con e2e-device@copiloto.test; el release fb0fb9d3 no trae estos fixes.
- **Cierre:** 6a1ae914 (#1650): se retira la camara del composer de Soporte (PantallaSoporte.tsx, textosSoporte.ts, TarjetaTicketSoporte, useTicketsSoporte); PantallaSoporte.test.tsx; fila soporte del mapeo corregida.
- **Dueño:** frontend1
- **Orden del operador (2026-11-04):** «en soporte técnico hay que sacar la cámara de fotos que
  tiene a la izquierda del campo de ingreso de texto».
- **Medido:** `soporte/PantallaSoporte.tsx:168` pasa `onFoto`; `chat/Composer.tsx:205` pinta el
  botón **sólo si ese prop llega**. El chat general ya no lo pasa desde SM-N24. **Se saca quitando
  el prop**, no tocando `Composer`.
- **⚠️ Lo que se va con el botón:** es la **única** vía de adjuntar una foto a un ticket
  (`POST /soporte/tickets/{id}/adjuntos`). Decisión del operador, se ejecuta; queda registrado acá
  para que no se redescubra como bug.
- **DoD:**
  1. El composer de Soporte **no** muestra la cámara; el de Gastos **sí**.
  2. Test de las **dos** mitades: ausencia en Soporte y presencia en Gastos. Una sola no acredita.
  3. Huérfanos barridos (`alAdjuntarFoto`, `adjuntarFoto`/`adjuntando`, `SOPORTE_ADJUNTO_SIN_TICKET*`)
     o justificado quién más los usa. **`useCapturaFoto` lo comparte `gastos/FotoFuncion`: no se toca.**
  4. Verificado en device.

### SM-P5 · `sin-issue` — Un solo dock en toda la app: sin fondo alrededor, con blur (mobile)

- **Estado:** PENDIENTE
- **Dueño:** frontend1
- **Orden del operador (2026-11-04):** «todos los campos de ingreso de texto y los botones de mic
  deben ser iguales en toda la app... sin color de fondo alrededor, con el blur para el texto que
  queda detrás, para dar la sensación de flotante. Ahora sólo los dos principales son coherentes».
- **Medido:** el campo y el mic **ya son el mismo componente** en todas (ver la nota 🟢 del
  encabezado). La diferencia está en el **contenedor** de cada pantalla, no en `DockEntrada`.
- **DoD:**
  1. **Inventario primero**, read-only: por cada pantalla que monta un dock —chat, Mi día, Gastos,
     Ingresos, Presupuestos, Clientes, Facturación, Inteligencia, Soporte— `path:línea` del
     contenedor y qué le pone de fondo/scrim/padding. **La tabla va en el cierre**: es la evidencia
     de que se midió y no se parcheó pantalla por pantalla.
  2. Las 9 rinden el dock idéntico al del chat: sin fondo de color, con blur, flotante.
  3. **Un solo lugar** define ese envoltorio. Si quedan dos, no está hecho.
  4. Sin hex: por `tema.glass`/`tema.color`. Las **5 pieles** verificadas.
  5. Verificado en device comparando contra el chat **en la misma corrida**.

### SM-P6 · `sin-issue` — El dock de Facturación existe pero no se ve: medir cuál condición lo oculta

- **Estado:** PENDIENTE
- **Dueño:** frontend1
- **Medido:** `facturacion/PantallaFacturacion.tsx:706` monta `DockAlChat` **sólo** con
  `gate.tipo === 'listo'` **y** `vista === 'listado'`. El operador reportó que «no está».
- **🔴 No agregar un dock.** Agregar uno que ya existe dejaría dos. Primero se mide cuál de las dos
  condiciones no se cumplió en su device.
- **DoD:**
  1. Dicho **cuál** de las dos condiciones lo ocultaba, medido en su device o en su estado de datos.
  2. Si la condición es correcta, se explica al operador por qué y la ficha cierra sin código.
     Si es un bug (p. ej. el gate se queda en un estado que no corresponde), se arregla con test.
  3. Verificado en device.

### SM-P7 · `sin-issue` — El mismo dock unificado, en la web

- **Estado:** DOD-PARCIAL
- **Falta:** DoD 2 y 3: el aspecto visual (blur sobre el hilo, translucidez y contraste del texto) NO se verifico en navegador por piel; solo tipos, tests y el gate de hex. Ademas MicFuncion (GastosScreen.tsx:243, IngresosScreen.tsx:177, ClientesScreen.tsx:292, PresupuestosScreen.tsx:290) queda FUERA del dock: es un mic suelto junto a un formulario, no un dock; decision de unificarlo o no es de planificacion. Hallazgo y unificacion estructural hechos en 82f8451e (#1651): el dock web NO estaba unificado (Composer.tsx:79-121 y ComposerSoporte.tsx:57-98 duplicaban JSX; chat.css:649-659 fondo lleno sin backdrop-filter, unico en repo presupuestos.css:415 lo apaga; desktop.css:363-421 pisaba aparte); ahora DockEntrada.tsx unico, envoltorio y blur por tokens en chat.css.
- **Dueño:** frontend2
- **Qué:** mismo criterio que `SM-P5` en `apps/copiloto-web`.
- **🔴 Antes de implementar:** verificar si en web el dock **está** unificado en un componente como
  en mobile. **Si no lo está, ESO es el hallazgo** y se reporta antes de tocar estilos — unificar
  copiando estilos pantalla por pantalla es la deuda que este sprint viene a pagar, no a crear.
- **DoD:**
  1. Inventario con `path:línea` por pantalla, en el cierre.
  2. Un solo lugar define el envoltorio; sin hex; pieles verificadas.
  3. Paridad visual con el dock del chat de la web, no con el de mobile (son dos cáscaras).

### SM-P8 · `sin-issue` — Paridad web de P1/P3/P4: medir ANTES de portar

- **Estado:** TERMINADO
- **Cierre:** 82f8451e (#1651). Tabla medida: (a) puente Como usar NO APLICA: la web navega por tabs sin stack, PantallaComoUsarLaApp.tsx:66-69 + AppShell.tsx:224 (changeTab) + ChatScreen.tsx:68-71 (tomarPendiente al montar); (b) dictado que envia solo APLICA: Composer.tsx:98-102 -> useChat.sendAudio (POST /chat/audio), copiado en ComposerSoporte.tsx:85; arreglado: DockEntrada.tsx va por /transcribir y pega en el campo, tests DockEntrada.test.tsx (feliz, agregar al final, descarte por cancelar sin tocar backend, descarte por borrar, error/vacio) vitest chat+soporte 282/282; (c) camara de Soporte NO APLICA: ComposerSoporte.tsx solo tiene textarea+mic+enviar, grep adjunt|foto|file en modules/soporte = 0. packages/core no se toco (transcribir ya existia).
- **Dueño:** frontend2
- **Qué:** para cada uno de `SM-P1` (puente de «Cómo usar la app»), `SM-P3` (dictado que no envía
  solo) y `SM-P4` (cámara de Soporte), **medir si la web tiene el mismo defecto**. La web ya
  comparte el puente `mensajePendiente` (BL-W9) y `useChatSoporte`, así que algunos aplican y otros
  no.
- **🔴 El modo de falla a evitar es el espejo:** portar el fix de mobile a una web que no tiene el
  defecto, o declararla sana sin medirla. **Una tabla con las tres filas y su veredicto medido.**
- **DoD:**
  1. Tabla `defecto → aplica en web sí/no → `path:línea` que lo prueba`.
  2. Los que apliquen, arreglados con test. Los que no, con la cita que lo demuestra.
  3. Coordinado con frontend1 para que el fix compartido (si vive en `packages/core`) se haga **una
     vez**, no dos.

### SM-P9 · `sin-issue` — DECISIÓN DEL OPERADOR: ¿el campo de Mi día se edita o sube el chat?

- **Estado:** CERRADO-POR-DECISION
- **Falta:** NADA de decision: lo que queda es IMPLEMENTACION y vive en otras fichas, no aca. SM-P5 (dock unico mobile, Mi dia editable) y SM-P6 (Facturacion sin condiciones, accion primero y vuelta al chat despues) tienen el comportamiento; mientras no esten en TERMINADO con device, lo que el operador pidio no esta acreditado en la app. Esta ficha solo acredita que la decision esta tomada.
- **Decision:** RESUELTA por el operador el 2026-11-04 en el hilo de planificacion, textual: -el campo de ingreso de texto en mi dia debe poder ingresar texto....igual que todos los campos de todas la funciones...la intencion es que el campo de ingreso de texto y el boton del mic esten en todas las funciones...en mi dia y en el chat...asi que solo hay que replicar el mismo campo-. O sea: el campo de Mi dia SE EDITA. Registrada en este doc versionado docs/copiloto-emprendedor/2026-11-04-BACKLOG-sprint-pulido-final.md. Se retira onTocarCampo como -subir el chat- (PantallaPrincipal.tsx:183; el comentario de :59 queda obsoleto). La cita al prototipo index.html:2717 que justificaba el comportamiento anterior NO se retira como observacion -- era real -- pero la decision del operador es posterior y manda. ADEMAS fija el ORDEN, que no estaba en ninguna ficha: -cuando se ingresa texto o se envia un audio se vuelve al chat luego de la accion...pero no antes....siempre despues....al volver al chat la accion se ejecuta y aparece la card correspondiente-. Al momento de la decision DockAlChat hacia dejarAvisoParaElChat + router.back() y el chat ejecutaba al recuperar foco, o sea navegaba ANTES de actuar: el inverso de lo pedido. Implementado por frontend1 en 0212ba19 (#1653); la acreditacion en device es de SM-P12.
- **Dueño:** **operador** (nadie implementa hasta que decida)
- **Reportado por el operador (2026-11-04):** «cuando hago click en el campo de ingreso de texto en
  Mi día se va derecho a la pantalla del chat, en vez de habilitar el ingreso de texto... el botón
  de mic funciona bien».
- **Medido:** es el **comportamiento diseñado**, no un bug: `shell/PantallaPrincipal.tsx:59` («el
  campo del dock de Mi día **no se edita** (`onTocarCampo`): no tiene texto que mandar») y `:183`
  («tocar el campo sube el chat, **como el prototipo** `index.html:2717`»).
- **Lo que hay que decidir:** si se cambia, el dock de Mi día pasa a tener texto propio que mandar,
  y hay que definir a dónde va ese texto y qué pasa con la coherencia contra el prototipo. No es un
  cambio de una línea.
- **DoD:** la decisión escrita acá con su fecha. Si es «se cambia», nace una ficha nueva con su
  propio DoD; si es «queda como está», la ficha cierra por decisión.

### SM-P10 · `sin-issue` — DECISIÓN DEL OPERADOR: ¿qué hace el mic en Facturación?

- **Estado:** CERRADO-POR-DECISION
- **Falta:** NADA de decision; la IMPLEMENTACION es de SM-P6, cuya pregunta cambio: ya no es -medir cual condicion oculta el dock- sino -quitar las dos condiciones de PantallaFacturacion.tsx:706 y verificarlo-. Mientras P6 no este TERMINADO con device, Facturacion no esta acreditada con campo y mic para el usuario.
- **Decision:** RESUELTA por el operador el 2026-11-04, textual: -el mic en facturacion hace lo mismo que en todas las funciones...enviar audio...al ser un copiloto de voz el campo de ingreso de texto y el mic deben estar en todas las funciones, en mi dia y en el chat principal...todos iguales con el mismo diseno...para que el usuario tenga facilidad de uso-. Registrada en este doc versionado docs/copiloto-emprendedor/2026-11-04-BACKLOG-sprint-pulido-final.md. La pregunta queda contestada: el mic hace lo mismo que en cualquier funcion, sin excepcion fiscal, y el campo de texto tambien va. CONSECUENCIA MEDIDA: el dock de Facturacion existia pero condicionado (PantallaFacturacion.tsx:706 lo montaba solo con gate.tipo==listo Y vista==listado) y por decision va SIEMPRE. OJO con el lado backend, que NO cambia: dictado_destinos.py:43 excluye el contexto -factura- a proposito (-emitir es irreversible ante ARCA, asi que la transcripcion cruda no precarga nada-) y web.py:970 IGNORA un contexto desconocido en vez de rechazarlo. Mandar audio desde Facturacion NO precarga una factura: va al chat como cualquier audio, compatible con la decision y con la orden de no emitir facturas. Si alguna vez se quiere que precargue, es otra ficha y otra decision. Implementado por frontend1 en 0212ba19 (#1653).
- **Dueño:** **operador**
- **Contexto medido:** Facturación **ya tiene** dock (ver `SM-P6`) y lo que dicta **se siembra en
  el composer del chat** (`voz/DockAlChat.tsx`), nunca emite. Eso es deliberado:
  `apps/copiloto/dictado_destinos.py:43` excluye `factura` de los destinos que precargan card
  porque **emitir es irreversible ante ARCA**.
- **Lo que hay que decidir:** si el dictado en Facturación debe seguir yendo al chat (hoy), o
  precargar una card de factura para revisar antes de emitir. **Lo que no se hace en ningún caso es
  emitir directo.**
- **DoD:** la decisión escrita acá con su fecha.

### SM-P11 · `sin-issue` — CONDICIONAL: `contexto` de `/transcribir` para el chat

- **Estado:** PENDIENTE
- **Dueño:** backend — **sólo si frontend1 lo pide con la medición de `SM-P3`**
- **Medido:** `CONTEXTOS_TRANSCRIBIR` (`apps/copiloto/dictado_destinos.py:53`) tiene
  `gasto · ingreso · presupuesto · cliente`; **no tiene `chat`**. Pero `apps/copiloto/web.py:970`
  **ignora** un contexto desconocido en vez de rechazarlo.
- **Por eso es condicional:** si frontend1 mide que mandar sin contexto (o con uno nuevo) pasa
  limpio, **backend no toca nada y esta ficha cierra sin código**. No se agrega un valor a la
  whitelist por las dudas.
- **DoD:** o la medición de frontend1 que acredita que no hace falta, o el cambio con su test.

### SM-P12 · `sin-issue` — El sprint cierra con una pasada de device completa

- **Estado:** PENDIENTE
- **Dueño:** frontend1 (dueño del device) con la cola de las demás
- **Qué:** una sola pasada final en device que ejercite **todas** las fichas de este sprint que
  terminaron, en una corrida, con el usuario canónico `e2e-device@copiloto.test`.
- **Por qué una pasada y no una por ficha:** el device tiene **dueño único** y cada sesión de device
  cuesta; además varias de estas fichas tocan la misma pantalla y verificarlas por separado haría
  que el fix de una tape la regresión de otra.
- **DoD:**
  1. Una corrida, con la lista de fichas ejercitadas y el veredicto de cada una.
  2. Las que fallen vuelven a `DOD-PARCIAL` con su `Falta:`, no se declaran listas.
  3. El apk/binario citado por su id, y el commit de `main` sobre el que se construyó.
