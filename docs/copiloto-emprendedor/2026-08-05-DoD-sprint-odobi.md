# Sprint ODOBI — especificación E2E y DoD

> **Fecha:** 2026-08-05 · **De:** sesión PLANIFICACIÓN · **Para:** frontend (implementa) + backend (device).
> **Qué es:** la especificación completa del rebrand visual, de punta a punta, con los valores exactos
> extraídos del diseño y un DoD binario por hito. Nadie tiene que abrir Claude Design para implementar:
> todo lo que hace falta está acá.
> **Estado del sprint:** aprobado por el operador el 2026-08-05.

---

## §0 Reutilización — el inventario va ANTES del diseño

Regla dura del repo. Todo lo que sigue se **extiende**, no se inventa:

| Ya existe | Path | Qué se hace con eso |
|---|---|---|
| Tokens de mobile (5 skins) | `apps/mobile/src/theme/tokens.ts` (390 líneas) | Se **reemplazan las paletas**, se conserva `construirTokens` y el shape `color.*` que consumen ~20 componentes |
| Tokens de web (4 temas) | `apps/copiloto-web/src/design-system/themes.css` | Se reemplazan los bloques `:root[data-theme=...]` |
| Guard cero-hex | `apps/mobile/src/theme/temaSinHex.test.ts` | **Se conserva tal cual** — es lo que hace barato este sprint |
| Gate de contraste WCAG | `apps/copiloto-web/src/design-system/themesContrast.test.ts` | Se conserva; se re-corre contra las paletas nuevas |
| Simulación de `inset` shadow | `CristalVidrio.tsx:183` (`luzSuperior`, View de 1.5px) | **Se reusa** — RN no tiene `inset`, y esto ya lo resuelve |
| Aplanado de rgba sobre fondo | `CristalVidrio.tsx` (aplana `bd` sobre `fondoBase`) | Se reusa la técnica para las superficies de Mariposas |
| Descarga de fuentes self-hosted | `deploy/copiloto/fetch-fonts.sh` | Se extiende con NeueEinstellung; hoy baja Clash/General Sans/JetBrains |
| Catálogo de skins | `apps/mobile/src/modules/ajustes/skinsCatalogo.ts` | Se reduce de 5 entradas a 3 |
| Selector de tema en web | `AccountScreen.tsx` + `ThemeProvider.tsx` | Se reduce de 4 a 3 |

**Medición que define el costo real del sprint** (corrida el 2026-08-05, no estimada): de 266 literales
hex en `apps/copiloto-web/src`, **266 viven en `themes.css` / `serviceIcons.tsx` / `global.css`** —
cero en los 44 componentes. En mobile, `temaSinHex.test.ts` lo garantiza por construcción. **Repintar
la app es tocar 2 archivos de tokens, no 121 componentes.**

---

## §1 Decisiones cerradas — no se re-litigan

1. **Identidad:** Odobi reemplaza la piel actual. Shell mobile **1a** (panel deslizable), shell web
   **1c** (dos paneles) — ambos ya confirmados en el proyecto de diseño, y ambos son el shell que la
   app YA tiene. **Este sprint no cambia estructura, sólo piel.**
2. **Tres skins, un solo acento:** Claro (default) · Oscuro · Nocturno. Se van `cian`/`violeta`/
   `ambar`/`medicalWhite` (mobile) y `aurora`/`daylight`/`refined`/`ai` (web). *Racional: el brief
   exige acento único ≤10% de superficie; 5 acentos cromáticos distintos rompen la identidad por
   construcción. Se conserva variedad de **lienzo**, se unifica el **acento**.*
3. **Sin glass, color pleno + relieve.** Las superficies translúcidas de Mariposas se **aplanan**
   (§2.3). Justificación medida: en Mariposas el `backdrop-filter` no tiene nada que desenfocar (el
   fondo es color plano), y en la app el `BlurView` **nunca desenfocó en Android** (documentado en
   `CristalVidrio.tsx:8`). Aplanar no pierde efecto: elimina un no-op caro.
