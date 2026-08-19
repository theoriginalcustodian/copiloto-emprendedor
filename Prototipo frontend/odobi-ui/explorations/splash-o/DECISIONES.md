# DECISIONES — Exploración splash "la O entra"

Piezas: `index.html` (v1, capas circulares + wordmark) · `v2-inmersivo.html` (v2 rev.2, formas que nacen del centro → la O). **Vigente: v2 rev.2.**
Port a Rive: artboard `Splash` 390×844, timeline `splash` 415 frames @60fps (6,84 s), one-shot, `Entry → splash`.

---

## 1 · Cuándo se ve esta pantalla (decisión Martin 29/07)

| Elemento | Decisión | Fundamento | Alternativa descartada |
|---|---|---|---|
| Frecuencia del splash largo | **Solo primer ingreso y post-logout.** No es splash de cada arranque. | Un splash es tolerable en proporción inversa a cuántas veces se ve. A 6,84 s sólo cierra si se ve una vez en la vida de la cuenta; Nielsen sobre tiempos de respuesta: >1 s ya rompe el flujo, >10 s pierde la atención. Como pieza de bienvenida no compite con una tarea del usuario: no hay nada que interrumpir todavía. | Splash en cada launch. Descartado: obliga a bajar la pieza a ~1,2 s (pierde el motor de 4 formas) y a la tercera vez el usuario lo odia — costo recurrente sin beneficio recurrente. |
| Duración 6,84 s | **Se acepta**, habilitada por la decisión de arriba. | Calmo + Densa (Martin 29/07). El presupuesto de tiempo se gasta una sola vez y compra la identidad completa: paleta, familia de formas, wordmark, promesa. | Recortar a 3 s. Descartado: con Ágil la pieza se lee apurada y las 4 formas no alcanzan a leerse como familia. |
| Arranques 2..n | **Entrada corta propia, no esta animación acelerada.** Abre en Mi día. | Son dos problemas distintos: el splash construye identidad (se ve una vez), la entrada corta sólo cubre la latencia de carga (se ve siempre). Reusar el mismo motor a 6× de velocidad daría una pieza nerviosa que no es ninguna de las dos. | Reproducir el splash a velocidad alta. Descartado: mismo material, lectura opuesta. |
| Contenido de la entrada corta | **La O de Odobi en NeueEinstellung Bold, quieta, + tres ondas concéntricas que se disipan hacia afuera** (decisión Martin 29/07). ⚠️ **En Rive son ARCOS (±35°→±30°), no circunferencias — ver §6.3.** | La O sola ya es la marca: es el mismo signo que el splash deja plantado, así que la entrada diaria lo reencuentra en vez de presentar algo nuevo. Las ondas dicen "escucha" sin dibujar un ícono de micrófono. | Monograma dibujado (círculo stroke 2,3 + 3 barras latiendo) de la rev.3. **Descartado por Martin:** el círculo dibujado compite con la O tipográfica en vez de ser la O. |
| El degradé de las ondas | **Un solo `radialGradient` en arena, `userSpaceOnUse`, centrado en la O**; se anima el **radio** de cada onda, no un `scale`. | Las ondas no llevan opacidad propia decreciente: al crecer atraviesan zonas cada vez más tenues del mismo campo y se apagan solas. Con `transform: scale` el gradiente viaja pegado a la onda y no hay disipación ninguna — el efecto depende de que la geometría se mueva y el campo quede fijo. | Opacidad animada por onda: simula el resultado pero cada onda se apaga con su propia curva y se pierde el campo común. |
| Timing de la entrada corta | ⚠️ **DEROGADO 06/08 — hoy son 1,5 s PROVISORIOS, ver §6.4.** El texto que sigue es el razonamiento del 29/07, que se conserva porque su argumento (latencia) sigue siendo el criterio para cerrar el número. — **420 ms** (Martin 29/07: "menor latencia"). Ondas r 44→96, 260 ms cada una, escalonadas 20/85/150 ms; la O entra en 160 ms. | Bajó desde 700 ms **sin sacar ninguna onda**: se acortó el recorrido y se apretó el escalonado. Lo que hace legible la disipación es atravesar el degradé, no el tiempo que tarda — al recortar el viaje, el punto donde el campo se apaga sigue cayendo dentro. La última onda cierra a 410 ms y el fade de salida arranca a 361: nada queda cortado. | 700 ms (rev.4): se sentía lenta para algo que se ve todos los días. Próximo escalón si hace falta: 300 ms con **dos** ondas — por debajo de eso la tercera no nace y hay que sacarla explícitamente. |
| Color en la entrada corta | **O en terracota `#DE7250`**, ondas en **arena `#E8A088`**. | La O es el wordmark: logotipos exentos (WCAG 1.4.3, decisión Martin 22/07), misma vía que la O del splash. Las ondas son decoración sin carga informativa — no les aplica 1.4.11, y su bajo contraste es el punto: se están disipando. | O en negro estructura (para no gastar terracota fuera de lo tocable). Descartado: la regla B lista el wordmark entre los usos válidos de terracota, y esta O **es** el wordmark. |
| Aterrizaje | **Cambia de destino según el caso.** Primer ingreso → "Empecemos" / "Crear una nueva cuenta" (es el 01-onboarding). Post-logout → "Entrar" / "Entrar con otra cuenta", y el ghost pierde fondo y borde (pasa a `#B04A2E`, 4,91:1 ✅). | Mismo motor de formas, aterrizaje distinto. El splash termina siendo la pantalla de arranque (no hay corte entre animación y UI), así que el estado de sesión define qué UI aterriza. En post-logout la segunda opción es una salida, no una segunda puerta: no debe pesar lo mismo que "Entrar". | Un solo aterrizaje con los dos botones siempre. Descartado: ofrecerle "Crear una nueva cuenta" a alguien que acaba de cerrar sesión es ruido y sugiere que perdió la cuenta. |

