#!/usr/bin/env bash
# scripts/deploy-con-durabilidad.sh — BL-B1 (E3+Parte B): deploy real de backend. Desde Parte B
# la prueba de durabilidad corre POR DEFAULT en deploy.sh (opt-out UC_SKIP_DURABILIDAD=1) -- este
# script sigue siendo el atajo: switch a origin/main en el worktree de deploy aislado + salida
# COMPLETA a archivo, para no tener que acordarse de redirigir el log a mano.
# Uso: bash scripts/deploy-con-durabilidad.sh [salida.txt]
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_WT="${UC_DEPLOY_WT:-C:/gfw-src/wt-deploy}"
OUT="${1:-$ROOT/_evidencia/$(date +%F)/BL-B1/durabilidad.txt}"
mkdir -p "$(dirname "$OUT")"
{
  echo "# durabilidad E3 (default, Parte B) · $(date -u +%FT%TZ)"
  git -C "$DEPLOY_WT" fetch -q origin && git -C "$DEPLOY_WT" switch -q --detach origin/main
  echo "# deploy desde $(git -C "$DEPLOY_WT" rev-parse HEAD)"
  ( cd "$DEPLOY_WT" && UC_ENV_E2E_PATH="$ROOT/.env.e2e" bash deploy/copiloto/deploy.sh ); echo "# deploy.sh rc=$?"
} > "$OUT" 2>&1
echo "salida: $OUT"; tail -5 "$OUT"
