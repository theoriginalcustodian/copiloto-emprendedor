---
name: cero-deuda-no-gestionada
description: "El principio no-negociable es \"cero deuda NO-GESTIONADA\" (no cero deuda literal) — la cara tardía del mismo combate contra la composición que libra spike-first"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0666035b-9107-4ea7-8a8f-e93aafdec06e
---

El operador canonizó (2026-06-21, decisión explícita) el principio de desarrollo sólido como **"cero deuda NO-GESTIONADA"**, NO "cero deuda" literal. Está en la regla de oro #7 + criterio duro #3 del CLAUDE.md global; esta sesión le agregó el *por qué* y el reframe. El enemigo **no es la deuda** —la deuda **deliberada y prudente** (atajo consciente, registrado, con plan de pago) a menudo es óptima: acelera— sino la deuda **invisible** (nadie la registró → el próximo agente la redescubre y paga el interés sin saberlo) y la **impaga** (registrada, nunca saldada).

**Why:** la deuda devenga **interés compuesto** — un atajo no pagado no cuesta lo que costó tomarlo, sino eso más el costo de rodearlo en cada cambio futuro, y como un cimiento frágil encarece todo lo que se apoya encima. Es la cara **tardía** del mismo combate contra la composición que [[spike-first-central-proyecto]] libra en la **temprana** (uno impide que un supuesto no-validado componga antes de construir; el otro, que un atajo no-pagado componga después). El puente: *characterization-tests-antes-de-refactorizar ES spike-first aplicado al pago de deuda*. **Agravante propio de esta fábrica:** Unreal Copilot es un sistema ML/agéntico **autónomo y recursivo** → además de la deuda de código tiene las clases de deuda oculta de ML (glue code, configuration debt, pipeline jungles, feedback loops — *Hidden Technical Debt in ML Systems*, Sculley et al., NeurIPS 2015), y un cimiento endeudado se replica a escala **sin un humano por paso**. Perseguir cero-deuda en sentido absoluto degenera en gold-plating/parálisis (prohibido por "sin sobreingeniería"); lo no-negociable es que ninguna deuda sea invisible o impaga.

**How to apply:**
1. **Visible o no existe** — toda deuda deliberada se registra: TODO marker en código **+** entrada en la memoria del proyecto **+ propietario + fecha/condición de pago**.
2. **Priorizar por hotspot** (complejidad × frecuencia-de-cambio): la mayoría de la deuda no importa — solo la del código que cambia seguido. Código frío → registrar y diferir (pulirlo = gold-plating). Código caliente → pagar pronto (el interés compone).
3. **Arquitectónica** (boundary/contrato) → escalar MAYOR; pagar con strangler-fig incremental, **nunca** big-rewrite.
4. **Código del músculo** (DeepSeek/Kaggle) → el gate de tests reales es el cobrador automático; vigilar glue/config/pipeline debt.

**Reforzado en el harness (2026-06-21, esta sesión):** 3 capas — doctrina (CLAUDE.md global, principio enriquecido) · memoria (este fact) · hook NUEVO `tech_debt_suggester.mjs` + `tech_debt_triggers.json` (8 patrones hot-reload) que dispara por señales de atajo ("TODO", "por ahora", "hardcode", "workaround", "después lo arreglo", "deuda técnica") y recuerda gestionarla. Smoke antes de cablear. Detalle técnico en `~/.claude/HARNESS.md` §1.2/§8 — la memoria NO duplica (regla §6 del HARNESS). Mismo patrón que [[spike-first-central-proyecto]] (señal propia, ortogonal a la complejidad). Requiere restart de sesión.

Relacionado: [[spike-first-central-proyecto]] (el principio hermano, cara temprana).
