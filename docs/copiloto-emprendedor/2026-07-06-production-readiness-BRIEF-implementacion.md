# BRIEF de implementación — Capa de Production-Readiness SaaS

> **Para:** el agente de desarrollo de este repo (`copiloto-emprendedor`).
> **De:** sesión de arquitectura/dirección (el plano, no la orden).
> **Qué es esto:** el plan de trabajo para llevar el copiloto de "técnicamente sólido" a "**SaaS vendible y operable**". NO es la capa de features de dominio (facturación, agenda, gastos — ya existen); es la capa de **plataforma/producto**.
> **Evaluación que lo respalda:** `2026-07-06-production-readiness-assessment.md` (gap analysis verificado). Leé ese primero para el "por qué".
> **Cómo usar este brief:** cada módulo trae *qué reutilizar (con paths reales)*, *qué decidir*, *qué spikear*, y *criterio de done verificable*. **Los spikes y la implementación los hacés vos** (esta sesión no implementa). Las decisiones marcadas 🔴 **OPERADOR** son del humano — no las asumas: escalá.

---

## 0. Reglas del proyecto que aplican a TODO lo de acá (no negociable)

Del `CLAUDE.md` de este repo — releélo, pero en corto:
1. **Temporal es la columna.** Antes de tocar cualquier workflow/activity/worker → invocá la skill `temporal-developer` (+ `temporal-ai-patterns` para HITL/ReAct). Determinismo: I/O y tiempo van en activities.
2. **Tests en el VPS**, nunca en la PC (no hay `temporalio`/`psycopg2` local). `deploy/copiloto/sync-test-backend.sh`. **No declares verde sin correrlo en el VPS.**
3. **No codificar la esperanza / spike-first.** Todo supuesto crítico (API externa, schema, integración, capacidad LLM, comportamiento actual) → spike mínimo desechable en `spikes/<nombre>/` con `RESULT.md` ANTES de diseñar. Evidencia ejecutable, no autoevaluación.
4. **Multitenant real:** ningún `cliente_id`/seller sale de env — per-request vía `context_factory`/`TenantCtx`. Todo control de acceso nuevo exige **test adversarial** (actor A intenta lo de B → denegado) antes de declararse listo.
5. **Namespacing de tablas por módulo (regla J27, DURA):** en el schema compartido `uc_factory`, toda tabla nueva va prefijada `<modulo>_*` (ej: `billing_plans`, `ticket_*`, `plan_*`) + guard fail-loud en el provision. Ver memoria `billing-system-sistema-compuesto`.
6. **Motor vendorizado:** `motor/` se sincroniza de la fábrica (`scripts/sync-motor.sh`); no lo edites acá salvo fork duro documentado.
7. **Cero secretos en repo · PR + rama · Conventional Commits.**

---

## 1. La biblioteca que vas a reutilizar (dónde está y cómo se accede)

**Regla de oro: reutilizar > construir.** Casi todo esto ya existe como app mergeada o arquetipo.

- **Apps de biblioteca** — cada una es un repo propio `github.com/theoriginalcustodian/<app>` y vive instanciada en el VPS `unreal-copilot:/opt/uc-repos/<app>`. Consultá su código real ahí.
- **Arquetipos** (plantillas parametrizables) — en la fábrica: `$UC_FABRICA_PATH/deploy/skeleton_kit/archetypes/<arquetipo>/` (README + `reference_impl.py`/`stub.py` + `test_stub.py`). Seteá `UC_FABRICA_PATH` al checkout de `unreal-copilot`.
- **Generador** — si un módulo amerita una app nueva de cero, la fábrica tiene `/generar-plano` (turnea idea de negocio → skeleton factory-ready). Evaluá si conviene generar vs adaptar la app existente.
- **Acceso VPS:** alias SSH `unreal-copilot`, venv del copiloto `/opt/uc-copiloto-venv`.

| Necesidad | Reutilizá | Ubicación |
|---|---|---|
| Cobro recurrente + dunning | arquetipo **`backend_temporal_recurring_charge`** (FIJO: máquina de estados ya escrita, cobro+dunning) | `skeleton_kit/archetypes/backend_temporal_recurring_charge/` |
| Planes+subs+uso+facturas | app **`billing-system`** (tablas `billing_plans`, `billing_subscriptions`, `billing_usage_events`, `billing_invoices`) | repo `theoriginalcustodian/billing-system` · VPS `/opt/uc-repos/billing-system` |
| Suscripción simple | app `subscription` (tabla `subscriptions`) | `theoriginalcustodian/subscription` |
| Reintento de cobro | app `dunning` (`backend/dunning_workflow.py`) | `theoriginalcustodian/dunning` |
| Tickets + comentarios | app **`helpdesk`** | `theoriginalcustodian/helpdesk` |
| Tickets con SLA durable | app **`tickets-sla`** (`backend/sla_workflow.py`) | `theoriginalcustodian/tickets-sla` |
| Espera humana (signal+timeout) | arquetipo **`backend_temporal_hitl`** (cosechado de `expense-approval`) | `skeleton_kit/archetypes/backend_temporal_hitl/` |
| Avisos multi-canal (email/telegram/webhook) | arquetipo **`notification_dispatch`** (canal enchufable A-1; la jaula nunca ve la key) | `skeleton_kit/archetypes/notification_dispatch/` |
| Alertas de negocio/infra | app `alerting-monitor` (`backend/monitor_workflow.py`) + `fleet-platform` `obs-*` | `theoriginalcustodian/alerting-monitor` |
| Status page pública | app `status-page` | `theoriginalcustodian/status-page` |
| Feedback in-app | app `feedback-form` | `theoriginalcustodian/feedback-form` |
| Audit trail | app `audit` | `theoriginalcustodian/audit` |
| Dashboard master/detail (backoffice, wizard) | arquetipo **`frontend_form_detail`** (done por DOM/Playwright) | `skeleton_kit/archetypes/frontend_form_detail/` |

