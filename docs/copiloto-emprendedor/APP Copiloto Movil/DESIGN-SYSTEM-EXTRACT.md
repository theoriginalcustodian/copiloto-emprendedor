# Design System Extract — Copiloto App Móvil

> Fuente: `Copiloto App.dc.html` (app principal, 4 temas) · `Copiloto - Cabina.dc.html` (dirección desktop alternativa, 2 temas) · `Copiloto - Direcciones.dc.html` (exploración previa, 3 temas, precursor de la app) · `screenshots/*.png` (grounding visual) · `support.js` (runtime del formato `.dc.html`: `x-dc`, `sc-if`, `sc-for`, `{{ }}` bindings, `class Component extends DCLogic` — motor genérico, sin tokens propios).
>
> Todo lo que sigue está **verificado leyendo el markup real**, no inferido. Donde el screenshot y el `.dc.html` actual difieren, se marca explícitamente (ver §5).

---

## 0. Los 3 documentos NO son un único design system

Hallazgo estructural previo a los tokens: hay **dos lenguajes visuales distintos**, no uno.

| Doc | Lenguaje visual | Fuentes | Temas | Superficie |
|---|---|---|---|---|
| `Copiloto App.dc.html` | Glass/aurora, orgánico, orb de presencia | Clash Display + General Sans + JetBrains Mono | 4 (Aurora Glass, Soft Daylight, Refined Dark, Tema AI) | Mobile (384×812, marco de teléfono) |
| `Copiloto - Direcciones.dc.html` | Mismo lenguaje que App, versión previa (sin "Tema AI", sin chrome de tabs/sheet/mic) | Igual que App | 3 (1a/1b/1c = Aurora/Daylight/Refined) | Mobile, mismo marco |
| `Copiloto - Cabina.dc.html` | Editorial/SaaS, ámbar, sobrio | Bricolage Grotesque + Hanken Grotesk + JetBrains Mono | 2 (dark/light, vía `data-theme`) | Desktop (rail + panel, 1440×900) |

**Implicancia para el rebuild:** `Cabina` es una **dirección alternativa no reconciliada** con `App` — paleta (ámbar vs. violeta/azul), tipografía (Bricolage/Hanken vs. Clash/General Sans) y estructura de temas (2 vs. 4) son incompatibles tal cual están. Si el desktop debe compartir sistema con mobile, `Cabina` necesita re-tematizarse sobre los tokens de `App`; si Cabina es la dirección "ganadora" para desktop, es un 2do sistema de tokens a mantener aparte. Es una decisión de producto pendiente, no un detalle de implementación (ver §5).

---

## 1. Tokens de diseño

### 1.1 Tipografía

**Sistema `App` / `Direcciones`** (el que importa para el rebuild mobile-first):

| Rol | Familia | Fuente | Pesos cargados |
|---|---|---|---|
| Display (headings, nombres, montos, título de marca) | `Clash Display` | Fontshare | 600, 700 |
| Body / UI (texto de chat, botones, labels de fila) | `General Sans` | Fontshare | 400, 500, 600 |
| Mono / data (timestamps, labels tipo "PARA"/"MONTO", badges, reloj de status bar, chips de modo) | `JetBrains Mono` | Google Fonts | 400, 500, 700 |

> **Nota:** el brief asumía Space Grotesk + Manrope. Verificado contra el markup real: son **Clash Display + General Sans**. Corregir el supuesto antes de instalar fuentes en el proyecto Vite.

Escala tipográfica observada (tamaño · familia · peso · tracking, todos los valores vistos en el markup):

| Uso | Tamaño | Familia | Peso | Tracking |
|---|---|---|---|---|
| H1 de pantalla ("Conexiones", "Cuenta") | 27px | Clash Display | 600 | -.01em |
| Nombre en tarjeta HITL ("Juan Pérez") | 22px | Clash Display | 600 | — |
| Título de sheet ("Tus apps") | 20px | Clash Display | 600 | — |
| Título de marca en header ("Copiloto", solo en Direcciones/Cabina) | 19px | Clash Display | 600 | — |
| Título de tile en grid Conexiones | 16px | Clash Display | 600 | — |
| Monto HITL (`--amount-size`, varía por tema: 44/44/50/46px) | 44–52px | Clash Display | 700 | -.02em |
| Signo `$` del monto | 20–22px | JetBrains Mono | 400 | — |
| Botón primario | 15.5px | General Sans | 600 | — |
| Mensaje de chat (bubble) | 14.5px | General Sans | 400 | line-height 1.45–1.5 |
| Botón cancelar / fila de settings | 14px | General Sans | 500 | — |
| Subtítulo de fila (Cuenta, tiles) | 11.5–13px | General Sans | 400 | — |
| Reloj de status bar | 14px | JetBrains Mono | 500 | — |
| Labels de campo HITL ("PARA", "MONTO", "COBRO", "CON", "CUÁNDO", "DÓNDE") | 11px | JetBrains Mono | 400 | .1–.16em |
| Badge ("REVISAR", "RECONECTAR", "IRREVERSIBLE", "PAGADO") | 9–10px | JetBrains Mono | 400/700 | .05–.12em |
| Label de sección canvas ("ELEGÍ EL TEMA", "CHAT", "CONEXIONES") | 11–12px | JetBrains Mono | 400 | .2–.22em, uppercase |
| Tab bar label | 10.5px | General Sans (sin declarar explícito, hereda) | 500/600 (600 si activo) | — |

**Sistema `Cabina`** (aparte):

| Rol | Familia | Pesos |
|---|---|---|
| Display | `Bricolage Grotesque` | 500, 600, 700 |
| Body/UI | `Hanken Grotesk` | 400, 500, 600, 700 |
| Mono/data | `JetBrains Mono` | 400, 500, 600 (el único punto en común con `App`) |

Tamaños Cabina: marca header 18px/700 · monto en card 29px/700 · título de card ("Reunión con Juan") 17px/600 · body 15px/1.5 · mono labels 10–11px.

### 1.2 Paleta — chrome del documento de diseño (NO es parte de la app)

Fondo del canvas Claude Design y el selector de temas viven fuera de los 4 temas; no se implementan en la PWA:

```css
--doc-canvas-bg: #E9E9EF;
--doc-canvas-label: #9A9AAE;   /* labels "CHAT" / "CONEXIONES" / "ELEGÍ EL TEMA" */
--doc-heading: #1A1A24;        /* H1 y chip activo del selector de tema */
--doc-body: #5B5B6B;
--doc-link-accent: #5B4AE0;
--chip-active-bg: #1A1A24; --chip-active-fg: #fff;
--chip-inactive-bg: transparent; --chip-inactive-fg: #6E6E80;
```

