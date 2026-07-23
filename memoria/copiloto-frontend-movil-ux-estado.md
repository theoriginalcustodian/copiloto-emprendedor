---
name: copiloto-frontend-movil-ux-estado
description: "Estado del frontend cliente móvil (PWA) del Copiloto tras el pulido de UX de gestos (PR #115 mergeado). LEER al retomar cualquier arreglo del frontend móvil: qué está vivo, arquitectura del chrome auto-hide, causa-raíz de las regresiones de gesto, decisiones abiertas y follow-ups."
metadata:
  node_type: memory
  type: project
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**Frontend cliente móvil (PWA) del Copiloto — UX de gestos PULIDA y MERGEADA a `main` (PR #115).** Gate **411 tests vitest + build OK**.

**Vivo en el VPS** (no re-deployar): servido por `uc-copiloto-web` (uvicorn :8099) tras Caddy. **Deploy frontend = `bash deploy/copiloto/sync-web.sh`** (sincroniza SOLO `apps/copiloto-web`, buildea en el VPS, **NO reinicia el worker**). NO usar `deploy.sh` para cambios solo-frontend (reinicia `uc-copiloto-worker`). Repo VPS: `/opt/uc-repos/copiloto`. [[apps-deploys-siempre-vps]]

**Stack:** React 18 + Vite 6 + TS + vitest. Mobile-first `AppShell` (<900px) + `DesktopShell` (≥900px) vía `ResponsiveShell`/`useBreakpoint`. PWA con `cleanupOutdatedCaches`; `sw.js` servido `no-cache` → [[pwa-sw-staleness-gotcha]].

**⚠️ LECCIÓN QUE COSTÓ 4 RONDAS — el gate no ve el touch.** vitest/**jsdom no modela** touch-action, pointer-capture, momentum ni resize real → los bugs de gesto pasan el gate en verde y en el teléfono fallan. Un fix de gesto "verde" NO está verificado hasta verlo en device (o Playwright + emulación touch). → [[gate-jsdom-no-ve-gestos-tactiles]].

**Arquitectura del chrome auto-hide (móvil):**
- `.app-shell__content` lleva `padding-bottom: 86px` **animado** (clearance de la tab-bar flotante); al ocultar el chrome va a `0`.
- `TabBar` = overlay `position:absolute; bottom:18px`; `.tab-bar--hidden` = `translateY` fuera + `opacity:0` + `pointer-events:none`.
- `useChromeAutoHide` = show/hide **controlado**, **SIN timer de inactividad** (sacado deliberadamente, ver decisión abajo).
- `MessageList` dispara hide-on-scroll y tap-reveal; `useBackGuard` mapea el back de Android para pelar overlays en vez de salir.
- `BottomSheet` = follow-the-finger drag + `touch-action:none` en `.uc-sheet` (sin eso el navegador se queda el gesto vertical y el swipe-down no cerraba).

**CAUSA-RAÍZ de las regresiones de gesto:** el `padding-bottom` animado vive en un **ancestro del scroller** `.chat-messages`; mostrar el chrome achica el scroller → el navegador emite un scroll que el usuario NO hizo → realimentaba el hide (oscilación fantasma). **Fix de raíz:** hide-on-scroll SOLO cuenta un scroll con el **dedo apoyado** (`pointerDownRef`); el scroll inducido por layout ocurre siempre con el dedo levantado → no puede ocultar. Por construcción, no depende de timings. Blindado con 3 tests en `MessageList.test.tsx`.

**DECISIÓN del operador (mergeada):** se sacó el auto-ocultado por inactividad porque la barra oculta `pointer-events:none` hacía que el 1er toque sobre "Apps" lo comiera el chat como "revelar" → doble-tap. **Opción A vigente:** barra NO se oculta sola; sólo por hide-on-scroll (dedo) + vuelve con tap-centro + cambio de tab. **Tradeoff:** idle-hide y "Apps al primer toque" no coexisten sin rediseñar cómo se revela la barra (decisión MAYOR si se reabre).

**Sesión / auth (RESUELTO de raíz, PR #118):** el access token de GoTrue dura 1h y antes NO se renovaba → volver tras un rato = 401 → logout. Ahora **sesión persistente vía refresh-token**: backend `POST /auth/refresh` (`GoTrueAdmin.refresh_grant`) + frontend guarda `refresh_token` (`SessionProvider`) y en 401-con-sesión refresca en silencio + reintenta. **Single-flight obligatorio** (`refreshInFlight` en `client.ts`): GoTrue **ROTA** el refresh en cada uso → 401 concurrentes deben deduplicar en UN `/auth/refresh` o el 2º falla por token rotado = logout espurio. Deuda: `refresh_token` en localStorage (XSS estándar, aceptable).

**DECISIÓN de producto: hilo ÚNICO continuo, SIN "conversación nueva".** Un solo hilo permanente con memoria a largo plazo vía Graphity ([[copiloto-memoria-provider-ladrillo]]). Por eso se quitó la cabecera del chat en escritorio y NO se repuso — **no agregar UI de switching/listado de sesiones**. Candidato de limpieza: cabecera móvil "SESIÓN ACTIVA · HOY" quedó desalineada con esta filosofía.

**Modal "Tus apps" → SOLO nombre real.** `ModeButton` mostraba `work_label` amigable + `display_name`; ahora SOLO `display_name`, mismo criterio que `ServiceCard`. `ModeButton` compartido escritorio (`AppsModal`) + móvil (`BottomSheet`) vía `AppsScreen`. `work_label` sigue vivo en `modeStore` → chip "Modo Mail" del Composer.

**FOLLOW-UPS abiertos:** (1) tradeoff idle-hide vs Apps — por si el operador reabre; (2) cabecera móvil "SESIÓN ACTIVA · HOY" — candidata a quitar (no pedida aún).

**Archivos clave:** `shell/{AppShell,useChromeAutoHide,useBackGuard,shell.css}` · `modules/chat/{MessageList,ChatScreen,MicButton,chat.css}` · `design-system/{BottomSheet,primitives.css}` · `lib/api/catalog.ts` + `modules/connections/useConnections.ts`. Backend/deploy/auth → [[copiloto-deploy-multitenant-vivo]].

[[copiloto-deploy-multitenant-vivo]] [[gate-jsdom-no-ve-gestos-tactiles]] [[pwa-sw-staleness-gotcha]] [[gate-visual-multi-tema-tokens]] [[copiloto-emprendedor-roadmap]]
