# DECISIONES — 03 · Chat (continuidad y ejecución)

Rediseño 28/07/2026. Reemplaza la versión "Home conversacional" (22/07): la app ya no abre en el chat — abre en Mi día (09). Resuelve C1, M2, M5 y m3 de la crítica integral 26/07. Todos los ratios WCAG calculados con python3, no estimados.

## El cambio de fondo (C1)

La versión anterior era "apertura de sesión con insight": saludo display + el −18% + la promo. Ese trabajo hoy lo hace Mi día (la portada + las tarjetas del detector). Si el chat repetía el insight, el usuario veía el −18% dos veces; si divergía, las dos superficies competían. **Nuevo rol del chat: continuidad y ejecución.** Tres trabajos, uno por lane:

1. **Ejecutar** lo que el tablero disparó — el puente (Decisión C).
2. **Preguntar** — Inteligencia (BI conversacional, solo lectura) + historial persistente.
3. **Hablar** — estado de escucha (el momento display de la app).

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Rol del chat | Continuidad y ejecución; NO apertura de sesión | C1: el insight de apertura vive en Mi día (query `portada` + detector). Dos superficies con el mismo trabajo compiten o se contradicen | Mantener el saludo+insight en el chat — duplicaba el −18% y contaba una historia que ya no es cierta (la app abre en Mi día desde el 25/07) |
| Saludo display de sesión | **Eliminado** (M5) | Sin apertura de sesión no hay saludo de apertura. Un socio no da un discurso cada vez que entrás. El momento display de la UI queda donde es legítimo: la escucha | Conservarlo "porque quedaba lindo" — decorativo, consume ~96px de thread y vacía de significado el display de la escucha |
| Chip de contexto | `↩ Desde tu aviso · Factura A-0034 · Gómez SRL` — pill crema, texto `#B04A2E` (4.91:1 ✅), 32pt, tocable (vuelve al aviso de origen) | Decisión C (26/07): el puente Mi día→Chat es un momento explícito. El chip dice de dónde venís y te deja volver (Nielsen #3). Componente transversal: tarjetas, voz, apps | Fondo arena-30 con texto terracota-prof — 4.37:1, falla AA texto normal (calculado); transición sin marca de origen — el usuario pierde el hilo del salto de tab |
| Card HITL en el thread | Anatomía del patrón madre (04): encabezado acción + servicio, filas editables (Cambiá/Editá), alcance visible, Confirmar/Cancelar del mismo tamaño | El puente entrega la propuesta YA armada (Decisión C). Es el `HitlCard.tsx` real del repo en su hábitat; el 04 lo documenta en detalle | Conversación que redacta el mail por turnos — más "chat" pero más lenta; el usuario decide, no dicta |
| Botón Confirmar | Fill terracota suave `#DE7250` + label **display 20 Bold blanco** (3.17:1 = AA texto grande ✅) | Decisión B: terracota = lo tocable que ejecuta. **Regla 28/07 v2 de Martin (decidida sobre el 05, aplica a toda la app): nunca negro sobre terracota; el label sube a display 20 Bold para entrar por la vía "texto grande" (≥3:1), la misma que "Cortar" en la escucha** | Fill `#B04A2E` + Inter 16 blanco (28/07 v1) — funcionaba (5.43:1) pero Martin prefirió la terracota de marca en el momento de decisión; `#DE7250` + Inter 16 — 3.17:1 falla AA texto normal; texto negro (22/07) — regla derogada |
| ✓✓ recibido | Conservado, ahora en `--sec` (7.51:1 s/blanco ✅) | Decisión B: es feedback, no botón — el color ya no opina. Jakob's Law: convención WhatsApp intacta | ✓✓ en `#B04A2E` (versión 22/07) — violaba B: terracota en algo no tocable |
| Card de datos | **Variante compacta de la portada del 09** (M2): crema, sin borde ni sombra, mismas clases `.portada/.p-big/.p-delta` | Un componente, dos contextos. En sistema de componentes real la card del chat es la variante compacta de la portada madre | `.datacard` blanca con borde+sombra (versión 22/07) — segunda anatomía para el mismo dato; inconsistencia que David notaría en el deck |
| Cierre de la promo | El miércoles queda en el historial ("Promo mandada a los 34") y el viernes se responde: **9 de 34 respondieron, 4 compraron, $52.000** (m3) | El ciclo completo queda contado: pediste → se mandó (HITL) → quedó anotado → preguntás y hay respuesta. Vende el sistema, no la feature. Verificable: $52.000 ⊂ $286.000 de la semana | Dejar la promo sin cierre — hueco narrativo entre 03 y 09 (m3); inventar una tarjeta "resultado de promo" en Mi día — el detector no tiene esa regla, mentiría sobre el repo |
| Monograma en burbujas | "La o que habla" (18px, `--sec`) firma cada mensaje de Odobi — **anatomía actualizada 29/07: ver la sección de abajo** | Identidad 28/07 capa 1: mismo signo en Mi día (labels), chat (firma) y la entrada diaria. En sec: firma, no se lee tocable (coherente con B) | Avatar circular con inicial "O" — genérico de messenger; orbe — prohibición dura §1 |
| Historial persistente | Dividers de fecha ("Miércoles 22" / "Viernes 25 · Hoy"), un solo hilo | El chat es UNA conversación con tu negocio, no sesiones que se descartan. Refuerza continuidad (C1) | Chat vacío por sesión — tira el historial que hace creíble a Inteligencia |
| Tab bar | 3 tabs (Mi día / Chat / Apps), Chat activa en `#B04A2E` (5.43:1 s/blanco ✅) + Medium. Íconos Iconoir | Decisión A (26/07): solo lo cotidiano en primer nivel; Cuenta (y Conexiones) en el avatar | Nav de 5 (25/07) — revertida en 00-mapa: Conexiones se usa fuerte una vez |
| Placeholder input | "Escribile a Odobi…" (igual en Mi día) | En el chat el copy es literal. En Mi día, escribir/dictar navega al chat con la respuesta — el comportamiento resuelve m4, no el copy | Placeholders distintos por tab ("Preguntale…" vs "Escribile…") — dos copys para el mismo campo confunden más de lo que aclaran |
| Estado de escucha | Conservado de la versión aprobada 22/07 (pantalla terracota, wave 6 barras, "Te escucho." 28 Bold, transcripción 20 Bold); "Cortar" ahora blanco display 20 Bold con borde blanco, 48pt (regla 28/07: nunca negro s/terracota; 3.17:1 pasa AA texto grande). Transcripción nueva: "anotame un gasto de dieciocho mil en mercadería…" | Regla 22/07 completa (blanco solo grande e íconos, negro solo botones — todos los ratios listados abajo). La transcripción ahora muestra la voz ANOTANDO: alimenta el libro que Mi día vigila (ciclo del sistema) | Transcripción de la promo (versión vieja) — la promo ya se mandó el miércoles, no cuadraba con el viernes |
| Anotación | Estándar uxsnaps (26/07): manuscrito flotante + flechas bezier que terminan EN el elemento | Decisión de Martin 26/07 — reemplaza las columnas con líneas punteadas en todos los mockups al tocarlos | Columnas laterales (formato 22/07) — el vínculo anotación-elemento era ambiguo |

## Monograma rev. 29/07 (propagación desde el 09)

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Firma de los mensajes de Odobi (4 apariciones, 18px) | Pasa del círculo dibujado + 3 barras al **glifo real de la O** con **las ondas afuera** (arcos concéntricos, trazo 1,6→1,1), en `sec` | Decisión Martin 29/07 al armar la entrada de arranques 2..n: un solo signo en todas las escalas. Adentro las barras no entran — el contrapunzón de la O real mide ~5px a tamaño de firma. Detalle: la O es `fill` y las ondas `stroke`, los dos heredando `sec` | Mantener el círculo dibujado sólo acá: dejaría la firma del chat contando una identidad distinta a la del label de Mi día y la de la entrada |

Sin cambio de layout: mismo `viewBox 24×24` y mismo `width/height` 18, así que la fila del mensaje no se mueve.

## Ratios calculados (python3, 28/07)

| Par | Ratio | Uso |
|---|---|---|
| `#B04A2E` s/crema | 4.91:1 ✅ | chip de contexto, tab activa |
| `#B04A2E` s/arena-30 | 4.37:1 ✗ | descartado (por eso el chip va en crema) |
| `#5C534C` s/blanco | 7.51:1 ✅ | ✓✓, meta, dividers |
| blanco s/`#DE7250` (display 20 Bold) | 3.17:1 ✅ AA texto grande | label de botones de confirmación (regla 28/07 v2) |
| blanco s/`#DE7250` (Inter 16px) | 3.17:1 ✗ AA normal | descartado como label chico — por eso el label sube a display 20 Bold |
| crema s/`#DE7250` | 2.86:1 ✗ | descartado |
| `#B04A2E` s/blanco | 5.43:1 ✅ | links Cambiá/Editá |
| `#1A1512` s/crema | 16.37:1 ✅ | burbujas, card portada |
| `#5C534C` s/crema | 6.79:1 ✅ | labels de card |
| blanco s/terracota | 3.17:1 ✅ | solo display ≥20 Bold e íconos (1.4.11) |

## Datos usados (continuidad narrativa)

Viernes 25 (mismo día que el lane 1 del 09): factura A-0034 Gómez SRL $120.000 vencida 24/06 (31 días) · promo del miércoles a 34 clientes → 9 respuestas, 4 ventas, $52.000 ⊂ $286.000 de la semana · confirmar el reclamo habilita el sábado del 09 (Gómez paga, +16%). Cifras orientativas de mockup — no prometen feature.

## Autoevaluación (checklist kickoff §4)

1. Terracota ≤10% → ✅ mic + chip + tab activa + botón Confirmar + borde input ≈ 3% del área. Escucha = excepción display declarada.
2. WCAG AA calculado → ✅ tabla arriba.
3. 2 familias / 4 tamaños (28-20-16-13) / 2 pesos UI (400/500) → ✅ (manuscrito = meta-capa, no UI).
4. Voseo, sin léxico prohibido → ✅.
5. Cero orbes/glow/glassmorphism → ✅.
6. Grilla 8pt, targets ≥44pt → ✅ (botones HITL, chip 32pt es informativo-tocable con padding de área 48 en implementación real — anotar en handoff de dev).
7. Decisiones con fundamento citable → ✅ esta tabla.

---

## Revisión 16/08/2026 — se retira la tabbar

Alinea el 03 con `09-mi-dia` y `10-arranque`: era el último mockup que mostraba la nav de 3 tabs, y con el árbol abierto en una reunión la contradicción se veía sola.

| Elemento | Antes | Ahora | Fundamento |
|---|---|---|---|
| Navegación | Tabbar de 3 tabs, con «Chat» activa | **Sin tabbar.** Asidero arriba: *"Bajá para volver a Mi día"* | El chat no es un destino paralelo: es **la capa que subió desde el composer** de Mi día. El asidero de arriba la baja — el mismo camino que la trajo, al revés |
| Dónde va el asidero | — | **Arriba, y solo arriba** | En el 09 el asidero de abajo (el composer) trae esta pantalla. Acá esa función ya está cumplida: repetir un asidero inferior sugeriría una tercera capa que no existe |
| Anotación de C1 | «el chat ya no es la home: es una de las 3 tabs» | «el chat ya no es la home: **es la capa que subió** desde este mismo composer» | C1 se resolvía apoyándose en la tabbar. La resolución nueva es más fuerte: el chat no es "una sección más", es un estado del mismo lienzo |
| Flecha de esa nota | Iba a la tab «Chat» | Va **al composer** | Es de donde vino la capa |
| Lane 3 (escucha) | Sin tabbar | Sin cambios | Es momento display a pantalla completa: no lleva asideros |

⚠️ **Propuesta, no decisión cerrada.** Si Martin y David la adoptan, deroga la Decisión A (3 tabs) del 26/07.

**Trampa pagada al hacerlo (queda escrita):** eliminar la tabbar con una regex `<div class="tabbar">.*?</div>` **rompe el HTML en silencio** — el `.*?` no-greedy corta en el primer `</div>` (el de un tab interno) y deja divs sueltos; el síntoma fue el overlay del lane colapsando sobre el siguiente, con las anotaciones encimadas. Se rehízo contando `<div>`/`</div>` hasta cerrar el bloque, y se verificó que el conteo de aperturas y cierres coincida (76/76).

## Revisión 16/08 (b) — la escucha: display por sustracción

El lane 3 mostraba la escucha como **pantalla terracota plena**, heredada del veredicto del experimento Wise A/B ("el único momento display del sistema"). Se rehízo tras encontrar en el repo que David **eliminó** ese modelo: `GlassGrabacionCopiloto` fue borrado y reemplazado por controles flotantes, bajo un contrato llamado `dictado-por-voz-sin-glass` — *"sin marco, sin cronómetro, el único feedback es la onda"*. Diagnóstico completo en `audit/ANALISIS-PROTOTIPO-DAVID.md` §8.

| Elemento | Antes | Ahora | Fundamento |
|---|---|---|---|
| Superficie | Pantalla **terracota plena** | **Velo del color del lienzo de la piel activa al 96%** sobre el contenido | La escucha **no tapa: silencia**. El contexto sigue detrás y nada compite con la voz. Gana las dos cosas: sigue siendo un momento distinto (Wise A/B) y no te saca de donde estabas (contrato de David) |
| Por qué el velo toma el color del tema | — | Crema en claro, negro tostado en oscuro | Así **no hay isla oscura sobre lienzo claro**: la regla del 08/08 se respeta **sin pedir excepción** |
| Opacidad | — | **96%**, no 90% | Calculado en el **peor caso** (contenido de máximo contraste justo detrás): a 94% la terracota profunda da 4,37:1 ✗; a 96% da **4,53:1** ✓ en claro y **5,21:1** ✓ en oscuro. El 4% restante es lo que hace que el fondo **se insinúe** |
| Desenfoque | — | **Ninguno** | Medición del propio repo: el `BlurView` **nunca desenfocó en Android** (`CristalVidrio.tsx:8`). Pedir blur sería pedir un no-op caro |
| La onda | Barras blancas sobre terracota | Barras en **terracota profunda `#B04A2E`** | `#DE7250` sobre el velo claro queda en ~2,9:1 y **no llega al 3:1** que pide WCAG 1.4.11 para un gráfico. En la piel oscura sí corresponde la viva (5,21:1) |
| Controles | Un solo botón "Cortar" | **Pausar · Enviar · Eliminar** — los del repo | No se reinventa lo que ya está resuelto y probado en device. Solo se les aplica nuestra regla de color: Enviar = fill `#DE7250` + display 20 Bold blanco (3,17:1, regla 28/07 v2); Eliminar en `#B04A2E` (tocable → terracota, Decisión B) |
| Motion | — | `prefers-reduced-motion` detiene la onda | Misma exigencia que le pedimos al rodillo del estado vacío |

**Lo que cede cada lado:** nosotros dejamos la terracota plena a pantalla completa —el momento display pasa a construirse **apagando** lo demás en vez de **inundar** de color—; David deja el "sin superficie" estricto, y a cambio no pierde el contexto igual.

⚠️ **Consecuencia a revisar:** el veredicto del experimento Wise A/B (Tarea 1) declaraba la escucha terracota a pantalla completa como *el único momento display*. Esa cláusula queda modificada: el momento sigue existiendo, pero cambia de mecanismo. Hay que anotarlo en `explorations/wise-ab/DECISIONES.md` cuando se cierre con David.

---

> **Revisión 18/08/2026 — el label del botón pasa de 20 a 19 px.** Donde este documento dice
> «display 20 Bold» sobre terracota, hoy son **19**. Decisión de Martin: a 20 el botón pesaba más que
> el contenido de la propia pantalla. ⚠️ **19 es el piso, no una preferencia:** WCAG cuenta como texto
> grande el bold desde **18,66 px**, y eso es lo único que vuelve legal el 3,17:1 de blanco sobre
> `#DE7250`. A 18 px el botón deja de cumplir sin que se note a ojo. Token: `--fs-btn:19px`.