4. **Gana la paleta de Mariposas, no la del brief.** El brief marcó su propia terracota `#DE7250`
   como ❌ 2.86:1 sobre crema; Mariposas ya lo corrigió con `#C2452E`. El brief es la intención,
   Mariposas la intención resuelta contra contraste.
5. **Rename sólo visible.** `app.json` `slug`/`scheme` **no se tocan** — el scheme `copiloto` es el
   deep-link del OAuth y del dev-client instalado; cambiarlo obliga a rebuild EAS y puede romper el
   login Google recién cerrado (BETA-4b).
6. **Símbolo diferido.** Los hitos 1-6 no dependen del isotipo. El hito 7 está gateado por la elección
   del operador entre las 10 variantes de la familia v2.

---

## §2 El sistema de diseño — valores exactos extraídos

> Fuente: `Odobi Mobile Mariposas.dc.html` (70 KB) y `Odobi Web Mariposas.dc.html` (40 KB), leídos
> completos el 2026-08-05. Los valores de abajo son **verbatim del diseño**, no interpretaciones.

### 2.1 Paleta — tema CLARO

| Rol | Valor | Uso |
|---|---|---|
| Lienzo de página | `#EFE6D2` | `body` |
| Marco exterior | `linear-gradient(160deg,#F7EFDD,#D9C7A2)` | borde de 3px del shell |
| Fondo del shell | `linear-gradient(150deg,#F7ECD5 0%,#EFE1C2 60%,#E8D6B0 100%)` | lienzo interno |
| Superficie (aplanada) | **`#F5EBD5`** | cards, burbujas, paneles — ver §2.3 |
| Borde de superficie | `rgba(255,252,244,.7)` | 1px |
| Texto principal | `#2E2A20` | |
| Texto secundario | `rgba(46,42,32,.55)` | nav inactivo, labels |
| Texto terciario | `rgba(46,42,32,.42)` | mono, placeholders |
| Texto en burbuja | `#4A4234` | |
| Acento (texto) | `#A5341F` | títulos mono, iconos activos |
| Acento (superficie) | `linear-gradient(150deg,#C2452E,#7E2417)` | botones, burbuja del usuario, FAB de voz |
| Acento sobre superficie chica | `linear-gradient(145deg,#C2452E,#8E2A1C)` | íconos de 24-26px |
| Acento confirmar | `linear-gradient(150deg,#C2452E,#94301F)` | botón primario |
| Texto sobre acento | `#FBF3E2` · `#FBEEE6` (burbuja) | |
| Borde fuerte | `rgba(46,42,32,.22)` | botón secundario |
| Borde de campo | `rgba(46,42,32,.12)` | inputs |
| Borde sutil / barra vacía | `rgba(46,42,32,.1)` | separadores, skeletons |
| Fondo de campo | `rgba(255,252,244,.6)` | inputs |
| Éxito | `#3C8069` (fondo `rgba(60,128,105,.3)`) | caja, montos positivos |
| Advertencia / ondas | `#C6952E` | barras del HUD de voz |
| Píldora activa | fondo `#2E2A20`, texto `#F3E9D5` | solapas de Mi día |
| Nav activo | `linear-gradient(150deg,rgba(194,69,46,.24),rgba(194,69,46,.1))` + `inset 0 1px 0 rgba(255,255,255,.15)` | |

### 2.2 Paleta — tema OSCURO

| Rol | Valor |
|---|---|
| Lienzo de página | `linear-gradient(180deg,#1E1610,#130C07)` |
| Marco exterior | `linear-gradient(160deg,#2A2015,#0C0805)` |
| Fondo del shell | `radial-gradient(120% 90% at 40% 0%,#231910,#120B06 72%)` |
| Superficie (aplanada) | **`#251B11`** |
| Borde de superficie | `rgba(241,228,204,.14)` |
| Texto principal | `#F1E4CC` |
| Texto secundario | `rgba(241,228,204,.55)` |
| Texto terciario | `rgba(241,228,204,.42)` |
| Texto en burbuja | `#D8C6A8` |
| Acento (texto) | `#E67A5E` |
| Acento (superficie) | **idéntico al claro** — `linear-gradient(150deg,#C2452E,#7E2417)` |
| Borde fuerte | `rgba(241,228,204,.22)` |
| Borde sutil | `rgba(241,228,204,.1)` |
| Fondo de campo | `rgba(20,13,8,.5)` → aplanado **`#0F0A06`** |
| Píldora activa | fondo `#F1E4CC`, texto `#241A12` |

