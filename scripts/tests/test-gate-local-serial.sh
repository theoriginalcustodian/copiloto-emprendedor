#!/usr/bin/env bash
# test-gate-local-serial.sh — dos gates lanzados a la vez NO se solapan; un candado huérfano no traba.
#
#   1. SERIALIZA  — dos corridas simultáneas de un gate falso de 3 s: los intervalos no se pisan.
#   2. RC         — el rc del gate se propaga (un gate rojo sigue rojo detrás del wrapper).
#   3. HUÉRFANO   — un candado con un pid muerto se libera y se toma (control: no espera el TTL).
#   4. LIBERA     — al terminar, el candado no queda.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
W="$SCRIPT_DIR/../gate-local-serial.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

export GATE_LOCAL_LOCK="$TMP/gate-local.lock" GATE_LOCAL_POLL=1 GATE_LOCAL_WAIT=60
cat > "$TMP/gate-falso.sh" <<'EOF'
echo "inicio $(date +%s%N)" >> "$LOG"; sleep 3; echo "fin $(date +%s%N)" >> "$LOG"; exit "${RC:-0}"
EOF

echo "1) serializa"
export LOG="$TMP/log"; : > "$LOG"
GATE_LOCAL_CMD="bash $TMP/gate-falso.sh" bash "$W" >/dev/null 2>&1 &
GATE_LOCAL_CMD="bash $TMP/gate-falso.sh" bash "$W" >/dev/null 2>&1 &
wait
# Orden esperado: inicio, fin, inicio, fin. Si se solapan: inicio, inicio, fin, fin.
orden="$(cut -d' ' -f1 "$LOG" | tr '\n' ' ')"
if [ "$orden" = "inicio fin inicio fin " ]; then ok "sin solapamiento ($orden)"; else fail "se solaparon: $orden"; fi

echo "2) rc"
GATE_LOCAL_CMD="bash $TMP/gate-falso.sh" RC=3 bash "$W" >/dev/null 2>&1; rc=$?
[ "$rc" -eq 3 ] && ok "rc=3 propagado" || fail "rc esperado 3, dio $rc"

echo "3) huérfano"
mkdir "$GATE_LOCAL_LOCK"; echo "999999 wt-muerto" > "$GATE_LOCAL_LOCK/owner"
t0=$(date +%s)
out="$(GATE_LOCAL_TTL=3600 GATE_LOCAL_CMD="true" bash "$W" 2>&1)"; rc=$?
dur=$(( $(date +%s) - t0 ))
if [ "$rc" -eq 0 ] && grep -q "huérfano" <<<"$out" && [ "$dur" -lt 10 ]; then ok "liberado en ${dur}s"; else fail "rc=$rc dur=${dur}s: $out"; fi

echo "4) libera"
[ ! -e "$GATE_LOCAL_LOCK" ] && ok "sin candado al terminar" || fail "quedó el candado"

echo
if [ "$fallos" -eq 0 ]; then echo "test-gate-local-serial: 4/4 ✅"; exit 0; fi
echo "test-gate-local-serial: $fallos fallo(s) ❌"; exit 1
