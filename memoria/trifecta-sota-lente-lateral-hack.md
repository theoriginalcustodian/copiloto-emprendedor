---
name: trifecta-sota-lente-lateral-hack
description: "La trifecta cognitiva — STATE_OF_THE_ART se lee con 2 lentes (canónico + lateral/hack), no solo soluciones probadas"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 33b57920-332f-43d9-826d-b3efb1165b67
---

Decisión metodológica (2026-06-30): el `STATE_OF_THE_ART` de la **trifecta cognitiva** (CLAUDE.md global) se lee con **dos lentes**, no uno:
- **(a) canónico** — soluciones probadas (docs oficiales, RFCs, papers, repos canónicos).
- **(b) lateral / hack** — el atajo más ingenioso documentado que *colapsa* el problema en vez de atacarlo de frente (el "C" que invalida el dilema, workaround de costo asimétrico, truco de comunidad/post-mortem que un repo canónico no lista; ej: falta dataset de training → generarlo sintético con LLM+TTS+ruido).

**Forma elegida: sub-lente DENTRO de SOTA, NO 4º pilar** — sigue siendo "trifecta" (no "tétrada"/"cuatrifecta"). Razón estructural: la trifecta es **2 lentes de inteligencia (SOTA + FAILURE_MAP) + 1 sintetizador (DECISION_MATRIX)**, no 3 pares simétricos; el hack es un input hermano de SOTA, no un 4º par de la matriz (por eso "cuatrifecta" era conceptualmente off). Preserva la marca "trifecta" en ~10 archivos del harness y evita drift. La `DECISION_MATRIX` ahora ata `SOTA(canónico Y lateral) × FAILURE_MAP`.

**Why:** el lente canónico sesga conservador a propósito (busca lo probado) → un hack colgado como sub-bullet se vuelve checkbox muerto, justo el failure mode "framework como sello, no filtro". El lente (b) es la *creatividad lateral del estado del arte* (§Protocolo de decisión → "Antes de escalar — agotar la creatividad lateral") traída a la fase de DISEÑO: cazás el hack al diseñar, no recién cuando estás por escalar.

**How to apply:** al hacer la trifecta de un sistema/feature no trivial, buscar los dos lentes por separado — el conservador no encuentra el hack solo. Propagado al pipeline físico de `train-b2b-domain`: el prompt del Synthesizer (`skills/train-b2b-domain/assets/prompt-synthesizer-sonnet.md`) ahora tiene Query 4 (lente lateral) + sección "Atajos / Hacks Asimétricos" en el `STATE_OF_THE_ART.md` generado — sin crear 4º archivo. Si no hay hack documentado → marcar `[ASSUMED_NO_SOURCE]`, nunca inventar.

Relacionado: [[asistente-generar-plano]] (usa la trifecta como paso 2.5 gateado), [[costo-incertidumbre-precision-ratchet]], [[no-codificar-la-esperanza-principio-raiz]].
