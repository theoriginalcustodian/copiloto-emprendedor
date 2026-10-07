#!/usr/bin/env bash
# El bucle de tests de coordinación salía VERDE con CERO tests corridos (fila `LINTDENOM`).
#
# POR QUÉ EXISTE (2026-10-06). `scripts/ci/lint.sh:44` corría `for t in "$ROOT"/scripts/tests/
# test-*.sh; do [ -e "$t" ] || continue; ...`. Si el glob no matchea, bash deja el PATRÓN LITERAL
# como único valor, el `[ -e ]` lo descarta, el bucle no itera y **lint sale verde**: los 58
# controles de coordinación dejan de existir sin un solo mensaje. Es la tercera aparición del mismo
# defecto en un día —`SMOKEDENOM` (smoke de la beta) y `CIVERDEDENOM` (gate de merges)—: un
# denominador que no se asere contra un esperado.
#
# ⚠️ EL CASO 1 ES EL ÚNICO QUE IMPORTA, y es el que antes era imposible de escribir: para llegar al
# bucle había que atravesar eslint + dos paridades + el medidor del índice. Por eso el bucle ahora
# es `scripts/ci/tests-coordinacion.sh`, parametrizado por $1 — el sujeto lo elige el ARGUMENTO, no
# dónde está el archivo (la trampa que `test-sabotaje-exit-cobertura.sh` dejó documentada).
#
#   1. POSITIVO  directorio VACÍO        -> exit 1 y dice «no miré», NO verde      <- el hallazgo
#   2. POSITIVO  directorio INEXISTENTE  -> exit 1 (mismo caso: glob sin match)
#   3. NEGATIVO  2 fixtures que pasan    -> exit 0 y el CONTROL dice «2 de 2»
#   4. POSITIVO  1 de 2 fixtures falla   -> exit 1 y corren LOS DOS (no aborta en el primero)
#
# El 3 es el que impide la lectura fácil: sin él, un script que devolviera 1 a todo pasaría los
# casos 1, 2 y 4 — el verde en el caso normal es lo que hace que los rojos midan algo.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUT="$ROOT/scripts/ci/tests-coordinacion.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  ✅ %s\n' "$1"; }
mal() { printf '  ❌ %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-lint-tests-coordinacion-denominador"

[ -f "$SUT" ] || { echo "  ❌ no existe $SUT — no mido nada"; exit 2; }

# --- Caso 1: directorio VACÍO -> el glob no matchea ------------------------------------------
mkdir -p "$T/vacio"
out="$T/o1"; bash "$SUT" "$T/vacio" >"$out" 2>&1; rc=$?
if [ "$rc" -eq 1 ] && grep -q "no miré" "$out"; then
  ok "1 directorio vacío -> exit 1 y nombra el defecto («no miré», no «no hay tests»)"
else
  mal "1 directorio vacío dio rc=$rc: $(tr '\n' '|' <"$out" | cut -c1-140)"
fi

# --- Caso 2: directorio INEXISTENTE ---------------------------------------------------------
out="$T/o2"; bash "$SUT" "$T/no-existe-ni-un-poco" >"$out" 2>&1; rc=$?
[ "$rc" -eq 1 ] && ok "2 directorio inexistente -> exit 1" \
               || mal "2 directorio inexistente dio rc=$rc (esperaba 1)"

# --- Caso 3: CONTROL NEGATIVO, dos fixtures que pasan ---------------------------------------
mkdir -p "$T/dos"
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/dos/test-uno.sh"
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/dos/test-dos.sh"
out="$T/o3"; bash "$SUT" "$T/dos" >"$out" 2>&1; rc=$?
if [ "$rc" -eq 0 ] && grep -q "2 de 2" "$out"; then
  ok "3 CONTROL: 2 fixtures verdes -> exit 0 y el recibo dice «2 de 2»"
else
  mal "3 dos fixtures verdes dio rc=$rc: $(tr '\n' '|' <"$out" | cut -c1-140)"
fi

# --- Caso 4: uno falla -> rojo, pero los DOS corrieron --------------------------------------
mkdir -p "$T/mixto"
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/mixto/test-pasa.sh"
printf '#!/usr/bin/env bash\nexit 1\n' > "$T/mixto/test-falla.sh"
out="$T/o4"; bash "$SUT" "$T/mixto" >"$out" 2>&1; rc=$?
if [ "$rc" -eq 1 ] && grep -q "2 de 2" "$out" && grep -q "1 fallado" "$out"; then
  ok "4 uno falla -> exit 1, y corrieron los DOS (no aborta en el primer rojo)"
else
  mal "4 mixto dio rc=$rc: $(tr '\n' '|' <"$out" | cut -c1-160)"
fi

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
