# CLAUDE.md — Odobi UI (resumen operativo)

Verdad de marca: `ODOBI_HANDOFF.md` (raíz repo). Este archivo = resumen ejecutable. Conflicto → gana handoff.

## Qué es esto
Mockups anotados → prototipo HTML navegable → deck de justificación. UI app Odobi ("tu copiloto emprendedor"): copiloto conversacional y de voz para emprendedores en Argentina. Toda decisión se justifica con Wilensky, Chaves, IF Design Patterns Catalogue o principios UX verificables. Nada por gusto.

## REGLAS DURAS (no reabrir)

### Nombre
Siempre **Odobi** — mayúscula inicial, resto minúscula. NUNCA "ODOBI" (logo, etiqueta, botón, versalitas). Etiqueta versalitas que contendría nombre → reformular.

### Paleta (cerrada 22/07/2026)
| Rol | Hex | Uso |
|---|---|---|
| Lienzo | `#FFFFFF` / `#F7F3EC` | fondo dominante (claro) |
| Estructura | `#1A1512` | texto, fondos oscuros |
| Acento | `#DE7250` | terracota — CTA, marca, estados. **≤10% de la pantalla** |
| Acento sobre claro | `#B04A2E` | texto/links terracota sobre fondos claros |
| Apoyo | `#E8A088` | arena — jerarquía secundaria sobre oscuro |

### Contraste WCAG (calculado, no a ojo)
- **Sobre terracota (regla 28/07/2026 v2 por Martin — reemplaza v1 mismo día, la del 22/07 y handoff §4.1):**
  - **NUNCA texto negro sobre terracota.** Texto de botones: blanco o crema.
  - **Botones confirmación: fill terracota suave `#DE7250` + label DISPLAY 19 Bold BLANCO** — token `--fs-btn:19px`. (3.17:1 ≥ 3:1 = AA texto grande ✅.) NUNCA Inter 16px s/`#DE7250` (3.17:1 falla AA texto normal). Botón con texto chico → fill baja a `#B04A2E` (5.43:1). Tokens: `--accent-btn` = `#DE7250` + `--on-accent` blanco.
  - ⚠️ **19 px = PISO, no preferencia** (rev. 18/08, decisión Martin: a 20 el botón pesaba más que el contenido). WCAG cuenta *texto grande* bold desde **18,66 px** (14 pt) — único que vuelve legal el 3,17:1. **A 18 px el botón deja de cumplir, y se ve idéntico**: falla invisible a ojo. Antes de bajar ese número, cambiar el fill a `#B04A2E`, no la tipografía. Descartados: Inter 16 sobre `#B04A2E` (perdía bold, Martin lo quiere), `#B65D42` (tercer valor) y negro sobre terracota (deroga regla 28/07, arrastra lectura a señalética de obra).
  - Íconos/gráficos s/`#DE7250` (mic, ondas, checks): blanco (3.17:1 ≥ 3:1, WCAG 1.4.11 no-texto).
  - Display grande s/`#DE7250` (≥20px Bold o ≥24px regular): blanco (3.17:1 ≥ 3:1, AA texto grande). ⚠️ El botón "Cortar" de la escucha que usaba esta vía **ya no existe** (la escucha a pantalla completa se derogó el 24/08).
  - Texto normal sobre `#DE7250`: NO EXISTE.
- Terracota `#DE7250` como texto sobre crema/blanco PROHIBIDO (2.86:1) → usar `#B04A2E` (4.91:1). Excepción: wordmark "Odobi" puede ir en `#DE7250` (logotipos exentos, WCAG 1.4.3 — decisión Martin 22/07).
- Regla de componente (22/07): borde del input de chat en terracota 1px — input+mic = unidad "hablarle a Odobi". Aplica a todos los mockups.
- Terracota sobre negro tostado 5.71:1 ✅ · Crema sobre negro tostado 16.37:1 ✅ · Arena sobre negro tostado 8.46:1 ✅
- **Terracota sobre negro tostado: SOLO tema oscuro (decisión Martin 08/08).** Pasa contraste (5.71:1) pero reservada al tema oscuro, que usa negro tostado de fondo. **En tema claro esa combinación no se usa** — nada de islas oscuras con acento terracota sobre lienzo claro. Excepción: superficies que no son UI de app (meta-capa de presentación, p. ej. header del árbol).
- Toda combinación nueva se calcula ANTES de usarse.

### Proporción 60/30/10
Lienzo ≈60%, estructura ≈30%, terracota ≤10%. Terracota = señal, no ambiente. Excepción declarada: terracota plena SOLO en piezas display (splash, celebración, onboarding-reveal). Nunca UI operativa.

### Tipografía
- Display/títulos: **Plus Jakarta Sans Bold** (`assets/fonts/PlusJakartaSans-Bold.ttf`, solo Bold). **Reemplazó a NeueEinstellung el 06–07/08**: licencia de app USD 375/año renovable por título. No fue swap de títulos — **el monograma ES el glifo real de la O**, cambiar la fuente cambia el símbolo de marca. Se eligió midiendo con `fontTools` sobre archivos reales (ratio ancho/alto de la O, contrapunzón, trazo horizontal): distancia 0,111 contra la referencia. Ver `explorations/tipografia-libre/DECISIONES.md`.
- UI/cuerpo: **Inter** Regular (400) y Medium (500).
- Nada más. Máx 4 tamaños de tipo por pantalla.
- Licencia: OFL — sin deuda para producción.

### Temas
Exactamente 2: claro (crema/blanco) y oscuro (negro tostado). Identidad constante: misma terracota, misma tipografía, mismos componentes. Variables semánticas idénticas en ambos (`tokens/odobi.css`).

### Sistema de identidad gráfica (cerrado 28/07/2026 por Martin — aplica a TODA la app)
Origen: feedback "falta personalidad, sabor demasiado minimalista" + referencias Plum/Copilot Money/Quicken (`references/`). Estrenado en el 09; se propaga a cada mockup al tocarlo.
- **Dos capas:** microdetalle en UI diaria (monograma + tiles con íconos) + ilustración spot en momentos clave (estados vacíos/calma, onboarding, celebración, splash).
- **Símbolo: el ISOTIPO DE DAVID (decisión Martin 18/08 — reemplaza al monograma "la o que habla").** Cuatro arcos concéntricos abiertos a la izquierda, sin punto central. Fuente: `repo-app/.../docs/Imagen de marca/isotipo-odobi/` (positivo · negativo · monocromo + los dos lockups), con spec propia: resguardo 0,5 u, separación símbolo↔wordmark 0,3 × ancho, bbox medido con `getBBox()`. **Se adopta la spec completa, no sólo el dibujo.**
  - **Dos variantes por escala, y no es opcional:** **≤24 px → 3 arcos** (se quita el interno) con `stroke-width` **1.6** y `viewBox="1.20 1.26 21.48 21.48"`; **>24 px → los 4 arcos** con **1.3** y el `viewBox` nativo `0 0 24 24`. Medido: a 16 px el arco interno (r 4,5) colapsa y se funde con el exterior — el signo pierde estructura. Mismo problema que tenía el monograma anterior con las barras adentro de la O, al revés.
  - ⚠️ **En chico va el `viewBox` AJUSTADO al bbox, no el nativo.** El `viewBox` 0-24 trae mucho aire alrededor del símbolo (bbox real 18,88 × 17), así que a 16 px el signo se dibuja al ~66 % de su caja: se ve chico, desvaído y "cortado". El ajustado = bbox + medio trazo + resguardo 0,5 u que pide la spec, en caja cuadrada para no deformarlo. Detectado probando el prototipo en el celular, no en escritorio.
  - **100% stroke, sin fill.** Hereda color por CSS del contenedor (`stroke:var(--sec)` / `var(--terracota)`), así que un solo marcado sirve para claro y oscuro.
  - **Qué se pierde y qué se gana:** el monograma anterior era *la O real del wordmark*, su argumento era la constancia de signo (misma letra en logo y símbolo). El de David no deriva de la letra. **El símbolo deja de decir el nombre y pasa a decir qué hace el producto** — y deja de depender de la tipografía, que ya nos costó regenerar 24 paths al cambiar de fuente.
  - Usos: labels de sección que hablan por Odobi ("PARA HOY", en `sec`), avatar de Odobi en el chat, estados vacíos, brand del árbol, splash y entrada.
  - **Dónde va cada pieza de marca (regla cerrada 18/08):**

    | Pieza | Dónde | Por qué |
    |---|---|---|
    | **Lockup** (símbolo + wordmark) | Splash / primer ingreso · piezas de marca (deck, árbol) | Único momento donde la marca se presenta entera. `assets/marca/lockup-horizontal.svg` |
    | **Símbolo solo** | Entrada de arranques 2..n · labels de sección · avatar de Odobi en el chat · estados vacíos | Es **firma**, no presentación: adentro de la app el nombre ya se sabe |
    | **Wordmark solo** | Header de la app | El símbolo ya trabaja adentro de la pantalla (labels, avatar). Ponerlo también arriba gastaría dos veces el mismo signo |

  - ⚠️ **El lockup NO se copia del repo de David:** su `lockup-horizontal.svg` declara **NeueEinstellung** en el `<text>` — tipografía derogada por licencia. Se rehízo en `assets/marca/lockup-horizontal.svg` conservando su geometría (bbox del símbolo, separación óptica 0,3 × ancho = 5,66 u) pero **recalculando la `x` del texto**: depende del sidebearing izquierdo, que en NeueEinstellung era ~2,624 u y en Plus Jakarta es 0,675 u (medido con `fontTools` sobre `hmtx`). Copiar su `x=29.66` deja la separación en 7,6 u en vez de 5,66.

  - **Consecuencia pendiente:** la animación `Entrada` de Rive (arranques 2..n) se rehace con este signo — encaja natural, porque **ya son arcos**: la onda deja de ser adorno alrededor de la letra y pasa a ser el propio símbolo desplegándose.
