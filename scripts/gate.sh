#!/usr/bin/env bash
# scripts/gate.sh — el gate propio (ADR-001, paso 3). Corre LOS MISMOS scripts/ci/*.sh que GitHub
# Actions, repartidos por dónde pueden correr: core/web/mobile/lint en esta máquina (node/npm ya
# están, no necesitan Postgres); backend en el VPS (regla 2 del proyecto: la PC no tiene
# `temporalio`/`psycopg2`).
#
# Escribe un recibo atado al SHA que se está gateando (`.ci-recibos/<sha>.json`, paso 4). Sin esto,
# "la suite dio verde" es un texto que alguien transcribe; con esto es un archivo que el SCRIPT
# escribió, no quien reporta -- un merge cita el recibo del SHA que mergea.
#
# Uso: bash scripts/gate.sh              # los 5 jobs
#      bash scripts/gate.sh backend      # sólo uno
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
RECIBO_DIR="$ROOT/.ci-recibos"
mkdir -p "$RECIBO_DIR"

SOLO="${1:-}"
JOBS_LOCAL=(core web mobile lint)
declare -A RESULTADO
INICIO_TOTAL=$(date +%s)

correr() {
  local job="$1"; shift
  local inicio
  inicio=$(date +%s)
  echo "==> [$job] corriendo..."
  if "$@"; then RESULTADO[$job]="ok"; else RESULTADO[$job]="failed"; fi
  echo "==> [$job] ${RESULTADO[$job]} ($(( $(date +%s) - inicio ))s)"
}

for job in "${JOBS_LOCAL[@]}"; do
  [ -n "$SOLO" ] && [ "$SOLO" != "$job" ] && continue
  correr "$job" bash "$ROOT/scripts/ci/$job.sh"
done

if [ -z "$SOLO" ] || [ "$SOLO" = "backend" ]; then
  echo "==> [backend] provisionando Postgres efímero en el VPS..."
  if EXPORTS="$(bash "$ROOT/deploy/copiloto/test-db.sh" --export 2>&1)"; then
    eval "$(echo "$EXPORTS" | grep '^export ')"
    correr backend bash "$ROOT/deploy/copiloto/sync-test-backend.sh"
  else
    echo "$EXPORTS" >&2
    RESULTADO[backend]="failed"
  fi
fi

DURACION=$(( $(date +%s) - INICIO_TOTAL ))

# --- recibo, atado al SHA, escrito por ESTE script (paso 4) -----------------------------------
JOBS_JSON="{"; primero=1; TODO_OK=1
for job in "${!RESULTADO[@]}"; do
  [ "$primero" -eq 0 ] && JOBS_JSON+=","
  JOBS_JSON+="\"$job\":\"${RESULTADO[$job]}\""
  primero=0
  [ "${RESULTADO[$job]}" != "ok" ] && TODO_OK=0
done
JOBS_JSON+="}"

cat > "$RECIBO_DIR/$SHA.json" <<EOF
{"sha":"$SHA","fecha":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","jobs":$JOBS_JSON,"host":"$(hostname)","duracion_seg":$DURACION}
EOF
echo "==> recibo: $RECIBO_DIR/$SHA.json"
cat "$RECIBO_DIR/$SHA.json"; echo

if [ "$TODO_OK" -eq 1 ]; then
  echo "==> ✅ TODOS los jobs OK"
  exit 0
else
  echo "==> ❌ al menos un job falló -- ver arriba"
  exit 1
fi
