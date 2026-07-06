---
name: hermes-rol-observabilidad-reporte
description: "Decisión 2026-06-22: Hermes queda PERMANENTEMENTE como agente de observabilidad y reporte (revisa y reporta estado/avances, NUNCA toca nada) — ya no es director/intake/dispara"
metadata:
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**Decisión del operador (2026-06-22):** Hermes queda **PERMANENTEMENTE** como **agente de observabilidad y reporte, exclusivamente**. El operador lo consulta para conocer el **estado de los desarrollos y avances**; Hermes **revisa y reporta, NUNCA toca nada** (no encola, no dispara workflows, no decide, no coordina la operación, no es intake, no es director). Sigue containerizado (GPT-4o-mini vía OpenRouter) con su dashboard — cambia el ROL, no el deployment.

**Qué reemplaza:** el rol viejo (CLAUDE.md §1 "Director barato: intake, planifica, dispara workflows" · ADR-014 "Hermes orquesta barato"). La dirección/orquestación la lleva ahora el **operador** (+ Claude como arquitecto/gate) y **Temporal** (durabilidad). Hermes sale de la "cascade de costo" de generación.

**Impacto en SP8:** SP8 era "intake autónomo **de Hermes**". Con Hermes fuera del intake, **SP8 = intake autónomo con mecanismo a definir (NO Hermes)**, diferido (ver re-plan).

**Re-plan del roadmap (mismo día, ver `docs/ROADMAP.md`):**
- **🎯 Ahora (foco próximo, NO arrancado aún — "no comiences, solo readecuemos plan"):**
  1. **Hardening de seguridad auditado (B)** — test negativo de la frontera "el VPS no ejecuta IA" (hoy es control de diseño, no test) + el asterisco de `validate_real` (ejecuta IA en control-plane post-gate, deuda frontera A). Precondición de SP8.
  2. **Dogfooding / construir trabajo real (D)** — el operador construye desarrollos reales **refinando la generación del plano A MANO**. "Activar por métrica": el uso real revela el próximo cuello; el plano se pule manualmente ANTES de automatizarlo.
- **🗒️ Anotado (futuro):** SP8 (intake no-Hermes, post-hardening) · **autoría autónoma del plano (C)** — sale del aprendizaje de D, el operador quiere pulir el plano a mano primero · mejoras del retro M1-M5 (M1 = `deploy/sync-to-vps.sh` idempotente, cierra el drift repo↔VPS tipo [[propagar-cierre-a-docs-maestros]]) · boceto `/sync-docs`.

**Por qué importa:** el debate de SP8 reveló que "intake de Hermes" era la mitad fácil; el salto real es la **autoría del plano** (C), y el operador decidió pulir el plano **manualmente vía dogfooding** antes de automatizar. Hermes deja de ser pieza activa del lazo → el lazo lo cierran operador + Claude + Temporal + músculo. Aplicado a docs (CLAUDE.md/ARCHITECTURE/ROADMAP/README) el 2026-06-22. Relacionado: [[plataforma-agentica-estado]] · [[seniorworkflow-durable-sp7]].
