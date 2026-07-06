---
name: pwa-sw-staleness-gotcha
description: PWA service worker sirve build viejo/partido → el operador no ve los deploys; síntoma y fix
metadata: 
  node_type: memory
  type: reference
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

El cliente `uc-copiloto-web` es una **PWA con vite-plugin-pwa**. Su service worker puede servir un build **viejo o partido** en el navegador aunque el deploy sea correcto → el operador reporta "no veo mis cambios / mockup viejo / el composer desapareció / el mic sigue a la izquierda".

**Síntoma diagnóstico (empírico, no supuesto):** la captura del operador muestra un string (ej. placeholder `"Escribí tu mensaje…"`) que **NO existe en el JS que sirve el servidor** — se verifica con `curl -sk <url>/assets/index-*.js | grep -c "<string>"` = 0. Si el navegador muestra código que el servidor ya no sirve → es el SW cacheado, NO un bug de deploy ni de código. Confirmar además con Playwright renderizando la URL viva **sin caché** (unregister SW + `caches.delete`): si ahí sale bien, el problema es 100% el SW del navegador del operador.

**Fix de raíz (aplicado 2026-07-04, PR #112):**
- `vite.config.ts` PWA → `workbox: { cleanupOutdatedCaches: true, skipWaiting: true, clientsClaim: true }` (purga precache viejo + el SW nuevo toma control en la 1ª recarga).
- `apps/copiloto/web.py::_mount_spa` → sirve `index.html`/`sw.js`/`registerSW.js`/`manifest.webmanifest` + `workbox-*` con `Cache-Control: no-cache, no-store, must-revalidate` (los `/assets/*` con hash de contenido sí se cachean fuerte). Verificado vivo: `curl -skI <url>/sw.js` → `no-cache`.

**Escape para un navegador YA cacheado:** una recarga con el SW nuevo se auto-limpia; si persiste, `Ctrl+Shift+R` una vez o DevTools → Application → Unregister service worker.

**Regla:** al deployar el frontend, NO declarar "el operador ya lo ve" — el deploy correcto ≠ el navegador lo tiene. Verificar el bundle servido por curl y, si el operador reporta algo viejo, sospechar el SW ANTES de tocar código. [[deploy-factory-code-vps]] [[apps-deploys-siempre-vps]] [[no-codificar-la-esperanza-principio-raiz]]
