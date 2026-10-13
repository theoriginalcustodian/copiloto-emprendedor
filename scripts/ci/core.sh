#!/usr/bin/env bash
# Job "core" de .github/workflows/tests.yml, portado tal cual para correr fuera de GitHub
# (contrato CI-PROPIO, 2026-08-06). tests.yml pasa a invocar este script.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT"
npm install --no-audit --no-fund

cd "$ROOT/packages/core"
# Este `tsc` TIPA los tests (`*.test.ts`): el tsconfig dejó de excluirlos el 2026-10-13 tras medir 154
# errores de tipos ocultos (vitest transpila con esbuild y no tipa). Que siga mirándolos lo controla
# `scripts/tests/test-tsc-mira-los-tests.sh` (denominador + error inyectado). No re-agregar un `exclude`.
npx tsc --noEmit
npx vitest run
