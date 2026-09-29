#!/usr/bin/env bash
# test-ci-verde-veredicto-monotono.sh — la salida de `ci-verde.sh` imprime SIEMPRE exactamente un
# veredicto: uno de {VERDE, ROJO}, nunca ninguno y nunca los dos.
#
# Por qué existe (2026-09-28, dos vueltas sobre el mismo defecto):
#
#   Vuelta 1. El veredicto positivo era SUBSTRING del negativo («VERDE» dentro de «NO VERDE»), así
#   que un consumidor que grepeara el token positivo en vez de usar el exit code daba TRUE sobre el
#   rechazo y mergeaba en rojo. Pasó de verdad: un loop de sesión mergeó el PR #693 con el CI
#   todavía corriendo, y salió verde por suerte. Fix: el rechazo dice ROJO.
#
#   Vuelta 2 — la que este test protege. Renombrar cerró la lectura por token POSITIVO y dejó
#   abierta la lectura por token NEGATIVO (`! grep ROJO` ⇒ asumo verde), porque había rutas MUDAS:
#   `gh` ausente y «falta el número de PR» imprimían un error SIN veredicto. Y `gh` ausente es la
#   ruta más probable en un entorno nuevo — la peor para fallar abierto. Un instrumento que no
#   imprime nada es indistinguible de uno que aprueba, para quien lee texto.
#
# Los 4 casos cubren las dos direcciones. Un control que sólo verificara el rechazo le prestaría
# credibilidad al camino verde sin mirarlo, y al revés (memoria/
# el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda.md):
#
#   1. gh AUSENTE (ruta muda histórica) → ROJO presente, VERDE ausente, exit 2
#   2. sin argumento (ruta muda histórica) → ROJO presente, VERDE ausente, exit 2 (no 1: falta de
#      argumento es «no pude medir», no «el PR está rojo»)
#   3. rollup con un job FAILURE → ROJO presente, VERDE ausente, exit 1
#   4. rollup 6/6 SUCCESS → VERDE presente, ROJO ausente, exit 0
#
# El veredicto de `ci-verde.sh` sigue siendo EL EXIT CODE. Este test no cambia eso: verifica que
# leer el texto mal no pueda fallar hacia el lado peligroso.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  ✅ %s\n' "$1"; }
mal() { printf '  ❌ %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-ci-verde-veredicto-monotono"

# Cuenta el token como PALABRA: `-w` evita que un futuro «NO-VERDE» en un mensaje cuente como
# VERDE, que es exactamente el modo de falla que este test protege.
tiene() { grep -cw "$1" "$2" 2>/dev/null | tr -d '\r\n'; }

# Comprueba el invariante de UNA corrida: exactamente un veredicto, y es el esperado.
verificar() {
  local nombre="$1" esperado="$2" rc_esperado="$3" rc="$4" out="$5"
  local v r
  v="$(tiene VERDE "$out")"; r="$(tiene ROJO "$out")"
  local presentes=0
  [ "$v" -gt 0 ] && presentes=$((presentes+1))
  [ "$r" -gt 0 ] && presentes=$((presentes+1))
  if [ "$presentes" -eq 0 ]; then
    mal "$nombre SALIDA MUDA — ni VERDE ni ROJO (rc=$rc): $(tr '\n' '|' < "$out" | cut -c1-140)"
    return
  fi
  if [ "$presentes" -eq 2 ]; then
    mal "$nombre imprimió LOS DOS veredictos (rc=$rc) — ambiguo para cualquier lector"
    return
  fi
  local obtenido=ROJO
  [ "$v" -gt 0 ] && obtenido=VERDE
  if [ "$obtenido" != "$esperado" ]; then
    mal "$nombre dijo $obtenido y se esperaba $esperado (rc=$rc)"
    return
  fi
  if [ "$rc" -ne "$rc_esperado" ]; then
    mal "$nombre dijo $obtenido (bien) pero rc=$rc y se esperaba $rc_esperado — el veredicto es el exit code"
    return
  fi
  ok "$nombre -> $obtenido único, rc=$rc"
}

# --- Casos 1 y 2: las rutas MUDAS históricas -------------------------------------------------
# PATH vacío + bash por ruta absoluta: el mismo molde que test-ci-verde-gh-presente.sh, que ya
# pagó dos intentos fallidos (GitHub runner reincluía gh vía /usr/bin; symlink de bash rompía en
# Git Bash por la resolución de msys-2.0.dll). No se reinventa.
BASH_BIN="$(command -v bash)"
if PATH="" command -v gh >/dev/null 2>&1; then
  echo "  ❌ gh sigue visible con PATH vacío — el aislamiento no tomó, no mido nada"; exit 2
fi

out="$T/1.txt"
PATH="" "$BASH_BIN" "$ROOT/scripts/ci-verde.sh" 999 > "$out" 2>&1
verificar "1 gh ausente" ROJO 2 "$?" "$out"

# Para el caso 2 `gh` tiene que estar presente: el guard de gh corre ANTES que la validación del
# argumento, así que sin stub este caso mediría el caso 1 otra vez.
mkdir -p "$T/bin"
cat > "$T/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo '[]'
STUB
chmod +x "$T/bin/gh"

out2="$T/2.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" > "$out2" 2>&1
verificar "2 sin argumento" ROJO 2 "$?" "$out2"

# --- Caso 3: rojo real (un job FAILURE) -------------------------------------------------------
cat > "$T/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo '[{"name":"backend","conclusion":"FAILURE","status":"COMPLETED"},{"name":"core","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"web","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"mobile","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"lint","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"drift","conclusion":"SUCCESS","status":"COMPLETED"}]'
STUB
out3="$T/3.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 999 > "$out3" 2>&1
verificar "3 un job FAILURE" ROJO 1 "$?" "$out3"

# --- Caso 4: verde real (la otra mitad del control) -------------------------------------------
cat > "$T/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo '[{"name":"backend","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"core","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"web","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"mobile","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"lint","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"drift","conclusion":"SUCCESS","status":"COMPLETED"}]'
STUB
out4="$T/4.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 999 > "$out4" 2>&1
verificar "4 rollup 6/6 SUCCESS" VERDE 0 "$?" "$out4"

# --- Caso 5: el rollup NO SE PUDO LEER — «no medí» ≠ «está rojo» -------------------------------
# `gh` existe y está autenticado, pero `gh pr view` falla (número inexistente, permiso, red). Esa
# ruta imprimía ROJO con rc=1, IDÉNTICO a un CI con jobs fallados: medido con `ci-verde.sh 999999`
# antes del fix. El veredicto de texto estaba bien (ROJO, fail-closed); lo que mentía era el CÓDIGO,
# que es lo que un script consumidor lee para decidir si reintentar, avisar o mirar el CI.
# Es el mismo molde que los casos 1 y 2, que ya distinguían «no pude medir» con rc=2: esta ruta
# quedó afuera porque la guarda se escribió para las dos que habían dolido. Por eso el caso existe.
cat > "$T/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo "gh: Could not resolve to a PullRequest with the number of 999999." >&2
exit 1
STUB
out5="$T/5.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 999999 > "$out5" 2>&1
verificar "5 rollup ilegible (no medí)" ROJO 2 "$?" "$out5"

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
