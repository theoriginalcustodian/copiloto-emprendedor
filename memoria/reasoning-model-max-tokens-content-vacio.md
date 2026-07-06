---
name: reasoning-model-max-tokens-content-vacio
description: deepseek-v4 (flash/pro) son reasoning models; max_tokens bajo → agotan el budget razonando y content sale vacío en units complejos
metadata: 
  node_type: memory
  type: reference
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**deepseek-v4-flash y deepseek-v4-pro (vía OpenRouter) son reasoning models.** Su salida = `message.reasoning` (CoT) + `message.content` (respuesta), y `max_tokens` capea la **SUMA**. En un unit COMPLEJO (prompt grande + tarea densa) el modelo agota el budget razonando y toca el límite **ANTES** de emitir `content` → `content=""` → código vacío → el micro-loop colapsa (los fix-steps salen vacíos, el código se destruye, no converge).

**Firma inequívoca** (en `usage`): `completion_tokens == el tope exacto` (1500 coder / 4000 reasoner) + `finish_reason=length` + `content=""` + `reasoning_tokens == el tope`. `_openrouter` (`deploy/worker/activities.py:37`) lee SOLO `message.content` → descarta el reasoning.

**Es LATENTE:** invisible en units chicos (el reasoning entra en budget); solo aparece en el 1er unit lo bastante denso (gap B: `router`). Por eso "la fábrica nunca había fallado tanto".

**Fix (aplicado 2026-07-01):** `OPENROUTER_MAX_TOKENS = {coder: 16000, reasoner: 16000}` (`deploy/worker/config.py`). El tope es un TECHO, no un piso: no sube el costo de units chicos (finish=stop corta solo); solo deja completar a los densos. Reasoning observado hasta ~12669 tokens (diagnose effort:high) → 16000 da margen. **NO desactivar reasoning** (`reasoning:{enabled:false}`): baja la calidad (spike: 1/5 vs 2/5); darle budget, no apagarlo.

**Regla de diagnóstico:** si un modelo devuelve `content=""` con `completion_tokens>0`, es reasoning-token exhaustion, NO un fallo del prompt. Evidencia: `spikes/deepseek-reasoning-maxtokens/` (spike.py + spike_loop.py + RESULT.md). [[precios-tokens-deepseek-openrouter]] [[no-pelear-con-la-fabrica-hand-fix-primero]]
