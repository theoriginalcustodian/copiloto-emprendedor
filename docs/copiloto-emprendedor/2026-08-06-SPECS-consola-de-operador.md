# SPECS — Consola de Operador del Copiloto

> **Estado:** specs para el sprint siguiente a ODOBI. Redactadas 2026-08-06.
> **Decisiones del operador ya tomadas** (no se re-discuten): cross-tenant · sólo web, dentro de
> `copiloto-web` · un solo administrador con puerta abierta a más · frescura al minuto · IA-native
> (capacidades primero, UI después) · humano ahora, agente después.

---

## 1. Qué es

El **centro de control del copiloto**: la superficie donde el operador gestiona la aplicación entera
sin `psql`, sin SSH y sin leer logs. Reemplaza el modo actual de operar, que está declarado en el
propio código como provisorio — `queries/metering_dashboard.sql` y `queries/feedback_dashboard.sql`
abren con *"sin UI de admin en esta etapa, el operador corre esto con SQL directo"*.

## 2. El boundary que ordena todo el diseño

> **La consola opera la APP. No opera los DATOS de negocio de los tenants.**

No es una restricción incómoda: es lo que hace que la consola sea construible sin volverse un riesgo
legal ni un agujero de privacidad.

| Dentro | Fuera |
|---|---|
| Salud del sistema, workflows, colas | Facturas, presupuestos, clientes, gastos de un tenant |
| Uso, costo de LLM, error-rate | Credenciales AFIP y cualquier acción fiscal |
| Feedback y su clasificación | Contenido de las conversaciones |
| Errores (DLQ) y autosanación | La fábrica: deploys, VPS, Temporal server, grafo |
| Cuentas: alta, tier, suspensión | |

