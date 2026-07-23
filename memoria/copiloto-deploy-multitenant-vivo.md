---
name: copiloto-deploy-multitenant-vivo
description: "Copiloto del Emprendedor DESPLEGADO VIVO + multitenant real en el VPS (auth Supabase JWT + onboarding + agente durable E2E). LEER al retomar el copiloto: qué está vivo, cómo operarlo, el blocker de fusion, qué falta para el frontend."
metadata:
  node_type: memory
  type: project
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**El Copiloto del Emprendedor está DESPLEGADO Y VIVO en el VPS `unreal-copilot`, multitenant real, E2E probado.**

**Vivo (systemd, `active`, Restart=always):** `uc-copiloto-web` (uvicorn `serve.py`, front-door 127.0.0.1:8099) + `uc-copiloto-worker` (Temporal worker: `ConversationWorkflow` durable + `MpRefreshWorkflow`). Caddy: `copiloto.178-105-191-1.sslip.io` (chat) + `mp.178-105-191-1.sslip.io` (callbacks MP), ambos →8099. Deploy idempotente: `deploy/copiloto/deploy.sh` (sync worktree→`/opt/uc-repos/copiloto`, sourcea `SUPABASE_JWT_SECRET` VPS→fusion, provision, units, `caddy validate` antes de reload). **Redeploy = correr deploy.sh** (NO es git checkout).

**Arquitectura multitenant (la costura clave):** `cliente_id` sale del JWT (validado HS256 con el secreto de fusion) → registry `uc_factory.tenants` (por `sub`) → per-request por `context_factory(conv)` → `TenantCtx` a todos los recursos. Worker usa owner role (BYPASSA RLS) → **la barrera real es el filtro `cliente_id` explícito en cada query**, verificado por **8 tests adversariales cross-tenant PASSED** ([[agente-conversacional-hardening-3-lentes]]). `composio_user_id = cliente_id`; seller MP del `mp_credentials` del tenant (sin env manual).

**Endpoints:** `/auth/signup`+`/auth/login`+`/auth/refresh` (sin auth; refresh = sesión persistente, ver [[copiloto-frontend-movil-ux-estado]]), `/chat`+`/reply`+`/me`+`/mp/connect`+`/composio/connect` (Bearer JWT), `/mp/*` (exento, state-cifrado/x-signature), `/healthz`. Login real: GoTrue password grant + apikey ANON_KEY → JWT real. `service` de `/composio/connect` usa slugs reales (gmail/googlecalendar/...) → traducir si el frontend usa nombres cortos. E2E vivo probado end-to-end: signup→login→JWT→/me→chat→**el agente responde**→connect.

**Operator-in-the-loop pendiente (solo E2E de pagos):** (1) clic OAuth `/mp/connect` → `/mp/callback` guarda creds + arranca refresh → chat "cobrá $X" → payment_link → pago prueba → `/mp/webhook` → `mp_payments` → BI ([[mercadopago-integracion-research]]); (2) clic OAuth Composio.

**Deuda gestionada:** conn sin pool (patrón codebase-wide) · recuperación onboarding parcial (422 email existente) · `copiloto.env` con `COPILOTO_CLIENTE_ID`/`COMPOSIO_USER_ID` inertes (cosmético).

**Frontend cliente móvil (PWA):** UX de gestos/chrome mergeada a main. Deploy solo-frontend = `deploy/copiloto/sync-web.sh` (NO reinicia el worker), distinto de `deploy.sh`. Detalle → [[copiloto-frontend-movil-ux-estado]].

[[copiloto-frontend-movil-ux-estado]] [[copiloto-emprendedor-roadmap]] [[mercadopago-gateway-impl-followup]] [[factory-identidad-automatizacion-ia]] [[copiloto-servicios-composio-plugin]] [[apps-deploys-siempre-vps]]
