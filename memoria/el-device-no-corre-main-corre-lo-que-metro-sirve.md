---
name: el-device-no-corre-main-corre-lo-que-metro-sirve
description: "Mergear a main NO actualiza el device; corre lo que Metro sirve desde SU checkout. Y ese checkout era el worktree del grafo: graph-sync le hacía reset --hard en CADA push y rompía el teléfono solo, sin que nadie tocara nada"
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

## ⚠️ Corrección del mismo día (18:00) — el diagnóstico de arriba era correcto pero PARCIAL

Culpar a mi `git checkout --` era quedarse en el síntoma. Dos horas después el teléfono volvió a
romperse —«Failed to compile: None of these files exist: `src\modules\chat\BotonVoz…`»— **sin que
nadie tocara nada a mano**. Sólo hubo un `git push`.

`C:\gfw-src\copiloto-main` no era "un checkout donde alguien levantó Metro": era **el worktree del
grafo**. `scripts/graph-sync.sh` lo usaba de default (`WT=…`) y le hace `reset --hard` + `clean -fd`
+ `checkout --detach origin/main` **en cada push de cualquier sesión**, disparado por el hook
`pre-push`. Metro veía desaparecer los archivos a mitad del fast-refresh y quedaba pegado.

**Dos dueños con contratos incompatibles sobre el mismo árbol**, y ninguna guarda lo veía: las
guardas 1 y 2 de `graph-sync.sh` sólo detectan consumidores de **git** (checkout de trabajo, rama
checkouteada). Un bundler no es ninguna de las dos — está *detached*, que es justo lo que la guarda 2
**exige**. Pasaban verdes mientras el reset le borraba los archivos al dev-client.

Arreglado el 2026-08-19: el worktree del grafo se mudó a `C:/gfw-src/copiloto-grafo` (se muda el
destructivo, no el pasivo) + guarda dura 3 que aborta si el árbol del grafo tiene `node_modules`.

**La lección que generaliza:** cuando un proceso vivo lee un directorio, preguntá **qué otro proceso
lo escribe** — no sólo quién lo edita a mano. Un `reset --hard` automatizado en un hook es un editor
más, corre sin que nadie lo pida, y no deja rastro en el proceso que rompe. El síntoma sale a dos
metros de la causa. Relacionado: [[instrumentos-que-confirman-en-vez-de-verificar]].

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
