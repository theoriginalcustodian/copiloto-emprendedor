# Production-Readiness Assessment — Copiloto del Emprendedor (como SaaS)

> **Fecha:** 2026-07-06 · **Alcance:** la capa de **plataforma/producto SaaS**, *independiente de las features de dominio* (facturación, agenda, gastos, etc. — eso ya existe y no se evalúa acá). La pregunta: **¿qué le falta al copiloto para lanzarse comercialmente y cobrar con seguridad?**
> **Método:** gap analysis verificado contra el código real (no memoria); reutilización de la biblioteca de la fábrica antes de construir.

---

## 1. Veredicto de una línea

El copiloto tiene la **capa técnica** resuelta y verificada (auth dedicada, aislamiento multi-tenant, durabilidad Temporal, manejo de errores/DLQ, deploy idempotente, smoke E2E). Le falta **casi toda la capa de producto-SaaS**: monetización (planes/tiers/cobro del propio copiloto), soporte, comunicación transaccional, legal, y backoffice. **No es lanzable comercialmente todavía** — pero los gaps grandes (billing, soporte) **ya están resueltos como patrón en la biblioteca**, no se construyen de cero.

---

## 2. Lo que YA está (capa técnica — verificado esta sesión)

| Capacidad | Evidencia |
|---|---|
| **Auth dedicada** (GoTrue propia, Google OAuth, JWT) | `deploy/copiloto/gotrue/`, cutover vivo, smoke login/refresh 10/10 |
| **Aislamiento multi-tenant** [VERIFIED adversarial] | `context_factory`, `contexto_tenant`, RLS `tenant_isolation`, tests `test_adversarial_multitenant` |
| **Onboarding técnico** (alta de tenant idempotente) | `onboarding.py` — signup admin-mediado + claim `cliente_id` |
| **Durabilidad** (sobrevive cortes, reintenta) | Temporal `ConversationWorkflow` + continue-as-new |
| **Manejo de errores / DLQ** (robusto) | `autosanacion_*`, `deposito_traumas`, `interceptor_errores`, `taxonomia_errores`, `fingerprint` |
| **Observabilidad interna** | `log_estructurado` (JSON), `latido` (heartbeat), `dashboard.py` (cola/costo — fábrica) |
| **Health** | `/healthz` (verificado en smoke) |
| **Deploy idempotente + rollback** | `deploy.sh`, cutover con backup/rollback |
| **PWA + gestión de cuenta básica** | `apps/copiloto-web` módulos `account/apps/chat/connections` |
| **Pagos (del negocio del emprendedor)** | MercadoPago gateway — *nota: es para que el emprendedor cobre a SUS clientes, NO para cobrar la suscripción del copiloto* |
| **Memoria** | Graphity `memory_provider`, aislada por tenant |

---

## 3. Gap analysis — capa de producto-SaaS (verificado)

Leyenda: ✅ existe · 🟡 parcial · ❌ falta · `[reutil]` = qué de la biblioteca lo acelera.

### 3.1 Monetización — Billing & Tiers  🔴 **el bloqueante central**
| Ítem | Estado | Nota |
|---|---|---|
| Concepto de **plan/tier** | ❌ | `tenants` no tiene campo de plan (DDL bespoke: solo auth_user_id/cliente_id/email/composio_user_id) |
| **Metering** de uso | 🟡 | tabla `copiloto_metering` provisionada pero **no cableada al runtime** (aparece solo en seed/provision/conftest; sin `metering_store`) |
| **Quotas / límites** por plan | ❌ | nada |
| **Cobro recurrente del copiloto** | ❌ | el MP actual es del emprendedor, no cobra la suscripción |
| Invoices / recibos del SaaS | ❌ | — |
| Trials / free tier | ❌ | — |
| Upgrades / downgrades / prorrateo | ❌ | — |
| Dunning (reintento de cobro) | ❌ | — |
| **`[reutil]`** | | ⭐ **`billing-system`** (10 units: `billing_plans`, `billing_subscriptions`, `billing_usage_events`, `billing_invoices`) · arquetipo **`recurring_charge`** (billing-cycle+dunning, adapter `PaymentGateway.charge`) · `subscription` · `dunning` |

