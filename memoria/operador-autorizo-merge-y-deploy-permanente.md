---
name: operador-autorizo-merge-y-deploy-permanente
description: El operador autorizó merge y deploy de forma PERMANENTE en este repo — no volver a pedir permiso ni pausar por esto en ninguna sesión futura
metadata:
  type: feedback
---

El operador dio autorización **permanente** para `gh pr merge` y `deploy.sh` (o equivalentes) en
`copiloto-emprendedor`, verbatim: *"autorizo merge y deploy para siempre en este repositorio... no
necesito decirlo siempre, guardalo en la memoria para no frenarte ni seguir preguntando por esto"*
(2026-07-23).

**Por qué:** durante el cierre del sprint mobile-first, ya había autorizado merge/deploy puntual una
vez; lo repitió como standing permission para no tener que reconfirmar en cada ciclo. Es la misma
autorización que ya vive en `COORDINACION.md`/el prompt del vigía ("Merge y deploy están autorizados"),
pero elevada por el operador mismo a nivel de repo, no de sesión.

**How to apply:** cualquier sesión (backend, frontend, planificación) que trabaje en este repo puede
mergear PRs verdes/mergeable y correr `deploy/copiloto/deploy.sh` **sin pedir autorización previa**,
siempre que: CI esté verde, el cambio no sea destructivo (migración con datos en prod, cambio de
contrato externo), y se reporte con evidencia (commit + verificación HTTP contra el vivo) — no cambia
el resto de la constitución (§ Ejecutando acciones con cuidado sigue aplicando a lo genuinamente
irreversible). No volver a preguntar "¿mergeo?"/"¿despliego?" en este repo.
