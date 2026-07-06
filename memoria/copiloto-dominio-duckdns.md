---
name: copiloto-dominio-duckdns
description: "Copiloto accesible por dominio propio copilotoemprendedor.duckdns.org (evita el bloqueo de sslip.io en redes de terceros). Caddy + GoTrue + frontend migrados; Google OAuth migrado a duckdns. LEER al tocar acceso público, dominio, Caddy o auth Google del copiloto."
metadata: 
  node_type: memory
  type: project
  originSessionId: a31ccf34-66c0-454f-aa4a-f13fd63250db
---

**Por qué:** `*.sslip.io` lo bloquean muchos resolvers DNS (ISP, control parental, móviles) → un amigo del operador vio `ERR_NAME_NOT_RESOLVED` (2026-07-06). sslip resuelve OK globalmente (verificado 8.8.8.8/1.1.1.1) — el bloqueo es del lado del cliente. Solución de raíz aplicada: **dominio propio** `copilotoemprendedor.duckdns.org` → `178.105.191.1`. DuckDNS está mucho menos en listas de bloqueo. El dominio viejo `copiloto.178-105-191-1.sslip.io` **queda vivo a propósito** (no romper callbacks MP registrados) — todo es ADITIVO.

**⚠️ Gotcha DuckDNS:** al registrar desde el navegador toma la IP pública del operador (su casa), no la del VPS → hay que corregir el campo IP a `178.105.191.1` en el dashboard. Verificar con `Resolve-DnsName`.

**Caddy** (`/etc/caddy/Caddyfile`, bloque aditivo): `copilotoemprendedor.duckdns.org` → `handle /auth/v1/authorize*` y `/auth/v1/callback*` a `127.0.0.1:9997` (GoTrue), `handle` default → `127.0.0.1:8099` (front-door). El admin API NO queda expuesto (cae en el default → front-door → SPA fallback HTML, no GoTrue; verificado adversarial: loopback 9997 admin = 401). Caddy saca TLS solo (ACME) porque la IP ya apunta al VPS.
- **Lección Caddy dura:** NO editar el Caddyfile con `mv` de un `mktemp` — deja el archivo `600 root` y el user `caddy` no lo lee → `reload` falla con `permission denied` (aunque `caddy validate` pase). El original es `644`. `chmod 644` tras editar. Y `caddy validate` necesita `--adapter caddyfile` si el archivo no se llama `Caddyfile`.

**GoTrue** (env `/etc/unreal-copilot/copiloto-gotrue.env`, 600; recrear con `deploy/copiloto/gotrue/deploy-gotrue.sh` que PRESERVA el env si existe): 3 valores a duckdns → `GOTRUE_URI_ALLOW_LIST=<sslip>/*,<duckdns>/*` (ambos), `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://copilotoemprendedor.duckdns.org/auth/v1/callback`, `COPILOTO_API_EXTERNAL_URL=https://copilotoemprendedor.duckdns.org`. Verificado: `authorize` → 302 a Google con el redirect_uri duckdns. Script canónico relacionado: `activate-google-oauth.sh` (para vhost auth.* dedicado; acá no hizo falta, mismo dominio chat+oauth).

**Google Cloud Console** (lo hace el operador, sin acceso del agente): registrar `https://copilotoemprendedor.duckdns.org/auth/v1/callback` en "URIs de redirección autorizados" (aditivo). App en modo **Testing** → los usuarios deben estar en "Usuarios de prueba" o Google les niega el acceso. Propagación Google: 5 min a horas.

**Frontend** (`apps/copiloto-web`): el botón "Entrar con Google" usa `VITE_AUTH_URL` (horneado en build). Se creó `apps/copiloto-web/.env.production` con `VITE_AUTH_URL=https://copilotoemprendedor.duckdns.org` + rebuild in-place en el VPS (`npm run build`). API es relativa (`VITE_API_BASE ?? ''`) → funciona en cualquier dominio sin rebuild; solo el auth Google necesitaba el rebuild. Bundle nuevo servido = `index-ZSZliNb8.js`.

**Deuda del frontend → RESUELTA por PR #143 (MERGED a main 2026-07-06):** `.env.production` NO se versiona (`.gitignore` bloquea `.env.*`). La fuente de verdad del dominio de auth es el default de `sync-web.sh`, que en `main` ya parametriza `VITE_AUTH_URL` via `UC_AUTH_URL` — pero su default era `https://auth.<sslip>` → un `sync-web.sh` futuro revertía Google al dominio bloqueado. **PR #143** cambia ese default a `https://copilotoemprendedor.duckdns.org` (y elimina `BASE_DOMAIN` sin uso). **Pendiente:** (1) mergear #143; (2) el VPS corre una versión VIEJA de `sync-web.sh` (sin parametrización) — actualizarlo a la de main; el frontend vivo hoy sigue OK por el build manual (`VITE_AUTH_URL` env var) + `.env.production` que dejé en el VPS.

[[copiloto-deploy-multitenant-vivo]] [[copiloto-gotrue-dedicada-cutover]] [[pwa-sw-staleness-gotcha]] [[copiloto-frontend-movil-ux-estado]]
