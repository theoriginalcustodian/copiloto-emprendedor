---
name: los-crones-corren-los-scripts-del-checkout-principal-no-los-de-main
description: "Los gates de vigilancia se ejecutan con la copia de scripts/ del checkout compartido, que puede estar decenas de commits atrás de main"
metadata: 
  node_type: memory
  type: project
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-21T18:14:00.969Z
---

Los crones de la sesión PLANIFICACIÓN invocan `bash scripts/vigilancia-check.sh` con el cwd del
**checkout compartido** (`C:/Proyectos/Claude/Claude code/copiloto-emprendedor`). Ese árbol es el
único que tiene `coordinacion/` —el buzón vive ahí y está gitignoreado—, pero **no se actualiza
solo**: el 2026-09-21 estaba 36 commits atrás de `main`.

Consecuencia: mergear un fix de instrumento **no lo pone en producción**. El fix vive en `main`; lo
que corre cada 3 minutos sigue siendo la copia vieja del checkout. Ese día el gate generó seis
`urgente_` en cascada con el escalador que ya estaba arreglado en `main` (#549), 20 minutos después
del merge.

**How to apply:** después de mergear un cambio en `scripts/`, si querés verificarlo contra el buzón
REAL corré la versión nueva desde tu worktree apuntando al buzón compartido:

```bash
BUZON_DIR="C:/Proyectos/Claude/Claude code/copiloto-emprendedor/coordinacion" \
  bash C:/gfw-src/wt-backlog/scripts/vigilancia-check.sh --dry-run
```

`--dry-run` es obligatorio si no querés que escriba `urgente_` en el canal vivo mientras probás.

Sincronizar el checkout compartido es **del operador**: es su árbol, tiene sus archivos sin
versionar, y la regla dura prohíbe `pull`/`checkout`/`reset` ahí
([[el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama]]). Antes de pedírselo,
comprobá si sus cambios *tracked* ya están en `main` y decíselo con la evidencia — el 21/09 el
único archivo modificado era una copia literal de un PR ya mergeado.

Relacionado: [[el-device-no-corre-main-corre-lo-que-metro-sirve]] \u2014 es el mismo error de fondo:
preguntá qué árbol lee realmente el proceso que estás midiendo, no cuál creés que lee.
