#!/usr/bin/env bash
# test-marcadores-deploy.sh — el criterio de «desplegado» que CUALQUIERA puede correr, sin SSH.
#
# Sujeto: `scripts/marcadores-deploy.sh` (fila BUNDLEMARCADOR). Corre OFFLINE con fixtures: un test
# que pega al host vivo mide la red del runner, no el parseo, y su rojo no sería atribuible.
#   → memoria: un-instrumento-compartido-intermitente-fabrica-una-excusa-lista
#
#   1. POSITIVO   los 3 marcadores coinciden -> rc=0. Sin el 1, los negativos pasarían con un script
#                 que dijera «no» a todo.
#   2. NEGATIVO   sha distinto -> rc=1 y NOMBRA cuál no coincide.
#   3. NEGATIVO   proceso=A y shell=B (el estado intermedio de un abort entre [5/7] y [5.5/7]) ->
#                 rc=1. Es el caso que NINGÚN marcador solo ve, y la razón de exigir los tres.
#   4. NEGATIVO   sha correcto pero arrancó hace mucho -> rc=1: «ya estaba» no es «desplegado».
#   5. VACÍO≠PASE /healthz sin "sha" -> rc=2, no rc=0. Un vacío del instrumento no es un hallazgo,
#                 pero tampoco es una aprobación.
#   6. VACÍO≠PASE shell sin `data-build-sha` -> rc=2.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUT="$ROOT/scripts/marcadores-deploy.sh"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-marcadores-deploy"

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
A=aaaaaaaa111111111111111111111111111111aa
B=bbbbbbbb222222222222222222222222222222bb

fixt() {  # fixt <dir> <sha-healthz> <sha-shell> <arrancado>
  local d="$T/$1"; mkdir -p "$d"
  printf '{"status":"ok","sha":"%s","arrancado":"%s"}' "$2" "$4" > "$d/healthz"
  printf '<html data-build-sha="%s"><script src="/assets/index-T3670Tqi.js"></script></html>' "$3" > "$d/index.html"
  echo "$d"
}
correr() { MARCADORES_FIXTURE_DIR="$1" bash "$SUT" host.invalido "$2" ${3:+"$3"} 2>&1; }

AHORA="$(date -u +%Y-%m-%dT%H:%M:%S.000000+00:00)"
VIEJO="$(date -u -d '5 days ago' +%Y-%m-%dT%H:%M:%S.000000+00:00 2>/dev/null || echo '2026-01-01T00:00:00.000000+00:00')"

# 1
d="$(fixt sano "$A" "$A" "$AHORA")"
out="$(correr "$d" "$A")"; rc=$?
[ "$rc" = "0" ] && ok "1 los 3 marcadores coinciden -> rc=0" \
  || fail "1 rc=$rc con todo coherente (el script dice «no» a todo): $(head -2 <<< "$out")"

# 2
out="$(correr "$d" "$B")"; rc=$?
[ "$rc" = "1" ] && grep -q 'healthz sha' <<< "$out" && ok "2 sha distinto -> rc=1 y lo nombra" \
  || fail "2 rc=$rc · no nombró la discrepancia: $(head -2 <<< "$out")"

# 3 — el caso que ningún marcador solo ve
d3="$(fixt intermedio "$A" "$B" "$AHORA")"
out="$(correr "$d3" "$A")"; rc=$?
[ "$rc" = "1" ] && grep -q 'PROCESO y SHELL difieren' <<< "$out" \
  && ok "3 proceso≠shell -> rc=1 (el estado intermedio del abort)" \
  || fail "3 rc=$rc · no vio proceso≠shell, que es la razón de exigir los 3: $(head -2 <<< "$out")"

# 4 — frescura
out="$(correr "$(fixt rancio "$A" "$A" "$VIEJO")" "$A" 20)"; rc=$?
[ "$rc" = "1" ] && grep -q 'no es «desplegado»' <<< "$out" \
  && ok "4 sha correcto pero proceso viejo -> rc=1 («ya estaba» ≠ «desplegado»)" \
  || fail "4 rc=$rc · la frescura no frenó un proceso sin reiniciar: $(head -2 <<< "$out")"
# 4.bis control: el MISMO fixture sin pedir frescura pasa -> el rojo del 4 es atribuible al umbral
out="$(correr "$(fixt rancio2 "$A" "$A" "$VIEJO")" "$A")"; rc=$?
[ "$rc" = "0" ] && ok "4.bis control: sin umbral el mismo fixture pasa (el rojo del 4 es del umbral)" \
  || fail "4.bis rc=$rc · el fixture rancio falla por otra causa, el 4 no prueba la frescura"

# 5
d5="$T/vacio"; mkdir -p "$d5"; echo 'nada' > "$d5/healthz"; echo '<html></html>' > "$d5/index.html"
out="$(correr "$d5" "$A")"; rc=$?
[ "$rc" = "2" ] && ok "5 /healthz sin sha -> rc=2 (no es un pase)" \
  || fail "5 rc=$rc · un vacío salió indistinguible de verde u de rojo real: $(head -2 <<< "$out")"

# 6
d6="$T/sinshell"; mkdir -p "$d6"
printf '{"sha":"%s","arrancado":"%s"}' "$A" "$AHORA" > "$d6/healthz"
echo '<html>sin marcador</html>' > "$d6/index.html"
out="$(correr "$d6" "$A")"; rc=$?
[ "$rc" = "2" ] && ok "6 shell sin data-build-sha -> rc=2" \
  || fail "6 rc=$rc · el shell sin marcador no puede dar verde: $(head -2 <<< "$out")"

[ "$fallos" -eq 0 ] && echo "  OK" || { echo "  $fallos fallo(s)"; exit 1; }
