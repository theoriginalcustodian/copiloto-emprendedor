# DECISIONES — 09 · Mi día (portada del negocio)

Origen: análisis Biyuya vs Odobi (25/07, `Odobi/REPORTE-MEJORA-ODOBI.md`) + repo actualizado (Mi Día e Inteligencia son features REALES: `apps/copiloto/mi_dia_detector.py`, `inteligencia_queries.py`). **Rediseñado 26/07** tras el mapa (`00-mapa`) y la crítica integral: aplica las decisiones A/B/C cerradas por Martin. Todos los ratios WCAG calculados, no estimados.

## Identidad gráfica 28/07 (feedback de Martin: "falta personalidad, sabor demasiado minimalista")

Origen: análisis de referencias que pasó Martin (Plum, Copilot Money, Quicken — `odobi-ui/references/`). Diagnóstico: el 09 tenía sistema (grilla, jerarquía, color) pero cero capa identitaria. Modelo a traducir: Plum (ilustración spot + símbolo repetible); Quicken es el contraejemplo genérico. Las 4 decisiones las cerró Martin el 28/07.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Alcance del sistema | **Ambas capas**: microdetalle en la UI diaria (monograma + tiles con íconos) + ilustración spot en momentos clave (estados vacíos, onboarding, celebración) | Plum demuestra que la personalidad vive en la repetición chica de todos los días Y en los momentos display. Una sola capa deja la app genérica (Quicken) o disfrazada (ilustración sin sistema) | Solo ilustraciones grandes — la UI diaria seguiría anónima; solo microdetalle — sin momentos de marca memorables |
| Símbolo identitario | **La "o" de Odobi como monograma**: círculo + onda de voz adentro (3 barras verticales redondeadas) — "la o que habla" | Wilensky: la invocación por voz es LA impresión de marca; el monograma la condensa. Sale del wordmark (no se inventa un símbolo ajeno, patrón Plum: el logo ES el ícono de producto). Reutilizable: junto a "PARA HOY", avatar de Odobi en chat, splash | Mascota/carita — pide animación y tono que la marca no tiene; ícono abstracto nuevo — segundo símbolo compitiendo con el wordmark |
| Estilo de ilustración | **Line-art + fills parciales**: trazo negro `#1A1512` 2–2.5px, fill arena `#E8A088` (+ crema), chispa terracota mínima. Objetos del mostrador argentino (mate, facturas, tickets), chispas 4 puntas, vapor/suelo en lápiz | Traduce el DNA de Plum a la paleta cerrada sin abrir colores nuevos. Los objetos del mundo del usuario (kiosquero, gasista) hacen la marca propia, no genérica. Trazo = mismo lenguaje que la iconografía → un solo sistema de dibujo | Ilustración con relleno pleno multicolor (Plum literal) — rompe la paleta y el 60/30/10; 3D/sombreado profundo — el error que Martin señaló de David |
| Íconos de tarjeta | **Iconoir** (iconoir.com, MIT — decisión Martin 28/07) en tiles arena-30 (36×36, `#F8E2DB`): `clock` (se enfría), `page` (factura impaga), `graph-up` (gasto alto). Embebidos inline con stroke 1.5→2 para calzar con el trazo del sistema | Una sola fuente de íconos (~1400) = consistencia garantizada al escalar a los demás mockups; line-art 24×24 puntas redondeadas, mismo lenguaje que la ilustración. Tile arena = identidad sin semántica de tocable. Cero emojis | SVG dibujados a mano (primera versión) — consistencia frágil al crecer el set; emojis estilo Copilot Money — ajenos a paleta y trazo |
| Identidad vs. Decisión B | Los fills de identidad van en **arena** (no tocable); terracota queda solo en chispas mínimas decorativas. El monograma junto a "PARA HOY" va en `sec` | La Decisión B ("si es terracota, pasa algo al tocarlo") no se negocia: una ilustración terracota se leería tocable. Arena ya es el rol "apoyo/jerarquía secundaria" de la paleta | Ilustración con fill terracota — invalida la semántica recién cerrada; monograma terracota en el label — parecería un botón |
| Copys de tarjeta acortados | t1 "va 31 días sin respuesta. Se enfría." (31 días: la regla `presupuestos_enfriandose` del detector dispara al superar el default de 30 — corregido de 12 el 28/07, decisión Martin) · t2 "debe la factura A-0034" · t3 "50% arriba del promedio. Se comen el margen." | El tile angosta la caja de texto (~276px): 2 líneas máx para que las 3 tarjetas entren en el board sin scroll. Dato + consecuencia intactos | Mantener copys largos — 3 líneas empujan la tercera tarjeta fuera del viewport |
| Agrupación de tarjetas | Gap del board 16 → 8 | Ley de proximidad: las 3 tarjetas son un grupo ("PARA HOY"); además libera presupuesto vertical para los tiles | Mantener 16 — el grupo respira más pero la tarjeta 3 se corta |

