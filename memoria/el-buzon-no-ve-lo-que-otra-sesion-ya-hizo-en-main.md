---
name: el-buzon-no-ve-lo-que-otra-sesion-ya-hizo-en-main
description: "Antes de abrir un frente, mirar git log origin/main y los PRs — el buzón sólo refleja lo anunciado, no lo hecho"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T13:31:29.165Z
---

Antes de abrir cualquier frente de trabajo, revisar **`git log origin/main` y `gh pr list`**, no sólo
el buzón de `coordinacion/`. El buzón refleja lo que alguien **anunció**; `main` refleja lo que alguien
**hizo**.

**Why:** el 2026-08-12 dos sesiones trabajaron el mismo frente sin saberlo — una re-verificando los 11
hallazgos de auditoría (PR #386, mergeado 10:20), otra planificando una "Pasada 0" cuyo contenido era
re-verificar los 11 hallazgos. Ninguna vio a la otra: el buzón estaba limpio y la cola vacía. Se
detectó recién por un **conflicto de merge en el README**, después de escribir el plan entero. Peor:
el plan afirmaba que `2026-08-06-plan-de-implementacion.md` "nunca existió en main" — era cierto en
`debe5623`, y dejó de serlo mientras se redactaba.

**How to apply:** al arrancar un frente, y de nuevo antes de pushear, correr `git fetch && git log
origin/main --oneline -10` + `gh pr list --state all --limit 10`. Si el frente es de auditoría o
documentación sobre estado del sistema, la verificación es obligatoria: son los que más se solapan
entre sesiones. Vale también al revés — una afirmación verificada contra un sha queda **fechada a ese
sha**, y hay que re-verificarla antes de publicarla. Relacionado:
[[el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama]] ·
[[coordinacion-tres-sesiones-buzon]]
