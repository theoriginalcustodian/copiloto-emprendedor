---
name: factory-identidad-automatizacion-ia
description: "Decisión de producto: la fábrica se posiciona como factory de AUTOMATIZACIÓN/AGENTES-IA durables (moat = orquestación durable Temporal), NO de apps frontend-pesadas; frontend = fino/secundario"
metadata: 
  node_type: memory
  type: project
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

**Decisión de producto (operador, 2026-06-25): la identidad de la fábrica es AUTOMATIZACIÓN + AGENTES-IA durables, NO apps de gestión frontend-pesadas.**

**El moat = la orquestación DURABLE (Temporal).** Es lo que un agente/automación necesita (conversaciones que duran días, reintentos, HITL, sobrevivir cortes) y es overkill para un CRUD (que solo necesita request/response + DB). Todo el acervo de la fábrica empuja ahí: los 7 arquetipos Temporal son patrones de orquestación (no de UI) · patrones IA-sobre-Temporal (ReAct/HITL/claim-check/multi-agente, skill `temporal-ai-patterns`) · músculo LLM + Graphity (memoria de agente) · canales WhatsApp (Evolution/Baileys) + Telegram · backend multi-tenant hardened.

**El punto débil empírico = el frontend.** El frontend de la clínica lo hizo A MANO la sesión paralela (Next.js standalone) porque la fábrica no genera frontends ricos (units "básicos": data-testid + gate Chromium). Billing/clínica/biblioteca: todos los wins fueron backend-pesados; los frontends siempre fueron básicos o a mano. Una app de gestión tradicional es ~70% frontend = justo la debilidad.

**Fit de producto:** targets donde el valor está en el backend/automación/agente — agentes conversacionales, automatizaciones, integraciones, pipelines IA. **Un frontend BÁSICO de gestión (turnos/médicos/alta de pacientes) para el staff es un componente LEGÍTIMO y útil** (la consola que ya tenemos sirve); NO es anti-fit. Lo que SÍ es **anti-fit** es el producto **frontend-PESADO donde la UI/dashboard ES el producto** (maximiza la debilidad, desperdicia el moat). La distinción: frontend básico de soporte = ✅ bienvenido pero **secundario**; frontend-como-producto = ❌. **El foco primario de TODOS los desarrollos = automatización + agentes IA** (confirmado/refinado por el operador 2026-06-25).

**Modelo operativo:** automación con **operadores humanos detrás** (HITL nativo del proyecto) — la IA hace la primera línea, el humano supervisa/toma las excepciones. NO "sin humano" (eso fue una sobre-deducción, corregida por el operador).

**Reencaje de la clínica:** deja de ser "app de gestión con automatización" → es **"agente de agenda durable (turnos/recordatorios por WhatsApp/Telegram/mail) con consola de supervisión"**. Prioridad: **agenda/turnos > recordatorios-con-confirmación > cobro**; inventario parqueado. Frente siguiente = motor de disponibilidad + agente conversacional + canal inbound (spike Telegram). [[clinica-hardening-3-frentes]] [[frontend-clinic-plantilla-base]] [[loop-engineering-framing]]
