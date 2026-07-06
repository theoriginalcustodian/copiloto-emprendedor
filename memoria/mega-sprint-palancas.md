---
name: mega-sprint-palancas
description: "Mega-sprint 8 palancas de la fábrica (F1/B1/B2/E2/A1/A2/A3/D2/D1) implementadas + E2E + MERGEADO PR #46"
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**2026-06-21 — Mega-sprint de palancas, ejecución autónoma E2E.** 8 palancas no-gated implementadas + validadas en el VPS sobre `feature_workflow.py` ("la casa"), sobre la rama **`feat/mega-sprint-palancas`** (8 commits, **✅ MERGEADO PR #46, 2026-06-21**). Ladrillo `loop_core.py` **INTACTO** (`git diff main` vacío). Review final whole-branch ultracode (4 lentes) = **0 blockers**.

**Las palancas (qué desbloquean):**
- **F1** (`9af58e1`): frontera de seguridad = **evidencia ejecutable** (`test_frontier.py`: canarios red/secretos/read-only/uid contra la jaula real) + cierra hueco real: `_docker_pytest`/`_flatten_units` ahora rechazan `conftest.py`/`sitecustomize.py` (vector gate-corruption en integración). `26 passed`.
- **B1** (`759ff69`, review opus APRUEBA): **held-out + Hypothesis** cierra reward-hacking. Imagen `:2` (+hypothesis), activity `validate_held_out` post-passed (surface a gate2, NO auto-abort), scaffold genera `heldout_<file>` no-colectable property-based. `held_out_code` NUNCA al músculo. Hygiene fix `bc6a322`: held-out vive en state, no se commitea al PR.
- **B2** (`af5d284`): materializa `integration_tests` (estaba definido-sin-usar) → `test_integration.py` cross-unit en la suite.
- **E2** (`9f021ae`): `_enrich_task` puro = instrucción localizada (CONTEXT/DO-NOT-BREAK/EDGE-CASES) → "dale el plano, no la orden" ([[localizacion-estructurada-feedback-agentes]], TDAD ~-70% regresiones).
- **A1** (`15fc664`): imagen `:2` + numpy 2.4.6 + requests 2.34.2 (version-pin, allowlist, quarantine sitecustomize) → features numéricas/HTTP. Frontera intacta con deps (5 canarios verdes). Decisión MAYOR operador: imagen global, ladrillo intacto.
- **A2** (`15fc664`): `_FAKES_GUIDANCE` en 3 prompts → fakes stdlib (sqlite3 :memory:, http.server loopback) p/ features stateful/servicio bajo `--network none`. Aserción de comportamiento.
- **A3** (`e81327a`): `_VALID_FLAT_NAME` endurece el contrato FLAT (descarta `my-lib.py`/`2d.py`). NO habilita paquetes (canon flat-only exprkit, CLAUDE.md §5).
- **D2** (`c420c35`, ADR-017): factory-HOME = aislamiento del contexto personal del operador. **Spike refutó el "88% menos cache"** (artefacto cold-vs-warm) → reframe honesto a aislamiento.
- **D1** (`15fc664`): `--model` + `claude_model_map` (plan/scaffold/fill), default opus, configurable.
- **D3 ARCHIVADA**: medición empírica = ya paraleliza (`start-all-then-await`) → no-op.

**Evidencia E2E** (`repo-prueba`, gates self-driven por `temporal signal`): `romanize1` (D2+F1+E2) · `romanize2` (B1 `held_out_failed:[]`) · `ola5` (B2 gen + A1/A2 + D1 `scaffold→sonnet`, integración `passed:True`). Economía: `real_usd≈$0.0005` flash · `claude_equiv≈$0.63` sombra Max.

**Spike-first se pagó solo**: D3 y D2 eran premisas falsas, detectadas antes de construir ([[no-codificar-la-esperanza-principio-raiz]], [[spike-first-central-proyecto]]).

**Deuda gestionada** (TODO + acá): hash-pin SHA256 de deps (jaula contiene el blast radius) · distinguir exit2/exit1 en held-out · auto-reparación held-out v2.

Reporte: `docs/Implementaciones terminadas/2026-06-21-mega-sprint-palancas_reporte.md` · ledger: `docs/superpowers/plans/2026-06-21-mega-sprint-EXEC-LEDGER.md`. Construye sobre [[casa-fabrica-features-diseno]].
