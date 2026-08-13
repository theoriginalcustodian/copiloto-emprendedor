# ADR-003 — Gate genérico de replay-safety: detectar cambios de workflow sin `patched()`

- **Fecha:** 2026-08-13
- **Estado:** ✅ **`ACCEPTED`** — DoD de §7 cumplido el mismo día (evidencia en §8).
- **Decide:** backend (TÁCTICO — toca patrón de código y CI, pero es aditivo, reversible con un
  revert, y no cambia contrato externo ni infra compartida).
- **Item de deuda:** D4, `docs/copiloto-emprendedor/Auditorias/2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md`.

---

## 1. Contexto

`copiloto-emprendedor` corre varios workflows Temporal de larga vida en producción (`ConversationWorkflow`
— el ReAct de cada turno de chat — y `FacturaWorkflow` — el HITL de AFIP — son los de mayor volumen y
mayor tiempo `Running`). Un cambio de código que altera la secuencia de Commands de un workflow (agregar,
quitar o reordenar un `execute_activity`, cambiar una condición que decide qué se agenda) sin envolverlo
en `workflow.patched(...)` no falla en ningún test unitario — el SDK sólo detecta la divergencia cuando
un worker intenta hacer **replay** de una ejecución real que quedó en vuelo con el history viejo, y ahí
tira `NonDeterministicWorkflowError` **en producción**, sobre una conversación o una factura reales.

Hasta hoy, la única defensa contra esto en el repo eran dos tests ad-hoc, escritos **después** de que
alguien ya sabía que estaba tocando un punto riesgoso y agregaba un `patched()`:
`apps/copiloto/tests/test_afip_factura_replay.py` (patch `reservar-nro-antes-de-emitir`) y
`motor/backend/agent/test_narra_guardrail_retiro_replay.py` (retiro de
`narra-guardrail-required-retry`). Ambos siguen el mismo patrón — fixture de history real capturado con
`temporal workflow show --output json` + `temporalio.worker.Replayer` + control positivo de que el
Replayer detecta divergencia + guard de que el fixture sigue ejercitando lo que dice ejercitar — y ambos
funcionan bien **para el cambio que los motivó**.

El gap es el que el nombre del disparador de D4 describe: esos tests protegen la intención del autor del
patch, no protegen contra alguien que cambia un workflow **sin saber** que hacía falta un `patched()`.
Ese caso no dispara ningún test — simplemente no hay ningún archivo que lo intente.

## 2. El mecanismo (confirmado, no inventado)

El SDK de Python de Temporal ya provee exactamente lo que hace falta:
`temporalio.worker.Replayer.replay_workflow(...)` toma un `WorkflowHistory` (desde JSON, real o
sintético) y corre el código de workflow ACTUAL contra ese history, levantando si diverge. Es hermético:
no necesita una conexión viva a un cluster Temporal para correr — sólo el JSON del fixture y la clase de
workflow importada. Eso significa que corre igual de bien en el gate local (VPS) que en GitHub Actions,
sin que ninguno de los dos necesite alcanzar el Temporal de producción.

Capturar (o RENOVAR) un fixture sí necesita alcanzar el Temporal real — eso es un paso manual, on-demand,
corrido por quien tiene acceso al VPS (`docker exec temporal-admin-tools temporal workflow show ...`), no
parte del gate de CI.

## 3. Decisión

**Generalizar el patrón ad-hoc a un gate único, con un manifest explícito y una allowlist obligatoria.**

`apps/copiloto/tests/test_workflow_replay_gate.py`:

1. **Manifest `FIXTURES`**: `{fixture_relativo: (módulo, clase)}` — hoy cubre `FacturaWorkflow` y
   `ConversationWorkflow` (los 2 fixtures que ya existían). Un test parametrizado replaya cada uno contra
   el código actual en cada corrida de `scripts/ci/backend.sh` (o sea: en cada PR, vía `gate.sh` y
   `tests.yml`, gratis — no hace falta wiring de CI nuevo, es más pytest que ya se colecciona).
2. **Descubrimiento dinámico de workflows de producción**: un regex sobre `apps/copiloto/**/*.py` y
   `motor/**/*.py` (excluyendo `tests/`, `fixtures/`, `__pycache__`) encuentra TODO `@workflow.defn`.
   `test_todo_workflow_de_produccion_tiene_fixture_o_esta_en_la_allowlist_con_motivo` falla si aparece una
   clase que no está ni en `FIXTURES` ni en `SIN_FIXTURE_TODAVIA` — es decir, **un workflow nuevo sin
   decisión de cobertura rompe el build**, no queda sin clasificar en silencio.
3. **`SIN_FIXTURE_TODAVIA`**: allowlist con motivo explícito por entrada, para los 7 workflows de
   producción que hoy no tienen fixture (`AnulacionWorkflow`, `AfipOnboardingWorkflow`,
   `AutosanacionWorkflow`, `GrafoSyncWorkflow`, `MiDiaDetectorWorkflow`, `SoporteFeedbackWorkflow`,
   `MpRefreshWorkflow`) — ver §6. Un guard adicional (`test_la_allowlist_no_tiene_entradas_huerfanas`)
   falla si una entrada de la allowlist deja de corresponder a una clase real (renombre/borrado), para
   que el hueco no quede tapado por un nombre viejo.
4. Los dos archivos ad-hoc existentes se **redujeron**: el replay contra el código actual (que ahora
   duplicaba lo que hace el gate genérico) se sacó; se quedaron con lo que es específico de cada
   fixture — el control positivo y el guard de frescura — porque esos documentan una decisión narrativa
   puntual (qué patch motivó este fixture) que el manifest genérico no reemplaza.

