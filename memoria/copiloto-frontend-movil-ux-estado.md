---
name: copiloto-frontend-movil-ux-estado
description: "Estado del frontend cliente móvil (PWA) del Copiloto tras el pulido de UX de gestos (PR #115 mergeado). LEER al retomar cualquier arreglo del frontend móvil: qué está vivo, arquitectura del chrome auto-hide, causa-raíz de las regresiones de gesto, decisiones abiertas y follow-ups."
metadata:
  node_type: memory
  type: project
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**Frontend cliente móvil (PWA) del Copiloto — UX de gestos PULIDA y MERGEADA a `main` (PR #115, 2026-07-04 18:17 UTC).** Rama `feat/copiloto-movil-ux` (worktree `uc-copiloto-web`), 5 commits (`d87eb2b` UX base · `ed810ff` sheet swipe + barra fija fuera de Chat · `2ff6358` anti-oscilación · `3eba236` hide-on-scroll con dedo · `8971f12` sin idle-hide). Gate **411 tests vitest + build OK**.

**Vivo en el VPS ya** (no re-deployar): servido por `uc-copiloto-web` (uvicorn front-door :8099) tras Caddy `copiloto.178-105-191-1.sslip.io`. **Deploy frontend = `bash deploy/copiloto/sync-web.sh`** (sincroniza SOLO `apps/copiloto-web`, buildea en el VPS, deja `dist/` fresco, **NO reinicia el worker** → no molesta la sesión paralela de memoria). NO usar `deploy.sh` para cambios solo-frontend (ese reinicia `uc-copiloto-worker`). Repo en VPS: `/opt/uc-repos/copiloto`. [[deploy-factory-code-vps]] [[apps-deploys-siempre-vps]]

**Stack:** React 18 + Vite 6 + TS + vitest. Mobile-first `AppShell` (<900px) + `DesktopShell` (≥900px) vía `ResponsiveShell`/`useBreakpoint`. PWA con `cleanupOutdatedCaches`; `sw.js` servido `no-cache`. Ojo staleness: deploy correcto ≠ el navegador lo tiene → [[pwa-sw-staleness-gotcha]].

**⚠️ LECCIÓN QUE COSTÓ 4 RONDAS — el gate no ve el touch.** vitest/**jsdom no modela** touch-action, pointer-capture, momentum ni resize real → **los bugs de gesto pasan el gate en verde y en el teléfono fallan**. Vení con eso en mente: un fix de gesto "verde" NO está verificado hasta verlo en device (o reproducirlo con Playwright + emulación móvil/touch). → [[gate-jsdom-no-ve-gestos-tactiles]].

**Arquitectura del chrome auto-hide (móvil):**
- `.app-shell__content` lleva `padding-bottom: 86px` **animado** (clearance de la tab-bar flotante). Al ocultar el chrome va a `0` → el composer se desliza al borde (mirror del diseño). `shell.css`.
- `TabBar` = overlay `position:absolute; bottom:18px`; `.tab-bar--hidden` = `translateY` fuera + `opacity:0` + **`pointer-events:none`**.
- `useChromeAutoHide` = show/hide **controlado** (`hidden`/`setHidden`/`toggle`), **SIN timer de inactividad** (se sacó en #115, ver abajo).
- `MessageList` dispara el hide-on-scroll y el tap-reveal; `useBackGuard` mapea el back de Android para pelar overlays (sheet → tab≠Chat) en vez de salir.
- `BottomSheet` (apps sheet) = follow-the-finger drag + `touch-action:none` en `.uc-sheet` (sin eso el navegador se queda el gesto vertical en touch y el swipe-down no cerraba).

**CAUSA-RAÍZ de las regresiones de gesto (por si vuelve algo parecido):** el `padding-bottom` animado vive en un **ancestro del scroller** `.chat-messages`; mostrar el chrome achica el scroller → el navegador emite un scroll que **el usuario NO hizo** → realimentaba el hide (oscilación / auto-hide fantasma). **Fix de raíz (#3eba236):** el hide-on-scroll SOLO cuenta un scroll con el **dedo apoyado** (`pointerDownRef` en `MessageList`); el scroll inducido por layout ocurre siempre con el dedo levantado → no puede ocultar. Por construcción, no depende de timings. Blindado con 3 tests en `MessageList.test.tsx`.

**DECISIÓN del operador (mergeada):** se sacó el **auto-ocultado por inactividad** (#8971f12) porque dejaba la barra con `pointer-events:none` fuera de pantalla → el 1er toque sobre "Apps" lo comía la superficie del chat como "revelar" → **doble-tap** ("solo la primera vez"). **Opción A vigente:** barra NO se oculta sola; se oculta SOLO por hide-on-scroll (dedo) + vuelve con tap-centro + cambio de tab la re-muestra. **Tradeoff que se pisa:** idle-hide y "Apps al primer toque" no coexisten — con la barra oculta (off-screen), usar cualquier botón de abajo son 2 acciones (revelar + tocar), es físico. Si el operador pide idle-hide "como siempre" → **Opción B = revertir `8971f12`** y vuelve el doble-tap; no hay forma de tener ambos sin rediseñar cómo se revela la barra (escalar como decisión MAYOR).

**Sesión / auth (RESUELTO de raíz, PR #118, 2026-07-04):** el access token de GoTrue dura **1h** y antes NO se renovaba → volver tras un rato = 401 → logout + "No pudimos cargar tus apps". Ahora **sesión persistente vía refresh-token flow**: (a) backend `POST /auth/refresh` (`GoTrueAdmin.refresh_grant`, `grant_type=refresh_token`, 401 "sesión expirada" ante refresh inválido); (b) frontend guarda el `refresh_token` en login (`SessionProvider`) y en un 401-con-sesión refresca en silencio + reintenta con el token nuevo. **Single-flight obligatorio** (`refreshInFlight` en `client.ts`): GoTrue **ROTA** el refresh en cada uso → 401 concurrentes deben deduplicar en UN solo `/auth/refresh` o el 2º falla por token rotado = logout espurio. Validado E2E: frontend 424 tests, backend 34 (scratch VPS), **smoke vivo** (refresh válido→200+rotado, basura→401). Reemplazó el reintento ciego de #116. Sesiones legacy (sin refresh_token) se deslogean 1 vez en su próximo 401. Deuda: `refresh_token` en localStorage (XSS estándar, aceptable).

**DECISIÓN de producto (operador 2026-07-04): hilo ÚNICO continuo, SIN concepto de "conversación nueva".** No hay sesiones ni botón "Nueva conversación" — es un solo hilo permanente con memoria a largo plazo vía Graphity ([[copiloto-memoria-provider-ladrillo]]). Por eso en escritorio se quitó la cabecera del chat con su botón "Nueva conversación" (PR #121) y NO se repuso. Consecuencia: **no agregar UI de switching/listado de sesiones**. Candidato de limpieza (no pedido aún): la cabecera móvil "SESIÓN ACTIVA · HOY" del `ChatHeader` quedó desalineada con esta filosofía.

**Modal "Tus apps" (selector de modos) → SOLO nombre real (PR #123 mergeado a `main`, 2026-07-04; también traía el fix de la tarjeta HITL con app real).** `ModeButton` mostraba `work_label` amigable ("Cobrar"/"Mail") + `display_name` de subtítulo; ahora muestra SOLO `display_name` (Mercado Pago/Gmail/Google Docs…), mismo criterio que `ServiceCard` de Conexiones (PR #121). `ModeButton` es COMPARTIDO escritorio (`AppsModal`) + móvil (`BottomSheet`) vía `AppsScreen` → idénticos por construcción (apps.css NO se overridea en desktop). El `work_label` sigue vivo en `modeStore` → chip "Modo Mail" del Composer. Verificado E2E vivo (Playwright, desktop+móvil, temas claro+oscuro). Gate build + 421 tests.

**FOLLOW-UPS abiertos:**
1. **Tradeoff idle-hide vs Apps** (arriba) — abierto por si el operador reabre.
2. **Cabecera móvil "SESIÓN ACTIVA · HOY"** — candidata a quitar por la decisión de hilo único (no pedida aún).

**Archivos clave del frontend móvil:** `shell/{AppShell,useChromeAutoHide,useBackGuard,shell.css}` · `modules/chat/{MessageList,ChatScreen,MicButton,chat.css}` · `design-system/{BottomSheet,primitives.css}` · `lib/api/catalog.ts` + `modules/connections/useConnections.ts` (apps fetch). Backend/deploy/auth del copiloto → [[copiloto-deploy-multitenant-vivo]].

[[copiloto-deploy-multitenant-vivo]] [[gate-jsdom-no-ve-gestos-tactiles]] [[pwa-sw-staleness-gotcha]] [[gate-visual-multi-tema-tokens]] [[copiloto-emprendedor-roadmap]]
