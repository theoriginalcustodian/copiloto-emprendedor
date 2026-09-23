---
name: martin-disena-y-la-meta-es-su-prototipo-final
description: Martín Cairo es el diseñador gráfico y no programa; la meta del frente prototipo↔app es igualar SU prototipo final al día. Su versión del 17-18/09 SÍ está en el repo desde el 2026-09-21 (54fac3ea) — la vara existe y es medible.
metadata:
  node_type: memory
  type: project
  originSessionId: 4b555afb-9193-4468-8751-fe66ac7206b6
  modified: 2026-09-22T19:10:00.000Z
---

Martín (Cairo) hace **sólo los diseños gráficos** de Odobi (`Prototipo frontend/odobi-ui/`); no escribe código. La meta declarada por el operador (2026-09-21): que web y mobile lleguen al **prototipo final diseñado por Martín, con todas sus actualizaciones al día de hoy**.

Su diseño entra al repo por tandas (19/08 #464, 07/09 #474) y entre tandas sigue cambiando en su máquina.

## ✅ 2026-09-22 — la vara YA está en el repo (esta entrada estuvo vencida ~1 día)

**Hasta acá decía que lo del 17–18/09 «no está en GitHub» y que sólo se veía en los comentarios de los
PRs mobile #511–#513. Dejó de ser cierto el 2026-09-21:** el commit **`54fac3ea`** («design(prototipo):
traer odobi-ui al día y cerrar las tres decisiones del 18/09», 2026-09-21 12:09) lo trajo al repo, y es
el mismo árbol que FE2 sirvió en `localhost:8123` para medir las matrices web.

Detalle que vale más que el dato: esta entrada **era verdadera cuando se escribió** (modificada
13:03Z) y se venció **unas horas después**, con un commit que nadie relacionó con ella. Nada avisa.

Consecuencia concreta de haberla creído: induce a pensar que no hay vara actualizada cuando sí la hay,
y es justo la entrada que uno consulta **antes de decidir si vale la pena medir contra el prototipo**.
Lo destapó auditoría el 2026-09-22 verificando, por su cuenta, la premisa que sostenía las 16 filas de
`BL-V20` («el prototipo del 17-18/09 no refleja X»): fue a buscar un hallazgo sistémico y encontró que
**la vara era correcta**. Un control que pasa también es información.

Esos PRs (#511–#513) salieron con su usuario de git pero los escribió Claude Code (co-autor Claude en los commits, «Generated with Claude Code» en el cuerpo) y los mergeó Martín: en mobile implementó una sesión de su lado, no las sesiones de este repo. Por eso mobile y web divergieron (riesgo R-2 del reporte del 16/09).

**Why:** las auditorías del 08/09, 16/09 y 21/09 midieron contra la versión del repo (mockups / prototipo del 07/09), y Martín avisó que la primera «estaba basada en un diseño antiguo». Contexto de la primera: [[diff-cobertura-prototipo-vs-app-2026-09-08]].

**How to apply:** antes de auditar prototipo↔app, **medí la vara en vez de recordarla**:
`git log -1 --format='%h %ad' -- 'Prototipo frontend/odobi-ui/prototipo/index.html'` y declará contra
qué hash se midió. Es un comando, no una consulta a esta entrada — que puede estar vencida otra vez
cuando la leas. Los comentarios «Martin cerró…» en `apps/mobile/src` son decisiones de diseño suyas, no
defectos. Si su versión vigente **no** estuviera en el repo: pedirle que suba su carpeta por PR.

Relacionado: [[memoria-repo-vs-slug-drift]] (la otra afirmación de estado que se venció sin avisar, y
ahí el costo fue mayor: era una prohibición, e impidió el arreglo durante dos meses) ·
[[una-cifra-en-un-comentario-es-un-cache-sin-invalidacion]]
