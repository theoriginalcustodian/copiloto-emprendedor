# 04 — DISEÑO: cobertura por COSTURA + autohealing acotado al mapa

> **2026-07-31.** Rediseño acordado con el operador **antes** de correr los spikes. Cambia dos cosas
> del [`01-PLAN-ejecutable`](01-PLAN-ejecutable.md): **(a)** la superficie de errores deja de definirse
> por feature y pasa a definirse por **costura**; **(b)** el autohealing deja de esperar 30 días.
>
> **Para qué existe este archivo:** los spikes van a consumir contexto. Todo lo que se decidió acá
> tiene que sobrevivir a esa pérdida — si algo no está escrito, no se decidió.

---

## 1. El problema que disparó el rediseño

Pregunta del operador, textual: *"¿hay alguna forma de implementar todo sin tener las features nuevas?
… si después vamos agregando funciones también necesitaremos incluirlas dentro del manejo de errores y
el autohealing"*.

**La medición que le da la razón** (2026-07-31, contra el repo real):

| Medición | Valor |
|---|---|
| Rutas HTTP en el backend | **80** (9 módulos) |
| Rutas con captura de errores cableada | **2** — ambas en `presupuestos_web.py:244,386` |
| `exception_handler` global de FastAPI | **0 — no existe** |
| Punto único por donde pasan **todas** las tools | **existe**: `execute_tool` (`motor/backend/agent/agent_activities.py:171`) — y **no** captura |

**El diagnóstico:** la captura de Fase 1 quedó cableada **a mano, por feature**. Con ese diseño cada
función nueva es trabajo de cableado nuevo, y el default es **cero cobertura** (78 de 80 rutas ciegas).

---

## 2. La decisión: la superficie se define por COSTURA, no por feature

**Las features son infinitas y cambian; las costuras son pocas, estables y ya existen.**

| # | Costura | Cubre | Estado |
|---|---|---|---|
| C1 | `execute_tool` (`agent_activities.py:171`) | **todas** las tools del agente, presentes y futuras | existe, no captura |
| C2 | Exception handler global de FastAPI | las **80** rutas HTTP | **no existe** |
| C3 | Worker interceptor de Temporal | todas las activities/workflows | no existe |
| C4 | `ErrorBoundary` cliente | las 3 capas de UI | ✅ hecho (ítem 0.5b) |

**Consecuencia:** una feature nueva **nace cubierta el día 0**, sin cablear nada.

**El único conocimiento que sigue siendo por-feature** es *qué operación es segura de reintentar*. Se
resuelve **declarativamente**, no con código: un campo en el registro de cada tool
(`auto_reparable: bool`). Si una tool no lo declara, el default es **NO auto-reparable** — fail-closed,
que es lo único aceptable con AFIP de por medio.

### 2.1 Lo que esto cambia en los disparadores

| Fase | Disparador viejo | Disparador nuevo | Por qué |
|---|---|---|---|
| **1.5 — Cobertura por costura** *(bloque nuevo)* | — | ninguno: **ejecutable ya** | 4 puntos fijos, no depende de features |
| **2 — DLQ** | *"features terminadas"* | **Fase 1.5 cerrada** | La DLQ se alimenta de 4 costuras, no de N features |
| **3 — Autosanación** | *"30 días de superficie estable"* | **la lista cerrada de operaciones idempotentes del mapa de fallos** | Ver §3 |

---

## 3. El autohealing no espera 30 días

**Decisión del operador (2026-07-31), textual:** *"el autohealing no puede esperar 30 días de datos,
debe ser dinámico ahora… para eso ya tenemos el mapa de fallos, la superficie de errores ya está
acotada… no necesitamos ponernos paranoicos con que esté el 100% cubierto"*.

**Y tiene el respaldo del propio repo:** `docs/copiloto-emprendedor/2026-07-28-mapa-puntos-de-fallo-del-sistema.md`
tiene **12 puntos de fallo ordenados por severidad** (§4) y el eje de idempotencia ya resuelto (§1).
Los 30 días existían para **descubrir** la superficie; ya está descubierta. Medirla otra vez antes de
empezar es redundante.

**Qué reemplaza al disparador de tiempo:** arrancar cubriendo **las operaciones idempotentes que el
mapa ya lista**, con kill switch y tope diario, sin pretender el 100%. Los **30 días quedan como fase
de reajuste posterior**, no como precondición.

**Lo que NO se mueve, y no es paranoia sino el propio mapa:** el **dominio fiscal es
`DIAGNOSTIC_ONLY` absoluto**. Un auto-reparo ahí es una segunda factura con CAE real ante AFIP — no es
un error recuperable. Igual `crear_certificado` (RPA + secreto one-shot) y `refresh_credential` (MP
rota el token).

