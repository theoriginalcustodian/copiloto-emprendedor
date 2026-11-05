---
name: leer-un-buzon-no-versionado-por-ruta-relativa-da-cero
description: Una sesión en worktree que busca coordinacion/ por ruta relativa ve 0 mensajes, indistinguible de «no hay ninguno».
metadata:
  type: project
---

`coordinacion/` está gitignored: es **una carpeta física única** direccionada por ruta absoluta. Una
sesión que corre en `C:/gfw-src/wt-*` y la busca relativa a su cwd no encuentra el directorio, así
que el resultado es **0 archivos** — exactamente lo que devuelve un buzón vacío. Frontend1 reportó
«no tengo ningún `pedido_`» mientras había 3 dirigidos a ella (control positivo: 45/1/8 archivos en
`abierto/`, `en-curso/`, `cerrado/<hoy>/`).

**Why:** el caso de falla imita el caso benigno, así que nadie lo investiga —
[[dato-degenerado-imita-ausencia-del-mecanismo]] aplicado al direccionamiento.

**How to apply:** siempre la ruta ABSOLUTA del buzón, y `scripts/vigia.sh mi-buzon.sh <rol> --todo`
en vez de un `find` propio. Un cero del buzón **no se reporta** sin un control positivo que pruebe
que el instrumento está mirando la carpeta real.
