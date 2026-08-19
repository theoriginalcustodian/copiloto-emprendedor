# DECISIONES — Experimento Wise A/B (home conversacional)

Pieza: `index.html` (22/07/2026). Experimento **timeboxed** de la tarea 1 del plan. **Veredicto original: gana B acotada** — está escrito al pie del propio HTML, contra criterios definidos ANTES de evaluar. Este archivo lo formaliza y, sobre todo, **audita qué sobrevivió** de aquel veredicto después de las decisiones del 26, 28 y 29/07. Cerrado 06/08/2026.

**El experimento está cerrado. No se reabre**: su función era decidir la dosis, y la dosis ya está incorporada a los 9 mockups. El HTML queda como registro, no como referencia de UI vigente (su frame usa la nav de 4 secciones, derogada).

---

## 1 · Qué se estaba probando

No era "Wise sí / Wise no". Era **cuánta** dosis de Wise admite Odobi sin romper reglas duras. Las dos versiones comparten tokens (`tokens/odobi.css`), contenido y arquitectura; lo único que varía es la dosis.

| | A | B |
|---|---|---|
| Tesis | 60/30/10 estricta, tipografía contenida (jerarquía por peso de Inter) | Lo permitido de Wise: display protagonista, iconografía monocroma, color pleno solo en momento display |
| Terracota en operativa | ≈2% (mic + delta + tab activa) | ≈2% — **idéntico**: B no agrega color, agrega tipografía |

Antecedente que evita confusión: la **paleta** de Wise (verde `#9FE870` + `#163300`) ya había sido descartada en la sesión de color (handoff §, historia de la decisión). Este A/B no la reabre — toma de Wise el **método** (tipografía como identidad, color como señal), no los colores.

## 2 · Criterios y resultado

Los 5 criterios se fijaron antes de mirar las piezas — la condición del timebox.

| # | Criterio | A | B |
|---|---|---|---|
| 1 | 60/30/10 en pantalla operativa | ✅ ≈2% | ✅ ≈2% |
| 2 | WCAG AA calculado en todos los pares | ✅ | ✅ |
| 3 | Singularidad / vocatividad (Chaves) | ❌ correcta pero conservadora: podría ser cualquier chat prolijo | ✅ display + escucha terracota = reconocible sin símbolo |
| 4 | Jerarquía conversacional intacta | ✅ | ✅ **con condición**: el saludo display solo al abrir sesión |
| 5 | Momento display sin fatiga a 20+ usos/día | — (sheet neutro, no compite) | ✅ transitorio (<segundos), sin animación agresiva |

**Veredicto: gana B, acotada.** El dato que decidió: B ganó el criterio 3 **sin costo** en 1 y 2 — no hubo que sacrificar 60/30/10 para ganar distinción, porque la distinción vino por tipografía y no por color. Un B que hubiera teñido fondos habría perdido el 1 y se descartaba.

De Wise se **descarta** todo lo demás: fondos teñidos, color como ambiente, ilustración decorativa.

## 3 · Qué se adoptó y qué pasó después (auditoría 06/08)

| Adoptado el 22/07 | Estado hoy | Qué pasó |
|---|---|---|
| (1a) NeueEinstellung Bold en **saludo de sesión** | ❌ **DEROGADO** (M5, 28/07 · `03/DECISIONES.md`) | La app dejó de abrir en el chat: abre en Mi día. Sin apertura de sesión no hay saludo de apertura. Y el riesgo que el propio A/B había señalado (consume ~96px de thread, "solo si hay algo que anunciar") se resolvió por eliminación, no por regla de uso. El 02 lo intentó reintroducir y también se cayó |
| (1b) NeueEinstellung Bold en **cifras clave de datacards** | ✅ **vigente** | Es el `$286.000` de la portada del 09 y de todas las datacards. La mitad del ítem 1 que sí sobrevivió, y la más importante: es donde la tipografía hace trabajo de jerarquía, no de saludo |
| (2) Iconografía **monocroma de trazo** | ✅ **vigente, especificada** | El 28/07 pasó de "dibujada a mano" a **Iconoir** (MIT). No es una derogación: es la misma regla con una fuente única para que escale sin perder consistencia |
| (3) **Escucha a pantalla completa en terracota** como único momento display de la UI | ✅ **vigente** — el hallazgo más duradero del experimento | Sigue siendo la excepción declarada de terracota plena. Se le sumaron después splash, celebración y onboarding-reveal, pero la escucha es la que se ve 20+ veces por día: sigue siendo LA impresión de marca (Wilensky, invocación) |

### Detalles del HTML que hoy están vencidos (no invalidan el veredicto)

Son de superficie: el experimento decidió **dosis**, y esas decisiones tocaron otras cosas.

| En el HTML (22/07) | Vigente hoy | Regla que lo pisó |
|---|---|---|
| Nav de 4 secciones (Chat / Apps / Conexiones / Cuenta) | 3 tabs (Mi día / Chat / Apps) + Cuenta en el avatar | Decisión A, 26/07 |
| Delta −18% en terracota, contado dentro del ≈2% | Delta en negro `#1A1512` | Decisión B, 26/07 — el delta es dato, no botón. La cuenta del criterio 1 **no se rompe**: hoy hay menos terracota que la medida, no más |
| Botón "Cortar": **negro** sobre terracota (5,71:1) | Blanco display 20 Bold + borde blanco (3,17:1, AA texto grande) | Regla 28/07 **v2**: nunca texto negro sobre terracota. La v1 del 22/07 que usa este HTML quedó derogada |
| `TODO motion-ref` en las barras de la escucha | Resuelto por otra vía | El motion se cerró en `explorations/splash-o/` (spec propia), no con el MCP 60FPS |

## 4 · Alternativa descartada del método

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Formato del experimento | **A/B con criterios escritos antes de mirar** y veredicto obligatorio | Timebox con criterio previo evita la deriva que el propio handoff §246 documenta (cinco cambios de dirección en color en una sesión). Con los 5 criterios fijos, B ganó por una razón enunciable, no por gusto | Iterar una sola versión hasta que "quede bien" — sin contrafáctico no hay forma de saber si la dosis era necesaria o solo tolerable |
| Alcance de la adopción | **Acotada**: 3 ítems nombrados, el resto de Wise explícitamente descartado | Adoptar "el espíritu de Wise" no es accionable y filtra fondos teñidos por la ventana | Adoptar B entera como estilo — arrastra el color como ambiente, que rompe 60/30/10 |