**El acento no cambia entre claro y oscuro.** Es lo que sostiene la identidad: el terracota es el
mismo en las tres pieles.

### 2.3 Aplanado de superficies — la regla, no el caso

Mariposas declara superficies como `rgba(...)` sobre un fondo. Como este sprint va sin translucidez,
cada superficie se **compone alfa** contra su fondo real y se guarda como color pleno:

```
plena = rgba.color × rgba.alpha + fondo × (1 − rgba.alpha)
```

| Superficie | Declarada | Fondo | **Aplanada** |
|---|---|---|---|
| Card / burbuja (claro) | `rgba(250,245,232,.5)` | `#EFE1C2` | **`#F5EBD5`** |
| Card / burbuja (oscuro) | `rgba(46,35,25,.5)` | `#1B1209` | **`#251B11`** |
| Campo (claro) | `rgba(255,252,244,.6)` | `#F5EBD5` | **`#FAF7EC`** |
| Campo (oscuro) | `rgba(20,13,8,.5)` | `#251B11` | **`#1B120B`** |

⚠️ **Los bordes y las sombras conservan su alpha.** Sólo se aplanan los **fondos de superficie** — un
borde `rgba(46,42,32,.22)` sobre superficies distintas debe seguir siendo semitransparente o pierde
su función. RN soporta alpha en `borderColor`; el problema era sólo el `backdrop-filter`.

### 2.4 Los 5 niveles de relieve — el corazón del sprint

Idénticos en mobile y web. Cada nivel = **luz interna superior + sombra proyectada**. La sombra en
claro es **cálida (marrón), nunca negra** — ese es el detalle que hace que la superficie se levante en
vez de verse sucia.

| Nivel | Claro | Oscuro |
|---|---|---|
| **1 · Superficie en reposo** (cards, burbujas, paneles) | `inset 0 1px 1px rgba(255,255,255,.7)` + `0 10px 26px -12px rgba(110,75,44,.3)` | `inset 0 1px 0 rgba(241,228,204,.1)` + `0 12px 28px -12px rgba(0,0,0,.6)` |
| **2 · Elemento chico** (chips, tiles del escritorio) | `inset 0 1px 1px rgba(255,255,255,.35)` + `0 3px 8px rgba(70,50,30,.32)` | idem con `rgba(241,228,204,.1)` / `rgba(0,0,0,.5)` |
| **3 · Acento elevado** (botón primario, FAB de voz) | `inset 0 2px 3px rgba(255,255,255,.35)` + `0 10px 26px -6px rgba(126,36,23,.5)` | **idéntico** |
| **4 · Flotante** (shell, modal, bottom sheet) | `0 30px 60px -20px rgba(110,75,44,.4)` · shell web `0 34px 70px -24px rgba(110,75,44,.4)` | `0 30px 60px -20px rgba(0,0,0,.7)` · shell `-24px rgba(0,0,0,.72)` |
| **5 · Foco / grabando** (ring del mic activo) | `0 0 0 6px rgba(194,69,46,.16)` | **idéntico** |

Sombras auxiliares del acento: burbuja del usuario `0 10px 22px -8px rgba(126,36,23,.4)` · botón
chico `0 6px 14px -3px rgba(126,36,23,.5)` · mic 46px `0 8px 18px -4px rgba(126,36,23,.5)`.

**En React Native:** el nivel se expresa como `{shadowColor, shadowOffset, shadowRadius, shadowOpacity,
elevation}` en el contenedor externo (sin `overflow:hidden`) + la `luzSuperior` ya existente
(`CristalVidrio.tsx:183`) para el `inset`. **El `shadowColor` cálido en Android es el objeto del spike
del hito 0.**

