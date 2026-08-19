# DECISIONES — 01 · Onboarding (o-DO-bi y la promesa del primer minuto)

Creado 28/07/2026. Los tres actos del guión §5 del handoff, LITERALES: reveal («se dice o-DO-bi», ahora sobre el aterrizaje del splash — rev. 31/07), promesa («¿Conectamos tus servicios? Son dos minutos y te digo algo que no sabés.») y promesa cumplida («tenés $147.000 facturados sin cobrar…»). El kickoff pide exactamente dos cosas de este mockup: codificar la pronunciación o-DO-bi + cumplir la promesa del primer minuto con plata real. Todo lo demás se subordina a eso.

## La tesis: el onboarding es una conversación, no un tour

No hay carrusel de features, no hay slides de bienvenida, no hay formulario de registro dibujado. Odobi se presenta hablando (porque hablarle ES el producto), pide lo mínimo para ver el negocio, y paga la promesa con un dato de plata real en el primer minuto. El primer tap del usuario en la app ya es una orden de negocio («Armame el detalle»), no un ajuste de configuración.

## Timeline

Día cero, 9:41–9:44 — anterior a toda la narrativa continua (lunes 20 → viernes 25 de 03/04/05/06/09). Cifras del guión §5 ($147.000 sin cobrar, $63.000 >20 días): orientativas de mockup, verbatim del handoff.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Reveal = **el aterrizaje del splash** (rev. 31/07, Martin) | Lane 1 deja de ser una pantalla de terracota plena: es el último frame de la animación de `explorations/splash-o` — wordmark 96px terracota sobre el degradé blanco→crema, ya operativo | El splash YA es el momento display, y la excepción 60/30/10 se gasta ahí. Encadenar una segunda placa de marca duplicaba el momento y, peor, aterrizaba distinto: el splash entrega "Empecemos"/"Crear una nueva cuenta" y esta pantalla ofrecía "Empezar" | Conservar la placa terracota después del splash — dos momentos de marca seguidos antes de dar valor, y el usuario toca dos botones de arranque en fila; hacer que la animación termine EN terracota — primer ingreso y post-logout terminarían distinto, más trabajo en Rive por un beat que la animación ya dio |
| Wordmark en vez de monograma | La O de 112px se reemplaza por el wordmark completo **Odobi** a 96px | Es adonde llega la animación: la 4ª forma se contrae hasta el lugar exacto de la O y d·o·b·i entran detrás. Poner el monograma acá contradiría la pieza que se acaba de ver | Monograma 112px (28/07) — tenía sentido cuando el splash era una placa fija; con la animación, el signo que queda plantado es el wordmark |
| "se dice o-DO-bi" | Inter 16 Medium en `sec` bajo el wordmark, con el botón que lo dice al lado | Handoff §3: mandato explícito de codificar la pronunciación. Va acá porque es el punto donde el nombre se ve **más grande de toda la app** — anotar cómo suena justo debajo es donde rinde. Sobre crema ya es texto normal (6,79:1 ✅): se cae la muleta de subir a display 20 que exigía el fondo terracota | Mantenerlo en display 20 Bold — sobre crema es innecesario y compite con el wordmark; caption 13 — lo esconde |
| Botón que lo pronuncia | Círculo 48pt, borde e ícono en `#B04A2E` (4,91:1 s/crema ✅, 1.4.11), junto a la línea | La pronunciación se aprende con el oído: tocás y la voz lo dice (lexicón/SSML §5.7). Ahora en terracota profunda **porque es tocable** — la Decisión B se cumple sola, ya no hay que argumentar el blanco sobre terracota | Autoplay al abrir — sonido no pedido en el primer arranque es hostil; borde blanco (28/07) — no existe fondo terracota que lo sostenga |
| Botones del aterrizaje | **"Empecemos"** (fill `#DE7250` + display 20 Bold blanco, 3,17:1 AA texto grande ✅) + **"Crear una nueva cuenta"** (ghost blanco, negro) | Son los del splash: el aterrizaje es del splash, no del 01. En post-logout los mismos dos slots dicen "Entrar" / "Entrar con otra cuenta" — mismo motor, aterrizaje según sesión | "Empezar" solo (28/07) — una sola puerta obliga a resolver el alta en otro lado, y el splash ya define dos |
| Guión en burbujas, sin tour | Lane 2 abre con «Laburo así: vos me hablás, yo resuelvo…» como mensajes de Odobi | Guión §5 LITERAL. La app se presenta en su propio formato: si el producto es hablarle, el onboarding ES una conversación (show, don't tell) | Carrusel de 3 slides con ilustraciones — cuenta el producto en un formato que la app nunca más usa; video — pasivo y pesado |
| 6 servicios = 2 permisos | Card "Tus servicios": fila Cobrar (Mercado Pago) + fila Mail·Agenda·Archivos (Google), chip "2 permisos" | «Son dos minutos» es literal: el catálogo real (`catalog.py`) tiene 6 servicios pero Gmail/Calendar/Drive/Docs/Sheets son UN OAuth de Google + Mercado Pago. El mockup muestra la mitad del flujo: MP ya "Conectado ✓" (en sec: feedback, no botón — Decisión B) |6 filas con 6 botones — mentiría sobre el flujo real (2 consents) y convertiría "dos minutos" en marketing; logos de marcas — marca ajena en la UI (misma regla que ARCA en el 05) |
| Alcance antes del permiso | "Solo leo lo que hace falta para ver tu negocio. Cada permiso se corta cuando quieras, desde Cuenta." | Anatomía del patrón madre (04): el alcance se declara antes de decidir. Consentimiento informado + revocación visible (Conexiones vive en Cuenta — Decisión A) | Pedir el OAuth sin explicar qué lee — fe ciega; términos legales completos — nadie los lee y el flujo muere ahí |
| "Después" mismo tamaño | btn-cancel igual que en todo HITL | Saltear es legítimo: si no conectás, Odobi pide el permiso cuando lo necesita — just-in-time consent (IF Catalogue), el patrón del 02. La promesa pierde gracia sin datos, pero la puerta no se fuerza | Dark pattern de "Después" chiquito o gris — coerción; bloquear la app sin conexión — el usuario todavía no tiene motivos para confiar |
| Sin tabbar en lanes 1–2 | Tabbar aparece recién en lane 3 | El usuario no entró a la app: está conociéndola. La tabbar aparece cuando el onboarding termina — la transición ES el mensaje "ya estás adentro" | Tabbar desde el arranque — navegable hacia pantallas vacías sin datos: rompe el flujo y muestra la app en su peor estado |
| Receipt "Servicios conectados" | Ícono success de Martin + "Mercado Pago · Google" abre el lane 3 | El historial nace auditable desde el minuto uno (el chat es el registro). Mismo signo de "hecho" que 04/05/06 | Toast efímero — la primera acción del usuario en la app merece quedar anotada |
| Promesa cumplida con plata | «Listo, ya veo tu negocio. Primero que salta: tenés $147.000 facturados sin cobrar, y $63.000 son de hace más de 20 días. ¿Querés que te arme el detalle de quiénes son?» | Guión post-conexión §5 LITERAL, y la estructura del insight: dato + consecuencia + acción. Es la query `portada` real (BI conversacional) hablando de SUS datos recién conectados — no un demo enlatado | "¡Todo listo! Explorá la app 🎉" — doble violación (léxico prohibido + promesa incumplida); tour de features post-conexión — la promesa era un dato, no más pantallas |
| Una pregunta, cerrada | «¿Querés que te arme el detalle…?» + chip "Armame el detalle" | Nada se ejecuta solo, ni siquiera el primer insight: cada paso pide permiso para el siguiente (HITL desde el minuto cero). Pedido ambiguo → una sola pregunta (regla de discurso) | Armar el detalle sin preguntar — write de análisis sin pedido explícito; tres chips de opciones — decisión innecesaria en el momento de mayor fragilidad |
| Anotación | Estándar uxsnaps (26/07) | Decisión Martin 26/07 | Columnas laterales — formato viejo |

## Ratios usados (todos pares ya calculados — sin combinaciones nuevas)

Blanco s/`#DE7250` display 20 Bold 3.17:1 ✅ AA texto grande ("Empecemos", "Conectar Google" — regla 28/07 v2) · `#5C534C` s/crema 6.79:1 ✅ ("se dice o-DO-bi", ahora texto normal sobre claro) · `#B04A2E` s/crema 4.91:1 ✅ (borde e ícono del botón que pronuncia — 1.4.11) · `#1A1512` s/blanco ✅ (ghost "Crear una nueva cuenta") · blanco s/`#DE7250` 3.17:1 ✅ solo gráficos (mic — 1.4.11) · blanco s/`#DE7250` display 20 Bold ✅ (Conectar Google, regla 28/07 v2) · `#1A1512` s/crema 16.37:1 ✅ (burbujas, receipt) · `#1A1512` s/arena-30 14.56:1 ✅ (íconos en tiles) · `#5C534C` s/blanco 7.51:1 ✅ (labels, "Conectado ✓", divider) · `#5C534C` s/crema 6.79:1 ✅ (t2 del receipt) · `#B04A2E` s/blanco 5.43:1 ✅ (chip "Armame el detalle", tab activa, check del ícono) · borde del ícono s/crema 4.91:1 ✅. Statusbar blanco s/terracota: chrome del dispositivo, precedente aprobado en la escucha del 03.

## Autoevaluación (checklist kickoff §4)

1. Terracota ≤10% → ✅ **lane 1 ya no necesita la excepción**: al caerse la placa de terracota plena, el frame queda en ≈9% (wordmark + fill de "Empecemos" + borde/ícono del play). La excepción display sigue declarada, pero la gasta la animación del splash, no esta pantalla. Lane 2 ≈7% (pantalla de decisión); lane 3 ≈3% (chip + mic + tab + borde input).
2. WCAG AA calculado → ✅ pares listados, todos preexistentes.
3. 2 familias / 4 tamaños (28-20-16-13) / 2 pesos UI → ✅.
4. Voseo, sin léxico prohibido, guiones §5 LITERALES → ✅ («Laburo así», «te digo algo que no sabés», «Armame el detalle»).
5. Cero orbes/glow/glassmorphism → ✅ (el splash es un signo lineal sobre color plano).
6. Caja "Odobi" correcta → ✅ ("o-DO-bi" es la notación de pronunciación oficial del handoff §3, citada — no es el nombre escrito).
7. Grilla 8pt, CTAs thumb zone, targets ≥44pt → ✅ (Empezar, say-btn 48pt, filas, botones, chip ≥48pt).
8. Decisiones con fundamento citable → ✅ esta tabla (handoff §3/§5/§5.7, kickoff, catalog.py, Decisiones A/B, IF Catalogue).

---

## Revisión 16/08 — se retira la tabbar

La tabbar acá **no era navegación: era un signo narrativo** — aparecía en el lane 3 para decir "el onboarding terminó, esto YA es la app". Al migrar al modelo de capas hacía falta reemplazar el signo, no sólo borrarlo.

**Ahora la señal de "estás adentro" es el composer.** Antes no había con qué hablarle; en el lane 3 aparece. Es un signo mejor que el anterior: *estar adentro de Odobi es poder pedirle algo*, no tener a la vista una barra de secciones.

---

> **Revisión 18/08/2026 — el label del botón pasa de 20 a 19 px.** Donde este documento dice
> «display 20 Bold» sobre terracota, hoy son **19**. Decisión de Martin: a 20 el botón pesaba más que
> el contenido de la propia pantalla. ⚠️ **19 es el piso, no una preferencia:** WCAG cuenta como texto
> grande el bold desde **18,66 px**, y eso es lo único que vuelve legal el 3,17:1 de blanco sobre
> `#DE7250`. A 18 px el botón deja de cumplir sin que se note a ojo. Token: `--fs-btn:19px`.
