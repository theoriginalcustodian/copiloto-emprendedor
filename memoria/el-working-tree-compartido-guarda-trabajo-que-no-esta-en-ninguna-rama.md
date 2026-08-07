---
name: el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama
description: El checkout compartido de las tres sesiones acumula docs y memoria que no están en main ni en su propia rama — y `??` en git status no distingue "perdible" de "ya mergeado"
metadata:
  type: project
---

El checkout compartido (`copiloto-emprendedor/`, rama `docs/production-readiness-brief`) donde
trabajan las tres sesiones **no es una vista de `main`**. Medido el 2026-08-06:

| Medición | Valor |
|---|---|
| merge-base con `main` | `a26a0a62`, **24 de julio** |
| commits de `main` que la rama no tiene | **237** |
| archivos que `main` cambió y el checkout no ve | **697** |
| archivos modificados sin commitear | 150 |
| archivos sin trackear | 219 |

De esos 150 modificados, **97 eran exactamente la versión de `origin/main`** (alguien los copió al
working tree sin commitear) y sólo **2 tenían contenido que no existía en ningún objeto del repo**.
De los 219 sin trackear, **179 ya estaban idénticos en `main`** y **57 eran inéditos** — entre ellos
el frente de auditorías completo, 6 planes de sprint y 12 entradas de memoria, **7 de las cuales no
estaban indexadas en ningún `MEMORY.md`** (ni el del repo ni el del slug): memoria escrita que nadie
podía encontrar.

## Why

Un checkout compartido tiene **dos formas de perder trabajo a la vez**, y las dos son mudas:

1. **Hacia adelante:** lo que se commitea a la rama compartida nunca se mergea entera, así que **no
   llega a `main`** — no existe para un worktree nuevo ni para el grafo de código, que ingesta
   `main`. Ver [[el-grafo-ingesta-el-disco-pero-fecha-con-head]].
2. **Hacia atrás:** la rama nunca se actualiza desde `main`, así que las herramientas servidas desde
   el cwd (hooks, slash commands, scripts) son las de hace semanas. Ver
   [[el-checkout-compartido-sirve-comandos-viejos]] — este es el mecanismo que lo causa.

Y encima acumula un tercer estrato: trabajo **sin commitear** que no está en ninguna de las dos
puntas, y que [[checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree]] borra sin que lo
salve el reflog.

## How to apply

- **`??` no significa perdible.** En un checkout anclado meses atrás, la mayoría de lo "sin trackear"
  ya está en `main` (179 de 219 acá). Y `git status --porcelain` **colapsa un directorio entero en
  una línea**: sin `-uall` contás 22 donde hay 28.
- **El control que separa perdible de recuperable es el blob**, no la lista de git:
  `git cat-file -e "$(git hash-object "$f")"` → si el objeto no existe, ese contenido sólo vive en
  disco. Bajó el problema de "370 cambios sin commitear" a **2 archivos** reales.
- **Rescatar es merge dirigido, nunca copia.** La rama está **atrasada**, no adelantada: copiar su
  `CLAUDE.md` sobre `main` habría borrado en silencio la regla 2.bis (el gate `scripts/gate.sh` del
  ADR-001), que `main` tiene y la rama todavía no. Control: el diff del archivo rescatado debe quitar
  **0 líneas** (o sólo las que reemplazás a propósito).
- **En Windows/MSYS, `git cat-file -e "origin/main:.claude/..."` falla en silencio** porque el path
  con `:` y `.` se convierte a forma Windows: el archivo aparece como SOLO-EN-RAMA cuando existe en
  `main`. Exportá `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'` o el instrumento miente.
- **La cura de raíz es MAYOR y está pendiente:** actualizar la rama compartida desde `main`. El spike
  en worktree desechable dio **7 conflictos** (`monitoreo-*.md`, `tool_catalog.py`, `web.py`,
  `worker_b.py`, `MEMORY.md`, `types.ts`) y hay 370 cambios sin commitear encima, así que no se hace
  sin coordinar a las tres sesiones. Mientras tanto: rescates por lote (PR #302, #303).