**La tensión, resuelta explícita.** Dar soporte exige contexto: *"a este tenant no le factura"*. La
regla es **telemetría sí, contenido no** — ves que su `AfipFacturaWorkflow` falló con
`error_type=X` en el paso Y, cuántos reintentos lleva y qué hizo la autosanación; **no** ves a quién
le facturó ni por cuánto. Esto **ya es posible por construcción**: `trauma_store.depositar()` guarda
`fingerprint, workflow, error_type` — shape, no payload
([trauma_store.py:92](apps/copiloto/trauma_store.py#L92)). La regla no hay que construirla, hay que
**no romperla**.

## 3. §0 Reutilización — inventario medido contra `origin/main`

**Regla del repo: nada de esto se re-implementa.** La consola es superficie sobre lo que ya existe.

| Capacidad | Ya existe en | Qué falta |
|---|---|---|
| Uso, costo LLM, error-rate por tenant | `copiloto_metering` + [metering_store.py](apps/copiloto/metering_store.py) + `queries/metering_dashboard.sql` | endpoint + pantalla |
| Feedback + clasificación vía grafo | `copiloto_feedback`, [soporte_feedback_workflow.py](apps/copiloto/soporte_feedback_workflow.py), [feedback_store.py](apps/copiloto/feedback_store.py) | endpoint + pantalla |
| DLQ con máquina de estados | [trauma_store.py](apps/copiloto/trauma_store.py) — `pendiente → en_proceso → resuelto`, + `descartado` terminal; `depositar/tomar/tomar_un_bug_distinto/hermanos_del_mismo_bug` | endpoint de **lectura** + acción de reintento |
| Autosanación | `autosanacion_workflow.py`, `autosanacion_gates.py`, `canario_autosanacion.py` | ver qué intentó y con qué resultado |
| Resolución de tenant | [auth.py:57](apps/copiloto/auth.py#L57) — `uc_factory.tenants`, registry `auth_user_id → cliente_id` | columna de estado + tier |
| Rate limit vigente | [rate_limit.py](apps/copiloto/rate_limit.py) — sliding-window, 60/60s por env | **sólo exponer lectura** |
| Schedules por tenant | `ensure_{autosanacion,grafo_sync,mi_dia,soporte_feedback}_schedules.py` | listado read-only |
| Shell, auth, tokens, temas | `copiloto-web` completo (sprint M-WEB) | reusar, no crear |

**Lo único que NO existe y hay que crear:** el **registro de auditoría** de acciones de operador.

## 4. Principio IA-native — qué significa acá, concretamente

Toda acción de gestión se implementa **primero como capacidad invocable**, y la UI es **un cliente
más**. Si una acción sólo existe como botón, un agente nunca podrá ejecutarla.

Las tres propiedades que se construyen desde el día 0 aunque hoy sólo las use un humano, porque
agregarlas después obliga a rehacer:

1. **Toda acción devuelve estado observable, no un "OK".** El invocador —humano o agente— debe poder
   *leer* el resultado, no confiar en él. Es la misma disciplina que
   `memoria/instrumentos-que-confirman-en-vez-de-verificar.md`.
2. **Autorización por acción y alcance**, no por sesión. Qué se ejecuta solo y qué exige confirmación
   explícita. Es el patrón HITL que el copiloto ya usa con las cards.
3. **Auditoría con actor**, humano o agente, en el mismo registro. Sin esto nunca vas a poder soltarle
   una acción a un agente con confianza.

**Criterio de diseño, dado por el operador (2026-08-06):**

> Si una acción manual existe para tapar un fallo, primero se pregunta **por qué el fallo es
> posible**. Si no está resuelto de raíz, se resuelve. La consola no es el lugar donde se compensan
> agujeros del sistema.

Este criterio ya eliminó una capacidad de estas specs: *pausar Schedules* se propuso como freno de
emergencia ante un loop de LLM, y la verificación mostró que **el loop ya está topado por
construcción** — `REACT_MAX_STEPS = 8`
([conversation_workflow.py:368](motor/backend/agent/conversation_workflow.py#L368)) y el reintento
infinito de Temporal se arregló de raíz en PR #114
([[agente-loop-tool-failure-retry-infinito]]). Era una acción manual justificada por un riesgo
inexistente.

## 5. Áreas de la consola

Salen de los trabajos de gestión que cualquier SaaS necesita, filtrados por el boundary de §2.

### A1 · Salud
Estado del front-door, workers y Schedules. Qué está caído **ahora**. Read-only.

### A2 · Cuentas
Listado de tenants con estado de onboarding y **tier**. Acción: **suspender / reactivar**.

### A3 · Uso y costo
Por tenant y agregado: turnos LLM, tokens, gasto, tools ejecutadas, **error-rate**. El tier determina
el rate limit — **no se edita el límite a mano**, se cambia el tier. Read-only + cambio de tier.

### A4 · Soporte
Feedback entrante (texto y voz), su clasificación contra el grafo, y si derivó en autosanación.
Read-only en v1.

### A5 · Errores — **el área con más peso del sprint**
No es una lista: es el lugar donde se **gestiona** el DLQ.
- Traumas agrupados **por `fingerprint`** (el dedupe ya existe), con `dedupe_count`, `intentos`,
  estado y `workflow`/`error_type`.
- Qué intentó la autosanación y en qué terminó (gates, canario, PR abierto).
- **Acción: reintentar** — ver §6.

### A6 · Auditoría
Toda acción de operador, con actor, parámetros, resultado y momento. **Es capacidad nueva y es
precondición de A2 y A5**: sin auditoría no se habilita ninguna acción que mute.

## 6. Acciones que mutan — las únicas tres de v1

Cada una: contrato explícito, idempotente, confirmación, auditada, reversible o explícitamente no.

| # | Acción | Efecto | Reversible | Riesgo |
|---|---|---|---|---|
| 1 | **Suspender / reactivar tenant** | estado en `uc_factory.tenants`; el front-door responde 403 | sí, inmediato | bajo |
| 2 | **Cambiar tier** | ajusta el rate limit vigente para ese tenant | sí | bajo |
| 3 | **Reintentar un trauma** | reencola UN trauma `pendiente` | no — el efecto ya ocurrió o no | **alto** |

**La 3 es la delicada, y su riesgo está medido en este repo.** Reintentar algo que en realidad sí se
ejecutó duplica el efecto: facturar dos veces dio **dos CAE**
([[idempotencia-con-un-if-tiene-ventana]]). Por eso:

- Uno por vez, **nunca en lote**.
- Sólo habilitado para traumas cuyo workflow tiene **idempotencia verificada por test**; el resto
  muestra el botón deshabilitado **y dice por qué**.
- Confirmación explícita que nombra el workflow y el efecto.

**Explícitamente fuera de v1:** editar el rate limit en caliente (hoy la env var se lee a nivel de
módulo y el middleware la fija en `__init__` — sería un refactor, y con los tiers no hace falta),
pausar Schedules (§4), y cualquier acción sobre AFIP o datos de negocio.

## 7. Forma técnica

- **Backend:** router `/admin/*` en el front-door FastAPI, mismo proceso. Cada endpoint = una
  capacidad. Sin lógica nueva de negocio: orquesta stores que ya existen.
- **Frontend:** módulo `admin/` dentro de `copiloto-web`, reusando shell, auth y temas del sprint
  M-WEB. **No se toca `apps/mobile`.**
- **Acceso:** rol de administrador en el JWT de GoTrue. El módulo no se monta si el claim no está.
- **Frescura:** queries normales, refresco al minuto. Sin streaming.
- **Multi-tenant:** la consola es cross-tenant **por definición**, lo que la pone en tensión directa
  con RLS `FORCE`. Ver §8.

## 8. Supuestos críticos NO validados — spike ANTES de diseñar la implementación

Los dos son bloqueantes: si salen distinto de lo asumido, la arquitectura cambia.

### S1 · Cómo lee la consola con RLS `FORCE` activo
Está **medido** que el rol de la app ve **0 filas** cross-tenant sin declarar `request.jwt.claims`,
y que `FORCE` anula la exención de dueño ([[rls-activado-que-no-filtraba-el-dueno-esta-exento]]).
`queries/metering_dashboard.sql` documenta que el agregado cross-tenant hoy exige conectarse como
superusuario desde Supabase Studio.

**La consola necesita un camino propio.** Y ese camino **es superficie de ataque**: mal resuelto,
la consola se vuelve exactamente el agujero que RLS existe para tapar. El spike debe decidir entre
rol dedicado con `BYPASSRLS`, policy específica para el rol admin, o vistas agregadas — con el
**test adversarial obligatorio** (regla dura del repo: control de acceso sin test hostil = control
no verificado).

### S2 · De dónde sale el claim de administrador
GoTrue emite el JWT. Hay que validar **empíricamente** que soporta el claim custom, cómo se asigna
sin tocar a los usuarios normales, y que [auth.py](apps/copiloto/auth.py) lo puede leer sin romper
`require_tenant`.

**Riesgo mayor si S2 falla:** un endpoint `/admin/*` que confía en un claim que cualquiera puede
setear. Igual que S1, exige test adversarial: un usuario normal pidiendo `/admin/*` debe recibir 403.

## 9. Definición de terminado (binaria)

- [ ] S1 y S2 resueltos con spike y **RESULT.md** de evidencia, antes de implementar.
- [ ] Test adversarial: usuario **no** admin contra cada endpoint `/admin/*` → **403**. Sin esto el
      control queda `[UNVERIFIED]` y bloquea el cierre.
- [ ] Las 6 áreas con datos reales de prod, no fixtures.
- [ ] Las 3 acciones: contrato, idempotencia, confirmación, **auditoría escrita**, y estado
      observable devuelto.
- [ ] Reintento de trauma: habilitado **sólo** donde la idempotencia está cubierta por test; el resto
      deshabilitado con motivo visible.
- [ ] Gate visual en los tres temas (regla del repo).
- [ ] `apps/mobile` sin un solo cambio.

## 10. Lo que NO entra en v1

Roles múltiples (hoy hay un solo administrador; el diseño no debe impedirlos) · notificaciones y
alertas proactivas · gestión de la fábrica · edición de prompts o modelos · cualquier acción sobre
AFIP · ejecución agéntica automática — las capacidades quedan listas para un agente, pero en v1 las
invoca un humano.
