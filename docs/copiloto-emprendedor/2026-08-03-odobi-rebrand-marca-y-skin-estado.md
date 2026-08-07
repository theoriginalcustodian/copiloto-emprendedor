# Odobi — rebrand de marca y skin: estado del proyecto de diseño

> **Fecha:** 2026-08-03
> **Naturaleza del documento:** síntesis persistida de una revisión hecha HOY sobre un proyecto de
> diseño en **Claude Design** ("Copiloto emprendedor Odobi") — ese proyecto vive fuera de este repo
> (`claude.ai/design`), no tiene código ni assets acá. Este doc es la memoria de referencia para
> retomar el diseño sin tener que releer el chat original.
> **Pedido por:** el operador, vía la sesión de Planificación.
> **Motivo de existir:** el proyecto de diseño referencia el handoff funcional de este repo y a su
> vez este repo necesita saber en qué quedó ese proyecto — sin este doc, esa información sólo vive
> en Claude Design y no es buscable ni recuperable si la sesión de diseño se pierde.

---

## 0. Advertencia metodológica — leer antes de confiar en cualquier fecha/cita de abajo

El historial de chat del proyecto de diseño se pudo leer **sólo parcialmente**. El tool de lectura de
conversaciones de Claude Design tiene un cap de 256 KiB sin paginación; la conversación real pesa
~571 KB. Se pudo leer aproximadamente el **46%** — todo hasta **2026-07-24 02:18 UTC**, punto en el
que el archivo se corta a mitad de un mensaje del usuario. El **54% restante no se leyó**.

Lo que sigue combina dos tipos de evidencia, marcados explícitamente en cada punto:

- **Texto capturado** — leído literalmente del chat, con hora UTC. Confianza alta.
- **Inferencia desde archivos finales** — el chat que la generó no se pudo leer; se reconstruye el
  qué pasó a partir del contenido y metadata de los `.dc.html` guardados en el proyecto. Confianza
  media — es lo mejor disponible, pero no es lectura directa de la decisión.

No se debe tratar ninguna inferencia como si fuera texto capturado. Cada vez que este documento
afirma algo sin evidencia firme, lleva la marca `[ASSUMED_PENDING_VERIFY]` o
`[REQUIRES_LIVE_VALIDATION]` — no está disuelto en prosa segura a propósito.

---

## 1. Qué es Odobi (del brief visual del proyecto)

Copiloto conversacional y de voz para emprendedores en Argentina — **el mismo producto de este
repo**, con nueva marca. Fuente: `uploads/ODOBI_Brief_Visual.md` dentro del proyecto de diseño.

### 1.1 Identidad verbal

- **Esencia de marca:** respaldo — *"emprender sin estar solo"*.
- **Posicionamiento:** *"El socio que ve tu negocio entero, sin quedarse con la mitad."*
- **Tagline:** *"No emprendas solo."*
- **Arquitectura de marca:** Odobi + descriptor *"tu copiloto emprendedor"* — el descriptor acompaña,
  nunca compite con el nombre.
- **Pronunciación:** o-DO-bi (grave).
- **Caja:** SIEMPRE "Odobi" (mayúscula inicial, resto minúscula) — **nunca** "ODOBI" en mayúsculas
  sostenidas, en ningún entregable.

### 1.2 Personalidad

Hombre ~35 años simbólico, canchero pero serio, capaz, sincero, calidez rioplatense.

**Nunca:** servicial-genuflexo, técnico-frío, gurú motivacional, corporativo-solemne, infantil. Ni
startup juguetona con blobs/degradés, ni fintech azul-corporativa.

### 1.3 Símbolo

Abstracto — explícitamente **no** personaje ni mascota. Territorio conceptual: *"la O de Odobi
fusionada con la voz/onda de sonido"* — el producto al que le hablás.

Punto de partida del brief (no imposición cerrada): **"La O que habla"** — O concéntrica partida que
irradia ondas.

Riesgo de ejecución que el brief ya señalaba de entrada: que no se lea "ojo" ni "diana de tiro"; y
que tenga grosor suficiente para sobrevivir a 16px (favicon).

### 1.4 Paleta — DECIDIDA, no negociable

