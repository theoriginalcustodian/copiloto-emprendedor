# Candidato de roadmap — Automatizaciones / tareas recurrentes durables

> **Estado:** candidato **post-v1** (NO entra en el cliente web v1 que se está construyendo). Registrado 2026-07-03.
> **Origen:** idea del operador. **Encaje estratégico: alto** — es la expresión más directa del moat (orquestación durable Temporal) y de la propuesta de valor ("quitarle tareas repetitivas al emprendedor").

## La idea

El usuario le pide al agente **programar tareas recurrentes** que se ejecutan solas de forma durable — ej. "publicá 3 posts semanales en Instagram", "mandame un resumen los lunes", "recordá cobrar la cuota el 1° de cada mes" — **siempre con HITL antes de cualquier acción de escritura/publicación**.

Generaliza más allá de Instagram: es una capacidad genérica de **automatizaciones programadas** (social, mail, cobros, follow-ups, recordatorios). Mueve el producto de "asistente que hace algo cuando le pedís" a "asistente que te corre lo repetitivo solo".

## Approach técnico (grounded en la infra que YA existe)

Ensamblar piezas probadas, cero tecnología nueva:
- **Scheduler = Temporal** (Schedules nativos o loop durable `continue_as_new`, molde ya vivo en `mp_refresh_workflow.py` + arquetipo `recurring_charge`). **NO Google Calendar** — Calendar es para los eventos del usuario; opcionalmente se puede *reflejar* ahí "el martes sale un post", pero no es el motor.
- **En cada ocurrencia:** activity redacta el borrador → **HITL por signal** (ya existe en `ConversationWorkflow`) espera aprobación → activity de publicación (Composio Instagram, etc.) **solo si el usuario aprueba**.

## Los 2 problemas a resolver ANTES de comprometerlo (no es la infra)

1. **Política de aprobación en un schedule.** Automatizar es "set & forget", pero cada ocurrencia pide OK. Definir: ventana de aprobación + qué pasa si no aprueba a tiempo (**saltear / retener / recordar**). Sin esto, la automatización se vuelve un nag.
2. **Canal de aviso (el cuello real).** La durabilidad garantiza que la tarea **espera** sin perderse, pero el usuario **no se entera** de que hay algo por aprobar si la v1 es web-polling sin push/WhatsApp/email. Para que brille necesita un **canal de notificación**. Mismo hueco que marcó el análisis UX (day-2 hook).

## Dónde viviría en la UI

**Módulo nuevo** en el rail — "Automatizaciones" / "Tareas programadas": lista de tareas (qué · cadencia · próxima corrida · estado · **pendientes de aprobar**). Se crean **por chat** ("publicá los martes y jueves" → el agente propone el schedule → confirmás). Las aprobaciones reusan la **tarjeta HITL** ya diseñada. Encaja como slot modular futuro (patrón "próximamente").

## Riesgos

- **Instagram publish es irreversible** (borrado manual desde IG); la recurrencia amplifica la exposición → el HITL + preview WYSIWYG por ocurrencia es indispensable.
- **Calidad del contenido auto-generado** (el LLM redacta cada semana) — variable; el HITL lo cataches.

## Spike previo (cuando se active)

Molde desechable end-to-end: Temporal Schedule/loop + **HITL con timeout** (ejercitar la política de "no aprobó a tiempo") + confiabilidad real de la publicación vía Composio. El diseño sale del resultado del spike.

**Propietario:** equipo Copiloto. **Condición de activación:** cerrada la v1 del cliente + decisión del canal de aviso.

Relacionados: identidad del producto (`factory-identidad-automatizacion-ia`), arquetipo `recurring_charge`, `mp_refresh_workflow.py`, hueco de notificaciones del análisis UX (`2026-07-03-cliente-ux-analisis.md`).