### 2.5 Radios

| Token | Valor | Uso |
|---|---|---|
| `marco` | 22 / 19 px | shell exterior / interior |
| `card` | 16 px | cards, paneles, burbujas |
| `cardChica` | 13-14 px | card anidada |
| `composer` | 21 px | barra de escritura (h 42) |
| `boton` | 9-10 px | botones, filas de nav |
| `campo` | 6 px | inputs |
| `chip` | 8 px | íconos cuadrados 24-26px |
| `pildora` | 999 px | solapas |
| `circulo` | 50% | avatares, FAB, logo |

Burbujas con esquina de cola: `16px 16px 16px 5px` (recibida) · `16px 16px 5px 16px` (enviada).

### 2.6 Tipografía

| Rol | Familia | Pesos | Tamaños |
|---|---|---|---|
| **Display / marca** | **NeueEinstellung Bold** | 700 | H1 32px, wordmark 16-17px |
| Cuerpo / UI | **Inter** | 400 / 500 / 600 / 700 | 10-16px |
| Mono / label técnico | **JetBrains Mono** | 500 / 600 | 7-11px, uppercase, `letter-spacing .1em-.2em` |

Archivos: `docs/Imagen de marca/Neue_Einstellung/*.otf` — 9 pesos, licencia adquirida. Para el sprint
alcanza **Bold**; el resto queda disponible. ⚠️ Los nombres traen espacios y el prefijo
`Hanken Design Co - `: renombrar a `NeueEinstellung-Bold.otf` al copiarlos a assets.

*Mariposas usa Inter 700 como wordmark porque el diseño se hizo sin la fuente a mano. Acá entra la
real — es la decisión (a) del doc de investigación §7.2.*

### 2.7 Iconografía

SVG `viewBox="0 0 24 24"`, `fill:none`, `stroke:currentColor`, `stroke-width:1.7`, `linecap`/
`linejoin` `round`. 21 íconos de función ya diseñados en `Iconos Odobi.dc.html` (estructuralmente
completo, con prueba de escala a 16px declarada como condición de aprobación).

### 2.8 Skin NOCTURNO — derivado, no extraído

**No existe en Mariposas** (que trae sólo claro y oscuro). Se deriva del oscuro llevando el lienzo a
monocromo profundo y conservando el acento terracota intacto:

| Rol | Valor |
|---|---|
| Lienzo | `#0C0805` plano (sin gradiente radial) |
| Superficie | `#141009` |
| Borde | `rgba(241,228,204,.10)` |
| Texto | `#F1E4CC` (idéntico al oscuro) |
| Acento | **idéntico** — `#C2452E` / `#E67A5E` |
| Relieve | nivel 1-2 con `rgba(0,0,0,.75)`, sin luz interna cálida |

`[ASSUMED_PENDING_VERIFY]` — es una derivación de planificación, no un diseño aprobado. Si al verlo en
device no convence, se ajusta o se descarta sin bloquear el sprint (los otros dos son los que importan).

---

## §3 Los hitos — DoD binario

> Regla: un hito no cierra sin evidencia. Mobile → device real (dueño: backend). Web → Playwright
> contra el sitio desplegado. Verde en jsdom/vitest **no** es evidencia de nada táctil.

### Hito 0 — Spike de la sombra cálida 🔴 BLOQUEA TODO

**Por qué existe:** `CristalVidrio.tsx:16` documenta que RN no tiene `box-shadow` múltiple ni `inset`.
En Android la sombra la genera el sistema vía `elevation`. Si `shadowColor` no se respeta, el relieve
sale **gris** y toda la calidez de Odobi se cae — que es exactamente lo que el operador pidió que se vea.

**Qué se hace:** una pantalla desechable (`spikes/odobi-relieve/`) con los 5 niveles de §2.4 sobre el
lienzo claro `#EFE1C2`, más un control: la misma card con `shadowColor: '#000'`.

