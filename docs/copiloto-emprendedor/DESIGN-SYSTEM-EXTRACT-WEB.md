# Design System Extract — Copiloto Web/Desktop

> Fuente primaria: **`Copiloto Web correcciones.html`** (shell rail+chat, 4 skins — **el diseño final vigente**, reemplaza a `Copiloto Web.dc.html`) · `Copiloto Web.dc.html` (versión previa/pre-correcciones, se conserva como baseline del diff — ver §Changelog) · `Copiloto Web - Boceto.dc.html` (wireframe de 2 direcciones, intención) · `Copiloto - Cabina.dc.html` (dirección desktop previa, ámbar/2-temas, **NO es el diseño final pero su rail/aside sobreviven parcialmente**) · `screenshots/*.png` (grounding visual — ver §7, casi todos son duplicados del mobile, **no** del shell final) · comparado contra `docs/copiloto-emprendedor/APP Copiloto Movil/DESIGN-SYSTEM-EXTRACT.md` (mobile, ya implementado en `apps/copiloto-web/src/`) y contra el brief escrito `docs/copiloto-emprendedor/2026-07-03-cliente-web-mobile-design-handoff.md` + su addendum `2026-07-03-cliente-feature-modos-por-app.md`.
>
> Todo lo que sigue está **verificado leyendo el markup real**. `Copiloto Web correcciones.html` es un export "Bundled Page" (self-contained, fonts embebidas) donde el markup `x-dc` real vive escapado dentro de `<script type="__bundler/template">`; se extrajo con `json.loads()` de esa línea (87.160 caracteres decodificados, 1077 líneas) y se comparó **estructuralmente** (parseo DOM + prettify, no diff de texto crudo — evita falsos positivos por reserialización de atributos/self-closing tags) contra `Copiloto Web.dc.html` (630 líneas) y contra el código React ya implementado del mobile (`apps/copiloto-web/src/design-system/`, `src/shell/AppShell.tsx`). Donde el mock final contradice el brief escrito o el mock previo (`Cabina`), se marca explícitamente (§7) — hay **3 contradicciones de producto no triviales**, no solo detalles visuales. Los cambios de `correcciones.html` respecto al `.dc.html` anterior están en **§Changelog vs mock anterior** al final del documento — son pocos y quirúrgicos (deep-diff confirmó que temas/colores/tipografía/layout/JS de estado son **byte-idénticos**).

---

## 0. Los documentos de origen (misma trampa que el mobile) — ahora con 2 versiones del shell final

| Doc | Qué es | Fuentes | Temas | Layout |
|---|---|---|---|---|
| `Copiloto Web - Boceto.dc.html` | Wireframe (grises, Caveat cursiva de anotación) explorando **2 direcciones**: `1a` rail lateral + chat, `1b` columna centrada + nav flotante | n/a (wireframe) | n/a | Ventanas mock 860px (1a) / 660px (1b) |
| `Copiloto - Cabina.dc.html` | Exploración desktop **previa y standalone**, ámbar/editorial, con aside "panel de instrumentos" | Bricolage Grotesque + Hanken Grotesk + JetBrains Mono | 2 (`dark`/`light` vía `data-theme`) | 3 columnas: rail 228px fijo + chat + aside 300px toggleable. Preview 1440×900 |
| `Copiloto Web.dc.html` (superseded) | Versión **previa** del shell de escritorio final: reconcilia la estructura rail+chat de `1a`/`Cabina` con el **sistema de 4 skins del mobile**. Reemplazada por `correcciones.html` — se conserva solo como baseline del diff | Space Grotesk + Manrope + JetBrains Mono (Google Fonts) | 4 (`aurora`/`daylight`/`refined`/`ai`) | Rail auto-hide (72px↔244px) + chat/conexiones/cuenta a pantalla completa. Sin aside. Preview 1440×900. Chat con sub-header de 52px ("SESIÓN ACTIVA" + "Nueva conversación") |
| **`Copiloto Web correcciones.html`** ← **FUENTE DE VERDAD VIGENTE** | Versión de **correcciones** del mismo shell: idéntica en tipografía/temas/layout/lógica de estado al `.dc.html` previo, salvo la eliminación del sub-header de sesión en Chat y ajustes menores de robustez CSS (detalle exacto en §Changelog) | **Space Grotesk + Manrope + JetBrains Mono** (self-hosted vía `@font-face`/woff2 en el bundle, mismas familias) | **4** (`aurora`/`daylight`/`refined`/`ai` — mismos nombres y mismos valores de tokens que el mobile, byte-idénticos al `.dc.html` previo) | Rail auto-hide (72px↔244px) + chat/conexiones/cuenta a pantalla completa. **Sin aside. Sin sub-header en Chat** (removido, ver Changelog). Preview 1440×900 |
| `2026-07-03-cliente-web-mobile-design-handoff.md` + addendum "modos por app" | **Brief escrito** que se supone generó este mock (decisiones "cerradas — no re-abrir") | — | dark/light "de primera clase" (no 4 skins) | rail(desktop)/tabbar(mobile), + "barra de modos" persistente sobre el composer |