---

## 4. Los modelos, y dónde está el trabajo real

**Definición del operador (2026-07-31):**

| Rol | Modelo |
|---|---|
| **Forjador** (escribe el parche) | `gpt-4o-mini` |
| **Auditor** (lo revisa) | `gpt-4o` |

**El principio que ordena el diseño, en palabras del operador:** *"la efectividad del forjador reside
principalmente en la calidad del contexto que entregamos… modelos pequeños con excelente contexto
producen los mismos resultados que modelos grandes sin contexto"*.

**No es opinión — este repo ya lo midió:** [[localizacion-estructurada-feedback-agentes]] — feedback
**localizado y estructurado** baja regresiones **~70%** con un modelo no-frontier; la orden genérica
las **aumenta**. Es la palanca de mayor ROI de todo el diseño y es plug-and-play (sin fine-tuning).

**Qué significa "contexto impecable", concretamente** (el ensamblado es el entregable, no el prompt):
archivo y función exactos · stack trace completo · el fingerprint y su historial de repeticiones ·
impact-graph de qué toca el cambio · los tests que cubren esa zona · y **explícitamente qué NO romper**.

### 4.1 El contrapunto sobre el auditor — registrado a propósito

El operador aportó como evidencia favorable: *"ya hemos probado cantidad de veces con la automatización
que tenía en GitHub y por lo general la auditoría al final confirmaba la mayor cantidad de fixes
realizados por el forjador"*.

**Ese dato no prueba que el auditor auditara bien.** Una tasa alta de aprobación es **indistinguible**
de un auditor que aprueba casi todo — el patrón que este repo tiene documentado como
[[instrumentos-que-confirman-en-vez-de-verificar]], y que mordió el 2026-07-29 (el retest del modo
automático dijo *"0/3 ✅"* sin haber medido nada).

**La pregunta que los separa:** *¿qué habría dicho ese auditor si el parche estuviera mal?* Sin un caso
registrado donde **rechazó**, su tasa de aprobación no informa nada.

**Por eso S5 lleva control negativo desde el diseño** (§5). No es desconfianza del operador: es la
regla del repo aplicada al componente del que más depende la seguridad del ciclo.

---

## 5. Los 5 spikes — filtrados por crítico Y no-validado

**Descartados por estar ya probados** (evidencia adjunta, 2026-07-31): heartbeat → `test_latido.py`
(4 tests) · replay/`patched` → `test_afip_factura_replay.py` (3 tests) · Postgres desde cero + RLS →
servicio `postgres:16-alpine` en el job `backend` (`tests.yml:39-43`), verde en los PRs #159/#160.

| # | Spike | Supuesto que valida | Si sale falso, se cae |
|---|---|---|---|
| **S1** | Interceptor de Temporal | Que el interceptor vea la excepción de la activity **con `cliente_id` + nombre de tool** | Toda la Fase 1.5 por costura |
| **S2** | `ON CONFLICT … RETURNING (xmax=0)` | Que Postgres distinga insert de update en el upsert de dedupe, **con RLS activo** | El `dedupe_count` de la DLQ (ítem 2.1) |
| **S3** | Reinyección idempotente | Que reinyectar desde la DLQ produzca el efecto **una sola vez**, medido **por efecto** | La reinyección entera. Precedente: [[idempotencia-con-un-if-tiene-ventana]] (facturar 2× → 2 CAE) |
| **S4** | LLM invocable desde el worker | Que una activity del VPS llame a `gpt-4o-mini`/`gpt-4o` (credenciales, red, costo, latencia) | Fase 3 completa |
| **S5** | Parche aplicable **+ control negativo** | Que el forjador produzca un diff que **aplique y pase los tests**, y que el auditor **rechace** los 3 parches rotos | El ciclo de reparación |

**Orden:** S1 y S2 primero (baratos, destraban lo implementable hoy) · S3 antes de cualquier
reinyección · S4 antes de diseñar la Fase 3 · **S5 decide si el autohealing es viable o queda en
"detecta y propone diagnóstico"**.

**No son spike, aunque lo parezcan:** el exception handler global de FastAPI (API conocida; el riesgo
real —que se trague los 4xx de negocio— se cubre con un test de control) y el kill switch (trivial).

### 5.1 El control negativo de S5, explícito

El auditor debe **rechazar** los tres, y cada uno prueba una falla distinta:

| Parche inyectado | Qué falla detecta si lo aprueba |
|---|---|
| Compila y pasa el linter, pero **rompe la lógica** | No lee el comportamiento, sólo la forma |
| Toca el **dominio fiscal** | El guard `DIAGNOSTIC_ONLY` no es efectivo |
| **Modifica el test** en vez del código | Goodhart: hace verde el gate en lugar de arreglar (EvilGenie midió **54%** de trampa) |

