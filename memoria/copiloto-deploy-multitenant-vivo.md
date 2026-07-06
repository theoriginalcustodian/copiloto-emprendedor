---
name: copiloto-deploy-multitenant-vivo
description: "Copiloto del Emprendedor DESPLEGADO VIVO + multitenant real en el VPS (auth Supabase JWT + onboarding + agente durable E2E). LEER al retomar el copiloto: qué está vivo, cómo operarlo, el blocker de fusion, qué falta para el frontend."
metadata:
  node_type: memory
  type: project
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**El Copiloto del Emprendedor está DESPLEGADO Y VIVO en el VPS `unreal-copilot`, multitenant real, E2E probado** (rama `feat/copiloto-deploy-multitenant`, **PR #111** esperando merge del operador, sprint SDD 13 tasks TDD, 2026-07-03; suite 149 passed, review opus APPROVE). Cosechado del walking-skeleton [[copiloto-emprendedor-roadmap]] → la fábrica NO lo armó; se construyó con subagent-driven-development dirigido.

**Vivo (systemd, `active`, Restart=always):** `uc-copiloto-web` (uvicorn `serve.py`, front-door en 127.0.0.1:8099) + `uc-copiloto-worker` (Temporal worker: `ConversationWorkflow` durable + `MpRefreshWorkflow`). Caddy: `copiloto.178-105-191-1.sslip.io` (chat) + `mp.178-105-191-1.sslip.io` (callbacks MP), ambos →8099. Deploy idempotente: `deploy/copiloto/deploy.sh` (sync worktree→`/opt/uc-repos/copiloto`, sourcea `SUPABASE_JWT_SECRET` VPS→fusion server-side, provision, units, Caddy `caddy validate` antes de reload). **Redeploy = correr deploy.sh** (NO es git checkout). [[deploy-factory-code-vps]]

**Arquitectura multitenant (la costura clave):** `cliente_id` sale del JWT (validado HS256 con el secreto de fusion) → registry `uc_factory.tenants` (por `sub`) → fluye per-request por `context_factory(conv)` → `TenantCtx` a todos los recursos. Worker usa owner role (BYPASSA RLS) → **la barrera real es el filtro `cliente_id` explícito en cada query**, verificado por **8 tests adversariales cross-tenant PASSED** (regla dura, [[agente-conversacional-hardening-3-lentes]]). `composio_user_id = cliente_id` (Composio per-tenant); seller MP del `mp_credentials` del tenant (sin env manual).

**E2E vivo PROBADO (smoke autónomo):** signup real (admin-mediado GoTrue, sin 422) → JWT → `/me` per-tenant → `/chat` → **el agente respondió** (loop durable BFF→Temporal→LLM gpt-4o-mini→dispatch→reply) → `/mp/connect` (URL OAuth MP real) → `/composio/connect` (link Composio real). Endpoints: `/auth/signup`+`/auth/login`+`/auth/refresh` (sin auth; `/auth/refresh` = sesión persistente, PR #118, ver [[copiloto-frontend-movil-ux-estado]]), `/chat`+`/reply`+`/me`+`/mp/connect`+`/composio/connect` (Bearer JWT), `/mp/*` (exento, state-cifrado/x-signature), `/healthz`.

**✅ email-login HABILITADO en fusion (2026-07-03, con OK del operador) → login real cerrado.** `ENABLE_EMAIL_SIGNUP=false→true` en `/opt/supabase/source/docker/.env` (mapea a `GOTRUE_EXTERNAL_EMAIL_ENABLED`); `DISABLE_SIGNUP=true` intacto → self-signup sigue bloqueado (alta = admin API). **Recrear el auth de fusion** (las imágenes vienen de `VERSIONS.lock`, NO del `.env`; el stack usa `docker-compose.yml`+`override.yml`): `cd /opt/supabase/source/docker && docker compose --env-file .env --env-file VERSIONS.lock up -d --no-deps --force-recreate auth`. Container `supabase-auth`. Reversible: backup `.env.bak.emaillogin`. **E2E COMPLETO con login REAL probado**: signup→login GoTrue (password grant, apikey ANON_KEY)→JWT real→/me→chat→**agente responde**→connect. [[deuda-secretos-rotar]]

**Operator-in-the-loop pendiente (solo E2E de pagos):** (1) clic OAuth `/mp/connect` → `/mp/callback` guarda creds + arranca refresh → chat "cobrá $X" → payment_link → pago prueba → `/mp/webhook` → `mp_payments` → BI (mecánicas ya validadas en spike #106, [[mercadopago-integracion-research]]); (2) clic OAuth Composio. Login real = RESUELTO.

**Frontend "solo conectar":** login (GoTrue password grant, apikey ANON_KEY) → JWT → Bearer a los endpoints. `service` de `/composio/connect` usa slugs reales (gmail/googlecalendar/...) → traducir si el frontend usa nombres cortos.

**Deuda gestionada:** conn sin pool (patrón codebase-wide, hardening de escala) · recuperación onboarding parcial (422 email existente) · `copiloto.env` con `COPILOTO_CLIENTE_ID`/`COMPOSIO_USER_ID` inertes (cosmético). Detalle: `docs/Implementaciones terminadas/2026-07-03-copiloto-deploy-multitenant_reporte.md`.

**Frontend cliente móvil (PWA):** UX de gestos/chrome pulida y MERGEADA a main (**PR #115**, 2026-07-04). Deploy solo-frontend = `deploy/copiloto/sync-web.sh` (NO reinicia el worker), distinto del `deploy.sh` backend. Estado/arquitectura/follow-ups → [[copiloto-frontend-movil-ux-estado]].

[[copiloto-frontend-movil-ux-estado]] [[copiloto-emprendedor-roadmap]] [[mercadopago-gateway-impl-followup]] [[factory-identidad-automatizacion-ia]] [[composio-servicios-composio-plugin]] [[apps-deploys-siempre-vps]]