- **Ilustración spot:** line-art trazo negro `#1A1512` 2–2.5px + fill arena `#E8A088`/crema; detalles secundarios (vapor, suelo) en lápiz `#8A7F73`; chispas 4 puntas (1 terracota máx + resto arena). Objetos del mostrador argentino (taza de café, mate, facturas, tickets, changuito). Fill terracota en ilustración: por defecto NO (Decisión B: terracota = tocable); excepción decidida por Martin 28/07 para la taza del calm del 09 (su dibujo `assets/illustrations/taza-original.svg` + capas terracota en `assets/illustrations/taza.svg`). Si Martin pasa un dibujo propio, se usa TAL CUAL (no recrear ni reinterpretar).
- **Íconos: PHOSPHOR, peso `regular`** (phosphoricons.com, MIT — decisión Martin 19/08; **deroga Iconoir**, del 28/07). Set en `assets/iconos/` + `LEEME.md`.
  - **Por qué Regular, medido:** grosor de cada peso como proporción del alto del ícono (única forma de comparar sets con distinto `viewBox` — Phosphor usa 256, nosotros 24): Light **4,69 %** · **Regular 6,25 %** · Bold 9,38 %. El isotipo chico pesa **6,67 %**. **Regular es el único que pesa como el símbolo de la marca.** De paso quedó a la vista que los tiles con Iconoir usaban trazo 2 = **8,33 %**: el ícono de una tarjeta pesaba más que el signo de Odobi.
  - ⚠️ **Phosphor es `fill`, no `stroke`:** viene outlineado. Color se hereda por `fill="currentColor"` + `color` en el contenedor, pero **el grosor NO se ajusta por CSS** — si hace falta otro peso, se baja otro set; nunca se toca `stroke-width`. A cambio se ve idéntico a cualquier escala.
  - **Convivencia con el isotipo, que sí es `stroke`:** regla global `svg[viewBox="0 0 256 256"]{fill:currentColor;stroke:none}` y cada contenedor declara **`stroke` y `color` con el mismo valor** — el isotipo toma el `stroke`, Phosphor el `color`. ⚠️ **El isotipo lleva `fill="none"` inline, no por CSS**: cuando el `fill:none` vivía en la hoja de estilos, apagaba a Phosphor; al sacarlo, los isotipos que no lo traían inline se rellenaron.
  - Tamaños: **18 px** en tiles de tarjeta y escritorio · **20 px** en el composer · **34 px** en estados vacíos y encabezados. Comparativa que fundó la decisión: `explorations/iconos/`.
  - Isotipo e ilustraciones spot siguen siendo dibujo propio (marca, no librería). Cero emojis como íconos.
- **Tint derivado:** `--arena-30:#F8E2DB` (arena 30% s/blanco). Negro s/tile 14.56:1 ✅ · sec s/tile 6.04:1 ✅.
- **Techo:** nada de 3D, profundidad ni sombreado kilométrico (el exceso que Martin señaló); la identidad es trazo y objeto, no efecto.

### Las DOS GRAMÁTICAS visuales (cerrado 19/08/2026 — regla dura, aplica a TODA la app)
Nace de observación de Martin: *"el estilo quedó igual para todas las pantallas"*. Se revisó material
de Monzo (`references/` + `Monzo iOS Screens`) y se confirmó que **no viste todas sus pantallas
igual**: las de dinero llevan bloque de color y cifra, las de configuración abren con título grande
suelto. **La diferencia no es estética: es semántica.**

| | **A — OPERACIÓN** | **B — CONFIGURACIÓN / PROCESO** |
|---|---|---|
| Dónde | Mi día · las 6 funciones · Inteligencia de Negocio | Ajustes y sus 7 opciones |
| Encabezado | card blanca del stack + **bloque negro** | **título display 30 px suelto sobre el lienzo** + bajada |
| Bloque de color | uno, con la cifra | **ninguno** |
| Contenido | cifras grandes, listas | filas agrupadas, label + estado chico |
| Elección | — | **filas con radio**, nunca segmento |
| Estado | en el bloque negro | **una línea con punto de color** |

- ⚠️ **EL BLOQUE NEGRO SIGNIFICA "UNA CIFRA DE TU NEGOCIO", y sólo eso.** Cuando se usaba también
  para un mail o para "Tema claro", **el recurso dejaba de significar algo**. Antes de ponerlo,
  preguntar: ¿esto es una cifra del negocio? Si no, va gramática B.
- **La cifra del bloque es la ACCIONABLE de esa pantalla, no "el total"**: en Presupuestos es lo que
  espera respuesta (uno aceptado ya no pide nada), en Clientes el tamaño de la cartera, en Ajustes ›
  AFIP el estado de la vinculación. Un total genérico no sirve para decidir.
- **Por qué el segmento no sirve en B:** en un segmento entran dos palabras. Con filas, "Producción"
  puede decir *"comprobantes reales, con validez legal ante AFIP"* — y el repo insiste en que esa
  diferencia se entienda ANTES de facturar en serio.
- **El stack (card blanca detrás del bloque negro)** es de gramática A: mismo ancho, baja hasta la
  mitad por detrás (`height:calc(50% + 26px)` sobre `padding-top:52px`), su borde inferior queda
  **tapado, no recortado**. Trae nombre a la izquierda y período/fecha a la derecha, alineados por
  baseline. Fecha lo que muestra el bloque: "$126.000" sin mes no significa nada.

### Anatomía de una función (19/08)
`Volver ‹` a la izquierda · stack con nombre + período · bloque negro · rótulo de sección con el
alta a la derecha · lista · composer.
- **"Volver" va a la IZQUIERDA con chevron:** es el borde donde iOS y Android ponen el retroceso y
  el mismo desde el que se hace el gesto. Se acepta que quede lejos del pulgar — acción de baja
  frecuencia y alto reconocimiento.
- **El alta manual va en la fila del rótulo, como pill**, con el **verbo textual del repo**:
  `Nuevo gasto` · **`Anotar que me pagaron`** (NO "Nuevo ingreso") · `Nueva factura` ·
  `Nuevo presupuesto` · `Nuevo cliente`. Label `#B04A2E` sobre card blanca (5,43:1 ✅): tocable sin
  gastar más superficie de acento. **Nunca un FAB**: competiría con el mic, que es el gesto que el
  producto quiere enseñar.
- **Inteligencia de Negocio NO lleva alta:** responde, no registra. Es la única sin "Nuevo".
- **Estado de cada ítem = chip. Lo que reclama en NEGRO, lo terminado en arena.** Sobre tres
  facturas el ojo va solo a la impaga sin gastar terracota. Teñir la fila de rojo/verde traería una
  paleta semántica que el sistema no tiene.