---

## 2 · Motion (spec cerrada — resumen; el detalle vive en el `<div class="spec">` del HTML)

| Elemento | Decisión | Fundamento | Alternativa descartada |
|---|---|---|---|
| Cantidad de formas | 4 | Con 5 la pieza se estiraba (Martin 29/07). | 5 formas. |
| Familia | Circular homogénea, ninguna idéntica: festoneada 12 lóbulos · squircle r 34% · superelipse asimétrica · huevo | Familia = sistema, no repetición. Rotaciones distintas (−26° a +34°): ninguna repite el gesto. | Formas idénticas en distinto color: lee como plantilla. |
| Tempo | **Calmo**: grow 1900 · colapso 1450 · settle 780 · stagger letras 150 · rebote 720 | Elegido contra los otros 3 en el prototipo (Martin 29/07). | Ágil / Sereno / Cine — quedan en el prototipo sólo como comparación. |
| Aparición | **Densa** (ratio .20 del grow → 380 ms) | Ninguna forma espera a que salga la anterior. El stagger es fracción del grow, así el solape no cambia si se toca el ritmo. | Encadenada (.44) / Solapada (.30). |
| El giro | La 4ª no se contrae al centro de la pantalla: se contrae **hacia el lugar exacto donde va la O** en el lockup. | La forma trae la letra: el wordmark no "aparece", llega. Evita el salto de la O reposicionándose después. | Colapso al centro + la O se corre después: dos movimientos donde alcanza uno. |
| d·o·b·i | Entran de la derecha con rebote, en orden de lectura, con stagger | Orden de lectura = orden de escritura del nombre. | Fade simultáneo: pierde el gesto de "se escribe". |
| Fondo final | Degradé vertical `#FFFFFF`→`#F7F3EC` en capa **sin escalar**, entra mientras la terracota tapa todo | Si fuera el fill de una forma a scale 7,8, en pantalla se vería un solo tono. El cambio de fondo nunca se ve. | Fill de la forma. |
| Reduced motion | Sin formas ni crecimientos; wordmark quieto desde el frame 1 | WCAG 2.3.3 / `prefers-reduced-motion`. | — |
| Terracota plena en pantalla | **Excepción declarada**: pieza display, no UI operativa | CLAUDE.md §Proporción 60/30/10 lo habilita para splash/celebración/onboarding-reveal. | — |
| Wordmark en `#DE7250` s/crema | Permitido: logotipos exentos WCAG 1.4.3 (decisión Martin 22/07) | Único elemento con significado; las formas son decoración sin carga informativa (no aplica 1.4.11). | `#B04A2E`: correcto para texto, innecesario para el logotipo. |

