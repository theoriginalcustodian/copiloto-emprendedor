#!/usr/bin/env bash
# test-jest-con-reintento-eperm.sh — el cableado del reintento, con un `npx` falso en el PATH.
#
# El `npx` falso emula a jest: en la 1.ª llamada escribe el JSON del escenario en `--outputFile` y sale
# con el código del escenario; en la 2.ª (`--runTestsByPath`) anota qué suites recibió y sale con el
# código de re-run. Cuenta las llamadas para probar que nunca hay una tercera.
#
#   1. POSITIVO  EPERM de caché -> 2 llamadas, la 2.ª con la suite; exit 0 si el re-run pasa.
#                Sin el 1, los negativos pasarían también si el script no reintentara nunca.
#   2. NEGATIVO  EPERM de caché pero el re-run falla -> exit ≠ 0, y no hay 3.ª llamada.
#   3. NEGATIVO  aserción roja -> exit del jest original, 1 sola llamada.
#   4. VERDE     jest verde -> exit 0, 1 sola llamada, sin aviso de reintento.
#   5. mobile.sh invoca este script (no `npx jest` directo): si se revierte el cableado, rojo.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/scripts/ci/jest-con-reintento-eperm.sh"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-jest-con-reintento-eperm"
command -v node >/dev/null || { echo "  ℹ️  sin node — no se puede ejercitar"; exit 1; }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
PKG="$(cygpath -m "$T" 2>/dev/null || printf '%s' "$T")/pkg"; mkdir -p "$T/pkg" "$T/bin"

cat > "$T/bin/npx" <<'NPX'
#!/usr/bin/env bash
n=$(( $(cat "$ESC/llamadas" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$ESC/llamadas"
if [ "$n" -eq 1 ]; then
  for a in "$@"; do case "$a" in --outputFile=*) cp "$ESC/resultado.json" "${a#--outputFile=}";; esac; done
  exit "$(cat "$ESC/rc1")"
fi
printf '%s\n' "$@" > "$ESC/args$n"
exit "$(cat "$ESC/rc2")"
NPX
chmod +x "$T/bin/npx"

EPERM='  ● Test suite failed to run\n\n    EPERM: operation not permitted, open '"'"'C:/w/node_modules/.cache/jest/jest-transform-cache-b95c/ba/x'"'"''
escenario() {  # escenario <dir> <status> <message> <assertion-status|-> <numFailedTests> <rc1> <rc2>
  local d="$1" asr='[]'; mkdir -p "$d"; rm -f "$d/llamadas" "$d"/args*
  [ "$4" != "-" ] && asr="[{\"status\":\"$4\"}]"
  printf '{"numFailedTests":%s,"testResults":[{"name":"%s/src/a.test.tsx","status":"%s","message":"%s","assertionResults":%s}]}' \
    "$5" "$PKG" "$2" "$3" "$asr" > "$d/resultado.json"
  echo "$6" > "$d/rc1"; echo "$7" > "$d/rc2"
}
correr() { (cd "$T/pkg" && ESC="$1" PATH="$T/bin:$PATH" bash "$SCRIPT") > "$1/out" 2>&1; }

# 1
E="$T/e1"; escenario "$E" failed "$EPERM" - 0 1 0
correr "$E"; rc=$?
[ "$rc" -eq 0 ] && [ "$(cat "$E/llamadas")" = 2 ] && grep -qx 'src/a.test.tsx' "$E/args2" && grep -qx -- '--runTestsByPath' "$E/args2" \
  && ok "1 EPERM -> re-run de src/a.test.tsx con --runTestsByPath, exit 0" \
  || fail "1 rc=$rc llamadas=$(cat "$E/llamadas" 2>/dev/null) args2=$(tr '\n' ' ' < "$E/args2" 2>/dev/null)"

# 2
E="$T/e2"; escenario "$E" failed "$EPERM" - 0 1 1
correr "$E"; rc=$?
[ "$rc" -ne 0 ] && [ "$(cat "$E/llamadas")" = 2 ] && ok "2 EPERM + re-run rojo -> exit $rc, sin 3.ª llamada" \
  || fail "2 rc=$rc llamadas=$(cat "$E/llamadas" 2>/dev/null)"

# 3
E="$T/e3"; escenario "$E" failed '  ● a › falla' failed 1 1 0
correr "$E"; rc=$?
[ "$rc" -eq 1 ] && [ "$(cat "$E/llamadas")" = 1 ] && ok "3 aserción roja -> exit 1, sin reintento" \
  || fail "3 rc=$rc llamadas=$(cat "$E/llamadas" 2>/dev/null)"

# 4
E="$T/e4"; escenario "$E" passed '' passed 0 0 0
correr "$E"; rc=$?
[ "$rc" -eq 0 ] && [ "$(cat "$E/llamadas")" = 1 ] && ! grep -q 'Re-corro' "$E/out" && ok "4 verde -> exit 0, 1 llamada, sin aviso" \
  || fail "4 rc=$rc llamadas=$(cat "$E/llamadas" 2>/dev/null)"

# 5
grep -q 'scripts/ci/jest-con-reintento-eperm.sh' "$ROOT/scripts/ci/mobile.sh" && ! grep -qE '^[[:space:]]*npx jest' "$ROOT/scripts/ci/mobile.sh" \
  && ok "5 mobile.sh corre jest a través del reintento acotado" || fail "5 mobile.sh no usa jest-con-reintento-eperm.sh"

[ "$fallos" -eq 0 ] && echo "  OK" || { echo "  $fallos fallo(s)"; exit 1; }
