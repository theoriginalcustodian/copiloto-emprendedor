# CLAUDE.md — Odobi UI (resumen operativo)

Fuente de verdad de marca: `ODOBI_HANDOFF.md` (raíz del repo). Este archivo es el resumen ejecutable. Si hay conflicto, gana el handoff.

## Qué es esto
Mockups anotados → prototipo HTML navegable → deck de justificación. UI de la app Odobi ("tu copiloto emprendedor"): copiloto conversacional y de voz para emprendedores en Argentina. Toda decisión de diseño se justifica con Wilensky, Chaves, IF Design Patterns Catalogue o principios UX verificables. Nada por gusto.

## REGLAS DURAS (no reabrir)

### Nombre
Siempre **Odobi** — mayúscula inicial, resto minúscula. NUNCA "ODOBI" en ningún contexto (logo, etiqueta, botón, versalitas). Etiqueta en versalitas que contendría el nombre → se reformula.

### Paleta (cerrada 22/07/2026)
| Rol | Hex | Uso |
|---|---|---|
| Lienzo | `#FFFFFF` / `#F7F3EC` | fondo dominante (claro) |
| Estructura | `#1A1512` | texto, fondos oscuros |
| Acento | `#DE7250` | terracota — CTA, marca, estados. **≤10% de la pantalla** |
| Acento sobre claro | `#B04A2E` | texto/links terracota sobre fondos claros |
| Apoyo | `#E8A088` | arena — jerarquía secundaria sobre oscuro |

### Contraste WCAG (calculado, no a ojo)
- **Sobre terracota (regla 28/07/2026 v2 por Martin — reemplaza a la v1 del mismo día, a la del 22/07 y al handoff §4.1):**
  - **NUNCA texto negro sobre terracota.** El texto de botones es blanco o crema.
  - **Botones de confirmación: fill terracota suave `#DE7250` + label DISPLAY 19 Bold BLANCO** — token `--fs-btn:19px`. (3.17:1 ≥ 3:1 = AA texto grande ✅.) NUNCA Inter 16px s/`#DE7250` (3.17:1 falla AA texto normal). Si un botón necesitara texto chico, el fill baja a `#B04A2E` (5.43:1). Tokens: `--accent-btn` = `#DE7250` + `--on-accent` blanco.
  - ⚠️ **19 px es el PISO, no una preferencia** (rev. 18/08, decisión de Martin: a 20 el botón pesaba más que el contenido de la pantalla). WCAG cuenta como *texto grande* el bold desde **18,66 px** (14 pt) — y eso es lo único que vuelve legal el 3,17:1. **A 18 px el botón deja de cumplir, y se ve idéntico**: es una falla que no se detecta mirando. Antes de bajar ese número hay que cambiar el fill a `#B04A2E`, no la tipografía. Se descartaron: Inter 16 sobre `#B04A2E` (perdía el bold, que Martin quiere conservar), `#B65D42` (agregaba un tercer valor) y negro sobre terracota (deroga la regla del 28/07 y arrastra la lectura a señalética de obra).
  - Íconos/gráficos s/`#DE7250` (mic, ondas, checks): blanco (3.17:1 ≥ 3:1, WCAG 1.4.11 no-texto).
  - Display grande s/`#DE7250` (≥20px Bold o ≥24px regular): blanco (3.17:1 ≥ 3:1, AA texto grande). El botón "Cortar" de la escucha usa esta vía: blanco display 20 Bold + borde blanco.
  - Texto normal sobre `#DE7250`: NO EXISTE.
- Terracota `#DE7250` como texto sobre crema/blanco PROHIBIDO (2.86:1) → usar `#B04A2E` (4.91:1). Excepción: el wordmark "Odobi" puede ir en `#DE7250` (logotipos exentos, WCAG 1.4.3 — decisión Martin 22/07).
- Regla de componente (22/07): borde del input de chat en terracota 1px — input+mic = unidad "hablarle a Odobi". Aplica a todos los mockups.
- Terracota sobre negro tostado 5.71:1 ✅ · Crema sobre negro tostado 16.37:1 ✅ · Arena sobre negro tostado 8.46:1 ✅
- **Terracota sobre negro tostado: SOLO tema oscuro (decisión Martin 08/08).** Pasa contraste (5.71:1) pero queda reservada al tema oscuro, que usa negro tostado de fondo. **En el tema claro esa combinación no se usa** — nada de islas oscuras con acento terracota sobre lienzo claro. Excepción: superficies que no son UI de la app (meta-capa de presentación, p. ej. el header del árbol).
- Toda combinación nueva se calcula ANTES de usarse.

