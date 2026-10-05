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
# Los casos 6-11 (rollup vacío) y 12-14 (mergeable) están documentados en su propio bloque, más
# abajo, cada uno con el incidente que lo puso ahí.
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
# ⚠️ A DIFERENCIA de los casos 1-3 y 5, este stub DISCRIMINA por argumentos. Desde 2026-09-30 el
# script hace una consulta mas (`--json mergeable,mergeStateStatus`) antes de decir VERDE, y este
# es el unico de los casos 1-5 que llega hasta ahi: los otros salen por ROJO antes. Un stub que
# contestara el rollup a TODO le daria a `estado_de_merge` un array JSON en vez de
# «MERGEABLE/CLEAN», y el caso 4 saldria exit 2 por el stub, no por el script.
cat > "$T/bin/gh" <<'STUB'
#!/usr/bin/env bash
case "$*" in
  *mergeable*) echo 'MERGEABLE/CLEAN' ;;
  *) echo '[{"name":"backend","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"core","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"web","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"mobile","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"lint","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"drift","conclusion":"SUCCESS","status":"COMPLETED"}]' ;;
esac
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

# ══════════════════════════════════════════════════════════════════════════════════════════════
# CASOS 6-11 (2026-09-30): el rollup VACÍO no es «no hay medición»
#
# Caso real: PR #739. El commit tenía los 6 check-runs, todos verdes, y `statusCheckRollup`
# devolvía length 0 — pasa con los runs de `workflow_dispatch`, que es justo lo que `tests.yml`
# documenta como «la única forma real de re-pedir la corrida». El gate declaraba ROJO con exit 1,
# indistinguible de un job fallado, y mandaba a buscar un bug que no existía.
#
# Los seis casos cubren las dos direcciones, el desempate y la no-regresión:
#   6. rollup vacío + check-runs VERDES        → VERDE, exit 0   (el caso #739)
#   7. rollup vacío + un check-run FAILURE     → ROJO,  exit 1   ← CONTROL POSITIVO del fallback
#   8. rollup vacío + check-runs vacíos        → ROJO,  exit 2   (SIN MEDIR, no «rojo»)
#   9. re-run: failure VIEJO + success NUEVO   → VERDE, exit 0
#  10. re-run: success VIEJO + failure NUEVO   → ROJO,  exit 1
#  11. rollup POBLADO ⇒ el fallback no se toca → VERDE, exit 0
#
# El 7 es el que impide que el fallback sea un interruptor de apagado del gate: un camino que
# sólo supiera absolver es peor que no tenerlo. El par 9/10 prueba que se desempata por
# `started_at` y no por el orden en que la API devuelve los elementos — en los dos casos la lista
# viene ordenada EN CONTRA del resultado esperado, así que un script que tomara «el primero» o
# «el último» sin ordenar falla en uno de los dos. Con un solo caso, la mitad de los órdenes pasa
# por suerte.

