#!/usr/bin/env bash
# El recibo del gate anota el ATRASO del árbol respecto de `origin/main`, como ya anota `sucio`.
#
# POR QUÉ EXISTE (pedido de planificación 2026-10-12, backend 2026-10-13). El recibo se protegía del
# árbol SUCIO y no del árbol VIEJO, y los dos defectos tienen el mismo efecto: el recibo dice menos
# de lo que el lector cree. Medido ese día: worktrees ~72 commits atrasados emitían un recibo
# indistinguible del de uno al día. No se pide que el gate FALLE con atraso (una rama vieja en
# revisión tiene derecho a su recibo): se pide que el recibo LO DIGA.
#
#   1. POSITIVO  origin/main 3 commits adelante      -> atraso=3 y atraso_ref = el SHA de origin/main
#   2. CONTROL   HEAD == origin/main                 -> atraso=0   <- sin esto, un atraso fijo en 3
#                                                       (o un campo que sólo existe) pasaría el 1
#   3. POSITIVO  sin origin/main                     -> atraso=-1 (NO 0: «no medí» ≠ «al día»)
#   4. NO FRENA  el gate sale rc=0 aun con atraso>0  <- el campo anota, no castiga
#   5. POSITIVO  la última corrida gana              -> tras 1→2→3 el recibo (mismo SHA, acumulado)
#                                                       dice lo de la ÚLTIMA, no lo de la primera
#
# Todo corre en un repo TEMPORAL con el gate.sh real y un job stub: no puede ensuciar el
# `.ci-recibos/` de nadie (sin overrides el recibo común cae en el git-common-dir del temporal).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  ✅ %s\n' "$1"; }
mal() { printf '  ❌ %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-gate-recibo-atraso"

command -v jq >/dev/null || { echo "  ❌ falta jq — no mido nada"; exit 2; }

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

# 3 commits "de main" que el HEAD NO tiene: se construyen en una rama aparte y se apunta
# `refs/remotes/origin/main` a su punta, sin tocar HEAD (el recibo es del SHA de HEAD).
g checkout -q -b adelantada
for i in 1 2 3; do echo "$i" > "$R/main-$i.txt"; g add "main-$i.txt"; g commit -qm "main $i"; done
PUNTA="$(g rev-parse HEAD)"
g checkout -q main

corre() {  # corre <destino-salida>  -> exit code del gate en $RC
  (cd "$R" && env -u GATE_CI_DIR -u GATE_RECIBO_DIR -u GATE_RECIBO_COMUN UC_SESION=plan \
     bash scripts/gate.sh core) > "$1" 2>&1
  RC=$?
}
campo() { jq -r "$1" "$R/.ci-recibos/$SHA.json" 2>/dev/null || echo sin-recibo; }

# --- Caso 1: origin/main 3 adelante -------------------------------------------------------------
g update-ref refs/remotes/origin/main "$PUNTA"
corre "$T/o1"; rc1=$RC
a1="$(campo '.atraso')"; r1="$(campo '.atraso_ref')"
if [ "$a1" = "3" ] && [ "$r1" = "$PUNTA" ]; then
  ok "1 origin/main 3 commits adelante -> atraso=3 y atraso_ref=$PUNTA"
else
  mal "1 atraso=$a1 (esperaba 3) atraso_ref=$r1 (esperaba $PUNTA) · $(tr '\n' '|' <"$T/o1" | cut -c1-160)"
fi

# --- Caso 4: NO FRENA (mismo run del caso 1) ----------------------------------------------------
if [ "$rc1" -eq 0 ] && grep -q "ATRASADO" "$T/o1"; then
  ok "4 con atraso=3 el gate sale rc=0 y lo avisa por stderr (anota, no castiga)"
else
  mal "4 rc=$rc1 (esperaba 0) · aviso=$(grep -c ATRASADO "$T/o1") · $(tr '\n' '|' <"$T/o1" | cut -c1-160)"
fi

# --- Caso 2: CONTROL, al día -> 0 ---------------------------------------------------------------
g update-ref refs/remotes/origin/main "$SHA"
corre "$T/o2"
a2="$(campo '.atraso')"
if [ "$a2" = "0" ]; then
  ok "2 CONTROL: HEAD == origin/main -> atraso=0 (el caso 1 mide algo, no es un campo fijo)"
else
  mal "2 CONTROL: atraso=$a2 (esperaba 0)"
fi

# --- Caso 3: sin origin/main -> -1, NO 0 --------------------------------------------------------
g update-ref -d refs/remotes/origin/main
corre "$T/o3"; rc3=$RC
a3="$(campo '.atraso')"; r3="$(campo '.atraso_ref')"
if [ "$a3" = "-1" ] && [ "$r3" = "" ] && [ "$rc3" -eq 0 ]; then
  ok "3 sin origin/main -> atraso=-1, atraso_ref vacío, y el gate NO aborta (rc=0)"
else
  mal "3 atraso=$a3 (esperaba -1) atraso_ref='$r3' (esperaba vacío) rc=$rc3 (esperaba 0)"
fi

# --- Caso 5: la última corrida gana (mismo SHA, recibo acumulado) -------------------------------
# Tras 1→2→3 el archivo es el MISMO $SHA.json que acumuló las tres. Si el campo sólo se escribiera
# la primera vez, acá diría 3 (o 0), no -1.
if [ "$a3" = "-1" ] && [ "$(campo '.jobs.core')" = "ok" ]; then
  ok "5 el recibo acumulado (jobs.core=ok) lleva el atraso de la ÚLTIMA corrida, no el de la primera"
else
  mal "5 atraso=$a3 jobs.core=$(campo '.jobs.core')"
fi

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