Contrastes nuevos (calculados): negro s/tile `#F8E2DB` 14.56:1 ✅ · sec s/tile 6.04:1 ✅ · tile s/blanco 1.24:1 (decorativo, sin requisito) · arena s/blanco 2.14:1 (fill de ilustración, no-texto decorativo, sin requisito AA).

Ajuste 28/07 (pedido de Martin con referencia visual `Odobi/taza.png`): la ilustración del calm pasa de mate a **taza de café**. Segunda ronda: Martin pidió usar **su dibujo tal cual** (trazado `assets/illustrations/taza-original.svg`) con los colores terracota de su referencia — se descartó la recreación a mano y la traducción a arena. Implementación: el trazado de Martin intacto (solo `#000000`→`#1A1512` por paleta) + capas de color debajo del trazo (`assets/illustrations/taza.svg`): espuma terracota `#DE7250`, pico de crema `#F7F3EC`, plato terracota. Nota de tensión con la Decisión B (terracota = tocable): Martin decide la excepción explícitamente para esta ilustración — queda como spot único del calm state, no se generaliza el fill terracota al resto de la identidad. Martin aprobó la taza con terracota el 28/07 ("quedó bien, dejala así").

## Monograma rev. 29/07 — la O real, ondas afuera (decisión Martin)

Origen: al armar la entrada de los arranques 2..n (`explorations/splash-o`), Martin rechazó el monograma dibujado — *"prefiero que sea la O de Odobi con la tipografía correspondiente y unas ondas en degradé disipándose hacia afuera"*. Eso puso en tensión la definición del 28/07 (círculo stroke 2,2–2,4 + 3 barras verticales adentro), que era la que usaba este mockup junto a `PARA HOY`.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| El signo | **El glifo real de la O** de NeueEinstellung Bold, extraído del OTF como path — el mismo que el wordmark y que la entrada | Un solo signo en todas las escalas. El círculo dibujado era *parecido* a la O pero no era la O: dos signos casi iguales conviviendo es peor que uno solo (Chaves: la identidad se sostiene por constancia del signo, no por familia de aproximaciones) | Círculo dibujado stroke 2,4 (28/07): a 14–16px lee bien, pero obliga a mantener dos versiones del mismo símbolo y a decidir en cada pieza cuál toca |
| Las ondas | **Afuera**, dos arcos concéntricos al centro óptico de la O, trazo **1,6 → 1,1** hacia afuera, despejados 1,3px del borde derecho del glifo | Adentro no entran: a este tamaño el contrapunzón de la O real mide ~5px y tres barras se empastan — esa es la razón técnica por la que el 28/07 se había dibujado un círculo de trazo fino (contrapunzón grande). Afuera el problema desaparece y además el trazo que adelgaza reusa el lenguaje de disipación de la entrada | Barras adentro con el glifo real: ilegible al tamaño de uso. Agrandar el ícono para que entren: rompe la jerarquía del label (13px) |
| Color | O y ondas en `sec` `#5C534C` (7,51:1 s/blanco ✅) | Decisión B intacta: acompaña al texto, no se lee tocable. La O va en terracota **solo** cuando actúa de wordmark o en escala display | Monograma terracota en el label: parecería un botón |
| Implementación | La O es un `fill`, las ondas son `stroke`, los dos heredando `sec` por CSS | El glifo tipográfico es una forma rellena, no un contorno: forzarlo a stroke lo desdibujaría | — |