### 1.3 Los 4 temas — tokens completos (verbatim del `Component.themes` en `Copiloto App.dc.html`)

Formato listo para `:root[data-theme="…"] { }`. Agrupados por rol; los nombres son los reales del código (útil mantenerlos 1:1 al portar a CSS vars de React para trazabilidad con el mockup).

#### `aurora` — Aurora Glass (violeta sobre fondo oscuro, vidrio esmerilado)

```css
--bg: #0D0A20;
--bg-layer: radial-gradient(120% 60% at 20% -5%, rgba(124,92,255,.55), transparent 60%),
            radial-gradient(90% 50% at 100% 8%, rgba(199,74,255,.4), transparent 55%),
            radial-gradient(80% 40% at 50% 108%, rgba(74,120,255,.35), transparent 60%);
/* texto */
--text: #F4F1FF; --mono: #9F90D8; --status-fg: #EDEBFF; --heading: #F4F1FF;
--label: #8E7FC4; --concept: #A99AD8; --name-fg: #F4F1FF;
/* orb de presencia */
--core-size: 20px; --core: linear-gradient(150deg,#C6A5FF,#7C5CFF);
--core-glow: 0 0 18px 3px rgba(140,100,255,.85);
--halo: radial-gradient(circle, rgba(160,120,255,.6), transparent 70%);
--presence-wrap-bg: transparent; --presence-wrap-shadow: none;
/* chip / avatar */
--chip-fg: #B9A9FF; --chip-bg: transparent; --chip-border: 1px solid rgba(185,169,255,.35);
--avatar-bg: rgba(255,255,255,.1); --avatar-border: 1px solid rgba(255,255,255,.16); --avatar-shadow: none; --avatar-fg: #EDEBFF;
/* burbuja asistente */
--bubble-bg: rgba(255,255,255,.08); --bubble-border: 1px solid rgba(255,255,255,.1);
--bubble-shadow: none; --bubble-blur: blur(14px); --bubble-fg: #E8E4FB;
/* burbuja usuario */
--user-bg: linear-gradient(140deg, rgba(160,120,255,.35), rgba(124,92,255,.22));
--user-border: 1px solid rgba(160,120,255,.4); --user-fg: #F1ECFF;
/* tarjeta HITL */
--card-bg: linear-gradient(165deg, rgba(38,28,74,.92), rgba(22,16,46,.96));
--card-border: 1px solid rgba(199,165,255,.28); --card-shadow: 0 24px 50px -18px rgba(90,50,190,.7); --card-blur: blur(20px);
--amount-size: 44px; --amount-fg: #fff; --amount-sign: #B9A9FF;
--badge-fg: #FFC98A; --badge-bg: rgba(255,180,90,.14); --badge-border: 1px solid rgba(255,180,90,.3);
/* botones */
--btn-bg: linear-gradient(120deg,#C6A5FF,#8C6BFF); --btn-fg: #1A0E3D; --btn-shadow: 0 12px 26px -8px rgba(140,100,255,.75);
--cancel-fg: #C9BEEA; --cancel-bg: transparent; --cancel-border: 1px solid rgba(255,255,255,.14); --cancel-shadow: none;
--send-bg: linear-gradient(140deg,#C6A5FF,#7C5CFF); --send-fg: #20114A;
/* composer */
--input-bg: rgba(255,255,255,.08); --input-border: 1px solid rgba(255,255,255,.14);
--input-shadow: none; --input-blur: blur(14px); --input-fg: #8E7FC4;
/* nav */
--tab-active: #EDEBFF; --tab-inactive: #786BA6; --tab-border: 1px solid rgba(255,255,255,.06);
--nav-bg: rgba(28,20,54,.55); --nav-border: rgba(200,180,255,.2);
/* tiles / estados */
--tile-bg: rgba(255,255,255,.06); --tile-border: 1px solid rgba(255,255,255,.1); --tile-shadow: none; --tile-blur: blur(12px);
--ok-fg: #8CE8B4; --ok-bg: rgba(90,220,150,.16); --ok-border: 1px solid rgba(90,220,150,.32);
--danger-fg: #FF9AAA; --danger-bg: rgba(255,90,120,.14); --danger-border: 1px solid rgba(255,90,120,.32);
--danger-btn-bg: linear-gradient(120deg,#FF9AAA,#FF6B85); --danger-btn-fg: #3A0A14;
--row-border: 1px solid rgba(255,255,255,.07);
```

#### `daylight` — Soft Daylight (neomorfismo lavanda, claro)

```css
--bg: #E7E7F1; --bg-layer: none;
--text: #2A2A3E; --mono: #8888A0; --status-fg: #41415A; --heading: #2A2A3E;
--label: #9A9AB4; --concept: #7A7A92; --name-fg: #2A2A3E;
--core-size: 16px; --core: linear-gradient(150deg,#8B82FF,#5B4AE0);
--core-glow: 0 0 14px 2px rgba(99,91,255,.6);
--halo: radial-gradient(circle, rgba(99,91,255,.35), transparent 70%);
--presence-wrap-bg: #E7E7F1; --presence-wrap-shadow: 6px 6px 12px #C6C6D6, -6px -6px 12px #ffffff;
--chip-fg: #6B62C4; --chip-bg: #DEDEEC; --chip-border: none;
--avatar-bg: #E7E7F1; --avatar-border: none; --avatar-shadow: 5px 5px 10px #C6C6D6, -5px -5px 10px #ffffff; --avatar-fg: #5B4AE0;
--bubble-bg: #E7E7F1; --bubble-border: none;
--bubble-shadow: inset 3px 3px 7px #CACAD9, inset -3px -3px 7px #ffffff; --bubble-blur: none; --bubble-fg: #4A4A62;
--user-bg: linear-gradient(140deg,#6B5BFF,#5B4AE0); --user-border: none; --user-fg: #fff;
--card-bg: #E7E7F1; --card-border: none; --card-shadow: 9px 9px 22px #C4C4D6, -9px -9px 22px #ffffff; --card-blur: none;
--amount-size: 44px; --amount-fg: #2A2A3E; --amount-sign: #8B82FF;
--badge-fg: #C77A2E; --badge-bg: #F2E4D2; --badge-border: none;
--btn-bg: linear-gradient(120deg,#6B5BFF,#5B4AE0); --btn-fg: #fff; --btn-shadow: 0 12px 24px -8px rgba(91,74,224,.6);
--cancel-fg: #6A6A82; --cancel-bg: #E7E7F1; --cancel-border: none; --cancel-shadow: 4px 4px 9px #C9C9D8, -4px -4px 9px #ffffff;
--send-bg: linear-gradient(140deg,#6B5BFF,#5B4AE0); --send-fg: #fff;
--input-bg: #E7E7F1; --input-border: none;
--input-shadow: inset 3px 3px 7px #CACAD9, inset -3px -3px 7px #ffffff; --input-blur: none; --input-fg: #9494AC;
--tab-active: #5B4AE0; --tab-inactive: #9A9AB4; --tab-border: none;
--nav-bg: rgba(238,238,247,.6); --nav-border: rgba(255,255,255,.75);
--tile-bg: #E7E7F1; --tile-border: none; --tile-shadow: 6px 6px 14px #C7C7D6, -6px -6px 14px #ffffff; --tile-blur: none;
--ok-fg: #2E9E68; --ok-bg: #D8EEE1; --ok-border: none;
--danger-fg: #C7455A; --danger-bg: #F3D9DE; --danger-border: none;
--danger-btn-bg: linear-gradient(120deg,#E4667A,#C7455A); --danger-btn-fg: #fff;
--row-border: 1px solid rgba(0,0,0,.06);
```

