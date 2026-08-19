# DECISIONES — 08 · Cuenta, plan y límites (acciones/mes)

Creado 02/08/2026. La carpeta estaba **vacía**: este mockup no existía. Se entra desde el **avatar** (Decisión A, 26/07) y cierra el pendiente que dejó el 02 (Cuenta como índice). Todos los ratios ya calculados en mockups previos — sin combinaciones nuevas.

## ⚠ El único mockup de visión de la serie

05 y 06 son features implementadas y por eso van **sin disclaimer**. Este no: el backend **no expone plan ni consumo** (el repo tiene una fila `Plan: Profesional` estática, sin medición). La marca de visión va en la **meta-capa** (chip "Visión — no está en el repo" + encabezado), **nunca adentro del frame**.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Dónde se declara la visión | Chip en la meta-capa, fuera del teléfono | El frame tiene que mostrar la app como sería, no una app que se disculpa. Quien mira el deck necesita saber qué está construido; el usuario final nunca vería ese badge | Badge "próximamente" dentro de la UI — dibuja una feature que se pide perdón a sí misma, y contamina el mockup para siempre; no marcarlo — vendería como hecho lo único que no lo está (el autogol inverso al del 05) |

## La tesis: el límite tiene que ser predecible antes que generoso

Un tope por uso sólo es vivible si el usuario puede **anticiparlo**. Por eso la pantalla no arranca por el número: arranca por **qué gasta**.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Unidad = **acciones/mes** | En toda la UI. "consultas" y "tokens" no aparecen ni una vez dentro del frame | Handoff §0: unidad visible al cliente = ACCIONES/mes, nunca "consultas" ni tokens. El usuario cuenta su laburo en cosas hechas, no en unidades de infraestructura | "Créditos" — moneda inventada que hay que aprender; "mensajes" — mediría la conversación, que es justo lo que NO queremos desalentar |
| **Qué cuenta como acción** (propuesta de diseño) | «Una acción es **algo que Odobi hace por vos**: emitir, mandar, cobrar, anotar. **Preguntarle no gasta**.» | Es la decisión que hace o rompe el producto: si preguntar gastara, el usuario dejaría de preguntar — y perderíamos exactamente lo que lo hace bueno (Mi día, Inteligencia, el BI conversacional). Además calza con la arquitectura real: los **writes** pasan por HITL y son contables uno a uno; las **lecturas** son SQL de solo-lectura. El límite queda alineado con el costo real y con el valor percibido | Contar todo turno de conversación — barato de implementar, pero enseña al usuario a no hablarle al copiloto conversacional; contar por tokens — invisible e impredecible: nadie puede anticipar su consumo |
| **⚠ Sin cerrar:** el número | 200/mes, marcado como **a calibrar** en el `lane-sub` | Handoff §pendientes: "calibrar el número de acciones/mes del plan gratis (experimento de producto)". Es decisión de producto, no de diseño: el mockup no puede fingir que la tomó | Elegir un número y presentarlo como definitivo — decidiría por producto en un deck de diseño |

