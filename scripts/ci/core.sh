#!/usr/bin/env bash
# Job "core" de .github/workflows/tests.yml, portado tal cual para correr fuera de GitHub
# (contrato CI-PROPIO, 2026-08-06). tests.yml pasa a invocar este script.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT"
npm install --no-audit --no-fund

cd "$ROOT/packages/core"
npx tsc --noEmit
npx vitest run
