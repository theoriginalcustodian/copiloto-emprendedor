---
name: precios-tokens-deepseek-openrouter
description: "Precios de referencia (OpenRouter, snapshot 2026-06-16) de los modelos DeepSeek V4 definidos para la vía de músculo pago. Para cálculos de costo."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 22f9be26-6dc0-477b-b7b3-0d6b7afc3ac6
---

Precios de los modelos chinos definidos para la **vía de músculo pago** (DeepSeek vía OpenRouter), snapshot **2026-06-16**. Ambos released Apr 24 2026, context **1M tokens**.

| Modelo | slug OpenRouter | Input $/1M | Output $/1M | Cached read $/1M | Notas |
|---|---|---|---|---|---|
| **DeepSeek V4 Flash** | `deepseek/deepseek-v4-flash` | **$0.09** | **$0.18** | $0.02 | 13B activated, alta throughput, fast inference (ej. provider Wafer ~30 tps, 0.79s latencia) |
| **DeepSeek V4 Pro** | `deepseek/deepseek-v4-pro` | **$0.435** | **$0.87** | — | MoE 1.6T total / 49B activated; reasoning + coding + long-context |

⚠️ **Snapshot — verificar en OpenRouter antes de presupuestar** (los precios cambian). Pro ≈ **4.8×** Flash.

**Fórmula de cálculo:** `costo_request ≈ (tok_in / 1e6) * precio_in + (tok_out / 1e6) * precio_out`. El *cached read* aplica al input repetido (prompt caching) — Flash $0.02/1M.

**Magnitud (request de coding típico ≈ 2k in + 1k out):**
- Flash → **$0.00036** por request (≈ **2.800 requests por USD**).
- Pro → **$0.00174** por request (≈ **575 requests por USD**).

**Contexto de cascade** (ver [[variante-deepseek-aditiva]] · [[macro-loop-diseno-candidato]]): Kaggle 14B = **$0** pero cuota rígida 30h/sem; DeepSeek = **elástico/pago** pero barato. Decisión del operador (2026-06-16): en fase de desarrollo, **velocidad > costo de tokens** → apoyarse en DeepSeek directo, dejar Kaggle para el grueso al escalar. A estos precios, "no me importa invertir en tokens" es defendible: miles de requests por dólar con Flash.
