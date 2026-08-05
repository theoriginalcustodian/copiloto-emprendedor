# 08 — Trifecta cognitiva: agente de soporte técnico (BETA-4a)

> **Qué es este doc.** Insumo de diseño, no el `contrato_`. BETA-4a es capas `ambas`
> (backend/manejo de errores) y `COORDINACION.md` §"Cómo se lee un ítem" exige que un ítem `ambas`
> no se despache sin `contrato_` de planificación — este doc no lo reemplaza, lo alimenta. Escrito
> por manejo de errores porque BETA-0 (`PR#230`) es su precondición directa y este dominio (DLQ,
> autosanación, `docs/Errores/**`) es el que más re-usa.

## §0 — Inventario de lo que YA existe (regla REUTILIZAR — nada de esto se re-diseña)

| Pieza | Dónde | Qué aporta al agente de soporte |
|---|---|---|
| **Intake ya cableado** | `apps/copiloto/web.py:651` `POST /feedback` + `:665` `POST /feedback/audio` (BETA-1a, PR#224, **CERRADO**) | El usuario YA puede mandar texto o voz. Hoy nadie lo lee salvo SQL manual (`feedback_store.py` docstring: *"Sin UI de admin... el operador lo lee con SQL directo"*) |
| **Tabla de tickets** | `uc_factory.copiloto_feedback` (`tipo`, `texto`, `contexto`, `cliente_id`, `created_at`) | Ya tiene tenant declarado (RLS), ya tiene texto libre — es el ticket crudo, sin triage |
| **DLQ + estados** | `trauma_store.py`/`deposito_traumas.py` — 3 estados, dedupe, rescate de colgados | El mecanismo de "cola con estado" que un ticket needs ya existe; no hay que inventar otro |
| **Clasificador gratis, ya construido** | `autosanacion_activities.py::evaluar_gates_de_reparacion` — `if not origen: necesita_humano=True` | **Confirmado por BETA-0 (PR#230):** la presencia/ausencia de `origen` YA separa "reparable" de "necesita triage humano". No hace falta un clasificador nuevo para ese corte binario |
| **Ciclo de reparación** | Autosanación completa (Fase 3), Zero-Mutation, gate de reproducción (`arreglo_demostrado`) | Si un ticket SÍ resuelve a un `origen` real, el resto de la cadena ya funciona sin tocar nada |
| **Grafo de código** | `graphity-code`, `group_id=code-copiloto-emprendedor` | Candidato para resolver "¿qué archivo/símbolo menciona este texto libre?" — ver §2 DECISION 1 |
| **Patrón de disparo async** | `mi_dia_schedule_workflow.py` + `deploy/worker/ensure_mi_dia_schedules.py` (ya citado en `05-ESTADO-VIVO` §"Lo que FALTA") | El mismo Schedule Temporal que dispara la autosanación sirve para procesar feedback en batch |
| **Gap que este frente hereda si no se corrige antes** | `memoria/la-ventana-de-diagnostico-vence-antes-que-el-usuario-avise.md` — retención Temporal 24h + ~64/80 endpoints ciegos | Un agente que responde *"¿qué pasó ayer?"* con esta ventana no tiene nada que mirar salvo lo que el propio feedback trae |

## §1 — STATE OF THE ART

### (a) Canónico — triage antes de auto-fix, con gates de confianza y checkpoints humanos

Fuentes 2026: [Augment Code — AI Agent Incident Response](https://www.augmentcode.com/guides/ai-agent-incident-response),
[DevRev — AI support ticket triaging](https://devrev.ai/blog/ai-support-ticket-triaging),
[Glean — Best AI tools for incident response](https://www.glean.com/perspectives/best-ai-tools-for-incident-response-and-agent-orchestration-in-2026).

- El patrón dominante: **clasificar primero, actuar después**, con el nivel de automatización
  gateado por confianza — *"supervised automation means the agent suggests fixes and executes only
  after human approval"*, y full-automation sólo detrás de un umbral de confianza + scope acotado.
- Checkpoints humanos en DOS puntos: entre triage→contención, y entre contención→erradicación (acá:
  entre "clasificado como reparable" → "PR propuesto", y entre "PR propuesto" → merge). El segundo
  **ya existe** (Zero-Mutation, nunca mergea solo).
- Grafo de conocimiento (Customer → Product → Feature → Known Bug → Fix) como mecanismo de
  resolución de contexto — análogo a usar `graphity-code` para resolver texto libre → símbolo real.

### (b) Lateral / hack — el gate que YA se construyó sirve de clasificador sin construir uno nuevo

El "atajo que colapsa el problema": **no hace falta un clasificador de intención con LLM para el
corte binario "reparable vs necesita-humano".** BETA-0 lo probó — ese corte ya lo hace
`evaluar_gates_de_reparacion` gratis, por la sola presencia de `origen`. La pieza que falta NO es un
clasificador nuevo: es **un intento barato y opcional de resolver `origen`** antes de decidir si el
ticket es reparable — y ESE intento puede ser tan simple como una búsqueda en `graphity-code` por los
sustantivos/verbos del texto libre, con un umbral de confianza bajo (si no hay match claro, ni se
intenta — degrada directo a `necesita_humano`, que es el comportamiento seguro por default).

## §2 — FAILURE MAP

| Modo de fallo | Disparador | Mitigación adoptada / propuesta | Referencia |
|---|---|---|---|
| **Fix fuera de tema** (confirmado, no hipotético) | Ticket no-técnico con `origen` mal adivinado llega al forjador | El forjador YA es fail-closed sobre formato (rechaza sin `SEARCH/REPLACE` bien formado) — pero BETA-0 probó que esto **no basta**: rechazó por formato, no por criterio. Mitigación real: **no intentar `origen` automático salvo confianza alta** (§1b) | `PR#230`, `spikes/beta0-...` |
| **Fuga cross-tenant** | El ciclo de reparación es GLOBAL (BYPASSRLS) desde 2026-08-01; un agente de soporte que responda AL USUARIO usando ese contexto podría filtrar traumas de otro tenant | La conversación con el usuario queda **siempre** del lado del worker con tenant declarado (RLS normal); el rol `copiloto_autosanacion` (BYPASSRLS) NUNCA debe ser alcanzable desde una tool que el LLM del chat invoque — es exclusivo del workflow de reparación, server-side, sin exposición a prompt injection del usuario | `05-ESTADO-VIVO-rls-y-fases.md` §2.5, `RLS activado...` (memoria) |
| **PII en el prompt del clasificador** | El texto libre de `copiloto_feedback` puede contener datos del cliente del emprendedor | Mismo criterio que `_evidencia_del_fallo` (nunca guarda el mensaje de excepción por PII): si se arma un prompt de clasificación, no debería reenviar el texto crudo a un tercero sin la misma disciplina que ya aplica el resto del frente | `autosanacion_activities.py::_evidencia_del_fallo` |
| **Costo/latencia sincrónica** | Clasificar cada feedback en el turno de chat bloquea la respuesta al usuario | **Reusar el patrón de Schedule async** (no side-effects en el workflow del chat) — el feedback se procesa en batch, igual que la autosanación | `mi_dia_schedule_workflow.py` (patrón citado en `05-ESTADO-VIVO` §"Lo que FALTA") |
| **Tope de gasto sin control** | Si el "intento de origen" dispara una llamada LLM por CADA feedback, sin tope | Reusar `_reparaciones_de_hoy()` / `tope_diario()` — el mismo freno que ya protege al forjador | `autosanacion_gates.py` |
| **Ventana de diagnóstico ciega** | Temporal retiene 24h, ~64/80 endpoints sin logging estructurado | El agente respondería "no tengo ese dato" sobre incidentes >24h viejos — **gap preexistente, no nuevo de este frente**, pero lo hereda sin corregirlo | `memoria/la-ventana-de-diagnostico-vence-antes-que-el-usuario-avise.md` |

## §3 — DECISION MATRIX

```
DECISIÓN 1 — ¿Cómo se resuelve `origen` desde texto libre?
  IF   el texto menciona un símbolo/archivo que graphity-code resuelve con score alto
  THEN completar `origen` y depositar el trauma COMO SI fuera técnico (reusa el ciclo entero, 0 código nuevo)
  ELSE `origen=None` — el gate existente ya lo manda a `necesita_humano=True`. NO intentar adivinar
       (BETA-0: adivinar sin confianza produce ruido, no señal)

DECISIÓN 2 — ¿Qué hace el agente con un ticket `necesita_humano=True`?
  IF   es la mayoría esperada (síntomas de comportamiento del modelo, no bugs de código)
  THEN NO lo tickea como "reparable" — lo deja visible para revisión humana (mínimo viable: la fila
       en `copiloto_feedback` YA está; falta sólo una vista/consulta, no un sistema nuevo)
  Y    el agente responde al usuario con honestidad ("derivé esto a revisión", no "ya lo arreglé" —
       mismo principio que "el copiloto que narra sin hacer", ya resuelto para otras tools)

DECISIÓN 3 — ¿El agente puede disparar el ciclo de reparación?
  IF   origen se resolvió con confianza alta (Decisión 1)
  THEN dispara el MISMO ciclo de autosanación que ya corre — Zero-Mutation intacto, PR para revisión
       humana, nunca merge automático
  ELSE nunca llega al forjador — cero riesgo nuevo de "fix fuera de tema" en el camino frecuente

DECISIÓN 4 — ¿Batch o síncrono?
  SIEMPRE batch/async vía Schedule Temporal (patrón `mi_dia_schedule_workflow.py`), nunca en el
  turno del chat — evita latencia y evita que un fallo del clasificador tumbe la respuesta al usuario

DECISIÓN 5 (MAYOR — no la resuelve este doc) — ¿Apertura de tickets externos?
  La intención original del operador (PLAN.md Bandeja) menciona "apertura de tickets para
  problemas". Si eso implica un sistema de tickets NUEVO (no sólo la tabla `copiloto_feedback` con
  una vista de revisión), es una decisión de producto/alcance — escalar a planificación/operador
  antes de comprometer esa pieza. Todo lo de arriba funciona igual sin ella (v1 = vista de revisión,
  no un sistema de ticketing completo).
```

## §4 — Qué falta para bajar a `contrato_`

1. **Decisión 5** (arriba) — alcance de "apertura de tickets": ¿basta una vista de revisión sobre
   `copiloto_feedback`, o se espera un sistema de tickets con estados propios? Pregunta de producto.
2. **Umbral de confianza** de la Decisión 1 — qué score de `graphity-code` se considera "alto".
   Candidato a spike chico (no bloquea el resto).
3. Quién construye qué: backend probablemente el intake/vista (`FeedbackStore` ya es suyo por
   `COORDINACION.md` §0 — no está en el scope de manejo de errores); manejo de errores extiende el
   clasificador `origen` y el enganche al ciclo existente (su scope: `autosanacion_*.py`,
   `interceptor_errores.py`).

Ninguna de las 3 piezas de arriba requiere una nueva arquitectura — es composición de lo que ya
existe (§0), no un sistema nuevo, salvo que la Decisión 5 diga lo contrario.
