# DECISIONES — 04 · Confirmación HITL (patrón madre)

Rediseño 28/07/2026. Reemplaza la versión del 22-23/07: formato uxsnaps, tab bar de 3, wordmark terracota, canal Gmail y regla de botones 28/07. El componente materializa el mensaje de confianza de marca: **"Vos confirmás, Odobi ejecuta"** (§5). Todo write del sistema pasa por acá. Lo heredan **05-facturación** (doble HITL) y **06-presupuestos** cambiando solo las filas de detalle. (07-insight ya no existe como pantalla — dado de baja 26/07; su trabajo lo hace Mi día.) El 03 muestra este mismo componente en su hábitat (el thread del viernes); acá se documenta la anatomía en detalle.

## Anatomía del componente (reutilizable)

1. **Encabezado de acción** — qué va a pasar (título display) + canal/servicio (chip).
2. **Detalle editable** — cada supuesto de Odobi es una fila tocable ≥48pt con acción explícita (Editá / Ver lista).
3. **Alcance e irreversibilidad** — a quién afecta y si se puede deshacer, en texto frontal.
4. **Decisión** — Confirmar (terracota profunda) y Cancelar (outline), mismo tamaño y peso.

Estados: propuesta (lane 1) → edición en sheet (lane 2) → comprobante (lane 3). La edición nunca ejecuta: el único gatillo del write es "Confirmar".

## Timeline (continuidad narrativa)

