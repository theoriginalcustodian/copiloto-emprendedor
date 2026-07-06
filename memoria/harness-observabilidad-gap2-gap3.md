---
name: harness-observabilidad-gap2-gap3
description: Instrumentación del harness para medir falso-positivo de hooks (Gap3) + gate de cierre por evidencia en observabilidad (Gap2). Construido vía workflow ultracode.
metadata: 
  node_type: memory
  type: project
  originSessionId: 0666035b-9107-4ea7-8a8f-e93aafdec06e
---

Cierre de 2 de los 3 gaps del **análisis de solidez del harness** (2026-06-21): tras canonizar el ciclo de hooks (empirical_check/spike_first/root_cause/tech_debt), la pregunta honesta fue *¿estos hooks mejoran la precisión o son ruido?*. Tres gaps detectados: **Gap 3** (no medimos cuántas veces disparan en vano), **Gap 2** (el cinturón protege la ENTRADA = prompt del operador, no la SALIDA = el agente declarando "listo" sin evidencia), **Gap 1** (medimos disparo, no efecto causal — requiere A/B, queda como trabajo mayor separado).

**Qué se construyó (11 archivos en `~/.claude/hooks/`):**
- `lib/harness_log.mjs` — `appendEvent` fail-open + `deburr`; event-log `~/.claude/state/harness_events_<YYYY-MM>.jsonl` (override `HARNESS_LOG_DIR` para smokes). Eventos `suggester_fire` (Gap3) y `completion_claim` (Gap2).
- `lib/completion_detector.mjs` — detecta claims de completitud sin evidencia (markers acento-insensibles + exclusión de negaciones y "paso a estado RUNNING").
- `completion_evidence_gate.mjs` — **Stop hook, modo OBSERVABILIDAD** (NO bloquea, `exit 0` siempre, stdout vacío): lee el transcript, reconstruye el último turno, loguea si hay claim-sin-evidencia.
- `analyze_harness_events.mjs` — analizador standalone: cruza el event-log con los transcripts → tasa de pertinencia/FP por hook (proxy: turno-sin-acción = FP_alta_confianza). Mide **pertinencia del trigger, NO causalidad** (eso es Gap 1).
- Los **7 suggesters** (spike_first, tech_debt, empirical_check, root_cause, complexity_scoring, model_suggester, estimation_calibrator) instrumentados con `appendEvent` vía **import DINÁMICO** (clave: un import estático falla en link-time ANTES del try/catch → tumbaría el hook; el dinámico cae a no-op → fail-open real).

**Cómo se construyó:** Workflow **ultracode** (10 agentes, 1.1M tokens, ~28 min): 2 libs → 3 componentes ∥ → 4 verificadores adversariales opus → síntesis con fixes. Los verificadores cazaron **13 hallazgos**: 2 CRITICAL (import estático→dinámico, reproducido empíricamente), 1 HIGH (correlación del analizador: ventana ±90s → anclaje al turno), resto MEDIUM/LOW; todos fixeados, 2 LOW diferidos como **deuda gestionada** (appendEvent sin tope de tamaño — acotado por rotación mensual; falso-negativo de cobertura del detector — aceptado por diseño conservador en modo obs).

**Verificación (no me fié del self-report del workflow, 32/32):** verificación **independiente del orquestador 31/31 PASS** — sintaxis de los 11 archivos (no rompí producción), suggesters siguen emitiendo+logueando, fail-open estructural, Gap2 discrimina claim con/sin evidencia, analizador corre. Es la propia doctrina ([[no-codificar-la-esperanza-principio-raiz]]) aplicada al cierre: gate por evidencia que YO observo, no auto-revisión.

**Estado:** Gap 3 **ACTIVO** en cuanto los .mjs hot-reloadeen (los suggesters ya están cableados en `UserPromptSubmit`; solo se les agregó el log). Gap 2 construido + verificado + **cableado en `settings.json` (array `Stop`, 2º hook) el 2026-06-21** — el classifier de auto mode lo bloqueó primero (boundary "settings.json tiene secretos"); con autorización explícita del operador se aplicó (estilo `$HOME`, no el path absoluto que sugirió el synth), JSON + 3 secretos + sin-BOM validados con node. **Requiere restart para activar.** **FASE 2** (promover el Stop hook a gate `decision:"block"`) DIFERIDA por métrica (calibrar FP del detector con datos reales) + micro-spike de `stop_hook_active` anti-loop. Detalle en `HARNESS.md` §1.2/§1.5/§8. Relacionado: [[cero-deuda-no-gestionada]], [[trabajo-oportunista-esperas]].
