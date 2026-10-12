#!/usr/bin/env bash
# test-mi-buzon.sh — mi-buzon.sh tiene que ver los destinos COMPUESTOS, que son los que se perdieron.
#
# Caso real (2026-10-12): planificación filtraba su buzón a mano con `-a-planificacion_` y
# `-a-todos_`, y tenía 9 mensajes invisibles —uno un `urgente_` de 5 días— porque la convención
# también emite `-a-backend-y-planificacion_` y `-a-planificacion-backend-y-frontend2_`. Los dos
# globs no son una regla incompleta por descuido: un glob no tiene alternación de token.
#
#   1. CONTROL POSITIVO — compuesto de tres, el rol en el MEDIO        → aparece
#   2. CONTROL POSITIVO — compuesto de dos, el rol al FINAL            → aparece
#   3. CONTROL POSITIVO — `-a-todos_`                                  → aparece
#   4. CONTROL NEGATIVO — dirigido a OTRO rol                          → NO aparece
#   5. CONTROL NEGATIVO — lo que el PROPIO rol emitió                  → NO aparece
#   6. Herencia del broadcast de UI: `-a-frontend_` le llega a frontend1
#   7. CONTROL NEGATIVO — nombre fuera de convención                   → NO aparece (no se asume `todos`)
#   8. Orden por antigüedad: lo más viejo primero
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MI="$REPO_ROOT/scripts/mi-buzon.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
B="$TMP/coordinacion"; mkdir -p "$B/abierto"

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

# El mtime es el orden, así que cada fixture se fecha a propósito: sin eso el caso 8 pasaría por
# el orden en que el filesystem devolvió los nombres, no por la antigüedad.
msg() { : > "$B/abierto/$1"; touch -d "$(date -d "-$2 minutes" '+%Y-%m-%d %H:%M:%S')" "$B/abierto/$1"; }

msg "2026-10-07_hallazgo_auditoria-a-planificacion-backend-y-frontend2_tres.md"      300
msg "2026-10-07_hallazgo_auditoria-a-backend-y-planificacion_dos-al-final.md"        200
msg "2026-10-08_hallazgo_backend-a-todos_broadcast.md"                               100
msg "2026-10-08_hallazgo_auditoria-a-backend_ajeno.md"                                90
msg "2026-10-08_dato_planificacion-a-todos_lo-mio.md"                                 80
msg "2026-10-08_contrato_planificacion-a-frontend_broadcast-de-ui.md"                 70
msg "mensaje-sin-convencion.md"                                                       60
# Lo propio con destino COMPUESTO: el descarte sale de emisor_de_nombre(), que tiene que leer el
# emisor aunque el destinatario sean tres. Con un `case` por prefijo a mano este caso se cuela.
msg "2026-10-08_contrato_planificacion-a-backend-y-frontend2_mio-compuesto.md"          50

out="$(BUZON_DIR="$B" bash "$MI" planificacion)"; rc=$?
[ "$rc" -eq 0 ] || fail "exit $rc (esperaba 0)"

tiene() { printf '%s\n' "$out" | grep -q "$1"; }

echo "── compuestos y broadcast ──"
tiene "tres.md"        && ok "1. ve el compuesto de TRES con el rol en el medio" || fail "1. NO ve el compuesto de tres — es el caso que se perdió"
tiene "dos-al-final"   && ok "2. ve el compuesto de dos con el rol al final"     || fail "2. NO ve el compuesto de dos"
tiene "broadcast.md"   && ok "3. ve el -a-todos_"                                 || fail "3. NO ve el -a-todos_"

echo "── negativos: un filtro que dice SI a todo no es un filtro ──"
tiene "ajeno"              && fail "4. trajo un mensaje dirigido a OTRO rol"        || ok "4. descarta lo ajeno"
tiene "lo-mio"             && fail "5. trajo lo que el propio rol emitió (ruido)"   || ok "5. descarta lo que yo emití"
tiene "sin-convencion"     && fail "7. un nombre fuera de convención se asumió para mí" || ok "7. descarta el nombre fuera de convención"
tiene "mio-compuesto"      && fail "9. trajo lo PROPIO con destino compuesto (el descarte sólo ve el destino simple)" || ok "9. descarta lo propio aunque el destino sea compuesto"

echo "── herencia del broadcast de UI ──"
out_fe1="$(BUZON_DIR="$B" bash "$MI" frontend1)"
printf '%s\n' "$out_fe1" | grep -q "broadcast-de-ui" \
  && ok "6. -a-frontend_ le llega a frontend1" || fail "6. frontend1 no recibe el broadcast -a-frontend_"

echo "── orden ──"
primero="$(printf '%s\n' "$out" | head -1)"
case "$primero" in
  *tres.md) ok "8. lo más viejo primero (lo que lleva días sin leer es lo que urge)" ;;
  *)        fail "8. el primero fue '$primero', esperaba el más viejo (tres.md)" ;;
esac

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-mi-buzon: 10/10"
  exit 0
fi
echo "❌ test-mi-buzon: $fallos fallo(s)"
exit 1