Miércoles 22, 14:38 → propuesta armada · 14:39 → Martin edita el mensaje · 14:40 → "Confirmá." (voz/texto) · 14:41 → comprobante "Promo mandada · 34 clientes · Gmail". El viernes 25 el chat (03, lane 2) responde el resultado: 9 de 34 respondieron, 4 compraron, $52.000. El ciclo pedir→revisar→ejecutar→registrar→preguntar queda contado entre los dos mockups.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Tarjeta en el thread, no modal | La confirmación es un turno más de la conversación; entra por abajo del chat, con el monograma de Odobi firmándola | La metáfora "hablarle como a un socio" ES el posicionamiento (Wilensky). Un modal que interrumpe convierte al socio en sistema. CTAs en thumb zone | Modal centrado bloqueante — rompe la conversación, CTAs fuera del pulgar, grita "software" en un producto que promete "alguien" |
| **Canal: Gmail, no WhatsApp** | Chip "Gmail" en el encabezado; alcance "Sale a 34 personas por mail"; comprobante "34 clientes · Gmail" | El repo tiene exactamente 6 servicios conectables (Mercado Pago, Gmail, Calendar, Drive, Docs, Sheets — `catalog.py`). WhatsApp no existe en el catálogo: el mockup no miente sobre el repo | WhatsApp (versión 22/07) — vendía una integración que no está construida; regla del proyecto: los mockups muestran producto, no visión |
| Intención declarada antes de actuar | Encabezado con acción + canal; nada se ejecuta sin haberse mostrado | IF Catalogue: mostrar la intención de una acción automatizada antes de ejecutarla. Requisito HITL (handoff §0: todo write se propone) | Ejecutar y notificar ("Listo, enviada") — viola HITL |
| Detalle como filas editables | Mensaje (Editá), Destinatarios 34 (Ver lista), Descuento 15% (Editá); filas ≥48pt con acción textual | Nielsen #5: lo asumido corregible ANTES de ejecutar. Texto explícito > ícono de lápiz: cero ambigüedad para usuario no técnico | Solo resumen + "Editar todo" — rehacer la propuesta entera para corregir un campo; lápiz solo — ambiguo y target chico |
| "Ver lista" en destinatarios | Los 34 clientes son auditables antes de confirmar | El alcance real de un write masivo debe ser verificable, no declarativo (IF Catalogue: transparencia de alcance) | Número no tocable — pide fe ciega justo donde el costo del error es social |
| Aviso de irreversibilidad | "Sale a 34 personas por mail. Una vez mandada, no se puede deshacer." con ícono warning-triangle (Iconoir) en `#B04A2E` | Voz de marca §5: mala noticia → frontal y con salida (la salida es Cancelar). Nielsen #5: sin undo posible, la advertencia previa es la única salvaguarda | Letra chica gris o tooltip — esconder la consecuencia es dark pattern y contradice al "socio que te avisa" |
| Botón Confirmar | Fill terracota suave `#DE7250` + label **display 20 Bold blanco** (3.17:1 = AA texto grande ✅). ≈5% del área | **Regla 28/07 v2 de Martin (decidida sobre el 05, aplica a toda la app): nunca negro sobre terracota; el label sube a display 20 Bold para entrar por la vía "texto grande" (≥3:1), la misma que "Cortar" en la escucha.** El acento se reserva para LA decisión: el momento de control es el momento de marca (Wilensky) | Texto negro s/terracota (22/07) — regla derogada; fill `#B04A2E` + Inter 16 blanco (28/07 v1) — funcionaba (5.43:1) pero Martin prefirió la terracota de marca en el momento de decisión; `#DE7250` + Inter 16 — 3.17:1 falla AA texto normal |
| Cancelar visible e igual | Outline, mismo tamaño y tipografía que Confirmar, apilado debajo | Nielsen #3 + anti dark pattern: la opción de no ejecutar jamás se degrada. La confianza del HITL depende de que cancelar sea trivial | Cancelar chico gris — patrón oscuro clásico; erosiona la promesa que la tarjeta existe para cumplir |
| Edición en bottom sheet | Sheet sobre scrim 40%, thread atenuado detrás, hint "[nombre] se reemplaza por cada cliente", Cancelar/Listo | La edición es desvío corto, no viaje: se mantiene el contexto de la decisión. Thumb zone completa | Pantalla nueva — pierde contexto y agrega navegación; edición inline — targets chicos, teclado tapa la tarjeta |
| "Listo" como cierre del sheet | No "Guardar", no "Aplicar" | Léxico propio de marca (§5: "listo" está en la lista de palabras propias) | "Guardar cambios" — de formulario; Odobi no es un formulario |
| Editar ≠ confirmar | Cerrar el sheet actualiza la tarjeta; los CTAs siguen intactos. Un solo gatillo de ejecución | Principio HITL: el write tiene exactamente una puerta. Si editar ejecutara, la revisión sería trampa | "Guardar y mandar" combinado — dos decisiones en un tap; se pierde la última mirada al conjunto |
| Confirmación por voz/texto equivalente | Lane 3: burbuja de usuario "Confirmá." + meta "14:40 · ✓✓ recibido" en `--sec` (7.51:1 ✅) | La voz es el canal identitario (invocación); el HITL obliga a decidir, no a tocar. Paridad de canales. ✓✓ en sec por Decisión B (26/07): es feedback, no botón — el color ya no opina | Confirmación solo por botón — degrada la voz en el gesto central; ✓✓ terracota (22/07) — violaba B: terracota en algo no tocable |
| **Check de estado del comprobante: SVG de Martin** | Su `Success.svg` (28/07): círculo blanco con borde + check, 32px, animado (pop + check que se dibuja al entrar en pantalla, one-shot, reduced-motion ok). Color ajustado `#DE7250`→`#B04A2E` (check s/blanco 5.43:1 ✅ · borde s/crema 4.91:1 ✅) | Dibujo aportado por Martin, se usa tal cual (lección de la taza del 09) con el único ajuste legal: el `#DE7250` original da 2.86:1 s/blanco, falla 1.4.11. **Excepción a Decisión B (terracota en estado no tocable) decidida por Martin 28/07.** Motion = su Lottie replicado en CSS puro | Círculo negro + check blanco (primera versión 28/07) — cumplía B pero no era el ícono que Martin pidió; `#DE7250` literal — falla 1.4.11; player Lottie — dependencia en mockups sin build; loop del JSON — un comprobante no parpadea |
| Comprobante persistente | La tarjeta colapsa a receipt en el thread | El chat es historial auditable de lo ejecutado (IF Catalogue: registro de acciones del agente). Nielsen #1: cierre visible del ciclo | Toast efímero "Enviado ✓" — se pierde; lo ejecutado por un agente en tu nombre queda registrado y recuperable |
| Copy del comprobante | "Salió. Te aviso a medida que respondan." | §5: buena noticia → reconoce sin exagerar. Promete el seguimiento — y el 03 lo cumple el viernes ($52.000) | "¡Tu promo fue enviada con éxito! 🎉" — entusiasmo fingido + emoji: doble violación |
| Monograma en burbujas | "La o que habla" (18px, stroke 2.4, `--sec`) firma cada mensaje de Odobi | Identidad 28/07 capa 1: mismo signo en 03, 09 y splash. En sec: firma, no se lee tocable | Avatar con inicial — genérico; orbe — prohibición dura §1 |
| Wordmark header en terracota `#DE7250` | Igual que 03 y 09 (m1 de la crítica 26/07) | Logotipos exentos de contraste (WCAG 1.4.3); decisión de Martin 22/07. Un solo header en toda la app | Wordmark negro (versión 22/07 de este mockup) — inconsistente con el resto del sistema |
| Tab bar de 3 (Chat activa) | Mi día / Chat / Apps, Iconoir, activa en `#B04A2E` (5.43:1 s/blanco ✅) + Medium (m2) | Decisión A (26/07): la pantalla vive dentro de la nav real; sin tabbar el mockup mostraba una pantalla huérfana | Sin tab bar (versión 22/07) — la confirmación parecía una pantalla modal aparte, contradiciendo "tarjeta en el thread" |
| Iconografía Iconoir (MIT) | warning-triangle (alcance), check (receipt), microphone, sun-light/chat-bubble/view-grid (tabs); stroke 2, embebidos inline | Set único en todo el sistema (decisión 28/07 con Martin); monocromo, coherente con "iconografía monocroma" de Wise B | Íconos dibujados a mano por mockup — deriva de estilos entre pantallas |
| Sonido | "Listo" (Brand Book §5.7) acompaña el comprobante; "Escucha" cubre la invocación | El par escucha/listo sonoriza el ciclo pedir→ejecutar | — `TODO motion-ref`: timing del sheet (320ms) y del colapso tarjeta→receipt a validar con MCP 60FPS |
| Anotación | Estándar uxsnaps (26/07): manuscrito flotante + flechas bezier que terminan EN el elemento | Decisión de Martin 26/07 — reemplaza las columnas laterales en todos los mockups al tocarlos | Columnas con líneas punteadas (formato 22/07) — vínculo anotación-elemento ambiguo |

