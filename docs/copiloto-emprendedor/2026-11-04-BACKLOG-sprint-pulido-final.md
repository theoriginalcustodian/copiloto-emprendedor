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
| **SM-P1** | `sin-issue` | 🟧 DOD-PARCIAL | Medido en device el 2026-11-05 (APK ef143e95): los 5 temas de «Como usar» SI llegan al chat como mensaje del usuario … |
| **SM-P2** | `sin-issue` | 🟧 DOD-PARCIAL | NO ejercitada en la pasada del 2026-11-05 (frontend1 lo declara explicitamente: sin evidencia propia del isotipo). El… |
| **SM-P3** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | NADA. La Falta que esta ficha arrastraba («pasada de device, el release fb0fb9d3 no trae estos fixes») era de cuando … |
| **SM-P4** | `sin-issue` | 🟧 DOD-PARCIAL | NO ejercitada en la pasada del 2026-11-05: la camara de Soporte no se abrio (frontend1 lo declara). El APK ef143e95 (… |
| **SM-P5** | `sin-issue` | 🟧 DOD-PARCIAL | DEFECTO REAL ENCONTRADO EN DEVICE el 2026-11-05: con el teclado abierto el campo de Mi dia quedaba OCULTO. Causa medi… |
| **SM-P6** | `sin-issue` | 🟧 DOD-PARCIAL | Medido en device el 2026-11-05: el dock de Facturacion SI se ve con gate «ARCA no configurada» y vista «listado» - es… |
| **SM-P7** | `sin-issue` | ✅ TERMINADO | f9c5d98b DoD1: inventario path:linea en la Falta previa (5 funciones, f9c5d98b #1654). DoD2: un solo componente DockE… |
| **SM-P8** | `sin-issue` | ✅ TERMINADO | 82f8451e (#1651). Tabla medida: (a) puente Como usar NO APLICA: la web navega por tabs sin stack, PantallaComoUsarLaA… |
| **SM-P9** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | NADA de decision: lo que queda es IMPLEMENTACION y vive en otras fichas. SM-P5 (dock unico mobile, Mi dia editable) y… |
| **SM-P10** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | La IMPLEMENTACION del dock es de SM-P6 (quitar las dos condiciones de PantallaFacturacion.tsx:706: hecho en 0212ba19 … |
| **SM-P11** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | NADA: la pregunta de esta ficha se disolvio, no se resolvio. Era condicional a que frontend1 necesitara un contexto n… |
| **SM-P12** | `sin-issue` | 🟧 DOD-PARCIAL | RETIRADA LA CAUSA, NO LA OBSERVACION (2026-11-05, adenda de frontend1). La pasada de las 08:06 corrio con el telefono… |
| **SM-P13** | `sin-issue` | 🟧 DOD-PARCIAL | La mitad WEB esta CERRADA: verificada en navegador real por frontend2 (Playwright, build ae21d662 desplegado en copil… |
| **SM-P14** | `sin-issue` | ⬜ PENDIENTE | — |

<!-- TABLA-ESTADO:FIN -->

# Bloque P · Pulido final

### SM-P1 · `sin-issue` — «Cómo usar la app»: tocar una card no llega a destino, vuelve a Ajustes

- **Estado:** DOD-PARCIAL
- **Falta:** Medido en device el 2026-11-05 (APK ef143e95): los 5 temas de «Como usar» SI llegan al chat como mensaje del usuario con su pregunta y reciben respuesta. PERO la pila queda en el escritorio de funciones: el chat queda DETRAS y el usuario tiene que subirlo a mano. La queja original de esta ficha era «tocar una card no llega a destino»; si hay que subir el chat a mano, el destino no se alcanza. DECISION de planificacion 2026-11-05: NO es el comportamiento deseado - el dismissAll de PantallaComoUsarLaApp tiene que dejar el chat ARRIBA. Falta ese fix (dueno frontend1) y volver a verlo en device.
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
- **Falta:** NO ejercitada en la pasada del 2026-11-05 (frontend1 lo declara explicitamente: sin evidencia propia del isotipo). El APK ef143e95 (sha 7d278a2c) SI contiene el fix 6a1ae914, asi que no hace falta build nuevo por esta ficha: falta mirarla en el telefono, en la proxima pasada.
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

- **Estado:** CERRADO-POR-DECISION
- **Falta:** NADA. La Falta que esta ficha arrastraba («pasada de device, el release fb0fb9d3 no trae estos fixes») era de cuando estaba DOD-PARCIAL y quedo huerfana al cerrarse por decision el 2026-11-04: una ficha cerrada por decision no tiene pendiente de device, y dejarla escrita hacia leer el APK vigente como inservible. El codigo de 6a1ae914 (#1650) se verifica como parte de SM-P12 junto con el resto, no como DoD propio de esta ficha.
- **Decision:** operador, 2026-11-04, respuesta directa a frontend1 (relayada por planificacion), registrada en docs/copiloto-emprendedor/2026-11-04-BACKLOG-sprint-pulido-final.md: el mic funciona como WhatsApp en toda la app, soltar o Enviar-tras-fijar manda el audio. El codigo de pegar el texto entro en 6a1ae914 (#1650) y se revirtio en #1658.
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
- **Falta:** NO ejercitada en la pasada del 2026-11-05: la camara de Soporte no se abrio (frontend1 lo declara). El APK ef143e95 (sha 7d278a2c) SI contiene el fix 6a1ae914; falta mirarla en el telefono en la proxima pasada.
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

- **Estado:** DOD-PARCIAL
- **Falta:** DEFECTO REAL ENCONTRADO EN DEVICE el 2026-11-05: con el teclado abierto el campo de Mi dia quedaba OCULTO. Causa medida por frontend1: «recorrido» baja con el teclado y panelY se quedaba en el valor viejo. Fix d9cbb1a6 (#1685, panelYAlCambiarRecorrido en PanelDeslizable.tsx + PantallaPrincipal.tsx), YA EN MAIN, jest 72/72 - NO verificado en device todavia porque el APK instalado (ef143e95, sha 7d278a2c) es anterior al fix. Falta: build nuevo de main y volver a device. Nota: el DoD hablaba de «las 5 pieles» y eso era un numero mio sin instrumento - son DOS, ODOBI claro y oscuro (skinsCatalogo.ts:6,17,22).
- **Cierre:** 0212ba19 (#1653): despachoAlChat.ts + DockAlChat despachan primero y vuelven despues, dock en las 9 funciones, Mi dia editable. Envoltorio visual unico DockSobreContenido (mismo ScrimDock del chat) en DockFuncion y Soporte, test DockSobreContenido.test.tsx. Inventario path:linea en el cierre_ del buzon.
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

- **Estado:** DOD-PARCIAL
- **Falta:** Medido en device el 2026-11-05: el dock de Facturacion SI se ve con gate «ARCA no configurada» y vista «listado» - esa combinacion no lo oculta (captura fac1.png), lo que responde el DoD 9 por la mitad. La otra mitad (gate «listo» + «listado») queda SIN PROBAR porque e2e-device no tiene perfil fiscal ni credencial: depende del tenant sintetico que le toca a backend. Y el DoD pedia comparar «las 5 pieles»: son DOS (ODOBI claro y oscuro) mas «Como el telefono» que es una regla, no una piel (skinsCatalogo.ts:6,17,22; PantallaSkins.tsx:11,138) - el 5 lo puse yo sin instrumento.
- **Cierre:** 0212ba19 (#1653): PantallaFacturacion.tsx:706 monta DockAlChat sin condiciones, mic manda audio al chat (P10 por decision del operador 2026-11-04). Tests PantallaFacturacion.test.tsx: despacha antes de router.back, dock aun sin CUIT, sin chat listo no navega.
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

- **Estado:** TERMINADO
- **Cierre:** f9c5d98b DoD1: inventario path:linea en la Falta previa (5 funciones, f9c5d98b #1654). DoD2: un solo componente DockEntrada, sin hex (gate); pieles medidas en navegador real (Playwright, vite VITE_API_MOCK=1, 390x844, pantalla Gastos 2026-11-04): oscuro blur 16px, fondo alpha 0.74, contraste texto 14.19 y placeholder 5.06; claro blur 16px, fondo alpha 0.74, contraste texto 11.52 y placeholder 4.73 (WCAG, min 4.5). Sticky: con 3000px de relleno y scrollTop 1500/3323 el dock sigue en y 652-734 (position sticky). Alcance: medido en Gastos; las otras 4 funciones montan el mismo DockEntrada, no se midieron una por una. DoD3: mismo componente y tokens del composer del chat web
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
- **Falta:** NADA de decision: lo que queda es IMPLEMENTACION y vive en otras fichas. SM-P5 (dock unico mobile, Mi dia editable) y SM-P6 (Facturacion sin condiciones, accion primero y vuelta al chat despues) tienen el comportamiento y estan en DOD-PARCIAL; mientras no pasen por device (SM-P12), lo que el operador pidio no esta acreditado en la app. Esta ficha solo acredita que la decision esta tomada.
- **Decision:** RESUELTA por el operador el 2026-11-04 en el hilo de planificacion, textual: -el campo de ingreso de texto en mi dia debe poder ingresar texto....igual que todos los campos de todas la funciones...la intencion es que el campo de ingreso de texto y el boton del mic esten en todas las funciones...en mi dia y en el chat...asi que solo hay que replicar el mismo campo-. O sea: el campo de Mi dia SE EDITA. Registrada en docs/copiloto-emprendedor/2026-11-04-BACKLOG-sprint-pulido-final.md. Se retira onTocarCampo como -subir el chat- (PantallaPrincipal.tsx:183; el comentario de :59 queda obsoleto). La cita al prototipo index.html:2717 que justificaba el comportamiento anterior NO se retira como observacion -- era real -- pero la decision del operador es posterior y manda. ADEMAS fija el ORDEN, que no estaba en ninguna ficha: -cuando se ingresa texto o se envia un audio se vuelve al chat luego de la accion...pero no antes....siempre despues....al volver al chat la accion se ejecuta y aparece la card correspondiente-. Al momento de la decision DockAlChat hacia dejarAvisoParaElChat + router.back() y el chat ejecutaba al recuperar foco, o sea navegaba ANTES de actuar: el inverso de lo pedido. Implementado por frontend1 en 0212ba19 (#1653) y en web por frontend2 en f9c5d98b (#1654); la acreditacion en device es de SM-P12.
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
- **Falta:** La IMPLEMENTACION del dock es de SM-P6 (quitar las dos condiciones de PantallaFacturacion.tsx:706: hecho en 0212ba19 mobile y acc1d2ec web) y el PRELLENADO es de SM-P13, que esta en DOD-PARCIAL. Mas device (SM-P12). Mientras SM-P13 no cierre, el mic de Facturacion manda al chat en vez de abrir la card prellenada, que NO es lo que el operador decidio al final del dia.
- **Decision:** RESUELTA por el operador el 2026-11-04 y CORREGIDA POR EL el mismo dia; las dos versiones quedan escritas porque la segunda invalida una conclusion que yo ya habia registrado. (A) Primera respuesta, hilo de planificacion, textual: -el mic en facturacion hace lo mismo que en todas las funciones...enviar audio...al ser un copiloto de voz el campo de ingreso de texto y el mic deben estar en todas las funciones, en mi dia y en el chat principal...todos iguales con el mismo diseno-. Sobre eso yo concluí que el audio de Facturacion iba al chat como cualquier audio, apoyandome en que dictado_destinos.py:48 excluia el contexto -factura-. (B) Correccion del operador, dada directamente a la sesion frontend1 y relayada por peer: Gastos/Ingresos/Presupuestos/Clientes conservan su PRELLENADO de formulario y Facturacion debe funcionar IGUAL que esas cuatro -- abrir formulario o card prellenada, NO mandar al chat; Inteligencia si queda enviando al chat porque son solo preguntas. O sea que -igual que todas las funciones- significaba igual en el PRELLENADO, no solo igual en el dock. Mi conclusion (A) era una extension mia de una exclusion del backend, el mismo error que ya habia cometido con SM-L3 extendiendo -no probamos facturar- a -no probamos anular-. PROCEDENCIA de (B): mensaje de la sesion frontend1 (copiloto-emprendedor-6c) a planificacion del 2026-11-04; el operador no la dicto en el hilo de planificacion, asi que si no refleja su orden se corrige. La implementacion de (B) es SM-P13; el lado backend ya esta en main (2ca3f7ad, #1660) con su test adversarial. Registrada en docs/copiloto-emprendedor/2026-11-04-BACKLOG-sprint-pulido-final.md.
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

- **Estado:** CERRADO-POR-DECISION
- **Falta:** NADA: la pregunta de esta ficha se disolvio, no se resolvio. Era condicional a que frontend1 necesitara un contexto nuevo en /transcribir para el chat; con la reversion de SM-P3 el chat ya no usa /transcribir (el mic manda el audio directo, tipo WhatsApp), asi que el consumidor que la habria pedido dejo de existir. La whitelist queda como estaba en cuanto al chat. Lo que SI se agrego a _DESTINOS el mismo dia fue el contexto -factura-, y eso NO es esta ficha: es SM-P13, que nace de la segunda decision del operador. Citar 2ca3f7ad aca seria acreditar esta pregunta con la evidencia de otra.
- **Decision:** CIERRA SIN CODIGO por como se movieron las otras fichas el 2026-11-04, no por una orden especifica del operador sobre ella. Registrado en docs/copiloto-emprendedor/2026-11-04-BACKLOG-sprint-pulido-final.md. Cadena: (1) el operador decidio que el mic funcione como WhatsApp, IGUAL en toda la app -- soltar o Enviar-tras-fijar MANDA el audio -- lo que REVIRTIO el -pegar el transcript en el campo- de SM-P3 (implementado en 6a1ae914, revertido en d03f170a, #1658); (2) sin ese pegado, el chat no consume POST /transcribir, y esta ficha preguntaba exactamente si habia que agregarle un contexto -chat- a la whitelist para ese consumidor; (3) su propio DoD admitia esta salida: -o la medicion de frontend1 que acredita que no hace falta, o el cambio con su test-, y lo que acredita que no hace falta es que el consumidor ya no existe. Lo que queda VIGENTE de la medicion original, y hay que no perder: web.py:970 IGNORA un contexto desconocido en vez de rechazarlo, o sea que un contexto mal escrito por un cliente falla CALLADO. No es de esta ficha ni se arreglo hoy; queda anotado como hallazgo para quien toque /transcribir.
- **Dueño:** backend — **sólo si frontend1 lo pide con la medición de `SM-P3`**
- **Medido:** `CONTEXTOS_TRANSCRIBIR` (`apps/copiloto/dictado_destinos.py:53`) tiene
  `gasto · ingreso · presupuesto · cliente`; **no tiene `chat`**. Pero `apps/copiloto/web.py:970`
  **ignora** un contexto desconocido en vez de rechazarlo.
- **Por eso es condicional:** si frontend1 mide que mandar sin contexto (o con uno nuevo) pasa
  limpio, **backend no toca nada y esta ficha cierra sin código**. No se agrega un valor a la
  whitelist por las dudas.
- **DoD:** o la medición de frontend1 que acredita que no hace falta, o el cambio con su test.

### SM-P12 · `sin-issue` — El sprint cierra con una pasada de device completa

- **Estado:** DOD-PARCIAL
- **Dueno-activo:** frontend1 (RF8T318RN9T, Metro propio desde wt-fe1-ped en main b6b342bb)
- **Falta:** RETIRADA LA CAUSA, NO LA OBSERVACION (2026-11-05, adenda de frontend1). La pasada de las 08:06 corrio con el telefono logueado como e2e-onb@copiloto.test, NO con el usuario canonico e2e-device@copiloto.test (captura cuenta.png). O sea que el sujeto de esa medicion no era el que el DoD exige, y eso explica el gate «ARCA no configurada» sin ninguna anomalia: e2e-onb no tiene perfil fiscal. Queda RETIRADA mi hipotesis de la cache de CUIT (PantallaFacturacion.tsx:249-267) y el test discriminante que derive de ella: la prediccion fallo porque la premisa era falsa, no porque el mecanismo este mal. La cache NO tiene defecto. Re-corrido con e2e-device: el gate de Facturacion es «listo», el dock se ve, y el dictado COMPLETO abre el wizard «Datos de venta» PRELLENADO sin emitir nada. Falta todavia: (a) el dictado INCOMPLETO y su 2o turno por la misma sesion, sin probar; (b) una anomalia abierta — el wizard no persistio en una captura posterior y hay que repetirla; (c) [FALTA-VOZ] del operador, con el guion en docs/copiloto-emprendedor/2026-11-05-RECETA-una-sola-sentada-de-voz-y-device.md; (d) P2 y P4 nunca se ejercitaron; (e) build nuevo con el fix del teclado (d9cbb1a6, #1685, ya en main) para verificar SM-P5 en device. CONSECUENCIA QUE NO HAY QUE TAPAR: los DoD 1 y 6, declarados CUMPLE en esa pasada, se midieron con e2e-onb. Para lo que no depende del tenant (que el campo acepte texto, que el tema llegue al chat) el veredicto se sostiene; pero no son evidencia sobre e2e-device y hay que volver a verlos en la proxima pasada, que de todos modos ocurre por (e). Lo mismo vale para la medicion de supervivencia de la card sin resolver: fue real y el control de arranque en frio fue correcto, pero el sujeto era e2e-onb.
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

### SM-P13 · `sin-issue` — Facturación PRELLENA como las otras cuatro funciones (no manda al chat)

- **Estado:** DOD-PARCIAL
- **Dueno-activo:** frontend1 (mobile) + frontend2 (web) -- el lado backend ya esta en main
- **Falta:** La mitad WEB esta CERRADA: verificada en navegador real por frontend2 (Playwright, build ae21d662 desplegado en copilotoemprendedor.duckdns.org, usuario e2e-device, 2026-11-05) contra el backend real — card factura-propuesta con la propuesta (Mi Dia, Consumidor Final, 1x15000, total 15000), sin Emitir, nada emitido, y «Completar a mano» abre el wizard y limpia la card. En esa verificacion aparecio el hallazgo que jsdom NO veia y que corrigio #1683 (ae21d662): la card se pintaba en y=999-1208 con viewport 889, detras del dock y sin scroll, con el foco en BODY; ahora y=545-754 sobre el dock (772) y foco en el textarea. Queda cubierto por jsdom y no se re-mide: que el wizard conserve el borrador entre pasos es ESTADO, no layout — la regla que sale del hallazgo es «jsdom no acredita nada que dependa de layout», y el borrador no depende. La mitad MOBILE esta medida en device con el usuario canonico: dictado COMPLETO abre el wizard «Datos de venta» prellenado SIN emitir. FALTA SOLO el dictado INCOMPLETO con su 2o turno por la misma sesion (el mecanismo de dos pasos de _run_emitir_factura), mas una anomalia abierta que frontend1 declaro y hay que repetir: el wizard no persistio en una captura posterior. NOTA DE PROCEDENCIA: la primera pasada de mobile (08:06) corrio con e2e-onb@copiloto.test por error y de ahi salio el falso «ARCA no configurada»; la medicion que vale es la re-corrida con e2e-device, no aquella.
- **Dueño:** backend (la línea, HECHA) + frontend1 (cableado mobile) + frontend2 (cableado web)
- **Por qué es una ficha nueva y no SM-P6 ni SM-P11:** nace de la **segunda** decisión del operador
  del 2026-11-04, posterior a las dos. SM-P6 ya cerró su pregunta (el dock va siempre, sin
  condiciones) y SM-P11 preguntaba otra cosa (el `contexto` de `/transcribir` para el chat). Meter
  esto en cualquiera de las dos sería reusar un id con dos referentes, que es el error que este
  sprint ya pagó: se prueba A y se concluye B.
- **La decisión:** Gastos/Ingresos/Presupuestos/Clientes conservan su prellenado de formulario, y
  **Facturación debe funcionar igual que esas cuatro** — abrir formulario o card prellenada, **no**
  mandar al chat. Inteligencia sí queda enviando al chat, porque son sólo preguntas. Procedencia:
  orden dada directamente a la sesión frontend1 y relayada a planificación por peer el 2026-11-04;
  si no refleja la orden del operador, se corrige y la ficha se retira.
- **Medido ANTES de pedirlo (planificación, 2026-11-04):** el camino ya existía completo y es el
  mismo de las otras cuatro — `POST /chat` con `kind="dictado:factura"` → la tool `emitir_factura`
  **PROPONE**: devuelve `Artifact(kind="factura_propuesta")` con
  `{factura_id, faltantes, items, cliente{razon_social,cuit,condicion_iva,del_registro}, total,
  tipo_comprobante}` (`apps/copiloto/tool_catalog.py:1716`). El comentario de
  `apps/copiloto/dictado_destinos.py:48` excluía `factura` con el criterio «su tool devuelve una
  card, no escribe» — criterio que `emitir_factura` **cumple**: la emisión vive detrás de
  `confirmar(token_confirmacion)`. O sea que el comentario declaraba una protección que ya vivía en
  otra capa, y por eso nadie volvió a mirarlo.
- **Backend: HECHO y desplegado** — `2ca3f7ad` (#1660, CI 6/6). `"factura": DestinoDictado(
  emitir_factura, "Facturación")` en `_DESTINOS` (`CONTEXTOS_TRANSCRIBIR` lo hereda), comentario
  reescrito con el criterio real, y **test adversarial contra el workflow REAL**
  (`test_dictado_factura_no_emite.py`): dictar → `factura_propuesta`, queda en
  `esperando_confirmacion`, pasa 1 h y no emite, token inventado no emite, y **control positivo**:
  confirmar con el token de la card emite una sola vez. 48 passed en el VPS. Nada contra el tenant
  fiscal del operador; ninguna factura emitida.
- **Aviso de diseño de backend, que cambia el DoD de frontend:** un dictado de factura **incompleto**
  responde con una **pregunta sin card** la primera vez (mecanismo de dos pasos de
  `_run_emitir_factura`); la card llega en el segundo turno de la misma sesión. Eso **difiere** de
  Gastos, así que «igual que las otras cuatro» no es cierto en el caso incompleto y la UI tiene que
  preverlo en vez de mostrar una card vacía.
- **DoD:** (1) mobile: Facturación deja de usar `DockAlChat` y usa el mismo camino que Gastos, con la
  card `factura_propuesta` pintada; (2) web: lo mismo; (3) un test por lado que ejercite el caso
  **incompleto** (pregunta sin card en el 1er turno) y el completo; (4) device: dictar una factura
  desde Facturación y ver la card prellenada **sin que se emita nada**, con el usuario canónico
  `e2e-device@copiloto.test` y **nunca** contra el tenant fiscal del operador.

### SM-P14 · `sin-issue` — Una card pendiente CONTAMINA la respuesta de una pregunta que no la menciona

- **Estado:** PENDIENTE
- **Dueño:** backend (el contexto que arma el prompt), con planificación midiendo el alcance
- **Medido en device el 2026-11-05** (frontend1, APK `ef143e95`, `e2e-device@copiloto.test`): con una
  card de presupuesto SIN resolver viva en el chat, la respuesta al tema «¿Cómo emito mi primera
  factura?» de «Cómo usar la app» llegó con el ejemplo «…Seed Mi Dia una reparación por $3.000» — es
  decir, los datos de la card pendiente aparecieron dentro de una respuesta que no los pidió. Hecho
  medido; causa no investigada.
- **Por qué tiene ficha propia y no es un detalle de SM-P12:** la pasada de device la encontró de
  rebote, y una observación sin ficha no se persigue. Además no es cosmética: si el contexto del
  agente arrastra el contenido de una card pendiente a cualquier turno siguiente, el mismo mecanismo
  puede arrastrar datos de un cliente a una respuesta sobre otro. Eso es un problema de **aislamiento
  dentro del tenant**, no de redacción.
- **🔴 El modo de falla a evitar:** declararla «es el contexto conversacional, funciona así» sin medir
  QUÉ se inyecta. La pregunta correcta no es «¿por qué menciona el presupuesto?» sino **«¿qué entra
  exactamente en el prompt de un turno, y quién decide que una card sin resolver entre?»** —
  con el payload real de un turno, no con el diseño supuesto.
- **DoD:**
  1. El payload REAL del turno que produjo la contaminación (o su reproducción), mostrando qué parte
     del estado pendiente se inyectó y desde dónde (`path:línea` del armado del contexto).
  2. Veredicto explícito: es intencional (y entonces queda escrito dónde se declara) o es un defecto.
  3. Si es defecto: fix de raíz en el armado del contexto, con test que ejercite «card pendiente de A
     + pregunta no relacionada ⇒ la respuesta no cita A».
  4. Control adversarial del caso que importa: card pendiente del cliente A + pregunta sobre el
     cliente B ⇒ la respuesta no filtra datos de A. Sin ese test el punto 3 queda `[UNVERIFIED]`.