---
name: gap-b-router-fixed-mount-r1
description: Gap B — router del conversational_agent pasó a fixed-mount (motor dispatch.py); músculo rellena solo las 4 hojas. App E2E verde; 1 fix de fábrica pendiente
metadata: 
  node_type: memory
  type: project
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**Gap B (conversational_agent factory-generable) — estado 2026-07-01.**

**Decisión R1 (fixed-mount) para `router`:** la state-machine confirm-gate NO es músculo-rellenable — es genérica (idéntica para todo agente) y densa (5 invariantes acopladas → regla 11). El músculo no-frontier NO la sostiene: flash Y pro **oscilan 2-3/5 sin converger** aun con budget + feedback perfectos (spike empírico). Solución canónica R1 (misma que workflows complejos):
- La máquina genérica vive en el **motor**: `archetypes/conversational_agent/reference/backend/agent/dispatch.py` → `make_dispatcher(valid_entities, texts, +4 hojas) -> dispatch`. Gate-testeada 1× (`test_dispatch.py`, 7/7).
- El unit `router` fue **ELIMINADO** del dominio. `register` (FIJO, sin NotImplementedError) cablea `make_dispatcher`. La config (VALID_ENTITIES + TEXTS) vive en `prompt_artifact.py` (artefacto del plano).
- El músculo rellena solo **4 hojas** (confirm/entities/tools/context), que resuelve limpio en flash iter-0/1.

**Estado verificado:**
- E2E: `archetypes/conversational_agent/test_stub.py` → **1 passed** (agente completo durable + confirm-gate multi-turno funciona).
- Kit: `validate_kit.py` LIVE → **20/20** (motor:dispatch + 4 hojas + register).
- Acceptance R1 (`/opt/uc-agent-ref2`): las 4 hojas rellenaron en flash; app terminada a mano (commit `06bad11`), ensambla + dispatcher callable.
- **MERGED a main:** PR #103 (merge commit `5aa7b15`, 2026-07-02). Gate VPS re-verificado verde: `skeleton_kit/tests` 62p/4s · `test_dispatch` 7 · `test_stub` E2E 1. El **Copiloto B (agente Calendar real) re-verificado E2E PASS post-R1** (`test_e2e_agenda_evento`, evento real en `341lin@gmail.com` + read-back) → **R1 no regresiona** al agente productivo.

**1 FIX DE FÁBRICA PENDIENTE (próximo sprint, documentado):** el gate del build canónico del FeatureWorkflow NO ensambla el motor mateado (`backend/agent/*`) en los dep_files de un unit que lo importa → `register` falló con `ModuleNotFoundError: No module named 'backend'`. **NO es bug de register** (pasa en validate_kit + E2E); es dep-assembly del gate. Detalle + fix en `docs/Follow up/2026-07-01-fabrica-fix-motor-deps-en-gate-canonico.md`. Root: `_read_repo_context`/`_repo_deps_for_unit` (feature_activities.py) debe incluir `backend/agent/**`.

**Otro fix de raíz aplicado en el sprint:** [[reasoning-model-max-tokens-content-vacio]] (max_tokens 1500/4000 → 16000). [[no-pelear-con-la-fabrica-hand-fix-primero]] [[r1-workflow-templates-fixed-mount]] [[agente-conversacional-hardening-3-lentes]]
