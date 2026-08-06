#!/usr/bin/env bash
# Job "mobile" de .github/workflows/tests.yml, portado tal cual (contrato CI-PROPIO, 2026-08-06).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT"
npm install --no-audit --no-fund

cd "$ROOT/apps/mobile"
npx tsc --noEmit
npx jest
