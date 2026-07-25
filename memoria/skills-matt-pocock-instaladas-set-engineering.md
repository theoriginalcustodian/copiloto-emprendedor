---
name: skills-matt-pocock-instaladas-set-engineering
description: 16 skills del repo forkeado theoriginalcustodian/skills instaladas globales el 2026-07-24 — el set engineering NO está configurado todavía
metadata:
  type: reference
---

**Instaladas globales en `~/.claude/skills/` el 2026-07-24** (fork de `mattpocock/skills` →
`github.com/theoriginalcustodian/skills`). Total pasó de 34 a **50**. Cierre transitivo verificado:
cero referencias `/skill` rotas.

| Grupo | Skills |
|---|---|
| Interrogatorio | `grilling` · `grill-me` (wrapper 1 línea) · `grill-with-docs` (= grilling + domain-modeling) |
| Núcleo útil | `diagnosing-bugs` (+`scripts/hitl-loop.template.sh`) · `prototype` (+`LOGIC.md`/`UI.md`) · `domain-modeling` (+`ADR-FORMAT.md`/`CONTEXT-FORMAT.md`) · `writing-great-skills` (+`GLOSSARY.md`) |
| Flujo de trabajo | `wayfinder` · `implement` · `tdd` · `code-review` · `research` · `triage` · `codebase-design` · `improve-codebase-architecture` · `setup-matt-pocock-skills` |

## ⚠️ Lo que falta para que el set engineering sirva

**`setup-matt-pocock-skills` NO se corrió.** Su propia descripción dice *"Run once before first use of
the other engineering skills"* — configura el **issue tracker**, el vocabulario de labels de triage y
el layout de docs de dominio.

**Y ahí está la colisión que hay que decidir antes de correrlo:** esas skills asumen un tracker de
issues (GitHub Issues por default, con fallback a "local-markdown tracker"). **Nuestro tracker es
`coordinacion/` + `PLAN.md` + el buzón de tres sesiones**, que ya resuelve lo mismo y está más maduro
(tiene F7.5 y estado-es-ubicación, que el de Matt no). Correr el setup a ciegas puede montar un
segundo sistema paralelo — exactamente el "dos verdades" que el formato de coordinación existe para
evitar.

**Decisión pendiente del operador:** o se adapta `wayfinder` a nuestro buzón, o se corre el setup con
el fallback markdown en un scope acotado, o no se usa `wayfinder` y sí el resto (que no depende del
tracker).

## Lo que vale sin tocar nada

`diagnosing-bugs` y `prototype` funcionan solas y encajan con la doctrina de acá (spike-first, el
control antes de explicar). La tesis de `diagnosing-bugs` —*construí un loop de feedback tight primero,
todo lo demás es mecánico*— es la misma que [[no-codificar-la-esperanza-principio-raiz]] aplicada al
debugging, con 10 formas concretas de construirlo.

**Idea de `wayfinder` que NO tenemos hoy:** separa explícitamente **tickets de decisión** (preguntas
cuya resolución es una decisión) de tickets de build. Nuestro `PLAN.md` los mezcla.

[[canibalizar-goal-de-claude-code-en-el-bucle]]
