---
name: copiloto-economia-cogs
description: Economía/COGS del Copiloto — Composio + LLM son MARGINALES (~$1-12/usuario/mes). LLM = ~95% del costo variable; Composio ruido. Sin soporte humano por-cliente (agéntico). LEER antes de fijar tiers/pricing del Copiloto o cualquier app agente+Composio.
metadata: 
  node_type: memory
  type: project
  originSessionId: 2b115214-e840-48e4-b8bb-bb4f7875052a
---

**COGS del Copiloto del Emprendedor — Composio + LLM son costo MARGINAL.** Doc completo (pricing verificado, modelo de tokens, tabla por tier, fuentes): `docs/copiloto-emprendedor/2026-07-01-copiloto-economia-cogs-composio-llm.md`. Números por `[SUPUESTO]` razonado → calibrar contra el spike #97 antes de pricing público.

**Números clave (con DeepSeek V4 Flash, cache activo):**
- COGS Composio+LLM = **~$1.2 (Básico) / ~$4 (Pro) / ~$12 (Business) por usuario/mes.** Con gpt-4o-mini ~2.5× el LLM (~$3/$10/$28).
- **Entre Composio y LLM: el LLM es ~95% del costo variable.** Composio ~$0.0002/interacción vs LLM ~$0.0045 (~20×). Optimizar Composio es irrelevante; la palanca es el LLM.
- Margen bruto **90%+** en esta capa contra cualquier pricing razonable.

**Pricing verificado (jul-2026):** DeepSeek V4 Flash $0.14/$0.28 por 1M, **cache $0.003 (98% off, automático)** · gpt-4o-mini $0.15/$0.60, cache $0.075 (50%) · Composio: unidad = **ejecución** (discovery/auth NO cuentan); bundled ~$0.115/1K (plan $229/2M); nuestros 8 toolkits = estándar 1× (no premium 3×).

**Por qué el LLM domina y qué lo controla (más importante que "qué modelo"):** en un agente ReAct, cada interacción = ~2-3 llamadas LLM, y en cada una se reenvían ~30k tokens de **definiciones de tools**. Eso domina el costo, no el mensaje del usuario. Dos palancas: **(1) prompt caching** (obligatorio; sin él ×2-3; DeepSeek automático) + **(2) tool gating** (baja el prefijo 30k→8k, ~4×). El gating paga doble: precisión + costo → refuerza [[tool-overload-routing-agente]].

**Modelo de soporte SIN humano por-cliente (operador 2026-07-01):** soporte técnico = agentes (chat) + autohealing; humanos = solo casos extremos, infra de la agencia (fija, no escala por-cliente). El costo no es $0 → trasladado a LLM (soporte + heal loops) = **~centavos-$1/usuario extra**, marginal. **PERO ⚠️ supuesto de capacidad NO probado:** el autoheal de BUILD ✅ y la recuperación runtime transitoria (Temporal) ✅ existen, pero **soporte agéntico + autoheal de bugs de LÓGICA en runtime = diseño, no construido/probado**. La frase "acotamos los errores y los resuelven agentes autónomos" es hipótesis → exige test adversarial antes de asumir "$0 soporte" en la proyección.

**Reencuadre de riesgo:** con humano-mínimo, el eje a vigilar deja de ser el COGS (marginal) y pasa a ser la **confiabilidad del soporte/healing agéntico** — un fallo ahí es churn/reputación, no una línea de dólares.

**Pendientes (spike-first):** medir turno E2E vs #97 (tokens reales, mata dos pájaros con el umbral de tool overload) · probar adversarialmente el soporte/autoheal runtime · verificar hard-cap Composio o imponer tope duro propio (contador executes en `uc_factory`, gateway fail-closed).

**Decisiones de estructura (del análisis previo de la sesión, ya en la cabeza del operador, no re-litigar):** metering Composio por tenant + cupo por tier en **unidades de negocio** (no "tool calls") + BI proactivo FUERA del cupo del cliente (lo controla la plataforma por frecuencia de plan). El cupo es palanca comercial/guardrail, no recuperación de costo (Composio es centavos). LLM lo ponemos nosotros (headless de cuentas de consumidor = descartado por ToS/custodia/ban; BYOK por API key = opción avanzada reversible vía `LlmProvider`). DeepSeek chino → residencia de datos: rutear por OpenRouter provider occidental o gpt-4o-mini por-tenant. [[copiloto-emprendedor-roadmap]] [[composio-gateway-ladrillo]] [[factory-identidad-automatizacion-ia]]