| Rol | Color | Hex |
|---|---|---|
| Lienzo | Blanco / crema | `#FFFFFF` / `#F7F3EC` |
| Estructura | Negro tostado | `#1A1512` |
| Acento (único, ≤10% de superficie) | Terracota | `#DE7250` |
| Acento sobre fondo claro | Terracota profunda | `#B04A2E` |
| Apoyo | Arena | `#E8A088` |

**Proporción obligatoria: 60/30/10** — blanco/crema ≈60%, negro tostado ≈30%, terracota nunca más del
10% de superficie.

**Racional:** el naranja despega de la categoría — fintech/IA argentina vive en azul-violeta
(Ualá, Brubank, MercadoPago).

**Contraste verificado (WCAG):**

| Combinación | Ratio | Resultado |
|---|---|---|
| Texto negro tostado sobre terracota | 5.71:1 | ✅ |
| Texto blanco sobre terracota | 3.17:1 | ❌ |
| Terracota `#DE7250` como texto sobre crema | 2.86:1 | ❌ |
| Terracota profunda `#B04A2E` como texto sobre crema | 4.91:1 | ✅ (usar esta, no `#DE7250`, para texto) |

**Consecuencia de diseño directa:** NO puede haber un ícono de app con fondo terracota pleno. Las
aplicaciones válidas del isotipo son: terracota sobre negro tostado, negro tostado sobre crema/blanco,
o monocromo.

### 1.5 Tipografía — DECIDIDA

- **Logotipo / display / títulos:** NeueEinstellung Bold (licencia adquirida).
- **Cuerpo / UI:** Inter (Regular, Medium) — Google Fonts.

### 1.6 Entregables requeridos del sistema de marca

1. Isotipo — positivo, monocromo, negativo sobre negro/terracota.
2. Lockup horizontal (isotipo + "Odobi" + descriptor).
3. Lockup vertical.
4. Ícono de app — fondo negro tostado y fondo crema — + favicon.
5. Área de resguardo / tamaño mínimo.
6. Usos incorrectos — mínimo 6 casos.
7. Archivos SVG editable + PNG.
8. Deseable: propuesta de animación del isotipo.

### 1.7 Evaluación contra los 7 criterios de Chaves (*La Marca Corporativa*)

Calidad gráfica genérica · ajuste tipológico · vigencia · versatilidad (de 16px a vía pública) ·
vocatividad · singularidad (diferenciarse de: **Odoo** — riesgo fonético ya conocido —, de asistentes
IA genéricos con esferas/orbes, y de fintechs azul-violeta como Ualá/Brubank/MercadoPago) ·
reproducibilidad (1 tinta, monocromo, bordado, sello).

**Contacto del brief:** Martin, cofundador.

---

## 2. El handoff funcional — fuente de verdad que el rebrand visual debe respetar

Antes de este rebrand ya existía en este mismo repo:
`docs/copiloto-emprendedor/2026-07-23-handoff-diseno-nuevo-cascaron-mapa-funcional-completo.md` — el
mapeo completo de toda la funcionalidad real de la app (pantallas, flujos, arquitectura, invariantes
de UX) contra el código verificado. Ese documento **no se duplica acá**; se referencia por nombre
porque el proyecto de diseño lo subió como insumo (`uploads/2026-07-23_handoff-diseno-nuevo-cascaron-mapa-funcional-completo.md`)
y tuvo que conciliarlo con el brief de marca.

**La tensión que el proyecto de diseño tuvo que resolver:**

- La cáscara actual de la app es un sistema **"glass" oscuro multi-tema** (5 skins:
  cian/violeta/ámbar/medicalWhite/black), tipografía Space Grotesk + JetBrains Mono, con un panel
  deslizable de dos capas (escritorio de funciones + conversación) — **muy distinto** de la
  identidad Odobi (clara, cálida, Inter, terracota).
- **6 principios que ningún rediseño puede romper**, heredados del handoff funcional:
  1. Voz como camino primario.
  2. La respuesta puede tardar — fire-and-forget + polling, sin streaming.
  3. Sesión única y permanente — no existe "nueva conversación".
  4. Lo irreversible siempre se confirma con card nombrando el servicio real.
  5. Un solo glass a la vez — invariante anti-bug de device.
  6. Todo por tokens y multi-tema — nada de hex sueltos.

---

## 3. Historial real del proyecto de diseño — cronología y estado

