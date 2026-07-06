---
name: agente-conversacional-hardening-3-lentes
description: "Hardening de agentes conversacionales LLM — barrido adversarial de 3 lentes + 6 defensas determinísticas, cosechado al arquetipo"
metadata: 
  node_type: memory
  type: project
  originSessionId: 71f17f51-8d23-4cc1-8f4e-882a39f99ff8
---

Agente de agenda de clínica (`clinic-management`, Telegram durable sobre Temporal) — **Fase 1 COMPLETA, mergeada a main (#5, 2026-06-29)**: gate de identidad (botón ¿sos paciente? → DNI o alta de 4 datos, captura determinística) + disponibilidad humanizada (franjas + listas clickeables + preguntar la hora) + **hardening adversarial** (47 hallazgos → 12 fixes de raíz). **51 unit + E2E verdes en el VPS.**

**Método reusable — barrido adversarial de 3 lentes.** Caza lo que el gate con LLM scripted NO ve (no ejercita el modelo real ni la redacción). Despachar 3 sub-agentes `Explore` read-only en paralelo, cada uno con un lente: (a) **veracidad/tono** (¿afirma lo que no sabe? ¿suena mecánico?), (b) **robustez ante el LLM** (¿qué mensaje corto/ambiguo lo rompe?), (c) **lógica de la máquina de estados** (dead-ends, contexto perdido, estado stale). Consolidar → dedup → fix en batch cerrado por **tests deterministas**. Clave de proceso (lección del operador, 2026-06-29): probar en vivo de a un bug NO converge — invertirlo (barrido completo → batch) sí.

**Principio raíz:** el output del LLM es NO confiable, sea Flash, GPT-4o-mini o cualquiera. Un modelo mejor baja la FRECUENCIA, no elimina la CLASE de bug. Las 6 defensas son ESTRUCTURALES (viven en el dispatcher, sobreviven al cambio de modelo): confirmación sí/no EXPLÍCITA + reset de estado stale (nunca agendar "por las dudas") · texto hardcodeado en momentos críticos (emergencia, nunca el `reply_es` del LLM) · keyword por palabra completa (`\bsi\b`, no substring — `"si" in "si tenés"` confirma sin querer) · validar entities contra la closed-list antes de pisar un valor bueno · vocabulario OPERATIVO ("no me queda lugar") no INSTITUCIONAL ("no atendemos" — afirma una política que no conocés) · persistir el contexto blando (franja) como estado de 1er orden.

**Cosechado al arquetipo** `deploy/skeleton_kit/archetypes/conversational_agent` (unreal-copilot #92): README §"El output del LLM es NO CONFIABLE" + `domain_stub.py` con las defensas como guía. Todo agente conversacional nuevo nace endurecido.

**Stack LLM:** NO usa SDK de OpenAI — `clients/agent/providers/llm.py` pega con `urllib` (stdlib) al endpoint OpenAI-compatible de OpenRouter. Primary DeepSeek V4 Flash + Pro como failover OPERATIVO (solo ante caída de API, no cognitivo). Cambiar de modelo = 1 línea (`DEFAULT_PRIMARY`), sin tocar código. Fase 2 pendiente: voz (Groq/Voxtral) · WhatsApp · reschedule real. [[clinica-medica-2do-sistema-compuesto]] [[factory-identidad-automatizacion-ia]] [[r1-workflow-templates-fixed-mount]]
