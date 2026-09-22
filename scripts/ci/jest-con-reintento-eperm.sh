#!/usr/bin/env bash
# jest-con-reintento-eperm.sh — corre jest en el cwd y perdona UNA vez el EPERM de su caché.
#
# En Windows, con la caché de transformación fría, jest puede matar suites con EPERM antes de correr
# una sola aserción (ver jest-eperm-reintentable.mjs). Si el rojo es SÓLO eso, se re-corren esas suites
# una vez, ya con la caché caliente, y el exit final es el de ese re-run. Cualquier otro rojo —una
# aserción, un timeout, una suite que no carga por otra causa— sale tal cual, sin reintento.
# En Linux (Actions) el EPERM no ocurre: el camino es el de siempre.
#
# Uso (desde el directorio del paquete): bash scripts/ci/jest-con-reintento-eperm.sh [args de jest]
set -uo pipefail
CI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ruta nativa (C:/… en Windows): la leen jest y node, y MSYS no convierte lo que va detrás de `=`.
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
RES="$(cygpath -m "$TMP" 2>/dev/null || printf '%s' "$TMP")/jest-resultado.json"

rc=0
npx jest --json --outputFile="$RES" "$@" || rc=$?
[ "$rc" -eq 0 ] && exit 0

SUITES="$(node "$CI_DIR/jest-eperm-reintentable.mjs" "$RES")" || exit "$rc"

echo "⚠️  jest: el rojo es SÓLO el EPERM de la caché de transformación (Windows, caché fría)."
echo "   Re-corro UNA vez, con la caché ya caliente, estas suites:"
printf '     %s\n' $SUITES
mapfile -t suites <<< "$SUITES"
npx jest --runTestsByPath "${suites[@]}"
