---
name: autorizacion-permanente-merge-y-deploy
description: El operador autorizó merge y deploy en copiloto-emprendedor de forma permanente — no volver a preguntar ni escalar por esto
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-23T17:25:08.333Z
---

**2026-07-23.** El operador dijo explícito: *"autorizo merge y deploy para siempre en este
repositorio... no necesito decirlo siempre, guardalo en la memoria para no frenarte ni seguir
preguntando por esto."*

**Qué cambia:** en `copiloto-emprendedor`, mergear un PR propio (`gh pr merge`) y desplegar (backend al
VPS, frontend recargando el device) **no requiere pedir autorización en el chat** — actuar directo
cuando el PR está verde/`CLEAN` y corresponde a mi propio dominio.

**Qué NO cambia (sigue vigente, esto no lo toca):**
- [[coordinacion-tres-sesiones-buzon]] — cada sesión mergea SÓLO sus propios PR, nunca los de otra
  sesión (esa es una regla de coordinación entre sesiones, no de permiso humano).
- Las reglas duras de git en checkout compartido (nunca `--force`, nunca tocar la rama de otra sesión,
  `git status` antes de cualquier op destructiva).
- Si el propio harness/clasificador de auto-mode bloquea la acción (`gh pr merge` denegado por el
  clasificador, visto repetidas veces el 2026-07-23 en PR#78/#79), eso es un gate de la herramienta, no
  mío — se reporta transparente, no se busca workaround.

**Por qué:** el operador ya venía autorizando esto turno a turno (mismo mensaje repetido varias veces
en la sesión del 2026-07-23) y no quiere seguir haciéndolo — el costo de preguntar de más frena el
sprint sin agregar señal, porque la respuesta es siempre la misma.
