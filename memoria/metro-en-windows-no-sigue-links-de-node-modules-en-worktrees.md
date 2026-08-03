---
name: metro-en-windows-no-sigue-links-de-node-modules-en-worktrees
description: GOTCHA verificado (2026-07-23) — Metro en Windows NO resuelve NINGÚN link de directorio (junction ni symlink) dentro de node_modules para armar su grafo de módulos. Un git worktree con node_modules linkeado da 404 UnableToResolveError al bundlear, aunque tsc/jest sí sigan el link. Fix: node_modules con archivos REALES en el worktree
metadata:
  type: reference
---

**Síntoma:** un `git worktree` (ej. `_wt-device-main`) cuyo `node_modules` (o un paquete adentro, ej.
`expo-router`, `@copiloto/core`) es un **link** al checkout principal → al conectar el dev-client, Metro
devuelve **HTTP 404** `DebugServerException: UnableToResolveError` sobre
`/node_modules/<pkg>/entry.bundle`. El dev-client conecta bien; **falla el bundling**, no la conexión.
Fácil de confundir con un ANR/crash (el dev-client entra en crash-loop de reintentos que PUEDE disparar
un ANR por saturación — ver [[iterar-en-device-es-metro-local-con-dev-client-ya-instalado]]).

**Causa raíz (verificada 2026-07-23, frontend):** **Metro en Windows NO sigue links de directorio en
`node_modules`** — ni junction (`mklink /J`), ni symlink real (`mklink /D`), ni con
`unstable_enableSymlinks=true` en `metro.config.js`. Ninguno funciona. `tsc`/`jest` SÍ los siguen, así que
el typecheck y los tests pasan verdes mientras el bundle de Metro tira 404 — la trampa.

**Fix que funciona:** `node_modules` con **archivos REALES** en el worktree. `robocopy` del `node_modules`
del checkout compartido (~750MB, ~2min) + **copiar** (no linkear) los paquetes propios del worktree (ej.
`packages/core` → `node_modules/@copiloto/core`) para que el bundle use el código de ESA rama, no el del
checkout viejo. Reiniciar Metro con `--clear`. **Verificar por HTTP sin device:**
`curl http://127.0.0.1:8081/node_modules/<pkg>/entry.bundle?platform=android...` → debe dar **200** con un
bundle de MB, no 404.

**Trade-off:** los paquetes propios copiados (no linkeados) NO reflejan ediciones en vivo — si se edita
`packages/core` en el worktree, hay que re-copiar o poner un watcher. Para un worktree de verificación
(rama congelada) no importa; para uno de trabajo activo, sí.

**Cuándo aparece:** cualquier device/Metro corriendo desde un git worktree en Windows (nuestro caso, por
las 3 sesiones con checkouts/worktrees separados). Con un checkout normal (node_modules real) no pasa.
[[sincronizar-al-vps-desde-el-worktree-equivocado]] [[gate-jsdom-no-ve-gestos-tactiles]] (verde en
tsc/jest ≠ el bundle de Metro anda).