---

## 3 · Deuda abierta

| Qué | Estado | Nota |
|---|---|---|
| Botones del aterrizaje | ✅ **CERRADO** (Martin 29/07, rev.3) | Se cae la excepción de Inter Medium 16. Aplica la regla dura del 28/07 v2: fill `#DE7250` + **DISPLAY 20 Bold blanco** = 3,17:1 → AA texto grande ✅, la misma vía que "Cortar" en la escucha. No se abre precedente para Inter 16 sobre terracota. Ghost: Inter Medium 16 s/blanco, 16,37:1 ✅. |
| Bug de replay | ✅ Corregido en rev.3 | `play()` no limpiaba `st-final`: al reproducir de nuevo el lockup arrancaba ya subido 96px y el aterrizaje no se veía. |
| Timings vs 60FPS MCP | `TODO motion-ref` | El MCP no respondió el 29/07. Los timings salieron de iteración en el prototipo, no de referencia validada. |
| Licencia NeueEinstellung | Pendiente | Web/app embedding sin verificar. Uso local en mockups OK. |

---

## 4 · Port a Rive (29/07)

| Elemento | Decisión | Fundamento | Alternativa descartada |
|---|---|---|---|
| Wordmark | **Glifos extraídos como paths** (2 contornos c/u; el interior se resta con `isHole`, ver §5). ⚠️ **Desde el 07/08 salen de `PlusJakartaSans-Bold.ttf`, no de NeueEinstellung — ver §7.** | No hay asset de fuente en el archivo Rive y el MCP no importa OTF. Para un logotipo, outline es lo correcto igual: es marca, no texto — no se relee ni se traduce. Cada letra queda como shape independiente, que es justo lo que pide el stagger. | Rive Text + asset de fuente: agrega dependencia de licencia embebida para 5 glifos fijos. |
| Posición de la O | `x = 97,32` (−97,68 del centro) | Métrica medida sobre la fuente, no estimada: `dobi` = 195,36px @96px → `−(ancho dobi)/2`. Idéntico al `translateX` que el HTML calcula en runtime. | Ojímetro. |
| Rebote de las letras | Overshoot con keyframe intermedio (−6,5px pasado el target) | El cubic de Rive limita `y` a [−1,1] y `cubic-bezier(.24,1.62,.4,1)` necesita 1,62: la curva del HTML no es expresable. El overshoot explícito reproduce el gesto con curvas nativas. | Interpolación elastic de Rive: rebota, pero con otro carácter (oscila de más). |
| Pop de la O (scale 1,06→1) | **Omitido** | El origen del shape está en la baseline del glifo, no en su centro: escalar lo desplazaría ~4,6px. El crossfade de opacidad ya hace el trabajo del "se posa". | Compensar con keyframes de x/y: tres propiedades para un detalle de 6%. |
| Gradientes (3) | ✅ **HECHOS 06/08 por MCP** (ver §6). Ya no son sólidos aproximados. | El 29/07 el MCP no creaba gradientes y se pusieron tonos medios (squircle `#E08363`, huevo `#CA5E3F`, fondo `#FCF9F4`) con la deuda anotada. El MCP se actualizó: `path_editor.setPaints` acepta `gradient`. | Dejarlos sólidos: pierde la "sombra de un color" que distingue la paleta de un flat plano. |
| Tagline y botones | **Fuera del artboard** | Texto de UI outlineado es peor que texto real: no es accesible ni localizable. El Rive entrega hasta el lockup arriba; de ahí sigue la UI de la app. Además no hay asset de Inter en el repo. | Outlinear el copy: rompe accesibilidad por comodidad de build. |
| Rotación en grados | ✅ **CONFIRMADO 06/08** — el MCP toma grados | Se asumió por consistencia con `cornerRadius` en px e `innerRadius` en % 0–100 en la misma API, y quedó verificado: Martin reprodujo `Splash` y las formas giran lo esperado. No eran radianes. | — |

