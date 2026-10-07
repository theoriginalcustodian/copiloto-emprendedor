#!/usr/bin/env bash
# Control del guard del shell (deploy/copiloto/verifica-build-sha.sh). Controles positivos y negativos:
#   verde: html con el SHA exacto ⇒ rc=0
#   rojo : placeholder `unknown` (el bug de hoy) ⇒ rc≠0
#   rojo : SHA malformado (p. ej. `indeterminado`) ⇒ rc≠0
#   rojo : html con OTRO SHA ⇒ rc≠0
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$ROOT/deploy/copiloto/verifica-build-sha.sh"
SHA="0123456789abcdef0123456789abcdef01234567"
OTRO="fedcba9876543210fedcba9876543210fedcba98"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

html_con() { printf '<!doctype html>\n<html data-build-sha="%s" lang="es-AR">\n</html>\n' "$1" > "$TMP/$2.html"; }
html_con "$SHA" bueno
html_con unknown placeholder
html_con "$OTRO" otro

fallos=0
esperar() { # esperar <nombre> <rc_esperado> <cmd...>
  local nombre="$1" esperado="$2"; shift 2
  local rc=0
  "$@" >/dev/null 2>&1 || rc=$?
  if { [ "$esperado" = "0" ] && [ "$rc" -eq 0 ]; } || { [ "$esperado" != "0" ] && [ "$rc" -ne 0 ]; }; then
    echo "OK   $nombre (rc=$rc)"
  else
    echo "FAIL $nombre (rc=$rc, esperado=$esperado)"; fallos=$((fallos + 1))
  fi
}

esperar "verde: SHA exacto en el html" 0 bash "$GUARD" "$TMP/bueno.html" "$SHA"
esperar "rojo: placeholder unknown (el bug)" 1 bash "$GUARD" "$TMP/placeholder.html" "$SHA"
esperar "rojo: SHA malformado indeterminado" 1 bash "$GUARD" "$TMP/bueno.html" "indeterminado"
esperar "rojo: html con otro SHA" 1 bash "$GUARD" "$TMP/otro.html" "$SHA"

[ "$fallos" -eq 0 ] || { echo "FALLARON $fallos control(es)"; exit 1; }
echo "verifica-build-sha: 4/4 controles OK"
