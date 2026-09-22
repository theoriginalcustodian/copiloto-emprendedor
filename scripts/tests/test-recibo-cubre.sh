#!/usr/bin/env bash
# test-recibo-cubre.sh — un recibo cubre un SHA sólo si probó SU árbol, completo y limpio.
#
# Repo temporal: main A → C; la rama feat parte de A (B) y después se pone al día con main (B2).
# El squash se fabrica con `git commit-tree`, como lo hace GitHub: el árbol es el RESULTADO de mergear la
# rama sobre main (acá, el de B2), con main como padre. Esté la rama al día o no, ése es el árbol que entra.
#
#   1. POSITIVO  recibo de B2 (rama al día) cubre al squash S2 (mismo árbol, otro SHA).
#                Sin el 1, los negativos pasarían también si el script no cubriera nunca nada.
#   2. NEGATIVO  recibo de B (la cabeza de una rama atrasada) NO cubre al squash: el caso real de
#                107fdf61/8a7f2434 — su gate probó un árbol sin los commits de main que el squash sí trae.
#   3. NEGATIVO  mismo árbol pero backend `failed` -> no cubre.
#   4. NEGATIVO  mismo árbol pero un job corrió con el árbol `sucio` -> no cubre.
#   5. LEGADO    recibo sin `arbol` ni `sucio` (anterior a este cambio) cubre por el árbol de su SHA, con ⚠️.
#   6. gate.sh escribe `arbol` = HEAD^{tree} y `sucio` por job = estado real del árbol.
#   7. Sin dirs, el script busca en `.ci-recibos/` de los worktrees del repo.
#   8. NEGATIVO  una corrida con overrides (jobs stub) NO escribe en la copia durable real: si lo hiciera,
#                un `exit 0` de test cubriría un SHA que nadie probó.
#   9. COPIA DURABLE  gate.sh (sin overrides) copia el recibo a `<common-dir>/ci-recibos/`; borrado el
#                worktree, recibo-cubre lo sigue encontrando, y otro worktree del mismo SHA acumula desde ahí.
#                9e: dos recibos DISTINTOS del mismo SHA se evalúan los dos (uno fallido no tapa al que cubre).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CUBRE="$ROOT/scripts/recibo-cubre.sh"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-recibo-cubre"
command -v jq >/dev/null || { echo "  ℹ️  sin jq — no se puede ejercitar"; exit 1; }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
R="$T/repo"; mkdir -p "$R"
g() { git -C "$R" -c user.name=t -c user.email=t@t -c core.autocrlf=false "$@"; }
g init -q -b main && echo 1 > "$R/x" && g add x && g commit -qm A
g switch -q -c feat && echo 1 > "$R/y" && g add y && g commit -qm B; B="$(g rev-parse HEAD)"
g switch -q main && echo 1 > "$R/z" && g add z && g commit -qm C; C="$(g rev-parse HEAD)"
g switch -q feat && g merge -q --no-edit main; B2="$(g rev-parse HEAD)"
S2="$(g commit-tree "${B2}^{tree}" -p "$C" -m squash)"   # árbol = feat mergeada sobre main; padre = main

recibo() {  # recibo <archivo> <sha> <resultado-backend> <sucio-backend|legado>
  local arbol; arbol="$(g rev-parse "$2^{tree}")"
  if [ "$4" = legado ]; then
    jq -n --arg sha "$2" --arg rb "$3" '{sha:$sha, jobs:{core:"ok",web:"ok",mobile:"ok",lint:"ok",backend:$rb},
      detalle:{core:{resultado:"ok"},web:{resultado:"ok"},mobile:{resultado:"ok"},lint:{resultado:"ok"},backend:{resultado:$rb}}}' > "$1"
  else
    jq -n --arg sha "$2" --arg arbol "$arbol" --arg rb "$3" --argjson sb "$4" '{sha:$sha, arbol:$arbol,
      jobs:{core:"ok",web:"ok",mobile:"ok",lint:"ok",backend:$rb},
      detalle:{core:{resultado:"ok",sucio:false},web:{resultado:"ok",sucio:false},mobile:{resultado:"ok",sucio:false},
               lint:{resultado:"ok",sucio:false},backend:{resultado:$rb,sucio:$sb}}}' > "$1"
  fi
}
caso() { mkdir -p "$T/$1"; recibo "$T/$1/r.json" "$2" "$3" "$4"; (cd "$R" && bash "$CUBRE" "$5" "$T/$1") > "$T/$1.out" 2>&1; echo $?; }

