# DECISIONES — 10 · Arranque (síntesis con el build de David)

Creado el 15/08/2026. Dibuja lo que el análisis del build recomienda (`audit/ANALISIS-PROTOTIPO-DAVID.md` §7): la propuesta que hasta ahora existía sólo en ASCII dentro de la lámina.

**Qué conserva del build de David:** el mecanismo completo. Capas de profundidad movidas por un gesto, con la ingeniería de `PanelDeslizable` ya resuelta y verificada en device (snap con la velocidad real del dedo, flick por dirección arriba de 500 px/s, toggle por tap). **Cambia una sola cosa: qué capa está adelante.**

---

## 1 · Las decisiones

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Capa del frente | **Mi día**, no la conversación | El glosario del propio repo define Mi Día como *"el tablero donde el copiloto **habla primero**"*, y el detector de 8 reglas ya corre. Un asistente que abre preguntando traslada al usuario la carga de saber qué pedir (*gulf of execution*) | Chat adelante (build actual): la primera pantalla devuelve la pelota. Tabs (Decisión A): un tap que cambia de pantalla en vez de una capa que convive |
| El composer | **Es el borde visible del panel de conversación**, no una barra más | Resuelve tres cosas de una: el chat queda a un gesto **y** a un toque (WCAG 2.5.1), no hace falta un cartel que explique el gesto —el input ya es el signo— y desaparece la tira de texto a 2,90:1 del build actual | Handle con leyenda ("DESLIZÁ PARA…"): es la falla de contraste y además enseña el gesto difícil escondiendo el fácil |
| Dos gestos verticales | **Opuestos, con asidero propio cada uno**: arriba trae el escritorio, abajo trae la conversación | No compiten por el mismo movimiento: se reparten el eje. Cada uno tiene un asidero visible en su borde, así que el estado de la pantalla se lee por lo que asoma | Un solo gesto con tres estados: obliga a recordar el orden de las capas. Dos gestos en la misma dirección: ambigüedad garantizada |
| Tabbar | **No hay** | Con tres capas y asideros visibles arriba y abajo, la posición se lee sin indicador | ⚠️ **Deroga la Decisión A (3 tabs) si se adopta.** El costo real es perder el indicador explícito de posición (Nielsen #1); lo compensa que siempre asome el borde de la capa vecina. **Queda como decisión abierta de Martin + David, no cerrada acá** |
| Escritorio | **7 funciones en 2 bandas** (Registrar / Mirar), sin scroll horizontal | Hick-Hyman castiga los conjuntos equiprobables: 9 tiles iguales son una decisión entre nueve; dos bandas son una entre dos y después entre tres o cuatro. Agrupa por la pregunta real del usuario: *"¿vengo a cargar algo o a ver cómo voy?"* | 9 tiles con scroll horizontal (build actual): la affordance más débil de mobile, compitiendo con el gesto vertical del panel y partiendo labels a la mitad |
| Orden dentro de cada banda | **Frecuencia × urgencia**, no categoría contable | Gastos primero: es lo que más se olvida y **sin gastos el margen miente**. Clientes último: *la cartera se deriva de lo que emitiste* (`CONTEXT.md`), se entra desde un comprobante | Orden contable (ingresos/egresos/documentos): describe el modelo de datos, no el uso |
| Ajustes | **Sale de la grilla → avatar del header**, con punto de estado | Se toca una vez por mes: no puede pesar lo mismo que Gastos. Y hoy está **duplicado** (tile + engranaje) | Dejarlo como tile: ocupa un slot de los buenos |
| Slot vacío en la banda "Mirar" | **Se deja a la vista** | Es dónde entra la 8ª función sin romper la grilla ni volver al scroll horizontal. El racional del grid clonado de DocuMed (*"preparate para más funciones"*) es correcto: lo que estaba mal era la solución | Rellenar con algo: la próxima función rompe el layout otra vez |
| Estado vacío del chat | **Un ejemplo por vez, en rodillo vertical**, dicho como lo diría el usuario | Enseña el registro del habla por imitación: leer "podés registrar gastos" no le dice a nadie que puede decir *"15 lucas"*. **No se tocan** (decisión de Martin, 15/08): un atajo tocable competiría con el gesto que la app quiere enseñar, y el rodillo muestra la *variedad* de lo que se puede decir | Párrafo estático (build actual): el mismo el día 1 y el día 300, y mezcla Apps con Funciones. Chips tocables: compiten con el mic |
| El contrato HITL | **Línea fija que no se apaga nunca** | Es la promesa central del producto. Los ejemplos sí se retiran después de N usos: un andamio que no se retira deja de ser ayuda y ocupa el lugar de la conversación real | Apagar todo junto: se pierde lo único que hay que decir siempre |
| Tema | **Claro** | Es el default real del producto (DoD 05/08). Las capturas de David son de la piel oscura, que es la secundaria | Oscuro para comparar 1:1: valida la piel equivocada como si fuera la principal |

## 2 · El rodillo — la regla y su salvaguarda

Máscara de **una línea exacta** (24 px, `overflow:hidden`), sin asomar las líneas vecinas. **Esa es la decisión, no un detalle de implementación:** si asomaran, el bloque parecería arrastrable y competiría con el gesto vertical del panel, que es el gesto principal de la app. Sin `overshoot` por lo mismo — un rebote lo haría parecer manipulable.

Cumple **WCAG 2.2.2** (*Pause, Stop, Hide*, nivel A) sin agregar controles:

- ~4 s por ejemplo — menos no se lee una frase de seis palabras, más se siente estancado.
- Se detiene al tocar el input o al empezar a grabar (justo cuando ya no hace falta).
- Se detiene sola tras un ciclo completo y queda en el último: principio y fin, nunca loop infinito.
- `prefers-reduced-motion` → sin rotación, un ejemplo fijo.

⚠️ En este mockup el loop **es infinito** porque es una demo que se mira. En la app tiene que parar. Misma advertencia que en `audit/lamina/DECISIONES.md` §4.

**Los ejemplos salen del detector**, no de una lista fija: las 8 reglas que alimentan Mi día ya saben qué le falta a ese negocio (sin gastos → "cargá tu primer gasto"; presupuesto frío → "preguntale a Lucía"). Cero infraestructura nueva.

## 3 · Contraste (calculado, no a ojo)

Hereda los pares ya validados del 09. Los nuevos:

| Par | Ratio | Nota |
|---|---|---|
| `sec #5C534C` s/ blanco | 6,44:1 ✅ | Texto de los asideros. **Sin `opacity` encima** — es exactamente la trampa que rompe el hint del build actual (token 5,06:1 → 2,90:1 efectivo por `opacity:.65`) |
| Ejemplo del rodillo (`sec`, cursiva 16px) | 6,44:1 ✅ | |
| Contrato (`sec` 13px) | 6,44:1 ✅ | Baja de peso, no de contraste |
| Label de banda (`sec` 11px, tracking .14em) | 6,44:1 ✅ | Se distingue por caja alta y tracking, no por ser más claro |
| Negro s/ tile arena-30 `#F8E2DB` | 14,56:1 ✅ | Íconos de las tarjetas |
| Blanco s/ mic `#DE7250` | 3,17:1 ✅ | Ícono = objeto gráfico, WCAG 1.4.11 pide 3:1 |
| `terracota-prof #B04A2E` s/ blanco | 5,43:1 ✅ | Acciones de tarjeta — lo único tocable en terracota (Decisión B) |

**Terracota en esta pantalla:** mic, borde del input, acciones de tarjeta, wordmark. El delta (−18%) va en **negro**: es un dato, no algo que se toque.

## 4 · Íconos

Iconoir (MIT), bajados de `raw.githubusercontent.com` con `curl` y embebidos inline con `stroke-width` 2 y paths **sin stroke propio** (heredan color por CSS). Nuevos en este mockup: `wallet` (Gastos) · `coins` (Ingresos) · `journal-page` (Presupuestos) · `stats-report` (Inteligencia) · `calculator` (Contabilidad) · `user` (Clientes). Reusados del 09: `page`, `clock`, `microphone`.

El monograma sigue siendo dibujo propio: la O real del wordmark con las ondas afuera (rev. 29/07).

## 5 · Lo que este mockup NO resuelve

- **El acento**: dibujado con `#DE7250`/`#B04A2E` (nuestro par). Si gana `#C2452E` del repo, se repinta — son tokens, no estructura. La decisión está abierta (§4.1 del análisis).
- **La voz contextual dentro de cada función** (paso 5 del plan): no está dibujada. Es el cambio que más vale y el más caro.
- **Las pantallas de función**: siguen siendo las de David. Este mockup no las toca.
