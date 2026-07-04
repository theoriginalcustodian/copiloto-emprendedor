# Cliente Web/Móvil del Copiloto — Cierre + Handoff

> **Estado:** app **VIVA + instalable + E2E-validada** en `https://copiloto.178-105-191-1.sslip.io`.
> **Rama:** `feat/copiloto-cliente-web` (off `feat/copiloto-deploy-multitenant`). **Fecha:** 2026-07-04.
> Una sola app **responsive**: en el celu es una PWA mobile (tab-bar), en la compu es la versión web (rail lateral). Mismo código, mismo deploy.

## 📲 Cómo instalarla en tu móvil

Abrí **`https://copiloto.178-105-191-1.sslip.io`** en el navegador del teléfono y:

- **Android (Chrome):** menú (⋮) → **"Instalar aplicación"** / "Agregar a la pantalla principal". Queda con ícono propio (el orbe azul) y abre a pantalla completa.
- **iPhone (Safari):** botón **Compartir** (□↑) → **"Agregar a inicio"**. Ídem.

Una vez instalada, se comporta como una app nativa (ícono, splash, pantalla completa). Se actualiza sola cuando redeployamos.

> Si ves una versión vieja tras un redeploy: cerrala y reabrila (el service worker se auto-actualiza en la 2ª carga).

## 🔑 Para entrar

- La app usa **login real** (email + contraseña, JWT de Supabase/GoTrue en fusion).
- Hay un **tenant de prueba** para que la pruebes ya: `e2e-web-cliente@uc.local` (contraseña en el canal seguro, NO en repo). Es de prueba — para tu cuenta real, damos de alta tu email con el onboarding admin-mediado (`/auth/signup`).

## ✅ Qué está hecho y validado E2E (en vivo, browser real)

| Módulo | Estado |
|---|---|
| **Login** (real, JWT) | ✅ E2E: entra al chat |
| **Chat** (agente durable Temporal) | ✅ E2E: mensaje → agente responde y renderiza (burbujas, ✓✓) |
| **Voz** (mic + gesto WhatsApp → `/chat/audio` → GroqSTT) | ✅ E2E: audio real transcrito (Groq 200) y dispatchado al agente |
| **Conexiones** (8 servicios data-driven de `/catalog`) | ✅ E2E: grilla por categoría + botón "Conectar" → **URL OAuth real** (MercadoPago, Composio) |
| **Cuenta** (perfil + selector 4 temas + durabilidad + logout) | ✅ E2E: cambio de tema persiste |
| **Modos** (barra de modos por servicio) | ✅ frontend (envía `mode` en cada mensaje) |
| **Shell web/desktop** (rail 72↔244, Space Grotesk/Manrope) | ✅ E2E: reactivo desktop↔mobile en 900px |
| **PWA instalable** (manifest, íconos de marca, SW) | ✅ íconos PNG reales, `standalone`, lang es-AR |
| **4 temas** (aurora/amanecer/refinado/ia) | ✅ gate **AA de contraste** verde en los 4 |
| **Tests** | 362 frontend (vitest) + backend en VPS (catalog/login/audio/spa-mount) |

## 🙋 Lo único que falta hacerlo VOS (operator-in-the-loop)

- **Autorizar cada servicio**: la app deja todo listo, pero el clic final del OAuth de cada servicio (MercadoPago, Gmail, Calendar, etc.) lo hacés vos desde **Conexiones → Conectar**. No lo puedo/debo hacer por vos.

## 🧾 Deuda gestionada (deliberada, visible, con dueño) — no invisible, no impaga

1. **Scoping de modos en backend = DIFERIDO (MAYOR).** La barra de modos hoy funciona como *discoverability* (envía `mode`). Que el backend *enfoque* el prompt por modo toca el **motor conversacional compartido** (blast radius al agente clínica) → es un cambio MAYOR a escalar aparte, no un atajo. El doc de modos lo permite explícitamente.
2. **Desviación AA del diseño verbatim.** 6 tokens de texto *muted* de los temas **daylight** y **refined** estaban por debajo de 4.5:1 (medido) → los oscurecí/aclaré lo mínimo para cumplir accesibilidad. Se apartan del pixel-exact del diseño. Si preferís pixel-exact sobre AA, se revierten (están marcados en `themes.css` + los bloquea `themesContrast.test.ts`).
3. **Estado "Reconectar"** de las tarjetas de conexión: existe en la UI pero el backend aún no emite señal de token-a-reconectar → se activará cuando la emita.
4. **Botón "Salir" redundante** en el header del Chat (quedó de una fase previa; ahora el logout vive en Cuenta) → cosmético, sacar en un pulido.
5. **Tenant de prueba** `e2e-web-cliente@uc.local` en la DB viva → limpiar en el cleanup pre-prod (junto con los del sprint deploy).
6. **Voz con silencio** → Whisper alucina "Gracias." (comportamiento conocido del modelo con audio sin habla); con habla real transcribe bien.

## 🔍 Review adversarial final (opus) — APPROVE WITH FIXES, 0 CRITICAL

Verificado sólido: aislamiento cross-tenant en las rutas nuevas (`/catalog`, `/chat/audio` gatean por JWT; el `session_id` del cliente nunca lee otra tenant), guard de path-traversal del SPA correcto, sin secretos filtrados/commiteados, orden de rutas correcto.