#### `refined` — Refined Dark (editorial, negro neutro, acento aqua)

```css
--bg: #0B0C0F; --bg-layer: radial-gradient(90% 40% at 50% -8%, rgba(74,216,255,.1), transparent 60%);
--text: #F5F6F8; --mono: #6E7480; --status-fg: #EDEEF2; --heading: #F5F6F8;
--label: #5D636E; --concept: #8B909B; --name-fg: #F5F6F8;
--core-size: 14px; --core: #5EE0FF; --core-glow: 0 0 16px 3px rgba(74,216,255,.9);
--halo: radial-gradient(circle, rgba(74,216,255,.5), transparent 70%);
--presence-wrap-bg: transparent; --presence-wrap-shadow: none;
--chip-fg: #79E4FF; --chip-bg: transparent; --chip-border: 1px solid rgba(94,224,255,.3);
--avatar-bg: #17191E; --avatar-border: 1px solid rgba(255,255,255,.08); --avatar-shadow: none; --avatar-fg: #EDEEF2;
--bubble-bg: transparent; --bubble-border: none; --bubble-shadow: none; --bubble-blur: none; --bubble-fg: #C3C7CF;
--user-bg: rgba(94,224,255,.12); --user-border: 1px solid rgba(94,224,255,.22); --user-fg: #DDF6FF;
--card-bg: #131519; --card-border: 1px solid rgba(255,255,255,.07); --card-shadow: 0 30px 60px -24px rgba(0,0,0,.8); --card-blur: none;
--amount-size: 50px; --amount-fg: #fff; --amount-sign: #5D636E;
--badge-fg: #E0A45E; --badge-bg: transparent; --badge-border: 1px solid rgba(224,164,94,.3);
--btn-bg: #5EE0FF; --btn-fg: #04252E; --btn-shadow: 0 10px 28px -8px rgba(94,224,255,.5);
--cancel-fg: #9AA0AB; --cancel-bg: transparent; --cancel-border: 1px solid rgba(255,255,255,.1); --cancel-shadow: none;
--send-bg: #5EE0FF; --send-fg: #04252E;
--input-bg: #131519; --input-border: 1px solid rgba(255,255,255,.08); --input-shadow: none; --input-blur: none; --input-fg: #6E7480;
--tab-active: #F5F6F8; --tab-inactive: #5D636E; --tab-border: 1px solid rgba(255,255,255,.05);
--nav-bg: rgba(16,18,23,.6); --nav-border: rgba(255,255,255,.09);
--tile-bg: #131519; --tile-border: 1px solid rgba(255,255,255,.06); --tile-shadow: none; --tile-blur: none;
--ok-fg: #5EE0A0; --ok-bg: transparent; --ok-border: 1px solid rgba(94,224,160,.3);
--danger-fg: #FF8090; --danger-bg: transparent; --danger-border: 1px solid rgba(255,110,130,.32);
--danger-btn-bg: #FF8090; --danger-btn-fg: #2E0810;
--row-border: 1px solid rgba(255,255,255,.05);
```

#### `ai` — Tema AI (el tema por defecto en los screenshots; azul profundo + glow multicolor + "edge highlight" tipo vidrio)

```css
--bg: #020308;
--bg-layer: radial-gradient(46% 36% at 50% 42%, rgba(72,130,255,.36), transparent 62%),
            radial-gradient(40% 30% at 14% 14%, rgba(96,146,255,.18), transparent 60%),
            radial-gradient(46% 36% at 88% 86%, rgba(255,142,80,.15), transparent 60%),
            radial-gradient(42% 36% at 86% 18%, rgba(150,110,255,.16), transparent 60%),
            radial-gradient(130% 92% at 50% 45%, transparent 54%, rgba(0,0,0,.58));
--text: #F2F5FF; --mono: #8FA0C8; --status-fg: #EAF0FF; --heading: #F5F8FF;
--label: #8FA0C8; --concept: #9FB0D8; --name-fg: #F5F8FF;
--core-size: 18px; --core: radial-gradient(circle at 35% 30%, #CFE6FF, #3B82F6 58%, #2563EB);
--core-glow: 0 0 22px 5px rgba(77,140,255,.9);
--halo: radial-gradient(circle, rgba(90,150,255,.6), transparent 70%);
--presence-wrap-bg: transparent; --presence-wrap-shadow: none;
--chip-fg: #9BC0FF; --chip-bg: rgba(77,140,255,.12); --chip-border: 1px solid rgba(120,160,255,.4);
--avatar-bg: rgba(40,50,80,.5); --avatar-border: 1px solid rgba(130,160,255,.35); --avatar-shadow: 0 0 16px rgba(77,140,255,.28); --avatar-fg: #EAF0FF;
--bubble-bg: linear-gradient(150deg, rgba(44,56,94,.4), rgba(14,18,34,.46));
--bubble-border: 1px solid rgba(150,184,255,.5);
--bubble-shadow: inset 0 1.5px 0 rgba(216,230,255,.7), 0 0 30px -6px rgba(74,120,255,.4), 0 22px 44px -20px rgba(0,0,0,.82);
--bubble-blur: blur(18px); --bubble-fg: #DCE4FA;
--user-bg: linear-gradient(140deg, rgba(96,156,255,.38), rgba(60,100,240,.3));
--user-border: 1px solid rgba(140,175,255,.55); --user-fg: #EDF2FF;
--card-bg: linear-gradient(150deg, rgba(48,60,100,.42), rgba(12,16,32,.5));
--card-border: 1px solid rgba(158,192,255,.58);
--card-shadow: inset 0 1.5px 0 rgba(226,238,255,.85), inset 0 0 26px rgba(90,150,255,.16),
               inset 0 -20px 34px -16px rgba(255,150,90,.3), 0 0 44px -2px rgba(74,120,255,.5), 0 44px 80px -26px rgba(0,0,0,.92);
--card-blur: blur(24px);
--amount-size: 46px; --amount-fg: #FFFFFF; --amount-sign: #5AA0FF;
--badge-fg: #FFC98A; --badge-bg: rgba(255,170,80,.14); --badge-border: 1px solid rgba(255,170,80,.42);
--btn-bg: linear-gradient(120deg,#4A93FF,#2A5FE0); --btn-fg: #FFFFFF; --btn-shadow: 0 12px 30px -8px rgba(77,140,255,.7);
--cancel-fg: #A9B6D8; --cancel-bg: rgba(255,255,255,.04); --cancel-border: 1px solid rgba(130,150,200,.26); --cancel-shadow: none;
--send-bg: linear-gradient(140deg,#4A93FF,#2A5FE0); --send-fg: #FFFFFF;
--input-bg: linear-gradient(150deg, rgba(44,56,94,.42), rgba(14,18,34,.48));
--input-border: 1px solid rgba(156,190,255,.54);
--input-shadow: inset 0 1.5px 0 rgba(222,234,255,.72), 0 0 38px -6px rgba(74,120,255,.52), 0 20px 40px -20px rgba(0,0,0,.8);
--input-blur: blur(18px); --input-fg: #8FA0C8;
--tab-active: #EAF0FF; --tab-inactive: #5E6B8C; --tab-border: 1px solid rgba(130,160,255,.14);
--nav-bg: rgba(18,24,46,.52); --nav-border: rgba(130,160,255,.3);
--tile-bg: linear-gradient(150deg, rgba(46,58,96,.4), rgba(12,16,30,.48));
--tile-border: 1px solid rgba(156,190,255,.54);
--tile-shadow: inset 0 1.5px 0 rgba(222,234,255,.75), inset 0 -16px 26px -14px rgba(255,150,90,.24),
               0 0 36px -4px rgba(74,120,255,.46), 0 34px 60px -24px rgba(0,0,0,.88);
--tile-blur: blur(20px);
--ok-fg: #34E5A0; --ok-bg: rgba(52,229,160,.14); --ok-border: 1px solid rgba(52,229,160,.42);
--danger-fg: #FF8FA0; --danger-bg: rgba(255,90,120,.14); --danger-border: 1px solid rgba(255,110,130,.46);
--danger-btn-bg: linear-gradient(120deg,#FF7A90,#F0455F); --danger-btn-fg: #2E0810;
--row-border: 1px solid rgba(130,160,255,.12);
```

