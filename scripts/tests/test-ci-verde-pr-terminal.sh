#!/usr/bin/env bash
# test-ci-verde-pr-terminal.sh — un PR ya MERGED/CLOSED mandaba a reintentar PARA SIEMPRE.
#
# Por qué existe (`H-CIVERDEMERGED`, lo cazó AUDITORÍA el 2026-10-08 y refutó el cierre que
# planificación propuso). Un PR **ya mergeado** devuelve `mergeable: UNKNOWN` **y**
# `mergeStateStatus: UNKNOWN` — medido sobre #975, #976 y #977 —, así que caía en el comodín `*)`
# del `case` de `ci-verde.sh` y salía `exit 2 · «volvé a correrlo»` con los **6 jobs en SUCCESS**.
# Ese consejo es **inalcanzable**: el estado de un PR mergeado no vuelve a cambiar. Medido en vivo:
# ~11 corridas gastadas sobre un PR que ya estaba MERGED.
#
# 🔴 LA CAUSA RAÍZ, y es la razón de que este test exista y no sólo el fix: **`UNKNOWN` tiene dos
# causas opuestas** — «todavía no se calculó» (asíncrono, esperar SIRVE) y «ya no aplica» (terminal,
# esperar es PARA SIEMPRE). El `case` no podía distinguirlas porque **nunca miró `.state`**: 0
# menciones de `MERGED` en sus 391 líneas. El comodín estaba bien escrito para lo que creía cubrir.
#
# ⚠️ Y POR QUÉ NO ALCANZABA CON LOS 3 TESTS QUE YA HABÍA: los tres daban VERDE **sin ejercitar la
# guarda**. El stub (`scripts/lib/gh-stub.sh`) contesta `--json state` con **`OPEN` por default**,
# así que la rama nueva nunca se tocaba, y el `2>/dev/null` de la llamada en producción silencia
# incluso el rc=64 con que el stub delata un campo no declarado. Una guarda sin control positivo es
# indistinguible de una guarda ausente (`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`).
#
#   1. POSITIVO  state=MERGED  → exit 6, dice «ya está MERGED», y NO manda a reintentar
#   2. POSITIVO  state=CLOSED  → exit 6
#   3. NEGATIVO  state=OPEN + rollup 6 verdes + MERGEABLE/CLEAN → exit 0 (el fix NO rompe el camino normal)
#   4. CANARIO   en el caso MERGED, el stub NO recibe `statusCheckRollup` ⇒ la guarda corre ANTES de medir
#   5. INVARIANTE las salidas terminales imprimen ROJO y NUNCA la palabra VERDE
#
# ✅ CONTROL POSITIVO DE ESTE TEST, corrido el 2026-10-08 — porque un test que pasa a la primera no
# prueba que mire nada. Copié `scripts/` a un temp, borré las 11 líneas de la guarda (controles: 0
# menciones de `json state`, el rollup intacto, `bash -n` OK) y corrí este mismo archivo:
# **11 de las 14 aserciones cayeron**. Para repetirlo:
#   MUT=$(mktemp -d); cp -r scripts "$MUT/scripts"; sed -i '183,193d' "$MUT/scripts/ci-verde.sh"
#   bash "$MUT/scripts/tests/$(basename "$0")"      # tiene que dar ROJO
#
# 🔴 Y LO QUE ESA CORRIDA ME CORRIGIÓ, que es el motivo de dejarlo escrito: sin la guarda, el caso
# MERGED **no** sale por `exit 2` como yo venía contando — sale **`VERDE — se puede mergear`**
# (`VERDE=1 ROJO=0`, rc=0) sobre un PR ya mergeado. En producción daba rc=2 sólo porque el
# `mergeable` real de un PR mergeado es `UNKNOWN`; con el rollup y el merge sanos, el mismo hueco
# **autoriza a mergear lo ya mergeado**. El defecto era peor que su síntoma, y lo midió la mutación.
#
# ⚠️ 2 de las 14 aserciones NO discriminan solas: «no manda a reintentar» pasa igual sin la guarda,
# porque la salida VERDE tampoco contiene esa frase. Quedan porque fijan la redacción del fix, pero
# **no las cuentes como cobertura**: las que distinguen son el rc, el invariante y el canario.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  ✅ %s\n' "$1"; }
mal() { printf '  ❌ %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-ci-verde-pr-terminal"

# shellcheck source=../lib/gh-stub.sh
. "$ROOT/scripts/lib/gh-stub.sh"
fabricar_gh_stub "$T/bin"

ROLLUP_6_VERDES='[{"name":"backend","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"core","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"web","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"mobile","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"lint","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"drift","conclusion":"SUCCESS","status":"COMPLETED"}]'

# El rollup se declara VERDE y MERGEABLE/CLEAN **a propósito** en los casos terminales: así el test
# prueba que el veredicto sale por el `state`, y no porque algo del CI estuviera rojo. Si la guarda
# no existiera, estos dos casos darían `exit 0` VERDE — que es el peor resultado posible.
# ─────────────────────────────────────────────────────────────────────────────────────────────
# Casos 1 y 2: los dos estados TERMINALES
# ─────────────────────────────────────────────────────────────────────────────────────────────
for caso in "MERGED|ya está MERGED" "CLOSED|CLOSED sin mergear"; do
  st="${caso%%|*}"; pat="${caso##*|}"
  out="$T/out-$st.txt"; log="$T/log-$st.txt"
  PATH="$T/bin:$PATH" GH_STUB_STATE="$st" GH_STUB_LOG="$log" \
    GH_STUB_ROLLUP="$ROLLUP_6_VERDES" GH_STUB_MERGEABLE=MERGEABLE GH_STUB_MERGESTATE=CLEAN \
    bash "$ROOT/scripts/ci-verde.sh" 999 > "$out" 2>&1
  rc=$?

  if [ "$rc" -eq 6 ]; then ok "$st -> exit 6 (terminal)"
  else mal "$st dio rc=$rc (esperaba 6): $(tr '\n' '|' < "$out" | cut -c1-140)"; fi

  if grep -q "$pat" "$out"; then ok "$st -> el mensaje nombra el estado"
  else mal "$st no dijo «$pat»: $(tr '\n' '|' < "$out" | cut -c1-140)"; fi

  # No puede mandar a reintentar: ése era EL defecto, no un detalle de redacción.
  if grep -qiE 'volv[eé] a correrlo|volvelo a correr' "$out"; then
    mal "$st SIGUE mandando a reintentar — el bucle no se cerró"
  else ok "$st -> no manda a reintentar"; fi

  # Invariante {VERDE, ROJO}: exactamente uno, y en un terminal tiene que ser ROJO (fail-closed).
  # «No hay nada que mergear» NO es permiso para mergear.
  v=$(grep -cw VERDE "$out"); r=$(grep -cw ROJO "$out")
  if [ "$v" -eq 0 ] && [ "$r" -ge 1 ]; then ok "$st -> ROJO, sin la palabra VERDE (fail-closed)"
  else mal "$st rompió el invariante: VERDE=$v ROJO=$r"; fi

  # ── CANARIO (caso 4): la guarda tiene que correr ANTES de medir el CI ──────────────────────
  # Sin esto, el test pasaría igual con la guarda puesta DESPUÉS del rollup, y entonces cada
  # corrida sobre un PR terminal seguiría gastando las llamadas que el fix vino a evitar.
  # Se mide sobre el LOG del stub (lo que el script REALMENTE le pidió), no sobre la salida.
  if [ -f "$log" ]; then
    if grep -q 'statusCheckRollup' "$log"; then
      mal "$st CANARIO: el script pidió el rollup — la guarda corre DESPUÉS de medir"
    else
      ok "$st -> CANARIO: no pidió el rollup (la guarda corre antes)"
    fi
    # Control de ceguera del canario: si el log estuviera vacío, el grep de arriba diría «no pidió»
    # por la razón equivocada. El script SÍ tiene que haber consultado algo: el `state`.
    if grep -q -- '--json state' "$log"; then ok "$st -> control de ceguera: el log registró la consulta de state"
    else mal "$st CANARIO CIEGO: el log no tiene «--json state» ⇒ no mide lo que creo"; fi
  else
    mal "$st: el stub no escribió log ⇒ el canario no midió nada"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────────────────────
# Caso 3 (NEGATIVO): un PR OPEN y sano sigue dando VERDE. El fix no puede cerrar el camino normal.
# ─────────────────────────────────────────────────────────────────────────────────────────────
out="$T/out-open.txt"
PATH="$T/bin:$PATH" GH_STUB_STATE=OPEN GH_STUB_ROLLUP="$ROLLUP_6_VERDES" \
  GH_STUB_MERGEABLE=MERGEABLE GH_STUB_MERGESTATE=CLEAN \
  bash "$ROOT/scripts/ci-verde.sh" 999 > "$out" 2>&1
rc=$?
if [ "$rc" -eq 0 ] && grep -qw VERDE "$out"; then
  ok "OPEN + 6 verdes + MERGEABLE/CLEAN -> exit 0 VERDE (camino normal intacto)"
else
  mal "el camino normal se rompió: rc=$rc · $(tr '\n' '|' < "$out" | cut -c1-160)"
fi

# Control de que el caso 3 discrimina de verdad: con el MISMO rollup verde pero state MERGED, el
# resultado tiene que ser DISTINTO. Si los dos dieran lo mismo, el test no estaría midiendo `state`.
PATH="$T/bin:$PATH" GH_STUB_STATE=MERGED GH_STUB_ROLLUP="$ROLLUP_6_VERDES" \
  GH_STUB_MERGEABLE=MERGEABLE GH_STUB_MERGESTATE=CLEAN \
  bash "$ROOT/scripts/ci-verde.sh" 999 > "$T/out-dif.txt" 2>&1
rc_m=$?
if [ "$rc_m" -ne "$rc" ]; then ok "DIFERENCIAL: mismo rollup, distinto state -> distinto veredicto ($rc vs $rc_m)"
else mal "DIFERENCIAL: OPEN y MERGED dieron el MISMO rc=$rc ⇒ el test no mide el state"; fi

echo
if [ "$fallos" -eq 0 ]; then echo "VERDE — test-ci-verde-pr-terminal: todo OK"; exit 0
else echo "ROJO — test-ci-verde-pr-terminal: $fallos fallo(s)"; exit 1; fi
