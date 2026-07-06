---
name: frente1-biblioteca-completa
description: Frente 1 — 3 apps (survey/status/digest) cierran la regla de tres de P4+P6 → 2 arquetipos cosechados (frontend_form_detail + notification_dispatch), kit 6→8, validate_kit 8/8. Biblioteca de primitivas P1–P6 completa. 2026-06-23 tarde.
metadata:
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**Frente 1 = "completar la biblioteca", `/goal` 100% autónomo (gate-agent firmó los 3 merge-gates con juicio senior real).** 2026-06-23 tarde. 3 apps por flujo C multi-tenant `uc_factory`, todas **`heal=0`, PR #1 MERGED** (gh-verificado): **survey-builder** (P4 form/detalle 3ª + P1 multi-entidad surveys/questions/responses+FK) · **status-page** (P6 notifier 2ª, services/incidents) · **digest** (P6 notifier 3ª + `DigestWorkflow` Temporal **batch durable**). Regla de tres cumplida en P4 y P6 → **2 arquetipos cosechados del fill VALIDADO**: `frontend_form_detail` (master/detail con `render_detail`+sub-lista, cage browser) + `notification_dispatch` (canal A-1 pluggable, cage python). **`validate_kit` 8/8** gates Docker reales → kit 6→8. **Con P1–P6 cosechadas, la biblioteca de primitivas está completa**; el cuello pasa a la **composición** (ROADMAP-apps ya no prioriza cobertura de primitivas).

**El sustrato `uc_factory` YA estaba pagado** (a diferencia del sprint anterior [[tres-apps-dogfooding-uc-factory]]): las 7 tablas nuevas (`apply_ddl_frente1.py`, idempotente, reusa `fusion-pg.env`) con `tenant_isolation` 7/7 + spike REST `ALL_OK` a la primera, **0 bloqueantes nuevos**. La próxima app multi-tenant tampoco repaga. Plano fiel + sustrato pagado → `heal=0` (flash llena iter-0). Confirma [[costo-incertidumbre-precision-ratchet]].

**Decisiones tácticas (C-2, reportadas):** (1) **materialicé los 3 skeletons yo mismo, no wave de sub-agentes** — el contexto compartido (contratos notifier/render_detail/multi-entidad) ya estaba cargado tras leer las instancias previas; sub-agentes = overhead negativo (Pilar 1 al revés) + riesgo de drift que rompe la cosecha limpia; **paralelicé donde rinde: los builds (oleadas de 2)**. (2) **survey sin graphity** (2 plataformas) — no sirve a ninguna cosecha, "sin sobreingeniería". (3) **digest = batch durable** (bounded loop, SIN `wait_condition`) — evita el gotcha `wait_condition RAISES TimeoutError` por completo + E2E rápido; cron = extensión futura.

**Paralelización medida (operador pidió "medir antes"):** oleada 1 = survey+status ∥ (sin Temporal, livianos) → sin OOM ni contención del factory-HOME de 2 gate-agents concurrentes; oleada 2 = digest solo (cage temporal más pesado). Funcionó; SeniorWorkflows durables → re-correr barato.

**Deuda gestionada:** `digest/frontend/app.py:28` `sub_id` sin `html.escape` en data-testid (cosmética, ids int → no XSS; cazada por gate-agent como concern menor, no gaming). Hotspot FRÍO → diferir correcto. [[cero-deuda-no-gestionada]].

Rama `feat/frente1-completar-biblioteca`. Reporte `docs/Implementaciones terminadas/2026-06-23-frente1-biblioteca-completa_reporte.md`. Repos `theoriginalcustodian/{survey-builder,status-page,digest}`. [[apps-lifecycle-hitl-autonomo]] · [[kit-canonico-skeleton]] · [[stack-canonico-real-sdk]].