### 3.1 Cronología (todo 2026-07-24, horas UTC — texto capturado, confianza alta)

| Hora UTC | Evento |
|---|---|
| 01:00 | Usuario pide reusar un diseño previo de otro proyecto ("Waves Ligeras"); el asistente descubre que ese PDF es en realidad la propuesta de rebrand Odobi. |
| 01:18 | Usuario sube el brief visual (`ODOBI_Brief_Visual.md`) + el handoff funcional completo, pide "una ui/ux totalmente coherente con el copiloto emprendedor". El asistente identifica la tensión: brief = identidad clara/cálida/terracota; producto real = cáscara oscura "glass" multi-tema. |
| 01:20 | **El usuario resuelve la tensión.** Cita literal: **"La nueva UI adopta la identidad Odobi"** — clara/terracota como piel principal, mobile + web, pide bocetar antes de construir. |
| 01:24 | **Turno 1** — 4 direcciones low-fi: 1a (mobile panel deslizable fiel al handoff), 1b (mobile conversación-primero), 1c (web dos paneles), 1d (componentes: HUD de voz, gate de confirmación, tarjeta editable, Mi día). |
| 01:29 | Usuario pide modo oscuro y **confirma 1c para web**. |
| ~01:35 | **Turno 2** — variantes dark de 1a/1c. |
| 01:53 | Usuario: se ve "muy plano...estricto...fijo", pide profundidad/relieve/tarjetas retroiluminadas. |
| ~01:57 | **Turno 3** — material con profundidad (tiles elevados, glows de paleta, orbe de voz con halo). |
| 02:12–02:14 | Usuario pide bajar intensidad de los glows en mobile claro, después aplicar mismo criterio a web. |
| — | **Turno 4** — web claro/oscuro con profundidad. |
| ~02:14 | Usuario pide **eliminar los glows/globos** — "con la profundidad ya está bien...más limpio y elegante". El asistente saca 25 glows, deja sólo sombra/relieve. |
| ~02:15 | Usuario pide, como experimento aparte ("no implementes nada" primero), un skin "Matrix". El asistente propone 4 ideas (rioplatense, terracota-fósforo, "la voz materializa", terminal); el usuario pide los 4. |
| — | **Turno 5** — 4 skins Matrix bocetados, con ajustes (lluvia más lenta, columnas completas, cursor sólo en input, "Odobi" en blanco). |
| **02:18** | **El usuario DESCARTA TODO Matrix por completo.** Cita literal: **"elimina todos los experimentos de matrix...no me gusta ninguno....dejemoslo todo como estaba"**. El asistente borra el Turno 5 entero y sus keyframes. **Queda vigente: Turnos 1-4** (shells low-fi + dark + material con profundidad limpio, sin glows). |
| 02:18 (fin del texto capturado) | El asistente pregunta: **"¿Seguimos con el plan de construir la app interactiva? Sólo falta que confirmes el shell mobile (1a o 1b)."** El usuario responde "excelente...ahora quiero qu[CORTADO]" — el archivo se corta ahí. **No hay confirmación textual de si ganó 1a o 1b.** |

### 3.2 Lo que pasó después — reconstruido SOLO por evidencia de archivos

`[ASSUMED_PENDING_VERIFY]` en su totalidad — no hay conversación leída que explique estos pasos; se
infiere exclusivamente de nombres, contenido y metadata de los archivos guardados.

- **03:39 UTC (24/07)** — se guarda `Odobi Mobile.dc.html`, autodescrito como *"Pantallas mobile —
  todas las variantes"* / *"Todas las exploraciones mobile agrupadas: concepto de la O, glass,
  profundidad, modo oscuro, shells y componentes"* — sigue siendo **galería de exploración**, no una
  app cerrada.