---

## 5 · Contrapunzones del wordmark (bug encontrado y corregido 06/08/2026)

Al reproducir el `Splash` por primera vez con la animación ya montada, Martin vio el lockup con **las letras macizas**: la O, la o, la d y la b sin su agujero interior. El §4 daba por hecho que "nonZero corta el contrapunzón" — no lo cortaba.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Causa | Cada `letra-*` es un **Shape con 2 `PointsPath` + 1 `Fill`**. Los paths interiores ya venían con `isclockwise = true` (bobinado opuesto al exterior, que es lo correcto) pero con **`isHole = false`** | La geometría extraída del OTF estaba bien: lo que faltaba era la marca de resta. Rive no deduce el agujero del sentido de bobinado — hay que declararlo por path | "El OTF exportó mal, hay que reimportar": habría rehecho 5 shapes y perdido los keyframes del stagger, cuando el arreglo era un booleano |
| Fix | `isHole` (property key **770**) = `true` en los 5 paths interiores: `0-70` (O), `0-88` (d), `0-101` (o), `0-119` (b) del `Splash`, y `0-360` de `letra-O-entrada` en `Entrada` | Es exactamente el checkbox **`Subtract Path`** del inspector. Se aplica al path, no al Shape: el `Fill` vive en el Shape y los paths se rasterizan juntos con él | Pintar el contrapunzón de blanco: se rompe sobre fondo oscuro y sobre la forma que entra detrás. El agujero tiene que ser agujero |
| `letra-i` intacta | No se toca: sus dos paths tienen `isclockwise = false` | Asta + punto, dos formas reales, ningún contrapunzón. Quedó excluida **por dato, no a ojo** — `isclockwise` es la señal que distingue un contrapunzón de una forma real, y sirve para verificar en vez de suponer | Tildar `isHole` en las 5 letras "por las dudas": le habría comido el punto a la i |
| `Entrada` revisada | Mismo bug, mismo fix (`0-360`) | La O de la entrada sale del mismo glifo del mismo OTF: si el `Splash` lo tenía, la `Entrada` también. Verificado antes de tocar, no asumido | Corregir solo lo que se ve en la captura: el bug queda vivo en el artboard que se ve 20+ veces por día |
| `Problems 1` | Resuelto: borrado un `DrawRules` (`0-451`) con `drawtargetid = "0-0"` (target nulo) que colgaba de `0-70`, más un `SemanticData` vacío (`0-450`) del mismo path | Un Draw Rule sobre un **path** es inerte: el drawable es el Shape, sus paths no tienen orden propio. Y el `SemanticData` tenía `role = None` y todos los campos vacíos — metadata de accesibilidad sobre el agujero de una letra. Los dos eran clics de más | Dejarlos: no rompen nada, pero dejan `Problems` encendido y hacen ruido cuando aparezca un problema real |

**Nota de método:** `computedwidth`/`computedheight` devuelven `0.0` en estos paths — no sirven para distinguir el contorno interior del exterior. `isclockwise` sí.

---

## 6 · Sesión 06/08/2026 — gradientes, rotaciones, arcos y timing

Cuatro cambios en el archivo Rive. Los dos primeros son correcciones (el archivo no hacía lo que el documento decía); los dos últimos **derogan decisiones tomadas el 29/07** y quedan anotados como tales.

