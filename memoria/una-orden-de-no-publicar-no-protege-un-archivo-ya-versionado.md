---
name: una-orden-de-no-publicar-no-protege-un-archivo-ya-versionado
description: El operador ordenó no pushear un doc sensible; 2h17m después lo mergeé a main público dentro de un PR que iba por otra razón — mientras el archivo viva commiteado, la orden no lo protege de la próxima sesión que mergee esa rama
metadata:
  type: feedback
---

# 🚪📤 Una orden de «no publicar» NO protege un archivo ya VERSIONADO

El 2026-10-11 a las **20:56:51** bajó al buzón una orden del operador: la rama
`docs/relevamiento-mobile-cierre` **no se pushea**, porque el relevamiento tiene información sensible
de la app y el repo es **público**. A las **23:14:10** —**2h17m después**— mergeé el PR #1022 a `main`.
Su título lo decía: *«…y el relevamiento que los sostiene»*. Lo publiqué yo.

**Why:** la orden protegía un **evento** (el push) mientras el riesgo vivía en un **estado** (el
archivo commiteado en una rama). Yo no mergeé para publicar el doc: mergeé el **plan y el backlog** del
sprint, que vivían en la misma rama. El doc viajó de polizón. Una orden de no-pushear sólo frena a
quien la leyó y está pensando en ese archivo; no frena a quien mergea esa rama por un motivo distinto,
ni a un `git push` de otra sesión, ni a un squash-merge que arrastra todo el árbol. Y es asimétrica:
publicar es un click, despublicar en un repo público es `filter-repo` + force-push a `main` + borrar el
PR + pedir GC a GitHub, con 41 worktrees a rebasear.

**How to apply:** si un archivo no debe ser público, **no puede estar commiteado** — sacarlo a
`.gitignore` o a una ruta fuera del repo, que es lo que `coordinacion/` ya hace. Si tiene que quedar
versionado, la protección no es una orden: es un gate mecánico que vea el path. Y antes de mergear,
mirar **qué más** arrastra la rama además de lo que motivó el PR: `git diff --name-only origin/main..HEAD`
no cuesta nada y nombra a los polizones.

**La otra mitad, que es mía:** la orden estuvo 2h17m en el buzón y no la leí. **Reanudar es una
frontera de trabajo** — el resumen de sesión te devuelve al hilo que dejaste, no al que cambió mientras
no estabas, y el hook lo avisa textualmente. Una orden que invalida tu tarea pendiente no llega como
interrupción: te espera. Primo de [[la-evidencia-vence-y-el-documento-no-lo-dice]] y de
[[mensaje-entregado-donde-nadie-mira]].

**Cierre:** medido con canario válido (7 patrones, 1/1 cada uno) — **0 credenciales, 0 datos
personales, 0 capturas de device**; lo expuesto fue el inventario de 62 hallazgos. Repo `PUBLIC`,
0 forks. El operador eligió **aceptarlo** sobre reescribir la historia. El costo de esta falla fue
bajo por suerte, no por diseño.
