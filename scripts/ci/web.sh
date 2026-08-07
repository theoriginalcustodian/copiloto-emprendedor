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
npx vitest run
npm run build