### 6.1 · Rotaciones: estaban 57,3× pasadas (corregido)

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| El bug | El §4 daba la rotación por "asumido: grados", y el 06/08 se cerró como confirmado tras un play a ojo. **Las dos veces estaba mal.** Los keyframes guardaban `458.366`, `-1489.690`, `572.958`… — exactamente los valores de la spec **× 180/π**. El MCP tomó los `8`, `−26`, `34` como **radianes**. | La forma festoneada daba 4,1 vueltas en 1,9 s en vez de girar 26°. No se detectó a ojo porque son manchas casi radiales que además escalan y hacen crossfade: el giro de más no lee como error. | Confiar en la inspección visual. El dato estaba a una llamada de `queryKeyFrames`: cuando un valor se puede medir, no se mira. |
| El fix | Los 11 keyframes de `r` reescritos a los valores del prototipo: festoneada 8 → −26, squircle −12 → 34, superelipse −6 → 22, huevo 10 → −16 → 0. | Coinciden exacto con los `--r0/--r1` de `v2-inmersivo.html`. | — |
| Unidades | **`set_property_values` toma radianes para `r` de shapes; `query_property_values` devuelve grados.** Las rotaciones de vértice (`outrotation`/`inrotation`) sí van y vuelven en grados. | Verificado en los dos sentidos: se escribió `55` en un vértice y se leyó `54,9996`. La asimetría es del MCP, no del archivo. | — |

### 6.2 · Los 4 gradientes (hechos por MCP)

El MCP se actualizó desde el 29/07: `path_editor.setPaints` acepta `gradient`. Cayó la deuda "a mano en el inspector".

| Gradiente | Valor | Nota |
|---|---|---|
| `forma-2-squircle` | linear 160°, `#E8A088` → `#DE7250` | Ángulo CSS convertido a start/end en espacio local (caja 220×220 centrada en 0,0): largo de la línea de gradiente `\|W·sin A\| + \|H·cos A\|`. |
| `forma-4-huevo` | linear 155°, `#DE7250` → `#B04A2E` | Ídem. |
| Fondo (artboard) | linear vertical, `#FFFFFF` → `#F7F3EC` | Espacio local del artboard: origen arriba-izquierda (`ox/oy = 0`), 390×844. |
| 3 ondas de `Entrada` | radial r=106 centrado en (0,0), arena `.90 / .46 / .17 / 0` | Es el único que cambia comportamiento, no estética: reproduce el `radialGradient` `userSpaceOnUse` del HTML. |

Ningún `Fill`/`Stroke` tenía keyframes de color (verificado antes de convertir), así que pasar de sólido a gradiente no destruyó nada.

**Corrección de paso (06/08):** `forma-3-superelipse` estaba en crema `#F7F3EC` y el prototipo la tiene en **blanco puro `#FFFFFF`** — arrastre del port, no decisión. Corregida. Importa más de lo que parece ahora que el fondo es un gradiente blanco→crema: la forma blanca se funde arriba y se recorta abajo, que es el efecto del prototipo. En crema quedaba casi invisible sobre la mitad inferior del fondo. Con esto las 4 formas del `Splash` coinciden exacto con `v2-inmersivo.html`.

### 6.3 · La `Entrada` pasa de circunferencias a ARCOS (deroga la geometría del 29/07)

Martin, al verla: *"la onda expansiva ocupa toda la circunferencia de la O, y en el isotipo que ya definimos ocupa solo una porción"*. Tenía razón: el port a Rive usó elipses de 360°, que no son el signo.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| La forma | **Arcos abiertos hacia la derecha**, no circunferencias. Nacen con **±35°** (70°) y mueren con **±30°** (60°). | Geometría tomada del canon vigente (`mockups/09-mi-dia/index.html`): arco interno r 11,5 a ±35° trazo 1,6; externo r 15,0 a ±30° trazo 1,1. La regla implícita del isotipo es que **el arco se angosta y adelgaza al alejarse** — acá se vuelve movimiento: antes solo adelgazaba (2,4 → 1,1), ahora además se cierra. | Dejar las circunferencias: son otro signo. El monograma rev. 29/07 es "la O con las ondas afuera", no "la O con anillos". |
| Implementación | `PointsPath` de **2 vértices cúbicos** por onda; se animan `x`, `y`, `in/outrotation` e `in/outdistance`. Las 3 elipses paramétricas se borraron. | No se pudo usar Trim Path (el `Stroke` no lo trae y el MCP no lo crea), y **escalar el shape estaba prohibido**: el degradé radial viajaría con la onda y se perdería la disipación de 6.2. Animar geometría era la única vía que conserva las dos cosas. | Trim path: no disponible. `scale`: mata el efecto que acabábamos de portar. |
| Detalle | `isclosed` venía en `true` al crear el path por comandos → Rive cerraba el arco con una cuerda recta. Puesto en `false` en los 3. Caps en `round`. | Coincide con el `stroke-linecap="round"` del canon. | — |
| Cantidad | **Se mantienen 3 ondas**, aunque el isotipo estático tiene 2 arcos. | Son piezas distintas: una es signo fijo, la otra un pulso escalonado. Bajar a 2 cambiaría un ritmo ya cerrado. | Reducir a 2 por coherencia literal con el isotipo: coherencia de inventario, no de lectura. |

