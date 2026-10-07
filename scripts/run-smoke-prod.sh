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
# SMOKESTDIN (2026-10-07, hallazgo auditoría): `smoke_beta_e2e.py` importa a su hermano
# `meclaves_check.py` (MECLAVESRUNTIME). Antes se canalizaba TODO por stdin (`python -`), y con
# stdin `sys.path[0]` es el CWD del login ssh, no el directorio del script — el import de un
# hermano no resuelve nunca por ese camino (`ModuleNotFoundError`, smoke entero caído antes del
# primer check). Fix: mandar los DOS archivos a un tmpdir remoto y correr como ARCHIVO desde ahí
# (el código sigue siendo el LOCAL, no el desplegado). El SET DECLARADO (CLAVES_ME) en cambio
# apunta por default al árbol DESPLEGADO vía UC_ME_CONTRATO_PATH: el rojo tiene que significar
# "el backend desplegado no cumple su propia declaración", no "prod está atrás de main local".
REMOTE_REPO="${UC_DEPLOY_PATH:-/opt/uc-repos/copiloto}"
TMPDIR_REMOTO="$(ssh "$HOST" 'mktemp -d')" || { echo "ABORT [run-smoke-prod]: no pude crear tmpdir remoto." >&2; exit 1; }
scp -q "$ROOT/deploy/copiloto/smoke_beta_e2e.py" "$ROOT/deploy/copiloto/meclaves_check.py" "$HOST:$TMPDIR_REMOTO/" \
  || { echo "ABORT [run-smoke-prod]: scp de smoke_beta_e2e.py/meclaves_check.py falló." >&2; ssh "$HOST" "rm -rf '$TMPDIR_REMOTO'" 2>/dev/null; exit 1; }
{
  echo "# smoke beta e2e · sha=$(git -C "$ROOT" rev-parse HEAD) · $(date -u +%FT%TZ) · host=$HOST · tmpdir_remoto=$TMPDIR_REMOTO"
  ssh "$HOST" "set -a; . /etc/unreal-copilot/copiloto.env; . /etc/unreal-copilot/fusion-pg.env; . /etc/unreal-copilot/fusion-supabase.env; set +a; export UC_ME_CONTRATO_PATH='$REMOTE_REPO/apps/copiloto/me_contrato.py'; cd '$TMPDIR_REMOTO' && /opt/uc-copiloto-venv/bin/python smoke_beta_e2e.py; rc=\$?; rm -rf '$TMPDIR_REMOTO'; exit \$rc"
  echo "# exit=$?"
} > "$OUT" 2>&1
rc=$(grep -o '^# exit=[0-9]*' "$OUT" | tail -1 | cut -d= -f2)
echo "smoke rc=${rc:-?} · $(grep -c '^\[PASS\]' "$OUT") PASS · $(grep -c '^\[FAIL\]' "$OUT") FAIL · $OUT"

# Sello en el manifiesto del VPS (SMOKEFRESCURA §3.bis): sólo en verde, y para el sha que está VIVO
# según /healthz (no el HEAD local: el smoke prueba lo desplegado). Append-only, como el sello de
# deploy: se verifica por efecto (tail -1), y si no se confirma el script falla RUIDOSO.
if [ "${rc:-1}" = "0" ]; then
  REMOTE="${UC_DEPLOY_PATH:-/opt/uc-repos/copiloto}"
  SMOKE_BASE_VIVO="${SMOKE_BASE:-http://127.0.0.1:8099}"
  sha_vivo="$(ssh "$HOST" "curl -sf '$SMOKE_BASE_VIVO/healthz'" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("sha") or "")' 2>/dev/null || true)"
  if [ -z "$sha_vivo" ] || [ "$sha_vivo" = "unknown" ]; then
    echo "🔴 smoke VERDE pero sin sha vivo en /healthz: no se estampa smoke_beta (el manifiesto queda PENDIENTE)" >&2
    exit 1
  fi
  if ssh "$HOST" "grep -q '\"smoke_beta\":\"OK ${sha_vivo} ' '$REMOTE/DEPLOY-MANIFEST.json'" 2>/dev/null; then
    echo "smoke_beta ya estaba OK para $sha_vivo (no se duplica)"
  else
    linea="$(printf '{"evento":"smoke_beta","sha":"%s","smoke_beta":"OK %s %s","fuente":"run-smoke-prod.sh"}' \
      "$sha_vivo" "$sha_vivo" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')")"
    printf '%s\n' "$linea" | ssh "$HOST" "cat >> '$REMOTE/DEPLOY-MANIFEST.json'" || true
    verif="$(ssh "$HOST" "tail -1 '$REMOTE/DEPLOY-MANIFEST.json'" 2>/dev/null || true)"
    if [ "$verif" != "$linea" ]; then
      echo "🔴 smoke VERDE pero el sello smoke_beta NO quedó confirmado en $REMOTE/DEPLOY-MANIFEST.json" >&2
      exit 1
    fi
    echo "smoke_beta OK estampado para $sha_vivo"
  fi
fi
exit "${rc:-1}"
