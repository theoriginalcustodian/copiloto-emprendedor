---
name: git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos
description: En Windows/Git Bash, git cat-file origin/main:.githooks/... falla por mangling de MSYS y se lee como "el archivo no está en main" — ya fabricó un handoff externo entero de trabajo inexistente
metadata:
  type: project
---

# 🪟💥 Git Bash mangla los paths que empiezan con punto — y el falso negativo llega disfrazado de tarea

En Windows con Git Bash (MSYS), cualquier `git <cmd> <ref>:<path>` donde el **path arranca con `.`**
se transforma antes de llegar a git:

```bash
git cat-file -e origin/main:.githooks/pre-push
# → fatal: Not a valid object name origin\main;.githooks\pre-push
#   (los ':' se volvieron ';' y las '/' se volvieron '\')
```

**Fix:** prefijar `MSYS_NO_PATHCONV=1`.

```bash
MSYS_NO_PATHCONV=1 git cat-file -e origin/main:.githooks/pre-push   # ✅
MSYS_NO_PATHCONV=1 git show     origin/main:.claude/commands/x.md    # ✅
```

Afecta a todo lo que empiece con punto: `.githooks/`, `.claude/`, `.github/`, `.gitignore`.

## Por qué es peligroso y no sólo molesto

El error **no dice "no puedo parsear tu path"**: dice `Not a valid object name`. Eso se lee como
*«ese objeto no existe en main»* — o sea, como un **hallazgo sobre el repositorio** cuando es una
falla del instrumento. Es el caso exacto de [[instrumentos-que-confirman-en-vez-de-verificar]] y de
[[vacio-no-es-hallazgo-correr-el-control]]: el control es correr el mismo comando con
`MSYS_NO_PATHCONV=1`, y si aparece, lo roto era tu llamada.

## El caso que lo convirtió en regla — un handoff EXTERNO fabricado (2026-07-24)

Un agente de otro repo (Graphity) entregó un handoff *«verificado empíricamente contra el repo real»*
pidiendo **dos acciones**: mergear `.githooks/pre-push` a `main` desde una rama, y correr
`git config core.hooksPath .githooks`.

Medido acá antes de ejecutar: el hook **ya estaba en `main`** (94 líneas, no las 61 que el handoff
describía — había crecido), `core.hooksPath` **ya estaba configurado** y **heredado por los 20
worktrees**, y la rama tenía **0 commits** sin mergear. Las dos acciones eran trabajo inexistente.

**Lo que hace a este caso peor que el propio:** un falso negativo interno lo cazás con el control.
Uno que llega **empaquetado como handoff de otro agente** viene con la verificación ya *declarada* —
«verificado empíricamente» — así que invita a ejecutar, no a medir. Y las dos acciones eran
plausibles y baratas: mergear una rama y setear un config. Nada en el pedido se siente sospechoso.

## La regla

**Un handoff externo se MIDE contra el repo antes de ejecutarlo, aunque diga que ya se verificó.**
La verificación de otro agente es una aserción sobre un sistema que vos tenés delante — y si corrió
en Windows/Git Bash, su instrumento pudo mentirle con la misma cara de certeza.

Barato: son 3 comandos. `git cat-file -e` del artefacto (con `MSYS_NO_PATHCONV=1`), `git config` de
la clave, y `git rev-list --count origin/main..origin/<rama>` — si da 0, no hay nada que mergear.

Corolario para el otro lado: si **vos** entregás un handoff medido en Windows y afirma que algo
falta, verificalo con `MSYS_NO_PATHCONV=1` antes de mandarlo. [[no-codificar-la-esperanza-principio-raiz]]
