# Decisiones de diseño — `MercadoPagoGateway`

> **Fecha:** 2026-07-02 · **Estado:** decisiones CERRADAS, listo para `writing-plans` cuando se priorice el build · **Tipo:** MAYOR (boundary + credenciales por tenant).
> Resuelve las *open questions* del follow-up (`docs/Follow up/2026-07-02-mercadopago-gateway-impl-followup.md`). Fundado en una investigación de precedentes del repo (2026-07-02) — reusar antes de crear, no improvisar.
> **2 decisiones las tomó el operador** (seguridad + irreversibilidad); el resto las cerró la IA siguiendo la convención existente.

---

## Hallazgo raíz de la investigación

**No hay precedente de guardar tokens OAuth propios:** el `ComposioGateway` delega el 100% de la custodia a Composio (`connected_accounts.link`, solo referencia por `user_id`) — nunca hace `INSERT` de una credencial (`deploy/skeleton_kit/archetypes/conversational_agent/reference/clients/agent/providers/composio_gateway.py:154-209`). **MercadoPago no está en Composio → `MercadoPagoGateway` es el PRIMER boundary que persiste credenciales él mismo.** Por eso el storage cifrado + multi-tenant es genuinamente nuevo y MAYOR.

## Decisiones

| # | Open question | Decisión | Quién | Fundamento (evidencia) |
|---|---|---|---|---|
| 1 | Storage de tokens | Tabla **`mp_credentials`** en `uc_factory` (namespaced con prefijo `mp_`) | IA | No hay precedente propio → se crea siguiendo el patrón de `uc_factory`. |
| 2 | **Cifrado en reposo** | **App-level Fernet (simétrico)** — cifrar `access_token`/`refresh_token` en el código antes de `INSERT`; llave simétrica en el env (como los demás secretos) | **Operador** | El token NO es columna-clave → cifrarlo NO rompe RLS/dedup. Descarta **pgcrypto a nivel columna**, prohibido por convención (`deploy/skeleton_kit/reference/hardening_reference.sql:154-158`: *"NO column-pgcrypto: rompe dedup/RLS sobre columnas-clave"*). Consistente con la doctrina global "encriptación simétrica para passwords sensibles". No hay ningún helper de cifrado hoy → se crea uno mínimo (Fernet). |
| 3 | Multi-tenant / RLS | Patrón `uc_factory`: `cliente_id uuid` + RLS `tenant_isolation` + namespacing `mp_`. **⚠️ Barrera real = filtro `cliente_id` explícito en CADA query del gateway** (el worker usa rol *owner* que **bypassa RLS**) + **test adversarial obligatorio** (A pide credencial de B → denegado) | IA | `deploy/worker/provision_tables.py:89-122` (patrón RLS + guard anti-colisión). Bypass del owner confirmado en `apps/copiloto/reply_store.py:4-6`. Regla dura de seguridad: control de aislamiento **sin test adversarial = no verificado**. |
| 4 | **Estrategia de refresh** | **Loop durable proactivo (Temporal)** — un workflow por vendedor con `workflow.sleep` + refresh periódico antes de vencer; persiste el **par rotado de forma atómica**; idempotente por `(cliente_id, cycle)` | **Operador** | Molde del arquetipo `backend_temporal_recurring_charge/stub.py:103-142` (loop durable con `wait_condition`/`sleep` + backoff). **No hay precedente de Temporal Schedules/Cron** → el loop durable es el patrón del repo. Evita la carrera que quema el `refresh_token` single-use (validado rotante en el spike). |
| 5 | Onboarding UX | **MVP:** el gateway expone `connect_url(cliente_id)`; el agente/operador **pasa el link** al vendedor (mismo patrón que Composio hoy). Callback OAuth **productivo nuevo**. UI self-serve **diferida** | IA | Hoy el "Conectar" es un script CLI que imprime el link (`archetypes/conversational_agent/tools/enable_services.py:74-77`); no hay UI ni flujo de chat. El único callback que existe es el del spike (desechable). No sobre-construir UX antes de tener demanda. |
| 6 | Webhook productivo | Endpoint **productivo** (dominio real + Caddy, NO el `sslip.io` del spike), validación `x-signature` vía **SDK** (`WebhookSignatureValidator`, manifest SIN `.lower()`), **idempotente por `payment_id`**, `notification_url` per-preferencia | IA | Confirmado en el spike (`spikes/mercadopago-oauth-checkout/RESULT.md`). El handler del spike es desechable. |
| 7 | Reconciliación BI | `external_reference` = clave de negocio; persistir pagos **a medida que llegan** (webhook → `get_payment`) + backfill con `search_payments` (**ventana 12 meses**) | IA | Ventana de 12m documentada en el research; persistir, no re-consultar histórico. |

## Contrato del boundary (confirmado)

`MercadoPagoGateway` (fail-closed, per-tenant, simétrico al `ComposioGateway`):
`connect_url(cliente_id)` · `exchange_code(cliente_id, code)` · `refresh(cliente_id)` · `create_payment_link(cliente_id, *, amount, external_reference, …)→init_point` · `get_payment(cliente_id, payment_id)` · `search_payments(cliente_id, *, since)` · `verify_webhook(headers, data_id)`.
Todo I/O de red → **activities de Temporal** (workflow determinista).

## Capa plantilla vs capa cliente (para reusar en apps nuevas)

- **Genérico (una vez, en el gateway):** OAuth (authorize/exchange/refresh rotante), cifrado Fernet, validación de firma, contrato del boundary, workflow de refresh. → **se importa/vendorea, NO se copia-pega.**
- **Específico por app:** llave Fernet propia, tabla `mp_credentials` con su `cliente_id`, cómo se surface el "Conectar", reconciliación con SU modelo de BI.

## Pendiente de verificar (no bloquea el diseño)

- `[ASSUMED_PENDING_VERIFY]` — ¿el go-live de producción con **dinero real de terceros** exige homologación/certificación aparte? El spike validó que el **OAuth** no la exige; el alta productiva de un marketplace puede tener un paso separado. Verificar antes de mover dinero real.

## Próximo paso

Cuando se priorice el frente de pagos/BI → `superpowers:writing-plans` con estas decisiones como input. Deuda registrada: `tokens.json` de producción vivo en el VPS del spike ([[deuda-secretos-rotar]]).

## Referencias
- Follow-up: `docs/Follow up/2026-07-02-mercadopago-gateway-impl-followup.md`
- Research: `docs/copiloto-emprendedor/2026-07-02-mercadopago-integracion-research.md`
- Spike (evidencia): `spikes/mercadopago-oauth-checkout/RESULT.md` (PR #106)
- Boundary hermano: `ComposioGateway` + `COMO_AGREGAR_SERVICIO_COMPOSIO.md`
