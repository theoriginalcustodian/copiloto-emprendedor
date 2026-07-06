---
name: apps-lifecycle-hitl-autonomo
description: 3 apps lifecycle (P2) construidas 100% autónomas + fix timeout ordering del cage + arquetipo backend_temporal_hitl cosechado
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**2026-06-23.** `/goal "terminar todos los TODOs"` **100% autónomo**: el operador delegó las confirmaciones de Telegram → los merge-gates los firmó el **gate-agent** (juicio senior real con `claude -p`, lee el repo, NO rubber-stamp). 3 apps del stack canónico (4 plataformas) construidas por flujo C, todas **`heal_turns=0`**, PR #1 MERGED: `tickets-sla` (SLA/escalate) · `expense-approval` (HITL signal) · `dunning` (retry-backoff). Con `trial-tracker` (cancel/extend) = **4 instancias de la primitiva lifecycle (P2) → regla de tres superada → arquetipo cosechado de evidencia**.

**Causa raíz cazada (timeout ordering — NO el docstring):** el cage temporal/browser tenía `timeout=120s` > el `_TEST_TIMEOUT=90s` del activity `run_tests` (`shared/loop_core.py`, ladrillo INTACTO) → un fill que se cuelga cancela la activity (`CancelledError` irrecuperable) a los 90s ANTES de que el sandbox devuelva el ROJO limpio (`subprocess TimeoutExpired→passed:False`) a los 120s → el micro-loop NO se auto-corrige. El cage python (60<90) tenía el orden correcto (por eso python se recuperaba y temporal no). **Fix:** `deploy/worker/config.py` temporal/browser → **75** (<90), invariante documentado en el código. NO toca loop_core. El docstring del `wait_condition` era SÍNTOMA.

**Gotcha cosechado:** `workflow.wait_condition(pred, timeout=...)` **LANZA `asyncio.TimeoutError`** (NO devuelve `False`) — 2/3 planos lo erraron (el músculo copia el docstring; uno mentiroso → fill colgado). Cosechado a 3 niveles: domain-card `temporal.md` §2/§3 + README de `backend_temporal` + **arquetipo nuevo `backend_temporal_hitl`** (stub+test+reference cosechados del fill VALIDADO de expense-approval; `validate_kit` **6/6** gate real + suite kit **9/9** golden anti-drift). Cazado **proactivo** en dunning ANTES del build (su test era fiel, el docstring no — el "docstring OK" del resumen previo solo descartaba `returns False`).

**Intake desatendido (embrión SP8):** `deploy/ops/run_senior_autonomous.py` = start SeniorWorkflow + gate-agent atiende los gates + reporta resultado, en uno (reusa `gate_agent.run`, DRY).

**Pendientes:** utils-lib P5 destino (lib runtime importable vs arquetipo estampado) = **decisión MAYOR diferida** (se decide por función). Paralelización N SeniorWorkflows: CX33 8GB → **oleadas de 2** (3 arriesga OOM por cages browser 2g+temporal 1g), medir `free -m` antes de subir. Rama `feat/cosecha-hitl-hardening-roadmap`. Reporte `docs/Implementaciones terminadas/2026-06-23-tres-apps-lifecycle-cosecha-hitl-autonomo_reporte.md` · backlog `docs/ROADMAP-apps.md`. Relacionado: [[kit-canonico-skeleton]] · [[seniorworkflow-durable-sp7]] · [[flujo-c-economia-baseline]] · [[costo-incertidumbre-precision-ratchet]] · [[asistente-generar-plano]].
