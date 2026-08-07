# Plan: Producción post-beta — cobro completo + P2

> **Para:** el agente de desarrollo, cuando el operador dé la orden de arrancar esta etapa (después
> de la beta, con datos reales de uso). **De:** sesión Planificación, 2026-08-03. **Qué es esto:**
> todo lo que el brief original (`2026-07-06-production-readiness-BRIEF-implementacion.md`) tiene y
> que **NO** entró en `2026-08-03-plan-beta-sin-cobro-y-agentes-de-soporte.md` — es decir, lo que
> falta para pasar de "beta sin cobrar" a "SaaS vendible completo". **No implementa nada.** Las
> decisiones 🔴 OPERADOR del brief original siguen sin resolver — no se repiten acá en detalle, ver
> brief §5.

---

## 0. Precondición dura

Esta etapa **no arranca sin datos reales de la beta**: M5 (métricas/metering cableado, ya construido
en la etapa beta) tiene que haber corrido con usuarios de verdad el tiempo suficiente para medir uso
real, error-rate y gasto LLM por tenant — es el insumo que decide el modelo de tiers, no una
proyección. Diseñar M1 sin eso es exactamente lo que el plan de beta evitó a propósito.

## 1. M1 Billing & Tiers — completo

Lo único diferido ENTERO desde P0 del brief original.

- **Objetivo:** planes, medición de uso cableada a **límites** (no sólo visibilidad), cobro
  recurrente, dunning.
- **Reutilizar (ya inventariado en el brief, no re-buscar):** arquetipo `backend_temporal_recurring_charge`
  (cobro+dunning FIJO) · app `billing-system` (`billing_plans/subscriptions/usage_events/invoices`) ·
  app `dunning`. Namespacing J27: tablas `billing_*`/`plan_*`.
- **Decisiones 🔴 OPERADOR (del brief, sin resolver):** proveedor de cobro (MP misma cuenta / MP
  cuenta SaaS / Stripe) · modelo de tiers y qué se mide (con datos reales de la beta, no antes) ·
  microservicio separado vs módulo interno.
- **Spikes:** `PaymentGateway.charge(...)` real contra el proveedor elegido · límite de plan
  rechazando al excederse (test adversarial).
- **Done:** tenant se suscribe → cobro recurrente E2E idempotente → uso registrado → límite rechaza
  al excederse (adversarial) → factura generada.

## 2. M2 — lo que quedó afuera de la beta

La beta ya resuelve ToS/Privacidad/reset-password/email/rate-limit. Lo que falta acá:

- **Pricing page** — no tiene sentido sin tiers definidos (depende de M1).
- Legales ampliados si el modelo de cobro (M1) lo exige (términos de suscripción, facturación).

## 3. M3 Soporte — versión completa (si la beta lo justifica)

La beta usa el chat + autosanación (ver plan de beta §2) sin ticketing clásico. Esto sólo se
amplía **si la beta muestra que no alcanza** — no se construye por adelantado:

- **Reutilizar:** `helpdesk` (tickets+comentarios) · `tickets-sla` (`sla_workflow.py`, SLA durable).
- **Decisión 🔴 OPERADOR:** ¿la beta mostró que hace falta un sistema de tickets clásico además del
  agente de soporte técnico, o el modelo agéntico solo + escalado a humano (definido en el plan de
  beta §2.3) alcanza indefinidamente?
- **Done:** sólo si se arranca — emprendedor abre ticket → SLA workflow corre → notifica → agente/
  humano responde → cierra.

## 4. M4 Backoffice — UI completa

La beta usa SQL directo (pocos tenants). Esto se construye cuando el volumen de tenants ya no lo
permita:

- **Reutilizar:** arquetipo `frontend_form_detail` + patrón de `inteligencia_*` (BI existente).
- **Ojo (no negociable):** control de acceso admin ≠ tenant → test adversarial obligatorio (un
  tenant no puede tocar el backoffice) antes de declarar listo.
- **Done:** admin lista tenants, ve uso/plan, suspende/cambia plan a mano, ve tickets.

## 5. M6 Onboarding — wizard completo con selección de plan

La beta tiene onboarding mínimo sin "elegir plan" (no hay planes). Esto se completa cuando M1 exista:

- Integra M1 (elegir plan) + conexión guiada de servicios (ya existe, `connections`).
- **Plan v2 (evaluar entonces, no ahora):** onboarding conversacional por el propio agente.
- **Done:** emprendedor nuevo → wizard → elige plan → conecta servicios → copiloto activo, E2E.