[ "$(caso c1 "$B2" ok false "$S2")" = 0 ] && grep -q "✅ CUBRE" "$T/c1.out" \
  && ok "1 POSITIVO · el recibo de la rama al día cubre al squash (mismo árbol, otro SHA)" \
  || fail "1 POSITIVO · salida=<$(cat "$T/c1.out")>"
[ "$(caso c2 "$B" ok false "$S2")" = 1 ] && grep -q "ese árbol no lo probó nadie" "$T/c2.out" \
  && ok "2 NEGATIVO · el recibo de la rama atrasada NO cubre al squash, y dice por qué" \
  || fail "2 NEGATIVO · salida=<$(cat "$T/c2.out")>"
[ "$(caso c3 "$B2" failed false "$S2")" = 1 ] && grep -q "backend=failed" "$T/c3.out" \
  && ok "3 NEGATIVO · mismo árbol con backend failed -> no cubre" || fail "3 NEGATIVO · salida=<$(cat "$T/c3.out")>"
[ "$(caso c4 "$B2" ok true "$S2")" = 1 ] && grep -q "SUCIO" "$T/c4.out" \
  && ok "4 NEGATIVO · mismo árbol con un job sucio -> no cubre" || fail "4 NEGATIVO · salida=<$(cat "$T/c4.out")>"
[ "$(caso c5 "$B2" ok legado "$S2")" = 0 ] && grep -q "⚠️" "$T/c5.out" \
  && ok "5 LEGADO · recibo sin arbol/sucio cubre por el árbol de su SHA, con aviso" || fail "5 LEGADO · salida=<$(cat "$T/c5.out")>"

# 7. sin dirs, busca en `.ci-recibos/` de los worktrees del repo (el modo de uso real)
mkdir -p "$R/.ci-recibos" && recibo "$R/.ci-recibos/$B2.json" "$B2" ok false
(cd "$R" && bash "$CUBRE" "$S2") > "$T/c7.out" 2>&1; rc7=$?
[ "$rc7" = 0 ] && grep -q "/repo/.ci-recibos/$B2.json" "$T/c7.out" && ok "7 sin dirs encuentra el recibo en .ci-recibos/ del worktree" || fail "7 sin dirs · rc=$rc7 salida=<$(cat "$T/c7.out")>"

# 6. gate.sh escribe arbol y sucio (stub de job, recibo en dir temporal: no toca red ni el recibo real)
mkdir -p "$T/ci" && printf '#!/usr/bin/env bash\nexit 0\n' > "$T/ci/core.sh"
SHA_REAL="$(git -C "$ROOT" rev-parse HEAD)"
COMUN_REAL="$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)/ci-recibos/$SHA_REAL.json"
antes8="$(stat -c %Y "$COMUN_REAL" 2>/dev/null || echo ausente)"
GATE_CI_DIR="$T/ci" GATE_RECIBO_DIR="$T/rec6" UC_SESION=fe1 bash "$ROOT/scripts/gate.sh" core > "$T/o6" 2>&1
REC6="$T/rec6/$SHA_REAL.json"
esperado_sucio=false; [ -n "$(git -C "$ROOT" status --porcelain | grep -v '^?? \.ci-recibos/')" ] && esperado_sucio=true
if [ "$(jq -r '.arbol' "$REC6" 2>/dev/null)" = "$(git -C "$ROOT" rev-parse 'HEAD^{tree}')" ] \
   && [ "$(jq -r '.detalle.core.sucio' "$REC6")" = "$esperado_sucio" ] && [ "$(jq -r '.sucio' "$REC6")" = "$esperado_sucio" ]; then
  ok "6 gate.sh escribe arbol = HEAD^{tree} y sucio = estado real del árbol ($esperado_sucio)"
else fail "6 gate.sh · recibo=<$(cat "$REC6" 2>/dev/null)> esperado_sucio=$esperado_sucio"; fi

# 8. la corrida de test del 6 dejó su copia en el dir del test y NO tocó la copia durable real
despues8="$(stat -c %Y "$COMUN_REAL" 2>/dev/null || echo ausente)"
[ -f "$T/rec6/comun/$SHA_REAL.json" ] && [ "$antes8" = "$despues8" ] \
  && ok "8 NEGATIVO · con overrides la copia va al dir del test; la durable real queda intacta ($antes8)" \
  || fail "8 NEGATIVO · copia-test=$([ -f "$T/rec6/comun/$SHA_REAL.json" ] && echo sí || echo no) real antes=$antes8 después=$despues8"

