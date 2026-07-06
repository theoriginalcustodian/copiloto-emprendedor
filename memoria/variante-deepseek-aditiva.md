---
name: variante-deepseek-aditiva
description: "La variante DeepSeek/OpenRouter es ADITIVA (no reemplaza Kaggle); ambas vías de músculo coexisten + dual-generation opcional. Corrige la lectura \"reemplazo\" que induce el HANDOFF_2026-06-16.md."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4c4b8d37-d7a4-419e-bcc6-78d05c3f603c
---

El `HANDOFF_2026-06-16.md` (handoff de diseño de Claude Desktop, en la raíz del repo) describe la migración a **DeepSeek V4 vía OpenRouter** como **REEMPLAZO** de Kaggle ("$0 muere", "se retira el patrón worker/túnel SSH de Kaggle", invariante físico reescrito). **La decisión real, confirmada por el operador el 2026-06-16, es ADITIVA, no reemplazo:**

- **Ambas vías de músculo COEXISTEN:** vía soberana Kaggle/Ollama ($0) + vía DeepSeek/OpenRouter (pago barato, sin la ventana de 6h). Modo de operación = **"ambas capacidades"**: selección por tarea (default) + **dual-generation best-of-2** cuando convenga comparar motores sobre la misma tarea.
- **Diseño correcto = boundary "muscle provider" pluggable** con 2 implementaciones detrás del mismo contrato, NO dos pipelines duplicados (A-1). Temporal hace el fan-out de dual-generation casi gratis vía activities paralelas.
- **El invariante físico "el VPS nunca ejecuta código de IA" SIGUE VIGENTE para la vía Kaggle.** La "separación lógica control-plane/ejecución" del handoff aplica SOLO a la vía DeepSeek. Los invariantes se **bifurcan por vía**; CLAUDE.md debe documentar ambos modos, no derogar el físico.
- Los "4 deltas a CLAUDE.md" del handoff pasan de **reemplazos a ADICIONES** (no borrar la sección Kaggle; agregar la vía DeepSeek al lado).

**Decisión de diseño CERRADA (ADR-016, 2026-06-17):** en la vía DeepSeek el código generado se ejecuta/testea en un **worker en el VPS + sandbox Docker efímero hardened** (`--network none --read-only --tmpfs --user 65534 --cap-drop ALL --security-opt no-new-privileges`), NO reusando el sandbox Kaggle. El proceso del worker (confiable) nunca ejecuta el código de IA — lo delega al contenedor aislado (sin red/key/socket). Invariante **lógico** para la vía DeepSeek; el **físico** ("VPS nunca ejecuta IA") sigue intacto para Kaggle. ✅ **Implementado y validado E2E** (loop mínimo, `COMPLETED passed:true iters:1`) → [[loop-deepseek-operativo]].

**Arquitectura de inferencia DEFINIDA (2026-06-16):**
- **LLM = activity generadora PURA, SIN tool calling.** Los DeepSeek reciben un prompt con el contexto ya cocinado y devuelven código; NO orquestan ni deciden herramientas — **Temporal orquesta los pasos**. = ejecutor stateless. Consecuencia: elimina el gotcha `reasoning_content`→400 (solo aplica con tool calls). Guía: `docs/research/2026-06-16-deepseek-v4-guia-uso.md`.
- **Contexto desde Graphity** (grafo de memoria propio): la parte fija la trae un **activity CONFIABLE** vía HTTP a Graphity (HTTP en activity, no en workflow — determinismo). Estructura `[SYSTEM fijo][NÚCLEO-Graphity cacheable][RETRIEVAL-Graphity por tarea, localizado][TASK]` — cache-friendly + "dale el plano" ([[localizacion-estructurada-feedback-agentes]]).
- **Frontera:** el activity confiable (VPS) arma el contexto ANTES de invocar al LLM; el LLM genera; el código se ejecuta en sandbox aislado (ADR-015). **El código no confiable NUNCA toca Graphity ni el VPS.**
- **Config:** thinking mode ignora temperature/top_p/penalties; non-think `T=1.0/top_p=1.0`. Con caching activo el costo dominante pasa al OUTPUT → prompts que exijan salida mínima. Sprint ejecutado E2E → ver [[loop-deepseek-operativo]].

Lo demás del handoff (camino crítico F6 = durabilidad cross-corte primero, loop de dos niveles, Opus headless, Graphity post-F6, rotar secretos) sigue válido. Ver [[plataforma-agentica-estado]] y [[kaggle-temporal-overlay-spike]].