**Fixeados en esta rama (los 2 HIGH + el MEDIUM):**
- ✅ **`/chat/audio` cap de 25 MB** — evita OOM del front-door compartido por un upload gigante autenticado (`fd8c4a4`).
- ✅ **`MicButton` cleanup de desmontaje** — el mic ya no queda grabando (privacidad) ni filtra el timer al cambiar de tab/cruzar breakpoint.
- ✅ **`useChat` rehidrata** la conversación (persistencia + poll al montar) — no se pierde el chat al cambiar de tab; honra la durabilidad.

**Decisiones que quedan para vos (no las tomo solo):**
- ⚠️ **`/auth/signup` está SIN autenticación y ahora es público** (pre-existente de la base, pero esta rama monta la SPA + el vhost `copiloto.*` → lo vuelve internet-facing). Usa la admin-API con `service_role`, que **bypassa** `disable_signup` → cualquiera que alcance el front-door puede spamear altas de tenant/usuario. **Antes del go-live amplio, decidí un gate** (token de invitación / basic-auth / allowlist de emails). Hoy el riesgo es bajo (tráfico solo tuyo), pero es una exposición real.
- **Rate-limiting en `/auth/login`** (fuerza bruta/enumeración): conviene un throttle a nivel Caddy o app. No filtra el error de GoTrue (traduce a 401 genérico, eso está bien).
- **Hygiene menor:** el comentario de "colisión" en `sync-web.sh` quedó desactualizado (deploy.sh ya la resolvió); `npm install`→`npm ci` daría builds reproducibles ahora que hay lockfile.

## 🚀 Deploy / operación

- **Un solo path:** `bash deploy/copiloto/deploy.sh` (desde la PC) → sincroniza worktree → VPS, buildea el frontend (fetch-fonts + npm + vite), sourcea JWT + GROQ server-side, reinicia `uc-copiloto-web`. Idempotente.
- La PWA se sirve **mismo-origen** por el front-door FastAPI (`_mount_spa`) → sin CORS.

## 🩹 Corrección de fidelidad móvil (2026-07-04, commit `190847d`)

> **Honestidad:** este cierre había declarado el móvil "E2E-validado" cuando en realidad **nunca se corrió un gate visual en viewport de celu contra los screenshots del diseño** — se gateó *función* (login/chat/voz-dispatch), no *fidelidad*. El operador reportó los defectos y se corrigieron de raíz + **se verificó con Playwright a 390px sobre el VPS** (la disciplina que faltaba). Causa raíz común: íconos como emoji (el glifo `▦` de Apps renderizaba más chico) y el overlay de grabación atrapado por el `backdrop-filter` del composer (containing-block trap de `position:fixed`).

**Defectos reportados — arreglados + verificados en vivo:**
- **Mic** a la izquierda → a la **derecha** del composer (`[texto][mic][enviar]`), SVG del diseño.
- **Tab-bar** con emoji (Apps más chico) → **4 íconos SVG** del diseño (`navIcons`), mismo tamaño.
- **Voz** (ventanita, sin waveform/cancelar) → **overlay full-screen por PORTAL a `<body>`** + waveform SVG real (gradiente + 6 curvas) + timer + hint + locked.
- **Skins**: el switcher **funciona** (verificado ai→daylight→aurora en vivo, persiste). El "no cambian" del operador fue **service-worker cacheado** (build viejo) — no había bug de código. Fix operativo: cerrar/reabrir la PWA tras redeploy limpia el SW.
- **Hide-on-scroll** (EXTRACT §2.3): estaba omitido a propósito → **implementado** (tab-bar overlay desliza + clearance del contenido animado = mirror del composer).
- **Placeholder** "Escribí tu mensaje…" → "Escribile a tu copiloto…".

**Barrido de fidelidad (subagentes con ownership exclusiva):**
- **Conexiones**: lista 1-col agrupada por categoría con marcas-letra → **grilla 2-col con íconos de marca** (`ServiceIcon`) + cards compactas.
- **Apps**: "Apps" + genérico → "Tus apps" + íconos de marca + "Salir del modo" + "Conectar más".
- **HITL card**: íconos emoji → íconos de marca (MP/Calendar/Instagram) + ícono de alerta en irreversible.
- **Chat header**: botón "Salir" redundante **removido** (resuelve deuda #4 de arriba; logout vive en Cuenta).
- Nuevos sets SVG compartidos `design-system/{serviceIcons,navIcons}.tsx` (verbatim del diseño, fuera del gate no-hex).

**Verificación:** build + **374 tests** verdes (49 files, +5 de la wave) · gate visual Playwright 390px en ai/daylight/aurora + Conexiones + Apps.

**Deuda nueva (visible):**
- **Apps = pantalla vs bottom-sheet**: el diseño abre "Tus apps" como bottom-sheet sobre el chat; hoy es pantalla propia (tab). Convertirlo cambia la navegación → **decisión del operador**, no se tocó unilateralmente.
- **Tenant desechable** `vgate@uc.local` creado para el gate visual → limpiar en el cleanup pre-prod (junto con `e2e-web-cliente@uc.local`).
- `googledocs`/`googlesheets` caen a marca-letra (no están entre los 6 íconos de marca del diseño) — degradación correcta, no bug.