Un auditor que no rechaza ninguno de los tres **no es un gate: es un sello**.

---

## 6. Herramientas verificadas para correr los spikes (2026-07-31)

| Recurso | Estado |
|---|---|
| `temporalio` | ✅ en **ambos** venvs |
| `psycopg2`, `openai` | ✅ **sólo** en `/opt/uc-copiloto-venv` |
| `temporal` CLI | ✅ `temporal-admin-tools` (Server 1.31.1, UI 2.49.1) |
| `OPENAI_API_KEY`, `GROQ_API_KEY` | ✅ en `/etc/unreal-copilot/copiloto.env` |

⚠️ **Hay DOS venvs y no son equivalentes.** `/opt/uc-worker-venv` **no** tiene `psycopg2` ni `openai`;
el que los tiene es `/opt/uc-copiloto-venv`, que es el del deploy. La memoria del repo dice *"worker
venv `/opt/uc-worker-venv`"* — imprecisión que va a morder a quien corra algo en el venv equivocado.

---

## 7. Estado del frente al escribir esto

**Cerrado y en producción:** Fases 0 · 0.5 · G-2 · 1 (PRs #154-#160). VPS 1143 passed · CI 1269 con
Postgres efímero. Detalle → [`03-REPORTE-implementacion.md`](03-REPORTE-implementacion.md).

**Pendiente de este documento:** los 5 spikes → replanificar 1.5 / 2 / 3 con su evidencia.

**Deuda viva no relacionada con el diseño:** el batch de memoria sin commitear · la reingesta del grafo
con `--since` cuando Graphity vuelva (hoy da **503 de Caddy**: la VM corre, el servicio detrás no).

---

## 8. Post-spikes — el plan de implementación (2026-07-31)

**Los 5 spikes se corrieron. Ninguno tumbó el diseño; tres cambiaron detalles.** Evidencia completa →
[`spikes/RESULT.md`](../../../spikes/RESULT.md).

| Spike | Veredicto | Qué cambió |
|---|---|---|
| S1 interceptor | ✅ PASA | — (⚠️ el exit code no sirve como oráculo: aborta en el teardown) |
| S2 dedupe + RLS | ✅ PASA + adversarial | índice `(cliente_id, fingerprint)` y **`FORCE RLS`** |
| S3 reinyección | ⚠️ PASA con condición | se habilita **por índice único**, no por dominio |
| S4 LLM | ✅ PASA | — |
| S5 forjador/auditor | ⚠️ PASA cambiando el formato | **SEARCH/REPLACE**, nunca diffs |

### 8.1 Fase 1.5 — Cobertura por costura (ejecutable ya)

| # | Qué | Cierre |
|---|---|---|
| 1.5a | `CapturaInterceptor` de worker registrado en `worker_b.py` — emite `log_error` con fingerprint, categoría, `cliente_id` y nombre de activity | Test: una activity que falla deja el registro; **control**: una que pasa no deja nada |
| 1.5b | `exception_handler` global de FastAPI en la app | Test: un 500 queda registrado · **control**: un 404/409 de negocio **no** se registra ni cambia de código |
| 1.5c | Retirar el `log_error` cableado a mano de `presupuestos_web.py:244,386` | La cobertura no baja: el mismo error sigue registrándose, ahora por la costura |

**Por qué 1.5c no es opcional:** dejar las dos formas conviviendo garantiza doble registro y que nadie
sepa cuál manda.

### 8.2 Fase 2 — DLQ (disparador: 1.5 cerrada)

Los 5 ítems del `01-PLAN §7`, con las correcciones de S2 en 2.1. El 2.5 (*"procesamiento diferido"* en
la UI) **cruza la junta backend↔app** → exige `contrato_` en el buzón **antes** de implementar.

### 8.3 Fase 3 — Autosanación acotada al mapa (disparador: Fase 2 cerrada)

- **Forjador `gpt-4o-mini`, salida SEARCH/REPLACE.** Un diff unificado **no aplica** — medido.
- **Auditor `gpt-4o`**, y sus **3 parches rotos se congelan como test de regresión permanente**: si un
  cambio de prompt o de modelo hace que apruebe alguno, el ciclo se apaga solo.
- **La whitelist de auto-reparación se deriva del índice único**, no de una opinión: una operación es
  reinyectable si y sólo si existe un índice único que la proteja de la carrera.
- **🛑 Fiscal `DIAGNOSTIC_ONLY`, ahora por medición y no por precaución:** `existe_comprobante` consulta
  a **AFIP**, no a la DB — no hay índice que salve la ventana (S3).
- Kill switch + tope de reparaciones/día.