# Stub de `gh` que distingue las tres consultas que hace el script. Un stub que contestara lo
# mismo a todo mediría el rollup y el fallback a la vez, y no se sabría cuál de los dos respondió.
#
# ⚠️ ASIMETRÍA DELIBERADA, y es la razón por la que estos casos sirven de algo. Para `check-runs`
# el stub **aplica de verdad el `--jq`** que le pasa el script, con `jq` real sobre el JSON crudo;
# para el rollup sigue devolviendo el array ya filtrado, como los casos 1-5.
# Por qué: todo lo que puede mentir en el fallback vive DENTRO de ese filtro —normalizar el
# alfabeto de la API REST y desempatar los re-runs por `started_at`—. Un stub que devolviera la
# respuesta ya procesada probaría el stub, no el script: la primera versión de estos casos hacía
# exactamente eso y los casos 7 y 10 salían ROJO **por la causa equivocada** (el fallback no
# tomaba efecto y todo caía en «no está en el rollup»), verdes de casualidad. Los cazaron las
# aserciones extra que exigen nombrar el job fallado y citar la fuente.
stub_gh() {   # stub_gh <rollup-ya-filtrado> <check_runs-crudo> [mergeable;mergeable-2da]
  # El 3er argumento admite VARIAS respuestas separadas por `;`, una por consulta
  # sucesiva: es lo que permite ejercitar la REPREGUNTA de `estado_de_merge` (caso 14).
  # Con un solo valor y sin `;`, `cut` devuelve la linea entera en cualquier -f, o sea
  # que el mismo valor se repite -- que es justo lo que quieren los casos 6-11.
  # Default MERGEABLE/CLEAN: los casos 6, 9 y 11 esperan VERDE y no hablan de merge.
  echo 1 > "$T/mergeable.n"   # contador: cuantas veces se consulto mergeable
  {
    echo '#!/usr/bin/env bash'
    echo 'case "$*" in'
    printf "  *statusCheckRollup*) echo '%s' ;;\n" "$1"
    echo "  *headRefOid*)        echo '3c418082aaaabbbbccccddddeeeeffff00001111' ;;"
    echo "  *headRefName*)       echo 'una/rama' ;;"
    echo '  *check-runs*)'
    printf "    CRUDO='%s'\n" "$2"
    echo '    filtro=""; prev=""'
    echo '    for a in "$@"; do [ "$prev" = "--jq" ] && filtro="$a"; prev="$a"; done'
    echo '    if [ -n "$filtro" ]; then printf %s "$CRUDO" | jq -r "$filtro"; else printf %s "$CRUDO"; fi'
    echo '    ;;'
    echo '  *mergeable*)'
    printf "    RESP='%s'\n" "${3:-MERGEABLE/CLEAN}"
    echo '    n="$(cat "'"$T"'/mergeable.n" 2>/dev/null || echo 1)"'
    echo '    echo $((n+1)) > "'"$T"'/mergeable.n"'
    echo '    printf %s "$RESP" | cut -d";" -f"$n"'
    echo '    ;;'
    echo "  *)                   echo '[]' ;;"
    echo 'esac'
  } > "$T/bin/gh"
  chmod +x "$T/bin/gh"
}

# Un check-run como lo devuelve la API REST: minúscula y con `started_at`. Es el alfabeto que el
# script tiene que normalizar; sin normalizar, el caso 6 daría ROJO con todo verde.
cr() {  # cr <nombre> <conclusion> <hora>
  printf '{"name":"%s","conclusion":"%s","status":"completed","started_at":"2026-09-30T%s:00:00Z"}' "$1" "$2" "$3"
}
CR_OK5="$(cr core success 02),$(cr web success 02),$(cr mobile success 02),$(cr lint success 02),$(cr drift success 02)"

stub_gh '[]' "{\"check_runs\":[$(cr backend success 02),$CR_OK5]}"
out6="$T/6.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 739 > "$out6" 2>&1
verificar "6 rollup vacío + check-runs verdes" VERDE 0 "$?" "$out6"
grep -q "check-runs del commit" "$out6" || mal "6 no dijo por qué camino midió — el veredicto no es auditable"

# Caso 7: el MISMO camino, con un job fallado. Sin este caso, un fallback que devolviera VERDE
# siempre pasaría el caso 6 y apagaría el gate en silencio.
stub_gh '[]' "{\"check_runs\":[$(cr backend failure 02),$CR_OK5]}"
out7="$T/7.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 739 > "$out7" 2>&1
verificar "7 rollup vacío + un FAILURE (control positivo)" ROJO 1 "$?" "$out7"
grep -q "backend: FAILURE" "$out7" || mal "7 no nombró el job fallado: el fallback absuelve sin discriminar"

# Caso 8: no hay medición en ninguna de las dos fuentes. Antes salía por exit 1 = «está rojo».
stub_gh '[]' '{"check_runs":[]}'
out8="$T/8.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 739 > "$out8" 2>&1
verificar "8 las dos fuentes vacías (SIN MEDIR)" ROJO 2 "$?" "$out8"
grep -q "SIN MEDIR" "$out8" || mal "8 no distinguió sin-medir de rojo en el texto que se lee"
grep -q "workflow run tests.yml" "$out8" || mal "8 no imprimió el comando que lo resuelve"

