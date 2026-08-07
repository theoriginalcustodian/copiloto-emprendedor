# Plan: Beta sin cobro + agentes de soporte técnico (reemplazo del equipo humano)

> **Para:** el agente de desarrollo de este repo (backend/frontend/manejo-de-errores), cuando el
> operador dé la orden de arrancar. **De:** sesión Planificación, a partir de decisión del operador
> 2026-08-03. **Qué es esto:** reprioriza `2026-07-06-production-readiness-BRIEF-implementacion.md`
> contra el objetivo real de esta etapa (beta con usuarios reales, sin cobrar, para testear
> funciones y juntar feedback) + define el rol del agente de soporte técnico. **No implementa nada
> — es el plano.** Las decisiones marcadas 🔴 OPERADOR siguen sin resolver.

---

## 0. Objetivo de esta etapa (lo que cambia todo el orden)

Abrir el copiloto a usuarios reales **sin cobrar**, para (a) validar que las funciones andan con
gente de verdad y (b) juntar feedback. Esto saca a M1 (Billing&Tiers) del camino crítico completo —
no tiene sentido diseñar tiers/precios antes de tener datos reales de uso (ver M5).

## 1. Qué se necesita para abrir la beta (P0 de ESTA etapa)

| Ítem | Estado hoy (verificado) | Qué falta |
|---|---|---|
| **Mecanismo de feedback in-app** | No existe (grepeado: 0 hits reales, sólo usos genéricos de la palabra "feedback" en UI de gestos/autosanación) | Construir. Era P2 en el brief original, acá es lo primero — es el objetivo explícito de la beta. |
| ToS + Privacidad (mínimo) | No existe | 🔴 OPERADOR aporta el texto (o autoriza plantilla genérica para esta etapa) |
| Reset password | No existe | Spike: ¿GoTrue self-host lo soporta out-of-box con SMTP? |
| Email transaccional (bienvenida/verificación) | No existe | Vía `notification_dispatch` (arquetipo ya inventariado en el brief) |
| Rate-limiting del front-door | No existe (grepeado: sólo un label en `taxonomia_errores.py`, no middleware real) | Protege costo LLM aunque no haya billing |
| **M5 Métricas/alerting** | Parcial (`copiloto_metering` se provisiona pero no está cableado a runtime, per brief §2) | Cablear metering + ver uso/error-rate/gasto LLM por tenant — es el insumo para diseñar tiers DESPUÉS |
| M7 Backups/DR | Sin verificar la estrategia real de `fusion` | Verificar (no asumir) + restore probado en staging — dato real de gente real |
| M6 Onboarding, versión mínima | Alta técnica ya existe (`onboarding.py`) | Wizard sin el paso "elegir plan" (no hay planes todavía) |

**Se resuelve liviano, no con la app completa de la biblioteca:**
- M3 Soporte de USUARIO: no hace falta `helpdesk`+`tickets-sla` — ver §2, el chat mismo es el soporte L1.
- M4 Backoffice: con pocos tenants de beta, SQL directo alcanza. No construir UI de admin todavía.

**Diferido entero:** M1 Billing&Tiers completo (planes, cobro, dunning) — se diseña con los datos
reales de M5, no antes.

**Diferido, fuera de esta etapa (P2 del brief original, ninguno bloquea la beta):** MFA/2FA · GDPR
(export + borrado de datos por tenant) · `status-page` pública · analytics/funnel de producto ·
impersonation para soporte. No se reevalúan acá — siguen en `2026-07-06-production-readiness-BRIEF-implementacion.md` §3 P2 tal cual.

## 2. Modelo de soporte — decisión ya tomada (2026-07-01, `memoria/copiloto-economia-cogs.md`)

**Sin humano por-cliente. Soporte técnico = agentes (chat conversacional + autohealing).** Humanos
= sólo casos extremos, infra fija de la agencia (el operador), no algo que escale por cliente.

### 2.1 Lo que ya existe y se reutiliza (verificado en código, no asumido)

El pipeline de autosanación ya está construido y en prod: una excepción real dispara
`interceptor_errores.py` → `deposito_traumas.py::depositar()` → `TraumaStore` (DLQ) →
`autosanacion_workflow.py`/`forjador_parches.py` → **abre PR, nunca mergea** (ver
`memoria/no-romper-no-es-arreglar.md`, gate que distingue "arregla" de "no rompe"). Igual para
issues de GitHub (`memoria` menciona "lo que el ciclo no puede reparar abre un issue").

`depositar()` (`apps/copiloto/deposito_traumas.py:37`) toma campos **estructurados**
(`fingerprint`, `workflow`, `error_type`, `cliente_id`, `costura`, `contexto: dict`) — **no** un
objeto de excepción de Python. Estructuralmente admite un ticket sintetizado desde otro origen, no
sólo desde un `except`.

### 2.2 El hueco real (por qué hace falta un rol nuevo, no un sistema nuevo)

Hoy la autosanación **sólo se dispara con una excepción técnica real**. No hay entrada para "el
usuario reportó que algo anda mal" sin que haya un error de por medio (ej: una respuesta del agente
que es incorrecta pero no rompe nada, una función que no hace lo que el usuario esperaba). Ese es el
rol del **agente de soporte técnico**: una vía de ingreso nueva al MISMO pipeline, revisando
síntomas reportados (por chat) y sintetizando un ticket (`depositar()` con los campos que
correspondan) cuando detecta un problema real — no un sistema de tickets ni un healing paralelo.

