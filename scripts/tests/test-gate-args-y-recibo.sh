#!/usr/bin/env bash
# test-gate-args-y-recibo.sh — A1 §4.1–4.2: `gate.sh` no puede dar verde por ausencia ni pisar su recibo.
#
#   NEGATIVO  arg que no es job (`--solo backend`, `backnd`) -> exit 2, sin recibo y sin correr jobs.
#   POSITIVO  un job válido corre, y `core` ok + `lint` failed en dos corridas del MISMO sha dejan AMBOS
#             en el recibo (acumula), con inicio<=fin y ruta de log que existe.
#   HISTORIAL un `failed` seguido de un `ok` del mismo job deja el failed en `historial`.
# Sin el positivo, el negativo pasaría también si gate.sh no corriera nada (la falla que se está arreglando).
# Usa stubs en un dir temporal (GATE_CI_DIR / GATE_RECIBO_DIR): no toca red, VPS ni el recibo real.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-gate-args-y-recibo"

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/ci"
for j in core web mobile lint; do printf '#!/usr/bin/env bash\necho stub-%s\nexit 0\n' "$j" > "$T/ci/$j.sh"; done
printf '#!/usr/bin/env bash\necho stub-lint-rojo\nexit "${STUB_LINT_RC:-1}"\n' > "$T/ci/lint.sh"
# `core` también tiene que poder fallar: el caso 5 mide que el ensanchado de TIPOCOMP cambia el
# VEREDICTO, no sólo la lista de jobs. Default 0 para no tocar los casos 2-3, que lo esperan verde.
printf '#!/usr/bin/env bash\necho stub-core\nexit "${STUB_CORE_RC:-0}"\n' > "$T/ci/core.sh"
# `GATE_BASE_REF` por default = HEAD (diff vacío) para que los casos 1-3 NO dependan de qué archivos
# toca el PR que corre esta suite: sin esto, cualquier PR que tocara `packages/core/src` activaría el
# ensanchado de TIPOCOMP y los pondría rojos por un motivo ajeno a su sujeto. Los casos 4-6 lo pisan
# a propósito. Es el mismo filo que el guard nuevo previene, aplicado a este archivo.
gate() { GATE_CI_DIR="$T/ci" GATE_RECIBO_DIR="$T/rec" UC_SESION=backend \
         GATE_BASE_REF="${GATE_BASE_REF:-$(git -C "$ROOT" rev-parse HEAD)}" \
         bash "$ROOT/scripts/gate.sh" "$@" >"$T/out.txt" 2>&1; }