**Implicancia para el rebuild:** `Copiloto Web correcciones.html` es el que hay que implementar — es la versión más reciente y la fuente de verdad vigente. Pero **el mock final no es 100% fiel al brief que lo encargó** (§7 #1-#3): mic activo cuando el brief pide "mic deshabilitado", modal de Apps cuando el brief pide "barra de modos" persistente, "Skin"-switcher de 4 temas dentro del rail cuando el brief habla de "toggle dark/light/auto" en Cuenta. Esto no es ambigüedad de interpretación mía — es una contradicción verificable línea por línea, documentada en §7. Estas 3 contradicciones **no se resolvieron** en la versión de correcciones (siguen presentes tal cual, verificado).

`Cabina` NO se descarta del todo: su aside "panel de instrumentos", su header con brand+toggle-de-tema, y su composer con quick-action pills (💵/📅/✉️) **no sobrevivieron** al mock final (ni el `.dc.html` previo ni `correcciones.html` tienen ninguno de los tres) — pero son la evidencia más cercana de cómo lucía la idea antes de simplificarse. Ver §5 y §7 para el detalle de qué se cayó y qué implica.

---

## 1. Tipografía

### 1.1 Familias — CONFIRMADO: Space Grotesk + Manrope, no Clash Display + General Sans

```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

| Rol | Familia | Fuente | Pesos cargados | Uso |
|---|---|---|---|---|
| Display (H1, nombre en HITL, montos, marca) | **Space Grotesk** | Google Fonts | 500, 600, 700 | `font-family:'Space Grotesk',sans-serif` en H1, nombre HITL, monto, título de modal, título de card en grid |
| Body / UI (chat, botones, inputs, labels) | **Manrope** | Google Fonts | 400, 500, 600, 700 | Fondo `body{font-family:'Manrope',sans-serif}`; heredado por defecto en casi todo lo que no es display ni mono |
| Mono / data (labels, badges, timestamps, status) | **JetBrains Mono** | Google Fonts | 400, 500, 700 | Idéntico rol y familia al mobile — el único punto en común 1:1 |

**Esto invierte el hallazgo del mobile.** El doc del mobile advertía "el brief asumía Space Grotesk + Manrope; verificado = Clash Display + General Sans (Fontshare)". Ese supuesto **no estaba mal en general — estaba aplicado al archivo equivocado**: Space Grotesk + Manrope es correcto para **WEB**, no para mobile. Los dos sistemas de fuentes son reales y **coexisten** — no es que uno esté mal, es que hay dos design systems tipográficos distintos, uno por plataforma.

También difiere de `Cabina` (Bricolage Grotesque + Hanken Grotesk) — es decir, **hay 3 combinaciones tipográficas distintas** entre los 3 documentos de escritorio/mobile: Clash+General (mobile), Bricolage+Hanken (Cabina, descartada), Space Grotesk+Manrope (Web final). Ninguna reutiliza la otra salvo JetBrains Mono, constante en los tres.

### 1.2 Escala tipográfica observada (verbatim del markup)

| Uso | Tamaño | Familia | Peso | Notas |
|---|---|---|---|---|
| H1 de pantalla ("Conexiones", "Cuenta") | 30px | Space Grotesk | 600 | `letter-spacing:-.01em`. Mobile equivalente = 27px Clash Display |
| Nombre en tarjeta HITL ("Juan Pérez", "María González") | 22px | Space Grotesk | 600 | Igual tamaño que mobile, distinta familia |
| Título de modal "Tus apps" | 20px | Space Grotesk | 600 | Mobile: mismo tamaño, "Tus apps" en sheet, no modal |
| Título de tile en grid Conexiones | 16px | Space Grotesk | 600 | Mobile: mismo tamaño |
| Monto HITL | **44px fijo** (no varía por tema) | Space Grotesk | 700 | Mobile parametriza 44-52px vía `--amount-size` por tema; Web lo **hardcodea** a 44px en todos los temas (ver §2.3) |
| Signo `$` del monto | 20px | JetBrains Mono | 400 | Igual patrón que mobile |
| Monto en card ejecutada (Cobro Ejecutado) | 44px | Space Grotesk | 700 | Mismo token de tamaño, contexto post-confirmación (nuevo vs. mobile, ver §5.6) |
| Botón primario | 15px | Manrope | 600 | Mobile: 15.5px General Sans |
| Mensaje de chat (bubble) | 14.5px | Manrope | 400 | line-height 1.45–1.5, igual que mobile |
| Botón cancelar / fila de settings | 14px / 14.5px | Manrope | 500 | — |
| Subtítulo de fila (Cuenta, tiles, nombre de rail) | 11.5–14.5px | Manrope | 400–600 | Ítem de rail = 14.5px/500(600 activo); mobile tab label = 10.5px |
| Nombre + email de usuario (rail / Cuenta) | 13.5px / 11.5px | Manrope | 600 / 400 | — |
| Labels de campo HITL ("PARA", "MONTO", "CON", "CUÁNDO", "DÓNDE") | 11px | JetBrains Mono | 400 | `letter-spacing:.1em`, idéntico a mobile |
| Header de card HITL ("COBRO · MERCADO PAGO") | 11px | JetBrains Mono | 400 | `letter-spacing:.16em`. Mobile no concatena el servicio en el mismo label (separa ícono+"COBRO") |
| Badge ("REVISAR", "RECONECTAR", "IRREVERSIBLE", "EJECUTADO", "PENDIENTE", "AGENDADO", "CANCELADO") | 10px | JetBrains Mono | 400 | Mobile: 9-10px, menos variantes de estado (ver §5.6) |
| Label "Skin" (rail) | 9.5px | JetBrains Mono | 400 | `letter-spacing:.14em`, uppercase — nuevo componente del rail, no existe en mobile |
| Contador de rail ("3/6") | 11px | JetBrains Mono | 400 | Análogo al "3/8" de Cabina, "3 activas · 3 disponibles" de mobile — **tercer número distinto para "cuántas integraciones hay"**, ver §7 |

### 1.3 Comparación de escala con mobile

La escala de tamaños es **casi idéntica en px** entre mobile y Web para los mismos roles semánticos (22px nombre, 11px label mono, 14.5px bubble, etc.) — lo que cambia es la **familia**, no la escala. Esto es una señal fuerte de que ambos mocks comparten un mismo "spec" de tamaños con dos pieles tipográficas distintas encima. Para el rebuild, esto sugiere: **la escala (tamaño/tracking/line-height) puede vivir en un token compartido `--text-*` agnóstico de familia**, y solo `--font-display` / `--font-body` cambian de valor entre shells (ver §6).

---

## 2. Color / temas

### 2.1 Mismos 4 nombres de skin que el mobile — pero con un token-set REDUCIDO y ligeramente distinto

Web usa **exactamente los mismos 4 nombres** (`aurora`, `daylight`, `refined`, `ai`) y persiste en `localStorage` igual que mobile (`componentDidMount` + `setState`). Esto confirma que **es el mismo sistema de temas**, no uno nuevo — pero el archivo del mock (una instancia de diseño aparte, no el código real) define su **propio objeto `themes`** con:

- **Menos tokens** que el mobile: no tiene `--mono`, `--status-fg`, `--core-size`, `--presence-wrap-bg`, `--presence-wrap-shadow`, `--chip-fg`, `--chip-bg`, `--amount-size`, `--nav-bg`, `--nav-border`, `--tab-border`. Estos tokens **no se usan en el markup de Web** (grep negativo) porque Web no tiene orb en el header, ni card de "presencia" fuera de Cuenta, ni chips con fondo propio (los chips de desambiguación en Web reusan `--user-*`/`--chip-border`, sin `--chip-fg/bg`), ni tema variable en el tamaño del monto.
- **1 token nuevo que el mobile no tiene:** `--nav-active` — el fondo del ítem de rail activo, un color por tema (necesario porque el rail es nuevo, exclusivo de escritorio).
- **Valores idénticos o casi idénticos** en los tokens que sí comparten nombre (mismo `--bg`, `--text`, `--card-bg`, `--btn-bg`, etc. — visualmente el mismo lenguaje). Única diferencia de valor detectada: `daylight.--danger-border` es `none` en mobile pero `1px solid rgba(199,69,90,.3)` en Web (necesario para que el borde-tintado-de-alerta de la card de Conexiones/HITL sea visible en el tema neumórfico claro, donde mobile no lo necesitaba en ese contexto).

**Recomendación de implementación (no ambigua):** el token-set del mobile (`themes.css`, ya implementado, 100+ variables) es el **superset correcto** — no hay que recrear un token-set reducido para Web. Extender ese mismo archivo con `--nav-active` (4 valores, uno por tema, dados abajo) y usar los tokens ya existentes (`--mono`, `--amount-size`, etc.) donde Web los necesite aunque el mock de diseño no los haya declarado (el mock es una instancia de Design aparte del código real, con su propio subset — no es una señal de que esos tokens deban eliminarse).

### 2.2 Token nuevo de escritorio — `--nav-active`

```css
/* fondo del ítem de rail activo, por tema — NO existe en el mobile, agregar a themes.css */
[data-theme="aurora"]   { --nav-active: rgba(255,255,255,.09); }
[data-theme="daylight"] { --nav-active: rgba(91,74,224,.12); }
[data-theme="refined"]  { --nav-active: rgba(94,224,255,.1); }
[data-theme="ai"]       { --nav-active: rgba(96,156,255,.18); }
```

El resto del estilo de "activo" en el rail reusa tokens existentes: `border-left: 3px solid var(--amount-sign)` + `color: var(--tab-active)`.

### 2.3 Nota de implementación — el monto NO está parametrizado por tema en Web

Mobile parametriza `--amount-size` (44/44/50/46px según tema). Web **hardcodea `font-size:44px`** en el markup de la card HITL, sin usar ninguna variable — es una regresión de fidelidad respecto al mobile, probablemente porque el mock de Web no llegó a portar ese detalle. **Decisión para el rebuild:** mantener `--amount-size` parametrizado (reusar el token del mobile) en vez de hardcodear 44px — no hay razón de producto para que el monto sea más chico en `refined`/`ai` en desktop si lo es en mobile; es un artefacto de la instancia de mock, no una decisión de diseño.

### 2.4 Selector de skin — vive DENTRO del rail (real UI de producto, no chrome de documentación)

A diferencia del mobile, donde el selector de los 4 temas vivía **fuera del frame de la app** (chrome del canvas de Claude Design, no una pantalla real — ver mobile §1.2/§5#3), en Web el selector de skin es un **componente real dentro del rail**, siempre presente (dentro del área que se revela al expandir el rail on-hover):

```html
<!-- 4 swatches, 34×34px, radio 10px -->
<button title="Aurora Glass"   style="background:linear-gradient(150deg,#C6A5FF,#7C5CFF)">
<button title="Soft Daylight"  style="background:linear-gradient(150deg,#E7E7F1,#8B82FF)">
<button title="Refined Dark"   style="background:linear-gradient(150deg,#1B2440,#5EE0FF)">
<button title="Tema AI"        style="background:linear-gradient(150deg,#4A93FF,#2A5FE0)">
```

Activo = `border: 3px solid var(--core)`; inactivo = `border: 2px solid rgba(128,128,128,.25)`. **Esto resuelve la ambigüedad de producto que el mobile dejaba abierta** ("¿el usuario final elige entre los 4 skins, o son exploraciones de las que hay que elegir una?") — en Web, el mock responde que sí, el usuario elige libremente entre los 4, en vivo, dentro de la app. Vale la pena propagar esta resolución de vuelta al diseño de Cuenta en mobile (hoy Cuenta-mobile no tiene selector de tema, solo Idioma/Notificaciones — ver mobile doc §3.4), y **coordinar la key de `localStorage`**: el mock de Web usa `copiloto-web-theme` y el mock de mobile (código real) usa `copiloto-theme` — son dos keys distintas por ser dos instancias de mock separadas, pero el producto real debe compartir **una sola key** entre shells (mismo usuario, mismo tema en mobile y desktop) — ver §6.

### 2.5 Colores de marca — sin cambios respecto al mobile

Mercado Pago, Gmail, Google Calendar, HubSpot, Drive, Instagram usan los mismos SVG/colores hardcodeados de marca en Web que en mobile (verificado línea por línea en las cards de Conexiones y HITL) — correctamente no theme-aware, reusar tal cual.

---

## 3. Layout de escritorio

### 3.1 Estructura raíz — flex de 2 zonas, sin CSS grid

```css
/* raíz */
display:flex; height:100vh; width:100%; overflow:hidden;

/* zona 1: spacer fijo que reserva el ancho del rail colapsado */
div.rail-spacer { width:72px; flex:none; }

/* zona 2 (superpuesta sobre el spacer): el rail real, position:absolute */
nav.rail {
  position:absolute; left:0; top:0; bottom:0; z-index:30;
  width: 72px | 244px;  /* {{ railOpen ? '244px' : '72px' }} */
  overflow:hidden; white-space:nowrap;
  transition: width .3s cubic-bezier(.4,0,.2,1);
}

/* zona 3: main, ocupa el resto */
main { flex:1; min-width:0; display:flex; flex-direction:column; }
```

**No hay `grid-template-columns`.** Es un rail **auto-hide que se expande al pasar el mouse** (`onPointerEnter`/`onPointerLeave` → `railOpen` state), NO un rail fijo de ancho constante como en `Cabina` (228px fijo, sin hover). El contenido de texto del rail (labels, nombre de usuario, skin switcher) usa `opacity` con transición retardada (`opacity:1;transition:opacity .2s ease .08s` al abrir vs. `opacity:0;transition:opacity .12s ease` inmediato al cerrar) para que los íconos queden legibles incluso colapsado (72px alcanza para ícono + badge-dot, no para label).

Esto es una decisión de interacción **no trivial para portar a React/CSS**: es estado (`railOpen`) + transición de ancho + fade de contenido con timing distinto entre entrada/salida — no un simple `:hover` de CSS puro (aunque podría implementarse con `:hover` + `transition-delay` si no se necesita persistencia del estado en JS).

### 3.2 Anchos y máximos por pantalla

| Pantalla | Ancho de contenido | Padding | Grid |
|---|---|---|---|
| Rail | 72px (colapsado) / 244px (expandido) | `22px 16px 18px` | — |
| Chat — mensajes | `max-width:640px` centrado | `32px 28px 12px` (top 32px, subió de 28px al eliminarse el sub-header — ver Changelog) | flex column, gap 16px |
| Chat — composer | `max-width:640px` centrado | `14px 28px 20px` | — |
| Conexiones | `max-width:900px` centrado | `36px 40px` | `grid-template-columns: repeat(3,1fr)`, gap 16px |
| Cuenta | `max-width:640px` centrado | `36px 40px` | flex column |
| Modal "Apps" | `440px` fijo (`max-width:calc(100% - 48px)`) | `22px 24px 14px` header, `2px 14px 16px` lista | — |

**No hay breakpoints intermedios declarados en ningún archivo fuente** (ni Web, ni Cabina, ni el boceto) — los 3 mocks de escritorio están fijados a un preview de 1440×900 sin medios de por medio. El mobile está fijado a 384×812. **No existe ningún mock ni especificación de la zona intermedia (tablet, ~768-1200px)** — es un vacío real del diseño, no una omisión de esta extracción (ver §7 #7).

### 3.3 Composer: posición y diferencia mobile↔desktop

- **Mobile:** composer fijo abajo del viewport, dentro del marco de teléfono, tab-bar flotante encima que sube/baja en espejo al composer.
- **Desktop (Web):** composer al pie de la columna de chat (`flex:none`, no floating/absolute), sin tab-bar (el rail es lateral, no inferior) — no hay lógica de "ocultar al scrollear" en el markup de Web (sí existe en mobile, ver mobile §2.3). El composer en Web **incluye mic** (igual que mobile) — contradice el brief escrito (§7 #1). La versión de correcciones **eliminó** el micro-copy de ayuda bajo el composer ("Enter para enviar · mantené 🎙 para hablar") que sí estaba en el `.dc.html` previo — ver Changelog.

### 3.4 Comparación con `Cabina` (la dirección que NO ganó del todo)

| Aspecto | Cabina (previo) | Web (final) |
|---|---|---|
| Header propio (60px, brand+toggle-tema+user pill) | Sí | **No existe** — el rail absorbe user+skin-switcher, no hay barra superior separada |
| Rail | 228px fijo, sin hover | 72px↔244px, auto-hide por hover |
| Aside "panel de instrumentos" (presencia+conexiones+última acción) | Sí, 300px, toggleable | **No existe** |
| Quick-action pills sobre composer (💵/📅/✉️) | Sí | **No existen** |
| Ítems de rail | Chat · Conexiones · [Próximamente: Caja, Agenda] · Cuenta | Chat · **Apps** · Conexiones · Cuenta (sin Caja/Agenda) |
| Temas | 2 (dark/light) | 4 (aurora/daylight/refined/ai) |

Web es una simplificación de Cabina que **recupera "Apps" del mobile** (ausente en Cabina) a cambio de **perder el aside, el header propio y las quick-pills**. Ningún documento explica esta decisión — es una divergencia real a validar con quien diseñó (ver §7 #3).

---

## 4. Pantallas / vistas

### 4.1 Chat (rail + columna central)
Mensajes (mismo guion que mobile: cobro Juan Pérez $15.000 → desambiguación "dos Juan" → HITL Cobro → "Juan te pagó $15.000" pill → HITL Agenda María González → HITL Publicar/Instagram irreversible) → composer con mic, **sin sub-header propio** (el `.dc.html` previo tenía un sub-header de 52px con dot verde + "SESIÓN ACTIVA · sess_9f2a" + botón "Nueva conversación"; la versión de correcciones lo **elimina por completo**, ver Changelog). La secuencia narrativa de mensajes es **idéntica** a la del mobile, solo cambia el chrome alrededor.

### 4.2 Apps (MODAL centrado, no bottom-sheet)
Título "Tus apps" + subtítulo "Elegí un modo para enfocar al copiloto" (idéntico copy al mobile) + botón cerrar (X) + lista de 4 filas seleccionables (MP/Calendar/Gmail/HubSpot, con badge RECONECTAR en Gmail) + divisor + fila "Salir del modo" si hay modo activo. Estructuralmente es la sheet del mobile pero **centrada como modal** (`border-radius:24px` los 4 lados, `transform:scale()`, no `translateY()`) — apropiado para desktop donde no hay "abajo" natural de un dedo.

### 4.3 Conexiones (grid 3 columnas)
H1 "Conexiones" + "3 activas · 3 disponibles" + grid `repeat(3,1fr)` de 6 cards (Cobrar/MP, Agenda/Calendar, Mail/Gmail-reconectar, Clientes/HubSpot, Archivos/Drive-sin conectar, Publicar/Instagram-sin conectar) — mismo inventario de 6 servicios que mobile, layout de grid en vez de lista de tab.

### 4.4 Cuenta
H1 "Cuenta" + avatar 62px + nombre/email + grupo (Plan/Idioma/Notificaciones-toggle) + grupo (Privacidad/Cerrar sesión) + card de durabilidad (orb+texto) — mismo inventario que mobile, sin selector de tema acá (vive en el rail, ver §2.4). El avatar de 62px también suma `flex-shrink:0` en la versión de correcciones (mismo fix menor que el del rail, ver Changelog).

### 4.5 Overlay de grabación (voz)
Idéntico al mobile pieza por pieza: waveform SVG, dot rojo, label `mm:ss`, sub-estados unlocked/locked con mismo umbral de 46px y misma ambigüedad de "soltar sin lock" (ver mobile §5 #1 y #8 — el mismo gap persiste acá, sin resolver).

### 4.6 Ausencias verificadas
Sin pantalla de login/onboarding en ningún `.dc.html` de escritorio (igual que mobile). Sin pantalla de "Caja"/"Agenda próximamente" en Web (a diferencia de Cabina, que sí las tenía como tiles deshabilitados en el rail).

---

## 5. Componentes

### 5.1 Rail (nuevo, exclusivo de escritorio)
Ver §3.1. 4 ítems (Chat/Apps/Conexiones/Cuenta) + separador implícito + bloque "Skin" (4 swatches) + bloque usuario (avatar+nombre+email). Ítem "Apps" muestra un badge-dot (`hasMode`) igual que el tab-bar mobile, y un badge mono con `modeShort` cuando el rail está expandido — mobile solo tiene el dot, no el label corto, porque no hay espacio en un tab fijo de 4 iconos. El avatar de 34px del bloque usuario suma `flex-shrink:0` explícito en la versión de correcciones (fix menor de robustez, ver Changelog).

### 5.2 Header — AUSENTE como componente propio
Ni brand, ni orb de presencia, ni avatar viven en una barra superior — todo lo que en Cabina vivía en el `<header>` (marca+orb+toggle+user) se repartió entre el rail (user, sin orb) y no tiene equivalente para marca/orb en absoluto. **El elemento "firma" del brief (indicador de presencia que respira, siempre junto a la marca) no está presente en ningún punto de la chrome persistente de Web** — solo aparece profundo en Cuenta (card de durabilidad). Mismo gap que el mobile (§7 mobile #5) pero más severo: mobile al menos lo tenía en `Direcciones.dc.html` como precedente; Web no lo tiene en ningún estado de su chrome principal. La versión de correcciones profundiza esto: eliminó el único elemento con forma de barra horizontal que existía en Chat (el sub-header de sesión, ver §4.1/Changelog) — hoy Web no tiene **ninguna** barra horizontal persistente en ninguna pantalla, ni de marca ni de sesión.

### 5.3 Modal "Apps" (reemplaza el bottom-sheet mobile)
Centrado, `scale()`+fade, radio 24px los 4 lados, `max-height:82%`. Mismo contenido/rows que el bottom-sheet mobile (§2.11 del doc mobile) — el componente puede compartir subcomponentes internos (fila de servicio, checkmark) entre `BottomSheet` (mobile) y este modal (desktop) si se abstrae el "contenedor" (sheet vs. dialog) del "contenido" (lista de apps).

### 5.4 Burbuja de chat / chips de desambiguación
Mismo patrón que mobile (usuario derecha / asistente izquierda / chips de opción), radios **18px** en vez de los 20px del mobile (`18px 18px 6px 18px` usuario / `18px 18px 18px 6px` asistente) — diferencia menor de radio, no de estructura.

### 5.5 Tarjeta de conexión (grid Conexiones)
Ícono 40×40 (mobile 38×38) radio 11px + nombre 16px + subtítulo + indicador de estado (dot+CONECTADO / badge RECONECTAR con borde-de-card completo tintado / botón ghost Conectar con card `opacity:.82`) — mismo patrón de 3 estados que mobile, tamaños ligeramente mayores.

### 5.6 Tarjeta HITL — MÁS RICA que la del mobile (adopta el patrón de estados de Cabina)
Estructura base idéntica a mobile (icono+label servicio, badge, PARA/CON, nombre, monto/detalle, botones). **Diferencia real:** Web adopta el patrón de **máquina de estados post-acción** que tenía `Cabina` y que el mobile NO tiene:

| Card | Mobile | Web |
|---|---|---|
| Cobro | Solo estado "pending" (REVISAR + botones); el "pagado" es una burbuja de chat aparte, no un estado de la card | 2 estados de la card: `pending` (REVISAR+botones) → `done` (badge "EJECUTADO" verde + fila de link copiable `mpago.la/2xK9dQ` + botón Copiar/Copiado) |
| Agenda | Sin badge en absoluto ("riesgo bajo, calmo") | 3 estados con badge: `pending` (sin badge o "PENDIENTE" pulsante ámbar) → `confirmed` ("AGENDADO" verde) → `cancelled` ("CANCELADO" gris), cada uno con su propio cuerpo (botones / mensaje de confirmación / mensaje de cancelación) |
| Publicar/IG | Estático, un solo estado | Igual que mobile, sin estados post-acción visibles en el mock |

Esto es una mejora real de fidelidad de producto (la card ya no es solo ilustrativa, tiene ciclo de vida) que el mobile debería heredar de vuelta, no al revés — **el componente HITL canónico que pide el brief (§6, "props: título, pares label:valor, ..., nivel_de_riesgo") debe soportar esta máquina de estados desde el día 1**, con el mobile poniéndose a la par de Web, no el mock de Web bajando a la simplicidad del mobile actual.

### 5.7 Composer (con mic, contradice el brief — ver §7 #1)
Igual estructura que mobile: input+mic(40×40)+send(40×40). Chip de "modo activo" (badge-pill con label + botón X) se muestra **arriba del input, dentro del composer**, solo cuando `hasMode` — esto SÍ es el "chip de modo activo" que pide el brief, implementado. Lo que el brief pide y el mock **no** implementa es la **barra persistente de botones por servicio** (ver §7 #2) — el mock solo llega al chip de salida, no a la fila de entrada.

### 5.8 Primitivos reusables 1:1 del mobile (sin cambios de contrato, solo de skin tipográfico)
`Button`, `Badge`, `Chip`, `MonoLabel`, `Surface`, `Skeleton`, `Toast`, `PresenceOrb`, `StatusBar` (ya implementados en `apps/copiloto-web/src/design-system/`) — su lógica/props no cambian entre mobile y desktop; lo único que cambia es qué `--font-*` resuelve cada uno (ver §6). `BottomSheet` es el único primitivo que el desktop **no reusa directo** — necesita un `Modal`/`Dialog` hermano (mismo contrato de overlay+contenido, transform distinto).

---

## 6. Reconciliación — qué es compartido, qué es nuevo de escritorio

| Elemento | Compartido con mobile | Nuevo de desktop | Nota |
|---|---|---|---|
| `ThemeProvider` + 4 temas (`aurora/daylight/refined/ai`) | ✅ Reusar tal cual (`apps/copiloto-web/src/design-system/ThemeProvider.tsx` + `themes.css`) | Agregar `--nav-active` (4 valores, §2.2) | **Una sola key de `localStorage`** (`copiloto-theme`, la del mobile) — el mock de Web usa `copiloto-web-theme` porque es una instancia de Design separada, NO porque el producto deba tener 2 temas independientes por plataforma |
| Tokens de color (`--bg`, `--card-bg`, `--btn-bg`, etc.) | ✅ 100% reusar el token-set del mobile (superset correcto) | — | No recrear el subset reducido del mock de Web (§2.1) |
| `--font-mono` (JetBrains Mono) | ✅ Igual en ambos shells | — | Único font-token verdaderamente compartido |
| `--font-display` / `--font-body` | ❌ Valores DISTINTOS por shell | Clash Display+General Sans (mobile) vs. Space Grotesk+Manrope (desktop) | Ver decisión de arquitectura abajo |
| Escala de tamaño/tracking (22px nombre, 11px label, etc.) | ✅ Prácticamente idéntica en px entre ambos mocks (§1.3) | — | Candidato a token `--text-*` compartido, agnóstico de familia |
| `lib/api/`, auth, `context_factory`, módulos de negocio (`chat`, `connections`, `account`) | ✅ 100% — cero lógica nueva de escritorio | — | El shell de escritorio es una capa de presentación, no un cliente distinto |
| `AppShell` (`src/shell/AppShell.tsx`) | Placeholder hoy (Task 9 FASE 2, aún no construido ni para mobile) | Debe bifurcar internamente `<TabBar>` (mobile) vs. `<Rail>` (desktop) por breakpoint, **no** ser 2 componentes de árbol separados | Ver `docs/copiloto-emprendedor/2026-07-03-cliente-web-mobile-design-handoff.md` §4: el propio plan ya declara `shell/` como "header + rail(desktop)/tabbar(mobile)" — un solo shell, dos vistas |
| Tarjeta HITL canónica | Contrato compartido (título, pares label:valor, destinatario, monto, riesgo, preview?) | La máquina de estados post-acción (§5.6) debe vivir en el componente compartido, no duplicarse por plataforma | — |
| `BottomSheet` (mobile) | — | `Modal`/`Dialog` (desktop) | Mismo "contenido" (lista de apps, ver §5.3), contenedor distinto — extraer el contenido a un componente presentacional puro que ambos wrappers consuman |
| Rail (nuevo) | — | `Rail.tsx`: nav 4 ítems + skin-switcher + bloque usuario, con estado `railOpen` (hover) | Nuevo, sin equivalente mobile |
| `.app-frame` (`global.css`, `max-width:384px` centrado) | — | **NO debe aplicar al shell de escritorio** | Ver §7 #6 — el CSS actual asume "desktop-web = mobile centrado", que el mock de Web contradice (rail a pantalla completa, contenido hasta 900px) |

### Recomendación de montaje

1. **No crear un segundo `ThemeProvider`.** El de mobile ya cubre los 4 temas y persiste en `localStorage`; extenderlo con `--nav-active` y (si hace falta) tokens hoy ausentes del subset de Web pero presentes en mobile (`--amount-size`, etc. — ya existen, solo usarlos).
2. **Tipografía por breakpoint, no por CSS var global fija.** Definir `--font-display`/`--font-body` con un valor que cambie según un data-attribute de layout (ej. `[data-shell="desktop"]` en el contenedor raíz del shell, seteado por `AppShell` según el breakpoint), en vez de que cada componente decida su fuente — mantiene el resto del design-system (`--font-mono`, escala, spacing) 100% compartido y aísla el único eje real de divergencia (Clash+General vs. Space Grotesk+Manrope) a una sola decisión en la raíz.
3. **`AppShell` único con bifurcación interna**, no `MobileApp`/`DesktopApp` paralelos: `AppShell` decide el breakpoint (pendiente de definir, ver §7 #7) y monta `<Rail>` + layout ancho o `<TabBar>` + `.app-frame` angosto, ambos consumiendo los mismos `modules/{chat,connections,account}`.
4. **Componentes nuevos a construir:** `Rail` (nav+skin-switcher+user), `Modal`/`Dialog` genérico (para Apps-picker y cualquier futuro modal desktop), variante de layout ancho de cada módulo (`ChatDesktopLayout`, grid de 3 columnas en Connections ya es solo CSS — no necesita componente nuevo, solo una clase/breakpoint).
5. **Extender, no bifurcar, la tarjeta HITL**: agregar la máquina de estados (`pending|done` cobro, `pending|confirmed|cancelled` agenda) al componente canónico único, consumido igual por mobile y desktop.
6. **Corregir `global.css`**: el comentario actual ("Layout base 384-ancho; en desktop-web se centra") describe la idea vieja (mobile centrado en pantalla ancha) que **el mock de Web ya reemplazó** por un shell rail+full-width. `.app-frame` debe quedar exclusivo del `<TabBar>` shell; el `<Rail>` shell necesita su propio contenedor sin ese `max-width:384px`.

---

## 7. Desviaciones y ambigüedades a resolver antes de codear

| # | Desviación | Evidencia | Implicancia |
|---|---|---|---|
| **1** | **El mock tiene mic/voz completo; el brief dice "mic deshabilitado, solo texto"** | `Copiloto Web.dc.html` líneas 264-266 (botón mic) + 404-434 (overlay completo, idéntico al mobile) + footer "Enter para enviar · mantené 🎙 para hablar" (línea 271). Brief: `2026-07-03-cliente-web-mobile-design-handoff.md` §5.3 "Mic deshabilitado con micro-copy 'Por ahora, solo texto'" y §6 "composer (multilínea + enviar + mic deshabilitado)" | **Contradicción directa, no ambigüedad de interpretación.** El brief es la decisión de producto "cerrada — no re-abrir"; el mock visual (más reciente en el filesystem) la ignora. Definir con el operador cuál manda antes de implementar el composer — no asumir ninguna de las dos. |
| **2** | **El mock implementa "Apps" como picker modal; el brief pide una barra persistente de botones por servicio sobre el composer** | Mock: modal centrado §4.2/§5.3, sin fila de botones visible en el composer salvo el chip de salida. Brief + addendum completo: `2026-07-03-cliente-feature-modos-por-app.md` — especifica layout exacto (fila scrollable inmediatamente arriba del composer, un botón por servicio conectado, data-driven, "+"), con checklist de integración dedicado | El addendum es **el documento más reciente y más específico** (mismo día que el handoff, con contrato de datos y checklist propio) — probablemente supera al mock en autoridad. Pero el mock SÍ resuelve el "chip de modo activo" que el addendum pide (§5.7) — es una implementación parcial. Antes de codear: decidir si la barra de botones reemplaza al modal, convive con él (barra + "Apps"=modal solo para reconectar/ver todas), o el modal es simplemente la versión no-implementada-aún de la barra. |
| **3** | **Rail final (Web) no tiene Caja/Agenda "Próximamente"; el brief y `Cabina` sí los especifican** | Brief §5.2: "Desktop: rail izquierdo: 💬 Chat · 🔌 Conexiones · 📊 Caja (próx.) · 📅 Agenda (próx.) · 👤 Cuenta". `Cabina.dc.html` líneas 101-112 (tiles deshabilitados "Pronto"). `Copiloto Web.dc.html` rail (líneas 42-63): solo Chat/Apps/Conexiones/Cuenta, sin Caja ni Agenda en ninguna forma | El mock final **dropeó** dos ítems que el brief pide explícitamente y que existían en el precursor `Cabina`. ¿Se sacaron a propósito (simplificación) o se perdieron en la consolidación (mismo patrón que el mobile perdió el header de marca del Chat, ver mobile §5 #5/#7)? No asumir — confirmar antes de fijar el inventario final del rail. |
| **4** | **Elemento "firma" del brief (orb de presencia junto a la marca) ausente de toda la chrome persistente de Web** | Brief §8: "Elemento firma: indicador de presencia que 'respira' junto a la marca... Restricción: gastar la audacia en el elemento firma". `Copiloto Web.dc.html`: sin `<header>`, sin brand, sin orb en el rail (verificado por lectura completa, líneas 36-86) — el orb solo aparece en Cuenta (línea 351-353) | El requisito más enfático del brief visual (literalmente "el elemento en el que hay que gastar la audacia") no está presente donde el usuario lo vería siempre (rail/header). Es el mismo gap que el mobile (doc mobile §5 #5) pero más severo en escritorio porque acá ni siquiera hay un `Direcciones.dc.html` precedente que sí lo tuviera. |
| **5** | **Tres combinaciones tipográficas distintas entre mobile / Cabina / Web, sin reconciliar** | Mobile: Clash Display + General Sans (Fontshare, self-hosted, ya en código). Cabina: Bricolage Grotesque + Hanken Grotesk (Google Fonts). Web: Space Grotesk + Manrope (Google Fonts) | Confirmado que mobile y Web usan familias DISTINTAS por diseño (no es error) — pero la existencia de una 3ª combinación (Cabina) sin uso final sugiere que el proceso de diseño no convergió en una decisión tipográfica única hasta el mock de Web. Aceptar Web como la decisión vigente para escritorio; no mezclar con Cabina. |
| **6** | **`global.css` actual (código real, ya escrito) asume que desktop-web = mobile centrado; el mock de Web lo contradice** | `apps/copiloto-web/src/design-system/global.css` líneas 39-41: "Layout base 384-ancho; en desktop-web se centra (mobile centrado)". `Copiloto Web.dc.html`: shell rail+chat a ancho completo, contenido hasta 900px — no es "el frame de 384px centrado en una pantalla ancha" | El código ya escrito codifica una hipótesis de layout desktop que el propio equipo de diseño reemplazó después. Hay que corregir el comentario/CSS antes de que alguien lo tome como spec vigente — no es solo un detalle de esta extracción, es deuda de documentación activa. |
| **7** | **Ningún breakpoint definido en ningún artefacto** (mock, boceto, ni código) | Mobile fijo a 384×812; Cabina/Boceto/Web fijos a preview 1440×900 / ventanas 860px / 660px; `global.css` no tiene `@media` de ancho (grep confirmado, 0 matches); brief solo dice "Responsive real (desktop split / mobile tab bar / tablet)" sin número | **`[ASSUMED_PENDING_VERIFY]`** — no hay evidencia para fijar un breakpoint. La zona intermedia (~768-1200px, "tablet" que el brief menciona) no tiene ningún mock. Antes de implementar, el equipo debe decidir un valor (candidato razonable por evidencia indirecta: el rail necesita ≥~900-1000px para no competir con el `max-width:900px` de Conexiones — pero esto es una inferencia mía, no un dato de diseño) y documentarlo como ADR o decisión de producto, no inventarlo en el CSS sin registro. |
| **8** | **La mayoría de los screenshots de esta carpeta (`Web copiloto/screenshots/`) son duplicados del mobile, NO grounding de Web** | Verificado abriendo las 13 imágenes: `tema-ai-v2.png`, `tema-ai-v3.png`, `nav-glass.png`, `floating-nav.png`, `sheet-open.png`, `glass-composer.png`, `recording.png`, `01-modos.png`, `02-modos.png`, `tabbar.png`, `daylight-top.png` muestran **marcos de teléfono** (tab-bar inferior, 384px) — píxel a píxel los mismos que documenta el mobile. Solo `cabina.png` es genuinamente de escritorio, y muestra `Cabina` (la dirección descartada), no `Copiloto Web.dc.html` | **No hay ningún screenshot del shell final (rail auto-hide, 4 skins, Space Grotesk).** El único grounding visual de la versión que hay que construir es el propio `.dc.html` (que se renderiza pero no se capturó). Esto no bloquea la implementación (el markup es suficientemente explícito), pero sí significa que no hay una referencia pixel-perfect fuera del código del mock — cualquier duda de composición fina (espaciados exactos al hacer hover del rail, transición del modal) debe resolverse corriendo el `.dc.html` real, no mirando screenshots. |
| **9** | **Numérico de "cuántas integraciones hay" — 3er valor distinto** | Mobile: "3 activas · 3 disponibles" (=6). Cabina: "3/8". **Web: "3/6"** (rail) y "3 activas · 3 disponibles" (pantalla Conexiones, =6) | Mismo hallazgo que el mobile (doc mobile §4, último punto) pero ahora con un tercer valor. Confirma (no es novedad, pero refuerza) que el contador debe derivarse de `/catalog` real, nunca copiarse de ningún mock — ninguno de los 3 documentos tiene una fuente de verdad consistente. |
| **10** | **No hay pantalla de login/onboarding en ningún mock de escritorio**, igual que el mobile | Grep de "login"/"contraseña" en los 3 `.dc.html` de escritorio = 0 matches | Mismo gap que el mobile (doc mobile §3.7/#9) — el flujo crítico de primer contacto no tiene mockup visual en ninguna plataforma. No bloquea el resto del shell de escritorio, pero heredará el mismo riesgo de quedar genérico si se construye sin diseño. |

---

**Resumen de archivos fuente:** **`Copiloto Web correcciones.html`** (fuente de verdad vigente, 1077 líneas tras extraer el `x-dc` embebido del bundle, shell final rail+chat, 4 skins, Space Grotesk+Manrope+JetBrains Mono, sin sub-header de sesión en Chat — ver Changelog) · `Copiloto Web.dc.html` (630 líneas, versión previa/superseded, se conserva como baseline del diff) · `Copiloto Web - Boceto.dc.html` (wireframe, 2 direcciones, ganó `1a`) · `Copiloto - Cabina.dc.html` (dirección previa descartada parcialmente, Bricolage+Hanken, ámbar, 2 temas) · `docs/copiloto-emprendedor/2026-07-03-cliente-web-mobile-design-handoff.md` + `2026-07-03-cliente-feature-modos-por-app.md` (brief escrito, contradice el mock en 3 puntos, §7 #1-#3, sin resolver en correcciones) · comparado contra `docs/copiloto-emprendedor/APP Copiloto Movil/DESIGN-SYSTEM-EXTRACT.md` (mobile) y el código ya implementado en `apps/copiloto-web/src/design-system/` + `src/shell/AppShell.tsx` (placeholder, Task 9 FASE 2 no construida aún ni para mobile ni para desktop) · 13 screenshots (`Web copiloto/screenshots/`, 12/13 son duplicados del mobile, ver §7 #8).

---

## Changelog vs mock anterior (Copiloto Web.dc.html → correcciones)

> Método: parseo DOM de ambos archivos (BeautifulSoup, `html.parser`) + `prettify()` + diff estructural línea a línea sobre el subárbol `<x-dc>` (excluyendo `<helmet>`, que solo cambia de `<link>` a Google Fonts a `@font-face` self-hosted por ser un export "Bundled Page" — no es una decisión de diseño). El bloque de lógica (`<script type="text/x-dc">`: estado, temas, handlers) se comparó aparte y es **byte-idéntico** entre ambos archivos. Total de diffs reales encontrados: **5**, los 5 documentados abajo — nada más cambió.

| # | Elemento | Antes (`Copiloto Web.dc.html`) | Ahora (`correcciones.html`) | Tipo |
|---|---|---|---|---|
| 1 | **Sub-header de Chat** (barra de 52px sobre los mensajes) | Presente: `<div style="height:52px;...border-bottom:var(--row-border)">` con dot verde + texto mono "SESIÓN ACTIVA · sess_9f2a" + botón "Nueva conversación" (icono `+`) | **Eliminado por completo** — el `<div>` de 52px y sus 2 hijos ya no existen en el markup | **Eliminación** |
| 2 | **Padding superior del contenedor de mensajes de Chat** | `padding:28px 28px 12px` | `padding:32px 28px 12px` (+4px arriba, compensa el sub-header eliminado) | **Cambio de valor** |
| 3 | **Micro-copy bajo el composer** ("Enter para enviar · mantené 🎙 para hablar") | Presente, `<div style="text-align:center;...margin-top:9px">` inmediatamente debajo de la fila input+mic+send | **Eliminado por completo** — el composer termina en la fila de input/mic/send, sin texto de ayuda debajo | **Eliminación** |
| 4 | **Avatar del rail** (34px, bloque usuario) | `style="width:34px;height:34px;border-radius:50%;..."` (sin `flex-shrink`) | Agrega `flex-shrink:0` al mismo `style` | **Cambio de valor (fix de robustez)** |
| 5 | **Avatar de Cuenta** (62px) | `style="width:62px;height:62px;border-radius:50%;..."` (sin `flex-shrink`) | Agrega `flex-shrink:0` al mismo `style` | **Cambio de valor (fix de robustez)** |

**Nada agregado.** No hay ningún elemento, pantalla, componente o token nuevo en `correcciones.html` que no existiera ya en `Copiloto Web.dc.html`.

**Confirmado SIN cambios (verificado por diff estructural, no por inspección visual):** las 4 paletas de tema (`aurora`/`daylight`/`refined`/`ai`, ~35 tokens c/u) son byte-idénticas · tipografía (familias, tamaños, pesos, tracking) sin cambios · el rail (72px↔244px, 4 ítems, skin-switcher, hover) sin cambios · el modal "Apps" (contenido, transform, 4 filas de servicio) sin cambios · las 3 pantallas Conexiones/Cuenta/las tarjetas HITL (Cobro/Agenda/Publicar, con su máquina de estados) sin cambios · el overlay de grabación de voz sin cambios · el bloque `<script type="text/x-dc">` completo (estado, `MODES`, `micDown`, `renderVals`, los 4 objetos `themes`) es **byte-idéntico**, incluida la key `localStorage: 'copiloto-web-theme'`.

**Implicancia para el implementador del shell desktop:**
- **No construir** el sub-header de sesión de Chat (dot + "SESIÓN ACTIVA · sess_id" + botón "Nueva conversación") ni el micro-copy de ayuda bajo el composer — ambos existían en el mock previo y **fueron retirados** en la versión final. Si el `AppShell`/módulo de Chat ya tiene código o diseño basado en el `.dc.html` anterior que los incluya, hay que sacarlo.
- El contenedor de mensajes de Chat arranca con `padding-top:32px` (no 28px) al no haber sub-header encima.
- Los dos `flex-shrink:0` de avatar son opcionales de portar (mejoran robustez del layout flex durante la animación de ancho del rail) pero no son visualmente perceptibles en el mock estático — bajo prioridad, no bloquean nada.
- Ningún token de color, tamaño tipográfico, breakpoint, o comportamiento de estado cambió — todo lo demás del extract (§1-§7) sigue describiendo `correcciones.html` sin modificación adicional a la ya aplicada arriba.
