---
name: checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree
description: git checkout <ref> -- . reescribe TODO el working tree y borra sin retorno los cambios que solo viven ahí (nunca en índice ni commit) — y en checkout compartido pisa lo de otras sesiones
metadata:
  type: project
---

Incidente 2026-07-24 (frontend, reportado limpio): corrió `git checkout main -- .` para "chequear si
su checkout estaba al día" — sin `git status` ni stash previos, en el **checkout compartido** por las
tres sesiones. Dos daños:

1. **Pisó todo el working tree** con el `main` LOCAL viejísimo (`68ba367`, pre-hito-7) — decenas de
   archivos de otras sesiones (`apps/copiloto/*.py`, `motor/`, frontend ajeno) reescritos a un estado
   antiguo. Recuperable con `git checkout HEAD -- .` (restaura al HEAD real de la rama).
2. **Borró sin retorno** el diff **sin commitear** de `memoria/MEMORY.md` (2 punteros de índice que
   planificación había agregado sin commit). Un cambio que vive **solo en el working tree** —nunca en
   el índice ni en un commit— **no lo recupera nada**: ni reflog, ni stash, ni fsck. reflog/fsck
   rescatan objetos que ALGUNA VEZ entraron a git; un working-tree-only pisado no dejó objeto.

**El daño real fue acotado por suerte, no por diseño:** los archivos-tópico nuevos eran **untracked**,
y `checkout -- .` solo toca paths **trackeados** → sobrevivieron. Solo se perdió el índice (archivo
trackeado con diff sin commitear). Si el contenido hubiera estado en un tracked file sin commit, se
perdía entero.

**Why:** `checkout <ref> -- .` no es "mirar", es **escribir** el working tree entero desde `<ref>`,
descartando lo no-commiteado en su camino — el failure mode exacto que la regla de git ([[amend-en-checkout-compartido-pisa-el-commit-de-otro]], [[sincronizar-al-vps-desde-el-worktree-equivocado]])
existe para prevenir, ahora en su variante más filosa: el `-- .` toca TODO, y en checkout compartido
"todo" incluye el trabajo vivo de las otras dos sesiones.

**How to apply:**
1. **La pregunta "¿mi rama está al día con origin/main?" NO necesita tocar archivos.** Usá
   `git merge-base --is-ancestor origin/main HEAD` (o `git log origin/main..HEAD` / `git status -sb`) —
   responden sin escribir el working tree. `checkout -- .` era la herramienta equivocada para esa pregunta.
2. **Antes de CUALQUIER comando que pueda descartar cambios** (`checkout -- .`, `reset --hard`, `clean`,
   `stash` mal usado) en checkout compartido: `git status` primero, y `git add` con rutas explícitas de
   lo tuyo. La regla dura del repo: nunca `-A`, nunca reset/checkout/clean sobre el árbol completo.
3. **Cambios de memoria: commitealos pronto.** Un puntero de `MEMORY.md` sin commit es exactamente el
   working-tree-only que se pierde. `memoria/` es trackeado — un `git add memoria/... && commit` cierra
   la ventana. No lo dejes colgando entre ciclos de monitor.