- **03:42 UTC** — `Odobi Web.dc.html`, equivalente web.
- **03:59–04:00 UTC** — `Odobi Mobile Mariposas.dc.html` y `Odobi Web Mariposas.dc.html` (+ capturas
  `scraps/mariposa-dark*.png`). Se autodescriben: *"Odobi · Mobile · Mariposas"* / *"Mobile completo
  — claro y oscuro"* / *"Todas las pantallas en paleta naturalista: home, concepto de la voz,
  facturación de 4 pasos, estados de la O y componentes — en claro y oscuro."* A diferencia del
  archivo hermano sin "Mariposas" (galería de exploraciones sueltas), este es un **set más resuelto y
  completo** de pantallas de producto (incluye ya la facturación de 4 pasos, que en el chat capturado
  todavía no se había bocetado).

  **Sobre el nombre "Mariposas":** no es un concepto de diseño literal — no hay elementos con forma
  de mariposa, ni referencias a "ala"/"hinge"/"flip" en ningún archivo. Es, con alta probabilidad, un
  **codename** que Claude Design le puso automáticamente a un fork/iteración posterior del set (mismo
  patrón que "Waves Ligeras" al principio de la sesión, que tampoco describía su contenido real).
  `[ASSUMED_PENDING_VERIFY]` — no se pudo confirmar el motivo del nombre porque la ventana de
  conversación que lo generó (03:39–04:00) no está en el material disponible.

- **2026-08-02, 23:23–23:24 UTC** — la actividad **más reciente** del proyecto, apenas horas antes de
  esta revisión y 9 días después de la sesión de julio: se crean/editan `Odobi Marca O Interior.dc.html`,
  `Odobi Marca 10 Variantes.dc.html`, `Iconos Odobi.dc.html` — sesión dedicada exclusivamente al
  símbolo/isotipo/ícono, separada de las pantallas de producto.

### 3.3 Estado del símbolo — el concepto del brief se sostuvo, con una iteración de legibilidad documentada

- **`Odobi Marca 10 Variantes.dc.html`** (v1, sin marca de versión explícita) — título interno *"La O
  que habla · 10 variantes"*. Cita a preservar: *"El micrófono es el corazón de la app: se opera por
  voz. Cada variante es la O de Odobi que cierra con ondas circulares de emisión."* La variante 01 se
  llama literalmente "Concéntrica". Estructura en negro tostado, emisión en terracota.

- **`Odobi Marca O Interior.dc.html`** (marcado explícitamente como *"Odobi · Marca · v2"* dentro del
  archivo) — título interno *"La O cerrada, con la voz adentro"*. Cita a preservar: *"Ahora la O es un
  círculo completo — se lee O, no C — y adentro vive la voz: waveforms, un mic coherente con el
  sistema, u ondas que simulan la emisión."*

  Esto revela el **problema real que motivó la v2**: la v1 (anillo parcial/partido con ondas saliendo
  hacia afuera) se leía como la letra **"C"**, no como "O" — un problema de **legibilidad de marca**,
  no un cambio de concepto. La v2 lo resuelve cerrando el círculo completo y moviendo el elemento de
  voz **hacia adentro** del círculo.

- **`Iconos Odobi.dc.html`** (biblioteca de glifos de la app, no sólo el isotipo de marca) propaga el
  mismo motivo de forma consistente. Cita a preservar: *"El motivo: la O que habla — Una O
  concéntrica partida que irradia ondas... la señal (terracota) se separa de la estructura (negro
  tostado)."*

**No hay evidencia de que se haya elegido una variante final** entre las 10 de ninguno de los dos
archivos de marca — ninguno tiene marca de "seleccionado" / "final". Es exploración en curso, no
cerrada.

---

## 4. Estado actual real — sin ambigüedad

- El proyecto de identidad Odobi **NO está cerrado ni aprobado**. La señal más fuerte es temporal: la
  sesión más reciente (símbolo/ícono) fue **anoche** (2026-08-02), sin resolución declarada entre 10
  variantes candidatas.
- **No hay confirmación textual de si el shell mobile final es 1a o 1b** — se preguntó 3 veces en el
  chat capturado (01:29, 01:57, 02:14) y la respuesta a la tercera pregunta quedó cortada por el
  límite técnico de lectura, no porque no exista. Puede estar en la parte no recuperada del chat, o
  puede haberse resuelto implícitamente en los archivos posteriores (`Odobi Mobile.dc.html` /
  `Mariposas`) sin que quede una declaración textual explícita. `[REQUIRES_LIVE_VALIDATION]`.
- **Única decisión de cierre nítida y sin ambigüedad en todo el proyecto:** el descarte total de los 4
  experimentos de skin "Matrix" — el usuario los rechazó enteros y pidió borrarlos, y así se hizo.