### Proporción 60/30/10
Lienzo ≈60%, estructura ≈30%, terracota ≤10%. Terracota = señal, no ambiente. Excepción declarada: terracota plena SOLO en piezas display (splash, celebración, onboarding-reveal). Nunca UI operativa.

### Tipografía
- Display/títulos: **Plus Jakarta Sans Bold** (`assets/fonts/PlusJakartaSans-Bold.ttf`, solo Bold). **Reemplazó a NeueEinstellung el 06–07/08**: la licencia de app salía USD 375/año renovable por título. No fue un swap de títulos — **el monograma ES el glifo real de la O**, así que cambiar la fuente cambia el símbolo de marca. Se eligió midiendo con `fontTools` sobre los archivos reales (ratio ancho/alto de la O, contrapunzón, trazo horizontal): distancia 0,111 contra la referencia. Ver `explorations/tipografia-libre/DECISIONES.md`.
- UI/cuerpo: **Inter** Regular (400) y Medium (500).
- Nada más. Máx 4 tamaños de tipo por pantalla.
- Licencia: OFL — sin deuda para producción.

### Temas
Exactamente 2: claro (crema/blanco) y oscuro (negro tostado). Identidad constante: misma terracota, misma tipografía, mismos componentes. Variables semánticas idénticas en ambos (`tokens/odobi.css`).

### Sistema de identidad gráfica (cerrado 28/07/2026 por Martin — aplica a TODA la app)
Origen: feedback "falta personalidad, sabor demasiado minimalista" + referencias Plum/Copilot Money/Quicken (`references/`). Estrenado en el 09; se propaga a cada mockup al tocarlo.
- **Dos capas:** microdetalle en UI diaria (monograma + tiles con íconos) + ilustración spot en momentos clave (estados vacíos/calma, onboarding, celebración, splash).
- **Símbolo: el ISOTIPO DE DAVID (decisión Martin 18/08 — reemplaza al monograma "la o que habla").** Cuatro arcos concéntricos abiertos a la izquierda, sin punto central. Fuente: `repo-app/.../docs/Imagen de marca/isotipo-odobi/` (positivo · negativo · monocromo + los dos lockups), con spec propia: resguardo 0,5 u, separación símbolo↔wordmark 0,3 × ancho, bbox medido con `getBBox()`. **Se adopta la spec completa, no sólo el dibujo.**
  - **Dos variantes por escala, y no es opcional:** **≤24 px → 3 arcos** (se quita el interno) con `stroke-width` **1.6** y `viewBox="1.20 1.26 21.48 21.48"`; **>24 px → los 4 arcos** con **1.3** y el `viewBox` nativo `0 0 24 24`. Medido: a 16 px el arco interno (r 4,5) colapsa y se funde con el exterior — el signo pierde estructura. Es el mismo problema que tenía el monograma anterior con las barras adentro de la O, al revés.
  - ⚠️ **En chico va el `viewBox` AJUSTADO al bbox, no el nativo.** El `viewBox` 0-24 trae mucho aire alrededor del símbolo (su bbox real es 18,88 × 17), así que a 16 px el signo se dibuja al ~66 % de su caja: se ve chico, desvaído y "cortado". El ajustado = bbox + medio trazo + el resguardo de 0,5 u que pide la spec, en caja cuadrada para no deformarlo. Detectado probando el prototipo en el celular, no en el escritorio.
  - **100% stroke, sin fill.** Hereda el color por CSS del contenedor (`stroke:var(--sec)` / `var(--terracota)`), así que un solo marcado sirve para claro y oscuro.
  - **Qué se pierde y qué se gana:** el monograma anterior era *la O real del wordmark*, y su argumento era la constancia de signo (la misma letra en el logo y en el símbolo). El de David no deriva de la letra. **El símbolo deja de decir el nombre y pasa a decir qué hace el producto** — y de paso deja de depender de la tipografía, que ya nos costó regenerar 24 paths al cambiar de fuente.
  - Usos: labels de sección que hablan por Odobi ("PARA HOY", en `sec`), avatar de Odobi en el chat, estados vacíos, brand del árbol, splash y entrada.
  - **Dónde va cada pieza de marca (regla cerrada 18/08):**

    | Pieza | Dónde | Por qué |
    |---|---|---|
    | **Lockup** (símbolo + wordmark) | Splash / primer ingreso · piezas de marca (deck, árbol) | Es el único momento donde la marca se presenta entera. `assets/marca/lockup-horizontal.svg` |
    | **Símbolo solo** | Entrada de arranques 2..n · labels de sección · avatar de Odobi en el chat · estados vacíos | Es una **firma**, no una presentación: adentro de la app el nombre ya se sabe |
    | **Wordmark solo** | Header de la app | El símbolo ya trabaja adentro de la pantalla (labels, avatar). Ponerlo también arriba gastaría dos veces el mismo signo |

  - ⚠️ **El lockup NO se copia del repo de David:** su `lockup-horizontal.svg` declara **NeueEinstellung** en el `<text>` — la tipografía que derogamos por licencia. Se rehízo en `assets/marca/lockup-horizontal.svg` conservando su geometría (bbox del símbolo, separación óptica 0,3 × ancho = 5,66 u) pero **recalculando la `x` del texto**: depende del sidebearing izquierdo, que en NeueEinstellung era ~2,624 u y en Plus Jakarta es 0,675 u (medido con `fontTools` sobre `hmtx`). Copiar su `x=29.66` deja la separación en 7,6 u en vez de 5,66.

  - **Consecuencia pendiente:** la animación `Entrada` de Rive (arranques 2..n) se rehace con este signo — encaja natural, porque **ya son arcos**: la onda deja de ser un adorno alrededor de la letra y pasa a ser el propio símbolo desplegándose.