**DoD — criterio falsable, escrito antes de correr:**
- [ ] En device Android real, la sombra del nivel 1 se ve **marrón cálida**, distinguible del control negro en la captura.
- [ ] El `inset` de luz superior se lee como borde claro de 1-1.5px (vía `luzSuperior`).
- [ ] Los 5 niveles son **visualmente distinguibles entre sí** (una card en reposo no se ve igual que un botón acento).
- [ ] Captura adjunta con los 6 casos (5 niveles + control) en una sola pantalla.

**Si falla:** no se repinta nada hasta resolverlo. Alternativas en orden: (a) `react-native-shadow-2`
o equivalente, (b) sombra pintada como capa de gradiente bajo la card, (c) renunciar al tono cálido en
Android y documentarlo como diferencia de plataforma. **La elección entre (a)/(b)/(c) es MAYOR** —
vuelve a planificación, no la toma frontend sola.

**Dueño:** frontend escribe · **backend corre en device** (dueño único del teléfono).

---

### Hito 1 — Tokens de las 3 pieles

**Mobile** (`apps/mobile/src/theme/tokens.ts`): `PALETAS` pasa de 5 entradas a 3 (`claro`, `oscuro`,
`nocturno`) con los valores de §2.1/§2.2/§2.8 aplanados según §2.3. `NombreSkin` cambia de tipo.
`construirTokens` y el shape `color.*` **no se tocan**.
**Web** (`themes.css`): los 4 bloques `:root[data-theme=...]` pasan a 3, con los **mismos valores**.

**DoD:**
- [ ] `temaSinHex.test.ts` verde — cero hex fuera de los 3 archivos autorizados.
- [ ] `themesContrast.test.ts` verde para las 3 pieles (WCAG AA ≥4.5:1 en tokens de texto).
- [ ] `skinsCatalogo.ts` y el selector de `AccountScreen` listan 3, no 5/4.
- [ ] Los valores de mobile y web son **idénticos** — un diff de los hex de ambos archivos da 0 diferencias.
- [ ] Suite completa de mobile y web verde, sin regresiones.

---

### Hito 2 — El relieve como token

`CristalVidrio` deja de apilar `LinearGradient` de tinte y pasa a **color pleno + los 5 niveles** de
§2.4, expuestos como tokens (`relieve.nivel1..5`), no hardcodeados por variante.
Se borran: los 12 `backdrop-filter` de web, y `expo-blur` de `package.json` si queda sin consumidores.

**DoD:**
- [ ] `grep -c backdrop-filter apps/copiloto-web/src` → **0**.
- [ ] `grep -rn "expo-blur" apps/mobile` → sólo el `package.json` si aún lo usa algo; si no, removido.
- [ ] Los 5 niveles viven en un solo lugar y `CristalVidrio` los consume por nombre.
- [ ] E2E en device: escritorio, chat y una card de confirmación **con relieve visible** (captura).
- [ ] Playwright: las mismas 3 superficies en web, captura en claro y oscuro.

---

### Hito 3 — Tipografía

NeueEinstellung Bold (display) + Inter (UI) + JetBrains Mono (labels). `.otf` copiados y renombrados a
`apps/mobile/assets/fonts/`; convertidos a `.woff2` para web vía `fetch-fonts.sh` extendido.
Se retiran Space Grotesk (mobile) y Clash Display / General Sans (web).

**DoD:**
- [ ] `fetch-fonts.sh` es idempotente y baja/convierte NeueEinstellung — corrido en el VPS, no en la PC.
- [ ] Ningún `font-family` residual apunta a Space Grotesk / Clash / General Sans (grep = 0).
- [ ] Fallback de sistema declarado: la app renderiza legible si el `.woff2` todavía no está (`font-display: swap`).
- [ ] Device: H1 y wordmark en NeueEinstellung, cuerpo en Inter (captura).

---

### Hito 4 — Textos de marca

Lo visible: `LoginScreen` ("Copiloto del Emprendedor" → "Odobi" + descriptor "tu copiloto
emprendedor"), `ChatHeader`, `App.tsx`, placeholder del composer (`"Escribí, o hablá…"` — verbatim de
Mariposas), `app.json:name`.