Alcance: se aplica acá (label `PARA HOY`) y se propaga al avatar de Odobi en el chat (03) y a cualquier label que hable por Odobi, al tocar cada mockup.

Íconos 28/07 (segunda ronda): toda la iconografía del 09 pasa a **Iconoir** — tiles (`clock`/`page`/`graph-up`), mic (`microphone`), tab bar (`sun-light`/`chat-bubble-empty`/`view-grid`), en ambos lanes. Colores intactos (heredan por CSS: sec en tabs, terracota en tab activa, blanco en mic, negro en tiles).

## Rediseño 26/07 (aplica decisiones del mapa + crítica integral)

| Cambio | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Nav 5 tabs → **3 tabs + avatar** | Mi día / Chat / Apps; Cuenta en el avatar del header (con puntito de estado), Conexiones dentro de Cuenta | Decisión A cerrada 26/07 en `00-mapa`: frecuencia de uso + Jakob's Law (patrón Gmail/YouTube) + Nielsen #8. Resuelve M3 y M7 (avatar sin destino) | 5 tabs (25/07) — Conexiones y Cuenta, de baja frecuencia, en máxima jerarquía diaria |
| Delta −18% terracota → **negro** | `.p-delta` en `#1A1512` (16.37:1 s/crema ✅) | Decisión B: terracota = solo lo tocable. El delta es dato, no botón; el signo informa. Bonus: el delta positivo (+16% del lane 2) no necesita un verde fuera de paleta | Terracota para el dato malo — doble semántica (M1): el usuario adivina si es alerta o link |
| Lane tranquilo con **datos coherentes** | Sábado 26: Entró $406.000 (+16%), Por cobrar $0 — Gómez pagó tras el reclamo del viernes | Resuelve C2 de la crítica: el detector determinista NO puede callarse con una factura vencida visible en "Por cobrar". El silencio del tablero ahora es verificable contra sus propios números (286+120=406 · 406−194=212 · 406/349=+16% ✓) | Mantener los números del viernes con lane vacío — el mockup contradecía la feature que muestra: tablero mentiroso |
| Tarjeta 3 (lectura) con el **mismo affordance** | Las 3 acciones son idénticas: link terracota 48pt → chat con chip de contexto | Con la Decisión C el patrón se unifica: TODA acción de tarjeta abre el chat (unas arman HITL, otras responden con datos). Un solo gesto que aprender — M6 deja de ser inconsistencia y pasa a ser regla | Distinguir acciones "ejecutan" vs. "leen" con estilos distintos — dos affordances para el mismo gesto (tap → chat) confunden más de lo que aclaran |
| Cierre narrativo del puente | Lane 1 = antes (reclamá), lane 2 = después (pagó, la tarjeta se fue sola) | La secuencia del canvas 4 del mapa contada con las dos superficies reales; demuestra "tarjetas que se van solas" con datos, no con promesa | Dos lanes con la misma semana congelada — desaprovecha el par de frames para contar el ciclo |
| Anotación → **estándar uxsnaps** | Texto flotante en **monoespaciada** (meta-capa — manuscrita hasta el 08/08) + flechas SVG curvas que terminan EN el elemento | Estándar 26/07 (pedido de Martin con referencia visual): el indicador apunta al elemento per se, no a la zona | Columnas de cajas con conector recto — señalan la fila, no el elemento |
| Etiqueta de alcance (M4) | El tab dice el lugar ("Mi día"); `p-label` dice el rango del número ("Entró esta semana") | Cada texto un solo trabajo (label labels). El rango vive junto al dato, donde se lee | Renombrar el tab "Mi semana" — rompe el nombre real de la feature (`mi_dia_*`) |

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Existencia de la pantalla | Portada del negocio como pantalla de apertura: números + avisos accionables | Diagnóstico del reporte 25/07: el ciclo *hacés → queda anotado → Odobi vigila → preguntás* ya existe en backend pero es invisible → sensación de "funciones sueltas". Biyuya demuestra que UN objeto central visible da sensación de sistema. Acá el objeto es el negocio contabilizado | Dejar el chat como única superficie — mantiene el problema: la data que Odobi acumula no se ve nunca; el valor del registro automático no se percibe |
| Nombre del tab | "Mi día" | Nombre real de la feature en el producto (hito 7, `mi_dia_*`). Coherencia producto-UI, humano, sin jerga | "Negocio" — literal pero frío; "Hoy" — pierde el vínculo con la feature real; "Dashboard" — anglicismo y promete gráficos que no hay |
| Nav 5 tabs **(SUPERADA 26/07 → ver tabla de rediseño)** | Mi día / Chat / Apps / Conexiones / Cuenta — se suma, no se reordena | Nielsen #6: los 4 tabs existentes ya están aprendidos por usuarios de prueba; sumar no rompe lo reconocido. Jakob's Law: 5 tabs es el estándar local (WhatsApp, Mercado Libre, Instagram) | 4 tabs mudando Conexiones a Cuenta — más limpio pero obliga a reaprender; Martin eligió sumar (25/07) |
| Apertura de la app en Mi día | Landing = portada, no chat | El sistema visible primero (reporte §4 paso 1). La voz no se degrada: input+mic viven también acá | Abrir en Chat — conservador con la identidad de voz, pero repite el statu quo: la data invisible. La invocación por voz no depende del tab (mic siempre visible) |
| Bloque portada | Entró (display 28) + delta + Salió / Te queda / Por cobrar (3 columnas) sobre crema | Query real `portada` (definición única de cada número en SQL — invariante del repo). "La marca habla donde está el valor" (Wise B): la cifra grande en NeueEinstellung. Fondo crema = lienzo, no acento | Dashboard con gráficos — decoración; regla del reporte: si un dato no viene con acción posible, no suma. Torta/curvas quedan para la inteligencia conversacional a pedido |
| Vocabulario de los números | "Entró / Salió / Te queda / Por cobrar" | Voseo §5 y lenguaje de mostrador, no de contador. Coincide con las herramientas reales (`entro_vs_salio`) | "Ingresos / Egresos / Margen" — correcto pero ajeno al usuario kiosquero/gasista; "margen" queda para conversación con contexto |
| Tarjetas "Para hoy" | Card blanca: afirmación con dato + consecuencia + acción única en `#B04A2E` (fila 48pt) | Regla de oro del insight (handoff §0). Las 3 tarjetas mapean reglas REALES del detector determinista (presupuesto enfriándose, factura impaga vieja, gasto/mes 1,5× promedio — sin LLM). IF Catalogue: transparencia de decisión automatizada: el dato que dispara el aviso está en el texto | Feed de "insights" generados por LLM — no existe en el producto y viola el listón (verificabilidad); más de una acción por tarjeta — diluye; badge de severidad por color — sumaría un código de color fuera de paleta |
| La tarjeta no ejecuta | La acción abre el chat con la propuesta HITL armada | Regla real del producto: la inteligencia es solo-lectura, las órdenes se derivan al chat ("Eso lo puedo ejecutar, pero no desde acá"). Refuerza el patrón madre: TODO write pasa por confirmar (mockup 04) | Botón "Mandar" en la tarjeta — ejecutar desde el tablero rompe la única puerta de escritura (HITL en chat) y duplica el patrón de confirmación |
| Acciones como texto-link, no botones | `#B04A2E` Medium, fila 48pt, flecha | Terracota = señal (§paleta). Tres botones rellenos de acento en una pantalla romperían el techo del 10% y competirían con el mic (único fill). AA: 5.43:1 s/blanco ✅ | Botones terracota por tarjeta — presupuesto de acento excedido; botones outline negros — leen como acción secundaria cuando son LA acción de la tarjeta |
| Estado "día tranquilo" | Portada + "Nada urgente por hoy." (display 20) + salida conversacional | La regla de oro corta en las dos puntas: sin dato+consecuencia+acción, Odobi se calla (§5: insight que no cierra → silencio). Tablero honesto = credibilidad de los avisos reales. Nielsen #3: "preguntame" deja el control al usuario | Rellenar con tips genéricos o celebraciones ("¡vas genial!") — léxico prohibido y erosiona la confianza; pantalla vacía sin mensaje — parece error, no calma |
| Tarjetas se van solas (anotado) | Cierre automático al desaparecer el problema + caducidad 21 días + anti-repetición | Comportamiento real del producto (tarjeta store + log de silencios). El tablero muestra lo vigente, no acumula culpa — diferencia clave con un to-do app | Persistir tarjetas hasta que el usuario las cierre — convierte el tablero en deuda emocional; ya está resuelto en el producto, la UI no debe contradecirlo |
| Input + mic en Mi día | Barra idéntica al chat (borde terracota, mic 48pt) | Wilensky: la invocación por voz es la impresión de marca (20+/día) y no puede depender del tab activo. Regla de componente 22/07 (input+mic = unidad) | Solo FAB de mic sin input — pierde la unidad y el canal escrito; sin barra — obliga a ir a Chat para hablar, degrada el canal identitario |
| Ícono del tab | Sol monocromo stroke 2 | Iconografía monocroma (veredicto Wise B), metáfora directa de "día". Activo en `#B04A2E` (4.91:1 s/crema, 5.43:1 s/blanco ✅) + Medium | Ícono de checklist — lee como tareas/to-do, y Mi día no es un to-do (las tarjetas se van solas); casa/home — genérico, no dice "hoy" |
| Datos del mockup | $286.000 / −18% (semana del mockup 03) · Salió $194.000 · Te queda $92.000 (286−194=92 ✓) · Por cobrar $120.000 = factura Gómez SRL · presupuesto Lucía $180.000 | Continuidad narrativa entre mockups (preferencia Martin): la misma semana contada desde otra superficie. El "Por cobrar" y la tarjeta de factura impaga son el mismo dato — coherencia interna verificable | Cifras nuevas por pantalla — cada mockup contaría un negocio distinto y el deck perdería el hilo |
| Espaciado | Grilla 8pt: paddings 8/16/24, gap 16, filas de acción y targets 48pt | Kickoff §1 | — |
| Motion | Tokens provisorios (120/200/320ms). Entrada de tarjetas con stagger sutil | `TODO motion-ref`: validar con MCP 60FPS (no disponible en esta sesión) | — |

