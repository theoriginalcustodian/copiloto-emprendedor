---
name: r5-generar-plano-unico-generador
description: "R5 — /generar-plano es el único generador (instancia los 7 arquetipos Temporal + lecciones consolidadas + modo batch). Cierra D8/D9/D10/C7/B4. uc_tables.json, no schema.sql."
metadata: 
  node_type: memory
  type: project
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

R5 (MAYOR, 2026-06-24, rama `feat/r5-generar-plano-unico-generador`): `/generar-plano` pasó a ser el **único generador** de planos. Decisión del operador: **skill-centric** (motor = Claude+skill, gaps de código mínimos) + scope **completo** (3 fases). Retira el generador ad-hoc del sprint biblioteca (2ª fuente de verdad que divergía).

**3 componentes:**
1. **Lecciones consolidadas:** regla-11 rellenabilidad (`factory_kit.count_fillable_methods` AST + check `unfillable_unit` surface-only en `plan_verifier`, umbral 6 — los FIJOS dan 0) · DDL tipado vía **`uc_tables.json`** (el manifiesto que `provision_tables` REALMENTE lee — `{tabla: ["col TIPO modif"]}`, columnas tipadas; la fábrica agrega `id bigserial`/`cliente_id uuid`/RLS `auth.jwt()` — NO el generador) · `ClientOptions(schema=uc_factory)` en el molde con try/except (supabase sin pin).
2. **Instanciar los 7 arquetipos Temporal:** tabla patrón→arquetipo + contratos de store en `temporal.md` §8. Un FIJO = **2 units** (workflow FIJO gate-only `backend/<app>.py` + store rellenable cage python `clients/<app>_store.py`). MANUAL.md con los 5 FIJOS.
3. **Modo batch:** N briefs → derivación B-J autónoma. **Preserva C-2** (cierre de negocio en el brief, NO se elimina; brief sin cerrar → `PENDIENTE_NEGOCIO`).

**Núcleo `loop_core`/`read_skeleton` INTACTO** (skill-centric: 1 función pura + 1 check + 3 docs + 1 línea de molde).

**Evidencia:** spike S1 (instanciar grace+store → read_skeleton clasifica) · spike S1+ (los 5 FIJOS + **la tabla §8 es fiel a los stubs reales**) · **gate E2E** (la fábrica construyó `appointment`/reschedule rico —app del techo, FIJO ≠ grace— → gate2, workflow intacto, store rellenado) · plan_verifier 29 · worker 264+1skip · validate_kit 13/13 · `uc_tables.json` aceptado por `provision_tables`. Review opus **APPROVE WITH FIXES** (0 CRITICAL, código sin findings); 3 findings documentales cerrados (HIGH `schema.sql`→`uc_tables.json` · MEDIUM RLS `text`→`uuid`+`auth.jwt()` · LOW import fallback) — eran **codificar-la-esperanza** sobre la provisión, corregidos contra `provision_tables.py` real.

**Con R5 + R1, las apps del techo (appointment/subscription/inventory) se pueden regenerar RICAS** vía el FIJO correspondiente (reschedule/grace/edge_latch); el E2E ya lo probó con appointment. El cuello dejó de ser el generador. Reporte `docs/Implementaciones terminadas/2026-06-24-r5-generar-plano-unico-generador_reporte.md`. [[sprint-biblioteca-7-apps-techo-workflows]] [[r1-workflow-templates-fixed-mount]] [[asistente-generar-plano]] [[no-codificar-la-esperanza-principio-raiz]]