# 1. NEGATIVO
for malo in "--solo" "backnd"; do
  rm -rf "$T/rec"
  gate "$malo" backend; rc=$?
  if [ "$rc" -eq 2 ] && ! ls "$T"/rec/*.json >/dev/null 2>&1 && ! grep -q "OK" "$T/out.txt"; then ok "arg inválido '$malo' -> exit 2, sin recibo, sin veredicto verde"
  else fail "arg inválido '$malo': rc=$rc (esperaba 2, sin recibo ni ✅)"; fi
done

# 2. POSITIVO: dos corridas parciales, mismo SHA
rm -rf "$T/rec"
STUB_LINT_RC=1 gate core lint; rc1=$?
[ "$rc1" -eq 1 ] && ok "corrida con lint rojo -> exit 1" || fail "corrida con lint rojo rc=$rc1 (esperaba 1)"
STUB_LINT_RC=0 gate core web; rc2=$?
[ "$rc2" -eq 0 ] && ok "segunda corrida (core web) -> exit 0" || fail "segunda corrida rc=$rc2 (esperaba 0)"
# El recibo se ubica por GLOB, no re-calculando HEAD: si HEAD se mueve entre la corrida y la lectura
# (otra sesión commiteando sobre el mismo repo, que acá es el caso normal) el nombre que se calcula ya
# no es el que gate.sh escribió. Y si aparecen DOS recibos, HEAD se movió ENTRE las dos corridas: el
# sujeto de este caso —acumular sobre el MISMO sha— no es medible, y eso se DICE en vez de fallar con
# un mensaje que acusa al recibo. Medido: me pasó en esta sesión, commiteando mientras corría la suite.
n_recibos="$(ls "$T"/rec/*.json 2>/dev/null | wc -l)"
R="$(ls "$T"/rec/*.json 2>/dev/null | head -1)"
if [ "$n_recibos" -gt 1 ]; then
  echo "  nota  HEAD se movió durante la corrida ($n_recibos recibos): acumulación por sha NO MEDIBLE acá"
else
jobs_presentes="$(jq -r '.jobs | keys | join(",")' "$R" 2>/dev/null)"
# Se pide CONTENENCIA, no igualdad exacta: desde TIPOCOMP el gate puede agregar jobs que nadie pidió
# (y eso es correcto), así que `keys == "core,lint,web"` medía de más — afirmaba también "no corrió
# nada más", que ya no es parte del sujeto de este caso. El sujeto es que el recibo ACUMULA.
faltan_jobs=""
for j in core lint web; do jq -e --arg j "$j" '.jobs[$j]' "$R" >/dev/null 2>&1 || faltan_jobs="$faltan_jobs $j"; done
[ -z "$faltan_jobs" ] && ok "el recibo acumula los 3 jobs de las 2 corridas ($jobs_presentes)" || fail "recibo NO acumuló, faltan:$faltan_jobs (jobs=[$jobs_presentes])"
[ "$(jq -r '.jobs.lint' "$R")" = "failed" ] && ok "lint sigue failed (la 2ª corrida no lo tapó)" || fail "lint no quedó failed"
n_core="$(jq '.detalle.core.historial | length' "$R")"
[ "$n_core" = "2" ] && ok "core tiene 2 entradas de historial (corrió en las dos)" || fail "historial de core = $n_core (esperaba 2)"
log="$(jq -r '.detalle.web.log' "$R")"
[ -f "$log" ] && ok "la ruta de log del job existe" || fail "log inexistente: $log"
jq -e '.detalle.web | (.inicio <= .fin) and (.inicio > 0)' "$R" >/dev/null && ok "inicio y fin registrados (inicio<=fin)" || fail "inicio/fin inválidos"

# 3. HISTORIAL: failed y luego ok del mismo job. Es una TERCERA corrida, así que su medibilidad se
#    re-chequea ACÁ y no arriba: si HEAD se movió recién ahora, este `gate lint` escribe un recibo
#    NUEVO y `$R` sigue apuntando al viejo — el historial se leería incompleto y el rojo culparía al
#    acumulador. La condición se mide en el punto de LECTURA, no una vez al principio.
STUB_LINT_RC=0 gate lint; rc3=$?
if [ "$(ls "$T"/rec/*.json 2>/dev/null | wc -l)" -gt 1 ]; then
  echo "  nota  HEAD se movió antes de la 3ª corrida: historial por sha NO MEDIBLE acá"
else
  [ "$(jq -r '.jobs.lint' "$R")" = "ok" ] && [ "$(jq -r '[.detalle.lint.historial[].resultado] | join(",")' "$R")" = "failed,ok" ] \
    && ok "lint failed->ok: el estado es ok pero el historial conserva el failed" || fail "historial de lint: $(jq -c '.detalle.lint.historial' "$R")"
fi
fi

# 4-6. TIPOCOMP: un subconjunto de jobs no mide un cambio en `packages/core/src`.
#   Fixture HONESTO: la base es el padre del último commit que tocó `packages/core/src` — hoy es
#   #751 (`fix(FACTID)`), o sea EL cambio que rompió los 7 fixtures hand-built de core/mobile/web y
#   salió verde en un gate de un solo paquete. No se simula la condición: se usa la que pasó.
#   `GATE_BASE_REF` parametriza SÓLO la base; el barrido es el `git diff` real de producción.
COMMIT_CORE="$(git -C "$ROOT" log --format=%H -1 -- packages/core/src)"
BASE_CORE="$(git -C "$ROOT" rev-parse "$COMMIT_CORE^" 2>/dev/null || true)"
if [ -z "$BASE_CORE" ] || [ -z "$(git -C "$ROOT" diff --name-only "$BASE_CORE" HEAD -- packages/core/src)" ]; then
  # Entorno vs hallazgo, que es la distinción que este repo ya pagó dos veces en un día: un clone
  # SHALLOW no tiene de dónde sacar el fixture, y ahí «no pude medir» es la respuesta correcta, no un
  # rojo. Pero en CI la historia está garantizada por `fetch-depth: 0` en el job `lint`, así que su
  # ausencia ahí SÍ es una regresión (alguien le sacó el fetch-depth) y tiene que doler.
  if [ -n "${CI:-}${GITHUB_ACTIONS:-}" ]; then
    fail "en CI y sin historia para el fixture de packages/core/src: ¿le sacaron 'fetch-depth: 0' al job lint? casos 4-6 NO MEDIDOS"
  else
    echo "  nota  clone sin historia de packages/core/src (¿shallow?): casos 4-6 NO MEDIDOS — no son verdes, no se midieron"
  fi
else
  # 4. POSITIVO: pido `web`, tienen que correr también core y mobile.
  rm -rf "$T/rec"
  GATE_BASE_REF="$BASE_CORE" gate web; rc4=$?
  # El recibo se ubica por GLOB, no re-calculando HEAD: `$T/rec` se limpia antes de cada caso, así
  # que hay exactamente uno. Re-calcular `rev-parse HEAD` lo buscaba por un nombre que puede haber
  # CAMBIADO entre la corrida y la lectura — con varias sesiones commiteando sobre el mismo repo eso
  # es el caso normal, y se veía como "NO ensanchó: jobs=[]", un rojo que acusa al código equivocado.
  # Medido: me pasó en esta misma sesión, commiteando mientras la suite corría.
  R4="$(ls "$T"/rec/*.json 2>/dev/null | head -1)"
  jobs4="$(jq -r '.jobs | keys | join(",")' "$R4" 2>/dev/null)"
  [ "$jobs4" = "core,mobile,web" ] && ok "cambio en packages/core/src: 'gate web' ensancha a core,mobile,web" \
    || fail "NO ensanchó: jobs=[$jobs4] (esperaba core,mobile,web)"
  grep -q 'ensancho la selección' "$T/out.txt" && ok "lo DICE en la salida (no ensancha en silencio)" \
    || fail "ensanchó sin avisar: la salida no nombra el motivo"
  [ "$rc4" -eq 0 ] && ok "con los tres stubs verdes -> exit 0" || fail "rc=$rc4 con stubs verdes (esperaba 0)"

  # 5. EL CONTROL QUE MANDA: el ensanchado cambia el VEREDICTO, no sólo la lista. `web` solo habría
  #    dado verde; con `core` rojo el gate tiene que dar ROJO aunque nadie pidió core. Sin este caso,
  #    el 4 pasaría igual con un ensanchado que corre los jobs y descarta su resultado.
  rm -rf "$T/rec"
  STUB_CORE_RC=1 GATE_BASE_REF="$BASE_CORE" gate web; rc5=$?
  [ "$rc5" -eq 1 ] && ok "core rojo hace ROJO un 'gate web' que solo habría sido verde" \
    || fail "rc=$rc5 con core rojo (esperaba 1): el ensanchado corre pero no cuenta"

  # 6. NEGATIVO: sin cambios en packages/core/src NO se ensancha — el guard callado en el caso normal.
  if [ -n "$(git -C "$ROOT" status --porcelain -- packages/core/src)" ]; then
    echo "  nota  este worktree tiene sucio en packages/core/src: caso 6 no medible acá (se omite, no se afirma verde)"
  else
    rm -rf "$T/rec"
    GATE_BASE_REF="$(git -C "$ROOT" rev-parse HEAD)" gate web; rc6=$?
    jobs6="$(jq -r '.jobs | keys | join(",")' "$(ls "$T"/rec/*.json 2>/dev/null | head -1)" 2>/dev/null)"
    [ "$jobs6" = "web" ] && ok "sin cambios en core: 'gate web' corre SÓLO web (no ensancha de más)" \
      || fail "ensanchó sin motivo: jobs=[$jobs6] (esperaba web)"
    grep -q 'ensancho la selección' "$T/out.txt" && fail "gritó en el caso normal: avisó de ensanchado sin cambios en core" \
      || ok "callado en el caso normal (sin aviso)"
  fi
fi

[ "$fallos" -eq 0 ] && { echo "OK"; exit 0; } || { echo "FALLÓ ($fallos)"; exit 1; }
