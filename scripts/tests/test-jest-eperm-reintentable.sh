#!/usr/bin/env bash
# test-jest-eperm-reintentable.sh — el reintento de mobile.sh sólo perdona el EPERM de la caché de jest.
#
#   1. POSITIVO  una suite muerta por EPERM (open) de la caché, 0 aserciones rojas -> reintentable, con
#                la ruta relativa de la suite. Sin el 1, los negativos pasarían también si el
#                clasificador no perdonara nunca nada.
#   2. POSITIVO  variante `rename` en dos proyectos (mobile corre 2): una sola ruta, sin duplicar.
#   3. NEGATIVO  una aserción roja -> no se reintenta.
#   4. NEGATIVO  timeout de 30000 ms (el caso de FE1 del 2026-09-22 en PantallaSoporte): es una
#                aserción roja, puede ser un await colgado real -> no se reintenta.
#   5. NEGATIVO  EPERM de caché + una aserción roja en otra suite -> no se reintenta nada.
#   6. NEGATIVO  suite que no carga por otra causa (SyntaxError) -> no se reintenta.
#   7. NEGATIVO  EPERM que no es de la caché de jest -> no se reintenta.
#   8. NEGATIVO  ninguna suite roja -> no hay nada que reintentar.
#   9. NEGATIVO  JSON ilegible -> no se reintenta.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLASIF="$ROOT/scripts/ci/jest-eperm-reintentable.mjs"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-jest-eperm-reintentable"
command -v node >/dev/null || { echo "  ℹ️  sin node — no se puede ejercitar"; exit 1; }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
# En Windows jest escribe rutas nativas (C:/…) y MSYS convierte los argumentos /tmp/… que recibe
# node.exe, pero no el contenido del JSON: la raíz del fixture va en forma nativa para que las dos
# rutas hablen el mismo idioma, como en una corrida real.
RAIZ="$(cygpath -m "$T" 2>/dev/null || printf '%s' "$T")/apps/mobile"
EPERM_OPEN="  ● Test suite failed to run\n\n    jest: failed to read cache file: C:/w/apps/mobile/node_modules/.cache/jest/jest-transform-cache-b95c/ba/x\n    Failure message: EPERM: operation not permitted, open 'C:\\\\w\\\\apps\\\\mobile\\\\node_modules\\\\.cache\\\\jest\\\\jest-transform-cache-b95c\\\\ba\\\\x'"
EPERM_RENAME="  ● Test suite failed to run\n\n    EPERM: operation not permitted, rename '$RAIZ/node_modules/.cache/jest/jest-transform-cache-b95c/ba/x.tmp'"

suite() {  # suite <archivo> <status> <message> <assertion-status|->
  local asr='[]'
  [ "$4" != "-" ] && asr="[{\"status\":\"$4\",\"failureMessages\":[]}]"
  printf '{"name":"%s","status":"%s","message":"%s","assertionResults":%s}' "$RAIZ/$1" "$2" "$3" "$asr"
}
resultado() {  # resultado <archivo.json> <numFailedTests> <suite>...
  local f="$1" n="$2"; shift 2
  local IFS=,
  printf '{"numFailedTests":%s,"testResults":[%s]}' "$n" "$*" > "$f"
}
correr() { node "$CLASIF" "$1" "$RAIZ"; }

# 1
resultado "$T/1.json" 0 "$(suite src/a.test.tsx failed "$EPERM_OPEN" -)" "$(suite src/b.test.tsx passed '' passed)"
out="$(correr "$T/1.json")"; rc=$?
[ "$rc" -eq 0 ] && [ "$out" = "src/a.test.tsx" ] && ok "1 EPERM open de la caché -> reintenta src/a.test.tsx" \
  || fail "1 esperaba rc=0 y 'src/a.test.tsx', dio rc=$rc '$out'"

# 2
resultado "$T/2.json" 0 "$(suite src/c.test.tsx failed "$EPERM_RENAME" -)" "$(suite src/c.test.tsx failed "$EPERM_RENAME" -)"
out="$(correr "$T/2.json")"; rc=$?
[ "$rc" -eq 0 ] && [ "$out" = "src/c.test.tsx" ] && ok "2 EPERM rename en 2 proyectos -> una sola ruta" \
  || fail "2 esperaba rc=0 y 'src/c.test.tsx', dio rc=$rc '$out'"

# 3
resultado "$T/3.json" 1 "$(suite src/d.test.tsx failed '  ● d › falla' failed)"
correr "$T/3.json" >/dev/null; rc=$?
[ "$rc" -eq 1 ] && ok "3 aserción roja -> no reintenta" || fail "3 aserción roja reintentable (rc=$rc)"

# 4
resultado "$T/4.json" 1 "$(suite src/modules/soporte/PantallaSoporte.test.tsx failed '  ● voz › deslizar\n\n    thrown: \"Exceeded timeout of 30000 ms for a test.' failed)"
correr "$T/4.json" >/dev/null; rc=$?
[ "$rc" -eq 1 ] && ok "4 timeout de 30000 ms -> no reintenta" || fail "4 timeout reintentable (rc=$rc)"

# 5
resultado "$T/5.json" 1 "$(suite src/a.test.tsx failed "$EPERM_OPEN" -)" "$(suite src/d.test.tsx failed '  ● d › falla' failed)"
correr "$T/5.json" >/dev/null; rc=$?
[ "$rc" -eq 1 ] && ok "5 EPERM + aserción roja -> no reintenta nada" || fail "5 mezcla reintentable (rc=$rc)"

# 6
resultado "$T/6.json" 0 "$(suite src/e.test.tsx failed '  ● Test suite failed to run\n\n    SyntaxError: Unexpected token' -)"
correr "$T/6.json" >/dev/null; rc=$?
[ "$rc" -eq 1 ] && ok "6 suite que no carga por SyntaxError -> no reintenta" || fail "6 SyntaxError reintentable (rc=$rc)"

# 7
resultado "$T/7.json" 0 "$(suite src/f.test.tsx failed "  ● Test suite failed to run\n\n    EPERM: operation not permitted, open 'C:\\\\\\\\w\\\\\\\\datos.db'" -)"
correr "$T/7.json" >/dev/null; rc=$?
[ "$rc" -eq 1 ] && ok "7 EPERM fuera de la caché de jest -> no reintenta" || fail "7 EPERM ajeno reintentable (rc=$rc)"

# 8
resultado "$T/8.json" 0 "$(suite src/b.test.tsx passed '' passed)"
correr "$T/8.json" >/dev/null; rc=$?
[ "$rc" -eq 1 ] && ok "8 sin suites rojas -> nada que reintentar" || fail "8 sin rojas dio rc=$rc"

# 9
echo 'no es json' > "$T/9.json"
correr "$T/9.json" >/dev/null 2>&1; rc=$?
[ "$rc" -eq 1 ] && ok "9 JSON ilegible -> no reintenta" || fail "9 JSON ilegible dio rc=$rc"

[ "$fallos" -eq 0 ] && echo "  OK" || { echo "  $fallos fallo(s)"; exit 1; }
