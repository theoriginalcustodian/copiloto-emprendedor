#!/usr/bin/env bash
# test-nativo-freeze-evalua.sh — el guard del congelamiento nativo, y la razón por la que nunca
# bloqueó nada.
#
# 🔴 EL CASO (2026-10-05). `scripts/ci/nativo-freeze.sh` estaba cableado en `scripts/ci/mobile.sh`
# desde el plan §6 y **jamás evaluó en CI**: necesita `merge-base HEAD origin/main`, el
# `checkout@v4` del job no declaraba `fetch-depth: 0`, y con el clon superficial del default
# `origin/main` no existe -> el guard sale por su fail-open («⚠️ sin merge-base … guard NO
# evaluado», exit 0) y el job queda VERDE. Su excepción documentada era su único camino.
#
# Por eso este archivo prueba DOS cosas distintas, y la segunda es la que faltaba:
#   A. que el guard DECIDE bien cuando puede medir (y que su fail-open sigue siendo RUIDOSO).
#   B. que ningún job que necesita historia corre sobre un clon superficial — el invariante de la
#      CLASE, no del caso, vía `scripts/ci/fetch-depth-check.py`.
#
# El caso 2 es el que habría cazado el bug en el día 1: exige que la salida del guard, con base
# resoluble, **no** contenga «NO evaluado». Un exit 0 no distingue «miré y no hay cambios» de «no
# pude mirar»; sólo el texto los separa. Y el caso 8 es el control positivo del chequeo de la clase:
# sin él, un rc=0 podría significar que el chequeo no mira nada.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD_REAL="$ROOT/scripts/ci/nativo-freeze.sh"
CHECK="$ROOT/scripts/ci/fetch-depth-check.py"
WF="$ROOT/.github/workflows/tests.yml"
[ -f "$GUARD_REAL" ] || { echo "no existe $GUARD_REAL"; exit 1; }
[ -f "$CHECK" ]      || { echo "no existe $CHECK"; exit 1; }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  OK   %s\n' "$1"; }
mal() { printf '  MAL  %s\n' "$1"; fallos=$((fallos+1)); }
check() { # check <desc> <esperado> <obtenido>
  if [ "$2" = "$3" ]; then ok "$1"; else mal "$1 — esperaba [$2], obtuve [$3]"; fi
}
echo "test-nativo-freeze-evalua"

# ══════════════════════════════════════════════════════════════════════════════════════════════
# A. El guard, sobre un repo FIXTURE. Se copia el script porque resuelve su ROOT desde su propia
#    ubicación (`dirname $BASH_SOURCE/../..`), no desde el cwd: corrido desde otro directorio
#    seguiría midiendo el repo real.
# ══════════════════════════════════════════════════════════════════════════════════════════════
R="$T/repo"
mkdir -p "$R/scripts/ci" "$R/apps/mobile"
cp "$GUARD_REAL" "$R/scripts/ci/nativo-freeze.sh"
GUARD="$R/scripts/ci/nativo-freeze.sh"
(
  cd "$R" || exit 1
  git init -q .
  git config user.email t@t.t; git config user.name t
  git config commit.gpgsign false
  printf '{"name":"m"}\n' > apps/mobile/package.json
  printf '{"expo":{}}\n'  > apps/mobile/app.json
  git add scripts/ci/nativo-freeze.sh apps/mobile/package.json apps/mobile/app.json
  git commit -q -m "base"
  git branch -f base-de-prueba HEAD
  git checkout -q -b rama
) || { echo "no pude armar el fixture"; exit 1; }

echo "-- A. el guard decide"
# Caso 1-2: base resoluble, sin cambios en los dos archivos vigilados.
sal="$(NATIVO_BASE_REF=base-de-prueba bash "$GUARD" 2>&1)"; rc=$?
check "1 sin cambios -> exit 0" "0" "$rc"
check "1 y lo dice (ok, sin cambios)" "si" \
  "$(printf '%s' "$sal" | grep -q 'ok (sin cambios' && echo si || echo no)"
# 🔴 EL CASO QUE FALTABA: exit 0 no distingue «miré» de «no pude mirar».
check "2 CONTROL: con base resoluble NO sale por el fail-open" "si" \
  "$(printf '%s' "$sal" | grep -q 'NO evaluado' && echo no || echo si)"

# Caso 3: cambia package.json sin aprobación -> bloquea.
( cd "$R" && printf '{"name":"m","dependencies":{"react-native-algo":"1.0.0"}}\n' > apps/mobile/package.json \
    && git add apps/mobile/package.json && git commit -q -m "sube dep nativa" )
sal3="$(NATIVO_BASE_REF=base-de-prueba bash "$GUARD" 2>&1)"; rc3=$?
check "3 cambio sin NATIVO-APROBADO -> exit 1" "1" "$rc3"
check "3 y NOMBRA el archivo (no un rojo mudo)" "si" \
  "$(printf '%s' "$sal3" | grep -q 'apps/mobile/package.json' && echo si || echo no)"