# Caso 9: re-run. El `failure` es VIEJO y el `success` NUEVO ⇒ verde. La lista trae el success
# PRIMERO, así que tomar «el último» sin ordenar daría el failure y este caso fallaría.
stub_gh '[]' "{\"check_runs\":[$(cr backend success 03),$(cr backend failure 01),$CR_OK5]}"
out9="$T/9.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 739 > "$out9" 2>&1
verificar "9 re-run: failure viejo, success nuevo" VERDE 0 "$?" "$out9"

# Caso 10: el espejo, con el orden de la lista INVERTIDO respecto del 9. Tomar «el primero» sin
# ordenar acertaría en uno y fallaría en el otro: sólo ordenar por `started_at` pasa los dos.
stub_gh '[]' "{\"check_runs\":[$(cr backend failure 03),$(cr backend success 01),$CR_OK5]}"
out10="$T/10.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 739 > "$out10" 2>&1
verificar "10 re-run: success viejo, failure nuevo (espejo del 9)" ROJO 1 "$?" "$out10"

# Caso 11: NO-REGRESIÓN — con el rollup poblado, el fallback no se consulta. Si se consultara
# igual, un check-run viejo del commit podría pisar la medición vigente del PR. El stub devuelve
# rollup 6/6 verde y un check-run FALLADO: sólo pasa si el fallback no se usó.
ROLLUP_OK='[{"name":"backend","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"core","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"web","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"mobile","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"lint","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"drift","conclusion":"SUCCESS","status":"COMPLETED"}]'
stub_gh "$ROLLUP_OK" "{\"check_runs\":[$(cr backend failure 09)]}"
out11="$T/11.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 739 > "$out11" 2>&1
verificar "11 rollup poblado: el fallback NO se consulta" VERDE 0 "$?" "$out11"
grep -q "rollup del PR" "$out11" || mal "11 no citó el rollup como fuente: el fallback se usó de más"

# ══════════════════════════════════════════════════════════════════════════════════════════════
# CASOS 12-14 (2026-09-30): «el CI está verde» NO es «se puede mergear»
#
# Caso real, medido por auditoría con DOS PR el mismo minuto: este script decía
# «VERDE — se puede mergear» mirando sólo los jobs del CI, y la frase salió idéntica sobre el
# PR #765 (`MERGEABLE`, se mergeó de verdad) y sobre el #760 (`CONFLICTING`/`DIRTY`, 5 archivos en
# conflicto). Una de las dos veces era mentira, y el lector no tenía cómo saber cuál.
#
# No era una medición mal hecha: era OTRA pregunta contestada con las palabras de ésta — el modo
# de falla más difícil de ver, porque el instrumento devuelve exactamente la frase que uno
# necesita oír. Fail-open en el TEXTO: inofensivo mientras GitHub rechace el merge por su lado, y
# nada inofensivo con `--admin`, que es lo que alguien prueba cuando un merge «verde» no entra.
#
#  12. CI verde + CONFLICTING  → ROJO, exit 4  ← el caso que fallaba abierto
#  13. CI verde + UNKNOWN 2×   → ROJO, exit 2  (no pude medir ≠ está rojo)
#  14. CI verde + UNKNOWN→OK   → VERDE, exit 0 ← CONTROL POSITIVO de la repregunta
#  15. CI verde + MERGEABLE/UNSTABLE → VERDE, exit 0  (estado real medido en el #760)
#
# El 14 es el que impide que la repregunta sea código muerto: GitHub calcula `mergeable` de forma
# asíncrona y contesta UNKNOWN en los primeros segundos de un PR recién abierto o actualizado. Sin
# repreguntar, el gate diría ROJO en un caso PERFECTAMENTE NORMAL — y un guard que grita en el caso
# normal se desarma solo (memoria/el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md). Y sin
# el 14, un `estado_de_merge` que nunca repreguntara pasaría el 12 y el 13 igual.
#
# Los tres afirman también CUÁNTAS veces se consultó, porque el número es lo único que distingue
# «repreguntó y obtuvo otra cosa» de «el stub devolvía eso desde el principio».

