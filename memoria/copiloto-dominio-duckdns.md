---
name: copiloto-dominio-duckdns
description: "Copiloto accesible por dominio propio copilotoemprendedor.duckdns.org (evita el bloqueo de sslip.io en redes de terceros). Caddy + GoTrue + frontend migrados; Google OAuth migrado a duckdns. LEER al tocar acceso público, dominio, Caddy o auth Google del copiloto."
metadata: 
  node_type: memory
  type: project
  originSessionId: a31ccf34-66c0-454f-aa4a-f13fd63250db
---

**Por qué:** `*.sslip.io` lo bloquean muchos resolvers DNS (ISP, control parental, móviles) — el bloqueo es del lado del cliente, sslip resuelve OK globalmente. Solución de raíz: **dominio propio** `copilotoemprendedor.duckdns.org` → `178.105.191.1` (DuckDNS está mucho menos en listas de bloqueo). El dominio viejo `copiloto.178-105-191-1.sslip.io` **queda vivo a propósito** (no romper callbacks MP registrados) — todo ADITIVO.

**⚠️ Gotcha DuckDNS:** registrar desde el navegador toma la IP pública del operador (su casa), no la del VPS → corregir el campo IP a `178.105.191.1` en el dashboard.

**Caddy** (`/etc/caddy/Caddyfile`, bloque aditivo): `copilotoemprendedor.duckdns.org` → `handle /auth/v1/authorize*` y `/auth/v1/callback*` a `127.0.0.1:9997` (GoTrue), `handle` default → `127.0.0.1:8099` (front-door). Admin API NO queda expuesto (cae en el default → SPA fallback, no GoTrue). Caddy saca TLS solo (ACME).
- **Lección Caddy dura:** NO editar el Caddyfile con `mv` de un `mktemp` — deja el archivo `600 root` y el user `caddy` no lo lee → `reload` falla con `permission denied` aunque `caddy validate` pase. Original es `644`; `chmod 644` tras editar. `caddy validate` necesita `--adapter caddyfile` si el archivo no se llama `Caddyfile`.

**GoTrue** (env `/etc/unreal-copilot/copiloto-gotrue.env`, 600; recrear con `deploy/copiloto/gotrue/deploy-gotrue.sh`, PRESERVA el env si existe): 3 valores a duckdns → `GOTRUE_URI_ALLOW_LIST=<sslip>/*,<duckdns>/*` (ambos), `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://copilotoemprendedor.duckdns.org/auth/v1/callback`, `COPILOTO_API_EXTERNAL_URL=https://copilotoemprendedor.duckdns.org`.

**Google Cloud Console** (lo hace el operador): registrar el callback duckdns en "URIs de redirección autorizados" (aditivo). App en modo **Testing** → usuarios deben estar en "Usuarios de prueba" o Google niega el acceso. Propagación: 5 min a horas.

**Frontend** (`apps/copiloto-web`): botón "Entrar con Google" usa `VITE_AUTH_URL` (horneado en build). API es relativa → funciona en cualquier dominio sin rebuild; solo el auth Google necesita rebuild con `VITE_AUTH_URL` a duckdns. **Fuente de verdad del dominio de auth = `sync-web.sh` (main)**, parametriza `VITE_AUTH_URL` via `UC_AUTH_URL`, default duckdns. `.env.production` NO se versiona — si `sync-web.sh` revierte al default viejo (sslip), Google vuelve al dominio bloqueado; verificar la versión del script antes de un redeploy de frontend.

[[copiloto-deploy-multitenant-vivo]] [[copiloto-gotrue-dedicada-cutover]] [[pwa-sw-staleness-gotcha]] [[copiloto-frontend-movil-ux-estado]]