# Caso 4: la misma situación, aprobada por env.
sal4="$(NATIVO_BASE_REF=base-de-prueba NATIVO_APROBADO=contrato-de-prueba bash "$GUARD" 2>&1)"; rc4=$?
check "4 con NATIVO_APROBADO -> exit 0" "0" "$rc4"
check "4 y lo dice (permitido)" "si" \
  "$(printf '%s' "$sal4" | grep -q 'permitido' && echo si || echo no)"

# Caso 5: aprobada en el MENSAJE DE COMMIT del rango (el otro canal que el guard documenta).
( cd "$R" && printf '{"name":"m","dependencies":{"react-native-algo":"1.0.1"}}\n' > apps/mobile/package.json \
    && git add apps/mobile/package.json \
    && git commit -q -m "sube dep nativa

NATIVO-APROBADO: contrato-en-el-commit" )
sal5="$(NATIVO_BASE_REF=base-de-prueba bash "$GUARD" 2>&1)"; rc5=$?
check "5 aprobación en el mensaje de commit -> exit 0" "0" "$rc5"

# Caso 6: base NO resoluble. El fail-open es DELIBERADO y acá queda fijado: tiene que seguir
# saliendo 0 **y gritando**. Si alguien lo vuelve silencioso, este caso se pone rojo.
sal6="$(NATIVO_BASE_REF=origin/rama-que-no-existe bash "$GUARD" 2>&1)"; rc6=$?
check "6 sin base -> exit 0 (fail-open deliberado)" "0" "$rc6"
check "6 y el fail-open es RUIDOSO, no silencioso" "si" \
  "$(printf '%s' "$sal6" | grep -q 'guard NO evaluado' && echo si || echo no)"

# ══════════════════════════════════════════════════════════════════════════════════════════════
# B. La CLASE: ningún job que necesite historia sobre un clon superficial.
# ══════════════════════════════════════════════════════════════════════════════════════════════
echo "-- B. la clase (fetch-depth-check)"
python3 "$CHECK" --root "$ROOT" --workflow "$WF" > "$T/b7.txt" 2>&1; rc7=$?
check "7 el workflow del repo pasa" "0" "$rc7"
[ "$rc7" = "0" ] || sed 's/^/       /' "$T/b7.txt"

# Caso 8 — CONTROL POSITIVO, y es lo único que hace informativo al caso 7: se le saca el
# `fetch-depth: 0` AL JOB MOBILE y el chequeo tiene que denunciarlo. Sin esto, un rc=0 podría
# significar «no miró nada» (memoria/instrumento-que-no-mira-nunca-falla.md).
tr -d '\r' < "$WF" | awk '
  /^  [a-z][a-z0-9_-]*:$/ { enmobile = ($0 == "  mobile:") }
  enmobile && /fetch-depth: 0/ { next }
  { print }
' > "$T/sin-depth.yml"
check "8 el fixture realmente le saca la linea" "si" \
  "$([ "$(grep -c 'fetch-depth: 0' "$T/sin-depth.yml")" -lt "$(tr -d '\r' < "$WF" | grep -c 'fetch-depth: 0')" ] && echo si || echo no)"
python3 "$CHECK" --root "$ROOT" --workflow "$T/sin-depth.yml" > "$T/b8.txt" 2>&1; rc8=$?
check "8 CONTROL POSITIVO: sin fetch-depth -> rc 1" "1" "$rc8"
check "8 y nombra al job culpable" "si" \
  "$(grep -q 'mobile' "$T/b8.txt" && echo si || echo no)"
check "8 y nombra al script que necesita historia" "si" \
  "$(grep -q 'nativo-freeze.sh' "$T/b8.txt" && echo si || echo no)"

# Caso 9 — FAIL-CLOSED en su propio límite: el parseo es por regex y busca `fetch-depth` en el
# bloque del job, así que con DOS checkouts en un job el resultado dejaría de ser concluyente.
# Tiene que salir «no pude medir» (2), no un OK.
tr -d '\r' < "$WF" | awk '
  /^  [a-z][a-z0-9_-]*:$/ { enmobile = ($0 == "  mobile:") }
  { print }
  enmobile && /uses: actions\/checkout@/ && !vez { print; vez = 1 }
' > "$T/dos-checkouts.yml"
python3 "$CHECK" --root "$ROOT" --workflow "$T/dos-checkouts.yml" > "$T/b9.txt" 2>&1; rc9=$?
check "9 dos checkouts en un job -> 2 (no pude medir)" "2" "$rc9"
check "9 y lo dice" "si" "$(grep -q 'NO PUDE MEDIR' "$T/b9.txt" && echo si || echo no)"

# Caso 10 — el otro fail-closed: sin archivo no hay veredicto, y el silencio no es un OK.
python3 "$CHECK" --root "$ROOT" --workflow "$T/no-existe.yml" > "$T/b10.txt" 2>&1; rc10=$?
check "10 workflow ausente -> 2" "2" "$rc10"

echo
if [ "$fallos" = 0 ]; then
  echo "TODO VERDE -- el guard decide, su fail-open grita, y ningun job con historia corre superficial (10 casos)"
  exit 0
fi
echo "$fallos check(s) fallaron"
exit 1