### 6.4 · Timing: 420 ms → **1,5 s PROVISORIO** (deroga el timing del 29/07)

⚠️ **Valor provisorio, no cerrado.** Decisión de Martin el 06/08 tras verla en Rive: *"todavía se me hace corta"*, tres veces seguidas (420 → 600 → 700 → 1500 ms).

| Elemento | Estado | Fundamento |
|---|---|---|
| Duración | **90 frames @60fps = 1,5 s** | Ondas de 833 ms, escalonadas cada 300 ms (antes 267 ms / 67 ms). La O entra en 367 ms y sale en f84→f88. |
| Qué deroga | El **420 ms** del §1 y su argumento *"menor latencia"* (Martin 29/07), más la nota de que el próximo escalón era bajar a 300 ms. Es **3,5×** el valor anterior. | Cambió el contenido: un arco de 70° recorre mucho menos camino visual que una circunferencia entera en el mismo tiempo, así que el mismo reloj se lee más apurado. |
| **Por qué queda PROVISORIO** | **Nadie midió cuánto tarda Mi día en cargar de verdad.** Esta pieza no es decorativa: su función es **cubrir la latencia de arranque** (§1). Si la app carga en 400 ms, 1,5 s son ~1,1 s de espera **fabricada** en cada arranque — la pieza dejaría de cubrir latencia para inventarla, y se ve 20+ veces por día. | La duración correcta la fija el tiempo de carga real, que es un dato de ingeniería, no de diseño. |
| Cómo cerrarlo | Medir el arranque real de Mi día y ajustar a ese número. Si sobra tiempo de animación, el camino es **estirar el recorrido** (hoy r 44→96; podría llegar a r 110–120) en vez de estirar el reloj: se lee más viaje sin agregar espera. | — |
| Riesgo asumido | Martin decidió con la advertencia sobre la mesa y la reafirmó. Queda registrado para que el número no se lea como validado. | — |

| Orden de dibujo | Fijado explícito (`sendToFront` en orden de nacimiento) | No depender del orden de creación. | — |

### Artboard `Entrada` (arranques 2..n) — 390×844, timeline `entrada` 26 frames @60fps (0,43 s), one-shot

| Elemento | Decisión | Fundamento | Alternativa descartada |
|---|---|---|---|
| Las 3 ondas | Elipses paramétricas 88×88 con **stroke**, sin fill. Se animan `width`/`height` 88→192 y `thickness` 2,4→1,1. | En Rive el radio de una elipse *son* width/height: es la propiedad nativa, no un truco. Mismo razonamiento que en el HTML (animar geometría, no `scale`). Escalonadas f1/f5/f9, 16 frames cada una. | Animar `sx/sy`: escalaría también el grosor del trazo y la onda no se gastaría al alejarse. |
| La O | Glifo real del OTF como path, con el **origen del shape en el centro óptico de la tinta** (coordenadas ya trasladadas −38,448/+33,6 y escaladas a 80px). | Con el origen en el centro, el escalón de entrada .94→1 escala desde el medio y la O no se desplaza. Es el arreglo del problema que en el artboard `Splash` obligó a omitir el pop de la O. | Origen en la baseline del glifo (como en el wordmark del `Splash`): el escalón la correría ~2px. |
| Degradé de las ondas | ✅ **PORTADO 06/08 por MCP** (ver §6): radial en arena centrado en la O, stops `.90 / .46 / .17 / 0` en 0 / 42 / 72 / 100. | El campo queda fijo en el espacio local de cada onda mientras se anima la geometría, así que al crecer atraviesan zonas más tenues y se disipan solas — que era exactamente el motivo de animar radio y no `scale`. | Dejarlo sólido sin rampa: las ondas se cortarían de golpe en el borde. |
| Tres artboards vs uno | Dos: `Splash` (caso largo) y `Entrada` (arranques 2..n). Primer ingreso y post-logout comparten `Splash`. | Los dos casos largos difieren sólo en el aterrizaje, y el aterrizaje es UI de la app, no del artboard. Duplicar el motor de formas para cambiar dos labels sería duplicar 98 keyframes. | Un artboard por caso: tres copias del mismo motor divergiendo con cada retoque. |