## 4. Por qué esto y no las alternativas

### (a) Exigir un replay test por cada PR que toque un workflow, vía checklist/code review — ❌

No es mecánico. Un checklist que un humano tiene que recordar es la misma clase de falla que ya pagó este
repo dos veces este sprint (D13: "el instrumento no vive en el checkout"; ADR-001 §2: lista hardcodeada
que se desactualizó en silencio). Si algo se puede automatizar como test, un checklist es la opción peor.

### (b) Replay contra el Temporal de producción en cada corrida de CI — ❌

Innecesario y más caro: el Replayer no necesita un cluster vivo, sólo el JSON. Pegarle al Temporal real
en cada PR agrega una dependencia de red y un secreto de acceso al gate sin ganar nada — el history ya
está capturado en el fixture. Reservado para el paso manual de renovación de fixtures, no para el gate.

### (c) Cobertura de fixture para los 9 workflows de producción, ahora mismo — ❌ diferido, no descartado

Capturar un fixture nuevo exige (1) tener una ejecución real `Running` en un punto no trivial del
workflow y (2) acceso al VPS para `docker exec temporal-admin-tools`. Para los 7 workflows sin fixture,
ninguno tiene la combinación de riesgo (HITL con espera larga, alto volumen) que sí tienen Factura y
Conversation — ver motivo por entrada en el manifest. Se prioriza cobertura donde el costo de un
`NonDeterministicWorkflowError` en producción es mayor, no cobertura completa por completitud.

## 5. Limitaciones — honestas, no una promesa de cobertura que no es real

- **Sólo detecta divergencia en el tramo que el fixture ejercitó.** Un cambio en una rama de código que
  ningún fixture guardado atraviesa (un tool nuevo del ReAct, un branch de error que las conversaciones
  capturadas no tomaron) **no se detecta** acá. Esto no es cobertura exhaustiva de todos los estados
  posibles de un workflow — es una muestra de 1-2 historys reales por tipo.
- **Un solo fixture por workflow no cubre la variedad real de conversaciones.** `ConversationWorkflow` es
  un ReAct loop: distintas conversaciones producen historys muy distintos según qué tools se invocaron.
  Un fixture (el de `narra-guardrail-required-retry`) es una muestra, no un generador exhaustivo de
  caminos. Ampliar a 2-3 fixtures con distintos patrones de tool-calls es la mejora natural siguiente,
  no incluida en este ADR.
- **Fixtures se desactualizan.** Si un `deprecate_patch()` retira una rama vieja, un fixture capturado
  ANTES de esa remoción puede dejar de reflejar un estado real alcanzable — el guard de frescura de cada
  archivo ad-hoc (p. ej. `test_el_fixture_es_una_ejecucion_ANTES_de_emitir`) mitiga esto puntualmente,
  pero no hay una política automática de expiración de fixtures.
- **No reemplaza la disciplina de `patched()`/`deprecate_patch()`.** Es una red de seguridad para cuando
  esa disciplina falla, no un sustituto de seguirla a propósito.
- **7 de 9 workflows de producción sin fixture** (§3.3, §4c) — decisión visible y revisable, documentada
  acá y en el propio manifest, no una laguna descubierta después.

## 6. Consecuencias

- Todo PR que cambie `ConversationWorkflow` o `FacturaWorkflow` de forma que rompa el replay de una
  ejecución real en vuelo **ahora falla en CI**, sin que nadie tuviera que acordarse de escribir un test
  para ese cambio puntual.
- Todo workflow de producción nuevo que se agregue sin decidir su cobertura de replay **rompe el build**
  hasta que alguien lo clasifique — mismo mecanismo fail-loud que D13/ADR-001 ya establecieron para otros
  drifts de este repo.
- Deuda abierta (no bloqueante, sin disparador hoy): ampliar `FIXTURES` a los 7 workflows restantes
  cuando alguno de ellos gane volumen/HITL suficiente para justificarlo, y sumar un 2do/3er fixture de
  `ConversationWorkflow` con un patrón de tool-calls distinto al de `narra-guardrail`.

## 7. Cómo se verifica

- [x] `test_todo_workflow_de_produccion_tiene_fixture_o_esta_en_la_allowlist_con_motivo` corre y da
      verde sobre los 9 workflows reales del repo hoy.
- [x] `test_la_allowlist_no_tiene_entradas_huerfanas` corre y da verde.
- [x] Los 2 replays parametrizados (`FacturaWorkflow`, `ConversationWorkflow`) dan verde contra el
      código actual.
- [x] Los controles positivos existentes (`test_control_positivo_el_replayer_SI_detecta_una_divergencia`,
      uno por fixture) siguen dando verde — prueban que el Replayer SÍ detecta una divergencia fabricada
      a propósito, no que el instrumento esté mal cableado y pase todo en verde sin verificar nada.
- [x] Suite completa de backend en el VPS: **1901 passed, 26 skipped** (skips esperados: gates de
      credenciales externas), sin regresiones.

## 8. Evidencia

- `apps/copiloto/tests/test_workflow_replay_gate.py` (nuevo).
- `apps/copiloto/tests/test_afip_factura_replay.py` y
  `motor/backend/agent/test_narra_guardrail_retiro_replay.py` — reducidos, sin duplicar el replay que
  ahora hace el gate genérico.
- 8/8 tests del subset objetivo (`test_workflow_replay_gate.py` + los 2 archivos reducidos) verdes en el
  VPS. Suite completa 1901/26-skip verde en el VPS.