**Nota de implementación — tokens muertos:** los 4 temas definen `--mp-bg / --mp-fg / --mp-border / --mp-shadow` pero **ningún nodo del markup los consume** (`grep var(--mp-` = 0 matches). Los íconos de marca (Mercado Pago, Gmail, Google Calendar, HubSpot, Drive, Instagram) usan colores hardcodeados fieles a cada marca, no theme-aware — correcto (un ícono de marca no debería retemarse), pero implica que `--mp-*` es dead code a **no portar** al rebuild, o a decidir si se usa para otra cosa.

**Colores de marca hardcodeados** (iguales en los 4 temas, van fuera del sistema de tokens):
```css
--brand-mercadopago: linear-gradient(150deg,#00B7EA,#009EE3);
--brand-google-blue: #4285F4;
--brand-gmail-red: #EA4335;
--brand-hubspot-orange: #FF7A59;
--brand-instagram: linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF);
--brand-drive: /* 3 triángulos: */ #0F9D58, #FFCD40, #4285F4;
```

### 1.4 Spacing y radios

No hay grid estricto de 8px — es una **escala fina, casi continua**, ajustada a mano. Valores reales observados (px): `2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,20,22,24,26,32`. Recomendación para el rebuild: token scale fina (`4/6/8/10/12/14/16/18/20/22/24/28/32`) en vez de forzar un grid de 8pt — el diseño lo rompe deliberadamente en casi todos los componentes (padding de card = `22px 20px 18px`, no `24px 16px`).

Radios (border-radius):

| Elemento | Radio |
|---|---|
| Marco del teléfono (outer) | 46px |
| Marco del teléfono (inner screen) | 36px |
| Tarjeta HITL | 24px (23–26px según tema en Direcciones) |
| Tile de Conexiones / composer / bottom-sheet top | 20px / 20px / 26px 26px 0 0 |
| Burbuja de chat | `20px 20px 20px 6px` (asistente, cola abajo-izq) / `20px 20px 6px 20px` (usuario, cola abajo-der) |
| Botón primario / cancelar | 14px |
| Tab bar (pill flotante) | 26px |
| Badge / chip pequeño | 5–7px |
| Icono de servicio (contenedor 30×30 / 38×38 / 42×42) | 9–12px |
| Avatar / orb / dot | 50% (circular) |

### 1.5 Sombras y glow

| Token | Fórmula | Uso |
|---|---|---|
| Elevación de marco de teléfono | `0 50px 90px -30px rgba(40,30,80,.5), 0 0 0 1px rgba(0,0,0,.25)` | Constante en los 4 temas (independiente del theming interno) |
| `--card-shadow` | Varía radicalmente por tema: glow coloreado (aurora/ai), neumórfico dual-light (daylight), drop-shadow puro sin color (refined) | Ver bloques §1.3 |
| Glow del orb (`--core-glow`) | `0 0 Npx Mpx rgba(color,.85-.9)` | Halo del punto de presencia |
| "Edge highlight" (solo tema `ai`) | `inset 0 1.5px 0 rgba(255,255,255-ish,.7-.85)` combinado con glow externo | Simula el borde superior iluminado de vidrio esmerilado — firma visual única del tema AI, no presente en los otros 3 |

### 1.6 Motion

| Keyframe | Definición | Uso | Estado de uso real |
|---|---|---|---|
| `ring` | `scale(.7→2.4) opacity(.55→0)`, 3.4s ease-out infinite | Halo expansivo del orb de presencia | **Usado** — solo en la card "Tu copiloto sigue activo" de Cuenta (`Copiloto App.dc.html:450`) |
| `core` | `scale(1↔1.14)`, 2.6s ease-in-out infinite | Respiración del punto central del orb | **Usado**, mismo lugar que `ring` |
| `floaty` | `translateY(0↔-6px)`, declarado en `<style>` | Pensado para la card HITL | **Declarado pero NO aplicado** en `Copiloto App.dc.html` (sí se aplica en `Direcciones.dc.html`, línea 82/172, sobre el HITL card) — dead code en el archivo final, o animación perdida al consolidar. Ver §5. |
| `wavePulse` / `waveSlide` | Pulso de escala Y + desplazamiento X infinito | Waveform del overlay de grabación de voz | Usado, overlay de recording |
| `recdot` | `opacity(1↔.25)`, 1.1s | Punto rojo de "grabando" | Usado, overlay de recording |
| `breathe` (solo Cabina) | `scale(.5→2.6) opacity(.8→0)`, 3.4s cubic-bezier, 2 anillos con delay 1.7s | Presencia en header + hero del panel de Cabina | Respeta `prefers-reduced-motion: reduce` (única de las 3 hojas de estilo que lo hace — portar esta media query al rebuild) |
| Transiciones de UI | `transform .36s cubic-bezier(.4,0,.2,1)` (tab bar / sheet), `.3s` (scrim) | Ocultar tab bar al scrollear, abrir/cerrar sheet | — |

