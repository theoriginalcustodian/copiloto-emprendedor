#!/usr/bin/env bash
# test-escalador-cache-de-avance.sh — el cache de `avance_mas_reciente_epoch` tiene que CACHEAR.
#
# CAUSA RAÍZ (21/09): la función memoizaba en un array global, pero se la llamaba con `$(...)`,
# que corre en un subshell: el cache moría en cada llamada y cada archivo de en-curso/ re-escaneaba
# cerrado/ entero con un `stat` por archivo. Con 374 avances y 10 en-curso: ~30 s por corrida del
# escalador, y `vigilancia-check.sh` pasó los 120 s del timeout de los crones.
#
# Dos controles:
#  1. ESTRUCTURAL: la función no se llama nunca por sustitución de comando (el defecto en sí).
#  2. VOLUMEN: 300 avances de un frente × 8 contratos en en-curso/ termina en < 15 s y sin
#     medición fallida (la versión rota tarda ~2400 forks de `stat`).
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESCALADOR="${ESCALADOR:-$REPO_ROOT/scripts/escaladores-buzon.sh}"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-escalador-cache-de-avance"

echo "── 1. la función no se invoca por \$(...) ──"
if grep -nE '\$\([[:space:]]*avance_mas_reciente_epoch' "$ESCALADOR" >/dev/null; then
  fail "avance_mas_reciente_epoch se llama por sustitución: el cache muere en el subshell"
else ok "se llama en el shell actual (el cache sobrevive)"; fi

echo "── 2. volumen ──"
BUZON="$(mktemp -d)"; trap 'rm -rf "$BUZON"' EXIT
mkdir -p "$BUZON/abierto" "$BUZON/en-curso" "$BUZON/cerrado/2026-09-01"
hoy="$(date +%Y-%m-%d)"
for i in $(seq 1 300); do : > "$BUZON/cerrado/2026-09-01/2026-09-01_avance_frontend2-a-planificacion_n$i.md"; done
for i in $(seq 1 8); do printf 'x\n' > "$BUZON/en-curso/${hoy}_contrato_planificacion-a-frontend2_c$i.md"; done
ini=$(date +%s); sal="$(bash "$ESCALADOR" "$BUZON" 2>&1)"; fin=$(date +%s)
dur=$((fin - ini))
[ "$dur" -lt 15 ] && ok "300 avances × 8 contratos en ${dur}s" || fail "tardó ${dur}s (>= 15)"
grep -qi "medici.n.*fall\|fallida" <<< "$sal" && fail "medición fallida: $sal" || ok "sin medición fallida"

echo
[ "$fallos" -eq 0 ] && { echo "✅ test-escalador-cache-de-avance: OK"; exit 0; }
echo "❌ test-escalador-cache-de-avance: $fallos fallo(s)"; exit 1
