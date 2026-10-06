#!/usr/bin/env bash
# Wrapper: el loop de scripts/ci/lint.sh sólo ejecuta scripts/tests/test-*.sh. El control del veredicto
# del smoke de la beta vive en Python (AST + httpx de mentira); acá sólo se invoca.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
python3 "$ROOT/scripts/test-smoke-veredicto.py"
