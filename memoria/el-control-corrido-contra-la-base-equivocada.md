---
name: el-control-corrido-contra-la-base-equivocada
description: `git diff --numstat` dio "7 agregadas, 0 borradas" y el commit igual dejó afuera 4 entradas — el control comparaba contra la rama CHEQUEADA, no contra el commit padre real de la cadena que se estaba armando.
metadata:
  type: project
---

**LEER cada vez que se commitea con `GIT_INDEX_FILE` + `commit-tree` sobre una cadena que NO está
chequeada** (el patrón obligado en este repo por el checkout compartido).

2026-07-28. Al agregar 4 memorias a `memoria/MEMORY.md` corrí el control de siempre —el que ya evitó
una vez borrar 4 entradas vivas:

```bash
git diff --numstat -- memoria/MEMORY.md    # → 7  0   ✅ "cero borrados"
```

El commit igual **dejó afuera 4 entradas**. `git diff` sin argumentos compara el working tree contra
**HEAD**, y HEAD era `feat/hito9-...` — la rama chequeada. La cadena que estaba construyendo colgaba
de otro commit, con un `MEMORY.md` que tenía 4 líneas que el working tree no. El control midió una
distancia real, pero **no la que importaba**.

**El control correcto es contra el padre del commit que estás por crear:**

```bash
git diff --numstat <padre> -- memoria/MEMORY.md
# y el definitivo, que no depende de contar líneas:
git show <padre>:memoria/MEMORY.md | grep -o "](\([a-z0-9-]*\)\.md)" | sort -u > a.txt
grep -o "](\([a-z0-9-]*\)\.md)" memoria/MEMORY.md | sort -u > b.txt
comm -23 a.txt b.txt          # vacío = ninguna entrada del padre se cayó
```

**Por qué engaña tanto.** El número salió **verde y plausible**: 7 agregadas, 0 borradas, exactamente
lo que esperaba ver. Un control que devuelve lo que esperás no dispara ninguna revisión — es el mismo
mecanismo de [[instrumentos-que-confirman-en-vez-de-verificar]], pero acá el instrumento no estaba
roto: estaba **bien apuntado a otra cosa**. Y de [[el-default-de-la-herramienta-devuelve-mas-de-lo-que-asumis]]:
el default de `git diff` (contra HEAD) es razonable en el flujo normal y **equivocado** en éste.

**La regla portable:** cuando el flujo de trabajo mueve la base —commit-tree, worktrees, cherry-pick,
índices temporales— *nombrá explícitamente contra qué comparás*. Un control sin base explícita hereda
la base del contexto, y el contexto acá no es el que creés.

**Y el control de completitud gana al de conteo.** `comm -23` sobre el conjunto de slugs no puede
mentir por compensación; un `+7/-0` sí: 4 caídas y 4 altas dan cero neto en cualquier métrica que
reste. Hermana de [[amend-en-checkout-compartido-pisa-el-commit-de-otro]] y
[[memoria-repo-vs-slug-drift]].
