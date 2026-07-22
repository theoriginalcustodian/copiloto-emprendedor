---
name: historia-hitos-cerrados
description: "Bitácora cronológica de hitos CERRADOS de la fábrica Unreal Copilot (por fecha/PR). Consultar para historia/provenance, NO es estado vivo. El estado vivo está en MEMORY.md + docs/ROADMAP.md + CLAUDE.md §5."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6784837f-d1f4-4fa0-ba69-0620e24abcf0
---

# Historia — Unreal Copilot (hitos cerrados)

> **Qué es esto:** bitácora cronológica de hitos **cerrados** (builds, sprints, decisiones implementadas), uno por línea, con fecha + PR + link al archivo de tópico (que conserva el detalle). **NO es estado vivo** — el "¿qué sigue?" vive en `docs/ROADMAP.md`, el estado detallado en `CLAUDE.md §5`, la arquitectura en `docs/ARCHITECTURE.md`, y la doctrina/lecciones vivas en `MEMORY.md`. Esto se archiva fuera del índice cargado por sesión para no penalizar el prompt-cache (CLAUDE.md global: "memoria operativa ≠ bitácora").
>
> **Política de ciclo de vida:** cuando un hito cierra, su línea de índice se mueve acá. El archivo de tópico permanece en `memory/` (recallable por relevancia). Orden: **más reciente primero**.

## 2026-06-30
- **2026-06-30** · [ComposioGateway — primer ladrillo del Copiloto del Emprendedor](composio-gateway-ladrillo.md) — boundary fail-closed a Composio como 3er provider agnóstico del arquetipo `conversational_agent`. Fail-closed en profundidad (denylist gana sobre policy + writes `confirmed=True` = doble candado con HITL). 2 planos (ejecución + conexión). 15 unit + 3 integration real (VPS). Fase 0 diferida por el operador. PR #95 (`c9541cb`).

## 2026-06-25
- **2026-06-25** · [3 apps del techo regeneradas RICAS (heal=0) + fix race signal-al-start](apps-ricas-fix-race-signal.md) — subscription/appointment/inventory ricas E2E. Raíz: reset clear-on-enter pisa signal buffereado → **clear-on-consume** (test vía `start_signal`). heal no toca FIJOS; gate-agent max-turns→30.

## 2026-06-23
- **2026-06-23** · [Cierre composición — M1 boundary linter (ast) + régimen mixto E2E](composicion-cierre-m1-mixto.md) — `verify_piece_boundary` PURA vía `ast`; 41 tests. Mixto ALL PASS vs cluster vivo. Fix `asyncio.sleep`→`workflow.sleep`.
- **2026-06-23** · [Composición por código implementada (E2E cerrado)](composicion-por-codigo-implementada.md) — Comp-0 spike + Comp-1 modular-monolith (ADR-018) + Comp-2 fábrica genera sistemas. `loop_core` intacto.
- **2026-06-23** · [Decisión: composición por código](decision-composicion-por-codigo.md) — D-1: microservicios por CÓDIGO (un deployable, acople build-time). Por-servicio diferido.
- **2026-06-23** · [Frente 1 — biblioteca de primitivas completa](frente1-biblioteca-completa.md) — survey/status/digest cierran P4+P6; 2 arquetipos cosechados; kit 8/8. P1–P6 completas.
- **2026-06-23** · [3 apps dogfooding + sustrato uc_factory](tres-apps-dogfooding-uc-factory.md) — feedback/mini-crm/alerting heal=0. Sustrato `uc_factory` pagado one-time (3 bloqueantes cazados por spike).
- **2026-06-23** · [3 apps lifecycle + arquetipo HITL + fix timeout ordering](apps-lifecycle-hitl-autonomo.md) — arquetipo `backend_temporal_hitl` (kit 6/6). Fix: cage 75<activity 90. Gotcha `wait_condition` RAISES.

## 2026-06-22
- **2026-06-22** · [Asistente /generar-plano (C-1 Nivel 2)](asistente-generar-plano.md) — operador define negocio, Claude deriva plano técnico. E2E real con Trial Tracker (4 plataformas vivas, heal=0). *(Superseded por r5 = único generador.)*
- **2026-06-22** · [SeniorWorkflow durable (SP7 sub-2)](seniorworkflow-durable-sp7.md) — loop senior en Temporal: child subordinate + `validate_real` + `heal` + merge-gate HITL. PR #55.
- **2026-06-22** · [Kit canónico del skeleton (SP7 sub-1)](kit-canonico-skeleton.md) — 5 arquetipos + `validate_kit` 5/5 gates Docker reales. PR #54 + molde `validate.py` PR #57.
- **2026-06-22** · [Stack canónico 4 plataformas + app real-SDK validada E2E](stack-canonico-real-sdk.md) — gate multi-jaula; frontera por inyección. Doctrina: flujo C para contratos externos.