- **Ilustración spot:** line-art trazo negro `#1A1512` 2–2.5px + fill arena `#E8A088`/crema; detalles secundarios (vapor, suelo) en lápiz `#8A7F73`; chispas 4 puntas (1 terracota máx + resto arena). Objetos del mostrador argentino (taza de café, mate, facturas, tickets, changuito). Fill terracota en ilustración: por defecto NO (Decisión B: terracota = tocable); excepción decidida por Martin 28/07 para la taza del calm del 09 (su dibujo `assets/illustrations/taza-original.svg` + capas terracota en `assets/illustrations/taza.svg`). Si Martin pasa un dibujo propio, se usa TAL CUAL (no recrear ni reinterpretar).
- **Íconos: PHOSPHOR, peso `regular`** (phosphoricons.com, MIT — decisión Martin 19/08; **deroga Iconoir**, del 28/07). Set en `assets/iconos/` + `LEEME.md`.
  - **Por qué Regular, medido:** el grosor de cada peso, como proporción del alto del ícono (única forma de comparar sets con distinto `viewBox` — Phosphor usa 256, nosotros 24): Light **4,69 %** · **Regular 6,25 %** · Bold 9,38 %. El isotipo chico pesa **6,67 %**. **Regular es el único que pesa como el símbolo de la marca.** De paso quedó a la vista que los tiles con Iconoir usaban trazo 2 = **8,33 %**: el ícono de una tarjeta pesaba más que el signo de Odobi.
  - ⚠️ **Phosphor es `fill`, no `stroke`:** viene outlineado. El color se hereda por `fill="currentColor"` + `color` en el contenedor, pero **el grosor NO se ajusta por CSS** — si hace falta otro peso, se baja otro set; nunca se toca `stroke-width`. A cambio se ve idéntico a cualquier escala.
  - **Convivencia con el isotipo, que sí es `stroke`:** regla global `svg[viewBox="0 0 256 256"]{fill:currentColor;stroke:none}` y cada contenedor declara **`stroke` y `color` con el mismo valor** — el isotipo toma el `stroke`, Phosphor el `color`. ⚠️ **El isotipo lleva `fill="none"` inline, no por CSS**: cuando el `fill:none` vivía en la hoja de estilos, apagaba a Phosphor; al sacarlo de ahí, los isotipos que no lo traían inline se rellenaron.
  - Tamaños: **18 px** en tiles de tarjeta y escritorio · **20 px** en el composer · **34 px** en estados vacíos y encabezados. Comparativa que fundó la decisión: `explorations/iconos/`.
  - El isotipo y las ilustraciones spot siguen siendo dibujo propio (marca, no librería). Cero emojis como íconos.