### Qué son las funciones y qué es Ajustes (verificado en el repo, 19/08)
Se verificó porque la premisa de trabajo era otra. **Las funciones NO son pantallas de
configuración**: son la **vía de la mano**, paralela a la de la voz, sobre los mismos datos. La
configuración vive en **Ajustes** (`kb-usuario/ajustes.md`): Mi negocio · Facturación AFIP · Apps
conectadas · Mi plan · Mi cuenta · Apariencia · Cómo hablarle, **en ese orden**. No se reordenan ni
se agrupan: es el mapa que el usuario ya tiene.
- ⚠️ **Nada se dice dos veces.** El repo lista "Cómo hablarle" como opción propia Y describe tono/
  largo/nombre dentro de Mi negocio. **Gana la pantalla propia** (el repo: *"se guardan aparte del
  resto del perfil"*); en Mi negocio queda un resumen que lleva ahí. Mismo criterio que derogó el
  rótulo de contexto.

### Reglas que vienen del REPO, no del diseño (no se negocian)
- **Dato faltante: "—", NUNCA "$0".** *"El Copiloto nunca confunde 'no tengo ese dato' con 'el valor
  es cero'."* Mostrar cero de rentabilidad cuando falta un gasto **le miente al usuario sobre su
  negocio**. Va con el motivo al lado, no solo el guión.
- **Caja y Facturado NUNCA se mezclan** (hoy en Inteligencia): si se sumaran, la misma plata se contaría
  dos veces —al facturar y al cobrar—. Se dice con **superficie**: caja en negro, facturado en card
  blanca.
- **El CUIT queda bloqueado** una vez guardado → dice "Bloqueado", sin acción. Un dato trabado no se
  disfraza de editable.
- **La clave fiscal no se guarda** — la aclaración va al pie de la pantalla, textual: es la promesa
  de seguridad más fuerte del producto, no vive en un tooltip.
- **Las apps se nombran por CAPACIDAD, no por marca.** Es lo que hace entendible el costo de
  desconectar, que el repo exige mostrar como **lista real, no aviso genérico**. Drive va aparte:
  no se usa por chat, sólo archiva.
- **Un cliente NUNCA es "Consumidor Final"** en la cartera.
- **La cartera de Clientes crece sola** al facturar → hay que decirlo, o ver nombres no cargados se
  lee como error.

### Semáforo del tope de monotributo (paleta ampliada 19/08)
El repo pide verde/amarillo/rojo explícito y la paleta no tenía señales semánticas. Se suman **dos**
tonos, elegidos con el **mismo valor tonal** que la terracota profunda para que convivan:
| Rol | Hex | s/ blanco |
|---|---|---|
| OK | `#3F7D5C` | 4,84:1 ✅ |
| Ojo | `#A06A1E` | 4,63:1 ✅ |
| Mal | `#B04A2E` | 5,43:1 ✅ — **ya estaba** en la paleta |

⚠️ **WCAG 1.4.1: el color NUNCA va solo** — el porcentaje se dice con texto ("68% del tope anual").
Único uso autorizado: señales de estado que el repo define. No se extiende a otra cosa sin decidirlo.

### Inteligencia: los dos estados que pedía el repo (24/08)
Aparecieron al comparar la pantalla contra `kb-usuario/inteligencia.md`. Ninguno se ve en el
estado por defecto, así que tienen su `?ver=` propio.
- **Estado vacío de "Mejores clientes"** (`?ver=bi-vacio`). Textual del repo: *"vas a ver un
  mensaje avisando que todavía no hay datos, en vez de una sección vacía sin explicación"*.
  ⚠️ **Va SIN ilustración, a diferencia de la taza de Mi día:** la taza celebra un vacío
  **bueno** ("nada urgente por hoy") y ocupa una pantalla entera; acá el vacío es de una
  **sección** y no es un logro — es que todavía no vendiste. Dibujarlo igual sería festejarlo.
- **Tirar para actualizar** (`?ver=bi-refresh`). El repo lo pide dos veces. **Sólo acá**: es
  la única pantalla cuyo contenido el usuario querría volver a pedir sin haber hecho nada —
  las demás cambian cuando él actúa.
  - ⚠️ **NO usa `setPointerCapture`:** capturar el puntero **mata el scroll nativo** del
    contenedor. El gesto se engancha sólo si ya estás en `scrollTop === 0` y el movimiento va
    hacia abajo; en cualquier otro caso se suelta y el scroll vuelve a ser del navegador.
  - Rebote del 30% pasado el tope (64 px), igual que el swipe de descarte.
  - **El estado se dice con TEXTO** ("Tirá para actualizar" → "Soltá para actualizar" →
    "Actualizando…" → "Al día · recién"), no sólo con el ícono girando: WCAG 1.4.1.

### Gráficos: sin cifra no van (19/08)
Se dibujaron cuatro sparklines decorativas en Inteligencia y Martin las bajó: *"son humo"*. **Tenía
razón y el error era de dibujo, no del repo** — el repo pedía esos cortes, pero pedía **datos**.
**Regla: un gráfico sin cifra no se puede leer ni usar.** Se reemplazaron por métricas con dato y
con lectura ("68% del tope · a este ritmo lo alcanzás en noviembre" · "margen 41% · el más flojo:
Reforma Díaz, 12%"). Un promedio solo no dice qué hacer; saber cuál te come la ganancia, sí.

### Renovación visual — gramática de Monzo (19/08/2026)
Nace de Martin: *"la interfaz es intuitiva pero el diseño es una mierda… nada encaja"*. Palabra
elegida para el problema: **insulso, apático**. Referencia: Monzo iOS. Se tomó **su construcción, no
su paleta** — Monzo es policromático y Odobi tiene un acento ≤10%.

| # | Qué | Antes | Ahora |
|---|---|---|---|
| 1 | Lienzo | blanco plano | **degradé ascendente** `#F5E7DE` → `#F7F3EC` (arena abajo, crema arriba). ⚠️ Invertirlo al estilo Quizlet (tinte arriba) **se probó y se descartó** el 20/08 |
| 2 | Radios | `--r-s:8` `--r-m:16` | `--r-s:14` `--r-m:22` + **`--r-xl:26`** nuevo |
| 3 | Superficies | `border:1px solid` | **sin borde**, elevación `0 4px 18px rgba(26,21,18,.07)` |
| 4 | Portada | caja crema, cifra 28 px | **bloque negro** + stack, cifra 40 px |
| 5 | Acción de tarjeta | link de texto | **pill** `#DE7250`, mismo fill que el mic |
| 6 | Composer | input con borde terracota | card blanca elevada + mic 52 px con sombra de color |
| 7 | Tiles | 36 px | 42 px |

**El diagnóstico medido:** el fondo de Monzo **nunca es blanco**; sus cards sí, y por eso no
necesitan borde. Nuestro inverso —lienzo blanco + cards blancas— **obligaba a un borde de 1 px
alrededor de todo**, y eso era el "insulso". El golpe de color no viene de la paleta: viene del
bloque negro.

⚠️ **Reglas que esto MODIFICA:**
1. **Cae el borde terracota de 1 px del input** (regla de componente del 22/07: *"input+mic = unidad
   hablarle a Odobi"*). **El propósito se conserva, cambia el mecanismo**: la unidad ahora la produce
   la **elevación compartida** de input y mic, no una línea.
2. **El wordmark sale del header y baja a la card del stack.** Donde hay stack, arriba queda **sólo
   el avatar**. Ponerlo en los dos lados gastaba el mismo signo dos veces en la misma pantalla.
3. **El isotipo sale de los labels de sección** ("PARA HOY"). Sigue en avatar del chat, estados
   vacíos, splash y piezas de marca.

### Escritorio de funciones (19/08)
**Tres por fila, no cuatro.** A 390 px, cuatro dejan ~85 px por tile y "Presupuestos" se parte en
tres líneas; con tres hay ~112 px y el label entra en una línea. Cada función es una **card blanca
elevada** con el ícono en tile arena — el mismo componente que las tarjetas de Mi día: el escritorio
nombra **lugares**, así que parece un cajón, no un botón.
- **El bloque negro va ABAJO, en Actividad reciente.** Arriba en Mi día, abajo acá: al deslizar entre
  capas los dos bloques **no coinciden de posición**, y eso se lee como profundidad en vez de
  repetición. Y nunca envuelve nada tocable (Decisión B).
- **Título "Tus funciones"**, no el wordmark: el signo ya se dice en la capa base.
- **Se cayó el tile fantasma "︙"**: con las 7 visibles y sin una octava que revelar, es ruido.
- **Asomo de la capa vecina: 62 px** (era 96). Con el header apagado, el borde sólo necesita mostrar
  el asidero. Constante `ASOMO` — el número vivía repetido en tres lugares.
- ⚠️ **Una capa que sólo asoma su borde NO trae su chrome**: el header de Mi día se apaga, o su
  avatar convive con el del escritorio y se ve duplicado. El rótulo del asidero cambia según estado
  ("Bajá para tus funciones" ↔ "Subí para volver a Mi día").

### Descartar avisos (19/08)
Deslizar **derecha → izquierda**, umbral 38% del ancho. Fondo `#B04A2E` con **tacho blanco** (5,43:1
✅), sin texto: el ícono ya lo dice y un rótulo obliga a leer en medio de un gesto. Snackbar
**"Aviso descartado · Deshacer"** 6 s (Nielsen #3).
- **Lock de eje en los primeros 8 px**: sin eso, cada intento de scrollear sobre una tarjeta la
  arrastra de costado.
- ⚠️ **Falta la alternativa de un solo puntero que exige WCAG 2.5.1.** La × en la tarjeta se quitó
  por pedido de Martin. Pendiente reponerla por otra vía.
- **Qué significa descartar es decisión de producto sin cerrar:** 4 de las 8 reglas del detector se
  cierran solas **por el hecho**; descartar a mano no paga la factura. Recomendación: que valga
  **hasta mañana**, no para siempre.

### Estado de calma en Mi día (19/08 · rev. 25/08)
⚠️ **Rev. 25/08 — la calma es de los PENDIENTES, no del día entero.** Martin preguntó por
qué seguía diciendo "2 de 6 cerradas" al lado de "Nada urgente por hoy", y ahí aparecieron
**tres cosas encadenadas**:
1. El selector era `#midia .sec`, que agarraba **también el rótulo de "Ahora"**: la agenda
   quedaba sin título, con su lista colgando de la nada.
2. **La barra de avance no se colapsaba** con su sección: quedaba flotando sobre una lista
   vacía, contradiciendo al mensaje de al lado.
3. ⚠️ **Y aunque se colapsara, el esqueleto la devolvía.** El estado de carga restaura
   `display` a ciegas a los 1100 ms —después de que la calma ya corrió— y volvía a
   mostrarla. **Quien decide qué se ve es `revisarCalma()`, siempre**: el esqueleto ahora
   la llama al terminar en vez de restaurar por su cuenta.

⚠️ **Y colapsar el rótulo se llevó "Ver tablero ›"** (lo cazó Martin): era la **única
puerta al tablero desde Mi día**. La calma es de **hoy**; el tablero tiene "Haciendo" y
lo que viene, así que quedarse sin entrada es peor que el número contradictorio que
veníamos a arreglar. **Regla: un estado vacío puede sacar el contenido, nunca la salida.**
El enlace se repone **dentro** del bloque de calma.

**Resultado:** se colapsa **sólo** la sección "Para hoy" (rótulo + barra + lista), **el
avance se muda adentro del bloque de calma** y **el enlace al tablero va con él**: *"2 de 6 cerradas hoy. El resto se cerró solo
o lo descartaste."* Así se conservan las dos decisiones —el avance sigue contando sobre el
total del día (20/08) y sigue siendo la única devolución que el usuario recibe— sin que
quede un número huérfano contradiciendo al mensaje.

### La explicación de la calma se RETIRA con el uso (25/08)
*"Cuando haya algo que mirar, te lo dejo acá"* enseña qué significa una pantalla vacía.
Enseñado eso, **deja de informar y pasa a ocupar lugar**: es andamiaje, y el andamiaje se
saca cuando ya no sostiene nada. Se retira a los **5 días** (`CALMA_TOPE`, a calibrar).

- ⚠️ **Se cuentan DÍAS DISTINTOS, no apariciones.** Martin dijo "5 veces", pero cinco veces
  en una misma mañana —abrir y cerrar la app— no es haber aprendido nada; cinco días
  viéndola, sí. Contar renders además haría que **scrollear gastara el cupo**. Lo que se
  aprende se aprende con el tiempo, no con la repetición seguida.
- ⚠️ **Se retira la EXPLICACIÓN, nunca la información ni la salida.** "Nada urgente por
  hoy", lo que queda por delante y el enlace al tablero siguen siempre. Mismo criterio que
  el error del rótulo: un estado puede sacar el andamiaje, jamás la puerta.
- **`?ver=vacio` fuerza el estreno y `?ver=vacio-visto` el estado veterano** — hacen falta
  para mostrar los dos momentos sin esperar cinco días.
- Aplica el mismo patrón a cualquier texto que *enseñe*: si sólo sirve la primera vez, tiene
  que saber irse.

Sin tarjetas —cerradas solas o descartadas— aparece la **taza** (`assets/illustrations/taza.svg`,
dibujo de Martin, 104 px) con "Nada urgente por hoy". **El vacío es un resultado bueno y tiene que
verse como tal**, no como una pantalla que falló al cargar. El rótulo "PARA HOY" se va con las
tarjetas: sin tarjetas no encabeza nada.

### Rodillo de ejemplos del chat (19/08)
**Tambor vertical**: las frases van **superpuestas** (no en tira) y cada una entra por abajo y sale
por arriba recorriendo el alto del renglón, en `overflow:hidden`. Curva propia
`cubic-bezier(.45,.05,.35,1)` —simétrica— en 0,62 s; cambia cada 2,6 s.
- **Superpuestas y no en tira** porque una tira tiene que *rebobinar* al llegar a la última, y ese
  salto obligaba a un `<li>` duplicado. Así cada frase hace el mismo viaje y el ciclo no tiene costura.
- ⚠️ **El giro corre TAMBIÉN con movimiento reducido** (decisión Martin 19/08). Con keyframes caía
  bajo `*{animation:none}` y quedaba congelado en un ejemplo: **la función —enseñar qué se le puede
  decir— quedaba anulada**. WCAG 2.2.2 pediría un mecanismo de pausa: son 26 px cada 2,6 s, anotado.

### Paleta de PRIORIDAD (rev. 20/08/2026) — SÓLO TEXTO, jerarquía por peso
Nace de tres correcciones sucesivas de Martin, y cada una enseñó algo:

1. **El negro no es urgencia: es estructura.** Usarlo para prioridad lo vaciaba igual que cuando
   vestía un mail en Ajustes.
2. **El primer pastel competía con el acento.** `#EDAE9E` estaba a **2,2° de matiz** de la terracota
   — era terracota aclarada. ⚠️ **El problema era de matiz, no de tono.**
3. **Con fondo, la app quedaba demasiado colorida:** 8 manchas por pantalla (4 chips + 4 tiles),
   encima del bloque negro y el botón terracota.

**Versión vigente — sin fondo, el color va sólo en el texto:**

| Nivel | Color | Peso | Contraste s/ blanco |
|---|---|---|---|
| Urgente | `#A32B47` | **600** | 7,01:1 ✅ |
| Pronto | `#8A6410` | 500 | 5,37:1 ✅ |
| Al día | `#3C6B52` | 500 | 6,15:1 ✅ |
| Sin fecha | `#7A716A` | 400 | 4,78:1 ✅ |

- ⚠️ **La jerarquía la da la TIPOGRAFÍA, no el color.** Sin fondo, los cuatro textos oscuros quedan
  con luminancia entre .066 y .090 — **rango 0,023**: pesan igual. El peso escalonado es lo que
  recupera el orden de lectura: la urgente en 600 y más oscura, "lo anotaste vos" en 400 y más clara
  para que se hunda.
- **Funciona en blanco y negro**, que es la prueba de que la jerarquía no depende del color
  (WCAG 1.4.1). El chip además siempre dice el plazo en texto.
- **Los pasteles NO se borran del sistema:** siguen en el tinte de superficie grande
  (`#FAE9ED` para la fila en curso, 1,17:1 contra card blanca) y disponibles si alguna vez hace
  falta un chip con fondo. Lo que cambió es que **dejaron de ser el recurso por defecto**.
- ⚠️ **Regla que deja esto: un color se elige según cuánta superficie va a ocupar.** El mismo valor
  sirve en 7 px y arruina una banda de ancho completo. Misma lógica que tenía el velo de la escucha al 96% (derogado el 24/08).

### Paleta de FUNCIÓN — tile del ícono (20/08)
`--f-cobros:#DCE8DC` · `--f-factura:#DCE3EC` · `--f-afip:#E4DCEC` · `--f-presu:#F7E6CD` ·
`--f-clientes:#F8E2DB` · `--f-propio:#EDE6DC`. Ícono negro tostado encima: **≥13,5:1** en todos.
- **Separa dos preguntas que se estaban mezclando:** *de qué es* lo dice el **tile**; *cuánto apura*
  lo dice el **chip**. Antes ambas competían por el color y ninguna ganaba.

### Radios concéntricos (regla dura, 20/08)
> **Radio interior = radio exterior − distancia al borde.**

Sólo importa cuando la separación es **chica**: a 16–20 px del borde la curva del contenedor ya
terminó y el interior nunca la toca, así que ahí el radio se elige por estética. A 4 px **sí se
tocan**, y con el radio equivocado se ve que "no encajan". Caso real: la fila teñida de la agenda
sobresale 12 px dentro de una lista con 16 de padding → queda a 4 px → su radio es **22 − 4 = 18**,
no 14.

### Mi día: tres verticales (20/08/2026)
Números → agenda → tablero, **en el orden en que se decide una mañana**: cuánto tengo (sin la caja
ninguna prioridad se evalúa) → qué es inamovible (la hora no se negocia) → qué debo atender (lo
único que sí se reordena).

⚠️ **HALLAZGO que reencuadró el problema: el tablero YA EXISTE en el repo.** `kb-usuario/midia.md`
define Mi día como kanban con **tres pestañas — Para hoy · Haciendo · Hechas —**, swipe para avanzar
de etapa, tarjetas automáticas + manuales y control por voz. No había que inventarlo: había que
dibujarlo. De las tres verticales que planteó Martin, **dos ya existían** (el resumen es la portada
+ el detector) y **sólo el calendario es nuevo**.

- **Máximo 3 ítems por bloque en el resumen.** Un resumen que muestra todo deja de ser resumen y
  convierte Mi día en tres listas apiladas. El contador dice cuánto hay sin mostrarlo.
- **El tablero del resumen usa TARJETAS EXPANDIBLES** (rev. 20/08, ver §Tarjeta expandible). El
  carrusel con puntitos se probó y quedó atrás: resolvía la altura pero mostraba una tarjeta por vez
  y gastaba el eje horizontal.
- **El descarte por swipe vive en Mi día Y en el tablero.** Con el carrusel había tenido que mudarse
  sólo al tablero por conflicto de gestos; el expandible no usa el eje horizontal y lo devolvió.
- **En mobile los tres estados son PESTAÑAS, no columnas.** A 390 px tres columnas dan 118 px cada
  una: no cabe el nombre de un cliente. El repo ya lo resolvió así.
- **Filas de 64 px en el tablero, cards sólo en el carrusel.** Dos cards completas ocupan lo que
  cuatro filas. La card se justifica donde se ve UNA y necesita todo su contexto.
- ⚠️ **Las tarjetas automáticas no se mueven a mano**: se cierran solas cuando hacés la acción real.
  **La UI tiene que decirlo** o el usuario cree que la app no responde — es una de las dudas
  frecuentes que el propio repo documenta.
- **El sheet de detalle** da el detalle que el repo pide al tocar la tarjeta **y** es la
  **alternativa de un solo puntero** que WCAG 2.5.1 exige para el swipe.
- **Prioridad: Odobi ordena, el usuario fija arriba y oculta tipos.** El orden manual **envejece**:
  una factura que vence mañana queda abajo porque se movió la semana pasada.

### Agenda (20/08) — la única vertical nueva
- **Encabezados de día grandes en scroll continuo** (patrón CARROT Weather): reemplazan al selector
  Hoy/Semana. Un control menos, y además muestran el futuro sin que el usuario lo pida.
- ⚠️ **El bloque "sin hora" es obligatorio.** La mayoría de las tarjetas del detector no tienen
  hora: un presupuesto frío no vence a las 14:30. Forzarlas a una posición horaria **inventa un
  dato** — el mismo error que mostrar "$0" donde falta el número.
- **La fila en curso se tiñe DENTRO de la lista** (patrón Klook), no se saca aparte. Por eso el
  encabezado dice "Ahora · 10:42" y no "Hoy": la lista muestra sólo lo que queda por delante.
- **VISIÓN, no real:** que Odobi proponga huecos y que se agende una tarjeta. El backend no expone
  duración ni huecos, y **las tarjetas del detector no tienen campo de hora** — eso es cambio de
  modelo de datos, no de UI. Confirmar con David antes de dibujarlo como funcionando.

### Selección: borde + check, no relleno (20/08)
Solapas y filtros marcan lo elegido con **borde terracota + check y fondo `#FDF3EF`**, no con fill.
Así la opción activa **deja de gastar acento** y Decisión B queda intacta: la terracota sigue
marcando sólo lo que **ejecuta** algo. Patrón tomado de Quizlet.

### Botón de acción en tarjeta (rev. 20/08)
**38 px de alto · padding 16 · 15 px · margen superior 20.** Bajó de 46/20/16 porque dentro de una
card de 120 px competía con el aviso, **cuando es una salida y no el tema de la tarjeta**.
⚠️ Sigue abierta la deuda del **3,17:1** (blanco sobre `#DE7250` sin bold). Se evaluó una variante
sin fill —acento sólo en el texto, `#B04A2E` 5,43:1— que la resolvería de paso; quedó descartada
por ahora.

### Tarjeta EXPANDIBLE y rebote del swipe (20/08/2026)
Reemplazan al carrusel del resumen. Salieron de analizar **Aceternity UI**, pero el hallazgo no fue
suyo: **el expandible es lo que `kb-usuario/midia.md` ya definía** — *"Tocar una tarjeta la expande,
mostrando más detalle. Volvés a tocarla para colapsarla"* — y el prototipo no lo estaba dibujando.

- **Tocar expande in-place; al abrir otra se cierra la anterior.** Con dos abiertas la lista deja de
  leerse de un vistazo.
- **El botón de la tarjeta no colapsa**: ejecuta. `if (e.target.closest('.accion')) return`.
- **Se anima `max-height`, no `height`:** el contenido no tiene alto fijo y `auto` no interpola.
- **Tres cosas que gana sobre el carrusel:**
  1. se ven **todas** las tarjetas y el detalle de una al mismo tiempo — el contexto es lo que hace
     decidir cuál atender primero;
  2. **no gasta el eje horizontal**, así que el **swipe de descarte VUELVE a Mi día** (había tenido
     que mudarse al tablero por el conflicto de gestos);
  3. nada tapa la pantalla, a diferencia del sheet.
- ⚠️ **Consecuencia a resolver: el sheet del tablero quedó redundante.** Si el expandible ya da el
  detalle, hay que decidir si el sheet sobrevive o si el tablero también expande. Pendiente.

**Rebote del swipe** (de "Draggable Card"): pasado el umbral la tarjeta **ofrece resistencia** en vez
de seguir al dedo — avanza sólo el 28% de lo arrastrado. **No es cosmético: es lo que comunica "hasta
acá llega" sin un cartel.** Antes frenaba seca en el tope y no daba devolución.

### Qué se descartó de Aceternity UI, y por qué (20/08)
No fue purismo, fue medición: **7 de sus 10 componentes de card dependen del `hover`**, que en un
teléfono **no existe**. Traerlos sería diseñar para un puntero que el usuario no tiene.

| Componente | Por qué no |
|---|---|
| Card Hover Effect | Un fondo se desliza al pasar el mouse. Sin mouse, no pasa nada |
| 3D Card · Comet · Wobble | Inclinan según la posición del puntero; en touch **el dedo tapa la card justo donde ocurre el efecto** |
| Focus Cards | Desenfoca las demás. ⚠️ **El `BlurView` nunca desenfocó en Android** — medición del propio repo, la misma razón por la que la escucha no usa blur |
| Spotlight · Glare | Gradiente radial y destello. Es literalmente lo que prohíbe §Prohibiciones visuales |

⚠️ **Regla que deja esto:** antes de traer un patrón de una librería, verificar que **no dependa del
hover** y que no choque con las prohibiciones. Lo aprovechable de una librería suele ser la
**estructura**, casi nunca el estilo.

### Cuatro elementos de comportamiento en Mi día (20/08/2026)
Salieron de revisar los catálogos de **gluestack, RN Elements, UI Kitten y Tamagui** como *lista de
control* — qué componentes tiene una pantalla de tareas que nosotros no dibujábamos.
⚠️ **Ninguna se instaló:** las cuatro son de React Native, el prototipo es HTML, y `apps/mobile` del
repo **no usa ninguna librería de UI** (theming propio con guard `temaSinHex.test.ts`). Meter una es
decisión de arquitectura de David. **Los cuatro huecos que aparecieron son de comportamiento, no de
estética, y ninguno necesitó una librería.**

1. **Skeleton de carga.** El detector corre en el backend: hay una ventana real entre abrir la app y
   tener las tarjetas. Sin esto, esa ventana es una pantalla vacía — **que se lee como "no hay
   nada", justo el mensaje opuesto**. Respeta `prefers-reduced-motion`.
2. **Avance del día.** El repo define tres estados pero nada mostraba el progreso. **Cerrar cosas ES
   el trabajo del día**: verlo avanzar es la única devolución que el usuario recibe por hacerlo.
   ⚠️ **Cuenta sobre el total del día, no sobre lo visible** — si contara lo visible retrocedería al
   descartar, y descartar no es fracasar.
3. **Alerta crítica → SÓLO en el tablero.** El repo dice del certificado AFIP que es *"el aviso más
   importante de todos, porque si vence se te cae la facturación entera"*; como una tarjeta más, el
   sistema no distinguía **importante** de **crítico**.
   - **No va en Mi día:** allá la prioridad ya la dice el texto en color, y repetirla sería decir lo
     mismo dos veces.
   - **Va ARRIBA de las solapas:** es transversal a los tres estados — no pertenece a "Para hoy"
     ni a "Haciendo", pertenece al negocio.
   - Usa el **negro**, que ya significa peso, en vez de inventar un color de alarma.
   - ⚠️ **Se reserva a lo que ROMPE el negocio:** AFIP vencido o por vencer, conexión caída. Una
     factura impaga de 22 días es importante pero no rompe nada — esa se queda en la lista.
   - El ítem sale de la lista al subir a la alerta: el contador baja y lo crítico se cuenta aparte.
4. **Checkbox en tarjetas propias — PROBADO Y QUITADO** (Martin, 20/08). Una anotación propia ya
   cumplida **no se archiva, se borra**: mantenerla sólo alarga la lista.
   ⚠️ **Consecuencia:** descartar vuelve a depender del swipe, que es gesto de trayectoria. La
   alternativa de un solo puntero que exige **WCAG 2.5.1** pasa a ser **"Borrar" dentro de la
   tarjeta expandida** — no agrega un control a la fila, usa el detalle que el repo ya pide al tocar.

### Contabilidad se UNIFICA con Inteligencia de Negocio (20/08/2026)
Decisión de Martin. ⚠️ **Diverge del repo**, que en `kb-usuario/` las define como dos pantallas
separadas (Contabilidad = solo consulta). **Va como propuesta a David, no como reflejo de lo
construido.**

**Motivo:** las dos mostraban lo mismo. **Caja · categorías de gasto · mejores clientes · tope de
monotributo** aparecían en ambas, y el usuario tenía que elegir dónde mirar **sin un criterio que se
lo dijera**. Estaba anotado como problema abierto desde el mockup 12.

**Qué se mudó a Inteligencia:**
- **Entró / Salió** → suben al bloque negro, junto al saldo en caja
- **"En qué se te va la plata"** (desglose por categoría) → después de "Por cobrar"
- Mejores clientes y tope de monotributo → ya estaban duplicados, ahora existen una sola vez

⚠️ **La regla que sostenía a Contabilidad se conserva íntegra:** **Caja y Facturado NUNCA se
mezclan** — si se sumaran, la misma plata se contaría dos veces (al facturar y al cobrar). Se sigue
diciendo con **superficie**: caja en el bloque negro, facturado en card blanca.

**Efecto en el escritorio: 7 funciones → 6.** Registrar (Gastos · Ingresos · Facturación ·
Presupuestos) y Mirar (Inteligencia de Negocio · Clientes).

### AFIP → ARCA en toda la UI (20/08/2026)
El organismo cambió de nombre: **AFIP pasó a llamarse ARCA**. La UI usa **ARCA** en todos lados —
"Facturación ARCA", "Certificado ARCA", "no pasa por ARCA".
⚠️ **Diverge del repo**, que todavía dice AFIP en `kb-usuario/` y en los nombres de pantalla. Va como
propuesta a David: el usuario lee el nombre que ve en los comprobantes, no el histórico.
**Ícono propio:** `assets/iconos/arca.svg` — la **A real de Roboto** (la tipografía del logo del
organismo) extraída con `fontTools`, dentro de un anillo. Va a **21 px**, no 18 como los Phosphor:
un anillo completo necesita más caja que un trazo suelto para leerse igual. Variante con los dos
puntos del logo para >34 px (`arca-puntos.svg`); a 18 px desaparecen y sólo ensucian.

### Prohibiciones visuales
Orbes/esferas con glow · degradés azul-violeta · glassmorphism decorativo · estética "IA genérica". Diferenciarse de Odoo, Siri/Alexa/Copilot y fintechs azules.

### Discurso en UI
- Voseo rioplatense siempre: "contame", "dale", "ojo", "mirá", "listo", "te aviso".
- PROHIBIDO: "estoy aquí para ayudarte", "solución integral", "potenciar", "revolucionar", "empoderar", "sinergia", "optimizar", "¡increíble!", tuteo neutro, emojis en voz de Odobi.
- Errores: frontales y con salida. No sabe → lo dice. Pedido ambiguo → pregunta UNA sola cosa.
- Todo copy respeta guiones §5 del handoff.
- Insight proactivo: dato + consecuencia + acción. Falta una pata → se calla.
- Unidad de plan visible: ACCIONES/mes (nunca "consultas" ni tokens).

## Datos del repo real (última auditoría: 13/08/2026, `Odobi/repo-app/`)
> **Lo más importante del repo hoy:** el **rebrand Odobi YA está implementado** (sprint 05/08) con **3 pieles — claro (DEFAULT) · oscuro · nocturno — y un solo acento terracota `#C2452E`**; y **"sin glass: color pleno + relieve" es decisión de ellos**, justificada porque el `BlurView` nunca desenfocó en Android. El glassmorphism de las capturas es **deuda declarada**, no postura de diseño. ⚠️ **Divergencia abierta:** su acento `#C2452E` vs. nuestro par `#DE7250` (fill) + `#B04A2E` (texto). Detalle en `audit/ANALISIS-PROTOTIPO-DAVID.md` §4.1.
- **Servicios conectables: 6** — Mercado Pago ("Cobrar"), Gmail ("Mail"), Google Calendar ("Agenda"), Drive/Docs/Sheets ("Archivos"). HubSpot e Instagram PODADOS en hito 2 (no existen — no mostrarlos). Fuente: `apps/copiloto/catalog.py`.
- **HITL: implementado y funcional** — `HitlCard.tsx` (concept + service + Confirmar/Cancelar + badge "REVISAR" en cobros). El mockup 04 refina este componente real.
- **MercadoPago: funcional** (link de cobro). **Facturación (ARCA) y Presupuestos: IMPLEMENTADAS** — confirmado por Martin 22/07; el código vive FUERA del repo auditado (el repo solo tiene el diseño AFIP: máquina determinista de 9 estados, gate ESPERANDO_CONFIRMACION; "quién decide qué se emite es código, no un modelo"). Se muestran como **aplicaciones** en la sección Apps. Los mockups 05 y 06 son features reales, no visión — sin disclaimer de fechas. **BI proactivo: visión** (Graphity productivo, sin ingesta schedulada). **Plan/límites: visión** — fila "Plan: Profesional" estática, backend no expone plan; unidad = acciones/mes (doc de pricing).
- **Theming:** al 13/08 el repo ya tiene **3 pieles** (claro/oscuro/nocturno) con guard `temaSinHex.test.ts` — cero hex fuera de tokens, así que **repintar la app es tocar 2 archivos**.
- **Copy del repo YA está en voseo** ("Sos el copiloto…", "Escribile a tu copiloto…", "Retomá donde quedaron"). El tuteo detectado en la auditoría vive en el deploy viejo, no en main.
- **Nav real del repo en mobile: NO hay tabbar.** `PanelDeslizable` con dos capas (escritorio detrás / conversación adelante) y `EscritorioFunciones` con 9 tiles en 2 filas + scroll horizontal.
- **`CONTEXT.md` del repo = glosario del negocio**, cada término verificado contra código (Escritorio · Función · Apps · Card · Gate · Trabajo · Caja · Recuerdo vs Actividad). **Vocabulario a respetar en los mockups.**
- ⚠️ **No hay editar ni borrar después de guardar** (contrato §12): un dato se corrige **antes**, en la card. Por eso la card es el único control de calidad del dato de todo el producto.
- **Repo ACTUALIZADO 25/07** (zip "(2)", pisó al anterior): "Mi Día" REAL (detector determinista, **8 reglas** al 13/08: presupuestos enfriándose, facturas impagas, margen negativo, trabajo sin ingreso, gasto/mes alto, CAE por vencer, **certificado AFIP por vencer** + tarjetas para_hoy/haciendo/hecha; **4 de las 8 se cierran solas por el HECHO, no por el gesto**) · "Inteligencia" REAL (BI conversacional solo-lectura sobre 5 queries SQL, incl. `portada`: Entró/Salió/Facturado/Margen) · Facturación AFIP DENTRO del repo (emisión real + facturar por voz) · Grafo sin ingesta para tenants reales (solo dataset sintético). → El mockup 07-insight ya NO es visión.

## Estructura de la app (decisiones Martin 26/07 — reemplazan la nav de 5 tabs del 25/07)
Mapa madre: `mockups/00-mapa/` (esquema UX + navegación; las 3 decisiones estructurales dibujadas y cerradas).
- **A — ⚠️ EN REVISIÓN desde el 15/08 (ver §Modelo de capas abajo).** Nav: 3 tabs (Mi día / Chat / Apps) + Cuenta en el avatar del header (patrón Gmail/YouTube; resuelve M7 avatar sin destino). Conexiones vive DENTRO de Cuenta. Salvaguardas para que no quede oculto: 1) puntito de estado terracota en el avatar; 2) conexión caída = tarjeta en Mi día; 3) just-in-time consent al ejecutar. La app abre en Mi día (portada: Entró/Salió/Te queda/Por cobrar + tarjetas del detector + input+mic).
- **B — Terracota = SOLO lo tocable.** Deltas (−18%) y ✓✓ del chat pasan a negro/sec. Terracota queda en: mic, tab activa, links de acción, botones HITL, wordmark. "Si es terracota, pasa algo al tocarlo."
- **C — Puente Mi día→Chat:** tap en acción de tarjeta → chat abre con chip de contexto "↩ Desde tu aviso · [tema]" + HITL armado → confirmar → back a Mi día con la tarjeta en estado resultado. **07-insight DADO DE BAJA como pantalla** — el puente lo reemplaza. El chip de contexto es componente transversal (tarjetas, voz, apps).
- **Estándar de anotación (26/07, estilo uxsnaps · tipografía revisada 08/08):** texto flotante en **monoespaciada** (`ui-monospace`/SF Mono/JetBrains Mono — solo meta-capa, no cuenta como familia de UI) + flechas SVG curvas que terminan EN el elemento señalado. **Excepción por densidad (15/08):** con 6+ hallazgos sobre una misma captura las flechas se cruzan — ahí van **marcadores numerados sobre la imagen + leyenda al costado** (patrón de manual técnico). Se usó en `audit/lamina/`. **La manuscrita (Marker Felt/cursive) queda derogada** por pedido de Martin: registro serio, de spec. Se conserva el propósito original —que la anotación nunca se confunda con la UI, que es Inter—, ahora por familia técnica en vez de informal. **Tamaño: 11/15, no 14/18** — la mono es ~33% más ancha por carácter y las anotaciones tienen ancho fijo; a 14px pedían más líneas y se montaban sobre los frames.
### Modelo de capas (15–16/08/2026 — propuesta aprobada por Martin, PENDIENTE de cerrar con David)
Nace de analizar el build real (`audit/ANALISIS-PROTOTIPO-DAVID.md`). **Conserva el mecanismo que David ya construyó** —capas de profundidad movidas por un gesto, con `PanelDeslizable` resuelto y verificado en device— y cambia una sola cosa: **qué capa está adelante**.
- **Base: Mi día.** El copiloto habla primero; el detector ya corre en el backend.
- **El composer es el borde visible del panel de conversación.** Tocarlo o subirlo trae el chat: a un gesto **y** a un toque (WCAG 2.5.1), sin cartel que explique el gesto — el input ya es el signo.
- **Dos gestos verticales OPUESTOS, uno por borde:** arriba trae el escritorio de funciones, abajo trae la conversación. No compiten por el mismo movimiento: **se reparten el eje**. Como siempre asoma el borde de la capa vecina, la posición se lee sin indicador.
- **Sin tabbar.** ⚠️ **Si se adopta, deroga la Decisión A.** Mientras no se cierre con David, **los 11 mockups ya muestran este modelo** — para no presentar dos sistemas distintos en la misma reunión.
- **El escritorio: 6 funciones en grilla de 3×2, SIN bandas** (rev. 20/08). Eran 7 en dos bandas hasta que Contabilidad se unificó con Inteligencia; con Clientes en registro la división quedaba en **5 y 1**, y una banda de un solo elemento no es una banda. ⚠️ **El fundamento original era Hick-Hyman** —bajar de "una entre 9" a "una entre 2, después entre 3-4"—, y con 5+1 ese beneficio desaparece: elegir entre 5 no es más fácil que entre 6, y encima se pagan dos rótulos. **Orden por FRECUENCIA de uso**, no por categoría contable, sin scroll horizontal. Orden por **frecuencia × urgencia**, no por categoría contable. Ajustes sale de la grilla (vive en el avatar); Mi día sale de la grilla (es la portada).
- **Verbo vs. sustantivo:** la conversación ofrece **acciones** (verbos, y ahí pueden convivir Apps y Funciones); el escritorio nombra **lugares** donde está tu información (sustantivos). *Si lo decís, es verbo; si lo mirás, es sustantivo.*

### Grabar por voz: MANTENER APRETADO (24/08/2026) — deroga la escucha a pantalla completa
Decisión de Martin y David. El gesto de voz es **el de WhatsApp**, y ese es el fundamento
principal: **es el gesto que el usuario ya sabe hacer**. Un producto cuya función central es
hablar no puede permitirse que hablar sea lo que hay que aprender.

| Gesto | Qué hace |
|---|---|
| Apretar y sostener el mic | graba mientras el dedo está apoyado |
| Soltar | manda |
| Deslizar a la **izquierda** | cancela — la barra sigue al dedo y se va por donde empujó |
| Deslizar hacia **arriba** | **bloquea**: soltás el dedo y quedan Pausar · Enviar · Eliminar |

⚠️ **Umbral de bloqueo: 80 px** (subió de 56 el 24/08, probado en device). A 56 saltaba
solo: el pulgar sube unos milímetros al apretar el mic contra el borde inferior y eso ya
alcanzaba. El de cancelar sigue en 70 px, sobre el otro eje.

- ⚠️ **DEROGA el velo del lienzo al 96%** (16/08, "display por sustracción"). El argumento de
  aquella decisión —*desde dónde hablás cambia dónde aterriza lo que decís*— **se cumple mejor
  dejando la pantalla entera visible** que insinuándola al 4%. Mientras grabás **no se tapa nada**:
  sólo el campo de texto cede su lugar **dentro de la misma barra**.
- **El mic no se mueve ni cambia de caja.** Es el mismo botón el que graba y el que manda: al
  bloquear cambia de ícono (mic → avión), no de lugar. El pulgar no se reubica entre empezar y
  enviar, que es lo que permite hacer el gesto sin mirar.
- **Los tres controles del bloqueo son los del repo** (Pausar · Enviar · Eliminar). Van como
  **íconos con `aria-label`**, no como palabras: a 390 px las tres etiquetas más la onda no entran
  en una fila. En pausa la onda se apaga y aparece **"En pausa"** en texto — WCAG 1.4.1, el estado
  nunca depende sólo de que algo deje de moverse.
- ⚠️ **El bloqueo NO es una comodidad: es la alternativa que exige WCAG 2.5.1.** Mantener apretado
  es un gesto que obliga a sostener presión; sin el bloqueo, quien no puede sostenerla queda afuera
  de la función principal del producto. **Con teclado, Enter entra directo al modo bloqueado** —
  el camino accesible no es otra función, es la misma con otra puerta (WCAG 2.1.1).
- **Los dos gestos usan ejes distintos a propósito**, y gana el que domina: si el movimiento
  vertical supera al horizontal, bloquea; si no, cancela. Un gesto en diagonal no dispara los dos.
- **Menos de 1 s se descarta sin cartel de error.** Un toque accidental no merece una alerta.
- ⚠️ **El mic vive DENTRO del composer, que es el asidero del panel de conversación.** Sin
  `stopPropagation` en `pointerdown`/`move`/`up`, `arrastrable` hace `setPointerCapture` sobre el
  peek y **le roba el puntero a la grabación**. Lo mismo con Pausar y Eliminar del modo bloqueado.
- **Contraste calculado:** punto de grabación `#A32B47` s/lienzo **5,80:1** ✅ · onda `#B04A2E`
  s/lienzo **4,49:1** ✅ · tacho `#B04A2E` s/`#F8E2DB` **4,37:1** ✅ · Pausar negro s/`#F8E2DB`
  **14,56:1** ✅ · "deslizá para cancelar" `sec` s/lienzo **6,21:1** ✅ · candado `sec` s/blanco
  **7,51:1** ✅ (y `#B04A2E` s/`#FDF3EF` **4,98:1** ✅ al acercarse al umbral).
- ⚠️ Sigue vigente la cláusula del veredicto Wise A/B sobre *el único momento display*: **el
  momento cambia de mecanismo por segunda vez**. Anotarlo en `explorations/wise-ab/DECISIONES.md`
  al cerrar con David.

### Dónde aterriza lo dictado (24/08) — regla del destino
> **Lo que REGISTRA se queda en su función · lo que PREGUNTA va al chat.**

- Gastos · Ingresos · Facturación · Presupuestos · Clientes → **la card aterriza en la propia
  función**, sin abrir el chat. Es el mecanismo del 16/08 (voz contextual, mockup 11): cambió el
  gesto, **no el destino**.
- Mi día · el chat · **Inteligencia de Negocio** → **va al chat**. Inteligencia manda al chat aunque
  sea una función porque el repo la define como **BI conversacional**: responde, no registra, y no
  tiene dónde aterrizar una card.
- La card es **una sola pieza que cambia de contenido** según de dónde dictaste (`CARDS` en el
  prototipo). Lo que no cambia nunca es el contrato: **"Todavía no se guardó nada"**.
- **El título NOMBRA el registro; el botón conserva el VERBO del repo** (Martin, 24/08).
  Deroga *"Esto es lo que entendí"*, que describía cómo llegó el dato en vez de decir qué
  se va a guardar. **Un título nombra, un botón actúa** — así cada elemento hace un solo
  trabajo y no se dice lo mismo dos veces.

  | Función | Título | Botón (verbo textual del repo) |
  |---|---|---|
  | Gastos | Nuevo gasto | Guardar el gasto |
  | Ingresos | Nuevo ingreso | **Anotar que me pagaron** |
  | Facturación | Nueva factura | Emitir la factura |
  | Presupuestos | Nuevo presupuesto | Guardar el presupuesto |
  | Clientes | Nuevo cliente | Guardar el cliente |

  ⚠️ En Ingresos el repo nombra el alta con un verbo (*"Anotar que me pagaron"*). Como
  título se leía como una orden y además repetía el botón: el título va en sustantivo y
  **el verbo del repo se conserva donde sí es una acción**.

### Rótulo de contexto sobre el composer: NO EXISTE (regla dura, Martin 19/08)
**Deroga** la fila "Estás en Gastos / Estás en Facturación" del modelo de voz contextual
(16/08, mockup 11). **No va en ninguna pantalla.** El encabezado de la función ya dice dónde
estás; repetirlo arriba del composer es decir lo mismo dos veces en la misma pantalla, y el
rótulo ocupaba un renglón entero para eso. Si una pantalla necesitara declarar el destino de
lo dictado, se resuelve en el **placeholder** del campo ("Anotá un gasto, o hablá…"), que ya
lo dice y no gasta una fila. ⚠️ Lo que NO cambia es el mecanismo: dictar dentro de una función
sigue sin abrir el chat y la card sigue aterrizando en la propia función.

### Voz contextual dentro de una función (16/08, mockup 11)
- La puerta de voz de una función **es el mismo composer**, con placeholder y destino de esa función. ⚠️ El rótulo "Estás en Gastos" quedó **derogado** el 19/08 (ver arriba): la promesa la lleva el placeholder.
- **Dictar ahí NO abre el chat** (perdería el contexto que la pantalla resuelve) y **la card aterriza en la propia función**.
- **La card oscurece el fondo; grabar no.** No es estética: en la card hay una decisión pendiente (es modal), mientras grabás sólo se oye. Desde el 24/08 grabar directamente no tapa nada.
- La card es el **formulario real precargado** (mecanismo canónico del repo, 24/07) y lleva **"Todavía no se guardó nada"** — regla dura: prohibido decir "listo" con la card visible.

- Vigente además: crítica integral 26/07 (3 critical · 7 major · 4 minor) — C1 rol del chat, C2 datos del lane tranquilo del 09, M2 unificar datacard/portada, M4 "Mi día" vs "esta semana", M5 saludo display, m1 wordmark 04, m2 tabbar 04, m3 promo sin cierre, m4 placeholder.

## Lo que se conserva de la app actual
Navegación existente (Chat / Apps / Conexiones / Cuenta, ahora + Mi día) · input con mic siempre visible · "✓✓ recibido" estilo WhatsApp · infraestructura de theming (se reusa para los 2 temas).

## Formato de mockup
- `index.html` autocontenido (CSS embebido, sin build), frame mobile **390px** sobre fondo neutro.
- Anotaciones estilo uxsnaps: flechas + etiquetas alrededor del frame (patrón aplicado + fundamento en una línea).
- Cada carpeta: `DECISIONES.md` — tabla elemento → decisión → fundamento (Wilensky/Chaves/IF Catalogue/heurística) → alternativa descartada y por qué.
- Grilla 8pt estricta · CTAs en tercio inferior (thumb zone) · tap targets ≥44pt.
- MCP 60FPS para referencias de motion; cada referencia citada en DECISIONES.md. Si no responde → seguir y marcar `TODO motion-ref`.

## Plan de tareas (una a la vez, aprobación de Martin entre tareas)
0. ✅ Setup (estructura, CLAUDE.md, tokens, auditoría)
1. ✅ **CERRADA (veredicto formalizado 06/08)** — Experimento Wise A/B (`explorations/wise-ab/`). **Gana B acotada**: se adopta display en cifras clave de datacards + iconografía monocroma de trazo + escucha terracota a pantalla completa como único momento display. Se descarta de Wise: fondos teñidos, color como ambiente e ilustración decorativa. El saludo display de sesión que el veredicto adoptaba fue **derogado** después por M5 (28/07). El HTML es registro histórico, no UI vigente (usa la nav de 4 secciones). No se reabre.
2. ✅ **COMPLETA (02/08)** — Rediseño mockup por mockup post-decisiones 26/07 (07 dado de baja): 09 ✅ · 03 ✅ · 04 ✅ · 05 ✅ · 06 ✅ · 01 ✅ (el reveal pasa a ser el aterrizaje del splash) · 02 ✅ (lane 2 unificado con la anatomía del 09 + `DECISIONES.md` que faltaba) · 08 ✅ (creado de cero: Cuenta + plan + límite)
3. ✅ **COMPLETA (02/08)** — Deck assets: 27 PNG 2560×1440 en `deck-assets/` (una slide por lane) + `INDICE.md` con orden narrativo en 7 bloques y receta de regeneración (Chrome headless). El splash NO está ahí: es animación, va como Rive/video.
4. ✅ **COMPLETO (16/08)** — Análisis del build de David + los 5 pasos del plan dibujados: `audit/ANALISIS-PROTOTIPO-DAVID.md` (8 secciones) · `audit/lamina/` (la pieza para mostrarle) · mockups 10 y 11 · 03 y 09 migrados. **Lo que falta es de él, no nuestro:** cerrar la capa que va adelante y el acento único.
→ **Plan completo.** Pendientes sueltos, ninguno bloqueante: **medir la carga real de Mi día** para cerrar la duración de `Entrada` (hoy 1,5 s provisorios) · calibrar el número de acciones/mes del 08 (decisión de producto) · ~~calibrar el velo de la escucha~~ (cae con la escucha a pantalla completa, 24/08).

### Plan y límites (08, cerrado 02/08)
- **Único mockup de visión de la serie.** El backend no expone plan ni consumo. La marca de visión va en la meta-capa, NUNCA dentro del frame.
- **Unidad = acciones/mes**; "consultas" y "tokens" no aparecen dentro del frame.
- **Qué cuenta como acción (propuesta de diseño, a validar):** lo que Odobi **hace** por vos gasta (emitir, mandar, cobrar, anotar); **preguntar no gasta**. Si preguntar gastara, el usuario dejaría de preguntar — y eso es lo que hace bueno al producto.
- **Al tope, el input sigue vivo:** Odobi deja de ejecutar, no de responder.
- Guión del límite = §5 LITERAL, en el chat, con dos salidas del mismo tamaño y sin urgencia fabricada. El número (200) es **a calibrar** — experimento de producto.

### Prototipo, mapa y método (19/08)
**El prototipo es la fuente de verdad de las pantallas.** `prototipo/index.html` — 23 pantallas en
un solo archivo, gestos reales (Pointer Events, swipe con lock de eje), las dos animaciones de
arranque. Se abre una pantalla suelta con **`?ver=`** (parámetro único y comparación EXACTA: con
`includes()`, `escucha` contenía `esc` y abría también el escritorio):
`splash · entrada · esc · chat · **grabando · bloqueado · vozchat** · hitl · vacio · gastos · ingresos · factura · presu · bi ·
conta · clientes · ajustes · negocio · afip · apps · plan · cuenta · apar · hablar`
⚠️ **`escucha` se conserva como alias de `grabando`**: el mapa y el mockup 11 lo enlazan.

**`mapa-pantallas/`** — índice visual: cada pantalla dentro del marco de teléfono
(`assets/marco/telefono.png`), cargando el prototipo **por iframe, en vivo**. Escala ajustable y
anotaciones que se apagan.
- Medido sobre el PNG 2000×2000: pantalla en `left 31.30% · top 8.95% · w 37.75% · h 81.80%`,
  ratio 2,167 (iPhone 14 Pro = 2,164) — entra sin deformarse.
- ⚠️ **`calc()` NO divide px por px**: `--marco` y `--vp` van **sin unidad** o la escala no computa
  y las pantallas salen en blanco.
- ⚠️ **El PNG tiene la pantalla blanca OPACA**: el iframe va **encima** (z-index) y la isla dinámica
  se dibuja en CSS. Hacerlo transparente con `colorkey` deja halo gris en los bordes.

### Migración a iframes — COMPLETA (25/08/2026)
**Los 29 carriles de los mockups 01–11 cargan el prototipo por iframe.** No queda UI
recreada en ningún mockup: hay **una sola fuente de verdad** para las pantallas, y el
mockup aporta lo suyo — el argumento, las anotaciones, las alternativas descartadas.

⚠️ **La migración NO fue plomería.** De los 29 carriles, **15 mostraban estados que el
prototipo no tenía**: existían sólo como markup recreado en el CSS de cada mockup. Migrar
esos exigió **portarlos al prototipo primero**. Doce eran hilos de chat; tres, pantalla
propia.

**Los 12 hilos viven en `HILOS`**, un objeto que compone el `#hilo` con helpers
(`O` Odobi · `Y` usuario · `D` día · `CH` chips · `REC` recibo · `HITL`). Se abren con
`?ver=<clave>`: `onb-promesa · onb-cumplida · consent · preg · recibo · fact-voz ·
fact-hitl · fact-cae · pres-voz · pres-hitl · pres-ciclo · limite`.

**Cuatro piezas de hilo que el prototipo no tenía** y hubo que traer, porque son del
producto y no del mockup:
| Pieza | Decisión |
|---|---|
| `.mio` (burbuja del usuario) | **Arena al 30%, NO terracota.** Decisión B: la terracota marca lo que **ejecuta** algo, y un mensaje propio no ejecuta nada. Negro s/arena-30 **14,56:1** ✅. El radio se espeja respecto de la de Odobi |
| `.meta` | hora + ✓✓ recibido, 11 px en `sec` |
| `.dia` | separador de día **centrado y sin línea**: la fecha ya separa, una regla encima sería decirlo dos veces |
| `.chip-act` | respuestas sugeridas con **borde y texto, sin relleno**: son atajos de lo que podés decir; con fill competirían con el botón del HITL, que es la decisión de verdad |

**Las tres pantallas propias:**
- **`?ver=reveal`** — el aterrizaje del splash. ⚠️ Lleva el **LOCKUP completo**, no el
  wordmark suelto (regla del 18/08): el primer ingreso es el único momento donde la marca
  se presenta entera. Separación símbolo↔wordmark **0,3 × ancho** = 16 px, de la spec del
  isotipo; no se elige a ojo. La pronunciación va acá y en ningún otro lado.
- **`?ver=consent`** — el sheet just-in-time. **El hilo queda visible detrás**, y eso *es*
  el argumento: se ve qué pedido quedó esperando a que conectes.
- **`?ver=caida`** — Mi día con Mercado Pago caído. La portada **admite estar incompleta**
  (`.p-parcial`, arena s/negro **8,46:1**) en vez de mostrar un número mentiroso, y el
  aviso entra como **una tarjeta más del detector**: una conexión caída es del negocio, no
  de la app. ⚠️ **El delta se oculta**: comparar contra el mes pasado con el dato
  incompleto sería una comparación falsa — mismo criterio que el "—" en vez de "$0".

⚠️ **Los márgenes verticales entre hermanos COLAPSAN.** La advertencia de dato
incompleto quedaba pegada al importe: el `margin-top` lo absorbía el margen de la
cifra. Se resuelve con **`padding-top`**, que no colapsa. Vale para cualquier
separación que "no se aplica" sin razón aparente.

⚠️ **El asidero de un panel necesita su propio aire** (`--s2` bajo la barra). Pegado al
título, la barrita se lee como parte del encabezado en vez de como el borde agarrable
del panel. Aplica a los dos sheets: la card y el consentimiento.

⚠️ **Trampa al escribir el estado `caida`:** reescribir el `innerHTML` del label de la
portada **se llevaba el chevron**, que es lo único que dice que la portada es tocable. Se
toca `firstChild.nodeValue`, no el HTML.

⚠️ **CAMBIO DE MÉTODO (19/08): los mockups nuevos NO recrean la UI.** Los 11 primeros copiaron el
CSS del prototipo, así que había **dos fuentes de verdad** y cada cambio se propagaba a mano — de
ahí salieron varios errores. **12 y 13 cargan el prototipo por iframe**: el mockup aporta el
argumento (anotaciones, tabla de decisiones, alternativas descartadas) y la pantalla viene de un
solo lugar.

### Estructura de `mockups/` (act. 19/08)
**14 carpetas**, todas con `index.html` + `DECISIONES.md`: 00-mapa · 01-onboarding · 02-conexiones · 03-home-conversacional · 04-confirmacion-hitl · 05-facturacion · 06-presupuestos · 08-plan-limites · 09-mi-dia · **10-arranque** (15/08) · **11-voz-contextual** (16/08) · **12-funciones** (19/08, rev. 20/08: las 6 funciones, una anatomía y seis contenidos) · **13-ajustes** (19/08: la segunda gramática) · **14-mi-dia-3v** (20/08: números, agenda y tablero).
**TODOS migrados al modelo de capas (16/08): no queda ninguna tabbar en los 11.** Particularidades que resolvió la migración:
- **01:** la tabbar era un **signo narrativo** ("ya estás adentro"), no navegación → lo reemplaza **la aparición del composer**: estar adentro de Odobi es poder pedirle algo.
- **02 y 08** (pantallas de Cuenta): siguen apiladas; el argumento pasa de "no es una de las 3 tabs" a **"el avatar es la única puerta"** — lo que vuelve obligatorias sus salvaguardas (punto de estado en el avatar, conexión caída como tarjeta en Mi día).
- **05, 06 y 11** (funciones): el composer lleva **el contexto de la función** ("Estás en Facturación"), que es lo que permite dictar sin salir.
Borradas el 02/08 (estaban vacías): `05-facturacion-arca/` (duplicado del setup 22/07, nunca usada) y `07-insight-proactivo/` (dado de baja el 26/07 — su trabajo lo hace el puente de la Decisión C).

### Splash y entrada (cerrado 29/07 por Martin — `explorations/splash-o/`, `DECISIONES.md` ahí)
- **El splash largo NO es de cada arranque.** Solo **primer ingreso** y **post-logout**. Por eso 6,84 s son admisibles: el costo se paga una vez.
- **Motor:** 4 formas de familia circular que nacen en el centro, crecen y salen; la 4ª se contrae **hacia el lugar exacto de la O** en el lockup; d·o·b·i entran de la derecha con rebote. Tempo **Calmo**, aparición **Densa**.
- **Aterrizaje según sesión:** primer ingreso → "Empecemos" / "Crear una nueva cuenta" (01-onboarding); post-logout → "Entrar" / "Entrar con otra cuenta" (el ghost sin fondo ni borde, en `#B04A2E`).
- **Arranques 2..n = pieza aparte:** la O del wordmark quieta + **3 ondas que se disipan hacia afuera** (r 44→96, trazo 2,4→1,1). Aterriza en **Mi día** (09). No es el splash acelerado; su función es **cubrir la latencia de carga**. Rev. 06/08: son **arcos** (±35°→±30°, geometría del isotipo del 09), no circunferencias; y duran **1,5 s PROVISORIOS** (derogan los 420 ms del 29/07) — el número se cierra midiendo la carga real de Mi día, no a ojo. Ver §6 de su `DECISIONES.md`.
- **La deuda de botones sobre terracota quedó CERRADA:** se cayó la excepción de Inter Medium 16; rige la regla dura del 28/07 v2 (fill `#DE7250` + DISPLAY 20 Bold blanco).
- **En el prototipo (19/08):** `?ver=splash` y `?ver=entrada`. ⚠️ El splash se **copió de
  `explorations/splash-o/v2-inmersivo.html` rev.3**, que es la pieza portada a Rive — no se
  recrea desde la spec en texto: una recreación es otra versión del mismo momento. Trae los 4 blobs
  con sus rotaciones, los 3 easings propios, el generador del festón de 12 lóbulos y el guión
  `st-o → st-word → st-final`. **`--ox` se MIDE** del ancho real de "dobi" en runtime, no se estima:
  por eso la forma se posa donde va la O y el wordmark no salta después.
- **La Entrada va INVERTIDA** (Martin 19/08): fondo blanco, signo en terracota viva. El signo es
  logotipo (WCAG 1.4.3 exime logotipos) y el mensaje no depende de él.
- **Rive:** artboards `Splash` (415f @60fps) y `Entrada` (**90f** @60fps), `Entry` conectado en ambos. Al 06/08 **no quedan pendientes de archivo**: contrapunzones perforados (§5), 4 gradientes hechos por MCP y rotaciones corregidas (§6). ⚠️ **El MCP escribe la rotación `r` de shapes en RADIANES pero la lee en grados** — se coló un error de 57,3× que sobrevivió a inspección visual. Toda rotación se verifica con `queryKeyFrames`, no a ojo. Único valor abierto: la duración provisoria de `Entrada` (§6.4).

Notas por pantalla: 04-HITL es LA pantalla ("Vos confirmás, Odobi ejecuta": propuesta → detalle editable → confirmar/cancelar, componente reutilizable). 05-facturación: doble HITL según guión §5 — feature IMPLEMENTADA (Martin 22/07, código fuera del repo; el kickoff decía "visión en pausa": desactualizado). 06-presupuestos: feature implementada, hereda HITL. Ambas aparecen como aplicaciones en la sección Apps. 02-conexiones: just-in-time consent (IF Catalogue). 01-onboarding: pronunciación o-DO-bi + promesa del primer minuto con plata real.

## MÉTODO DE EDICIÓN (reglas duras — nacen de errores reales de este proyecto)

No son buenas prácticas genéricas: **cada una viene de algo que ya se rompió acá**.

### 1 · Toda edición por regex verifica el balance ANTES de guardar
```python
a, b = len(re.findall(r'<div\b', s)), len(re.findall(r'</div>', s))
assert a == b, f'desbalance {a} {b}'
```
**Lo que ya pasó:** sacar el tile de Contabilidad se llevó también el de Clientes y un `</div>`;
`<div class="tabbar">.*?</div>` cortó en el primer `</div>` de un hijo y rompió el anidamiento en
10 archivos. ⚠️ **El balance global no alcanza**: puede dar 0 con el anidamiento roto. Cuando el
reemplazo puede cruzar de un elemento al siguiente, se **acota al bloque** contando `<div>`/`</div>`
o iterando `re.finditer` sobre el contenedor — nunca con un `.*?` suelto.

### 2 · Nunca modificar un string mientras se itera sobre sus offsets
Un `for m in re.finditer(...)` que va editando `s` invalida todas las posiciones siguientes.
**Corrompió 10 archivos** con comentarios truncados (`<!-- phosphor: micropho<svg`). Se resuelve con
un solo `re.sub(patrón, función, s)`.

### 3 · Todo handler de arranque lleva guard
```javascript
const el = $('#algo');
if (el) el.addEventListener(...);
```
**Pasó dos veces en la misma sesión:** `$('#volver-midia')` y `document.getElementById('scallopPath')`
quedaron huérfanos tras refactors. `null.addEventListener` **corta el script entero**, y el síntoma
—el chat sin posicionar, tapando la pantalla— **no se parece en nada a la causa**.
Chequeo rápido: comparar los `$('#x')` del JS contra los `id="x"` del HTML.

### 4 · Verificar en ALTO REDUCIDO, no sólo en el marco de 844
El marco de escritorio ocultó un bug que en el celular **se comía el botón de cada tarjeta**: un
contenedor con `overflow:hidden` y `flex-shrink` por defecto **recorta** en vez de desbordar. Todo
render de control va también a **430×760**.

### 5 · Verificar el CONTENIDO del render, no su peso
Un PNG de headless por debajo de ~60 KB es una pantalla en blanco: **13 de 29 frames salieron
vacíos** una vez y sólo se detectó por el peso.

⚠️ **Pero el peso ya no alcanza (24/08).** Desde que los mockups cargan el prototipo por `<iframe>`,
un render mal servido no sale *vacío*: sale con **el listado del directorio** adentro del marco.
Pesaba 87 KB y **pasó el gate en 6 láminas**. Ahora se mide en gris con `ffmpeg` (PIL está roto acá):
**media > 120** —el lienzo es crema, un error renderiza casi negro— y **desvío > 8** —una lámina
plana da ~0—. Implementado en `deck-assets/frames.py::contenido_valido()`.

⚠️ **Y el verificador que lo dejó pasar se degradaba en silencio:** `tiene_contenido()` importaba PIL
con un `except ImportError` que caía **siempre**, y volvía al peso. Imprimía `-1 colores` y nadie lo
leyó como *"no verifiqué nada"*. **Un fallback silencioso convierte una verificación en decoración**:
si no puede medir, tiene que fallar ruidoso.

### 5.bis · Los mockups se renderizan por HTTP, nunca por `file://`
Bajo `file://` un `<iframe src="../../prototipo/?ver=grabando">` **no resuelve el query string** y
Chrome sirve el directorio. Los scripts de `deck-assets/` levantan un `http.server` efímero. Regla
general: **desde que hay iframes, cualquier render de un mockup necesita servidor.**

### 6 · No recrear lo que ya existe como fuente
El splash se recreó desde la spec en texto **existiendo la pieza que se portó a Rive**
(`explorations/splash-o/v2-inmersivo.html`). Una recreación es **otra versión del mismo momento**.
Antes de dibujar algo que ya se decidió: buscar el archivo.

### 8 · Un nombre de clase, un significado — y auditarlo antes de guardar
El prototipo es **un solo archivo**, así que el CSS no tiene módulos: dos pantallas
distintas que llaman igual a dos cosas distintas **se pisan en silencio**, y gana la que
está más abajo. El 24/08 había **cuatro** a la vez, y ninguna daba error:

| Clase | Significado A | Significado B | Qué rompía |
|---|---|---|---|
| `.on` | modificador genérico "visible" | — | ⚠️ **regla HUÉRFANA**: `/*comentario*/{…}.on{display:flex}`. Al borrar `#conta` el 20/08 se fue el **selector**, no la regla. `.on` sin acotar volvía flex a **cualquier** elemento de la app |
| `.bloque` | card blanca de Inteligencia | bloque de evento de la agenda | Inteligencia quedaba con fondo arena, `overflow:hidden` y padding de 9 px: el contenido se clipeaba |
| `.tope` | espaciador superior de pantalla | barra del tope de monotributo | el medidor heredaba `height:14px` |
| `.sub` | bajada de texto | subpantalla de Ajustes (`position:absolute;display:none`) | **apagaba todas las bajadas**, incluida la de la card del HITL |

**Cómo se detecta** (correr antes de guardar un cambio grande de CSS):
```python
import re
css = open('index.html').read()
css = css[css.index('<style>'):css.index('</style>')]
defs = {}
for m in re.finditer(r'(^|[\n{}])\s*(\.[\w-]+)(?=[\s,>{.:])', css):
    defs.setdefault(m.group(2), []).append(css[:m.start()].count('\n'))
print({k: v for k, v in defs.items() if max(v) - min(v) > 250})
```
Dos definiciones a más de 250 líneas de distancia = **casi seguro dos componentes
distintos**. Las cercanas son la misma regla extendida y están bien.

⚠️ **Renombrar tampoco es gratis:** al arreglar esto, `.bloque` de la agenda se renombró
a `.ev`… **que ya era la fila de "Ahora" en Mi día**. Se detectó con el mismo script. El
nombre nuevo va **verificado contra el archivo entero**, no elegido de memoria.

⚠️ **La regla no es sólo "no definir dos veces": es NO REUSAR un nombre que ya significa
otra cosa**, aunque esté definido una sola vez. Arreglando esto se marcó el bloque vacío de
Inteligencia como `.vacio` — nombre que ya era el estado vacío del **chat** (centrado, con
ilustración): el bloque se centraba entero. El script de arriba **no lo detecta**, porque
`.vacio` sigue teniendo una sola definición. Antes de inventar un modificador:
`grep -n 'class="<nombre>' index.html`.

⚠️ **Un borrado por regex puede dejar una regla sin selector.** El navegador descarta el
bloque anónimo sin avisar y sigue parseando — así que lo que viene detrás **se convierte
en una regla global**. Después de borrar un componente: buscar `*/{` y `}\.[\w-]+{`.

### 7 · Verificar contra el repo antes de diseñar
El tablero de Mi día **ya existía** en `kb-usuario/midia.md` con sus tres estados; se iba a "inventar"
un kanban que estaba definido. Antes de proponer una pantalla: leer su `kb-usuario/*.md`.

## Criterios de aprobación (autoevaluar ANTES de mostrar)
1. ¿Terracota ≤10%? (excepción display declarada aparte)
2. ¿Todos los pares texto/fondo pasan WCAG AA calculado?
2.bis ¿Ningún label sobre `#DE7250` bajó de **19 px bold**? (piso de "texto grande": 18,66 px — abajo de eso el 3,17:1 deja de ser legal y **no se nota a ojo**)
3. ¿Máx 2 familias, 4 tamaños, 2 pesos?
4. ¿Copy en voseo, sin léxico prohibido, coherente con §5?
5. ¿Cero orbes, glow azul, glassmorphism decorativo?
6. ¿"Odobi" con caja correcta en todas las apariciones?
7. ¿Grilla 8pt, CTAs en thumb zone, targets ≥44pt?
8. ¿Cada decisión anotada con fundamento citable en DECISIONES.md?
9. **¿La pantalla usa la gramática que le toca?** Bloque negro SÓLO si muestra una cifra del negocio.
10. **¿Algo se dice dos veces?** Rótulo + encabezado, wordmark + stack, control + resumen: uno solo.
11. **¿Algún gráfico quedó sin cifra?** Sin dato no se lee ni se usa: se cae.
12. **¿Falta un dato?** Va "—" con su motivo, nunca "$0".
13. **¿Se verificó en ALTO REDUCIDO (430×760), no sólo en el marco de 844?** Un contenedor con
    `overflow:hidden` y `flex-shrink` por defecto **recorta** en vez de desbordar: el marco de
    escritorio ocultó un bug que en el celular se comía el botón de cada tarjeta.

Si un punto falla → corregir antes de presentar.