---
name: flujo-c-economia-baseline
description: "Baseline MEDIDO de la economía del flujo C → SeniorWorkflow — costo/velocidad de generar+validar+mergear una app real de 4 plataformas (E2E trial-tracker, 2026-06-22)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**Medido el 2026-06-22** sobre el E2E `senior-feat-trial-tracker-skel` (app SaaS multi-tenant real, 4 plataformas, generada por el asistente [[asistente-generar-plano]] desde solo el negocio). Telemetría extraída de las historias de Temporal (script `perf_audit`).

## Números headline
- **Wall-clock total: 263.6 s (~4.4 min)** — de "solo el negocio" a app mergeada en `main`. Cómputo ~252.8 s · **humano (clic de merge) ~11 s**.
- **Costo out-of-pocket (DeepSeek): $0.0139** la app completa.
- **Costo Claude (4 jueces gate senior, haiku): ~$0.238 SOMBRA → $0 marginal bajo Max.** NO entra en `claude_equiv_usd` (el `_agg` excluye `role='judge'`) → `claude_equiv` reportado = $0 SUBESTIMA el costo-API real; el verdadero techo-API ≈ $0.252.
- **Claude plan+scaffold: $0** — el flujo C los REEMPLAZA (el esqueleto ES el plano). En el flujo default eso medía ~$0.90 sombra ([[casa-fabrica-features-diseno]] SP6). **Esa es la palanca económica del flujo C.**
- **0 escalaciones · 0 heal (`heal_turns=0`, validate pasó a la primera) · 0 held-out fails.**

## Dónde se va el tiempo (build = 232.7 s)
- `read_skeleton`/`checkout` ~0.7 s (instantáneo: lee el esqueleto del operador, sin Claude).
- **FILL ∥ (4 unidades, todas flash, EN PARALELO):** simples `account_store`/`graphity`/`app` = 21.9/12.6/13.2 s **iter-0**; complejo `trial_workflow` (durable + señales cancel/extend) = **173.7 s, iter-2 = EL CUELLO** (75% del wall-clock, 91% del costo DeepSeek — $0.0126/$0.0139).
- **Jueces (gate senior, haiku, secuencial-ish): ~117 s = 50% del build.** `integrate` 7.1 s · `open_pr` 3.4 s.
- Post-gate: `validate_real` 14.2 s (compute puro, $0) · `merge_pr` 5.7 s.

## Insight (hipótesis del operador, CONFIRMADA): "buen plano → fluye"
Un plano fiel (flujo C) ⇒ (1) el músculo más barato (flash) llena todo **sin escalar**, (2) `validate_real` pasa sin heal, (3) $0 de Claude plan/scaffold. **La varianza la manda la COMPLEJIDAD de la unidad, no la cantidad:** las 3 simples volaron (~15 s, ~$0.0004, iter-0 ∥); la durable-con-señales fue 12× en tiempo + costo. El fan-out funcionó (3 en <22 s ∥); lo caro de generar es la durabilidad/señales.

## Levers que la medición revela
1. **Descomponer el plano** para que flash llene iter-0; aislar la complejidad (workflows con señales) en pocas unidades.
2. **Jueces secuenciales = 50% del build** → paralelizarlos bajaría el build ~½.
3. El cuello es **1 unidad**, no el número → el costo real está en generar durabilidad/señales, no en la cantidad de capas.

⚠️ n=1. Para validar el patrón cross-app: auditoría comparativa vs exprkit/unitkit/uc-stack-real (reportes en `docs/Implementaciones terminadas/`). Reporte completo: `docs/Implementaciones terminadas/2026-06-22-asistente-generar-plano-e2e-trial-tracker_reporte.md`.
