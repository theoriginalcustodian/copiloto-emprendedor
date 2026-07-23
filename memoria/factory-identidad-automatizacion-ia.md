---
name: factory-identidad-automatizacion-ia
description: "Decisión de producto: la fábrica se posiciona como factory de AUTOMATIZACIÓN/AGENTES-IA durables (moat = orquestación durable Temporal), NO de apps frontend-pesadas; frontend = fino/secundario"
metadata: 
  node_type: memory
  type: project
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

**Decisión de producto (operador): la identidad de la fábrica es AUTOMATIZACIÓN + AGENTES-IA durables, NO apps de gestión frontend-pesadas.**

**El moat = la orquestación DURABLE (Temporal).** Es lo que un agente/automación necesita (conversaciones que duran días, reintentos, HITL, sobrevivir cortes) y es overkill para un CRUD (request/response + DB). Todo el acervo empuja ahí: patrones de orquestación · patrones IA-sobre-Temporal (ReAct/HITL/claim-check/multi-agente, skill `temporal-ai-patterns`) · músculo LLM + Graphity (memoria de agente) · canales WhatsApp/Telegram · backend multi-tenant hardened.

**El punto débil empírico = el frontend** (siempre básico o hecho a mano; una app de gestión tradicional es ~70% frontend = justo la debilidad).

**Fit de producto:** targets donde el valor está en el backend/automación/agente. **Un frontend BÁSICO de soporte (consola de staff) es LEGÍTIMO**; NO es anti-fit. Lo que SÍ es **anti-fit** es el producto **frontend-PESADO donde la UI/dashboard ES el producto** (maximiza la debilidad, desperdicia el moat). **El foco primario de TODOS los desarrollos = automatización + agentes IA.**

**Modelo operativo:** automación con **operadores humanos detrás** (HITL nativo) — la IA hace la primera línea, el humano supervisa/toma las excepciones. NO "sin humano".