## Contrastes usados (todos calculados)
- Negro `#1A1512` s/crema `#F7F3EC`: 16.37:1 ✅ · s/blanco: 17.66:1 ✅
- Secundario `#5C534C` s/crema: 6.79:1 ✅ · s/blanco: 7.51:1 ✅
- `#B04A2E` s/blanco: 5.43:1 ✅ · s/crema: 4.91:1 ✅
- Ícono mic blanco s/terracota: 3.17:1 ≥ 3:1 (WCAG 1.4.11, no-texto) ✅

## Impacto en otros mockups (actualizado 26/07)
- La estructura nueva (3 tabs + avatar, delta negro, portada como componente único) se propaga a TODOS al rediseñarlos: 03 y 04 siguen con la tab bar vieja hasta su turno.
- **07-insight: DADO DE BAJA** como pantalla (Decisión C): el puente con chip de contexto lo reemplaza.
- **02-conexiones:** se rediseña como sheet just-in-time + sección dentro de Cuenta.
- **08-plan:** se accede desde el avatar (sigue siendo visión, acciones/mes).

## Autoevaluación (checklist kickoff §4)
1. Terracota ≤10% → ✅ mic + tab activa + 3 links + delta ≈ 2,5% estimado del área.
2. WCAG AA calculado → ✅ pares listados arriba.
3. 2 familias / 4 tamaños (28-20-16-13) / 2 pesos UI (400/500) → ✅.
4. Voseo, sin léxico prohibido, guiones §5 → ✅ ("Nada urgente por hoy", "te lo dejo acá", "preguntame").
5. Cero orbes/glow/glassmorphism → ✅.
6. Caja "Odobi" correcta → ✅ (la etiqueta en versalitas "PARA HOY" no contiene el nombre).
7. Grilla 8pt, CTAs thumb zone, targets ≥44pt → ✅ (acciones 48pt, mic 48pt, input 48pt).
8. Decisiones con fundamento citable → ✅ esta tabla.

