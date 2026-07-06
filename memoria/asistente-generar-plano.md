---
name: asistente-generar-plano
description: "Asistente de generación de plano (C-1 Nivel 2): skill /generar-plano + domain-cards Nivel 1 — el operador define el negocio, Claude deriva el plano técnico de las 4 plataformas para la fábrica"
metadata:
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**2026-06-22.** El **asistente que ayuda al operador a generar el plano (skeleton)** de una app, precursor humano-guiado de la autoría autónoma del plano (frente C). Dos niveles de C-1 (precomputación de dominio):

- **Nivel 1 — domain-cards (PR #63 `6567018`):** el dominio del STACK precomputado una vez. `deploy/skeleton_kit/domain-cards/{_schema.md, temporal, postgres, graphity, frontend}.md`. Esquema de 7 secciones (identidad·contrato·frontera·cross-plataforma·MAYOR/táctica·precomputado·evidencia). **Parametrizado (F-1):** plataforma nueva = agregar una ficha. Cosechadas de los arquetipos + `uc-stack-real`, validadas E2E. `postgres` marca `[ASSUMED_PENDING_VERIFY]` el DDL/RLS.
- **Nivel 2 — skill `/generar-plano` (PR #64 `55e1283`):** `.claude/skills/generar-plano/SKILL.md` (skill de PROYECTO, vive en el repo). Spec `docs/superpowers/specs/2026-06-22-skill-generar-plano-design.md`.

**El modelo (decidido, no re-litigar):** el **operador (CPU) origina SOLO el negocio** (qué hace la app · objetivo · qué problema resuelve al cliente · funcionalidades). **Claude (GPU) deriva TODO lo técnico** (B–J: ontología, schema, workflows, integraciones, tenancy, seguridad, done, gobernanza) desde el negocio. Integraciones externas y multitenancy **emergen** del negocio, no se preguntan aparte. Anti-patrón fatal C-2 #4: preguntarle al operador algo TÁCTICO — cualquier bifurcación se pregunta en **lenguaje de negocio** (ej. *"¿uno o muchos clientes?"* → deriva RLS; el operador nunca oye "RLS por org_id"). Mi taxonomía A–J pasó a ser el **checklist interno de Claude** (garantía de completitud), no preguntas al humano. Flujo: captura(3 modos, default guiado) → cierre de negocio(gate) → **trifecta 2.5** → derivación A–J → HITL → materialización (kit `scaffold.py` + molde `validate.py` + `REGLAS_NEGOCIO.md`). El skill PRODUCE el plano; la fábrica lo CONSTRUYE (flujo C).

**Trifecta cognitiva = paso 2.5 (gateado + cacheable):** hay DOS dominios — el del stack (cards) y el de la APP. La trifecta (`train-b2b-domain`: SOTA+FAILURE_MAP+DECISION_MATRIX) precomputa el dominio de la app → la derivación nace inmunizada, no ingenua. Gate por complejidad (CRUD trivial salta; regulado/integraciones/≥5 entidades/invariante-crítico la exige). Cacheable por dominio (biblioteca que crece con el dogfooding).

**Validado por dogfood (writing-skills RED→GREEN→REFACTOR):** un sub-agente FRESCO corrió el skill sobre una app de juguete (job-tracker) → plano fiel (ontología isomórfica, A–J completo, trifecta gateada bien, 11/11 py_compile, escaló el único MAYOR real = canal de entrega del recordatorio). Cazó 5 gaps → **cerrados (`af166b2`), gotchas a recordar para todo plano flujo C:**
1. **Dep cross-unit = `import` LITERAL top-level en el stub** (no solo docstring), o `factory_kit.imports_module` no la detecta → la fábrica NO monta la dep previa.
2. **Imports en módulo de workflow Temporal:** dep PURA del dominio = top-level OK; dep con I/O/SDK = solo en activity (la frontera es "no I/O en el workflow", no "no importes nada").
3. **NO generar `__init__.py`** — la fábrica (`read_skeleton`) los inyecta.
4. `scaffold.py`: `skeleton_root=` es de la FUNCIÓN, el CLI no lo expone.

**Construido vía:** spike-first (cazó que `framework-self-check` es **command** no skill) → brainstorming (spec) → operador rechazó el plan formal de writing-plans por excesivo para un skill (correcto) → `/writing-skills` + `/skill-creator` (formato Claude Code) → dogfood. **Feedback del operador canonizado:** [[batch-cambios-no-pr-por-tweak]] (no PR por tweak — acumular en la rama).

**✅ E2E REAL VALIDADO (2026-06-22) — primer dogfooding con la fábrica.** App **Trial Tracker** (SaaS multi-tenant: alta + vencimiento durable + cancelar/extender) generada por el skill: el operador definió **solo el negocio**; sus 3 cambios de negocio (multi-tenant · aviso interno · cancel/extend) derivaron a RLS por `cliente_id` + señales del workflow + scoping app-level — sin tocar nada técnico. Flujo C → **SeniorWorkflow: build + `validate_real` 4 plataformas VIVAS (fusion Supabase + Graphity + cluster Temporal + Chromium) con `heal_turns=0` (pasó a la primera) + merge-gate (clic real del operador) → PR #1 MERGED a `main`**. 0 `NotImplementedError` (el músculo rellenó las 4 unidades, incl. el `TrialWorkflow` con señales que marqué como riesgoso). Repo `theoriginalcustodian/trial-tracker`. **Verificaciones empíricas que evitaron codificar la esperanza:** inspeccioné la convención RLS REAL de fusion (`cliente_id` + claim JWT, igual que RAG/documed) ANTES del DDL (habría usado `tenant_id text`, inconsistente) · confirmé las 3 jaulas + feature-dev UP · cacé leyendo el código que el SeniorWorkflow **necesita GitHub** (open_pr/merge) → un repo local es incompatible (las 2 elecciones del operador chocaban). **Pendiente:** actualizar docs maestros (CLAUDE §5 + ROADMAP + ARCHITECTURE: el asistente existe + E2E validado). Relacionado: [[kit-canonico-skeleton]] · [[stack-canonico-real-sdk]] · [[seniorworkflow-durable-sp7]].
