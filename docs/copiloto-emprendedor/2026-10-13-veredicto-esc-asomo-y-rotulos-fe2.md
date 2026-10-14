# Veredicto de la fila `esc` — `ASOMO` y rótulos del asidero (frontend2)

**Contrato:** `2026-10-13_contrato_planificacion-a-frontend2_la-fila-esc-es-TUYA-…-ASOMO-que-no-existe`
**Medido sobre:** `origin/main` + dev-client `app.copiloto.emprendedor` en `RF8T318RN9T` (720×1600, densidad 300 → 1 dp = 1,875 px), usuario canónico, gestos con `adb input motionevent` DOWN/MOVE/UP, animaciones del sistema en 0 para `uiautomator dump`. Prototipo renderizado por http local a 390 px de ancho.
**No mueve el padrón** (DEC-18): este documento aporta evidencia y una enmienda con cita; quién cambia la fila es planificación.

## 1. Resultado

| punto del DoD | veredicto | evidencia |
|---|---|---|
| Canal de cierre externo (`senalCerrar`, #1084) | ✅ **CERRADO** — la opción A funciona en device | §2 |
| `ASOMO = 62` | **ENMIENDA E9** (no se implementa) — con motivo medido | §3 |
| Rótulos del asidero | **VIGENTE y COHERENTE** — el referente existe; la sospecha de «mal fundada» no se sostiene | §4 |

## 2. Opción A en device — el chat que baja cierra el escritorio

Secuencia con `motionevent` (nada de `input tap`):

| paso | gesto | árbol medido |
|---|---|---|
| 0. reposo | — | capa `[0,0][720,83]`, pestaña `[0,1][720,83]` «Ver funciones», rótulo «Bajá para tus funciones» |
| 1. abrir escritorio | DOWN en la pestaña (y=72) → MOVE → UP en y=1100 | capa `[0,0][720,1450]`, pestaña `[0,1368][720,1450]` «Cerrar funciones», rótulo «Subí para volver a Mi día»; debajo, la tira del chat «Escribile a Odobi» |
| 2. subir el chat | DOWN en la tira (y=1540) → UP en y=250 | `panel-handle [0,47][720,152]` «Bajá para volver a Mi día»; la pestaña sigue «Cerrar funciones» (estado abierto, debajo) |
| 3. **bajar el chat** | DOWN en el handle (y=100) → UP en y=1100 | capa `[0,0][720,83]`, pestaña «Ver funciones» `[0,1][720,83]` — **el escritorio quedó cerrado**, reposo = Mi día |

Capturas (scratchpad, no versionadas): `esc-0-cerrado`, `esc-1-abierto`, `esc-2-chat-arriba`, `esc-3-tras-bajar-chat`.
Cableado: `PanelFunciones.tsx:68` (`senalCerrar`), `PantallaPrincipal.tsx:147,176`.

## 3. `ASOMO = 62` — por qué no, medido

### 3.1 Qué dice el prototipo (y qué dijo mal el contrato)

`prototipo/index.html:2690`: `const ASOMO = 62; /* cuánto de Mi día queda a la vista con el escritorio **abierto** */`.
El contrato decía «con el escritorio *cerrado*»: es al revés. Medido renderizando el prototipo: tras `abrirEscritorio()`, `#midia` queda en `translateY(501px)` con viewport 562 → **61–62 px de Mi día visibles abajo**, con el rótulo «Subí para volver a Mi día». El chat (`#peek-chat`, vive *dentro* de `#midia`) cae a `top=962` en un viewport de 562: **fuera de alcance** — el defecto del prototipo que ya consta en el mapeo.

### 3.2 La capa del nativo está invertida

En el prototipo Mi día es la capa que **baja** (`yMidia = H() − ASOMO`) y el escritorio es el fondo. En nativo Mi día es la base (`PanelFunciones.tsx:10-12`) y el escritorio **cae encima** desde arriba. Con el escritorio abierto la franja inferior del nativo es la **pestaña** (`ALTO_PESTANA = 44 dp`, `:43`) con el mismo rótulo «Subí para volver a Mi día» (`:186`), tocable y arrastrable, y debajo la tira del chat — que el prototipo no puede mostrar y el nativo sí (DEVICE15 H1, #1084). El rol que cumple `ASOMO` en el prototipo —que el borde diga «acá abajo sigue Mi día»— **lo cumple la pestaña**, en los dos estados.

### 3.3 Spike: qué pasa si se trae el asomo de 62 dp (desechable, revertido)

Cambio de una línea: `bottom: bajoTira` → `bottom: bajoTira + 62` en `PanelFunciones.tsx:161`. Medido con el escritorio abierto:

- capa `[0,0][720,1334]`, pestaña `[0,1251][720,1334]`; entre la pestaña y la tira del chat **asoma un corte de Mi día**: la fila de chips «Todo · Cobros · ARCA · Presupuestos» y el borde recortado de las tarjetas (`esc-4-spike-asomo62`).
- 🔴 **Esos chips quedan alcanzables con el escritorio abierto**: `uiautomator` lista `midia-chip-todo [30,1370][140,1433]` y `midia-chip-cobros [155,1370][291,1433]`, y un toque en «Cobros» a (235,1402) los ejerció. Una capa que se supone «detrás» se vuelve operable (y alcanzable por lector de pantalla) mientras el escritorio manda.
- El corte que asoma no es el borde de Mi día con su asidero (como en el prototipo) sino una rebanada **arbitraria** del *pie* de Mi día; cambia con el contenido y con el tamaño de pantalla.
- Resta 62 dp (116 px) al escritorio, que ya muestra sólo 4 filas de «Actividad reciente».

Hacerlo bien exigiría además tapar esa rebanada (sin toques, `importantForAccessibility="no-hide-descendants"`, sin contenido) — o sea inventar una superficie que el prototipo no tiene para reproducir lo que la pestaña ya hace.

### 3.4 Enmienda

| id | fila | enmienda | cita |
|---|---|---|---|
| **E9** | `esc` | sin `ASOMO = 62` de Mi día: con el escritorio abierto la franja es la **pestaña** de 44 dp (mismo rótulo, tocable) + la tira del chat; asomar la base la dejaría operable detrás del escritorio | `PanelFunciones.tsx:10-12,43,161,186` · prototipo `index.html:2690-2691` · spike §3.3 |

Resultado válido según el DoD («enmendado con motivo escrito si en device rompe otra cosa»). Lo que **sí** diverge y no se declara coherente: 44 dp vs 62 y la superficie (borde del escritorio vs borde de Mi día).

## 4. Rótulos del asidero — re-medidos

| texto / elemento | prototipo | nativo | veredicto |
|---|---|---|---|
| «Bajá para tus funciones» (reposo) | `index.html:1639` (`#grip-arriba .txt`) | `PanelFunciones.tsx:186` | **vigente** · idéntico (medido en device §2 paso 0) |
| «Subí para volver a Mi día» (abierto) | `index.html:2669-2670` (`txt.textContent = asomando ? … : …`) | `PanelFunciones.tsx:186` | **vigente** · idéntico (medido §2 paso 1) |
| «Bajá para volver a Mi día» (grip del chat) | `index.html:1873` (`#grip-chat`) | `panel-hint`, `PanelDeslizable` | **vigente** · idéntico (medido §2 paso 2) |
| `accessibilityLabel` «Ver funciones» / «Cerrar funciones» | **sin referente** (no hay `aria-label` en `.grip`) | `PanelFunciones.tsx:181` | **ni rancia ni mal fundada**: no es copy visible, es la alternativa de un solo puntero (WCAG 2.5.1, `PanelFunciones.tsx:14-18`); queda como está |

**Sobre «en el prototipo no hay elemento `asidero`»:** es literal pero engañoso. El asidero es `.grip` (`index.html:75-78`) y el propio `odobi-ui/CLAUDE.md:204-208` lo nombra: *«El rótulo del asidero cambia según estado ("Bajá para tus funciones" ↔ "Subí para volver a Mi día")»*. El referente existe, con path:línea; la falta «rótulos de asidero» de la fila **no es mal fundada** y **no hay literal que cambiar**. Ningún rótulo nuevo.

## 5. Qué NO acredita este documento

- No es «`esc` COHERENTE sin reservas»: queda **E9** (44 vs 62 dp / otra superficie).
- No re-mide el resto de la fila 8 del mapeo (`EscritorioFunciones.tsx`).
- El spike §3.3 se revirtió; **no hay cambio de código** en este PR.
- No medí un lector de pantalla real: la alcanzabilidad de los chips sale del árbol de `uiautomator` y de un toque.
