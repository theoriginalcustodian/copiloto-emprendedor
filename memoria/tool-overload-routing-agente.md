---
name: tool-overload-routing-agente
description: "Decisión de diseño — cómo manejar MUCHOS toolkits Composio en un agente conversacional sin degradar la selección de tools. Orden de defensas: policy mínima → gating por intención → RAG → sub-agentes (último). LEER al diseñar el ruteo de tools del Copiloto o cualquier agente multi-servicio."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2b115214-e840-48e4-b8bb-bb4f7875052a
---

**Preocupación validada por SOTA (2026):** cargar muchos toolkits Composio (Gmail 61t, HubSpot 244t, Drive 77t, Docs 41t…) en el contexto de UN agente **degrada la selección de tool**, no solo infla tokens. Números duros: precisión 78% con 10 tools → **13.6% con 100+** (−82%); degradación en serio pasadas **~20-30 tools**; catastrófica a 100+. **Anthropic recomienda Tool Search a partir de 30 tools** (58 tools ≈ 55k tokens solo en definiciones). El umbral exacto depende del modelo (gpt-4o-mini se degrada ANTES que uno grande).

**Encuadre corregido (el operador razonaba desde costo; el driver es OTRO):** el costo del LLM es marginal (tokens de modelo chico = centavos, como Composio) → **NO diseñar la arquitectura de agentes para ahorrar LLM**. El problema real que justifica separar por servicio es **precisión de selección + tamaño de contexto**, NO plata. Y el costo que la jerarquía multi-agente *agrega* es **latencia (una llamada LLM por hop, crítico en tiempo real) + orquestación + debug**, no tokens.

**Orden de defensas DECIDIDO (de liviano→pesado; aplicar 1→2→medir→4 solo si hace falta):**
1. **Policy mínima por servicio** (ya decidido en [[composio-gateway-ladrillo]]): 3-5 slugs por toolkit, NO exponer los 244 de HubSpot. Baja de ~400 tools → **~30**. Base no-negociable.
2. **Progressive/gating por intención ("router pattern")**: un router liviano detecta el toolkit del turno → carga solo esas tools. **UN SOLO agente**, sin latencia multi-agente. Baja ~30 → ~5-10 por turno (reduce tokens 85-98% en el SOTA). `ComposioGateway.allowed_tools(toolkit, mode)` YA es la mitad del mecanismo. **Esto es lo que se construye primero.**
3. **Tool RAG** (retrieval semántico top-k): solo si el universo de tools crece a cientos. Composio tiene Tool Search nativo.
4. **Sub-agentes jerárquicos (child workflows Temporal)**: **último recurso, y NO para reducir contexto** — solo cuando un servicio necesita lógica de dominio propia o procesos durables largos.

**Dos insights que desarman la jerarquía como bala de plata:**
- **Con solo la policy mínima ya estás en zona buena:** 8 servicios × ~4 slugs = **~32 tools** = justo el umbral "usá tool search", NO zona catastrófica. El miedo de "400 tools en contexto" NO se materializa si aplicás la policy mínima ya adoptada.
- **La idea de jerarquía del operador ES el "router pattern" del SOTA** — pero la versión liviana lo hace DENTRO de un agente, sin spawnear un agente completo por servicio. Los sub-agentes reales solo agregan **aislamiento de proceso + durabilidad**, NO reducen más el contexto del turno. Y **no salvan si un servicio ya tiene muchas tools** (el sub-agente de HubSpot con 244 sufre el mismo overload) → la policy mínima es no-negociable IGUAL, con o sin jerarquía.

**Próximo paso empírico (spike-first, NO codificar la esperanza):** antes de comprometer routing, medir en el stack real. El walking skeleton #97 ya ejecuta Composio real → cargar policies mínimas de 4-5 servicios, contar tools en contexto y probar selección con prompts ambiguos. Ese número (para el modelo elegido) decide si policy mínima sola alcanza (~30 → quizá sí) o si hace falta gating. El SOTA da la guía; el umbral propio lo da la medición.

**VERIFICADO 2026-07-02 (reframe para ESTE agente):** el Copiloto **NO usa function-calling** — `LlmProvider._call_openrouter` manda `{model, messages, max_tokens}` **sin `tools=[]`**; el LLM devuelve JSON `{action, entities}` guiado por el system prompt. Por eso el tool-overload del SOTA (tool-defs en contexto, 55k tokens) **NO aplica**: agregar un servicio pesa solo su `PROMPT_FRAGMENT` (~70 tokens). El orden de defensas colapsa a **"policy mínima + prompt claro"**; NO se construyó gating por tool-defs (no corresponde). **Medición real (la QA que reemplaza al gating): gpt-4o-mini 8/8 = 100%** en selección `{service, op}` con 7 servicios. RAG/sub-agentes tampoco hacen falta para escalar servicios (no hay tool-defs). Detalle → [[copiloto-servicios-composio-plugin]].

Relacionado: [[composio-gateway-ladrillo]] · [[copiloto-emprendedor-roadmap]] · [[no-codificar-la-esperanza-principio-raiz]] · patrones IA-sobre-Temporal (child-workflow multi-agente) → skill `temporal-ai-patterns`.
