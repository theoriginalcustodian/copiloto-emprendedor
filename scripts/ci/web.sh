#!/usr/bin/env bash
# Job "web" de .github/workflows/tests.yml, portado tal cual (contrato CI-PROPIO, 2026-08-06).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# apps/copiloto-web NO está en los `workspaces` del root (sólo apps/mobile y packages/*):
# un install desde la raíz no trae sus dependencias (tests.yml:154-158).
cd "$ROOT/apps/copiloto-web"
npm install --no-audit --no-fund
npx tsc --noEmit
npx vitest run
npm run build