---

## 2. Punto de partida real (verificado 2026-07-06 — no asumir otra cosa)

- **Onboarding técnico existe:** `apps/copiloto/onboarding.py` (`signup_and_provision`, idempotente, GoTrue admin-mediado). Falta el wizard UX y el "elegir plan".
- **NO hay concepto de plan/tier:** `apps/copiloto/provision.py` → `tenants` es DDL bespoke con solo `auth_user_id, cliente_id, email, composio_user_id`. Sin columna de plan.
- **Metering a medio hacer:** tabla `copiloto_metering` se provisiona pero **no está cableada al runtime** (aparece solo en `seed.py`/`provision.py`/`conftest.py`; no hay `metering_store` que registre eventos).
- **Cero soporte, cero rate-limit, cero email transaccional, cero reset-password, cero páginas legales/pricing.** (verificado leyendo el código, no por grep-count).
- **Sí hay** (no rehacer): auth GoTrue dedicada + OAuth, aislamiento multi-tenant [VERIFIED], durabilidad Temporal, manejo de errores/DLQ (`autosanacion_*`, `deposito_traumas`, `interceptor_errores`), `/healthz`, `log_estructurado`, `latido`, deploy+rollback, PWA (`account/apps/chat/connections`), MercadoPago (del negocio del emprendedor), memoria Graphity.

---

## 3. Módulos a implementar (por prioridad)

> Formato por módulo: **Objetivo · Estado actual · Reutilizar · Decisiones · Spikes · Done**.

### P0 — bloquea COBRAR

#### M1. Billing & Tiers (el central)
- **Objetivo:** que el copiloto tenga planes, mida uso, aplique límites y **cobre su suscripción** de forma recurrente.
- **Estado actual:** nada de planes; `copiloto_metering` sin runtime; `tenants` sin plan.
- **Reutilizar:** arquetipo `recurring_charge` (cobro+dunning FIJO) · app `billing-system` (esquema `billing_plans/subscriptions/usage_events/invoices`) · `dunning`. Namespacing J27: tablas `billing_*` o `plan_*`.
- **Decisiones 🔴 OPERADOR (escalá, no asumas):**
  1. **Cómo cobra el copiloto su suscripción:** MercadoPago (¿misma cuenta del emprendedor o cuenta del SaaS?) vs Stripe vs otro.
  2. **Modelo de tiers y qué se mide:** ¿por mensajes / tokens LLM / acciones / features? ¿cuántos tiers y precios? (ver `copiloto-economia-cogs` para COGS).
  3. **billing como microservicio separado (consumido por API) vs módulo interno** (`apps/copiloto`, como gastos/cobros).
- **Spikes (vos):** (a) `PaymentGateway.charge(amount_cents, idempotency_key)` real contra el proveedor elegido; (b) cablear `copiloto_metering` y medir volumen real de eventos; (c) si es microservicio: integración cross-app (namespacing + consumo por API).
- **Done (verificable en VPS):** un tenant se suscribe a un plan → se cobra recurrente E2E (con idempotencia) → el uso se registra en metering → un límite de plan **rechaza** al excederse (test adversarial) → factura generada.

#### M2. Compliance mínimo para cobrar
- **Objetivo:** poder cobrar legal y seguro.
- **Reutilizar:** `notification_dispatch` (email); `frontend_form_detail` (páginas).
- **Sub-ítems + Done:**
  - **ToS + Privacidad + pricing page** (frontend, `apps/copiloto-web`) — live y linkeadas en signup. 🔴 el TEXTO legal lo aporta el OPERADOR/abogado.
  - **Reset password** — flujo de recuperación. **Spike:** ¿GoTrue self-host lo soporta out-of-box con SMTP o hay que cablearlo? Done: usuario resetea y entra.
  - **Email transaccional** (bienvenida, verificación, aviso de cobro/dunning) vía `notification_dispatch` + SMTP. Done: email llega en cada evento.
  - **Rate-limiting** del front-door (protege costo LLM y abuse). Done: exceso de requests → 429; test lo prueba.

