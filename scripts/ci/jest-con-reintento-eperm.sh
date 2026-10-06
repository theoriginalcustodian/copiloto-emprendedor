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

# Paralelismo acotado FUERA de CI (2026-10-06). Mismo motivo que `scripts/ci/web.sh`: en la PC el gate
# comparte CPU con las otras dos sesiones, y jest a N workers fabrica rojos por CONTENCIÓN, no por el
# código — un falso rojo que empuja al `--no-verify`, y acá eso apaga gitleaks en un repo público.
# Medido por FE1 sobre 59b902dd: a N workers el único rojo de mobile fue `TarjetaPresupuestoPropuesto`;
# con 1 worker la suite completa da rc=0 (111 passed + 1 skipped de 112, 1015 tests, 0 «aborted by
# cleanup»). ⚠️ Para mobile eso es UNA corrida: la contención es la HIPÓTESIS, no una causa probada —
# lo probado es que el cap da verde reproducible. En CI (Linux, runner dedicado) no se toca nada: ahí
# el paralelismo es la razón de que el job tarde minutos y no horas, y el rojo de CI sigue siendo real.
# Y va ACÁ, no en `mobile.sh`: el re-run del EPERM de abajo descarta los args del llamador, así que un
# cap puesto en el llamador se perdería justo en la re-corrida (el fix que llega a un solo call-site).
CAP=()
if [ -z "${CI:-}" ]; then
  CAP=(--maxWorkers="${JEST_MOBILE_MAXWORKERS:-1}")
  echo "[mobile] PC detectada (CI vacío) → ${CAP[*]}: el recibo mide el código, no la carga de la máquina"
fi

rc=0
npx jest --json --outputFile="$RES" ${CAP[@]+"${CAP[@]}"} "$@" || rc=$?
[ "$rc" -eq 0 ] && exit 0

SUITES="$(node "$CI_DIR/jest-eperm-reintentable.mjs" "$RES")" || exit "$rc"

echo "⚠️  jest: el rojo es SÓLO el EPERM de la caché de transformación (Windows, caché fría)."
echo "   Re-corro UNA vez, con la caché ya caliente, estas suites:"
printf '     %s\n' $SUITES
mapfile -t suites <<< "$SUITES"
npx jest --runTestsByPath ${CAP[@]+"${CAP[@]}"} "${suites[@]}"