- **Paleta y tipografía** (terracota `#DE7250` / negro tostado `#1A1512` / crema `#F6F1E9` o
  `#F7F3EC`, Inter para UI) se mantienen **consistentes en todos los archivos verificados** del
  proyecto — sin contradicción con el brief en ese eje.
- **Brecha no confirmada:** no se verificó el uso de **NeueEinstellung Bold** (la tipografía de
  display/logotipo que el brief exige) en ninguno de los archivos de Marca/Iconos leídos — esos
  archivos usan sólo Inter + JetBrains Mono vía Google Fonts. Puede ser que simplemente no aplique a
  esas piezas específicas (son specimens de símbolo/ícono, sin texto display), o puede ser una brecha
  real de ejecución. No hay evidencia suficiente para afirmarlo en ningún sentido.
  `[REQUIRES_LIVE_VALIDATION]`.

---

## 5. Archivos del proyecto de diseño (Claude Design — NO en este repo)

**Proyecto:** "Copiloto emprendedor Odobi"
**ID:** `eb2c9e3f-453b-4886-a5fc-5b038942e1c5`
**URL:** `https://claude.ai/design/p/eb2c9e3f-453b-4886-a5fc-5b038942e1c5`

| Archivo | Rol |
|---|---|
| `uploads/ODOBI_Brief_Visual.md` | Brief de identidad — fuente de la sección 1 de este doc. |
| `uploads/2026-07-23_handoff-diseno-nuevo-cascaron-mapa-funcional-completo.md` | Copia subida al proyecto del handoff funcional que también vive en este repo. |
| `uploads/ropuesta_a_charlar.pdf` | Propuesta original de rebrand ("Waves Ligeras" → Odobi) que arrancó todo. |
| `Boceto Odobi.dc.html` | Canvas de trabajo original, Turnos 1-5 (incluye los descartados de Matrix, aunque el usuario pidió borrarlos del turno 5 — no confirmado si el HTML final los retiene o no). |
| `Odobi Mobile.dc.html` / `Odobi Web.dc.html` | Galería de TODAS las exploraciones agrupadas (concepto O, glass, profundidad, dark, shells, componentes) — snapshot de las 03:39-03:42 del 24/07. |
| `Odobi Mobile Mariposas.dc.html` / `Odobi Web Mariposas.dc.html` | Versión más resuelta y posterior, "Mobile completo — claro y oscuro" con más pantallas (incluye facturación de 4 pasos) — snapshot de las 03:59-04:00 del 24/07. Ver nota sobre el nombre "Mariposas" en §3.2. |
| `Odobi Marca 10 Variantes.dc.html` | 10 variantes del isotipo "O que habla" (v1, sin cerrar). |
| `Odobi Marca O Interior.dc.html` | v2 del símbolo — la O cerrada con la voz adentro (ajuste de legibilidad C→O). |
| `Iconos Odobi.dc.html` | Biblioteca de íconos/glifos de la app con el mismo motivo de marca (sólo 60 de sus ~200 líneas fueron leídas; no hay señal de que esté terminado). |
| `scraps/check-tiles.png`, `scraps/mariposa-dark.png`, `scraps/mariposa-dark2.png` | Capturas de referencia. |
| `support.js` | Infraestructura interna de Claude Design, no contenido de diseño. |

---

## 6. Pendientes explícitos

1. **Confirmar el shell mobile definitivo:** 1a o 1b — o si ya se resolvió de forma implícita en los
   archivos posteriores sin quedar declarado en texto.
2. **Cerrar cuál de las variantes de símbolo es la definitiva** — entre v1 (10 variantes) y v2 (O
   interior), o cuál puntual de las 10. Sesión de anoche (2026-08-02) sin resolución visible.
3. **Confirmar si `Iconos Odobi.dc.html`** (biblioteca de glifos) está terminada o sigue en curso.
4. **Recuperar la parte de la conversación no leída** (2026-07-24 desde las 02:18 UTC en adelante, y
   toda la sesión del 2026-08-02) si hace falta — la única vía es abrir el proyecto directo en
   `claude.ai/design`; el MCP no pagina transcripts que superan 256 KiB, y este los supera por un
   margen grande (571 KB reales vs 256 KB de cap).
5. **Verificar en vivo si NeueEinstellung Bold** se está aplicando en algún entregable de marca con
   texto display — ninguno de los archivos leídos tenía texto suficiente para confirmarlo.