### 3.2 Cuenta & Auth  🟡
| Ítem | Estado |
|---|---|
| Signup / login / Google OAuth | ✅ |
| **Reset / recovery de contraseña** | ❌ (verificado: no existe) |
| Verificación de email | 🟡 (GoTrue crea `email_confirm:true` admin-mediado; sin flujo de verificación de usuario) |
| Gestión de cuenta (perfil, cambio de pass) | 🟡 (`AccountScreen` existe; alcance a confirmar) |
| MFA / 2FA | ❌ |
| Baja / cancelación de cuenta + borrado de datos | ❌ |

### 3.3 Onboarding & activación  🟡
| Ítem | Estado |
|---|---|
| Alta técnica de tenant | ✅ |
| **Wizard de onboarding UX guiado** | ❌ `[reutil]` `frontend_form_detail` |
| Conexión guiada de servicios (Composio/MP paso a paso) | 🟡 (existe `connections`; falta el flujo guiado) |
| Elegir plan al alta | ❌ (depende de §3.1) |

### 3.4 Soporte & feedback  ❌
| Ítem | Estado |
|---|---|
| **Tickets de soporte** | ❌ `[reutil]` ⭐ `helpdesk` (tickets+comentarios) · `tickets-sla` (SLA en Temporal) · `backend_temporal_hitl` |
| Help center / FAQ | ❌ |
| Feedback in-app | ❌ `[reutil]` `feedback-form` |
| Status page pública | ❌ `[reutil]` `status-page` |

### 3.5 Seguridad & compliance  🟡
| Ítem | Estado |
|---|---|
| RLS / aislamiento cross-tenant | ✅ [VERIFIED] |
| **Rate limiting / anti-abuse** | ❌ (verificado: no hay throttling propio del front-door) — importante por **costo de LLM** |
| Rotación de secretos | 🟡 deuda registrada (`deuda-secretos-rotar`) |
| **Audit log de producto** (quién hizo qué) | ❌ (`auditor_parches` es auto-healing, no audit-trail) `[reutil]` `audit` app |
| GDPR: export / borrado de datos | ❌ |
| **ToS + Política de privacidad** | ❌ (obligatorio para cobrar) |

### 3.6 Observabilidad & SRE  🟡
| Ítem | Estado |
|---|---|
| Logs estructurados + error tracking/DLQ | ✅ (fuerte) |
| Health / readiness | ✅ |
| **Métricas de negocio** (MRR, activos, uso, funnel) | ❌ |
| **Alerting** (caída, error rate, gasto LLM) | ❌ `[reutil]` `alerting-monitor` + fleet-platform `obs-*` |
| Uptime / monitoring externo | ❌ |
| **Backups / DR de datos** | 🟡 datos en `fusion` (Supabase self-host) — **verificar** estrategia real (blueprint/fleet-platform) |
| Rollback de deploy | ✅ |

### 3.7 Comunicación transaccional  ❌
| Ítem | Estado |
|---|---|
| **Email transaccional** (bienvenida, verificación, aviso de cobro, dunning) | ❌ (verificado) `[reutil]` `notification_dispatch` |
| Notificaciones in-app | 🟡 (el chat existe; sin canal de avisos de producto) |
| Recordatorios / lifecycle | ❌ |

### 3.8 Admin / operación  ❌
| Ítem | Estado |
|---|---|
| **Backoffice / panel admin** (ver tenants, planes, uso, soporte) | ❌ (solo la admin API de GoTrue para alta) |
| Gestión de tenants (suspender, cambiar plan a mano) | ❌ |
| Impersonation / soporte asistido | ❌ |
| Feature flags | 🟡 (hay flags de deploy sueltos, sin sistema) |

### 3.9 Legal / producto de cara al usuario  ❌
| Ítem | Estado |
|---|---|
| Pricing page | ❌ |
| ToS / Privacidad / Cookies | ❌ |
| Página de cuenta con plan/uso/facturas | ❌ (depende de §3.1) |

### 3.10 Infra / escala  ⏳ (diferido — Fase 3)
3 nodos dedicados · load test · CDN — ya planificado como Fase 3 (`copiloto-arquitectura-prod-3-nodos`). No bloquea un lanzamiento beta-pago controlado.

---

## 4. Priorización (qué bloquea qué)