- **Tint derivado:** `--arena-30:#F8E2DB` (arena 30% s/blanco). Negro s/tile 14.56:1 ✅ · sec s/tile 6.04:1 ✅.
- **Techo:** nada de 3D, profundidad ni sombreado kilométrico (el exceso que Martin señaló); la identidad es trazo y objeto, no efecto.

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
> **Lo más importante del repo hoy:** el **rebrand Odobi YA está implementado** (sprint 05/08) con **3 pieles — claro (DEFAULT) · oscuro · nocturno — y un solo acento terracota `#C2452E`**; y **"sin glass: color pleno + relieve" es decisión de ellos**, justificada porque el `BlurView` nunca desenfocó en Android. El glassmorphism que se ve en las capturas es **deuda declarada**, no una postura de diseño. ⚠️ **Divergencia abierta:** su acento `#C2452E` vs. nuestro par `#DE7250` (fill) + `#B04A2E` (texto). Detalle en `audit/ANALISIS-PROTOTIPO-DAVID.md` §4.1.
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
- **El escritorio: 7 funciones en 2 bandas** (Registrar / Mirar), sin scroll horizontal. Orden por **frecuencia × urgencia**, no por categoría contable. Ajustes sale de la grilla (vive en el avatar); Mi día sale de la grilla (es la portada).
- **Verbo vs. sustantivo:** la conversación ofrece **acciones** (verbos, y ahí pueden convivir Apps y Funciones); el escritorio nombra **lugares** donde está tu información (sustantivos). *Si lo decís, es verbo; si lo mirás, es sustantivo.*

### La escucha: display por sustracción (16/08)
Deroga la escucha terracota a pantalla completa. **No tapa: silencia.**
- **Velo del color del lienzo de la piel activa al 96%** (crema en claro, negro tostado en oscuro). Como toma el color del tema, **no hay isla oscura sobre lienzo claro** — la regla del 08/08 se respeta sin excepción.
- **96% y no 90%:** calculado en el peor caso (contenido de máximo contraste detrás) — a 94% la terracota profunda da 4,37:1 ✗; a 96% da **4,53:1** ✅ (claro) y **5,21:1** ✅ (oscuro). Ese 4% restante es lo que hace que el fondo **se insinúe**.
- **Sin blur:** el `BlurView` nunca desenfocó en Android (medición del propio repo).
- **La onda va en `#B04A2E` sobre velo claro** — `#DE7250` queda en ~2,9:1 y no llega al 3:1 que pide 1.4.11 para un gráfico. Sobre velo oscuro sí va la viva.
- **Controles del repo:** Pausar · Enviar · Eliminar. No se reinventa lo probado en device.
- ⚠️ Modifica la cláusula del veredicto Wise A/B que declaraba la escucha full-terracota como *el único momento display*: el momento sigue, cambia de mecanismo. Anotarlo en `explorations/wise-ab/DECISIONES.md` al cerrar con David.

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
- **La card oscurece el fondo; la escucha no.** No es estética: en la card hay una decisión pendiente (es modal), en la escucha sólo se oye.
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
1. ✅ **CERRADA (veredicto formalizado 06/08)** — Experimento Wise A/B (`explorations/wise-ab/`). **Gana B acotada**: se adopta display en cifras clave de datacards + iconografía monocroma de trazo + escucha terracota a pantalla completa como único momento display. Se descarta de Wise fondos teñidos, color como ambiente e ilustración decorativa. El saludo display de sesión que el veredicto adoptaba fue **derogado** después por M5 (28/07). El HTML es registro histórico, no UI vigente (usa la nav de 4 secciones). No se reabre.
2. ✅ **COMPLETA (02/08)** — Rediseño mockup por mockup post-decisiones 26/07 (07 dado de baja): 09 ✅ · 03 ✅ · 04 ✅ · 05 ✅ · 06 ✅ · 01 ✅ (el reveal pasa a ser el aterrizaje del splash) · 02 ✅ (lane 2 unificado con la anatomía del 09 + `DECISIONES.md` que faltaba) · 08 ✅ (creado de cero: Cuenta + plan + límite)
3. ✅ **COMPLETA (02/08)** — Deck assets: 27 PNG 2560×1440 en `deck-assets/` (una slide por lane) + `INDICE.md` con orden narrativo en 7 bloques y receta de regeneración (Chrome headless). El splash NO está ahí: es animación, va como Rive/video.
4. ✅ **COMPLETO (16/08)** — Análisis del build de David + los 5 pasos del plan dibujados: `audit/ANALISIS-PROTOTIPO-DAVID.md` (8 secciones) · `audit/lamina/` (la pieza para mostrarle) · mockups 10 y 11 · 03 y 09 migrados. **Lo que falta es de él, no nuestro:** cerrar la capa que va adelante y el acento único.
→ **Plan completo.** Pendientes sueltos, ninguno bloqueante: **medir la carga real de Mi día** para cerrar la duración de `Entrada` (hoy 1,5 s provisorios) · calibrar el número de acciones/mes del 08 (decisión de producto) · calibrar el velo de la escucha contra contenido real cuando haya build.

