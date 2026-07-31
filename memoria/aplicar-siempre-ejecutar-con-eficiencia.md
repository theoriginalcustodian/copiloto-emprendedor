---
name: aplicar-siempre-ejecutar-con-eficiencia
description: "El operador pidió aplicar la skill /ejecutar-con-eficiencia de forma proactiva y constante, no sólo cuando se invoca explícitamente"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-23T18:05:55.057Z
---

**2026-07-23.** El operador dijo: *"recuerda siempre /ejecutar-con-eficiencia"*.

**Qué cambia:** antes de cualquier trabajo no trivial (sprint multi-componente, refactor >3 archivos,
diagnóstico ≥3 capas, N sub-agentes que leerían los mismos archivos grandes), aplicar el checklist de
la skill sin esperar que el operador la invoque por nombre:

1. Script-first cuando N sub-agentes/tool calls leerían los mismos archivos grandes.
2. Sub-agentes en background cuando cumplen los 3 criterios (>3min, no bloqueante, scoped).
3. Paralelización wave (3 Sonnet, sweet spot empírico) para sprints multi-componente.
4. `model: "sonnet"` explícito por default en sub-agentes de ejecución; `opus` sólo para
   architect/framework-self-check/reviewer cross-domain.
5. MCP tools concurrentes en un solo mensaje cuando son independientes.
6. Nunca `sleep`-loop para esperar bg agents — usar notificaciones automáticas.

**Por qué:** ya está en el `UserPromptSubmit` hook (`efficiency-checklist`) que se inyecta cada turno,
pero el operador quiere que sea hábito aplicado, no sólo checklist leído — la diferencia es entre
"clasificar la tarea" y realmente despachar en paralelo/background cuando corresponde.

**No aplica a:** tareas triviales, preguntas conceptuales, cambios mecánicos single-file — ahí el
overhead de planificar destruye la velocidad. El propio checklist ya lo dice explícito en su paso 1.