| Prioridad | Criterio | Ítems |
|---|---|---|
| **P0 — bloquea COBRAR** | sin esto no hay negocio ni se puede facturar legalmente/seguro | **Billing & Tiers** (§3.1) · **ToS + Privacidad** (§3.5/3.9) · **rate-limiting** (§3.5, costo LLM) · **reset password** (§3.2) · **email transaccional** mínimo (§3.7) |
| **P1 — bloquea OPERAR** | necesario para sostener usuarios pagos sin romperse | **Soporte/tickets** (§3.4) · **backoffice admin** (§3.8) · **métricas de negocio + alerting** (§3.6) · **metering runtime** (§3.1, habilita tiers por uso) · **onboarding wizard** (§3.3) · **backups/DR verificados** (§3.6) |
| **P2 — mejora** | valor incremental, no bloqueante | MFA · GDPR export/borrado · status page pública · feedback in-app · analytics/funnel · impersonation |

---

## 5. Roadmap propuesto (Plan v1 — pragmático)

Orden por dependencia + palanca, con reutilización máxima:

1. **Fundaciones de monetización** (P0): instanciar/adaptar `billing-system` como el sistema de planes+suscripciones+invoices del copiloto; **cablear `metering` al runtime** (registrar eventos de uso por tenant); definir 2-3 tiers; conectar el cobro recurrente (arquetipo `recurring_charge` + adapter a MP/Stripe). → *habilita cobrar.*
2. **Compliance mínimo para cobrar** (P0): ToS + Privacidad + pricing page + reset password + email transaccional (bienvenida/verificación/cobro) vía `notification_dispatch` + rate-limiting del front-door.
3. **Soporte** (P1): instanciar `helpdesk`/`tickets-sla`; canal de tickets desde la app; SLA + notificaciones.
4. **Operación** (P1): backoffice admin (tenants/planes/uso) + métricas de negocio + alerting (`alerting-monitor`/`obs-*`) + verificar backups de `fusion`.
5. **Pulido de activación** (P1/P2): onboarding wizard guiado + elegir plan al alta.
6. **Fase 3 infra** (ya planificada): 3 nodos + load test.

### Plan v2 (no-lineal — diferenciador)
El copiloto **es un agente conversacional**: parte de esta capa puede ser *conversacional* en vez de páginas tradicionales — onboarding guiado por el propio agente, soporte L1 respondido por el agente (con escalado a ticket humano solo si no resuelve), avisos de cobro/uso como mensajes del copiloto. Reduce superficie de UI y es un diferenciador de producto. **Trade-off:** más riesgo (el agente en el camino crítico de cobro/soporte) → requiere gates duros. Recomendación: **v1 para lo que toca dinero/legal** (billing, ToS, cobro = flujos deterministas, no agénticos) **+ v2 para onboarding y soporte L1** (donde el agente agrega valor y el error es recuperable).

---

## 6. Supuestos críticos a spikear ANTES de implementar (no ahora)

1. **Cómo cobra el copiloto su suscripción**: ¿MP (mismo gateway del emprendedor, distinta cuenta) o Stripe? ¿recurring de MP soporta el modelo de tiers? → spike del `PaymentGateway.charge` real.
2. **billing-system: microservicio vs módulo interno** — ¿se consume como app compuesta separada o se absorbe en `apps/copiloto`? Decisión arquitectónica + spike de integración (namespacing de tablas `billing_*` en `uc_factory`, ver `billing-system-sistema-compuesto` J27).
3. **GoTrue self-host: reset password + email templates** — ¿lo soporta out-of-box o hay que cablear SMTP? → spike GoTrue email.
4. **Backups de `fusion`** — ¿existe estrategia real (blueprint/fleet-platform) o es un gap de infra? → verificar, no asumir.
5. **Metering: qué se mide y cómo se cobra** — ¿por mensajes, por tokens, por acciones? define el modelo de tiers → decisión de negocio + spike de volumen.

---

## 7. Qué NO está en este assessment
Las **features de dominio** del copiloto (facturación AFIP, agenda, gastos, cobros, presupuestos, BI) — ya existen y son el producto, no la plataforma. Este doc es solo la capa que hace del copiloto un **SaaS vendible y operable**.
