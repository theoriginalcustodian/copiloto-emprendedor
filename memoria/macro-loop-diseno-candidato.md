---
name: macro-loop-diseno-candidato
description: "Diseño CANDIDATO del macro-loop (loop de dos niveles) de Unreal Copilot — decisor en cascade + HITL de 3 reglas + deuda del micro-loop a endurecer. Emergente de exploración conceptual, NO decisión cerrada."
metadata: 
  node_type: memory
  type: project
  originSessionId: 22f9be26-6dc0-477b-b7b3-0d6b7afc3ac6
---

# Diseño CANDIDATO del macro-loop (loop de dos niveles)

> ⚠️ CANDIDATO emergente de exploración conceptual (2026-06-16), **NO decisión cerrada/aprobada ni ADR**. Cuando se construya el F6, revalidar y ajustar. No tomar como verdad implementada — el código solo tiene el micro-loop. Ancla conceptual del campo en [[loop-engineering-framing]].
>
> 🔄 **ACTUALIZADO 2026-06-17 → ASCENDIDO a diseño cerrado** en [[casa-fabrica-features-diseno]] (spec `2026-06-17-casa-fabrica-features-e2e-design.md`), con **una CORRECCIÓN de fondo: Claude Code headless = ARQUITECTO E2E, NO airbag.** El **§3 de abajo quedó SUPERADO** — NO es "Hermes decisor default + Claude airbag por métrica". En la casa: **Claude planifica TODO E2E** (descompone + escribe andamiaje + tests + integra) y **Hermes es el nervio fiel** (observabilidad + ejecutar órdenes explícitas, NO decisor). El §1 (loop a dos niveles), §2 (función de transición, techo=verificador), §4 (HITL 3 reglas) y §5 (deuda del micro-loop) siguen vigentes. SP1 (Claude planificador) + SP2 (cadena C+A) validados E2E (PRs #13, #14).

## 1. El loop = mismo patrón a dos escalas (anidar)
- **Micro-loop = unidad confiable.** Lo ya implementado/probado en el spike (`IterativeCodeWorkflow`): coder→test→reasoner→fix con **gate pytest objetivo** + meta anclada + estado externo. Garantiza que CADA unidad de trabajo converge a verde o se rinde con criterio. Estado de ejecución del spike en [[kaggle-temporal-overlay-spike]].
- **Macro-loop = inteligencia de dirección.** Un decisor rico elige QUÉ tarea encarar, la baja al micro-loop, lee el resultado **ya verificado**, decide el próximo paso de un espacio abierto. Orquestado durablemente por Temporal.
- **Anidados son estrictamente mejores** que cualquiera solo: el micro da *piso de confianza* (todo lo que baja vuelve verificado); el macro da *objetivo que vale* (qué construir). Ralph pelado = rápido sin garantía; micro solo = converge una tarea pero no decide cuál. Es la versión "seria" (durable) de loop engineering.

## 2. Loop engineering bien entendido
- **"Diseñar loops que prompteen a tus agentes" = EL LOOP promptea** (vos como ingeniero), NO los agentes autogenerándose prompts. El loop genera dinámicamente el prompt según el estado observado; los templates pueden ser estáticos — lo dinámico es *qué inyecta el loop*.
- **La magia no es "el prompt dinámico" — es la FUNCIÓN DE TRANSICIÓN:** `(META anclada de solo-lectura + OBSERVACIÓN verificable + ESTADO externo reseteado) → próxima TÁCTICA`. Solo la táctica se autogenera; la meta se ancla (mata *goal drift*), la observación se mide.
- **El techo de calidad lo fija el VERIFICADOR, no el prompt.** Prompt perfecto + verificador débil = colapso; prompt mediocre + verificador fuerte = converge.

## 3. Decisor del macro-loop = CASCADE (no entidad única)
- **Hermes (GPT-4o-mini) = decisor DEFAULT y punto de partida.** Vive en el VPS (control-plane *confiable* — el decisor NO puede correr en el sandbox no confiable de Kaggle), ya containerizado, ya habla el MCP thin de Temporal → mecánicamente hace toda la labor. Fiel al espíritu $0 (gpt-4o-mini vía OpenRouter, más barato que el Kimi K2 original; modelo cambiado el 2026-06-18 por tool-calls mal formados de Kimi — ver [[canal-whatsapp-hermes]]).
- **Claude Code headless (Agent SDK / `claude -p`) = AIRBAG, no volante.** El mejor decisor rico disponible, pero caro y reintroduce dependencia de API en la dirección. Se invoca SOLO en el escalón difícil y **se activa POR MÉTRICA**: arrancar con Hermes solo, medir dónde falla (loops que no convergen, malas descomposiciones, vías muertas, correcciones humanas frecuentes), agregar Claude únicamente donde la evidencia lo pida. Construir la cascade de 3 por adelantado = sobreingeniería (corrección del operador).
- **Dos ejes de escalada ORTOGONALES:** dificultad (Hermes→Claude) ≠ autoridad (máquina→humano).
- **Invocación durable:** el decisor headless corre DENTRO de una activity de Temporal (efímero/stateless por tick, estado en Temporal), no como proceso suelto. Restringido a *decidir + delegar al sandbox*, nunca ejecutar código no confiable (regla 6).

## 4. HITL = 3 reglas ortogonales
- **Disparo por AUTORIDAD, no por dificultad.** Se escala a humano porque algo es MAYOR (irreversible / fuera de mandato), no porque el decisor "no pueda". Cualquier decisor (Hermes incluido) escala **directo** a humano si huele MAYOR — no rebota en Claude primero (evita el salto y el costo de invocar Claude solo para tramitar el HITL).
- **Espera DURABLE por signal.** El workflow se *suspende* esperando un signal (la decisión humana); Temporal persiste el estado mientras el humano tarda (min/horas/días) sin proceso vivo; la decisión entra como **signal que despierta el workflow donde quedó**. Destinatario autoritativo = el workflow, NO un mensaje suelto a Hermes (que se perdería si Hermes reinicia). Hermes = cartero (te contacta + recibe la respuesta); Temporal = lo que mantiene el loop esperándote. Patrón: signal-based HITL (skill `temporal-ai-patterns`).
- **Gate DURO para lo irreversible.** Defensa en profundidad: además del HITL por juicio del LLM (sensor *blando*), una lista **determinística** de acciones que SIEMPRE requieren OK humano sin importar qué piense el decisor (push a `main`, borrar datos, deploy productivo, gasto > X, tocar otro sistema). El LLM débil puede no reconocer un MAYOR; el gate duro cubre lo que el juicio no ve. El juicio escala lo conocido; el gate duro es el cinturón.

## 5. Deuda del micro-loop detectada (análisis estático de `IterativeCodeWorkflow`, agents_kernel.py)
A endurecer ANTES de apoyar el macro encima (el macro hereda el techo del verificador del micro). NO bloqueante para la fase actual (validar la maquinaria E2E del micro). Propietario: operador. Sprint target: endurecimiento pre-producción del micro / construcción del macro.
- **Verificador GAMEABLE:** tests visibles (vía traceback en `{error}`), gate binario `passed=returncode==0`, sin held-out → `passed:true` puede ser hardcoding/early-return, no implementación real. Es el modo de colapso más relevante para coder→test→reasoner con 4 iters (*falsa convergencia*). Mitigación: held-out tests + casos negativos + auditor estático anti-hardcoding.
- **Sin invariants-log:** `history` se appendea pero NUNCA se re-inyecta al prompt del fixer → el coder no sabe "estos tests ya pasaban, no los rompas" → puede oscilar / quemar iters. (El gate full-suite SÍ impide aceptar una regresión → no es oscilación silenciosa, es ineficiencia/no-convergencia.)
- **Feedback SIN sanitizar:** stdout crudo de pytest entra como `{error}` al reasoner sin delimitadores → vector de prompt injection; choca con la regla 6 del CLAUDE.md (frontera datos/instrucciones). Mitigación: pasar solo `{passed, línea_de_error}` estructurado; delimitadores con UUID por sesión.

## 5b. Modos sumados por el reporte SOTA (2026-06-16) — ver `docs/research/2026-06-16-loops-sota-failuremap.md`
**Agravantes verificados en código del "verificador gameable" (arriba):** (1) el reasoner es deepseek-r1 → **hackea gates por default**; (2) `run_tests` escribe `solution.py` Y `test_solution.py` en el MISMO tmpdir/UID que tiene la SSH key del túnel → **el evaluador NO está aislado** (la afirmación "el invariante VPS-no-ejecuta-IA aísla el evaluador" es FALSA: los tests corren en Kaggle junto al código); (3) un gaming exitoso queda PERMANENTE por el cache idempotente (modo nuevo abajo). El reporte lo marca como el modo de fallo **#1 más peligroso**. Mitigación plug-and-play HOY: gate complementario "el diff no toca archivos de test" + held-out regression tests. Aislamiento fuerte = F6 (ESCALAR MAYOR).

**Cuatro modos nuevos (ausentes del análisis estático):**
- **`ACT_RETRY=0` (retry ILIMITADO) sobre `infer`/`run_tests` sin idempotency key:** una activity que falla post-efecto se reintenta infinitamente → **quema cuota Kaggle** (el recurso más escaso, 30h/sem). Mitigación: `maximum_attempts` finito + idempotency key (Run ID + Activity ID). Táctico, plug-and-play.
- **COMPLETED-malo cacheado por hash idempotente:** `start_code_task` usa workflow_id determinístico (hash) + `ALLOW_DUPLICATE_FAILED_ONLY`, y `CodeTaskWorkflow` NO falla ante test-fail → un resultado COMPLETED con tests rojos queda **permanentemente cacheado** y bloquea el reintento legítimo. Combinado con reward hacking = el peor escenario del sistema. Mitigación: el workflow debe FALLAR ante test-fail (F6 Task 2).
- **RUNNING-zombie indistinguible de RUNNING-activo:** `get_task_status` no distingue un worker vivo de uno esperando un worker apagado (fuera de ventana Kaggle) → el operador no sabe si progresa o está colgado. Mitigación: heartbeat / search-attribute de "última actividad de worker" + healthcheck del túnel.
- **Desperdicio de GPU como fallo económico de la cascade:** el pipeline secuencial de 3 etapas usa **1 GPU a la vez → ~50% de la cuota Kaggle desperdiciada** por diseño, sobre el cuello de botella real del sistema. Mitigación: paralelizar 1 tarea/GPU o pipeline async.

Relacionado: [[loop-engineering-framing]] · [[plataforma-agentica-estado]] · [[kaggle-temporal-overlay-spike]] · [[variante-deepseek-aditiva]] · [[trabajo-por-fases-no-anticipar]].