## Labels de acción de fila — taxonomía (fijada 30/07, el 04 es el dueño del componente)

Detectado al auditar el 05: la misma fila del HITL usaba **"Cambiar"** en 03/05/06 y **"Editá"** en el 04. Es **deriva del componente reutilizable**: la misma fila, con el mismo comportamiento, nombrada de dos maneras en cuatro pantallas.

**Registro por tipo de componente** (no es "voseo vs. no voseo" — el registro depende de quién habla):

| Componente | Registro | Ejemplos | Por qué |
|---|---|---|---|
| Acción de fila | **Voseo imperativo** | Editá · Cambiá · Ver lista | Odobi te invita a intervenir sobre *su* propuesta: te habla |
| Botón primario/confirmación | **Infinitivo** | Emitir factura · Guardar presupuesto · Confirmar y mandar | Nombra la acción que se ejecuta, no le habla a nadie. Es la etiqueta del acto |
| Chip de respuesta rápida | **Voseo imperativo** | Mandalo por mail · Guardalo en Drive · Armá la factura | Es la frase que *vos* le decís a Odobi: es tu turno de habla |

Los tres registros ya estaban en uso y son coherentes; lo único inconsistente era "Cambiar" en la fila.

| Label | Cuándo | Por qué no es el otro |
|---|---|---|
| **Editá** | Se modifica un **valor** de la fila (importe, concepto, fecha) | Editar es sobre el dato que ya está |
| **Cambiá** | Se sustituye la **entidad** referida (cliente, destinatario, cuenta) | No editás "Rodríguez SRL": elegís otro. La distinción es real y vale mantenerla |
| **Ver lista** | La fila resume N ítems y la acción **abre** el detalle, no edita | Prometer "Editá" y abrir una lista de lectura es mentirle al gesto |

Corregido en 03, 05 y 06 (1 instancia cada uno): `Cambiar` → **`Cambiá`**. El 04 ya estaba bien.

## Monograma rev. 29/07 (propagación)

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Firma de los mensajes de Odobi (3 apariciones, 18px) | Del círculo dibujado + 3 barras al **glifo real de la O** con **las ondas afuera** (arcos concéntricos, trazo 1,6→1,1), en `sec` | Decisión Martin 29/07: un solo signo en todas las escalas. Las barras adentro no entran — el contrapunzón de la O real mide ~5px a tamaño de firma. La O es `fill`, las ondas `stroke`, ambos heredando `sec` | Mantener el círculo dibujado: dejaría la firma del HITL contando una identidad distinta a la de Mi día, el chat y la entrada diaria |

Sin cambio de layout: mismo `viewBox 24×24` y mismo `width/height` 18.

