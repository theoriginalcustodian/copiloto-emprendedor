#!/usr/bin/env bash
# Job "web" de .github/workflows/tests.yml, portado tal cual (contrato CI-PROPIO, 2026-08-06).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# apps/copiloto-web NO está en los `workspaces` del root (sólo apps/mobile y packages/*):
# un install desde la raíz no trae sus dependencias (tests.yml:154-158).
cd "$ROOT/apps/copiloto-web"
npm install --no-audit --no-fund

# `--build --force`, NO `tsc --noEmit` a secas (2026-08-07). El `tsconfig.json` de copiloto-web es un
# archivo de REFERENCIAS (`"files": []` + `references` a tsconfig.app/node), así que `tsc --noEmit`
# sin `-p`/`--build` compila el proyecto vacío: sale **exit 0 sin mirar un solo archivo**. Medido con
# control diferencial — con 10 errores de tipo reales en el árbol, `tsc --noEmit` daba 0 y
# `tsc --build --noEmit` daba 2 y los enumeraba. Este paso nunca chequeó tipos desde que existe
# (venía así de `tests.yml`, y el porte lo copió fiel). `mobile`/`core` NO tienen el problema: sus
# tsconfig traen `include` real.
# El `--force` ignora el `.tsbuildinfo`: un gate que se saltea archivos porque "no cambiaron" mide
# la caché, no el árbol. En CI el checkout es limpio y no cuesta nada.
npx tsc --build --force --noEmit
# En CI, los workers por defecto: el runner está limpio y la suite cierra en ~1 m 44 s (medido).
# En una PC, NO — y el motivo no es estético. Los timeouts de 5000 ms de `src/shell/` NO son del
# código: son contención de la máquina. Dos mediciones independientes, el 2026-10-06:
#   · auditoría: `web.sh` junto a `lint.sh` → 2 fallos; con más carga → 4; los 8 con el mismo
#     umbral de 5000 ms y todos en `src/shell/` (los tests más pesados). Esos mismos archivos
#     solos: 3/3 verdes. El CI sobre el MISMO sha, en runner limpio: `web pass` 1 m 44 s.
#   · frontend1: suite completa con `--maxWorkers=1` → rc=0, 133/133 archivos, 1277/1277 tests,
#     **0 timeouts**. Las tres corridas con N workers en la misma máquina: ROJO.
# Un conjunto de fallos que se MUEVE y CRECE con la carga acusa al recurso compartido, no al diff.
#
# Por qué se arregla acá y no subiendo el `testTimeout`: subir el umbral esconde lentitud real y
# degrada el gate hacia el caso benigno. Lo que se acota es el paralelismo, que es la causa medida.
#
# Y por qué no es cosmética: un gate que grita en el caso NORMAL enseña a saltearlo con
# `--no-verify`, y en ESTE repo `--no-verify` arrastra **gitleaks** — o sea un falso rojo de web
# termina habilitando un secreto en un repo público. El falso rojo no es prudencia: es el permiso.
#
# Parametrizado a propósito (cero hardcoding): una máquina holgada sube el número sin tocar el
# script — `VITEST_WEB_MAXWORKERS=4 bash scripts/ci/web.sh`.
if [ -n "${CI:-}" ]; then
  npx vitest run
else
  echo "[web] PC detectada (CI vacío) → --maxWorkers=${VITEST_WEB_MAXWORKERS:-1} para que el recibo mida el código y no la carga"
  npx vitest run --maxWorkers="${VITEST_WEB_MAXWORKERS:-1}"
fi
npm run build