**Caja de la marca, regla dura del brief:** siempre **"Odobi"** — mayúscula inicial, resto minúscula.
**Nunca "ODOBI"** en mayúsculas sostenidas, en ningún lugar, ni en labels mono con `text-transform:
uppercase`. Los labels mono que hoy van en uppercase **no pueden contener el nombre de la marca**.

**DoD:**
- [ ] `grep -rn "ODOBI" apps/ --include='*.tsx' --include='*.ts'` → 0 (fuera de constantes técnicas).
- [ ] `app.json`: `name` cambia; `slug` y `scheme` **intactos** — verificado por diff.
- [ ] Login y header muestran "Odobi" en device y en web.
- [ ] El deep-link de OAuth sigue funcionando (control positivo: un login Google real post-cambio).

---

### Hito 5 — Íconos de función

Los 21 SVG de `Iconos Odobi.dc.html` reemplazan la iconografía actual en `icons.ts` (mobile) y
`navIcons.tsx` (web), con el canon de §2.7. `iconPalette.ts` (8 paletas fijas de íconos glass) se
revisa: **si sus colores intrínsecos chocan con el acento único, se unifican a terracota** — decisión
de frontend, declarada en el PR.

**DoD:**
- [ ] Los 21 íconos presentes y mapeados a sus pantallas reales.
- [ ] Legibles a 16px (condición de aprobación declarada por el propio archivo de diseño).
- [ ] Ningún ícono de función introduce un color fuera de la paleta de §2.1.

---

### Hito 6 — E2E completo y deploy

**DoD:**
- [ ] Deploy real: `deploy.sh` + `sync-web.sh` corridos, smoke 7/7.
- [ ] `curl` contra el sitio vivo confirma el bundle nuevo servido (no cacheado, no asumido).
- [ ] Playwright contra el sitio real: los 13 módulos en las 3 pieles, 0 errores de consola reales.
- [ ] Device: recorrido de las pantallas principales en las 3 pieles, capturas adjuntas.
- [ ] `cierre_` al buzón con la evidencia, no con la autoevaluación.

---

### Hito 7 — 🔒 Símbolo y assets *(gateado por el operador)*

