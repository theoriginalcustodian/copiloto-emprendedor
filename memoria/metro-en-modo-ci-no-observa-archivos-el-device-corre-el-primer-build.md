---
name: metro-en-modo-ci-no-observa-archivos-el-device-corre-el-primer-build
description: "Metro con CI=1 (\"reloads are disabled\") NO re-bundlea al editar; el device sigue corriendo el primer build — un A/B \"original vs fix\" midió dos veces el original"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8b4c92c0-372e-46d5-b6b5-3a55993f8120
  modified: 2026-10-14T16:33:10.619Z
---

`CI=1 npx expo start` imprime «Metro is running in CI mode, reloads are disabled» y **no observa
cambios de archivos**: el grafo que arma la primera petición del dev-client queda congelado. Editar
`PanelFunciones.tsx` y relanzar la app NO cambia lo que corre el device (cada arranque sale
«Bundled 48ms (1 module)»). Un `curl` con otros parámetros SÍ arma un grafo nuevo desde disco y
muestra el cambio — por eso `grep` al bundle «confirmaba» el fix mientras el device corría el original.

**Why:** SM-A1 (2026-10-14): ~6 corridas «con fix» midieron el código ORIGINAL; el instrumento
daba 0/2 en ambos y parecía que el fix no servía. La señal que lo delató: un cambio de rótulo
visible (`DBGX`) no aparecía tras reiniciar la app, y ningún `console.warn` propio llegaba a logcat.

**How to apply:** antes de medir en device con un fix, (1) reiniciar Metro (matar el PID y volver a
levantar) DESPUÉS de dejar el archivo en disco, o no usar CI=1; (2) poner una sonda visible/
loggeada de que el cambio llegó (rótulo, `console.warn`) y verificarla en el device; (3) un A/B
exige reiniciar Metro entre variantes. Relacionado: [[el-device-no-corre-main-corre-lo-que-metro-sirve]],
[[la-condicion-que-el-instrumento-exige-para-ver-cambia-lo-medido]].
