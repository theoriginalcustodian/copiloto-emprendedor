#!/usr/bin/env bash
# scripts/run-smoke-prod.sh — BL-Q2: smoke E2E de BETA contra prod, salida COMPLETA a archivo.
# Envía deploy/copiloto/smoke_beta_e2e.py al VPS y lo corre con el venv y los env de prod
# (tenant sintético smoke-<rand>@beta.local, con cleanup propio). Lanzar en segundo plano.
# Uso: bash scripts/run-smoke-prod.sh [salida.txt]     (default _evidencia/<fecha>/BL-Q2/smoke.txt)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
OUT="${1:-$ROOT/_evidencia/$(date +%F)/BL-Q2/smoke.txt}"
mkdir -p "$(dirname "$OUT")"
{
  echo "# smoke beta e2e · sha=$(git -C "$ROOT" rev-parse HEAD) · $(date -u +%FT%TZ) · host=$HOST"
  ssh "$HOST" 'set -a; . /etc/unreal-copilot/copiloto.env; . /etc/unreal-copilot/fusion-pg.env; . /etc/unreal-copilot/fusion-supabase.env; set +a; /opt/uc-copiloto-venv/bin/python -' < "$ROOT/deploy/copiloto/smoke_beta_e2e.py"
  echo "# exit=$?"
} > "$OUT" 2>&1
rc=$(grep -o '^# exit=[0-9]*' "$OUT" | tail -1 | cut -d= -f2)
echo "smoke rc=${rc:-?} · $(grep -c '^\[PASS\]' "$OUT") PASS · $(grep -c '^\[FAIL\]' "$OUT") FAIL · $OUT"
exit "${rc:-1}"