# 9. copia durable, con los paths por defecto (sin overrides), en un repo temporal con worktrees
R9="$T/r9"; mkdir -p "$R9/scripts/ci"
cp "$ROOT/scripts/gate.sh" "$ROOT/scripts/recibo-cubre.sh" "$R9/scripts/"
cp "$ROOT/scripts/ci/sesion-env.sh" "$ROOT/scripts/ci/candado-stage.sh" "$R9/scripts/ci/"
for j in core lint; do printf '#!/usr/bin/env bash\nexit 0\n' > "$R9/scripts/ci/$j.sh"; done
printf '.ci-recibos/\n' > "$R9/.gitignore"
g9() { git -C "$R9" -c user.name=t -c user.email=t@t -c core.autocrlf=false "$@"; }
g9 init -q -b main && g9 add -A && g9 commit -qm base; SHA9="$(g9 rev-parse HEAD)"
COMUN9="$(g9 rev-parse --path-format=absolute --git-common-dir)/ci-recibos"
gate9() {  # gate9 <worktree> <job> -- paths por defecto: sin ningún override de test
  (cd "$1" && env -u GATE_CI_DIR -u GATE_RECIBO_DIR -u GATE_RECIBO_COMUN UC_SESION=fe1 bash scripts/gate.sh "$2")
}
g9 worktree add -q --detach "$T/w9a" HEAD
gate9 "$T/w9a" core > "$T/o9a" 2>&1
[ -f "$T/w9a/.ci-recibos/$SHA9.json" ] && [ "$(jq -r '.jobs.core' "$COMUN9/$SHA9.json" 2>/dev/null)" = ok ] \
  && ok "9a gate.sh escribe el recibo local Y la copia durable en el common dir" \
  || fail "9a · comun=<$(cat "$COMUN9/$SHA9.json" 2>&1)> salida=<$(tail -5 "$T/o9a")>"
g9 worktree remove --force "$T/w9a"
(cd "$R9" && bash scripts/recibo-cubre.sh "$SHA9") > "$T/o9b" 2>&1
[ ! -d "$T/w9a" ] && grep -q "ci-recibos/$SHA9.json" "$T/o9b" \
  && ok "9b borrado el worktree, recibo-cubre encuentra la copia durable" || fail "9b · salida=<$(cat "$T/o9b")>"
g9 worktree add -q --detach "$T/w9b" HEAD
gate9 "$T/w9b" lint > "$T/o9c" 2>&1
[ "$(jq -r '[.jobs.core, .jobs.lint] | join(",")' "$T/w9b/.ci-recibos/$SHA9.json" 2>/dev/null)" = "ok,ok" ] \
  && ok "9c un worktree nuevo del mismo SHA acumula desde la copia durable (core + lint)" \
  || fail "9c · recibo=<$(cat "$T/w9b/.ci-recibos/$SHA9.json" 2>&1)>"
(cd "$R9" && bash scripts/recibo-cubre.sh "$SHA9") > "$T/o9d" 2>&1
[ "$(grep -cE "^(❌ mismo árbol, NO cubre|✅ CUBRE)" "$T/o9d")" = 1 ] \
  && ok "9d el mismo SHA en la copia durable y en el worktree se evalúa UNA vez" || fail "9d · salida=<$(cat "$T/o9d")>"
# 9e. dos recibos DISTINTOS del mismo SHA (copia durable con backend failed, otro worktree 5/5): se evalúan
#     los dos. Deduplicar por SHA dejaba que el primero —el fallido— tapara al que cubre (falso ❌).
g9 worktree add -q --detach "$T/w9e" HEAD
mkdir -p "$T/w9e/.ci-recibos"
jq -n --arg sha "$SHA9" --arg arbol "$(g9 rev-parse "$SHA9^{tree}")" '{sha:$sha, arbol:$arbol,
  jobs:{core:"ok",web:"ok",mobile:"ok",lint:"ok",backend:"ok"},
  detalle:{core:{sucio:false},web:{sucio:false},mobile:{sucio:false},lint:{sucio:false},backend:{sucio:false}}}' \
  > "$T/w9e/.ci-recibos/$SHA9.json"
jq '.jobs.backend = "failed"' "$T/w9e/.ci-recibos/$SHA9.json" > "$COMUN9/$SHA9.json"
(cd "$R9" && bash scripts/recibo-cubre.sh "$SHA9") > "$T/o9e" 2>&1; rc9e=$?
[ "$rc9e" = 0 ] && grep -q "✅ CUBRE .*w9e/.ci-recibos" "$T/o9e" && grep -q "backend=failed" "$T/o9e" \
  && ok "9e un recibo fallido del mismo SHA no tapa al que cubre (se evalúan los dos)" \
  || fail "9e · rc=$rc9e salida=<$(cat "$T/o9e")>"

echo
[ "$fallos" -eq 0 ] && { echo "✅ test-recibo-cubre: todo verde"; exit 0; }
echo "❌ test-recibo-cubre: $fallos fallo(s)"; exit 1