consultas_mergeable() { echo "$(( $(cat "$T/mergeable.n" 2>/dev/null || echo 1) - 1 ))"; }

# Caso 12: el CI está 6/6 verde y el PR tiene conflictos. Dice ROJO (no un tercer token: el
# invariante {VERDE, ROJO} tiene que aguantar) y exit 4, que NO se funde con el 1 («mirá tu
# código») ni con el 2 («no pude medir»): la acción que destraba es resolver el merge.
stub_gh "$ROLLUP_OK" '{"check_runs":[]}' 'CONFLICTING/DIRTY'
out12="$T/12.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 760 > "$out12" 2>&1
verificar "12 CI verde + CONFLICTING" ROJO 4 "$?" "$out12"
grep -q "CONFLICTOS" "$out12" || mal "12 no nombró el conflicto: manda a buscar un bug que no existe"
[ "$(consultas_mergeable)" = 1 ] || mal "12 consultó mergeable $(consultas_mergeable) veces: con una respuesta definitiva no se repregunta"

# Caso 13: GitHub no informa ni a la segunda. Es «no pude medir» (exit 2), el mismo cubo que `gh`
# ausente y que el rollup ilegible — no un rojo del PR.
stub_gh "$ROLLUP_OK" '{"check_runs":[]}' 'UNKNOWN/UNKNOWN;UNKNOWN/UNKNOWN'
out13="$T/13.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 760 > "$out13" 2>&1
verificar "13 CI verde + UNKNOWN persistente" ROJO 2 "$?" "$out13"
grep -q "SIN MEDIR" "$out13" || mal "13 no distinguió sin-medir de rojo en el texto que se lee"
[ "$(consultas_mergeable)" = 2 ] || mal "13 consultó mergeable $(consultas_mergeable) veces, esperaba 2 (la repregunta no ocurrió)"

# Caso 14: UNKNOWN la primera vez, MERGEABLE la segunda — el caso NORMAL de un PR recién abierto.
# Sin la repregunta esto sería ROJO y el gate frenaría merges legítimos hasta que alguien aprenda
# a ignorarlo. La aserción del contador es la que prueba que el verde salió de la SEGUNDA consulta.
stub_gh "$ROLLUP_OK" '{"check_runs":[]}' 'UNKNOWN/UNKNOWN;MERGEABLE/CLEAN'
out14="$T/14.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 760 > "$out14" 2>&1
verificar "14 CI verde + UNKNOWN que se resuelve (control positivo)" VERDE 0 "$?" "$out14"
[ "$(consultas_mergeable)" = 2 ] || mal "14 consultó mergeable $(consultas_mergeable) veces: el verde no vino de la repregunta"

# Caso 15: `MERGEABLE/UNSTABLE` — el estado REAL del PR #760 medido el 2026-09-30 12:5x, después
# de que su rama se pushara. `UNSTABLE` NO significa «no se puede mergear»: significa que hay algún
# check no exitoso que la branch protection no exige. Quién decide es `mergeable`, y `ci-verde.sh`
# ya midió los 6 jobs por su cuenta unas líneas antes. El caso existe porque el `case` discrimina
# con el glob `MERGEABLE/*` y un futuro refactor a igualdad exacta contra `MERGEABLE/CLEAN`
# rechazaría este PR real sin que ningún otro caso se pusiera rojo.
stub_gh "$ROLLUP_OK" '{"check_runs":[]}' 'MERGEABLE/UNSTABLE'
out15="$T/15.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 760 > "$out15" 2>&1
verificar "15 CI verde + MERGEABLE/UNSTABLE (estado real del #760)" VERDE 0 "$?" "$out15"

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }

