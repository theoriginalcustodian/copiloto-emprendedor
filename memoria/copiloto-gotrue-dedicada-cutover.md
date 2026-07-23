---
name: copiloto-gotrue-dedicada-cutover
description: "Copiloto migrado a una GoTrue DEDICADA (Opción C, aislada de fusion) — cutover EJECUTADO en vivo. LEER al tocar auth/login/signup del copiloto, al activar Google OAuth, o al operar/rollbackear el stack de auth."
metadata:
  node_type: memory
  type: project
  originSessionId: 53c58a53-271e-474c-9267-f7720a2c6820
---

**El copiloto ya NO usa la GoTrue compartida de fusion: tiene su GoTrue DEDICADA** (secreto+issuer propios), en el VPS del copiloto, loopback `127.0.0.1:9997`. **Cutover EJECUTADO y verificado EN VIVO** (PR #130 MERGED a main). Motivo: cerró el **SSO-by-accident** — `require_tenant` no validaba `iss`, así que un token de CUALQUIER app de fusion firmado con el `SUPABASE_JWT_SECRET` compartido entraba al copiloto. [[copiloto-deploy-multitenant-vivo]]

**Diferido (deuda registrada):** ventana de 403 selectivos escala mal con N tenants grande · Google OAuth = registro ABIERTO sin allowlist → decisión de POLÍTICA del operador antes de activar (documentado en el README).

**Topología (todo en el VPS del copiloto, NO en fusion):** `uc-copiloto-web` → `127.0.0.1:9997` (Caddy proxy `/auth/v1/*`) → `gotrue:9999` (supabase/gotrue **v2.186.0**, misma que fusion → contrato de token idéntico) → `postgres:16-alpine` (schema `auth`). Fusion = **VPS APARTE** (alias SSH `fusion`); la **data** del copiloto (`uc_factory.tenants`, `mp_credentials`) SIGUE en la Postgres de fusion — el cutover solo cambió QUIÉN emite/valida tokens.

**Código:** `deploy/copiloto/gotrue/` (compose parametrizado, `deploy-gotrue.sh` idempotente, README con guía de activación de Google). Es un **drop-in** de `SUPABASE_URL` (el código del copiloto no cambia salvo iss).

**REGLAS (no romper):**
- `decode_supabase_jwt(..., issuer=X)` valida `iss`; `issuer=None` = legacy sin verificar (backward-compat). El composition root inyecta `COPILOTO_JWT_ISSUER` → `require_tenant` valida iss. **Nunca** usar el `SUPABASE_JWT_SECRET` de fusion para el copiloto: es `COPILOTO_JWT_SECRET` propio.
- `deploy.sh [2/7]` re-proyecta `copiloto-gotrue.env` → EnvironmentFiles en CADA deploy (self-healing). NO volver a sourcear fusion para el JWT.
- **Rollback** = restaurar `copiloto.env` + `fusion-supabase.env` de los `*.bak-pre-gotrue-<stamp>` + `systemctl restart uc-copiloto-web uc-copiloto-worker` (los passwords viejos de fusion vuelven a andar).

**Deuda gestionada:** los tenants migrados de fusion tienen **passwords temporales** en `/etc/unreal-copilot/copiloto-migrated-creds.txt` (600) — no se migran hashes entre instancias. Reset sin SMTP → **OTP por WhatsApp**, diferido. · service_role/anon keys exp 10y sin revocación server-side.

**Google OAuth: ✅ LIVE + PROBADO E2E EN PRODUCCIÓN (PR #132 MERGED).** Linkea por email confirmado a la cuenta existente (no crea duplicado). Piezas vigentes:
- **Vhost público OAuth-only** `auth.178-105-191-1.sslip.io` (host-level Caddy): expone **SOLO** `/auth/v1/authorize*` + `/auth/v1/callback*` con bloques `handle` → todo lo demás (incl. `/admin/*`) da 404. **GOTCHA:** un `respond 404` suelto tiene MAYOR prioridad que `reverse_proxy` en Caddy → usar `handle` (mutuamente excluyentes).
- **`API_EXTERNAL_URL` decoplado** del loopback vía `COPILOTO_API_EXTERNAL_URL`. NO afecta el `iss` (fijado por `GOTRUE_JWT_ISSUER`) → iss-enforcement intacto.
- **Frontend** (`apps/copiloto-web`): `auth/oauth.ts` (`googleAuthUrl()` + `consumeOauthCallback()`) · `SessionProvider` provisiona en el callback (idempotente) · botón en `LoginScreen`.
- **Modo Testing de Google = allowlist sin código** (solo *test users* entran). **Rollback:** sacar vhost del Caddyfile + `GOTRUE_EXTERNAL_GOOGLE_ENABLED=false` + redeploy. [[deuda-secretos-rotar]]

**Evidencia:** spike `spikes/copiloto-dedicated-gotrue/RESULT.md` GREEN 7/7 · iss-enforcement adversarial EN VIVO (otro emisor → 401, ok → 200, no-tenant → 403) · suite 260 passed/36 skipped, corridos en el VPS. [[tests-se-corren-en-vps]]
