#!/usr/bin/env bash
# scripts/deploy-con-durabilidad.sh — BL-B1 (E3): deploy real de backend CON la prueba de durabilidad.
# --armar (turno 1 en vuelo) -> deploy.sh desde wt-deploy (reinicia el worker) -> --verificar (el turno 1
# llegó y la MISMA sesión sigue viva). Salida COMPLETA a archivo; lanzar en segundo plano.
# Uso: bash scripts/deploy-con-durabilidad.sh [salida.txt]
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_WT="${UC_DEPLOY_WT:-C:/gfw-src/wt-deploy}"
OUT="${1:-$ROOT/_evidencia/$(date +%F)/BL-B1/durabilidad.txt}"
mkdir -p "$(dirname "$OUT")"
{
  echo "# durabilidad E3 · $(date -u +%FT%TZ) · deploy desde $(git -C "$DEPLOY_WT" rev-parse HEAD)"
  echo "## 1/3 --armar"; python "$ROOT/scripts/e2e_g6_durabilidad_worker_restart.py" --armar || { echo "# ARMAR FALLÓ"; exit 1; }
  echo "## 2/3 deploy.sh"; git -C "$DEPLOY_WT" fetch -q origin && git -C "$DEPLOY_WT" switch -q --detach origin/main
  ( cd "$DEPLOY_WT" && bash deploy/copiloto/deploy.sh ) || { echo "# DEPLOY FALLÓ"; exit 1; }
  echo "## 3/3 --verificar"; python "$ROOT/scripts/e2e_g6_durabilidad_worker_restart.py" --verificar; echo "# verificar rc=$?"
} > "$OUT" 2>&1
echo "salida: $OUT"; tail -3 "$OUT"
