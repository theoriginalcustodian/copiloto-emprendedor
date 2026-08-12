#!/usr/bin/env bash
# Job "lint" de .github/workflows/tests.yml, portado tal cual (contrato CI-PROPIO, 2026-08-06).
# Sólo los ERRORES rompen (mismo criterio que tests.yml): los avisos no bloquean.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT"
npm install --no-audit --no-fund
npx eslint packages/core/src apps/mobile/src apps/copiloto-web/src

# Tests de los scripts de coordinación. Van en "lint" y no en "core" porque son bash puro: no
# necesitan DB, node ni el venv del VPS, y corren en segundos. Sin este bucle, `scripts/tests/`
# es letra muerta — un test que nadie ejecuta no es un control, es un archivo.
for t in "$ROOT"/scripts/tests/test-*.sh; do
  [ -e "$t" ] || continue
  echo "▶ $(basename "$t")"
  bash "$t"
done
