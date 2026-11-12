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
| **SM-P1** | `sin-issue` | ✅ TERMINADO | d9cbb1a6 (#1685, ancestro de origin/main con control negativo). MEDIDO EN DEVICE las dos pieles por frontend1 el 2026… |
| **SM-P2** | `sin-issue` | ✅ TERMINADO | DoD COMPLETO en device el 2026-11-06, @6a1ae914 (ancestro de origin/main, control negativo deadbeef NO). frontend1, R… |
| **SM-P3** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | NADA. La Falta que esta ficha arrastraba («pasada de device, el release fb0fb9d3 no trae estos fixes») era de cuando … |
| **SM-P4** | `sin-issue` | ✅ TERMINADO | 6a1ae914 (#1650, ancestro de origin/main; contenido verificado presente en 3ff9c040 y b06c78b5, los dos bundles que M… |
| **SM-P5** | `sin-issue` | ✅ TERMINADO | @2235f543 (#1714, CI 6/6). Causa raiz medida en device por frontend1: NO era color (campo pixel-identico al del chat)… |
| **SM-P6** | `sin-issue` | ✅ TERMINADO | 0212ba19 (#1653, ancestro de origin/main). MEDIDO EN DEVICE por frontend1 el 2026-11-06 con el gate fiscal en LISTO: … |
| **SM-P7** | `sin-issue` | ✅ TERMINADO | DoD completo, cierre_ de frontend2 (2026-11-05) con los tres campos. Playwright en Gastos 390x844: oscuro blur 16px a… |
| **SM-P8** | `sin-issue` | ✅ TERMINADO | 82f8451e (#1651). Tabla medida: (a) puente Como usar NO APLICA: la web navega por tabs sin stack, PantallaComoUsarLaA… |
| **SM-P9** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | NADA de decision: lo que queda es IMPLEMENTACION y vive en otras fichas. SM-P5 (dock unico mobile, Mi dia editable) y… |
| **SM-P10** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | La IMPLEMENTACION del dock es de SM-P6 (quitar las dos condiciones de PantallaFacturacion.tsx:706: hecho en 0212ba19 … |
| **SM-P11** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | NADA: la pregunta de esta ficha se disolvio, no se resolvio. Era condicional a que frontend1 necesitara un contexto n… |
| **SM-P12** | `sin-issue` | ✅ TERMINADO | TERMINADO @8980a67c (ancestro de origin/main). DoD 8/8: puntos 1-7 acreditados en device el 2026-11-06 (ver Falta his… |
| **SM-P13** | `sin-issue` | 🗳️ CERRADO-POR-DECISION | 🔴 ESCALADO AL OPERADOR EL 2026-11-06 -- EL PUNTO (1) DEL DoD QUEDO DEROGADO DE FACTO Y MOBILE Y WEB DIVERGEN. Medido … |
| **SM-P14** | `sin-issue` | ✅ TERMINADO | sin-codigo — el defecto NO se reproduce por el mecanismo que la ficha le atribuia, y el fix propuesto quedo SIN respa… |
| **SM-P15** | `sin-issue` | ✅ TERMINADO | NADA del cableado. El CONTENIDO del corpus quedo fichado aparte como issue #1728 (decision de producto del operador):… |
| **SM-P16** | `sin-issue` | ✅ TERMINADO | sha 2d50aa8a03c3df4f9a428995acfc9efbb588f079 (#1733) y 4752fa6d939a1cda6c4befe32e7b7f862b69053e (#1764). DoD: (1) arr… |
| **SM-P18** | `sin-issue` | ✅ TERMINADO | c16b989ff2e76032e0e52cb18ad4df22f301997e (#1744, ancestro de origin/main). DoD completo en device RF8T318RN9T, e2e-de… |
| **SM-P17** | `sin-issue` | ✅ TERMINADO | NADA de lo pedido. frontend2 declaro, sin que se le pidiera, cinco superficies que NO estan cubiertas y NO estaban en… |
| **SM-P19** | `sin-issue` | ✅ TERMINADO | c1efe9ba (PR #1809 backend: registrar_cobro publica el turno, 3 tests VPS 110 passed incl. reintento=1 turno y advers… |
| **SM-P20** | `sin-issue` | ✅ TERMINADO | DoD 5/5 @570e4153 (merge #1790, ancestro de origin/main; antes 568158a4 #1789, 4c5ae5f0 backend, 25371b4e la Agenda).… |
| **SM-P21** | `sin-issue` | ✅ TERMINADO | TERMINADO @c01ae19e (merge de PR #1788 en origin/main), desplegado y verificado por EFECTO: el sitio sirve data-build… |
| **SM-P22** | `sin-issue` | ✅ TERMINADO | DoD 2/2 @3b9ecc25 (merge del #1791 en origin/main, verificado ancestro por planificacion con git merge-base, no por e… |
| **SM-P23** | `sin-issue` | ✅ TERMINADO | DoD 3/3. p1 y p2 @41cf2440 (merge #1792, CI 6/6): una sola definicion de segmentarNegrita en packages/core/src/chat/n… |

<!-- TABLA-ESTADO:FIN -->

# Bloque P · Pulido final

### SM-P1 · `sin-issue` — «Cómo usar la app»: tocar una card no llega a destino, vuelve a Ajustes

- **Estado:** TERMINADO
- **Cierre:** d9cbb1a6 (#1685, ancestro de origin/main con control negativo). MEDIDO EN DEVICE las dos pieles por frontend1 el 2026-11-06, y la medicion vale porque declara su propio cable: Metro sirvio 3ff9c040, que CONTIENE d9cbb1a6 -- el APK instalado (7d278a2c) es ANTERIOR al fix, asi que probar sobre el APK habria dado un rojo que no era del codigo de hoy. Los otros puntos del DoD ya estaban pagados y el Falta anterior lo declaraba: QUEDABA SOLO DEVICE. Las 5 cards llegan al chat con su pregunta y el chat queda ARRIBA (ChatView avisa con onPendienteMandado y PantallaPrincipal cierra el escritorio), 45/45 con control negativo y positivo.
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

- **Estado:** TERMINADO
- **Cierre:** DoD COMPLETO en device el 2026-11-06, @6a1ae914 (ancestro de origin/main, control negativo deadbeef NO). frontend1, RF8T318RN9T, e2e-device, con el permiso de LOGOUT que el operador concedio hoy -- la ficha estaba trabada en ese permiso, no en codigo. Logout y login ejercitados en las DOS pieles (oscura y clara) y el tema restaurado a Oscuro al terminar. MEDICION: el isotipo grande mide 5-6 px en ambas pieles, ~5,5 % del tamano, o sea proporcional. POR QUE ESTO ABSUELVE Y NO SOLO 'se ve bien': el defecto que se buscaba daria ~2,6 px, asi que la medicion DISTINGUE el caso sano del defectuoso en vez de confirmar el esperado -- 5-6 contra 2,6 no es un margen de apreciacion. Cero facturas, cuenta fiscal del operador intacta.
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

- **Estado:** TERMINADO
- **Cierre:** 6a1ae914 (#1650, ancestro de origin/main; contenido verificado presente en 3ff9c040 y b06c78b5, los dos bundles que Metro sirvio). MEDIDO EN DEVICE las dos pieles por frontend1 el 2026-11-06: el composer de Soporte ya no ofrece camara. Esta ficha estuvo DOD-PARCIAL solo por falta de corrida, no de codigo: su Falta declaraba explicitamente que el APK instalado YA contenia el fix y que faltaba mirarla.
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

- **Estado:** TERMINADO
- **Cierre:** @2235f543 (#1714, CI 6/6). Causa raiz medida en device por frontend1: NO era color (campo pixel-identico al del chat) sino GEOMETRIA — DockSobreContenido solapaba 28px y el scroll terminaba sobre el campo, dejando franja lisa y card cortada. Fix: el dock mide su alto (onLayout) y marginTop=-alto => huella CERO, la lista corre bajo todo el dock igual que en el chat; cero cambios a ALFA_BASE_CAMPO/borde/ALFA_SCRIM_ABAJO. Tests jest + test nuevo de huella cero + gate §9 de contraste verdes en CI. Device (build 7fed76f8, cable verificado con canario CABLE-OK-ZZ9): Gastos y Facturacion en oscura, Ingresos/Presupuestos/Clientes en clara; N41 verificado en oscura (el interior del campo no deja leer nada detras). ACREDITACION DE LAS DOS PIELES POR EL OPERADOR en device sobre este mismo bundle: «en ambas pieles esta bien» (2026-11-05).
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

- **Estado:** TERMINADO
- **Cierre:** 0212ba19 (#1653, ancestro de origin/main). MEDIDO EN DEVICE por frontend1 el 2026-11-06 con el gate fiscal en LISTO: el dock de Facturacion SE VE. Eso cierra las DOS mitades del DoD 9: la combinacion «ARCA no configurada» + listado ya se habia medido el 11-05 (fac1.png) y la que faltaba era «gate listo», que esperaba el tenant sintetico que backend provisiono. CERO facturas emitidas, usuario e2e-device, la cuenta fiscal real del operador intacta.
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
- **Cierre:** DoD completo, cierre_ de frontend2 (2026-11-05) con los tres campos. Playwright en Gastos 390x844: oscuro blur 16px alpha 0.74 contraste 14.19/5.06; claro 11.52/4.73; sticky verificado con 3000px de relleno. SHA 5a2a615e (#1668) sobre base f9c5d98b (#1654). Alcance declarado por el propio cierre: medido solo en Gastos, las otras 4 funciones montan el MISMO DockEntrada.
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

- **Estado:** TERMINADO
- **Dueno-activo:** frontend1 (RF8T318RN9T, Metro propio desde wt-fe1-ped en main b6b342bb)
- **Cierre:** TERMINADO @8980a67c (ancestro de origin/main). DoD 8/8: puntos 1-7 acreditados en device el 2026-11-06 (ver Falta historico: 1 SM-P1, 3-4 SM-P6, 6 d9cbb1a6, 7 borde 1px, 2 arreglado c8a978eb #1731); punto 8 CERRADO POR DECISION del operador el 2026-11-06. Residuales cerrados el 2026-11-12: (a) aviso 'El chat todavia no esta listo' -- unico uso vivo en PantallaInteligencia.tsx:336; frontend1 en device RF8T318RN9T, usuario canonico, bundle 8980a67c, arranque en frio 10:28 -> Inteligencia -> tipeo 'Cuanto cobre este mes' 10:30:01 -> respuesta + tarjeta, el aviso NUNCA aparecio (capturas p12-g, p12-h). (b) 'campo que no subia 1 de ~8' -- previo al fix c8a978eb y nunca reproducido: cerrado como NO REPRODUCIDO por decision del operador 2026-11-12 en el hilo de planificacion; si reaparece se reabre.
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

- **Estado:** CERRADO-POR-DECISION
- **Dueno-activo:** frontend1 (mobile) + frontend2 (web) -- el lado backend ya esta en main
- **Falta:** 🔴 ESCALADO AL OPERADOR EL 2026-11-06 -- EL PUNTO (1) DEL DoD QUEDO DEROGADO DE FACTO Y MOBILE Y WEB DIVERGEN. Medido @`origin/main`: en **mobile**, `apps/mobile/src/modules/facturacion/PantallaFacturacion.tsx:709` monta `<DockAlChat contexto="factura">` -- o sea Facturacion **manda al chat**, que es exactamente lo que esta ficha pedia NO hacer; `AvisoDictado` y `useDictadoPorFuncion` ya no existen en main (0 archivos, 0 referencias). En **web**, `apps/copiloto-web/.../PantallaFacturacion.tsx:185` sigue usando `useDictadoFactura()` (111 lineas vivas) con `TarjetaFacturaPropuesta`, y su comentario de la linea 594 cita textual «lo dictado NO va al chat: se prellena aca ... (decision del operador 2026-11-04)». **Las dos sesiones tienen razon y ninguna se equivoco**: cada lado ejecuto la orden vigente para su plataforma -- mobile la del 2026-11-06 («todo remite al chat», SM-P14, que es POSTERIOR y por eso gana donde se aplico) y web la del 2026-11-04 (esta ficha). La segunda orden nunca se propago a la web, asi que hoy **la misma funcion se comporta distinto segun el dispositivo**. Esto NO lo decide planificacion: es MAYOR (dos ordenes del operador en conflicto) y queda a su resolucion -- o la web tambien remite al chat, o mobile vuelve a prellenar. || POR QUE NO SE CIERRA NI SE DECLARA CUMPLIDA: el punto (1) del DoD esta hoy hecho AL REVES en mobile, asi que declararla TERMINADO afirmaria lo contrario de lo medido, y cerrarla POR DECISION requeriria una decision que todavia no existe. || LO QUE SI ESTA PAGADO, y no se pierde con la escalada: la mitad WEB esta medida en navegador real contra el backend desplegado, wizard incluido (nada emitido) -- card de dictado corregida en #1683 (y=545-754 sobre el dock 772, foco en el textarea) y, en el wizard, Items y Resumen conservaban el borrador pero «Editar y confirmar» -> Datos de venta / Cliente abria el formulario VACIO (gemelo del SM-H1 de mobile); corregido en #1720 (3f784033) con test rojo-sin-fix/verde-con-fix, y re-medido en el build 3f784033: ambos abren precargados con Continuar habilitado y todos los pasos quedan sobre el dock (continuar y=607, dock 772). || Y LO QUE DECIA ACA HASTA HOY, que ya no tiene sujeto: «Solo DEVICE: la pasada de SM-P12 con e2e-device sobre la card de dictado:factura». En mobile esa card **ya no existe** (lo reporto frontend1 y lo verifique); en web existe y esta medida. Un `Falta:` que nombra un sujeto borrado manda a medir algo que no esta, y el que lo intente va a leer el vacio como defecto. La mitad WEB esta medida en navegador real contra el backend desplegado, wizard incluido (nada emitido): card de dictado corregida en #1683 (y=545-754 sobre el dock 772, foco en el textarea) y, en el wizard, Items y Resumen conservaban el borrador pero «Editar y confirmar» -> Datos de venta / Cliente abria el formulario VACIO (gemelo del SM-H1 de mobile); corregido en #1720 (3f784033) con test rojo-sin-fix/verde-con-fix, y re-medido en el build 3f784033: ambos abren precargados con Continuar habilitado y todos los pasos quedan sobre el dock (continuar y=607, dock 772).
- **Decision:** QUIEN: el operador. CUANDO: 2026-11-06. DONDE: registrada en docs/copiloto-emprendedor/2026-11-04-BACKLOG-sprint-pulido-final.md; dada en el hilo de planificacion, textual -- «dejaremos la card en el chat por ahora, no lo arreglen». PROCEDENCIA: RELAYADA por frontend1, no presenciada por planificacion; la salvedad se escribe porque una orden relayada y una presenciada no acreditan lo mismo. SE CIERRA POR DECISION Y NO COMO TERMINADO porque marcarla TERMINADO afirmaria lo contrario de lo medido: el hueco del Falta: sigue existiendo y la decision no lo borra, solo deja de pedir que se pague. SUPERADA DESPUES EL MISMO DIA por SM-P19, que es la orden NUEVA y presenciada: la card vuelve a la funcion y al guardar va al chat.
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

- **Estado:** TERMINADO
- **Cierre:** sin-codigo — el defecto NO se reproduce por el mecanismo que la ficha le atribuia, y el fix propuesto quedo SIN respaldo. Medido por backend el 2026-11-06 con el PAYLOAD REAL del device: volco de Temporal del workflow del usuario canonico (el id completo esta en el cierre_ de backend; no lo transcribo porque su prefijo tiene forma de sha de git y el verificador lo buscaria como commit), eventos 378 y 390 de call_llm_tools. El contexto del turno SI llevaba la card pendiente de presupuesto justo antes de «Como emito mi primera factura», y el agente respondio desde el RAG (Ajustes -> Facturacion, datos fiscales) SIN citar el cliente, el monto ni el presupuesto. O sea la inyeccion existe -- es el arrastre deliberado del tail, conversation_workflow.py:552-554 -- y no contamina. || LO QUE HACE VALER EL CERO, que es lo unico que lo distingue de un instrumento ciego: control POSITIVO del detector 7/8 con KB y 8/8 sin KB cuando la pregunta SI menciona la card; V0 (codigo de hoy) 0/8 con KB y 0/24 sin KB; adversarial A->B 0/8 con su control positivo 8/8. Un 0 sin esos positivos no habria acreditado nada. || Y DOS CORRECCIONES AL PROPIO CONTRATO, que es lo que mas valia de esta ficha: (a) V1, el fix que yo propuse -- recortar la prosa del observation.result -- da 3/24, NO mejora, y ademas no toca los otros dos canales que llevan los mismos datos (los argumentos del tool_call y el mensaje user del turno 1), asi que no habria funcionado aunque el ruido fuera real; (b) consultar_cliente NO esta en el catalogo que recibe el LLM (podado en el hito 2, medido False), asi que «el arrastre entre clientes ya no es hipotesis» -- que yo escribi en la enmienda -- no aplica hoy: ese codigo esta muerto para el agente. || LIMITE DECLARADO: N=8 por celda, un usuario, un modelo. Esto descarta una contaminacion FRECUENTE por este canal, no una rara. No se toco prompt, corpus, workflow ni codigo, a proposito: un test «el prompt no contiene los datos» sale rojo hoy por diseno, y exigir su verde obligaria a quitar el arrastre que el propio contrato prohibe tocar.
- **Dueño:** backend (el contexto que arma el prompt), con planificación midiendo el alcance
- **🟢 El punto 1 del DoD está PAGADO (planificación, 2026-11-05) y la causa NO era la que se supuso.**
  Medición completa en la `ENMIENDA` del `contrato_planificacion-a-backend_SM-P14…` del buzón.
  Resumen: la **estructura** de la propuesta ya se saca bien del prompt — viaja en `artifact`, que es
  campo **hermano** de `observation`, y `tr_msg` se arma sólo con `observation`
  (`conversation_workflow.py:489`; `tool_catalog.py:1004-1005`). Lo que contamina es la **prosa** del
  `observation["result"]`, que interpola **nombre de cliente y concepto**
  (`tool_catalog.py:999-1003`) y entra al transcript (`:493`) y al tail del turno siguiente sin ningún
  saneamiento (`:566`, `REACT_TAIL = 80`). El **monto** no sale de ahí: viene del `role:user` del
  turno original (`:551`). Encaja con lo medido en device («Seed Mi Dia una reparación por $3.000» =
  cliente + concepto + el monto del propio pedido).
  **No hay un `observation.pop` que agregar**: la distinción que falta es *instrucción táctica de este
  turno* vs *estado vigente*, no *con contexto vs sin contexto*.
- **🔴 ALCANCE: no es una tool, es el patrón — y el caso grave es otro.** Seis `observation` interpolan
  datos en prosa (`tool_catalog.py:847` gasto, `:926` cliente, `:999` presupuesto, `:1216` ingreso,
  `:1711` factura y **`:1066` `consultar_cliente`**). `:1066` mete **nombre + «Últimas:» operaciones
  del cliente** en el tail: el arrastre de datos de un cliente a una respuesta sobre otro —el riesgo
  de aislamiento intra-tenant que esta ficha teme— **ya no es hipótesis, tiene `path:línea`**. El
  control adversarial del DoD punto 4 cambia de sujeto: **cliente A → pregunta por cliente B**, con el
  assert sobre los `messages` del segundo turno.
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
### SM-P15 · `sin-issue` — El chat del copiloto responde «cómo usar la app» con el RAG

- **Estado:** TERMINADO
- **Falta:** NADA del cableado. El CONTENIDO del corpus quedo fichado aparte como issue #1728 (decision de producto del operador): (a) el corpus dice «Facturacion AFIP» y la app rotula «ARCA» -- el RAG ENSENA un nombre que la app no usa; (b) MercadoPago no cubre «que vas a poder ver»; (c) Mi dia contesta generico. Mas un faltante de INSTRUMENTO: el orquestador no expone stats (404), asi que no se puede contar chunks ni fecha de indexacion -- hoy sabemos que CONTESTA, no cuando se indexo.
- **Cierre:** @30f9c861 (#1718, CI 6/6, desplegado, durabilidad VERDE; ancestro de origin/main verificado con control negativo). Verificado tambien por CONTENIDO y no por el sha: tool_catalog.py:520 mete CONSULTAR_KB_EMPRENDEDOR_SCHEMA en schemas y :536 la declara read puro sin gate HITL (grep con control negativo 0). DoD 1-6 cumplidos. Punto 7, el que decidia si esto sirve: CORPUS NO VACIO -- las 5 TEMAS_AYUDA volvieron answered contra el orquestador REAL. Control positivo de honestidad: pregunta ajena (Mongolia) -> refused, no invento. Control negativo del instrumento: token/URL malos -> unavailable, no un falso answered. Routing medido en prod con e2e-device: las 3 preguntas de ayuda llamaron la tool y la operativa la llamo 0 veces. Y la pregunta «el RAG interfiere con el chat principal?» quedo ZANJADA con A/B preregistrado (14 frases de /capacidades x N=5 x 2 brazos, 70 por brazo, unica variable = la tool en el catalogo): mis-routing 0/70, acierto 70/70 en ambos brazos, Fisher p=1.0 -- NO se detecta interferencia en la eleccion de tool.
- **Dueño:** backend
- **Qué:** orden del operador (2026-11-05, textual): *«el chat del copiloto debe poder responder
  preguntas sobre como usar la app... así que agrega el rag a las capacidades del chat»*, y después
  *«que backend pruebe si el rag funciona bien también»*. O sea DOS preguntas, no una: que esté
  enchufado, y que lo que contesta SIRVA.
- **Por qué el trabajo era ENCHUFAR y no escribir:** la tool `consultar_base_de_conocimiento` ya
  existía entera en `apps/copiloto/soporte_agent_tools.py:50` (schema + `_run_consultar_kb` +
  dispatch) y sólo vivía en el dominio `soporte` (`worker_soporte.py:129`). Faltaba en el dominio
  `emprendedor` (`worker_b.py:296` → `tool_catalog.build_tool_catalog()`). El comentario de esa
  función dejaba la puerta abierta por escrito —*«se re-enchufan acá sin reescribirlos»*— y
  `consultar_negocio` ya había entrado así por decisión de planificación el 2026-10-13.
- **🔴 El fallo silencioso que la ampliación del DoD vino a cazar:** con el corpus vacío TODO el
  cableado sale verde — la tool se invoca, `/rag/answer` da 200, el `outcome` es `refused` legítimo y
  el chat dice honestamente «no sé». Cero rojo, cero valor. **`refused` significa lo mismo para «el
  corpus no lo tiene» que para «el corpus no tiene nada»: no los distingue**, así que un test que
  afirme `refused` es verde en los dos casos. Por eso el DoD exigió `answered` con contenido
  verdadero, no sólo cobertura de los tres `outcome`.
- **DoD:**
  1. La tool en el catálogo del chat Y ejecutable desde su `tool_executor` (un schema sin ejecutor es
     una tool que el agente ofrece y no puede correr).
  2. Test por el camino de producción, no por el default.
  3. Los tres `outcome`, con `refused` por control positivo: que diga que no sabe en vez de inventar.
  4. `RAG_ORQUESTADOR_BASE_URL` / `RAG_ORQUESTADOR_TOKEN` verificadas en el entorno de `worker_b`.
  5. Tests en el VPS con recibo del SHA.
  6. Read puro, sin gate HITL que no corresponda.
  7. Las 5 preguntas reales (`TEMAS_AYUDA`) con tabla de `outcome` + respuesta + ¿es correcta?

### SM-P16 · `sin-issue` — El panel de Mi día arrastra desde el CUERPO, no sólo desde la línea

- **Estado:** TERMINADO
- **Dueno-activo:** frontend1
- **Cierre:** sha 2d50aa8a03c3df4f9a428995acfc9efbb588f079 (#1733) y 4752fa6d939a1cda6c4befe32e7b7f862b69053e (#1764). DoD: (1) arrastre desde el cuerpo en main #1733. (2) scroll vertical y tap de card HITL medidos en device RF8T318RN9T e2e-device 2026-11-06; el swipe horizontal de tarjeta vive SOLO en el tablero (PantallaTuDia pasa gestion, Mi dia no por SM-I1) y el operador lo probo a mano el 2026-11-06 (procedencia: su relato, no presenciado por frontend1): revela Empezar y Borrar, se oculta al volver, los filtros se deslizan; en Mi dia no hay swipe por diseno. (3) composicion declarada en TarjetaMiDiaRow: el Pan del cuerpo envuelve solo la conversacion. (4) tests en main. (5) asa medida en piel oscura y clara. (6) hitSlop atribuido: agarra a 25 y 40 px, a 55 y 70 px es la barra de estado de Android (inset 24 dp). Decisiones del operador: no opcion B, el mic queda como esta.
- **Dueño:** frontend1 (dueña del device y del shell)
- **Qué:** orden del operador (2026-11-05, textual): *«el tirador tiene que funcionar en cualquier
  lugar de la linea de tirar hacia abajo con el gesto de scroll»*.
- **🔴 NO es una regresión: es un FALTANTE, y la distinción cambia la tarea.** El operador lo reportó
  como regresión y acto seguido dudó —*«no sé si es mi apreciación o nunca se implementó»*— y su
  segunda hipótesis es la correcta. Medido contra `origin/main`: el panel tiene **exactamente dos**
  `GestureDetector`, `PanelDeslizable.tsx:626` sobre `zonaHandle` (la línea, `ALTO_HANDLE = 13`) y
  `:648` sobre `pieAbajo`; en el medio, `:637` es `<Animated.View>{children}</Animated.View>`, **sin
  gesto**. El código lo declara: `:672` *«SM-N38: sólo la línea»*, `:412` *«el Pan se FABRICA: el del
  asa»*. Control por CONTENIDO sobre la historia completa (`git log -S`, no por sha porque las citas
  de sha mueren en el squash): `gestoCuerpo` 0 commits · `blocksExternalGesture` 0 ·
  `requireExternalGestureToFail` 0 · `simultaneousWithExternalGesture` 4 · control positivo
  `ALTO_HANDLE` 14 · control negativo 0. **Llamarlo regresión manda a bisectar una historia donde el
  código nunca estuvo.**
- **🟢 Y el operador NO recuerda mal — hay un mecanismo real detrás de la sensación.** `:465` →
  `gestoAsa: crearPan().hitSlop({ top: holguraArrastreArriba(insetTop) })`: el asa agarra **más de lo
  que se ve**, en una franja invisible sobre la línea cuyo tamaño es **calculado** (depende de
  `insetTop` y del alto, acotado por `ALTO_ZONA_ARRASTRE`, `:64`). Zona activa invisible y variable,
  con `ALTO_HANDLE` tocado en 14 commits = «antes agarraba más». Medirla en dp es parte del DoD: es
  lo que cierra la duda, y es diagnóstico, no cosmética.
- **Lo difícil no es montar el Pan, es COMPONERLO.** El cuerpo tiene scroll, tap y
  `ReanimatedSwipeable` (`TarjetaMiDiaRow`, que en `:257` ya dejó anotado que **no hay wiring
  explícito** contra el `Gesture.Pan()` de `MarcoGlass`). Hoy **nada de eso está roto**: un fix que
  habilite el arrastre y rompa el swipe nos deja peor que ahora.
- **DoD:**
  1. Arrastra desde cualquier punto del cuerpo, con gesto de scroll vertical.
  2. **Y el scroll, el tap y el swipe de la tarjeta siguen funcionando.** No es un «además»: es la
     mitad por la que este trabajo puede fracasar.
  3. Composición de gestos declarada EXPLÍCITAMENTE (no heredada del árbol) y el comentario de
     `TarjetaMiDiaRow.tsx:257` actualizado — si queda diciendo que no hay wiring, miente al próximo.
  4. Tests de las DOS mitades. Precedente del mismo día: `Row.gestual.test.tsx` son 49 líneas que
     afirman el gesto de la fila y **ninguna** mira el Pan del padre.
  5. Device a mano, `adb input motionevent` DOWN/MOVE/UP (un `input tap` no ejercita un Pan): desde
     el cuerpo, desde encima de una tarjeta y desde la línea, en las dos pieles.
  6. La franja del `hitSlop` del asa medida en dp con el inset real del device.

### SM-P18 · `sin-issue` — El aviso de «no se entendió el audio» se superpone a la burbuja y queda ILEGIBLE

- **Estado:** TERMINADO
- **Cierre:** c16b989ff2e76032e0e52cb18ad4df22f301997e (#1744, ancestro de origin/main). DoD completo en device RF8T318RN9T, e2e-device, 2026-11-06: piel OSCURA antes/despues (aviso a dos lineas, legible) y piel CLARA 19:49 con un tono puro grabado en el chat (el silencio no lo provoca: el STT devuelve texto, limite conocido, el operador decidio no pasar a whisper large-v3): «No se entendio el audio. Proba de nuevo hablando mas cerca del microfono.» en dos lineas sobre su propio fondo, legible, sin superponerse a la burbuja. Test Composer.avisoLegible.test.tsx.
- **Dueño:** frontend1 (mobile)
- **Qué:** hallazgo de la pasada de device del guard del STT (2026-11-06). Cuando el backend rechaza un audio que no se entendio, el aviso rosa se dibuja ENCIMA del texto de la burbuja de respuesta y el resultado es ilegible: se ven las dos capas superpuestas.
- **🔴 Por que es defecto y no cosmetica:** un mensaje de error ilegible es PEOR que no tener ninguno. El usuario ve que algo paso, no puede leer que, y no sabe si fallo el microfono, la red o el. El aviso existe justamente para sacarlo de esa duda; superpuesto, la confirma.
- **Causa (medida, no supuesta):** `filaEstado` sin fondo propio y el `Text` sin `flexShrink`, asi que ni tapaba lo de atras ni envolvia. Fix: fondo opaco + `flexShrink` + `maxWidth`.
- **DoD:**
  1. El aviso se lee completo, sin superponerse a la burbuja, **en las DOS pieles**. La oscura ya esta; falta la clara.
  2. Test rojo-sin-fix / verde-con-fix (hecho: jest chat Composer 17 verdes con el test nuevo).
  3. Medido en **device**, no solo en jest -- este defecto es de pintura y jest no lo ve.
  4. Con el texto mas largo que el guard puede emitir hoy, no solo con el corto. Un aviso que entra en dos lineas puede romper en tres.
  5. Cero facturas, usuario e2e-device, cuenta fiscal real del operador intacta.
### SM-P17 · `sin-issue` — Los formularios web abren con el foco en BODY: el usuario toca y no puede escribir

- **Estado:** TERMINADO
- **Falta:** NADA de lo pedido. frontend2 declaro, sin que se le pidiera, cinco superficies que NO estan cubiertas y NO estaban en el contrato: Login/Signup, Onboarding, Admin, MidiaScreen y las tarjetas propuestas del chat. NO las asigno: nadie reporto defecto ahi y meterlas seria expandir el alcance por simetria, que es el error espejo del que esta ficha corrigio. Quedan como observacion con dueno nombrado (operador, decision de producto) en vez de como deuda invisible.
- **Cierre:** DOS mitades, las dos en origin/main y verificadas por mi con control negativo: @fe9dc2ce (#1729, CI 6/6, desplegado) las 8 definiciones directas -- forms Presupuesto/Cliente/Gasto/Ingreso, pasos Datos de venta/Items/Cliente y Detalle; y @c5653d8f (#1730, CI 6/6, desplegado) las 4 async/colapsadas -- PerfilNegocio, Tono, AfipSetup, CambiarCredenciales. Verificado tambien por CONTENIDO y no por el sha (el squash mata la cita): git log origin/main -S useFocoAlMontar -> fe9dc2ce con control negativo 0 commits, y 12 definiciones usan el hook. DoD 1-4 y 6 cumplidos. DoD 5, el que decidia si el verde valia: frontend2 MUTO el hook para enfocar al montar y los 3 tests async salieron ROJOS (3 failed), y sin cablear Credenciales tambien rojo -- o sea el test SI distingue el caso que importa. Medido en navegador real: perfil-negocio-que-vende, tono-formalidad, afip-perfil-razon-social, account-contrasena-actual, presupuesto-concepto, detalle-presupuesto, cliente-nombre, gasto-monto, ingreso-monto, facturacion-paso-datos-venta-fecha -- todos BODY antes. Diseno del hook: omitido = al montar (cubre tambien «expandir», porque el form se monta ahi); listo=false hasta que llega el dato = enfoca UNA vez al pasar a true; Afip espera la precarga completa porque el CUIT editable pasa a chip Bloqueado. Nada escrito ni guardado, cuenta fiscal real intacta.
- **Dueño:** frontend2 (web)
- **Qué:** hallazgo de la pasada de navegador real de toda la web (orden del operador 2026-11-06, textual: «que se pruebe todo»). Al abrir un formulario o un detalle, el foco quedaba en `BODY`: la pantalla se dibuja perfecta y el teclado no llega a ningun campo.
- **🔴 Por que es defecto y no cosmetica — es el TERCER caso de la misma familia en este sprint:** la card de dictado dejaba el foco en BODY (#1683) y el wizard abria los pasos VACIOS (#1720). El patron es siempre el mismo: **la geometria esta bien y el ESTADO DE ENTRADA no se prepara**. Y es justamente lo que hace que nadie lo revise — una pantalla que se ve correcta no pide revision. Los tres los cazo el NAVEGADOR; jsdom los dio verdes.
- **DoD:**
  1. El foco va al primer campo editable al abrir. Si el detalle es de solo lectura, a su contenedor enfocable — nunca BODY, porque desde BODY el teclado no llega a ningun lado.
  2. Test rojo-sin-fix / verde-con-fix por definicion.
  3. **Medido en navegador real**, no solo jsdom.
  4. Contar DEFINICIONES, no usos: el fix suele existir en un call-site y faltar en los gemelos.
  5. **Control de TIMING para los casos async:** el test tiene que salir ROJO si el foco llegara antes del dato. Sin ese control el verde no acredita, porque un test con el dato ya resuelto pasa igual mientras el caso real falla.
  6. Cero secretos en repo ni en capturas; nada de la cuenta fiscal real del operador.
### SM-P19 · `sin-issue` — La card se prellena DENTRO de la función y al GUARDAR la actividad va al chat (las 5)

- **Estado:** TERMINADO
- **Dueno-activo:** frontend1
- **Cierre:** c1efe9ba (PR #1809 backend: registrar_cobro publica el turno, 3 tests VPS 110 passed incl. reintento=1 turno y adversarial cross-tenant con control positivo) + a9dd9258 (PR #1808 app: cobro sobre factura manda session_id, vitest con control positivo) + device 12-11 frontend1: ingreso/cobro/presupuesto/cliente; confirmar factura fuera por decision del operador (emite en ARCA)
- **Dueño:** frontend1 (mobile) + frontend2 (web) + backend (la mitad B)
- **Orden del operador (2026-11-06), textual y PRESENCIADA en el hilo de planificación:** «si remite
  al chat pero de manera diferente... primero muestra la card prellenada dentro de la función y
  después remite al chat» · «esta es la orden nueva» · «aplica a las 5 funciones». Nació de que el
  operador preguntó por el aviso «El chat todavía no está listo» (ver el `Falta:` de `SM-P12`).
  **Procedencia:** dada directamente acá, no relayada — a diferencia de la de `SM-P13` y de la del
  cierre de la receta de voz, que llevan su salvedad escrita. La distinción es deliberada.
- **REEMPLAZA el comportamiento de `SM-P14`** en las 5 funciones. Son TRES comportamientos distintos y
  confundirlos ya costó una divergencia entre plataformas el 2026-11-06: (a) **viejo** (pre-`SM-P14`):
  card en la función, nunca va al chat — derogado; (b) **hoy** (`SM-P14`): card en el chat, va ANTES
  de llenarla — lo que se reemplaza; (c) **NUEVO**: card en la función, va al chat **al GUARDAR**.
- **Y arregla de RAÍZ el defecto del aviso, sin necesidad de atribuirlo:** hoy dictar en una función
  depende de que el chat esté hidratado (`chat/ChatView.tsx:172` → `if (!hidratado) return;` antes de
  `registrarDespachoChat`), y cuando no lo está sale `CHAT_NO_LISTO` (`voz/DockAlChat.tsx:22`) y el
  audio no llega a ninguna parte. Con esta orden el dictado **deja de depender del chat**: la
  dependencia desaparece y el bug se va con ella. Las dos causas candidatas del aviso quedan igual
  anotadas en `SM-P12`, porque el guard sigue existiendo para otros caminos.
- **Inventario (la mitad A YA EXISTE — reutilizar, no diseñar):** backend
  `dictado_destinos.py:52` tiene los 5 destinos y su criterio escrito ES esta orden — «la tool del
  destino PROPONE (devuelve una card) y NO escribe ni emite» — con test adversarial
  (`tests/test_dictado_factura_no_emite.py`). En mobile el prellenado **sigue en el código** con sus
  comentarios vivos: `clientes/PantallaClientes.tsx:308` («alta con `nombre` prellenado, K-10,
  `/transcribir`, **sin sesión de chat**»), `ingresos/PantallaIngresos.tsx:187`,
  `presupuestos/PantallaPresupuestos.tsx:235`. `voz/DockFuncion.tsx:7` ya importa `transcribir`, y
  `DockAlChat` es un **envoltorio** sobre él (`DockAlChat.tsx:9` importa, `:55` monta). Las 5 montan
  hoy `DockAlChat`: `Gastos:285`, `Ingresos:272`, `Clientes:382`, `Presupuestos:313`,
  `Facturacion:709`. **La mitad A es quitar el envoltorio y volver a `/transcribir`: cambio de
  endpoint, no flujo nuevo.**
- **Lo único NUEVO es la mitad B** («al guardar, la actividad aparece en el chat»): **no existe en
  mobile**, medido con control positivo (10 archivos con `gasto` en ese módulo, así que el 0 es
  ausencia real). ⚠️ `gasto_propuesto` / `TarjetaGastoPropuesto` (`chat/ListaMensajes.tsx:49,394`) es
  la card que el **LLM propone dentro del chat**, NO «actividad guardada que aparece como turno»:
  `actividad` tiene **dos referentes** en este repo (ver `CONTEXT.md`) y colapsarlos acreditaría una
  cosa con la evidencia de la otra.
- **[ASSUMED_PENDING_VERIFY] de planificación, la cierra BACKEND antes de que frontend toque la
  mitad B:** ¿existe hoy una vía para insertar un turno en el hilo desde una escritura de negocio
  (`path:línea` o «no existe»)? ¿Endpoint nuevo o un `kind` de card nuevo? Y el aislamiento:
  `TenantCtx` per-request (regla 7) + **test adversarial** (ADR-013) — actor A no puede hacer
  aparecer una actividad en el hilo de B; sin ese test el control queda `[UNVERIFIED]` y bloquea el
  cierre.
- **DoD:**
  1. **mobile, mitad A:** las 5 funciones prellenan la card **en la propia pantalla** vía
     `/transcribir`; nada se manda al chat al dictar.
  2. **El test que acredita el fix:** dictado con el chat **SIN hidratar** → la card igual se
     prellena y `CHAT_NO_LISTO` **no** aparece. Sin este test la mitad A no está hecha.
  3. Nada se guarda ni se emite por dictar. **Cero facturas** en device.
  4. **web, mitad A:** las 5 (hoy prellena **sólo** Facturación, `useDictadoFactura`, 111 líneas) —
     reusando ese patrón, no cuatro hooks nuevos.
  5. **mitad B:** al guardar en cualquiera de las 5, la actividad aparece en el chat principal, con
     test y device, y con el `dato_` de backend contestado primero.
  6. Device con el usuario canónico. **La mitad A se puede acreditar TIPEANDO** —
     `voz/DockFuncion.test.tsx:64`: «escrito y dictado caen en el mismo camino» — así no se repite la
     receta de voz ni el bloque D, que el operador dio por cerrados el 2026-11-06.
- **No autoriza:** emitir ninguna factura (el gate de `FacturaWorkflow.confirmar` se queda donde
  está; el dictado jamás manda `confirmar`) · tocar `GROQ_STT_MODEL` · que una plataforma se alinee
  sola con la otra por su cuenta.

### SM-P20 · `sin-issue` — Agenda y tarjetas de Mi día alineadas al prototipo + el orden de «Para hoy»

- **Estado:** TERMINADO
- **Dueno-activo:** frontend1
- **Cierre:** DoD 5/5 @570e4153 (merge #1790, ancestro de origin/main; antes 568158a4 #1789, 4c5ae5f0 backend, 25371b4e la Agenda). p1 ORDEN en mi_dia_web.py con test de unidad y la app sin reordenar, mergeado @4c5ae5f0. p2 COTEJO prototipo vs app con captura de los dos lados: el lado prototipo lo tomo planificacion para no gastar device (mockups 09-mi-dia y 14-mi-dia-3v a 412x915 fullPage, servidos por HTTP desde Prototipo frontend/odobi-ui, guardados FUERA del repo publico en C:/gfw-src/release-apk/), el lado app lo tomo frontend1 en device (h2 Mi dia, h3 Agenda, mas su render a 2x). Coinciden en estructura: tarjeta «En caja», «Ahora» + «Ver agenda», «Para hoy N cosas» + «Ver tablero». p3 AGENDA con linea de tiempo por horas probada en device CON EVENTO REAL de Google Calendar (no fixture): «Agenda ... el 8 de noviembre de 2026 a las 10:00» -> card HITL -> Confirmar -> «Mañana domingo 8, 10:00», origen Google Calendar; el «no pude agendar» ya no aparece. Mas «Vencen esta semana» con el CAE de la factura N4 y el certificado de ARCA. p4 TARJETA DETECTADA con linea de detalle, en device, con el caso fabricado en el usuario canonico: presupuesto N66 (2026-09-23, pendiente) -> «El presupuesto 66 de Sonda N20 1a8fd lleva mas de 30 dias sin respuesta», chip «45 dias sin respuesta», expandida con «Mandarle un recordatorio» y las filas Cliente / Monto $70.000 / Enviado 23 de septiembre. p5 LAS DIFERENCIAS INTENCIONALES, QUE DECIDE PLANIFICACION, quedan escritas: (a) la pantalla de AGENDA no tiene lado prototipo porque el mockup 14 no trae una propia -- su referencia vinculante es prototipo/index.html?ver=agenda, que es otro archivo, y confundir los dos referentes de «el prototipo» es el modo de falla que esta ficha ya nombra en su punto 2; se coteja contra ?ver=agenda y el mockup no aplica. (b) la tarjeta «En caja» OSCURA sobre fondo claro es DISENO, no defecto de contraste: el prototipo la define asi a proposito como ancla visual de la portada. DEVICE devuelto a piel OSCURA al cerrar (Apariencia: Oscuro «Activo», verificado con captura) y el gasto de $1,11 sin tocar. DOS LIMITES QUE QUEDAN ESCRITOS Y NO SON PUNTOS DE ESTE DoD, con dueno: (i) el render de UBICACION que backend expuso en _eventos_de sigue sin verse con un evento que la traiga -- CREATE_EVENT no setea location y «Oficina Centro» queda dentro del titulo, asi que lo probado es que la Agenda no rompe SIN ubicacion, no que la muestre cuando la hay (memoria/verificar-una-propiedad-de-la-capa-no-verifica-que-sobre); dueno backend. (ii) el cotejo de la seccion WEB «Vencen esta semana» no tiene captura web: la mitad web esta mergeada @568154a4/#1789 y verificada por su test, pero el p2 de este DoD pide las DOS PANTALLAS de la app, no la web, asi que no lo retengo -- queda como deuda de registro, dueno frontend1. Ningun punto se cierra por autoevaluacion: cada uno cita device con usuario, fecha y hora, o un sha ancestro de main.
- **Dueño:** backend (el ORDEN) + frontend1 (Agenda y la línea de detalle de las tarjetas)
- **Origen:** `pedido_` de frontend1 a planificación del 2026-11-06, con capturas del prototipo y
  del teléfono que el operador le pasó. **Prioridad declarada en el propio pedido: DESPUÉS de
  `SM-P19`** (las 5 funciones). Planificación lo confirma: `SM-P19` no se interrumpe por esto.
- **POR QUÉ ENTRA AL BACKLOG Y NO SE QUEDA EN EL BUZÓN:** el pedido me pedía *decidir* el criterio
  de orden, y **la decisión del operador ya estaba escrita en el mismo archivo** — sección ✅,
  «críticas primero, luego por vencimiento». O sea que no faltaba una decisión: faltaba que el
  trabajo tuviera un **id que circule**. Es exactamente
  `memoria/el-registro-no-se-marcaba-porque-su-id-no-circulaba.md` (18 de 26 fichas jamás nombradas
  en 460 cierres) y `memoria/sesion-parada-la-respuesta-existe-pero-enterrada.md`.
- **Los tres frentes, con su dueño y lo medido:**
  1. **ORDEN de «Para hoy»** — decisión del operador (2026-11-06), textual: **críticas primero,
     luego por vencimiento.** Grupo 1 lo crítico (conexión caída, CAE/certificado por vencer,
     margen negativo); grupo 2 el resto por vencimiento más próximo; lo **sin fecha al final**, por
     antigüedad. **Ordena el BACKEND** (`mi_dia_web.py`) y la app consume el orden tal cual — un
     orden duplicado en los dos lados es el `memoria/dos-implementaciones-del-mismo-cliente...`
     garantizado. Medido por frontend1 (lectura de código): hoy **no existe tal orden** —
     `mi_dia_tarjeta_store.py:168` es `ORDER BY creada_en DESC`, `mi_dia_web.py:173-184` arma las
     solapas sin reordenar y `PantallaTuDia.tsx` no ordena. **Los datos YA están**:
     `mi_dia_presentacion.py:197` (`_por_vencer`) calcula los días al vencimiento y el detector sabe
     qué reglas son críticas. Es cablear lo que existe, no diseñarlo.
  2. **Agenda** — referencia **VINCULANTE**: `Prototipo frontend/odobi-ui/prototipo/index.html?ver=agenda`
     (⚠️ **no** el `mapa-pantallas`, que el propio pedido cita en un punto y es otro archivo: dos
     referentes para «el prototipo», y es el modo de falla que este sprint ya pagó). Línea de tiempo
     por horas (8:00–19:00), eventos como bloques de color con título y «lugar · Google Calendar»,
     línea de «ahora», «Hoy martes 18» con «+ Nuevo evento» a la derecha del título, más Mañana /
     Vencen esta semana / Sin hora. Hoy la app tiene botón ancho arriba y secciones de texto: **son
     dos diseños distintos**, medido contra captura del 2026-11-06 21:34.
  3. **Línea de detalle de las tarjetas** («31 días sin respuesta», «22 días impaga», «Lo anotaste
     vos»). **NO MEDIDO** ni en código ni en device — y se deja escrito así en vez de asumirlo.
- **El dato que explica la pantalla vacía, y que NO es un bug:** «Para hoy» es proactivo
  (`mi_dia_detector.py` evalúa reglas sobre los datos del usuario). El usuario de prueba **no tiene
  datos que disparen ninguna regla**, así que el teléfono muestra «Nada por acá» correctamente. Para
  acreditar los puntos 2 y 3 hace falta **fabricar** el caso «presupuesto sin respuesta» — si no, se
  va a medir un vacío y a leerlo como defecto
  (`memoria/dato-degenerado-imita-ausencia-del-mecanismo.md`).
- **🆕 CUARTO frente, medido por frontend1 el 2026-11-06 23:11 y que esta ficha NO tenía — es de
  BACKEND:** «Vencen esta semana» del prototipo **no son eventos de Calendar**: son vencimientos de
  Odobi (CAE, certificado). `leerAgenda` no los trae, así que hoy la app rellena ese bloque con el
  grupo `semana` de Google Calendar — **dos cosas distintas bajo el mismo título**, que es el modo de
  falla que `CONTEXT.md` nombra. Pide dato de backend, no maquetado. Lo mismo el **lugar del
  evento**: el subtítulo «lugar · Google Calendar» del prototipo no se puede armar porque
  `leerAgenda` no devuelve ubicación. **Ninguno de los dos lo puede resolver frontend1 sola.**
- **Lo medido en device y lo que NO** (frontend1, RF8T318RN9T, `e2e-device@copiloto.test`): la flecha
  de las tarjetas y la Agenda (rejilla 76 px/h, línea del ahora, encabezado, píldora) sí, a las 23:10
  y 23:11, **con eventos de PRUEBA inyectados por un fixture temporal revertido** — el calendario del
  usuario canónico está vacío, así que sin fixture sólo se ve «Nada por acá»
  (`memoria/dato-degenerado-imita-ausencia-del-mecanismo.md`). **Queda sin medir con un evento REAL**
  (fabricarlo pide HITL de `calendar_book`) y **la piel clara de Agenda**.
- **DoD (binario):**
  1. Backend ordena en `mi_dia_web.py` con el criterio de arriba, con test de unidad que fije el
     orden **y** el caso sin fecha al final; la app no reordena (verificado por grep, no por
     promesa).
  2. Cotejo punto por punto prototipo vs app de las dos pantallas, **captura de cada lado**.
  3. Agenda con línea de tiempo por horas, probada en device con eventos reales.
  4. Tarjetas con la línea de detalle, en device, con al menos una tarjeta **detectada** (dato
     fabricado del caso «presupuesto sin respuesta»).
  5. Si planificación decide que alguna diferencia es intencional, **queda escrito el porqué**.
- **No autoriza:** interrumpir `SM-P19` · emitir facturas · escribir en el tenant fiscal real del
  operador · fabricar datos en ese tenant (el caso de prueba va en el usuario canónico).

### SM-P21 · `sin-issue` — La latencia del chat: el lote está implementado y el «DESPUÉS» no está medido

- **Estado:** TERMINADO
- **Dueno-activo:** backend
- **Cierre:** TERMINADO @c01ae19e (merge de PR #1788 en origin/main), desplegado y verificado por EFECTO: el sitio sirve data-build-sha=c01ae19e y el E2E g6 de durabilidad en VERDE. DoD punto por punto: (1) LATENCIA MEJORADA Y MEDIDA, no estimada -- ANTES (eval_r3, flags OFF, 2026-11-06) p50 6,1 s / max 10,2 s y call_llm_tools prom 1,70 s / max 7,05 s; DESPUES p50 4,1-4,2 s y call_llm_tools prom 0,73 s / max 2,21 s; router_check 0 fallbacks. -31% en p50 y -57% en call_llm_tools. (2) SIN COSTO DE FIDELIDAD, sobre el MISMO conjunto de 20 casos (la asimetria 22-vs-20 quedo explicada: dos casos que el generador dejo de emitir porque su esperado derivaba de un estado que otras sesiones mutan): 19/20, con 0 montos inventados y 0 fugas cross-tenant. (3) LA REGRESION QUE SI ERA DEL FIX -- el caso «presupuestos de ClienteJ4», donde la respuesta directa contestaba la ficha generica y OMITIA el dato preguntado -- esta ARREGLADA y PASA: respuesta_directa devuelve None y cae al LLM cuando la pregunta pide un dato que la plantilla no cubre. POR QUE 19/20 Y NO 20/20, Y POR QUE NO BLOQUEA: el unico caso que cae es la trampa «causa» («por que bajaron mis ventas en octubre?»), donde la respuesta niega conocer la causa pero cita cifras REALES de septiembre y la regla exige cero montos. Ese caso NO lo introdujo este trabajo: ya fallaba en eval_r1 ANTES del fix, y en las 6 corridas medidas paso en 4 y fallo en 2 -- es variabilidad del camino LLM, que este fix no toca. Exigirle 20/20 seria medir a esta ficha contra un ANTES que nunca fue 20/20 estable, o sea subir el criterio despues de la medicion (DEC-18). Queda como ficha PROPIA: SM-P22, con dueno backend y un fix DETERMINISTA (negativa por codigo, sin montos) mas re-eval en dos corridas consecutivas, porque un defecto intermitente no se acredita con una sola verde. Decidido por planificacion, que es quien tiene el criterio; backend recomendo el fix y la recomendacion se acepta -- lo que NO se acepta es cobrarselo a esta ficha.
- **Dueño:** backend
- **Origen:** el operador se lo pidió a backend **directamente**, fuera de este backlog (2026-11-07). Entra acá por el motivo de siempre: sin un id que circule, el trabajo no se puede marcar ni medir — `memoria/el-registro-no-se-marcaba-porque-su-id-no-circulaba.md`.
- **POR QUÉ LA FICHA NACE DOD-PARCIAL Y NO TERMINADO:** el código viaja entero en el PR #1785 (`ea968c8b` UA de Groq · `19532049` respuesta directa · `0c39399f` + `9d2a69b4` long-poll), así que la parte de implementación está hecha. Pero el DoD de una ficha de LATENCIA es un número medido, y ese número no existe todavía. Marcar TERMINADO con la estimación sería exactamente `memoria/prometer-no-es-ejecutar-el-gate-media-la-palabra.md`: la mejora está prometida por el diseño, no acreditada por el instrumento. **Lo dijo backend antes que yo** («el “después” todavía NO está medido… no lo des por evidencia»), y se registra con su nombre.
- **El DoD, textual de quien lo va a medir:**
  1. **Qué mide:** el tiempo desde `POST /chat` hasta que la respuesta aparece en `GET /reply`, **por turno**.
  2. **Instrumento:** `latencia.py` contra prod con el usuario canónico `e2e-device@copiloto.test`, corrido **antes y después** de prender los flags.
  3. **Evidencia que cierra:** el par antes/después con los dos números y la fecha de cada corrida. Un solo número no cierra: sin el «antes» no hay delta, y el «antes» ya corrido con otro código no es comparable (`memoria/el-instrumento-versionado-difiere-por-rama.md`).
- **No autoriza:** emitir facturas · escribir en el tenant fiscal real del operador · dar por buena la estimación como si fuera medición.
- **Deuda COLATERAL con dueño, anotada acá para que no quede sólo en un peer:** Graphity **no suma nada hoy** porque `memory=False` en prod (`web.py:919`), pero el `warm` está con `await` **antes del primer turno** (`conversation_workflow.py:170`) y bloquearía ~8 s en frío **cuando se reactive**. O sea: es una regresión de latencia **latente**, invisible mientras el flag esté apagado, y que va a aparecer el día que alguien prenda la memoria sin acordarse de esto. Dueño: backend. Disparador: reactivar `memory`. Es el patrón `memoria/un-disparador-cumplido-no-avisa-a-nadie.md`, y por eso se escribe en el registro versionado y no en el buzón.

### SM-P22 · `sin-issue` — La trampa «causa» trae montos reales: variabilidad del camino LLM, no regresion

- **Estado:** TERMINADO
- **Dueno-activo:** backend
- **Cierre:** DoD 2/2 @3b9ecc25 (merge del #1791 en origin/main, verificado ancestro por planificacion con git merge-base, no por el asunto del archivo de cierre). p1 LA REGLA de la trampa «causa», con el criterio que eligio el operador (opcion b): los montos REALES se permiten, los inventados siguen fallando, y se exige negar la causa -- scripts/eval_inteligencia/eval_fidelidad.py en main; control local de backend: monto real -> fallas=[], inventado -> inventados=[50000], sin negativa -> «no nego explicitamente». p2 DOS CORRIDAS CONSECUTIVAS con el instrumento TAL CUAL esta en origin/main (extraido con git show origin/main:..., 22 casos), contra prod, usuario e2e-device, 2026-11-07: corrida 1 = 22/22, corrida 2 = 22/22; en las dos 0 inventados, 0 fugas cross-tenant, 0 sin medir; p50 5,0 s / max 11,2 s y p50 4,6 s / max 8,7 s. POR QUE DOS Y NO UNA, que es el punto entero de esta ficha: el caso «causa» fallaba 2 de 6 corridas ANTES del fix, asi que un solo verde no distingue el fix de la suerte -- un instrumento intermitente fabrica la excusa «es el flake» y lava el proximo rojo. POR QUE EXIGI EL INSTRUMENTO DE MAIN: la copia con la que se acredito SM-P21 DIVERGIA de la de main (6 lineas de mas, 8 de menos; main tiene los casos 324 y 225 y una cifra de Kiosco Don Ramon que la copia no tenia), o sea que «los mismos 20 casos» era una variante de corpus que NO EXISTE EN NINGUN COMMIT -- citaba un path real, el gate la aceptaba, y no la podia reproducir nadie. Es tambien la explicacion verdadera del 22-vs-20 que perseguimos: el diff existia, pero se corria otra copia. verdad.json regenerada con verdad_sql.py de main @3b9ecc25 (SQL en el VPS, env del worker). SALVEDAD ESCRITA, que no es punto de este DoD: la clave clientes_ajenos (1 nombre) se heredo del verdad.json anterior porque backend no recupero los ids de tenant ajeno de la corrida original; el resto de las claves es fresco -- queda dicho en vez de implicito en un verde. Y la deuda de latencia.py quedo CERRADA: entro versionado en el mismo #1791, asi que el p50 -31% y el call_llm_tools -57% de SM-P21 ya son reproducibles por cualquiera.
- **Origen:** hallazgo de backend al re-evaluar SM-P21 el 2026-11-07 @c01ae19e. NO es un defecto
  introducido por el fix de respuesta directa, y por eso NO bloquea SM-P21: la misma pregunta
  «por que bajaron mis ventas en octubre?» ya fallaba en eval_r1, ANTES del fix. En 6 corridas
  medidas paso en 4 y fallo en 2 (r1 y la de hoy) — es variabilidad del camino LLM.
- **El defecto:** la respuesta niega conocer la causa (correcto) pero cita cifras REALES de
  septiembre ($165.000), y la regla de esa trampa exige cero montos. No inventa: trae un dato
  verdadero que no se pidio.
- **DoD:**
  **DoD RE-REDACTADO el 2026-11-07.** La decision del operador (2026-11-07) fue la (b), no la (a):
  el fix determinista que este DoD pedia queda RETIRADO, y lo que se corrige es la REGLA del
  instrumento, no el codigo del producto. En la trampa «causa» los montos REALES VALEN; sigue
  siendo falla el monto INVENTADO (ya lo mide el chequeo propio de inventados) y se EXIGE que la
  respuesta niegue la causa de forma explicita. Backend ya lo aplico en eval_fidelidad.py y de paso
  lo endurecio de un lado -- antes esa trampa no exigia la negativa y ahora si -- mas el regex de
  negativas con «no permite(n) saber/explicar». NO HAY CODIGO DE PRODUCTO QUE TOCAR.
  1. La regla nueva aplicada en eval_fidelidad.py, con la negativa explicita exigida. [HECHO,
     pendiente de citar el sha cuando mergee]
  2. 20/20 sobre los MISMOS 20 casos en DOS corridas CONSECUTIVAS. Esta parte NO se relaja: el caso
     fallaba 2 de 6 veces, y una sola corrida verde de un defecto intermitente no distingue el fix
     de la suerte. Si alguna de las dos no da 20/20, el hallazgo no era el de la regla y se reabre.
  - **Nota de por que esta ficha existe y no se borro:** el caso rojo salio de SM-P21 para no
    subirle el criterio despues de medir (DEC-18); se le dio ficha y dueno propios; y ahi el
    operador lo resolvio un nivel mas arriba, en la regla. Ese recorrido es el registro. Lo que
    evito es el modo de falla conocido: un caso que YA fallaba antes del fix cobrandose dentro de la
    ficha de latencia, que entonces no cerraba nunca.
  - **Lo que casi hago mal:** marque esta ficha CERRADO-POR-DECISION, y el gate la rechazo por
    faltarle el campo Decision:. Tenia razon dos veces -- ademas del campo, el estado era el
    equivocado: cerrarla habria borrado el punto 2, que sigue vivo. Una decision que cambia el COMO
    no cierra la ficha.

### SM-P23 · `sin-issue` — La negrita de Markdown llegaba CRUDA a la burbuja del asistente

- **Estado:** TERMINADO
- **Dueno-activo:** frontend1
- **Cierre:** DoD 3/3. p1 y p2 @41cf2440 (merge #1792, CI 6/6): una sola definicion de segmentarNegrita en packages/core/src/chat/negrita.ts -- verificado por CONTEO DE DEFINICIONES en origin/main (1), no por conteo de usos -- consumida por Burbuja.tsx (mobile) y Bubble.tsx (web), con control explicito de que el texto del emprendedor queda literal. p3 EN DEVICE (frontend1, Samsung RF8T318RN9T, e2e-device@copiloto.test, Metro sirviendo la rama con el fix, 2026-11-07 01:59): DOS burbujas reales del asistente, ambas sin asterisco y con el tramo en negrita -- una respuesta nueva y una historica con 2 tramos -- mas el control de que sus propios mensajes quedan literales. Captura n4.png fuera del repo publico. El verde final NO fue el primer verde: hubo un rojo real por m[1] undefined, corregido en 3e68a41a, y queda escrito en vez de desaparecer detras del tilde.
- **Origen:** hallazgo de planificacion durante la verificacion de SM-P19/SM-P20. Se registro con
  dueno y a proposito NO se metio en la cola viva de frontend1 para no interrumpir el punto 4 de
  SM-P20; lo tomo ella sola al quedarse sin items, que es el uso correcto de un id registrado.
- **POR QUE TIENE ID:** un trabajo sin id no circula y entonces no se marca nunca. Es
  `memoria/el-registro-no-se-marcaba-porque-su-id-no-circulaba.md` — 18 de 26 fichas jamas nombradas
  en 460 cierres, no por descuido al marcar sino porque el id no entraba al circuito de cierre.
- **Lo hecho (frontend1), @41cf2440 (merge #1792, CI 6/6: core mobile web backend lint drift):**
  `segmentarNegrita` en `packages/core/src/chat/negrita.ts` con 5/5 vitest y tsc limpio; `Burbuja.tsx`
  en mobile con 2 tests nuevos (suite 8/8 jest local) y `Bubble.tsx` en web con 1 test nuevo.
  El fix es de RAIZ y en la capa compartida: una sola funcion de core que consumen las DOS vistas, no
  dos parseos paralelos — que es el defecto que `memoria/dos-implementaciones-del-mismo-cliente...`
  describe y que este repo ya pago.
- **El detalle que vale guardar:** la primera corrida de CI salio ROJA por `m[1]` undefined y se
  corrigio en `3e68a41a`. O sea que el verde final no fue el primer verde: hubo un rojo real en el
  medio, y queda escrito en vez de desaparecer detras del tilde.
- **DoD (binario):**
  1. Una sola implementacion del parseo, en core, consumida por mobile y por web (verificado por
     conteo de definiciones, no de usos). ✅ @41cf2440
  2. El texto del EMPRENDEDOR queda literal: sus asteriscos no se interpretan. ✅ control explicito
     en los tests de las dos vistas.
  3. La burbuja del asistente con `**...**` vista en device. ✅ frontend1, 2026-11-07 01:59,
     Samsung RF8T318RN9T, dos burbujas reales.
- **No autoriza:** tocar el tenant fiscal real · emitir facturas · instalar el APK sin avisar al
  operador.