---

## 2. Inventario de componentes

### 2.1 Presence orb (punto de presencia "vivo")
- Estructura: 1–2 anillos (`--halo`, radial-gradient) con `animation: ring` + núcleo sólido/gradiente (`--core`) con `box-shadow: var(--core-glow)` y `animation: core`.
- Tamaño del núcleo parametrizado por tema (`--core-size`: 14–20px); el anillo es 2× el núcleo aprox.
- **Dos implementaciones no unificadas:** la de `App`/`Direcciones` (single/double ring, keyframe `ring`+`core`) vs. la de `Cabina` (keyframe `breathe`, 2 anillos con delay, color ámbar fijo en vez de theme-token). Mismo concepto, código duplicado — candidato a componente compartido único con props de color/tamaño.
- En `Copiloto App.dc.html` el orb **solo aparece en la pantalla Cuenta** (card de durabilidad), no en el header de Chat (ver §5 — discrepancia vs. screenshots).

### 2.2 Header
Dos variantes observadas, **no la misma en todos lados**:

| Variante | Dónde | Contenido |
|---|---|---|
| Header de marca completo | `Direcciones.dc.html` (chat 1a/1b/1c) + todos los screenshots de Chat | Orb de presencia · "Copiloto" (Clash 19px/600) · chip "ES-AR" (mono, 10px, borde sutil) · subtítulo "en línea · durable" (mono 11px) · avatar circular "R" a la derecha |
| Header simple (solo H1 + avatar) | `Copiloto App.dc.html`, pantallas Conexiones y Cuenta | H1 Clash Display 27px + avatar 36–58px con inicial |
| Ausente | `Copiloto App.dc.html`, pantalla Chat | Solo status bar (reloj+batería), va directo a los mensajes — **no tiene el header de marca** que sí muestran los screenshots (ver §5) |
| Header desktop | `Cabina.dc.html` | Dot de presencia (ámbar, `breathe`) · "Copiloto" (Bricolage 18px/700) · chip "es-AR" · [espacio] · botón toggle tema (sol/luna) · pill de usuario (avatar circular + "Rodrigo") |

### 2.3 Rail (desktop) / Tab-bar (mobile)
**Tab-bar mobile** (flotante, `position:absolute; bottom:18px; left/right:16px`, `border-radius:26px`, `backdrop-filter:blur(30px) saturate(1.5)`):
- 4 ítems fijos: **Chat** (mensaje/burbuja icon) · **Apps** (grid 2×2 icon, con dot-badge superpuesto si `hasMode` está activo, color `--amount-sign` + glow) · **Conexiones** (ícono link) · **Cuenta** (ícono persona).
- Estado activo: `color: var(--tab-active)` + label `font-weight:600`; inactivo: `var(--tab-inactive)` + `font-weight:500`.
- Se oculta (`translateY(150%)`) al scrollear hacia abajo en el chat, reaparece al scrollear hacia arriba (`onChatScroll`, threshold 6px/26px). El composer sube/baja en espejo (`composerShift`).

**Rail desktop** (`Cabina`, 228px fijo, sin colapsar):
- Chat (activo: tinte ámbar + borde izquierdo 2.5px) · Conexiones (badge mono "3/8") · separador "PRÓXIMAMENTE" (label mono) · Caja (deshabilitado, opacity .5, badge "Pronto") · Agenda (deshabilitado, opacity .5, badge "Pronto") · [empuja al fondo con `margin-top:auto`, separador de borde] · Cuenta.
- No tiene concepto de "Apps"/modos — ver §4.

### 2.4 Barra de modos + botón de modo + chip de modo activo
- **Botón "Apps"** en el tab-bar abre un **bottom-sheet** ("Tus apps"), no una barra de modos inline.
- El sheet lista 4 "modos" (Cobrar/MP, Agenda/Calendar, Mail/Gmail, Clientes/HubSpot) como filas seleccionables (ícono 42×42 + nombre + subtítulo de servicio + checkmark circular si seleccionado).
- Al seleccionar un modo: `activeMode` se guarda en el estado, el sheet cierra, y **el placeholder del composer cambia** (`"Modo Gmail: mandá un mail a…"`, etc. — ver `MODES` en el código) — es el único efecto visible de "modo" en el archivo actual. No hay un chip visual persistente del modo activo en el header de chat (`activeChipLabel` existe en `renderVals()` pero **no está renderizado en ningún lugar del markup** — otro token/valor calculado y no consumido, ver §5).
- Dentro del sheet, si hay un modo activo aparece un botón "Salir del modo" (pill con ícono X) arriba de la lista.
- Fila Gmail muestra el modo seleccionable **aun con badge "RECONECTAR"** — se puede activar un modo sobre una integración desconectada.

### 2.5 Burbuja de chat
- **Usuario:** alineada a la derecha, `border-radius: 20px 20px 6px 20px`, fondo/borde `--user-*`, ancho máx 82%; debajo, a la derecha, un timestamp mono `✓✓ recibido` en `--ok-fg`.
- **Asistente / texto plano:** alineada a la izquierda, `border-radius: 20px 20px 20px 6px`, fondo `--bubble-bg` + `backdrop-filter: var(--bubble-blur)`, ancho máx 80–88%.
- **Variante desambiguación:** burbuja de texto + fila de chips debajo (`Juan Pérez` estilo "user" = elegido; `Juan Gómez` estilo outline transparente + opacity .75 = descartado). Los chips no son clicables en el mock (estáticos).
- **Variante HITL card:** ver 2.6.
- **Variante confirmación/loop-closure** ("Juan te pagó $15.000"): fila con icono check circular (`--ok-bg`/`--ok-border`) + texto + label mono secundaria (p.ej. "PAGADO · 14:32"). Mismo patrón visual para el link de pago copiable en `Cabina` (icono distinto, mismo rol semántico).

### 2.6 Tarjeta HITL (Human-in-the-loop) — el componente estrella
Estructura común a los 3 niveles de riesgo:

