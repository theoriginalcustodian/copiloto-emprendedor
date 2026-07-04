#!/usr/bin/env bash
# deploy/copiloto/sync-test-backend.sh — dev-loop de backend del Copiloto cliente-web.
# Sincroniza el worktree (apps/copiloto + reference archetype + deploy/worker) a un STAGE aislado del
# VPS y corre pytest EN EL venv del VPS (la PC no tiene temporalio/fastmcp; regla del proyecto: los
# tests corren en el VPS). NO toca el deploy vivo ni el stage de la sesión de deploy.
#
# IDEMPOTENTE: rm -rf del stage + re-untar en cada corrida (sin stale files).
# Parametrizable (cero hardcoding): UC_DEPLOY_HOST, UC_TEST_STAGE, UC_VENV.
# Uso: bash deploy/copiloto/sync-test-backend.sh [args de pytest]   (default: "tests -q")
set -euo pipefail

HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
STAGE="${UC_TEST_STAGE:-/opt/uc-copiloto-cliente-stage}"
VENV="${UC_VENV:-/opt/uc-copiloto-venv}"
LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REF="deploy/skeleton_kit/archetypes/conversational_agent/reference"

if [ "$#" -gt 0 ]; then PYTEST_ARGS="$*"; else PYTEST_ARGS="tests -q"; fi

echo "==> sync worktree -> ${HOST}:${STAGE} (clean)"
tar -C "$LOCAL" -czf - apps/copiloto "$REF" deploy/worker \
  | ssh "$HOST" "rm -rf '$STAGE' && mkdir -p '$STAGE' && tar -C '$STAGE' -xzf -"

echo "==> pytest en el venv del VPS: ${PYTEST_ARGS}"
ssh "$HOST" "cd '$STAGE/apps/copiloto' && PYTHONPATH='$STAGE/apps/copiloto:$STAGE/$REF' '$VENV/bin/python' -m pytest ${PYTEST_ARGS}"
