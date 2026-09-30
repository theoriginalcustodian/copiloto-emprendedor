#!/usr/bin/env bash
# test-mergear-pr-veredicto-en-el-remoto.sh — el veredicto del merge es el ESTADO en el remoto,
# nunca el exit code de `gh`.
#
# Caso real, dos veces el 2026-09-30 (PR #747 y #748): `gh pr merge --squash --delete-branch` sale
# **rc=1 con el merge YA hecho** porque `main` está tomado por otro de los 15 worktrees. El merge
# remoto ocurrió; falla la fase LOCAL posterior — y el borrado de la rama, que va después en la
# misma invocación, **queda sin ejecutar**. Un rc=1 leído como fallo hace repetir un merge ya hecho;
# leído como éxito deja la rama viva. Los dos errores salen del mismo lugar: mirar el exit code.
#
#   1. gh AUSENTE      → exit 2, código propio: «no pude medir» ≠ «no verde»
#   2. PR NO VERDE     → exit 1 y el merge NO se invoca (no es un interruptor ciego)
#   3. rc=1 + MERGED   → sigue, avisa que era la fase local, y BORRA la rama    ← el caso real
#   4. rc=0 sin MERGED → exit 3: el remoto manda, aunque gh diga que salió bien ← el inverso
#   5. rama sobrevive  → exit 4: mergeado pero a medias, y lo dice
#   6. ya MERGED       → idempotente: no reintenta el merge, sólo cierra la rama
#
# Los casos 2 y 4 son los que impiden que esto sea un sello: sin ellos, un script que mergeara sin
# mirar el gate, o que confiara en el `rc=0` de gh, pasaría el resto igual
# (`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`).
#
# ⚠️ Nada de backticks en los mensajes: dentro de comillas dobles bash los ejecuta. La primera
# versión de este archivo tenía ``gh pr merge`` en un texto y **corrió el gh real**, fuera del stub
# y con el PATH de la máquina. Salió verde igual — el test pasaba mientras ejecutaba algo que no
# había previsto (`memoria/probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala.md`).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${MERGEAR_BAJO_PRUEBA:-$ROOT/scripts/mergear-pr.sh}"
[ -f "$SCRIPT" ] || { echo "no existe $SCRIPT"; exit 1; }
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  OK   %s\n' "$1"; }
mal() { printf '  MAL  %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-mergear-pr-veredicto-en-el-remoto"

BASH_BIN="$(command -v bash)"
mkdir -p "$T/bin"

# `gh` de mentira. El rollup, el estado y el rc del merge se piden por env; el merge deja testigo.
escribir_gh() {   # escribir_gh <conclusion-del-primer-job>
  cat > "$T/bin/gh" <<STUB
#!/usr/bin/env bash
case "\$*" in
  *"--json state"*)       echo "\${FAKE_ESTADO:-OPEN}" ;;
  *"--json headRefName"*) echo "plan/rama-de-prueba" ;;
  *"--json mergeCommit"*) echo "abc1234567" ;;
  *"pr merge"*)           echo "\$*" >> "\$TESTIGO_MERGE"
                          echo "failed to run git: fatal: main is already used by worktree"
                          exit "\${FAKE_RC_MERGE:-0}" ;;
  *) echo '[{"name":"backend","conclusion":"$1","status":"COMPLETED"},{"name":"core","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"web","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"mobile","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"lint","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"drift","conclusion":"SUCCESS","status":"COMPLETED"}]' ;;
esac
STUB
  chmod +x "$T/bin/gh"
}

# `git` de mentira: la rama "existe" mientras exista su archivo marca.
cat > "$T/bin/git" <<'STUB'
#!/usr/bin/env bash
case "$1" in
  ls-remote) [ -f "$MARCA_RAMA" ] && echo "deadbeef	refs/heads/plan/rama-de-prueba"; exit 0 ;;
  push)      [ "${RAMA_INDESTRUCTIBLE:-0}" = "1" ] || rm -f "$MARCA_RAMA"; exit 0 ;;
  *)         exit 0 ;;
esac
STUB
chmod +x "$T/bin/git"

correr() {   # correr <nombre=valor>... -> deja $rc y $out; la rama arranca EXISTIENDO
  : > "$T/testigo-merge"; : > "$T/marca-rama"
  out="$(env "$@" TESTIGO_MERGE="$T/testigo-merge" MARCA_RAMA="$T/marca-rama" \
             PATH="$T/bin:$PATH" "$BASH_BIN" "$SCRIPT" 999 2>&1)"
  rc=$?
}
testigo_vacio() { [ ! -s "$T/testigo-merge" ]; }
rama_existe()   { [ -f "$T/marca-rama" ]; }

echo "-- Caso 1: gh AUSENTE"
escribir_gh SUCCESS
: > "$T/marca-rama"
out="$(PATH="" MARCA_RAMA="$T/marca-rama" "$BASH_BIN" "$SCRIPT" 999 2>&1)"; rc=$?
if [ "$rc" -eq 2 ]; then ok "exit 2: no-pude-medir no se confunde con no-verde"
else mal "rc=$rc; compartir exit con no-verde obliga al mensaje a elegir una causa"; fi

echo "-- Caso 2: PR NO VERDE"
escribir_gh FAILURE
correr FAKE_ESTADO=OPEN
if [ "$rc" -eq 1 ] && testigo_vacio; then
  ok "exit 1 sin invocar el merge: el gate frena"
else mal "rc=$rc testigo=$(wc -c < "$T/testigo-merge")B; iba a mergear con un job en FAILURE"; fi

echo "-- Caso 3: gh rc=1 y el remoto dice MERGED (el caso real)"
escribir_gh SUCCESS
correr FAKE_ESTADO=MERGED FAKE_RC_MERGE=1
if [ "$rc" -eq 0 ] && ! rama_existe; then ok "rc=0 y rama borrada, aunque gh hubiera fallado"
else mal "rc=$rc rama=$(rama_existe && echo presente || echo borrada); salida: $(tr '\n' '|' <<<"$out" | cut -c1-160)"; fi

echo "-- Caso 4: el remoto NO dice MERGED aunque gh saliera 0"
correr FAKE_ESTADO=OPEN FAKE_RC_MERGE=0
if [ "$rc" -eq 3 ]; then ok "exit 3: el remoto manda sobre el rc=0 de gh"
else mal "rc=$rc; un rc=0 no puede declarar mergeado lo que el remoto dice OPEN"; fi

echo "-- Caso 5: la rama sobrevive al borrado"
correr FAKE_ESTADO=MERGED RAMA_INDESTRUCTIBLE=1
if [ "$rc" -eq 4 ] && grep -q "a medias" <<<"$out"; then
  ok "exit 4 y lo nombra: mergeado pero el trabajo quedo a medias"
else mal "rc=$rc; la rama huerfana necesita un codigo propio"; fi

echo "-- Caso 6: PR ya MERGED, idempotente"
correr FAKE_ESTADO=MERGED
if [ "$rc" -eq 0 ] && testigo_vacio; then
  ok "no reinvoco el merge y cerro la rama (corrible N veces)"
else mal "rc=$rc testigo=$(wc -c < "$T/testigo-merge")B; reintentar un merge hecho es el otro modo de fallar"; fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "TODO VERDE -- el veredicto sale del remoto, y la rama se cierra o se denuncia"
  exit 0
fi
echo "$fallos fallo(s)"; exit 1