---

## 7 · Migración del wordmark a Plus Jakarta Sans (07/08/2026)

Los 5 glifos del `Splash` y la O de `Entrada` se rehicieron con **Plus Jakarta Sans Bold**, que reemplaza a NeueEinstellung (licencia de app: USD 375/año — ver `../tipografia-libre/DECISIONES.md`).

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Método | **Reemplazar los `PointsPath` dentro de cada Shape existente**, no recrear los Shapes | Los keyframes viven en el **Shape** (`x`, `y`, `opacity`), no en sus paths: cambiándole los hijos, el stagger y los rebotes sobreviven intactos | Borrar y recrear las 5 letras: se perdían 30+ keyframes y había que rehacer el timing a mano |
| Curvas | Las cuádricas del TTF se convierten a **cúbicas** antes de mandarlas | `path_editor` acepta `moveTo/lineTo/cubicTo/close` — no hay comando cuadrático. Conversión exacta: `C1 = P0 + ⅔(Q−P0)`, `C2 = P2 + ⅔(Q−P2)`, sin pérdida | Aproximar con `lineTo`: mata la curva del glifo |
| Convención de coordenadas | Origen del Shape = **posición de pluma en la línea de base**; el path va en unidades de fuente × 0,096 (font-size 96) con la **y invertida** | Es la convención que ya usaba el archivo (la O vieja iba de `y 0.864` a `y −68.064`: base en 0, arriba negativo). Respetarla evita recalcular posiciones | Centrar cada glifo en su origen: rompería las posiciones keyframeadas |
| **Reposicionamiento (lo que casi se pasa por alto)** | Plus Jakarta Sans es **más ancha**: `dobi` mide **215,808** contra 195,36. Eso corre el centro óptico de la O de **97,32 → 87,096**, y hay que mover **también el keyframe de aterrizaje de `forma-4-huevo`** (`0-233`) | El motor del splash es que la 4ª forma se contrae **hacia el lugar exacto de la O**. Si se cambia la tipografía y no ese keyframe, la forma aterriza al lado de la letra y la idea entera se rompe — sin que ningún chequeo lo avise | Dejar las posiciones viejas: el wordmark queda descentrado (194,5 vs 195 es el objetivo) y la forma 4 no cae sobre la O |
| Posiciones nuevas | Pluma: O 44,904 · d 129,192 · o 193,704 · b 256,296 · i 320,808. Entrada/salida sin cambios (+72 al entrar, −6,5 de overshoot) | Regla original conservada: centro de la O = `195 − ancho("dobi")/2`. El lockup abarca 49,7–339,2 → centrado en 194,5 sobre 390 ✅ | — |
| `Entrada` | La O se escala a **58,32 de ancho**, el mismo que tenía la de NeueEinstellung, centrada en el origen | Las 3 ondas se diseñaron con un despeje calculado contra `rx 29,16`. Manteniendo el ancho, el despeje y el degradé radial siguen valiendo sin recalcular nada | Usar el mismo font-size 96 del splash: la O quedaba más grande y había que rehacer radios y despejes |
| `isHole` otra vez | Vuelto a marcar en los 5 contrapunzones nuevos (O, d, o, b del splash + O de entrada). La **i no lleva**: sus dos contornos son asta y punto | El bug del §5 reaparece con **cualquier** glifo nuevo: Rive no deduce el agujero del bobinado | — |

