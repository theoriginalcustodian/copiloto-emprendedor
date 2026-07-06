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

**OAuth multi-tenant (EL CORAZÓN, ✅ verificado adversarial):** flujo **Authorization Code** (único que sirve para cobrar en nombre del vendedor). `GET auth.mercadopago.com/authorization` → code (10min, single-use) → `POST api.mercadopago.com/oauth/token` → devuelve en 1 respuesta: `access_token` (vendedor, **180 días**), `refresh_token` (**6 meses, single-use, ROTA en cada refresh** → storage transaccional por vendedor o se desvincula), `user_id` (id del tenant), `public_key`. Scopes: solo `offline_access`/`write`/`read`. **PKCE OPCIONAL** (no obligatorio — la doc oficial es clara; el "requires PKCE" era de la lib arcticjs, no de MP). redirect_uri estática+exacta.

**Cobros:** `POST /checkout/preferences` con Bearer del vendedor → devuelve `init_point` = **el link de pago**. `external_reference` = clave de reconciliación con el BI. ⚠️ **Payment Links simples NO soportan webhooks → usar PREFERENCIAS** (no link simple) para reconciliación automática.

**Leer pagos (BI):** `GET /v1/payments/search` → ⚠️ **solo últimos 12 meses** → persistir en `uc_factory` a medida que llegan, no re-consultar histórico.

**Webhooks:** `notification_url` por preferencia (tiene precedencia sobre el panel). Header **`x-signature`** = `ts=...,v1=<HMAC-SHA256>`; validar recomponiendo manifest (data.id + x-request-id + ts) con la secret del panel. Flujo: webhook trae solo `id` → validar firma → `GET /v1/payments/{id}` (fuente de verdad del monto) → `uc_factory`.

**SDK:** oficial `pip install mercadopago` (Python 3.9+, v3.3.0 2026-06-30). **Usar ≥3.3.0** por el `WebhookSignatureValidator` (evita HMAC a mano) — v≤3.2.0 tenía bug de case-sensitivity en `data.id` del manifest (rechazaba webhooks legítimos, F4). Corre como **activity de Temporal** (I/O→activity).

**⚠️ REFUTADO (no repetir):** el access_token NO expira a las 6h ni hay "4 causas de invalidación temprana" — eso era de **Mercado LIBRE** (global-selling), NO Mercado Pago. Dura 180 días. **No mezclar docs de ML con MP.**

**Infra ya lista:** VPS tiene Caddy 80/443 HTTPS auto + `*.178-105-191-1.sslip.io` → webhook público = 1 entrada en Caddyfile (requisito duro RESUELTO).

**Context7 (2026-07-02) cerró 3 de los 4 puntos del spike** (`/mercadopago/sdk-python` 1054 snippets): **manifest x-signature EXACTO** = `f"id:{data_id.lower()};request-id:{x_request_id};ts:{ts};"` + HMAC-SHA256 (el `.lower()` explica el bug F4) → usar `WebhookSignatureValidator.validate(x_signature, x_request_id, data_id, secret, tolerance_seconds=300)` del SDK, NO a mano · preferencia = `sdk.preference().create({...})["response"]["init_point"]` (201) · `sdk.payment().search({external_reference})` (200) + `sdk.payment().get(id)`. **⚡ Hallazgo: MercadoPago tiene MCP oficial hosteado** `https://mcp.mercadopago.com/mcp` (+ plugin Claude Code `/mp-connect`) — sirve para PROTOTIPAR con la cuenta del operador, NO para runtime multi-tenant (conecta 1 cuenta interactiva; no heredar a agente autónomo = lethal trifecta).

**✅ SPIKE VALIDADO E2E (2026-07-02, ambos supuestos, evidencia en `uc-copiloto-b/spikes/mercadopago-oauth-checkout/RESULT.md`):**
- ⭐ **S1 — OAuth SIN homologación bloqueante = CONFIRMADO.** El operador autorizó **directo** (app producción `client_id 8344232014990687`) → `POST /oauth/token` HTTP 200 → `access_token` (180 días, live_mode) + `refresh_token`. **Onboarding de vendedor = 1 clic "Conectar" (cero fricción real, como Composio).** La app marketplace se habilita completando el form de negocio (industria+web+T&C, se usó `https://mp.178-105-191-1.sslip.io`), **sin revisión manual**.
- **refresh CONFIRMADO rotante:** `refresh → HTTP 200`, access_token **y** refresh_token **rotan** (single-use) → el gateway DEBE persistir el par nuevo tras cada refresh o se desvincula el vendedor.
- **S2 — link + webhook + firma = VALIDADO.** `POST /checkout/preferences` HTTP 201 → init_point resuelve E2E (checkout renderizó). Firma webhook: **válida aceptada + adulterada rechazada** (self-test: firmé con hmac stdlib, el serve validó con el SDK). `payment.get` code-path OK (404 en id inventado; real no ejercitado por bloqueo test/prod de MP — riesgo bajo).
- **⚠️ CORRECCIÓN al manifest:** leí la fuente del SDK (`mercadopago/webhook/validator.py`, v3.3.0): el manifest es `id:<data_id>;request-id:<x_request_id>;ts:<ms>;` **SIN `.lower()`** en data.id (el `.lower()` del research/Context7 quedó como dead-path inocuo en el spike; ids de pago son numéricos). `ts` en **ms**. Usar el SDK, no reimplementar.
- **⚠️ DOS apps distintas:** sandbox `6186469373750074` (test_user 3515191994, para S2) vs producción `8344232014990687` (cuenta real 146153349, la app OAuth marketplace real). El Client Secret está en Credenciales de PRODUCCIÓN. No confundirlos.
- **Deuda:** `tokens.json` en el VPS tiene un refresh_token de producción vivo → registrar en [[deuda-secretos-rotar]]. Spike desechable: `MercadoPagoGateway` (2º boundary, junto al `ComposioGateway`) se construye desde cero según el research + estas confirmaciones.

[[composio-gateway-ladrillo]] [[copiloto-emprendedor-roadmap]] [[deuda-secretos-rotar]]