**`[ASSUMED_PENDING_VERIFY]` — spike obligatorio antes de construir esto:** `forjador_parches.py`
fue diseñado para diagnosticar desde `error_type`/stack trace/fingerprint de una excepción real. No
está verificado que pueda producir un fix útil a partir de una descripción en texto libre de un
síntoma sin traceback (ej: "el agente inventó un contacto" en vez de un `TypeError`). Antes de
construir el agente de soporte, correr un spike: sintetizar 2-3 tickets de síntomas reales (no
técnicos) contra `forjador_parches` real y ver qué produce. Si el forjador no puede actuar sobre
síntomas sin traceback, el agente de soporte necesita clasificar primero (¿es reproducible como
error técnico? ¿es un problema de prompt/comportamiento que no es "un bug" en sentido clásico?) antes
de tickear — eso cambia el diseño.

### 2.3 Separación de responsabilidades (agentes, no personas)

| Rol | Reemplaza a (equipo humano) | Ya construido | Falta |
|---|---|---|---|
| Chat conversacional (motor ReAct) | Soporte L1 | ✅ Sí | — |
| Agente de soporte técnico | Triage / soporte L2 | Parcial (reutiliza `depositar()`) | La vía de ingreso desde síntomas + spike de §2.2 |
| Autosanación (`interceptor_errores`→DLQ→`forjador_parches`) | Ingeniero que arregla bugs conocidos | ✅ Sí, en prod | Ampliar el tipo de ticket que acepta (ver spike) |
| Revisor de PR | QA / code review humano | Gate existente distingue "arregla" de "no rompe" (`no-romper-no-es-arreglar`) | — |
| Merge a main | — | **Nadie lo hace automático** — ningún agente mergea, sólo abre PR/issue. Esto NO cambia. | — |

## 3. Decisiones 🔴 OPERADOR pendientes

1. ¿Feedback in-app (form dentro de la app) o alcanza un canal externo para esta etapa?
2. Textos legales mínimos (ToS/Privacidad) — ¿los aportás vos o autorizás plantilla genérica temporal?
3. Cuántos beta testers y cómo se suman (invitación directa / lista de espera).
4. Confirmar que el agente de soporte técnico entra en el alcance de ESTA etapa, o es la etapa
   siguiente (post-beta) — no está decidido, sólo diseñado el camino.

## 4. Orden sugerido (cuando el operador dé la orden de arrancar)

```
1. Spike §2.2 (forjador_parches vs síntomas sin traceback) — de-risk antes de comprometer diseño
2. Feedback in-app + M5 metering cableado (en paralelo, son independientes)
3. M2 subset (ToS/Privacidad con texto del operador, reset password, email transaccional, rate-limit)
4. M7 backups verificados
5. Agente de soporte técnico (si el spike de (1) da verde) + M6 onboarding mínimo
6. Abrir beta a los primeros usuarios
```

## 5. Referencias
- Brief original (todos los módulos, prioridad de cobro): `2026-07-06-production-readiness-BRIEF-implementacion.md`
- Assessment (el porqué): `2026-07-06-production-readiness-assessment.md`
- Decisión de soporte sin-humano: `memoria/copiloto-economia-cogs.md` (operador, 2026-07-01)
- Pipeline de autosanación real: `apps/copiloto/interceptor_errores.py`, `deposito_traumas.py`, `autosanacion_workflow.py`, `forjador_parches.py`

## 6. DoD — la beta está lista para abrir (binario, verificable en VPS/device, no autoevaluación)

1. **Feedback in-app:** el usuario envía feedback desde la app → queda persistido y visible para el
   operador (SQL directo alcanza) → E2E probado en device con `e2e-device@copiloto.test`.
2. **ToS + Privacidad:** páginas live en `apps/copiloto-web`, linkeadas desde el signup, con el texto
   que aportó el operador (o la plantilla que autorizó explícitamente — no una genérica sin su ok).
3. **Reset password:** un usuario real pide el reset → recibe el email → entra con la nueva
   contraseña. E2E, no sólo "GoTrue lo soporta en docs".
4. **Email transaccional:** bienvenida y verificación llegan a una casilla real al completar cada
   evento — probado con un envío real, no un log de "se intentó enviar".
5. **Rate-limiting:** un test que excede el límite del front-door recibe **429** — test automatizado
   en el VPS, no inspección de código.
6. **Metering cableado:** `copiloto_metering` recibe eventos reales durante uso normal de la app
   (verificado con una query, no con "el código lo escribe") + al menos un dashboard/query que
   muestre uso, error-rate y gasto LLM por tenant.
7. **Backups:** estrategia real de `fusion` documentada (no asumida) + **restore probado en staging**
   con datos reales, no un `pg_dump` que nunca se restauró.
8. **Onboarding mínimo:** un usuario nuevo completa alta → conecta al menos un servicio (Composio) →
   llega al chat activo, E2E en device, sin el paso de "elegir plan" (no existe todavía).
9. **Agente de soporte técnico:** SÓLO si el operador confirmó la decisión §3.4 que lo incluye en
   esta etapa — en ese caso, el spike §2.2 corrió contra `forjador_parches` real con ≥2 síntomas no
   técnicos y el resultado (sirve / no sirve / necesita clasificar antes) quedó documentado con
   evidencia, no supuesto. Si el operador NO lo incluyó en esta etapa, este ítem queda `N/A` — no
   bloquea el resto.
10. **Ningún ítem de este DoD se declara listo por autoevaluación del agente** — cada uno exige la
    evidencia descrita (test en VPS, prueba en device, o query real), per regla dura del repo
    (`CLAUDE.md` §3 punto 6 y memoria `una-orden-cerrada-exige-evidencia-de-device`).

**La beta abre cuando 1-8 están en verde** (9 es condicional a la decisión del operador). Ningún
ítem de §1 "diferido" (M1, P2) es parte de este DoD — abrir la beta no depende de ellos.
