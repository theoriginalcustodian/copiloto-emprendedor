---
name: copiloto-automatizaciones-recurrentes-candidato
description: "Candidato de roadmap post-v1 del Copiloto: automatizaciones/tareas recurrentes durables (ej. N posts IG semanales) con HITL por ocurrencia. LEER al planear el roadmap post-v1 del cliente."
metadata: 
  node_type: memory
  type: project
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**Candidato de roadmap POST-v1 (no entra en el cliente web v1): "Automatizaciones / tareas recurrentes durables".** El usuario le pide al agente programar tareas que corren solas de forma durable (ej. "publicá 3 posts semanales en IG", resúmenes/recordatorios/cobros recurrentes), **siempre con HITL antes de cada acción de escritura**. Encaje estratégico ALTO: es la expresión más directa del moat (Temporal durable) y de la propuesta de valor (quitar tareas repetitivas). Generaliza más allá de IG → capacidad genérica de automatizaciones.

**Why:** mueve el producto de "hace algo cuando le pedís" a "te corre lo repetitivo solo" — diferencial mayor que el chat mismo, y la infra ya existe (nada nuevo que inventar).

**How to apply:** approach = **Temporal Schedule / loop durable `continue_as_new`** (molde vivo en `mp_refresh_workflow.py` + arquetipo `recurring_charge`); cada ocurrencia: redacta borrador → HITL por signal (ya en `ConversationWorkflow`) → publica (Composio) solo si aprueba. **Scheduler = Temporal, NO Google Calendar.** Antes de comprometerlo, resolver **2 cosas (no es la infra):** (1) política de aprobación en el schedule (ventana + qué pasa si no aprueba: saltear/retener/recordar); (2) **canal de aviso** (push/email/WhatsApp) — sin él queda ciego en v1 web-polling (mismo hueco day-2 del análisis UX). UI = módulo nuevo "Automatizaciones" (lista + pendientes de aprobar), se crean por chat, reusa la tarjeta HITL. Spike previo: Schedule/loop + HITL-con-timeout + confiabilidad de Composio IG publish. Doc: `docs/copiloto-emprendedor/2026-07-03-candidato-roadmap-automatizaciones-recurrentes.md`.

[[copiloto-emprendedor-roadmap]] [[factory-identidad-automatizacion-ia]] [[copiloto-servicios-composio-plugin]] [[copiloto-deploy-multitenant-vivo]]
