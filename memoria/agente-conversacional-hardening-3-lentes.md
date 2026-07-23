---
name: agente-conversacional-hardening-3-lentes
description: "Hardening de agentes conversacionales LLM — barrido adversarial de 3 lentes + 6 defensas determinísticas, cosechado al arquetipo"
metadata: 
  node_type: memory
  type: project
  originSessionId: 71f17f51-8d23-4cc1-8f4e-882a39f99ff8
---

**Método reusable — barrido adversarial de 3 lentes.** Caza lo que el gate con LLM scripted NO ve. Despachar 3 sub-agentes `Explore` read-only en paralelo, cada uno con un lente: (a) **veracidad/tono** (¿afirma lo que no sabe? ¿suena mecánico?), (b) **robustez ante el LLM** (¿qué mensaje corto/ambiguo lo rompe?), (c) **lógica de la máquina de estados** (dead-ends, contexto perdido, estado stale). Consolidar → dedup → fix en batch cerrado por **tests deterministas**. Probar en vivo de a un bug NO converge; invertirlo (barrido completo → batch) sí.

**Principio raíz:** el output del LLM es NO confiable, sea cual sea el modelo. Un modelo mejor baja la FRECUENCIA, no elimina la CLASE de bug. Las 6 defensas son ESTRUCTURALES (viven en el dispatcher, sobreviven al cambio de modelo): confirmación sí/no EXPLÍCITA + reset de estado stale · texto hardcodeado en momentos críticos (nunca el `reply_es` del LLM) · keyword por palabra completa (`\bsi\b`, no substring) · validar entities contra la closed-list antes de pisar un valor bueno · vocabulario OPERATIVO ("no me queda lugar") no INSTITUCIONAL ("no atendemos") · persistir el contexto blando como estado de 1er orden.

**Cosechado al arquetipo** `conversational_agent` (README + `domain_stub.py`) — todo agente conversacional nuevo nace endurecido.

[[factory-identidad-automatizacion-ia]]
