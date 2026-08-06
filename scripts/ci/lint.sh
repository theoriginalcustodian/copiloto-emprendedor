#!/usr/bin/env bash
# Job "lint" de .github/workflows/tests.yml, portado tal cual (contrato CI-PROPIO, 2026-08-06).
# Sólo los ERRORES rompen (mismo criterio que tests.yml): los avisos no bloquean.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT"
npm install --no-audit --no-fund
npx eslint packages/core/src apps/mobile/src apps/copiloto-web/src