## Lane 1 · Cuenta

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Pantalla apilada, no tab | Se llega desde el avatar, se vuelve con la flecha | Decisión A (26/07): Cuenta no compite en la nav con lo de todos los días | Quinto tab — revertido en `00-mapa` justamente por esto |
| El plan encabeza la lista | Primera fila, antes de Conexiones y datos | Es lo único de esta pantalla que puede **frenarte**. Lo demás son datos; esto es un techo | Orden alfabético o "perfil primero" — entierra el único ítem con consecuencia operativa |
| El contador vive en la fila | "164 de 200 acciones este mes" como sub-texto, sin entrar | Si el límite existe, tiene que verse sin ir a buscarlo (Nielsen #1). Entrar es para el detalle, no para enterarse | Sólo "Plan Gratis" con el consumo adentro — obliga a un tap para saber si estás cerca del techo |
| Conexiones adentro | Fila con estado "Al día" en píldora gris | Decisión A; el 02 la dibuja completa. Estado en gris: es feedback, no un botón (Decisión B) | Píldora terracota — parecería tocable |
| "Cerrar sesión" | Link terracota profunda, separado del bloque, **sin rojo** | Es reversible y frecuente: no es una zona de peligro. Lo destructivo de verdad (borrar cuenta) no vive en un índice — pide su propio flujo con consecuencias declaradas | Rojo de destrucción — inventa un color fuera de paleta y le pone dramatismo a un logout; enterrarlo — patrón oscuro |
| Input+mic también acá | La barra no desaparece en Cuenta | Regla heredada del 02: hablarle es la vía principal en cualquier pantalla ("cuánto me queda del plan" se puede decir) | Ocultarlo en configuración — degrada el canal identitario donde más fricción hay |

## Lane 2 · El plan

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| La barra | Pista `arena-30`, relleno **negro**, 8px | Decisión B: es dato, no botón. El 09 descartó "gráficos como decoración", pero esto no decora: es la única forma de leer una cuota de un vistazo, y la regla del insight se cumple (dato + consecuencia + acción posible al lado) | Barra terracota — leería como tocable y gastaría acento en un dato; anillo de progreso — más pixeles para la misma información; sólo el número — obliga a hacer la división mentalmente |
| El desglose, en palabras de la app | "Anotar cobros y gastos", "Mails mandados", "Facturas emitidas" | Los mismos verbos que el usuario usa al hablarle. Y **la cuenta cierra a la vista**: 96+41+12+9+6 = 164 ✓ — verificable, como toda cifra de la serie | Categorías técnicas ("API calls", "writes") — jerga; no mostrar desglose — el usuario no puede corregir su consumo si no sabe en qué se le va |
| Sin urgencia fabricada | Al 82% no hay rojo, ni cuenta regresiva, ni "¡se te acaba!" | Todavía no pasó nada. Inventar alarma erosiona la credibilidad de los avisos reales — la misma lógica del silencio de Mi día en el 09 | Barra roja al 80% — presión comercial disfrazada de aviso de sistema |
| Un solo primario | "Pasar a Profesional", fill `#DE7250` + display 20 Bold blanco | Regla 28/07 v2. Es el único botón: la otra opción (esperar) no necesita botón porque es lo que pasa solo | Dos botones (esperar/pasar) — "esperar" no es una acción que se ejecute |

## Lane 3 · El límite

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| El aviso vive **en el chat** | Burbuja de Odobi en el hilo, no modal ni paywall | Guión §5 LITERAL: «Usaste las [X] acciones del mes — se ve que le estás dando laburo, bien ahí. Tenés dos opciones: esperás a que se renueven, o pasás al plan [Y] y seguimos ahora. Como prefieras, yo no me voy a ningún lado.» Copiado tal cual, con X=200 e Y=Profesional | Modal de upgrade — interrumpe y convierte al socio en vendedor; pantalla de bloqueo — trata al usuario como moroso por usar mucho el producto |
| El techo se toca **haciendo** | El aviso llega tras pedir algo que Odobi debe ejecutar (mandar el presupuesto), no al navegar | Coherente con la definición: gasta lo que Odobi hace. Chocarse el límite al abrir una pantalla sería incoherente con la propia regla | Aviso al abrir la app — castiga por entrar |
| El tono | "se ve que le estás dando laburo, bien ahí" + "yo no me voy a ningún lado" | §5: el límite se cuenta como **consecuencia de usarlo mucho**, no como falta del usuario. Y cierra sin presión | "Alcanzaste tu límite. Actualizá tu plan para continuar" — correcto y ajeno; cualquier "¡" — léxico prohibido |
| Dos chips del mismo tamaño | "Pasame a Profesional" / "Espero a que se renueven" | Esperar es una opción legítima, no el castigo por no pagar. Registro de chip = voseo imperativo del usuario hacia Odobi (taxonomía del 04) | "Esperar" en gris chiquito — dark pattern; un solo chip de upgrade — esconde la salida gratuita que el guión promete |
| **El input sigue vivo** | La barra no se deshabilita al tope del plan | Consecuencia directa de "preguntar no gasta": al límite Odobi deja de **ejecutar**, no de **responder**. El libro que el usuario ya cargó sigue siendo suyo y consultable — si se apagara todo, el límite se leería como secuestro de datos | Deshabilitar el input — convierte un tope de uso en rehén de la información del usuario |

## Continuidad narrativa

Lanes 1–2: **martes 21**, 10:20–10:21, dentro de la semana continua (lunes 20 → viernes 25) de 03/04/05/06/09/02. Lane 3: **jueves 30**, fin de mes — fuera de la semana a propósito, porque el tope se toca cuando el mes se agota. Fernández y su presupuesto vienen del 06.

## Contrastes (todos pares ya calculados)

`#1A1512` s/crema 16.37:1 ✅ (número grande, burbujas) · `#5C534C` s/crema 6.79:1 ✅ ("de 200", renovación) · `#5C534C` s/blanco 7.51:1 ✅ (sub-textos, estado, desglose, ✓✓) · `#B04A2E` s/blanco 5.43:1 ✅ (chips, "Cerrar sesión", tab activa) · `#1A1512` s/arena-30 14.56:1 ✅ (íconos en tiles) · blanco s/`#DE7250` 3.17:1 ✅ AA texto grande ("Pasar a Profesional", display 20 Bold — regla 28/07 v2) y sólo gráfico para el mic (1.4.11) · relleno negro s/pista `arena-30` — barra decorativa-informativa sin texto, no aplica 1.4.3.

## Autoevaluación (checklist kickoff §4)

1. Terracota ≤10% → ✅ lane 1 ≈3% · lane 2 ≈8% (el único botón grande) · lane 3 ≈4%.
2. WCAG AA calculado → ✅ pares arriba, sin combinaciones nuevas.
3. 2 familias / 4 tamaños (28-20-16-13) / 2 pesos → ✅.
4. Voseo, sin léxico prohibido, §5 → ✅ (guión del límite verbatim; "consultas"/"tokens" **cero veces dentro del frame** — sólo en la meta-capa citando la regla).
5. Cero orbes/glow/glassmorphism → ✅.
6. Caja "Odobi" correcta → ✅.
7. Grilla 8pt, thumb zone, targets ≥44pt → ✅ (filas 64pt, chips 48pt, botón 56pt).
8. Decisiones con fundamento citable → ✅ estas tablas.

## Pendientes que deja abiertos

- **El número (200) es a calibrar** — experimento de producto, no diseño.
- **Qué cuenta como acción** es una **propuesta de diseño**, no una regla del repo: hay que validarla contra el costo real por operación antes de prometerla.
- **"Datos del negocio" y "Avisos"** aparecen como filas del índice pero no tienen pantalla dibujada. No hacía falta para lo que este mockup demuestra; quedan como destinos declarados.

---

## Revisión 16/08 — se retira la tabbar

Cuenta sigue siendo una **pantalla apilada** a la que se llega desde el avatar. Con el modelo de capas el argumento se vuelve más fuerte y más exigente a la vez: **el avatar es la única puerta**, así que el punto de estado que lleva encima es lo único que avisa que ahí adentro hay algo que mirar.

---

> **Revisión 18/08/2026 — el label del botón pasa de 20 a 19 px.** Donde este documento dice
> «display 20 Bold» sobre terracota, hoy son **19**. Decisión de Martin: a 20 el botón pesaba más que
> el contenido de la propia pantalla. ⚠️ **19 es el piso, no una preferencia:** WCAG cuenta como texto
> grande el bold desde **18,66 px**, y eso es lo único que vuelve legal el 3,17:1 de blanco sobre
> `#DE7250`. A 18 px el botón deja de cumplir sin que se note a ojo. Token: `--fs-btn:19px`.
