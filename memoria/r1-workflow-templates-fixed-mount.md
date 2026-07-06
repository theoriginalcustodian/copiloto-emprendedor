---
name: r1-workflow-templates-fixed-mount
description: "R1 fixed-mount — workflow Temporal rico FIJO (gate-only, no músculo) eleva el techo B5; arquetipo grace + mecanismo en read_skeleton/fill loop"
metadata: 
  node_type: memory
  type: project
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

**R1 Fase 1 ✅ (2026-06-24, rama `feat/r1-workflow-templates`).** El techo B5 ELEVADO: la fábrica monta workflows Temporal **ricos** SIN pasarlos al músculo no-frontier (que no puede escribir máquinas de estado complejas).

**Mecanismo (separación estricta, regla 3):** un arquetipo Temporal **FIJO** (pre-rellenado, sin `raise NotImplementedError`) se monta tal cual y se **gatea (gate-only)**; el músculo solo rellena el **store de dominio PURO** (cage python). Elude los 2 modos del techo por construcción: si el músculo no escribe el workflow, no puede romperlo.
- `read_skeleton` (feature_activities) marca `fixed = not has_notimplemented(scaffold_code)` — **AST** en `factory_kit`, NO substring (bug cazado por el E2E: el docstring del arquetipo MENCIONA "raise NotImplementedError").
- fill loop (feature_workflow) branch `fixed`: gatea con `run_tests` en la tq del cage (gate-only + `schedule_to_start_timeout` fail-fast si la jaula del cage no está UP → irresoluble, no cuelga). `loop_core` INTACTO. `aggregate` tolera el level `fixed`.
- Arquetipo FIJO = sin `reference_impl.py` (el stub ES la impl); `validate_kit` corre el stub (fallback).

**Primer ladrillo:** `deploy/skeleton_kit/archetypes/backend_temporal_grace/` (grace-period/dunning). `validate_kit` **9/9** gate temporal real. Otros arquetipos (edge-latch / drip / reschedule / multi-signal) a demanda (regla de tres).

**E2E** (`spikes/r1-workflow-template/`): la fábrica montó el workflow grace FIJO (intacto, no músculo) + el músculo rellenó el store → gate2. Replay-safe (`replay_check r1-e2e-1` OK).

**Hallazgo (spike-first):** el "Modo A = `asyncio.sleep` cuelga el time-skipping" del catálogo es **FALSO** — `asyncio.sleep` es time-skippeable en temporalio Python (el SDK lo intercepta como timer durable). El TIMEOUT real venía de otro primitivo. §B5/F15 corregidos. Indiferente para R1.

**Review adversarial (ultracode):** HIGH carry-over de signal **en el propio arquetipo** (un `renew` durante el período activo anulaba el grace del ciclo siguiente → re-facturación espuria) → reset de flags por ciclo, cazado con **TDD** (rojo sin fix → verde con fix) + gate fixed sin `schedule_to_start_timeout`. determinism/mechanism limpias. **272 tests verde.**

**FASE 2 ✅ (2026-06-24, rama `feat/r1-arquetipos-ricos`):** los 4 patrones ricos restantes cosechados como arquetipos FIJOS, generados en paralelo por 4 agentes opus (molde grace + lección carry-over): **edge_latch** (umbral histéresis/re-arm) · **drip** (secuencia cancelable) · **reschedule** (recompute del delay) · **multi_signal** (OR de N signals). **kit 9→13, validate_kit 13/13.** Review adversarial cazó **1 HIGH precioso:** la lección anti-carry-over de grace, aplicada **ciegamente** a edge_latch (signal con DATOS, no intención sticky), CREÓ un bug — obs durante una activity en vuelo se perdía → monitor latcheado para siempre; fix = **contador monotónico `_obs_seq`** (no flag reseteado). + drip README drift + reschedule cota off-by-one/fila-huérfana (la cota ahora ignora extra, siempre dispara). multi_signal limpio. **Lección meta: un patrón de fix NO es universal — aplicarlo sin entender el caso crea bugs nuevos; el review por-arquetipo es la red.**

**Pendiente:** integrar la instanciación de los arquetipos a `/generar-plano` (bloque C); **R5 (MAYOR, único generador)** sigue pendiente.

[[sprint-biblioteca-7-apps-techo-workflows]] [[no-codificar-la-esperanza-principio-raiz]] [[costo-incertidumbre-precision-ratchet]] [[kit-canonico-skeleton]]