---

## Revisión 15/08/2026 — se retira la tabbar

**Origen:** el análisis del build de David (`audit/ANALISIS-PROTOTIPO-DAVID.md`) y el mockup `10-arranque`, donde se dibujó el modelo completo. Esta revisión lo aplica al 09 **para que los dos mockups no se contradigan en la misma reunión**.

| Elemento | Antes | Ahora | Fundamento |
|---|---|---|---|
| Navegación | Tabbar de 3 tabs (Decisión A, 26/07) | **Sin tabbar.** El composer es el borde visible del panel de conversación; un segundo asidero arriba baja al escritorio de funciones | David ya construyó el mecanismo de capas (`PanelDeslizable`, verificado en device). Su decisión de fondo es correcta; lo que había que corregir era **qué capa está adelante**, no el mecanismo |
| Acceso al chat | Tap en la tab «Chat» → cambia de pantalla | **Tocar o subir el composer** → la conversación cubre, sin perder el contexto | Queda a un gesto **y** a un toque (WCAG 2.5.1). Y no hace falta cartel que explique el gesto: el input ya es el signo — que es justo la falla de contraste del build actual («DESLIZÁ PARA VER FUNCIONES» a 2,90:1) |
| Los dos gestos | — | **Verticales y opuestos, uno por borde:** arriba trae el escritorio, abajo trae la conversación | No compiten por el mismo movimiento: se reparten el eje, y cada uno tiene su asidero visible |
| Texto de los asideros | — | `sec` a 11px, **sin `opacity` encima** | Bajarle opacidad a un token ya calculado es exactamente lo que rompe el hint del build de David: el token da 5,06:1 y el componente lo deja en 2,90:1 |
| Detector | «6 reglas» | **8 reglas** | Dato corregido contra `apps/copiloto/mi_dia_detector.py` (15/08): se sumaron `cae_por_vencer` y `certificado_afip_por_vencer`. El número viejo venía de la auditoría del 25/07 |
| Nota M4 | «el tab dice DÓNDE estás» | La etiqueta carga sola con el alcance del número; la posición se lee por el borde que asoma en cada extremo | La resolución original de M4 se apoyaba en la tabbar, que ya no está |

⚠️ **Esto es propuesta, no decisión cerrada.** Si Martin y David la adoptan, **deroga la Decisión A (3 tabs)** del 26/07. El costo real es perder el indicador explícito de posición (Nielsen #1); lo compensa que siempre asome el borde de la capa vecina. Mientras no se cierre, el 09 y el 10 muestran el mismo modelo para no presentar dos sistemas distintos en la misma reunión.

**Lo que NO cambió:** la portada, las tarjetas del detector, el puente al chat (Decisión C), la terracota solo en lo tocable (Decisión B), la identidad gráfica y toda la narrativa de datos.
