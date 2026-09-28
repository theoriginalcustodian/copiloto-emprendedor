# Criterio 3 · Bloque A — matriz web re-medida **por auditoría**

**Fecha de medición:** 2026-09-23, 04:35–04:39 (−03)
**Quién midió:** auditoría (esta sesión). No es una republicación de filas ajenas: cada fila se volvió a capturar y a juzgar.
**Alcance:** **6 ids medidos de 7 del bloque · 7 de los 54 del universo** (`backlog:828`). Este bloque **no cierra el criterio 3** y no pretende hacerlo.

## 0. Qué se midió, contra qué

| | |
|---|---|
| **App** | PWA de prod, `https://copilotoemprendedor.duckdns.org/`, bundle **`assets/index-Cr4NxCOh.js`** |
| **Tenant** | `e2e-device@copiloto.test` (el único canónico), SW + caches purgados antes de navegar |
| **Prototipo** | `Prototipo frontend/odobi-ui/` servido en `localhost:8123`, BL-P2 |
| **Viewports** | 390×844 y 1440×900 |
| **`origin/main`** | `78320bf0` |
| **Cota del deploy** | **prod ≥ `ef8ded27`**, verificado por efecto: la app muestra `agenda-calendario-caida`, testid que sólo existe desde #659. El mapeo exacto bundle→commit sale del manifiesto de deploy y **no se afirma acá**. |
| **Instrumento** | `criterio3-matriz.mjs` **con el arreglo de `5554b0b9`** (fail-closed + selector real de vista + 4.º estado de Agenda). **Las filas de abajo no son reproducibles con la versión anterior del script** — ver §3. |

## 1. La matriz

| id | Veredicto de FE2 (2026-09-22 14:28) | **Veredicto de auditoría (2026-09-23)** | Qué cambió |
|---|---|---|---|
| `detalle` | REQUIERE_TRIAGE → declarada (BL-V20) | **NO MEDIBLE** | Mi día del tenant está **vacío**: `midia-tarjeta-*` = 0, `midia-vacio` = 1, «Nada urgente por hoy», todo en $0,00. `detalle` es la tarjeta expandida: sin tarjeta no hay pantalla. 3 intentos, 3 fallos. **Precondición, no defecto.** |
| `agenda` | **COHERENTE** | **REQUIERE_TRIAGE** | **El veredicto no se sostiene.** Ver §2. |
| `ingresos` | REQUIERE_TRIAGE → declarada | **CONFIRMADO** + 2 diferencias **no** declaradas | Las diferencias de FE2 siguen vigentes una por una. Se agregan: el **affordance de voz** (§4) y el período del header (app «1 sep» vs proto «Agosto»). |
| `presu` | **COHERENTE** | **REQUIERE_TRIAGE** | Estructura, íconos por ítem y tags coinciden de cerca, como decía FE2. Pero el **affordance de voz** (§4) es una diferencia de patrón, no un caveat de captura. |
| `negocio` | REQUIERE_TRIAGE → declarada | **CONFIRMADO** | Las **6** diferencias de FE2 verificadas una por una y vigentes: título duplicado · «el copiloto» vs «Odobi» · confirmación arriba/abajo · card envolvente vs campos sueltos · labels mayúsculas vs preguntas · `<select>` vs texto libre. |
| `afip` | REQUIERE_TRIAGE → declarada | **CONFIRMADO** | Vigente. **Y corrige una atribución mía:** `4ef7946c` (BL-V27, CUIT bloqueado) entró 8 h después de la fila, pero **no es observable** con este tenant — el CUIT está vacío y editable porque no hay ARCA vinculado. Esa fila **no caducó** por ese commit. |
| `cuenta` | REQUIERE_TRIAGE → declarada (1 arreglada) | **CONFIRMADO** | Vigente. **El fix de #653 está en prod y verificado**: la nota interna («Pendiente — muta un ajuste del sistema operativo…») ya no aparece; en su lugar, copy en primera persona. Sigue faltando **«Cambiar el mail»** ([DIFERIDO_CIERRE_B], K-12). |

**Resumen: 6 medidos · 1 no medible · 2 veredictos cambiados.** Y el patrón: **los dos ids que FE2 declaró COHERENTE son exactamente los dos que no se sostienen.** Los cinco que declaró con diferencias estaban bien descritos.

## 2. `agenda`: por qué COHERENTE no se sostiene

FE2 lo declaró COHERENTE citando el estado que veía: «Conectá Google Calendar en Ajustes → Apps para ver acá tu agenda». Hoy la app muestra **otro estado**: «Se cayó la conexión con Google Calendar. Reconectala…». Son dos ramas distintas del mismo componente, `agenda-no-conectado` y `agenda-calendario-caida` (`AgendaScreen.tsx:124` y `:119`), que desempatan por `estadoGoogleCalendar === 'caido'`.

**FE2 no se equivocó: su fila envejeció.** Cronología verificada con `git log`:

| Hora | Evento |
|---|---|
| 2026-09-22 **14:28** | FE2 publica la fila COHERENTE |
| 2026-09-22 **17:23** | `ef8ded27` (#659, BL-V23) agrega el 4.º estado |
| 2026-09-23 **04:15** | Re-medición: la app cae en el 4.º estado |

Hay un matiz que conviene dejar escrito, porque invierte la lectura: **antes de #659 el desempate no existía**, así que la app mostraba «Conectá Google Calendar» **aunque la conexión estuviera caída**. FE2 infirió el estado del tenant («no tiene Calendar vinculado») **desde ese mensaje** — que es justamente el que BL-V23 declaró incorrecto. El tenant sí tuvo Calendar; está caído. Hoy la app está **más** correcta que ayer.

Además, **5 diferencias de header no declaradas**, independientes del estado de conexión:

| | Prototipo | App |
|---|---|---|
| Volver | «‹ Volver» | «← Mi día» |
| Subtítulo | «Tus eventos y lo que vence, en la misma línea.» | *ausente* |
| Estado de conexión | «● Google Calendar conectada» | *sin indicador persistente* |
| Fecha | «Hoy martes 18» | *ausente* |
| Botón | «+ Nuevo evento» | «Nuevo evento» |

**Y lo que decide el futuro de esta fila:** el cuerpo de `agenda` **no es comparable** mientras Calendar esté caído — el prototipo muestra siempre el timeline conectado. Medir `agenda` de verdad exige **reconectar Google Calendar en `e2e-device`**, que necesita un consentimiento OAuth humano (ya identificado como precondición en A3 / H-A3-9). No es trabajo de código.

## 3. El instrumento con el que se midió, y por qué importa

Las filas de arriba **no son reproducibles con el generador tal como estaba en `origin/main`**. Tres defectos medidos, arreglados en `5554b0b9`:

1. **No fallaba nunca.** Cada error caía en un `.catch` que sólo imprimía; no había ningún `process.exit(1)`; cerraba con `console.log('OK')` incondicional. **Medido:** una corrida con los 4 launches rotos salió **exit 0 diciendo «OK»**, dejando en su lugar las capturas de la corrida anterior (mtime del día previo). Un veredicto emitido sobre esas imágenes es indistinguible de uno real.
2. **Capturaba la pantalla equivocada del prototipo, de forma intermitente.** El prototipo monta cada vista con `setTimeout(…, 60)` + transición CSS; el `waitForTimeout(400)` competía con ella. **Medido sobre `?ver=cuenta` a 390: 3 corridas → 2 capturaron «Mi día» en vez de «Mi cuenta»**, sin ninguna señal. Con el arreglo (espera del selector real de la vista): **3 de 3 correctas, mismo hash**.
3. **La espera de Agenda conocía 3 de los 4 estados finales.** Ante `agenda-calendario-caida` decía «puede estar en loading» — diagnóstico equivocado: la pantalla ya había cargado.

Verificado con control positivo y negativo: con `CHROME_PATH` inválido → **exit 1**, 8 problemas listados, 0 PNG (el mismo escenario que antes salía «OK»); en el caso bueno → exit 0. Y en la corrida real del Bloque A el guard **frenó de verdad**: exit 1 nombrando las 2 capturas de `detalle` que faltaban.

Consecuencia para quien lea filas anteriores del criterio 3: **el defecto 2 hace posible, e indetectable, que una fila se haya juzgado contra la pantalla equivocada.** No se afirma que haya pasado — no hay forma de saberlo a posteriori, porque el script no dejaba rastro. Es una explicación mecánica plausible de las «5 diferencias no declaradas en 8 pantallas» que midió A4 §C.

## 4. Hallazgo transversal: dónde vive la voz

El prototipo pone un **composer al pie** en cada pantalla de lista, con el texto de la acción y el micrófono: «Anotá un cobro, o hablá…» en `ingresos`, «Armá un presupuesto, o hablá…» en `presu`. La app **no tiene composer** en esas pantallas: pone un **ícono de micrófono suelto** junto al label de sección («ÚLTIMOS», «ACTIVOS»).

No es un caveat de captura —se ve completo en `fullPage`, sin corte— ni un caso aislado: es **sistemático** en los dos ids de lista del bloque. FE2 lo registró como límite del método («el composer tampoco se ve en la captura»); medido de nuevo, es una **decisión de patrón** no declarada. Fila para triage de planificación/Martín, no bug de frontend.

## 5. Lo que este bloque deja abierto

| # | Qué | Dueño | Disparador |
|---|---|---|---|
| 1 | **`detalle` sin medir.** Requiere que Mi día de `e2e-device` tenga al menos una tarjeta. | planificación (asigna) | reponer datos del día en el tenant |
| 2 | **`agenda` sin cuerpo comparable.** Requiere reconectar Google Calendar en `e2e-device`. | operador (consentimiento OAuth humano, A3 / H-A3-9) | — |
| 3 | **El affordance de voz** (§4): composer del proto vs ícono suelto de la app. | planificación / Martín | triage |
| 4 | **47 ids sin navegación escrita** en el generador (cubre 7 de 54). | frente de sprint | decisión del operador sobre el alcance del criterio 3 |

## 6. Denominador, dicho en voz alta

Este bloque cubre **7 de los 54 ids** del universo del criterio 3 (`backlog:828`), y **mide 6**. Las 29 filas publicadas antes cubren 29 de 54: **quedan 25 ids que nunca se midieron**. Un «criterio 3 ✅» sin el denominador al lado es el DoD que envejece en silencio — que es exactamente el defecto que este bloque destapó.
