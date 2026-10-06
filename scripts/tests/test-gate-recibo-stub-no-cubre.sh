#!/usr/bin/env bash
# Un recibo de corrida CON OVERRIDES DE TEST no puede cubrir un SHA (fila `GATERECIBOTEST`).
#
# POR QUÉ EXISTE (2026-10-06). `gate.sh` tenía escrito, en un comentario, que *«una corrida con
# overrides es un TEST (jobs stub): su recibo jamás va a la copia real»*. Medido: era cierto SÓLO de
# la copia durable. Con `GATE_CI_DIR` a secas —stubs `exit 0`, sin `GATE_RECIBO_DIR`— el recibo por
# SHA caía en el `.ci-recibos/` REAL, y `recibo-cubre.sh` busca justamente en el `.ci-recibos/` de
# TODOS los worktrees. O sea: un stub `exit 0` quedaba cubriendo un SHA que nadie probó, que es
# exactamente lo que el comentario decía que no podía pasar.
#
# 🔴 El daño no es el recibo falso: es que **el comentario desactiva la búsqueda**. Quien leyó esa
# línea —yo— dio la protección por hecha y no midió. Cuarta aparición del patrón en un día.
#
# La defensa ahora vive en DOS lugares, y hacen falta los dos:
#   (a) `gate.sh` desvía `RECIBO_DIR` a `.ci-recibos-stub/` cuando hay `GATE_CI_DIR` -> casos 1-2
#   (b) el recibo se estampa `stub:true` y `recibo-cubre.sh` lo DESCARTA -> casos 4-5
# (a) es un default y alguien puede apuntar `GATE_RECIBO_DIR` al dir real; (b) es el guard.
#
#   1. POSITIVO  sólo GATE_CI_DIR   -> el recibo NO cae en .ci-recibos/, cae en .ci-recibos-stub/
#   2. CONTROL   sin overrides      -> el recibo SÍ cae en .ci-recibos/   <- sin esto, un gate.sh
#                                      que no escribiera recibo ninguno pasaría el caso 1
#   3. POSITIVO  la estampa          -> stub=true con overrides, stub=false sin ellos
#   4. POSITIVO  recibo stub:true en el dir REAL -> recibo-cubre.sh lo RECHAZA (exit 1)
#   5. CONTROL   el MISMO recibo con stub:false  -> lo ACEPTA (exit 0)  <- sin esto, el 4 pasa con
#                                      un recibo-cubre.sh que rechace todo
#
# Todo corre en un repo TEMPORAL: este test no puede ensuciar el `.ci-recibos/` de nadie, que es
# justamente el defecto que mide.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  ✅ %s\n' "$1"; }
mal() { printf '  ❌ %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-gate-recibo-stub-no-cubre"

command -v jq >/dev/null || { echo "  ❌ falta jq — no mido nada"; exit 2; }

# --- repo temporal con gate.sh real y jobs stub ------------------------------------------------
R="$T/repo"; mkdir -p "$R/scripts/ci"
cp "$ROOT/scripts/gate.sh" "$ROOT/scripts/recibo-cubre.sh" "$R/scripts/"
for aux in sesion-env.sh candado-stage.sh; do
  [ -f "$ROOT/scripts/ci/$aux" ] && cp "$ROOT/scripts/ci/$aux" "$R/scripts/ci/"
done
printf '#!/usr/bin/env bash\nexit 0\n' > "$R/scripts/ci/core.sh"
printf '.ci-recibos/\n.ci-recibos-stub/\n' > "$R/.gitignore"
g() { git -C "$R" -c user.name=t -c user.email=t@t -c core.autocrlf=false "$@"; }
g init -q -b main && g add -A && g commit -qm base
SHA="$(g rev-parse HEAD)"

# --- Caso 1: sólo GATE_CI_DIR -> el recibo NO toca .ci-recibos/ --------------------------------
mkdir -p "$T/ci"; printf '#!/usr/bin/env bash\nexit 0\n' > "$T/ci/core.sh"
(cd "$R" && env -u GATE_RECIBO_DIR -u GATE_RECIBO_COMUN GATE_CI_DIR="$T/ci" UC_SESION=plan \
   bash scripts/gate.sh core) > "$T/o1" 2>&1
ESTAMPA_STUB="$(jq -r 'if has("stub") then .stub else "ausente" end' "$R/.ci-recibos-stub/$SHA.json" 2>/dev/null || echo sin-archivo)"
if [ ! -f "$R/.ci-recibos/$SHA.json" ] && [ -f "$R/.ci-recibos-stub/$SHA.json" ]; then
  ok "1 sólo GATE_CI_DIR -> recibo desviado a .ci-recibos-stub/, el real queda limpio"
else
  mal "1 real=$([ -f "$R/.ci-recibos/$SHA.json" ] && echo SÍ || echo no) stub=$([ -f "$R/.ci-recibos-stub/$SHA.json" ] && echo sí || echo NO) · $(tr '\n' '|' <"$T/o1" | cut -c1-160)"
fi

# --- Caso 2: CONTROL, sin overrides el recibo SÍ cae en el dir real ----------------------------
rm -rf "$R/.ci-recibos" "$R/.ci-recibos-stub"
(cd "$R" && env -u GATE_CI_DIR -u GATE_RECIBO_DIR -u GATE_RECIBO_COMUN UC_SESION=plan \
   bash scripts/gate.sh core) > "$T/o2" 2>&1
if [ -f "$R/.ci-recibos/$SHA.json" ]; then
  ok "2 CONTROL: sin overrides el recibo SÍ cae en .ci-recibos/ (el caso 1 mide algo)"
else
  mal "2 CONTROL: sin overrides no apareció el recibo real · $(tr '\n' '|' <"$T/o2" | cut -c1-160)"
fi
limpio="$(jq -r 'if has("stub") then .stub else "ausente" end' "$R/.ci-recibos/$SHA.json")"

# --- Caso 3: la estampa -------------------------------------------------------------------------
# ⚠️ `ESTAMPA_STUB` se captura en el caso 1, ANTES de que el caso 2 borre el dir. La primera version
# de este caso leia el archivo despues del `rm -rf` y reportaba `sin-archivo`: un check que mira un
# archivo borrado no asevera nada y sale verde igual.
if [ "$limpio" = "false" ] && [ "$ESTAMPA_STUB" = "true" ]; then
  ok "3 estampa: con overrides stub=true · sin overrides stub=false (las DOS, no una)"
else
  mal "3 estampa: con overrides stub=$ESTAMPA_STUB (esperaba true) · sin overrides stub=$limpio (esperaba false)"
fi

# --- Casos 4 y 5: el CONSUMIDOR -----------------------------------------------------------------
# Un recibo completo y limpio, con el árbol del HEAD del repo temporal, sentado en el dir REAL.
ARBOL="$(g rev-parse 'HEAD^{tree}')"
FIX="$T/fixtures"; mkdir -p "$FIX"
mk_recibo() {  # mk_recibo <stub true|false> <destino>
  jq -n --arg sha "$SHA" --arg arbol "$ARBOL" --argjson stub "$1" '
    {sha:$sha, arbol:$arbol, sesion:"t", fecha:"2026-10-06T00:00:00Z", host:"t",
     duracion_seg:1, sucio:false, stub:$stub,
     jobs:  {core:"ok", web:"ok", mobile:"ok", lint:"ok", backend:"ok"},
     detalle:{core:{sucio:false}, web:{sucio:false}, mobile:{sucio:false},
              lint:{sucio:false}, backend:{sucio:false}}}' > "$2"
}
mk_recibo true  "$FIX/$SHA.json"
(cd "$R" && bash scripts/recibo-cubre.sh "$SHA" "$FIX") > "$T/o4" 2>&1; rc4=$?
if [ "$rc4" -eq 1 ] && grep -q "stub" "$T/o4"; then
  ok "4 recibo stub:true en el dir real -> RECHAZADO (exit 1) y el motivo lo nombra"
else
  mal "4 stub:true dio rc=$rc4: $(tr '\n' '|' <"$T/o4" | cut -c1-200)"
fi

mk_recibo false "$FIX/$SHA.json"
(cd "$R" && bash scripts/recibo-cubre.sh "$SHA" "$FIX") > "$T/o5" 2>&1; rc5=$?
if [ "$rc5" -eq 0 ] && grep -q "CUBRE" "$T/o5"; then
  ok "5 CONTROL: el MISMO recibo con stub:false -> CUBRE (el caso 4 no pasa por rechazar todo)"
else
  mal "5 CONTROL stub:false dio rc=$rc5: $(tr '\n' '|' <"$T/o5" | cut -c1-200)"
fi

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
