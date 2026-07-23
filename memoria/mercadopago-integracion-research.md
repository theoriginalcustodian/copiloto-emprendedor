---
name: mercadopago-integracion-research
description: "MercadoPago para cobros del Copiloto — NO está en Composio, integración directa multi-tenant vía OAuth Authorization Code. LEER antes de implementar pagos/cobros o el módulo de flujo de caja del BI."
metadata:
  node_type: memory
  type: project
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**MercadoPago para cobros del Copiloto (research deep-research 2026-07-02, doc completo citado: `docs/copiloto-emprendedor/2026-07-02-mercadopago-integracion-research.md`).**

**Por qué a mano:** MercadoPago **NO está en Composio** (verificado: 404 en mercadopago/mercado_pago/mercado-pago). Stripe SÍ (432 slugs) pero no cobra local AR. → adapter propio = **2º boundary** fuera de Composio (decisión de arquitectura MAYOR).

**OAuth multi-tenant (EL CORAZÓN, ✅ verificado adversarial y E2E):** flujo **Authorization Code** (único que sirve para cobrar en nombre del vendedor). `GET auth.mercadopago.com/authorization` → code (10min, single-use) → `POST api.mercadopago.com/oauth/token` → devuelve en 1 respuesta: `access_token` (vendedor, **180 días**), `refresh_token` (**6 meses, single-use, ROTA en cada refresh** → storage transaccional por vendedor o se desvincula), `user_id` (id del tenant), `public_key`. Scopes: solo `offline_access`/`write`/`read`. **PKCE OPCIONAL** (no obligatorio — la doc oficial es clara; el "requires PKCE" era de la lib arcticjs, no de MP). redirect_uri estática+exacta. **Onboarding = 1 clic "Conectar", sin homologación bloqueante ni revisión manual** (confirmado con la app de producción real; se habilita completando el form de negocio — industria+web+T&C).

**Cobros:** `POST /checkout/preferences` con Bearer del vendedor → devuelve `init_point` = **el link de pago**. `external_reference` = clave de reconciliación con el BI. ⚠️ **Payment Links simples NO soportan webhooks → usar PREFERENCIAS** (no link simple) para reconciliación automática.

**Leer pagos (BI):** `GET /v1/payments/search` → ⚠️ **solo últimos 12 meses** → persistir en `uc_factory` a medida que llegan, no re-consultar histórico.

**Webhooks:** `notification_url` por preferencia (tiene precedencia sobre el panel). Header **`x-signature`** = `ts=...,v1=<HMAC-SHA256>`. **Manifest exacto (verificado leyendo la fuente del SDK, `mercadopago/webhook/validator.py` v3.3.0):** `id:<data_id>;request-id:<x_request_id>;ts:<ms>;` — **SIN `.lower()`** en data.id (dead-path inocuo de research previo; ids de pago son numéricos), `ts` en **milisegundos**. Usar `WebhookSignatureValidator.validate(...)` del SDK, NO reimplementar a mano. Flujo: webhook trae solo `id` → validar firma → `GET /v1/payments/{id}` (fuente de verdad del monto) → `uc_factory`.

**SDK:** oficial `pip install mercadopago`, **usar ≥3.3.0** (v≤3.2.0 tenía bug de case-sensitivity en `data.id` del manifest, F4). Corre como **activity de Temporal** (I/O→activity).

**⚠️ REFUTADO (no repetir):** el access_token NO expira a las 6h ni hay "4 causas de invalidación temprana" — eso era de **Mercado LIBRE** (global-selling), NO Mercado Pago. Dura 180 días. **No mezclar docs de ML con MP.**

**Infra ya lista:** VPS tiene Caddy 80/443 HTTPS auto + `*.178-105-191-1.sslip.io` → webhook público = 1 entrada en Caddyfile (requisito duro RESUELTO).

**⚡ MercadoPago tiene MCP oficial hosteado** `https://mcp.mercadopago.com/mcp` (+ plugin Claude Code `/mp-connect`) — sirve para PROTOTIPAR con la cuenta del operador, NO para runtime multi-tenant (conecta 1 cuenta interactiva; no heredar a agentes autónomos = lethal trifecta).

**⚠️ Dos apps distintas, no confundir:** sandbox `6186469373750074` (test_user 3515191994) vs producción `8344232014990687` (cuenta real 146153349, la app OAuth marketplace real). El Client Secret está en Credenciales de PRODUCCIÓN.

**✅ Spike E2E validado (2026-07-02, evidencia en `uc-copiloto-b/spikes/mercadopago-oauth-checkout/RESULT.md`):** ambos supuestos críticos confirmados contra la API real — OAuth sin homologación, refresh rotante, preferencia+checkout+firma de webhook (válida aceptada + adulterada rechazada). `payment.get` code-path OK; el id real no se ejerció (bloqueo test/prod de MP, riesgo bajo).

**Deuda:** `tokens.json` en el VPS tiene un refresh_token de producción vivo → registrado en [[deuda-secretos-rotar]].

[[composio-gateway-ladrillo]] [[copiloto-emprendedor-roadmap]] [[deuda-secretos-rotar]]
