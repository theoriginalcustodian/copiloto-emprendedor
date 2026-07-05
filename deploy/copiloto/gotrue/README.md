# GoTrue dedicada del copiloto (Opción C) — setup + activación de Google OAuth

**Qué es:** una instancia GoTrue **propia** del copiloto (secreto + issuer propios), aislada de la
Supabase de `fusion`. Cierra el "SSO-by-accident" (un token de cualquier otra app de fusion firmado
con el secreto compartido entraba al copiloto) y habilita agregar Google OAuth sin tocar infra ajena.
Decisión y evidencia: `spikes/copiloto-dedicated-gotrue/RESULT.md` (spike GREEN) + el reporte de cierre.

## Arquitectura (todo en el VPS del copiloto, loopback)

```
copiloto (uc-copiloto-web)  --HTTP-->  127.0.0.1:9997 (Caddy proxy)  --/auth/v1/*-->  gotrue:9999
                                                                                          |
                                                                          postgres:16 (schema auth)
```

- **`docker-compose.gotrue.yml`** — 3 servicios (db `postgres:16-alpine` · auth `supabase/gotrue:v2.186.0`
  · proxy `caddy:2`). Todo parametrizado por `copiloto-gotrue.env` (server-side, 600). Compose project
  `copiloto-auth`. El proxy publica SOLO en `127.0.0.1:9997`.
- **`Caddyfile`** — mapea `/auth/v1/*` → GoTrue → la instancia es **drop-in** de `SUPABASE_URL` (el código
  del copiloto pega en `{SUPABASE_URL}/auth/v1/...` sin cambios).
- **`init-auth-schema.sql`** — crea el schema `auth` en el primer boot; GoTrue auto-migra el resto.

## Operar

```bash
# levantar/actualizar (idempotente; genera secreto+keys la 1ª vez, los preserva después) + auto-valida
bash deploy/copiloto/gotrue/deploy-gotrue.sh

# cutover del copiloto vivo a esta GoTrue (migra tenants + repoint + restart + smoke E2E) — YA EJECUTADO
CUTOVER_STAMP=$(date -u +%Y%m%dT%H%M%SZ) bash deploy/copiloto/gotrue/migrate-and-cutover.sh
```

Cada `deploy.sh` (deploy normal) re-proyecta la config de `copiloto-gotrue.env` a los EnvironmentFiles
del proceso (paso `[2/7]`, self-healing) — no hay que tocar nada a mano.

**Rollback a fusion:** restaurar los `*.bak-pre-gotrue-<stamp>` de `copiloto.env` + `fusion-supabase.env`
y `systemctl restart uc-copiloto-web uc-copiloto-worker`.

## Estado (2026-07-05)

- ✅ Stack dedicado desplegado + auto-validado. Cutover EJECUTADO. iss-enforcement verificado
  adversarialmente EN VIVO (token de otro emisor → 401). Email/password login E2E OK.
- ⚠️ Los 4 tenants migrados tienen **passwords temporales** en `/etc/unreal-copilot/copiloto-migrated-creds.txt`
  (600). Deuda: cambio de password sin SMTP → **OTP por WhatsApp** (canal ya operativo), diferido.

## Activar Google OAuth (PENDIENTE — necesita credenciales del operador)

El backend ya está listo: el endpoint **`POST /auth/oauth/ensure-tenant`** provisiona el tenant en el
first-login (solo para proveedores OAuth externos; `email`/`phone` siguen admin-mediados). Los slots
`GOTRUE_EXTERNAL_GOOGLE_*` están en el compose (OFF por default). Falta lo que depende de Google:

1. **Google Cloud Console** → crear un OAuth client tipo *Web application*:
   - Authorized redirect URI = `https://<vhost-público-del-proxy>/auth/v1/callback`.
   - Copiar `client_id` + `client_secret`.
2. **Exponer SOLO los paths OAuth del browser** (el redirect de Google va al browser; el admin API lo
   llama el backend por loopback). ⚠️ **NO** exponer `/auth/v1/*` completo — eso publicaría `/auth/v1/admin/*`
   (crear users, setear claims) a Internet, protegido solo por la service_role key (JWT 10y sin revocación).
   Vhost host-level en el Caddy del VPS (idempotente, `caddy validate` antes de reload):
   ```
   auth.178-105-191-1.sslip.io {
       @admin path /auth/v1/admin*
       respond @admin 404
       @oauth path /auth/v1/authorize* /auth/v1/callback* /auth/v1/token* /auth/v1/user* /auth/v1/health*
       reverse_proxy @oauth 127.0.0.1:9997
       respond 404
   }
   ```
   Y setear `API_EXTERNAL_URL`/`GOTRUE_SITE_URL` de `copiloto-gotrue.env` a ese dominio público.
3. **Cargar las creds** en `/etc/unreal-copilot/copiloto-gotrue.env`:
   ```
   GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
   GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<client_id>
   GOTRUE_EXTERNAL_GOOGLE_SECRET=<client_secret>
   GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://<vhost-público>/auth/v1/callback
   ```
   y `bash deploy-gotrue.sh` (recrea el container auth con Google habilitado).
4. **Frontend** (`apps/copiloto-web`): botón "Entrar con Google" → redirect a
   `https://<vhost-público>/auth/v1/authorize?provider=google&redirect_to=<app_url>`. Tras el callback,
   GoTrue redirige a la app con `access_token`+`refresh_token` en el fragment; el front los captura,
   llama **una vez** a `POST /auth/oauth/ensure-tenant` (Bearer), y sigue con el resto de la API.
5. **Verificar E2E** el round-trip real (browser → Google → callback → ensure-tenant → /me 200).

> ⚠️ **DECISIÓN DE POLÍTICA antes de activar Google (review B8):** hoy el alta email es CERRADA
> (admin-mediada, `GOTRUE_DISABLE_SIGNUP=true`). Google OAuth vía `/auth/oauth/ensure-tenant`
> auto-provisiona un tenant para **CUALQUIER** cuenta Google válida (workflows Temporal + grafo +
> slots Composio/MP) → **invierte la postura a registro ABIERTO** (vector de abuso/costo). Además,
> habilitar OAuth exige `GOTRUE_DISABLE_SIGNUP=false`, lo que reabre el signup email directo contra
> GoTrue (esos users quedan inertes por el gate 403 de require_tenant, pero engordan `auth.users`).
> Si el producto es invite-only/pago: agregar un chequeo de **allowlist** (dominio / tabla de
> invitaciones / pre-alta admin) en `provision_oauth_tenant` ANTES de crear la fila, y evaluar
> rate-limit del endpoint. Decidir esto explícitamente antes del paso 3.

> `[ASSUMED_PENDING_VERIFY @ google-creds]` — el string exacto del claim `app_metadata.provider` para
> Google se asume `"google"` (comportamiento estándar de GoTrue). El gating del endpoint acepta
> cualquier provider ≠ `email`/`phone`, así que es robusto, pero el round-trip real se valida al activar.