**Disparador: ✅ CUMPLIDO 2026-08-06.** El operador eligió, y **no fue ninguna de las candidatas que
este DoD listaba** — corregido acá para que nadie lo lea literal y exporte el símbolo equivocado
(ya pasó: el PR #284 salió con la 06 y hubo que rehacerlo).

**Fuente canónica: `Odobi Mobile Mariposas.dc.html`** (proyecto de Claude Design «Copiloto
emprendedor Odobi», `eb2c9e3f-453b-4886-a5fc-5b038942e1c5`, accesible por MCP — **no hace falta
pedirle el archivo al operador**). El símbolo es la **O concéntrica con dos ondas**, y es
**monocromo**: los 4 paths van en `currentColor`, el color lo pone el contenedor.

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">
  <path d="M11 3.5a8.5 8.5 0 1 0 0 17"/>    <!-- O exterior, abierta a la derecha -->
  <path d="M11 7.5a4.5 4.5 0 1 0 0 9"/>     <!-- O interior, concéntrica -->
  <path d="M16.5 8.8a4.8 4.8 0 0 1 0 6.4"/> <!-- onda 1 -->
  <path d="M19.5 6.5a9 9 0 0 1 0 11"/>      <!-- onda 2, más abierta -->
</svg>
```

⚠️ **`logoScale` — al exportar, compensá el trazo.** El mock escala el glifo × `k` (default **1.3**,
rango 0.8–2) y divide el `stroke-width` por la misma `k`, para que el trazo se vea igual de fino a
cualquier tamaño. Escalar el SVG sin dividir el trazo da un ícono más gordo que el diseño. Tamaños
base 20 / 22 / 34 px; el del botón de voz es el de 34.

**Paleta medida del archivo** (usar tokens del repo; esto es la fuente si falta alguno): botón
`linear-gradient(150deg,#C2452E,#7E2417)` · símbolo sobre el botón `#FBF3E2` · terracota oscuro
`#8E2A1C` · dorado `#C6952E`.

**El ecualizador reactivo a la voz NO entra en este hito.** Control corrido sobre el archivo: las 7
barras (`width:3px`, alturas 10–28px) son **estáticas**, y las únicas animaciones declaradas
(`odRadiate`, `odPulse`) no las tocan. Que se mueva con la voz es **scope nuevo sin diseño**, no un
detalle de implementación: pide nivel de audio en tiempo real (`swmansion-rn-audio`) y animación en
worklet (`swmansion-rn-animations`).

<details><summary>Texto original de este disparador (obsoleto, se conserva por trazabilidad)</summary>

> **Disparador:** el operador elige una variante de la familia **v2** ("O cerrada con la voz
> adentro"). Candidatas que el propio archivo declara aptas a 16px: **06 "Ecualizador mínimo"** o
> **10 "Denso"**.

</details>

Entregables: isotipo SVG (positivo, monocromo, negativo) · lockup horizontal y vertical · 10 PNGs
(`icon.png`, `adaptive-icon` fore/back/mono, `splash-icon`, `favicon`, `apple-touch-icon`,
`pwa-192`, `pwa-512`) · área de resguardo y tamaño mínimo.

**Restricción de contraste del brief, no negociable:** **no puede haber ícono con fondo terracota
pleno** (blanco sobre terracota da 3.17:1, falla AA). Válidos: terracota sobre negro tostado, negro
tostado sobre crema, o monocromo.

---

## §4 Riesgos y deuda declarada

| Riesgo | Mitigación |
|---|---|
| `shadowColor` cálido no soportado en Android | **Hito 0 lo mide antes de repintar.** Alternativas escritas; la elección es MAYOR |
| Service worker del PWA sirve el bundle viejo | Precedente conocido (M-WEB módulo 1). Limpiar caches antes del E2E; esperable en testers hasta que rote |
| El aplanado se ve más plano que el mockup | El relieve compensa. Si no alcanza, se ajusta el par superficie/fondo — no se reintroduce blur sin volver a planificación |
| Nocturno es derivación, no diseño | `[ASSUMED_PENDING_VERIFY]`. Se ajusta o descarta sin bloquear |
| Licencia de NeueEinstellung para web embedding | Verificar antes del hito 3. Si no cubre `@font-face`, cae a Inter 700 en web y NeueEinstellung sólo en mobile |

**Deuda que este sprint deja visible (deliberada, con dueño):**
- Los ~30 archivos de `theme/glass/` conservan el nombre "glass" aunque ya no haya vidrio. **Renombrar
  30 archivos es riesgo sin beneficio funcional** → se paga en el próximo sprint que toque esa carpeta.
  Dueño: frontend. Se agrega una nota en `canonGlass.ts` explicando el nombre histórico.
- `iconPalette.ts` / `ondaPalette.ts` siguen autorizados a tener hex. Si el hito 5 los unifica a
  terracota, evaluar si siguen justificando la excepción del guard.

## §5 Qué NO entra

Cambio de layout o de shell (1a y 1c ya son los actuales) · `slug`/`scheme`/bundle id · piezas
institucionales fuera de la app · animación del isotipo (deseable del brief, no requerido) ·
optimización de performance más allá de borrar el blur (medir FPS antes/después es **deseable** en el
hito 0, no un DoD) · backend (superficie verificada: nula).

## §6 Referencias

- Brief de identidad: `docs/Imagen de marca/ODOBI_Brief_Visual.md`
- Investigación del proyecto de diseño: `docs/Imagen de marca/2026-08-03-odobi-investigacion-completa-estado-y-pendientes.md`
- Handoff funcional (lo que el rebrand no puede romper): `docs/Imagen de marca/2026-07-23_handoff-diseno-nuevo-cascaron-mapa-funcional-completo.md`
- Proyecto de diseño vivo: `https://claude.ai/design/p/eb2c9e3f-453b-4886-a5fc-5b038942e1c5`
- Fuente: `docs/Imagen de marca/Neue_Einstellung/` (9 pesos `.otf`)