```
┌─────────────────────────────────────┐
│ [ícono servicio] LABEL       [BADGE] │  ← header: label mono (COBRO/AGENDA/PUBLICAR) + badge de estado (opcional)
│ PARA / CON                           │  ← label mono 11px
│ Juan Pérez                           │  ← Clash Display 22px/600 (--name-fg)
│ MONTO                                │  ← label mono 11px (solo variante cobro)
│ $ 15.000                             │  ← $ mono 20px + monto Clash Display 44-52px/700
│ Sesión de asesoría · hoy             │  ← concepto, 13px, --concept
│ [ Sí, cobrar $15.000 ]               │  ← botón primario --btn-*
│ [ Cancelar ]                         │  ← botón secundario --cancel-*
└─────────────────────────────────────┘
```

3 variantes de riesgo, mismo layout, distinto tratamiento de header/footer:

| Variante | Badge | Borde de card | Copy de acción | Advertencia |
|---|---|---|---|---|
| **COBRO** (riesgo medio) | "REVISAR" (ámbar, `--badge-*`) | `--card-border` normal | "Sí, cobrar $X" / "Cancelar" | — |
| **AGENDA** (riesgo bajo, "calmo" según comentario del código) | *ninguno* | `--card-border` normal | "Confirmar turno" / "Cancelar" | nota chica de contexto ("Los turnos duran 60 min…") |
| **PUBLICAR / Instagram** (irreversible) | "IRREVERSIBLE" (rojo, `--danger-*`) | `--danger-border` (el borde entero de la card cambia a rojo, no solo el badge) | "Mantené para publicar" / "Cancelar" | fila con ícono alerta + "No se puede deshacer · queda público" en `--danger-fg` |

La variante irreversible además inyecta un **preview WYSIWYG** del contenido a publicar (banner con gradiente + texto grande + caption) antes de los botones — único caso de "vista previa de resultado" en el set.

En `Cabina` la misma tarjeta tiene una 4ª variante de estado vía badge con 3 posiciones (`Pendiente` ámbar pulsante · `Agendado` verde · `Cancelado` gris) y cambia el **cuerpo entero** según estado (botones de acción vs. banner de confirmación vs. banner de cancelación) — patrón de card con máquina de estados más explícito que el de mobile (que es estático/ilustrativo, sin estados post-acción salvo el ejemplo de pago ya resuelto).

### 2.7 Chips de desambiguación
Fila de `span` clicables (visualmente, no hay `onClick` cableado en el mock): opción activa = estilo idéntico a burbuja de usuario (`--user-bg/--user-border/--user-fg`); opciones no elegidas = borde `--chip-border`, fondo transparente, `color:var(--text)`, `opacity:.75`. `border-radius:12px`, padding `8px 13px`, `font-size:13px/500`.

### 2.8 Card de conexión (Conexiones — grid 2 columnas)
Estructura: ícono de marca (38×38, radio 11px) → nombre (Clash 16px/600) + subtítulo de servicio (11.5px, `--label`) → indicador de estado al pie. 3 estados:

| Estado | Indicador | Otros |
|---|---|---|
| **Conectado** | Dot verde + "CONECTADO" (mono 10px, `--ok-fg`) | — |
| **Reconectar** | Badge píldora "RECONECTAR" (`--badge-*`) alineado a la izquierda | El borde de la card entera pasa a `--danger-border` (mismo patrón que la HITL irreversible: el estado de alerta tiñe el borde completo, no solo un chip) |
| **Sin conectar** | Botón ghost "Conectar" (`--cancel-border` + transparente) | Card entera con `opacity:.82` |

En `Cabina` el mismo concepto vive como **fila** (no card en grid) dentro del panel lateral: mark de 2 letras (MP/GC/GM/GD) en vez de ícono de marca, dot verde (conectado) / anillo hueco (desconectado) — sin estado "reconectar" explícito en esa vista.

### 2.9 Card de durabilidad ("En línea · durable")
Mobile (pantalla Cuenta): orb de presencia (ring+core) + "Tu copiloto sigue activo" (14px/500) + "Aunque cierres la app, nada se pierde. Retoma donde quedaron." (12.5px, `--label`). Fondo = `--bubble-bg` (reutiliza el token de burbuja, no uno propio).

Desktop (`Cabina`, panel lateral, siempre visible arriba del todo): orb doble-anillo ámbar + "En línea" (Bricolage 17px/600) + "durable · nunca se apaga" (mono 10.5px, uppercase, color ámbar) + caption (12px). Más prominente que en mobile (es lo primero que se ve en el panel, vs. estar al final de una lista de settings en mobile).

### 2.10 Composer (con mic/voz)
- Contenedor: `border-radius:20px`, `--input-*` tokens, `backdrop-filter:var(--input-blur)`.
- Estado **idle**: placeholder de texto (`{{ placeholder }}`, cambia según modo activo) + botón mic (ícono cápsula+ondas, `36px`, transparente) + botón enviar (circular 38px, `--send-bg`, flecha arriba).
- Estado **grabando** (overlay full-screen, scrim `rgba(3,4,10,.74)` + blur 7px):
  - Waveform animado (SVG, gradiente cian→azul→violeta→magenta, 6 curvas apiladas con opacidad decreciente).
  - Dot rojo pulsante + label de tiempo transcurrido `mm:ss` (mono 16px).
  - **Sub-estado "unlocked"** (dedo sostenido, sin deslizar): hint "Soltá para enviar · deslizá ↑ para fijar".
  - **Sub-estado "locked"** (deslizó el dedo hacia arriba >46px, `pointermove` delta): aparecen botones "Cancelar" (outline) + enviar (circular 56px, `--send-bg`).
  - Interacción real (del `Component`): `pointerdown` en el mic arma un timer de 250ms (actualiza el label) y escucha `pointermove`/`pointerup` a nivel `document`; sin lock, soltar el dedo llama `stopRec()` (implícitamente cancela — **el mock no distingue "soltar para enviar" de "cancelar" en el estado unlocked**, es una ambigüedad de la interacción a resolver en la implementación real, ver §5).
- Cabina (desktop) no tiene mic — el textarea siempre es de texto, con footer "Enter para enviar · Shift+Enter para saltar de línea" y fila de 3 pills de acceso rápido con emoji (💵/📅/✉️) arriba del input — patrón distinto al de mobile (que no tiene quick-actions visibles sobre el composer, solo el sheet de Apps).

### 2.11 Bottom-sheet
`Copiloto App.dc.html`: overlay (scrim `rgba(3,4,10,.55)` blur 2px, click cierra) + sheet (`border-radius:26px 26px 0 0`, `--card-bg`, `transform:translateY(0|120%)`, `transition: .36s cubic-bezier(.32,.72,0,1)`, `max-height:76%`). Handle bar centrado arriba (38×5px, `--label` opacity .5). Usado únicamente para "Tus apps" (no hay otro sheet en el export).