## 6. M-WEB — Paridad funcional de `copiloto-web` (agregado 2026-08-03, operador)

**El foco fue mobile; `copiloto-web` quedó atrás — cuantificado, no una impresión.** Comparando
módulos reales (`apps/mobile/src/modules/` vs `apps/copiloto-web/src/modules/`, ambos grepeados
2026-08-03):

- **Mobile tiene 17 módulos:** `actividad`, `afip`, `ajustes`, `apps`, `auth`, `captura`, `chat`,
  `clientes`, `contabilidad`, `escritorio`, `facturacion`, `gastos`, `ingresos`, `inteligencia`,
  `midia`, `presupuestos`, `recientes`.
- **Web tiene 4:** `account`, `apps`, `chat`, `connections` (127 archivos — no es un scaffold vacío;
  tiene shell/auth/design-system sólidos, ver `shell/`, `auth/`, `design-system/`) — pero **falta toda
  la capa de gestión del negocio**: sin `gastos`, `clientes`, `ingresos`, `presupuestos`, `facturacion`
  (AFIP), `actividad` (feed), `contabilidad`, `inteligencia` (consultas BI). El chat solo no cubre lo
  que esos módulos resuelven en mobile.

**Por qué importa:** el producto necesita **ambas superficies** — el copiloto no es sólo una app de
bolsillo, un emprendedor también lo va a querer abierto en el escritorio del negocio. Hoy el web es
usable para chatear y conectar servicios, pero no para gestionar el negocio sin volver a mobile.

**🔴 Diferido explícitamente a POST-beta** (decisión operador 2026-08-03) — no se toca hasta que el
sprint BETA cierre. Se documenta acá para que no se pierda, no para arrancarlo ahora.

**Qué hacer cuando se retome (spike-first, no asumir portabilidad 1:1):**
1. Spike de una pantalla simple (`gastos` es buen candidato — ya tiene store/API compartida
   `apps/copiloto/gasto_store.py`) portada a web, para medir cuánto del patrón de mobile (formularios,
   cards de chat, `FormularioGasto.tsx` como referencia) traduce directo a React web vs necesita
   rediseño — el shell web ya es responsive (`ResponsiveShell.tsx`, `useBreakpoint.ts`), pero los
   módulos de negocio en sí nunca se portaron.
2. Priorizar por qué módulo el emprendedor más pide desde escritorio (dato a juntar durante la beta vía
   BETA-1a feedback) antes de portar los 13 restantes a ciegas.
3. Backend: los endpoints ya son compartidos entre mobile/web (mismo `POST /chat` + REST); esto es
   trabajo de **frontend web**, no requiere nuevo backend salvo gaps puntuales que el spike revele.

**Done (cuando se arranque, no ahora):** copiloto-web tiene paridad funcional con mobile en los módulos
de negocio priorizados — no necesariamente los 13 el mismo día, pero ninguno permanentemente ausente
sin que sea una decisión explícita.

## 7. P2 — mejora, no bloqueante (íntegro, sin tocar del brief original)

| Ítem | Nota |
|---|---|
| MFA/2FA | Sin evaluar todavía — depende de qué exige el proveedor de cobro elegido en M1 |
| GDPR (export + borrado de datos por tenant) | Relevante si hay usuarios en jurisdicción UE — 🔴 OPERADOR confirma alcance geográfico antes de dimensionar |
| `status-page` pública | App ya inventariada (`theoriginalcustodian/status-page`) |
| Analytics/funnel de producto | — |
| Impersonation para soporte | Depende de que M3 completo (§3) se construya primero — impersonation es una feature DE ese sistema |

## 8. Orden y dependencias (post-beta)

```
M1 Billing&Tiers ──┬─> M2 pricing page
   (datos de M5    ├─> M5 (ya cableado en beta) confirma límites reales
    de la beta)     └─> M6 wizard completo (elegir plan)
M3 completo (si la beta lo pide) ──> impersonation (P2)
M4 Backoffice ──> cuando el volumen de tenants supere lo manejable por SQL
GDPR ──> si hay usuarios UE (confirmar con operador)
M-WEB (§6) ──> independiente del resto, arranca cuando el operador lo priorice post-beta
```

## 9. Referencias
- Brief original (fuente de los módulos, biblioteca a reutilizar): `2026-07-06-production-readiness-BRIEF-implementacion.md`
- Lo que SÍ entró en la etapa anterior: `2026-08-03-plan-beta-sin-cobro-y-agentes-de-soporte.md`
- Economía/COGS (insumo para tiers): `memoria/copiloto-economia-cogs.md`