### Plan y límites (08, cerrado 02/08)
- **Único mockup de visión de la serie.** El backend no expone plan ni consumo. La marca de visión va en la meta-capa, NUNCA dentro del frame.
- **Unidad = acciones/mes**; "consultas" y "tokens" no aparecen dentro del frame.
- **Qué cuenta como acción (propuesta de diseño, a validar):** lo que Odobi **hace** por vos gasta (emitir, mandar, cobrar, anotar); **preguntar no gasta**. Si preguntar gastara, el usuario dejaría de preguntar — y eso es lo que hace bueno al producto.
- **Al tope, el input sigue vivo:** Odobi deja de ejecutar, no de responder.
- Guión del límite = §5 LITERAL, en el chat, con dos salidas del mismo tamaño y sin urgencia fabricada. El número (200) es **a calibrar** — experimento de producto.

### Estructura de `mockups/` (act. 16/08)
11 carpetas, todas con `index.html` + `DECISIONES.md`: 00-mapa · 01-onboarding · 02-conexiones · 03-home-conversacional · 04-confirmacion-hitl · 05-facturacion · 06-presupuestos · 08-plan-limites · 09-mi-dia · **10-arranque** (15/08: el modelo de capas dibujado) · **11-voz-contextual** (16/08: dictar sin salir de la función).
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
- **Rive:** artboards `Splash` (415f @60fps) y `Entrada` (**90f** @60fps), `Entry` conectado en ambos. Al 06/08 **no quedan pendientes de archivo**: contrapunzones perforados (§5), 4 gradientes hechos por MCP y rotaciones corregidas (§6). ⚠️ **El MCP escribe la rotación `r` de shapes en RADIANES pero la lee en grados** — se coló un error de 57,3× que sobrevivió a una inspección visual. Toda rotación se verifica con `queryKeyFrames`, no a ojo. Único valor abierto: la duración provisoria de `Entrada` (§6.4).

Notas por pantalla: 04-HITL es LA pantalla ("Vos confirmás, Odobi ejecuta": propuesta → detalle editable → confirmar/cancelar, componente reutilizable). 05-facturación: doble HITL según guión §5 — feature IMPLEMENTADA (Martin 22/07, código fuera del repo; el kickoff decía "visión en pausa": desactualizado). 06-presupuestos: feature implementada, hereda HITL. Ambas aparecen como aplicaciones en la sección Apps. 02-conexiones: just-in-time consent (IF Catalogue). 01-onboarding: pronunciación o-DO-bi + promesa del primer minuto con plata real.

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

Si un punto falla → corregir antes de presentar.