## 2026-06-21
- **2026-06-21** · [Loop de desarrollo + app real unitkit + /goal auto-convergente](loop-desarrollo-gate-senior.md) — gate senior autónomo (`gate_agent.py`); `/goal` = bucle durable Temporal. PR #52.
- **2026-06-21** · [Self-Test Kit: factory_kit (#2) + Golden Eval Harness (#1)](self-test-kit.md) — `factory_kit.py` centraliza lógica pura compartida. Eval Harness: velocímetro regresivo. PR #50.
- **2026-06-21** · [Verificador de descomposición de planes (#3 Self-Test Kit)](plan-verifier.md) — `plan_verifier.py` PURO: caza ciclos/deps-rotas antes del gate1. PR #49.
- **2026-06-21** · [Build incremental GitHub (repos + auto-merge + deps cross-feature)](github-incremental-builds.md) — `create_project.py` + auto-merge squash + `read_repo_context` cross-unit. PR #47. 🔐 PATs rotar.
- **2026-06-21** · [Mega-sprint de palancas (8 implementadas)](mega-sprint-palancas.md) — F1·B1·B2·E2·A1·A2·A3·D2·D1. D3 archivada. loop_core intacto. PR #46.
- **2026-06-21** · [Flujo C "esqueleto provisto"](flujo-c-esqueleto-provisto.md) — modo ADITIVO: operador andamia stubs+tests, fábrica solo rellena. `read_skeleton` → downstream idéntico. PR #51.
- **2026-06-21** · [Harness se mide a sí mismo — Gap2+Gap3](harness-observabilidad-gap2-gap3.md) — Gap3: 7 suggesters loguean → FP-rate. Gap2: Stop hook `completion_evidence_gate`. `HARNESS.md`.
- **2026-06-21** · [Memoria en grafo de la fábrica — MERGEADA + ACTIVADA](memoria-grafo-fabrica-diseno.md) — PR #41; `UC_GRAPHITY_ENABLED=1`; Claude escribe post-GATE2, músculo lee mediado.

## 2026-06-20
- **2026-06-20** · [SP6 — Observabilidad CERRADO](sp6-observabilidad.md) — `real_usd` (DeepSeek) vs `claude_equiv_usd` (sombra Max). Dashboard CLI + `/pending`. PR #31.
- **2026-06-20** · [Roadmap de palancas + C2 PR real CERRADO](roadmap-palancas.md) — 15 palancas por ROI; C2 cerrado E2E (gh auth + repo + PR#1 real). Fábrica L2→L3. *(Superseded por mega-sprint.)*
- **2026-06-20** · [Activación de skills de Temporal sin citarlas (C+D)](temporal-skill-activation-harness.md) — regla #3 imperativa en CLAUDE.md + hook `temporal_workflow_validator.mjs` (PreToolUse). `HARNESS.md §1.3`.

## 2026-06-19
- **2026-06-19** · [La casa — Fábrica de Features E2E (núcleo)](casa-fabrica-features-diseno.md) — `FeatureWorkflow` durable (PR #27). Claude=arquitecto, DeepSeek=músculo, 2 gates HITL. SP4 cross-unit, SP5 cascade, exprkit 107 tests. *(Mecanismo: ver `docs/ARCHITECTURE.md`.)*
- **2026-06-19** · [Durabilidad cross-corte VALIDADA (F6 Task 1)](durabilidad-cross-corte-validada.md) — spike E2E: workflow sobrevive 92s sin worker, reanuda +2s, no re-ejecuta.
- **2026-06-19** · [HITL callback→signal VALIDADO](hitl-callback-signal-validado.md) — spike clics reales Telegram → signal → `wait_condition` despierta. Bug: `wait_condition` RAISES `asyncio.TimeoutError`. PR #27.
- **2026-06-19** · [Harness mejorado: code-reviewer user-level + audit-claude-md Dim 6](harness-code-reviewer-audit-mejorados.md) — `code-reviewer.md` con ECC (pre-report gate, FP suppression). `audit-claude-md` +Dim6 seguridad.
- **2026-06-19** · [OpenWA evaluado y descartado](openwa-descartado.md) — descartado: HITL ya resuelto con Telegram signal-based.

## 2026-06-17
- **2026-06-17** · [Loop DeepSeek OPERATIVO](loop-deepseek-operativo.md) — worker systemd `coding-agents-deepseek`; `loop_core.py` agnóstico; Docker hardened. PRs #6-#10. Hallazgos: chmod, flash defadd, CRLF.

## 2026-06-16
- **2026-06-16** · [Kaggle-Temporal: sistema multi-agente](kaggle-temporal-overlay-spike.md) — 2 LLMs soberanos Kaggle (qwen2.5-coder+deepseek-r1:14b), Ollama, túnel SSH. `autossh`→`ssh` fix. `IterativeCodeWorkflow` E2E. PR #2.

## Movidos del índice el 2026-07-22 (auditoría de memoria)

El topic file sigue existiendo y es buscable; sólo salió del índice que se carga en cada sesión.

- [💳 Billing — J27 colisión de tablas → namespacing](billing-system-sistema-compuesto.md) — `project`. **Afecta TODA app nueva.** + guard en provision_tables. Arquetipo `recurring_charge`.
- [🚀 Copiloto del Emprendedor — walking skeleton E2E (#97)](copiloto-emprendedor-roadmap.md) — `project`. **LEER al retomar.** Agente durable + Composio + BI; reusa `ConversationWorkflow`. Gaps A/B/C. [[factory-identidad-automatizacion-ia]]
- [📱 Copiloto frontend móvil (PWA) — UX + retoma](copiloto-frontend-movil-ux-estado.md) — `project`. **LEER al retomar frontend móvil.** Deploy solo-frontend=`sync-web.sh` (NO deploy.sh). Sesión persistente vía refresh-token (PR #118). [[pwa-sw-staleness-gotcha]]
- [Plataforma Agéntica — accesos/infra](plataforma-agentica-estado.md) — `project`. **LEER PRIMERO.** VPS Hetzner 133209712, 178.105.191.1. Temporal `127.0.0.1:7233`. [[deuda-secretos-rotar]]
- [🏭 No pelear con la fábrica — hand-fix + E2E primero](no-pelear-con-la-fabrica-hand-fix-primero.md) — `feedback`. **LEER cuando la fábrica renega.** Snapshot no stream · E2E verde YA.
- [🔌 MCP Composio — Gmail (scope user)](composio-mcp-gmail-acceso-completo.md) — `project`. Auth Bearer. Riesgo lethal trifecta. NO heredar a agentes autónomos.