## 10. DoD — SaaS listo para producción/cobro (binario, verificable, no autoevaluación)

**Precondición dura (no se evalúa nada de acá abajo sin esto):** el DoD del plan de beta (§6 de
`2026-08-03-plan-beta-sin-cobro-y-agentes-de-soporte.md`) está en verde, con al menos una ventana de
uso real medida (M5) que informó el modelo de tiers — no una proyección.

1. **M1 Billing E2E:** un tenant se suscribe a un plan → `PaymentGateway.charge(...)` cobra contra el
   proveedor real elegido, con idempotencia probada (2 intentos con la misma `idempotency_key` → un
   solo cobro) → el uso se registra en `billing_usage_events` → **test adversarial**: exceder el
   límite del plan → la acción se **rechaza** (no sólo se loguea) → una factura queda generada y
   consultable. Todo contra el proveedor real (o su sandbox oficial), no un mock.
2. **Dunning:** un cobro fallido dispara el flujo de reintento (`dunning`) según la máquina de
   estados del arquetipo — probado con un fallo real inducido (tarjeta de test rechazada), no leído
   del código.
3. **Pricing page:** live, con los tiers y precios que decidió el operador (no placeholders),
   linkeada desde el signup.
4. **M3 completo (sólo si el operador confirmó que la beta lo justificó — §3, ítem del plan de
   beta):** un ticket abierto por el usuario corre su SLA workflow, notifica, y cierra — E2E. Si el
   operador no lo pidió, este ítem es `N/A`, no bloquea el resto.
5. **M4 Backoffice:** admin lista tenants/uso/plan/tickets y puede suspender/cambiar plan a mano —
   con **test adversarial obligatorio**: un tenant intenta acceder al backoffice → denegado. Sin este
   test, el control es `[UNVERIFIED]` y el ítem no cierra (regla dura del repo, `CLAUDE.md` §Seguridad).
6. **M6 Onboarding completo:** usuario nuevo → wizard → elige plan (real, cobra) → conecta servicios
   → copiloto activo. E2E en device.
7. **P2, cada ítem con su propio criterio binario o `N/A` explícito con la razón:**
   - MFA/2FA: `N/A` si el proveedor de cobro elegido no lo exige; si lo exige, E2E de login con 2FO.
   - GDPR: `N/A` si el operador confirmó que no hay usuarios en jurisdicción UE; si los hay, export +
     borrado de datos de un tenant, probado, no sólo el endpoint escrito.
   - `status-page`: pública, accesible, reflejando el estado real del servicio (no un mock estático).
   - Analytics/funnel: dashboard con al menos un funnel real medido (signup→activo→pago).
   - Impersonation: `N/A` si M3 completo (ítem 4) es `N/A`; si no, un admin impersona un tenant con
     auditoría de la acción registrada (quién, cuándo, qué tenant).
8. **M-WEB (§6):** `copiloto-web` alcanza paridad funcional con mobile en los módulos de negocio que
   el operador priorizó durante la beta — no bloquea el resto de la producción (no depende de M1/M5),
   pero tampoco cierra por sí sola sin evidencia: al menos 1 módulo portado y usable E2E en web, no
   sólo "el shell está listo para portarlo".
9. **Ningún ítem se declara listo por autoevaluación** — mismo estándar que el DoD de beta: evidencia
   ejecutable (test en VPS, E2E en device, o contra el proveedor real), nunca "el código ya lo hace".

**Producción abre cuando 1, 2, 3, 6, y 9 están en verde**, y cada ítem de 4, 5, 7, 8 está en verde o
`N/A` explícito con su razón — nunca ausente en silencio.

---

## 10. Orden de ejecución de los DoD (instrucción del operador, 2026-08-03)

El DoD de este documento **y** el DoD del plan de beta (§6 del otro doc) son las condiciones de
"terminado" hasta producción — no se corre ninguno de los dos ahora. **El DoD de beta se dispara
recién cuando termine todo el trabajo actualmente abierto** en `coordinacion/` (la cola viva de hoy:
GF2 y lo que quede en curso de las 3 sesiones) — no antes. Este documento (producción) se dispara
después de que el DoD de beta cierre en verde, per §0/precondición. Nada de esto se baja como
`contrato_` hasta que el operador dé la orden explícita de arrancar cada etapa.