**Barrido completo (29/07):** el monograma viejo se eliminó de TODOS los mockups en la misma pasada — 01 (6, incluido el de 112px del splash), 02 (2), 03 (4), 04 (3), 05 (3), 06 (4), 09 (1) = 23 instancias. Es cambio de token, sin riesgo de layout, y evita que un símbolo derogado se cuele en una captura del deck. **Ojo con el 01:** ahí el monograma de 112px vive en el splash, que además quedó superado por el splash nuevo (4 formas + wordmark, `explorations/splash-o`) — el swap de token lo deja coherente, pero el 01 necesita la secuencia completa cuando le toque su turno.

## Ratios calculados (python3, 28/07)

| Par | Ratio | Uso |
|---|---|---|
| blanco s/`#DE7250` (display 20 Bold) | 3.17:1 ✅ AA texto grande | label del botón Confirmar (regla 28/07 v2) |
| `#B04A2E` s/blanco | 5.43:1 ✅ | links Editá/Ver lista/Detalle, chip, warning, tab activa |
| blanco s/`#DE7250` (Inter 16px) | 3.17:1 ✗ AA normal | descartado como label chico — por eso el label sube a display 20 Bold |
| crema s/`#DE7250` | 2.86:1 ✗ | descartado |
| blanco s/negro | 21:1 ✅ | check del receipt |
| `#1A1512` s/blanco | 21:1 ✅ | tarjeta HITL, sheet |
| `#1A1512` s/crema | 16.37:1 ✅ | burbujas |
| `#5C534C` s/blanco | 7.51:1 ✅ | ✓✓, meta, labels de fila, dividers |

## Autoevaluación (checklist kickoff §4)

1. Terracota ≤10% → ✅ lane 1 ≈7% (pantalla de decisión = máximo legítimo del sistema), lane 2 ≈3%, lane 3 ≈2%.
2. WCAG AA calculado → ✅ tabla arriba.
3. 2 familias / 4 tamaños (28-20-16-13) / 2 pesos UI → ✅ (manuscrito = meta-capa, no UI).
4. Voseo, sin léxico prohibido, guiones §5 → ✅ ("Mirala", "Editá", "Confirmá", "Salió", "Listo").
5. Cero orbes/glow/glassmorphism → ✅ (scrim del sheet es funcional, no decorativo).
6. Caja "Odobi" correcta → ✅ (wordmark terracota, monograma en sec).
7. Grilla 8pt, CTAs thumb zone, targets ≥44pt → ✅ (filas, botones y sheet ≥48pt, decisión en tercio inferior).
8. Decisiones con fundamento citable → ✅ esta tabla.

## Revisión 16/08 — se retira la tabbar

Alinea el 04 con `03 · 09 · 10 · 11`. Se hizo al tocarlo por otra razón: **el 04 es el paso 3 del puente**, y en el visor del árbol se veía con tabbar mientras los pasos 1, 2 y 4 ya no la tenían — la demo en vivo mostraba dos sistemas distintos en cuatro pantallas.

| Elemento | Antes | Ahora | Fundamento |
|---|---|---|---|
| Navegación | Tabbar de 3 con «Chat» activa | Asidero arriba: *"Bajá para volver a Mi día"* | El HITL pasa **dentro de la conversación, que es una capa, no una sección** |
| **m2** (la crítica del 26/07: "la tarjeta flota en el vacío") | Se resolvía con la tabbar | **Sigue resuelto, con otro mecanismo**: abajo el composer, arriba el asidero | La tarjeta está anclada a la app real por sus dos bordes. El mecanismo cambió; el problema que m2 señalaba sigue cubierto |
| Flecha de esa nota | Iba a la tab «Chat» | Va al **composer** | Es lo que ahora ancla la pantalla |

⚠️ Propuesta, no decisión cerrada: si Martin y David la adoptan, deroga la Decisión A del 26/07.

---

> **Revisión 18/08/2026 — el label del botón pasa de 20 a 19 px.** Donde este documento dice
> «display 20 Bold» sobre terracota, hoy son **19**. Decisión de Martin: a 20 el botón pesaba más que
> el contenido de la propia pantalla. ⚠️ **19 es el piso, no una preferencia:** WCAG cuenta como texto
> grande el bold desde **18,66 px**, y eso es lo único que vuelve legal el 3,17:1 de blanco sobre
> `#DE7250`. A 18 px el botón deja de cumplir sin que se note a ojo. Token: `--fs-btn:19px`.
