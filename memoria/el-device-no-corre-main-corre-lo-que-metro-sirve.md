---
name: el-device-no-corre-main-corre-lo-que-metro-sirve
description: "Mergear a main NO actualiza el device; corre lo que Metro sirve desde SU checkout. Restaurar ese checkout revierte el fix en el teléfono por fast-refresh, en silencio y sin error"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8f54fd09-ae88-47d9-812e-a0bb31aae0af
  modified: 2026-08-19T20:30:36.631Z
---

**2026-08-19, fix de `BotonVoz` (PR #461).** Verifiqué el fix en device, mergeé a `main`, y después
—como "limpieza"— restauré a limpio el worktree `C:\gfw-src\copiloto-main` que había instrumentado.
Ese worktree es **el que sirve Metro** (PID de `expo start --dev-client`, puerto 8081, detached HEAD
en el commit PRE-fix). El `git checkout --` disparó un fast-refresh que **devolvió el teléfono al
código con el bug**, sin un solo error en ningún lado.

Casi dos horas después el operador probó con el dedo y encontró el bug intacto. Yo había reportado
"cerrado, verificado en device" — y era cierto del código en `main`, pero **falso del teléfono que él
tenía en la mano.**

**Por qué pasa:** el device de desarrollo no ejecuta `main`. Ejecuta el bundle que Metro compila
desde el working tree de SU checkout, que puede estar en cualquier rama, en detached HEAD, o
directamente sucio. Mergear no lo toca. Y el fast-refresh aplica el cambio inverso con la misma
naturalidad que el directo: revertir un archivo es, para Metro, un cambio más.

**Cómo aplicar:**

1. **Antes de tocar cualquier archivo por "higiene", preguntate si Metro lo está sirviendo.**
   `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` + `netstat -ano | Select-String ":8081"`
   dice qué proceso escucha y desde qué carpeta arrancó.
2. **Un merge NO es evidencia de device.** Si el teléfono tiene que quedar con el fix andando, el
   último paso es dejar el checkout que sirve Metro **con el código mergeado**, no "como lo
   encontré". Son objetivos que chocan: elegí explícitamente y decilo.
3. **El diagnóstico rápido:** si la app dejó de emitir tus logs instrumentados y el bug volvió, no
   es que el fix falló — es que el bundle cambió. Mirá el timestamp de la última línea de logcat
   contra el momento en que tocaste el working tree de Metro. En este caso calzaban al segundo
   (`BotonVoz DESMONTADO` a las 15:38:32 = el `git checkout --`).
4. **Recarga completa para no dudar:** `am force-stop` + relanzar baja el bundle de cero. El
   fast-refresh puede no propagar y deja el estado ambiguo.

Relacionado: [[iterar-en-device-es-metro-local-con-dev-client-ya-instalado]] ·
[[una-orden-cerrada-exige-evidencia-de-device]] · [[instrumentos-que-confirman-en-vez-de-verificar]]
