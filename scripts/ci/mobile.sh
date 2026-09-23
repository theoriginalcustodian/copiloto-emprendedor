#!/usr/bin/env bash
# Job "mobile" de .github/workflows/tests.yml, portado tal cual (contrato CI-PROPIO, 2026-08-06).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Congelamiento nativo (plan §6, BL-B6): falla antes de pagar npm install si el PR toca package.json/app.json.
bash "$ROOT/scripts/ci/nativo-freeze.sh"

cd "$ROOT"
npm install --no-audit --no-fund

cd "$ROOT/apps/mobile"
npx tsc --noEmit
# jest, con un único reintento acotado al EPERM de su caché en Windows (2026-09-22: 60a6999a, b4c46a85).
bash "$ROOT/scripts/ci/jest-con-reintento-eperm.sh"