---

## 7 · Sesión 18/08/2026 — la `Entrada` se rehace con el isotipo de David

Martin adoptó el **isotipo de David** como símbolo de la marca (ver `../isotipo-david/DECISIONES.md`). Eso obliga a rehacer esta pieza, y de paso **deroga dos decisiones del 06/08**.

### 7.1 · El concepto cambia: de rodear el signo a SER el signo

Hasta acá la entrada eran *«3 ondas que se disipan alrededor de la O»*: el movimiento era un adorno **alrededor** del símbolo, porque el símbolo era una letra y las letras no se mueven. **El isotipo de David ya son arcos** — así que la animación pasa a ser **el símbolo dibujándose**, y termina exactamente en el signo estático que usa la app.

Referencia de movimiento navegable: **`../isotipo-david/entrada.html`** (CSS, no es la pieza final — la pieza se construye en Rive).

### 7.2 · Qué queda derogado

| Decisión del 06/08 | Estado | Por qué cae |
|---|---|---|
| **«Se mantienen 3 ondas, aunque el isotipo estático tiene 2»** (§6.3) — con el argumento de que *«son piezas distintas: una es signo fijo, la otra un pulso escalonado»* | **DEROGADA: son 2** | El argumento se sostenía cuando el signo era una letra y el pulso, otra cosa. **Ahora el signo y el pulso son lo mismo**, y la cantidad de ondas la fija el símbolo. Mantener tres sería inventar una onda que el isotipo no tiene |
| **«la geometría del isotipo del 09»** (§6.3) | **DEROGADA** | Apuntaba al monograma viejo. La geometría ahora es la del archivo de David (`viewBox` 0-24, resguardo 0,5 u, bbox medido con `getBBox()`) |
| Los 5 glifos del `Splash` y la O de `Entrada` en Plus Jakarta (§ tipografía) | **Sigue vigente para el `Splash`** | El `Splash` construye identidad con el **wordmark**, que sí es tipográfico. Lo que cambia es la `Entrada`, que pasa a ser puro símbolo |

### 7.3 · El guión nuevo, en proporciones (no en ms)

| Elemento | Entra | Cómo | Por qué |
|---|---|---|---|
| Arco exterior | 0 → 28 % | se dibuja (trazo que avanza) | Es la boca del signo: define la forma antes de que llegue el sonido |
| Arco interno | 9 → 32 % | se dibuja, **solapado** | El solape es lo que hace que se lea como *un* gesto y no como dos pasos |
| Onda 1 | 20 → 51 % | aparece saliendo hacia afuera | Nace pegada al arco y se despega: el sonido **sale** del signo |
| Onda 2 | 28 → 59 % | ídem, escalonada | El escalonado es lo que vuelve legible la dirección |
| Reposo | 59 → 100 % | el isotipo completo, quieto | **Termina en el signo estático.** No hay fundido ni loop |

**Los tiempos van en porcentaje a propósito.** La duración total sigue siendo el número abierto de §6.4 (hoy 1,5 s provisorios) porque **nadie midió cuánto tarda Mi día en cargar**. Con la estructura en proporciones, cuando se mida la latencia real la pieza se re-escala sin rediseñar el guión.

### 7.4 · Tres reglas que la pieza tiene que cumplir

1. **Termina en el símbolo, no en el vacío** — el último cuadro es idéntico al isotipo de la app.
2. **Un solo gesto, no cuatro entradas** — los solapes están calculados para eso.
3. **Nada de rebote ni overshoot** — se ve 20+ veces por día: lo que es simpático la primera vez es insoportable a la vigésima.

### 7.5 · Estado

⚠️ **Pendiente de construir en Rive.** El server MCP responde (`localhost:9791`), pero **sólo carga si la sesión abre parada en `odobi-ui/`** — el `.mcp.json` vive ahí. Al construirlo: recordar que **el MCP escribe la rotación en radianes y la lee en grados** (§6), así que toda rotación se verifica con `queryKeyFrames`, no a ojo.