### P1 — bloquea OPERAR

#### M3. Soporte / tickets
- **Reutilizar:** `helpdesk` (tickets+comentarios) · `tickets-sla` (`sla_workflow.py`, SLA durable) · arquetipo `hitl`. Tablas `ticket_*`.
- **Decisión 🔴 OPERADOR:** ¿soporte L1 lo atiende el propio agente conversacional (Plan v2) con escalado a ticket humano, o es un sistema de tickets clásico?
- **Done:** emprendedor abre ticket desde la app → SLA workflow corre → notifica (via M2 email) → agente/humano responde → cierra.

#### M4. Backoffice / admin de producto
- **Objetivo:** operar el SaaS (ver/gestionar tenants, planes, uso, tickets).
- **Reutilizar:** `frontend_form_detail` + queries; patrón de `inteligencia_*` (BI existente).
- **Ojo:** control de acceso admin ≠ tenant → **test adversarial** (un tenant no puede tocar el backoffice).
- **Done:** admin lista tenants, ve uso/plan, suspende/cambia plan a mano, ve tickets.

#### M5. Métricas de negocio + alerting
- **Reutilizar:** `alerting-monitor` + `fleet-platform obs-*`. Métricas: MRR, activos, uso por tenant, **gasto LLM** (crítico), error-rate.
- **Done:** dashboard de negocio + alerta dispara ante caída/gasto-LLM-anómalo.

#### M6. Onboarding wizard (activación)
- **Estado actual:** alta técnica sí (`onboarding.py`); falta el flujo guiado.
- **Reutilizar:** `frontend_form_detail`. Integra M1 (elegir plan) + conexión guiada de servicios (ya existe `connections`).
- **Plan v2 (evaluá):** onboarding conversacional por el propio agente.
- **Done:** emprendedor nuevo → wizard → elige plan → conecta servicios → copiloto activo, E2E.

#### M7. Backups / DR verificados
- **Objetivo:** no perder datos de clientes pagos.
- **Acción:** **verificar** (no asumir) la estrategia de backup de `fusion` (Supabase self-host — ver blueprint `supabase-self-host-blueprint` + `fleet-platform`). Si no existe → cablear pg_dump + restore probado.
- **Done:** backup automático + **restore probado** en staging.

### P2 — mejora (no bloqueante)
MFA/2FA · GDPR (export + borrado de datos por tenant) · `status-page` pública · `feedback-form` in-app · analytics/funnel de producto · impersonation para soporte.

---

## 4. Orden y dependencias

```
M1 Billing&Tiers ──┬─> M6 Onboarding wizard (necesita "elegir plan")
   (+ metering)    └─> M4 Backoffice (muestra plan/uso)
M2 Compliance ─────────> habilita cobrar legal (paralelo a M1)
   (email de M2) ──────> M3 Soporte (notifica) · M1 dunning (avisa)
M5 Métricas/alerting ──> transversal (cuanto antes, mejor visibilidad)
M7 Backups ────────────> antes del primer cliente pago real
```
**Camino crítico a "cobrar":** M1 + M2. **Camino a "operar con clientes":** M3 + M4 + M5 + M7. **Pulido:** M6 + P2.

---

## 5. Decisiones 🔴 OPERADOR que destraban el arranque (lleváselas resueltas al agente)

1. **Cómo cobra el copiloto su suscripción** (MP misma-cuenta / MP cuenta-SaaS / Stripe / otro).
2. **Modelo de tiers + pricing** (qué se mide, cuántos planes, precios) — insumo: `copiloto-economia-cogs`.
3. **billing y soporte: microservicio separado vs módulo interno** (define el patrón de toda la capa).
4. **Soporte L1: conversacional (agente) vs sistema de tickets clásico.**
5. **Textos legales** (ToS/Privacidad) — los aporta el operador/abogado.

Todo lo demás (spikes, contratos, implementación, tests) lo resuelve el agente con este brief + la biblioteca.

---

## 6. Recursos
- **Assessment (el porqué):** `docs/copiloto-emprendedor/2026-07-06-production-readiness-assessment.md`.
- **Biblioteca:** repos `theoriginalcustodian/<app>` · VPS `unreal-copilot:/opt/uc-repos/<app>` · arquetipos `$UC_FABRICA_PATH/deploy/skeleton_kit/archetypes/`.
- **Memoria relevante:** `billing-system-sistema-compuesto` (J27 namespacing) · `copiloto-economia-cogs` (pricing) · `clinica-hardening-3-frentes` (test adversarial) · `r1-workflow-templates-fixed-mount` (arquetipos FIJOS) · `sprint-biblioteca-7-apps-techo-workflows` (el techo del músculo).
- **Skills:** `temporal-developer`, `temporal-ai-patterns`, `generar-plano`, `spike-first`.