### 2.12 Selector de tema
Fila de pills (`--doc-canvas` chrome, no parte de la app en sí — ver 0/1.2): 4 botones ("Aurora Glass" en 2 líneas, "Soft Daylight", "Refined Dark", "Tema AI"), activo = fondo `#1A1A24`/texto blanco + shadow, inactivo = transparente/`#6E6E80`. Persistencia real vía `localStorage.getItem/setItem('copiloto-theme')` en `componentDidMount`/`set()` — **esto SÍ es lógica de producto real** (no solo chrome de documentación), aunque el control visual vive fuera del frame del teléfono. Ver §4/§5 sobre si el usuario final debe poder elegir entre los 4 temas.

### 2.13 Tiles "Próximamente"
Solo en el rail desktop: fila deshabilitada (`opacity:.5`, sin hover), ícono + label + badge mono "Pronto" (borde sutil, uppercase, tracking .1em). Aplica a "Caja" y "Agenda". No hay equivalente mobile (el tab-bar mobile no tiene 5º/6º ítem para features futuras — si se necesitan, requieren decisión de dónde viven en mobile).

---

## 3. Inventario de pantallas

### 3.1 Chat (mobile, `Copiloto App.dc.html`)
- **Sin header de marca** en la versión actual del archivo (ver §5) — solo status bar.
- Estados de mensaje, en orden: marcador de sesión "SESIÓN ACTIVA · HOY" → mensaje usuario "Cobrale 15 lucas a Juan por la asesoría" (+ "✓✓ recibido") → desambiguación "Tenés dos "Juan". ¿A cuál le cobro?" + chips "Juan Pérez"/"Juan Gómez" → asistente "Listo. Preparé el cobro a **Juan Pérez**. Revisá el monto antes de confirmar." → **HITL Cobro** (Juan Pérez, $15.000, "Sesión de asesoría · hoy") → mensaje usuario "Agendá con María el jueves 15hs" → **HITL Agenda** (María González, Jue 10 jul 15:00–16:00, Google Meet) → mensaje usuario "Publicá la promo en Instagram" → **HITL Publicar/Instagram** (preview "−20% primera sesión", "No se puede deshacer · queda público").
- Composer con placeholder "Escribile a tu copiloto…" (o el placeholder del modo activo).

### 3.2 Apps (bottom-sheet, no pantalla propia)
Título "Tus apps" + subtítulo "Elegí un modo para enfocar al copiloto". Filas: Cobrar/Mercado Pago · Agenda/Google Calendar · Mail/Gmail (badge "RECONECTAR") · Clientes/vía HubSpot · divisor · "Conectar más" / "Sumá otra app a tu copiloto".

### 3.3 Conexiones (mobile)
H1 "Conexiones" + "3 activas · 3 disponibles" + avatar. Grid 2 col × 3 filas: Cobrar/Mercado Pago (conectado) · Agenda/Google Calendar (conectado) · Mail/Gmail (reconectar) · Guardá tus clientes/vía HubSpot (conectado) · Archivos/Google Drive (sin conectar) · Publicar/Instagram (sin conectar).

### 3.4 Cuenta (mobile)
H1 "Cuenta" + avatar 58px "R" + "Rodrigo Fernández" + "rodrigo@estudio.com". Grupo 1: Plan → "Profesional" · Idioma → "Español (AR)" · Notificaciones → toggle (on). Grupo 2: "Privacidad del historial" · "Cerrar sesión" (rojo). Card final: "Tu copiloto sigue activo" (durabilidad, ver 2.9).

### 3.5 Overlay de grabación (voz)
Full-screen sobre cualquier pantalla, ver 2.10.

### 3.6 Chat + panel de instrumentos (desktop, `Copiloto - Cabina.dc.html`)
Layout de 3 columnas: rail (2.3) · columna de chat · aside "panel de instrumentos" (toggleable vía prop `contextPanel`).
- Sub-header de chat: "SESIÓN ACTIVA · sess_9f2a" (dot verde) + botón "Nueva conversación".
- Mensajes: divisor de fecha "Hoy · 14:30" → saludo del asistente "Hola 👋 Decime qué necesitás y lo hago. Antes de tocar nada —cobrar, agendar, mandar un mail— siempre te pido que confirmes." → usuario "Cobrale $15.000 a Juan por la consulta" → asistente "Listo, generé el link de cobro. 👇" + **card Cobro ejecutado** (badge verde "Ejecutado", monto "$15.000 ARS", "Juan Pérez · Consulta", link copiable "mpago.la/2xK9dQ" + botón Copiar/Copiado, footer "Link activo · vence en 7 días · 14:32") → usuario "Agendame una reunión con Juan el jueves a las 15" → asistente "Preparé el evento. Revisá y confirmá cuando quieras." + **card Agenda** con 3 estados (ver 2.6).
- Composer: pills "💵 Cobrar" / "📅 Agendar" / "✉️ Mandar un mail" + textarea + footer de shortcuts.
- Panel: hero de presencia (2.9) → "Conexiones · 3/4" + link "Ver todas" + lista de 4 filas → card "Última acción" ("Link de cobro generado", "$15.000 · Juan Pérez · 14:32").

### 3.7 Ausencias verificadas
No existe pantalla de **login/onboarding** en ninguno de los 3 `.dc.html` (grep de "login"/"contraseña"/"iniciar sesión" = 0 matches en los 3 archivos de diseño). Hay una carpeta `uploads/` adyacente con specs textuales de login (fuera del alcance de esta extracción de diseño — son handoff docs, no mockups) que sí exige campos email+contraseña, "olvidé mi contraseña", estado "cuenta no habilitada" — **ninguno de esos estados tiene mockup visual** todavía.

---

## 4. Modelo de navegación

**Mobile (tab-bar, 4 ítems fijos): Chat · Apps · Conexiones · Cuenta.**
**Desktop (rail, `Cabina`): Chat · Conexiones (badge contador) · [Próximamente: Caja, Agenda, deshabilitados] · Cuenta.**

Reconciliación:

- **Chat, Conexiones y Cuenta** son 1:1 entre mobile y desktop — misma función, distinta chrome.
- **"Apps" (mobile) NO tiene equivalente directo en el rail desktop.** En desktop, la relación con conexiones/servicios ya está siempre visible en el panel de instrumentos (aside), sin necesidad de un picker modal — el diseño asume que en desktop hay espacio para mostrar todo permanentemente, mientras que mobile necesita "esconder" el picker de modos detrás de un sheet.
- **"Apps" no es lo mismo que "Conexiones".** Conexiones = pantalla completa con **6** integraciones y su estado de conexión (conectar/reconectar). Apps (sheet) = subconjunto de **4** integraciones presentadas como "modos de foco conversacional" (excluye Drive e Instagram, que son acciones de archivo/publicación, no "modos" de charla). La barra de modos que pedía el brief original **no existe como barra persistente**: existe como bottom-sheet + efecto lateral en el placeholder del composer + badge-dot en el ícono "Apps".
- **Caja y Agenda** (rail desktop, "Próximamente") no tienen ningún rastro en mobile — ni placeholder, ni item deshabilitado en el tab-bar. Si van a mobile, hay que decidir dónde entran (¿5º tab? ¿dentro de Cuenta? ¿dentro de Apps junto a los otros "modos"?) — no está resuelto por el diseño.
- **Responsive real:** no hay un único archivo que maneje ambos breakpoints — son dos diseños construidos por separado (`App` = mobile-only 384×812 fijo; `Cabina` = desktop-only 1440×900 fijo con prop `contextPanel` para ocultar el aside, ningún otro breakpoint intermedio contemplado). El rebuild en React necesita diseñar la transición mobile↔desktop desde cero (no hay breakpoints de por medio en el export).
- **Numérico inconsistente:** el header mobile de Conexiones dice "3 activas · 3 disponibles" (=6 total), el rail desktop dice "3/8" (=8 total), y el panel de instrumentos de Cabina solo lista 4 (`hint-placeholder-count="4"`, un placeholder de docs, no un dato real). Ningún archivo tiene una fuente de verdad única para "cuántas integraciones hay" — al implementar, ese contador debe derivarse de datos reales, no copiarse de ningún mock.

---

## 5. Desviaciones a marcar

| # | Desviación | Evidencia | Implicancia de implementación |
|---|---|---|---|
| 1 | **Voz/mic activo** (grabación, waveform, lock-to-send, deslizar para fijar) | `Copiloto App.dc.html` líneas 186–188 (botón mic) + 272–306 (overlay completo) + `micDown/stopRec/sendRec` en el `Component` | No es "texto-only". Requiere permisos de micrófono, grabación real (MediaRecorder API o similar), transcripción (STT) o envío de audio, y UI de gesto press-hold-drag (no trivial en web — verificar soporte de Pointer Events + prevención de scroll nativo del navegador en mobile). El mock **no resuelve** qué pasa al soltar sin lock (¿envía o cancela? el código solo limpia estado) — decisión de producto pendiente antes de codear. |
| 2 | **Tab "Apps" como concepto nuevo** (picker de "modos" de foco conversacional, no una pantalla de contenido en sí) | §2.4, §4 | No es un simple "Home/Settings". Es un sheet modal que muta el placeholder del composer y setea un `activeMode` en el estado global de la conversación — el rebuild necesita un state store (Context/Zustand/etc.) que el composer, el tab-bar (badge dot) y el sheet compartan. |
| 3 | **4 temas visuales completos** (no solo dark/light) | Bloque `themes` completo en `Copiloto App.dc.html:545-647`, persistido en `localStorage` | 4× el volumen de CSS custom properties a mantener + testear contraste en cada uno (regla del proyecto: "gate visual multi-tema + tokens, no literales de color" — aplica directo acá). Pendiente de decisión de producto: ¿el usuario final elige entre los 4, o son exploraciones de diseño de las que hay que elegir UNA antes de construir? El control de selección hoy vive fuera del frame de la app (chrome de documentación), no dentro de Cuenta. |
| 4 | **Dos sistemas de diseño no reconciliados** (App/Direcciones vs. Cabina) | §0 | Bricolage Grotesque+Hanken Grotesk+ámbar (Cabina) vs. Clash Display+General Sans+violeta/azul (App). Si desktop y mobile deben compartir un único design system, hay que elegir uno y re-implementar el otro — no son variantes responsive del mismo sistema, son direcciones distintas. |
| 5 | **Header de marca del Chat ausente en el archivo fuente actual pero presente en TODOS los screenshots** | Grep de "Copiloto"/"en línea"/"durable"/"ES-AR" en `Copiloto App.dc.html` = 0 matches; el mismo header SÍ existe en `Copiloto - Direcciones.dc.html` (líneas 60-75, 152-166, 239-252) y se ve en `01-modos.png`, `02-modos.png`, `tema-ai*.png`, `daylight-top.png` | El archivo "final" (`App.dc.html`) parece haber perdido el header de marca de la pantalla Chat en algún punto de la edición (Conexiones y Cuenta sí lo retienen, en su variante simple). Antes de implementar, confirmar con quien exportó el diseño si es un corte intencional (más espacio para mensajes) o una regresión — no asumir ninguna de las dos. |
| 6 | **Tokens y valores calculados sin consumir** (`--mp-*` en los 4 temas, `activeChipLabel` en `renderVals()`) | `grep var(--mp-` = 0 matches; `activeChipLabel` no aparece en ningún nodo del markup | Señal de que el mock tuvo una iteración de diseño de "chip de modo activo visible en el header de chat" que se abandonó a mitad de camino. Al portar a React, no arrastrar los tokens/estado muertos sin decidir si se retoma esa idea (mostrar qué modo está activo en algún lugar visible del chat, no solo como badge-dot en el tab-bar). |
| 7 | **Animación `floaty` declarada y no aplicada** en el archivo final | §1.6 | Mismo patrón que el header ausente: la versión "de exploración" (`Direcciones.dc.html`) tenía más polish (card HITL flotando suavemente) que la "final" (`App.dc.html`). Sugiere que la consolidación de Direcciones→App perdió detalles de motion — revisar si fue deliberado. |
| 8 | **Ambigüedad de interacción del mic sin lock** | Código de `micDown`/`up` en `Component` (líneas 501-522) | Falta un test/definición explícita de qué pasa si el usuario suelta el dedo antes de los 46px de threshold sin haber deslizado hacia arriba — hoy el código llama `stopRec()` (limpia estado, no envía ni marca error). Definir el contrato antes de implementar el gesto real. |
| 9 | **No hay pantalla de login/onboarding** en el export visual, aunque existe una spec textual aparte (`uploads/2026-07-03-cliente-web-mobile-design-handoff.md`) que la exige con varios estados (error credenciales, red, "cuenta no habilitada") | §3.7 | Falta diseño visual de un flujo crítico (primer contacto del usuario). No bloquea el rebuild del resto de la app, pero si el login se construye sin mockup, no va a heredar el lenguaje visual de los 4 temas — riesgo de que quede genérico/desalineado. |

---

**Resumen de archivos fuente:** `Copiloto App.dc.html` (4 temas, app completa) · `Copiloto - Cabina.dc.html` (dirección desktop, 2 temas, NO reconciliada) · `Copiloto - Direcciones.dc.html` (exploración previa de 3 temas, precursor de App) · `support.js` (motor de render, sin tokens de diseño) · 13 screenshots (grounding visual, mayormente tema AI + daylight).
