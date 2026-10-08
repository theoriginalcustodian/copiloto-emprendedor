#!/usr/bin/env bash
# mergear-pr.sh <PR> — mergea un PR verde y CIERRA el trabajo, midiendo el EFECTO en el remoto.
#
# Por qué existe (2026-09-30, dos veces el mismo día). `gh pr merge --squash --delete-branch` sale
# **rc=1 con el merge YA hecho** cuando `main` está tomado por otro worktree:
#
#     failed to run git: fatal: 'main' is already used by worktree at 'C:/gfw-src/wt-a4reg'
#
# El merge remoto ya ocurrió; lo que falla es la fase LOCAL posterior. Y como el borrado de la rama
# va después en esa misma invocación, **queda sin ejecutar**: el rc=1 no deja sólo un veredicto
# falso, deja el trabajo a medias y la rama sobrevive hasta que alguien mira. Con 15 worktrees
# activos, `main` está tomado por construcción — es el caso NORMAL de este repo, no el raro.
#
# Así que el veredicto no puede ser el exit code de `gh`: es el ESTADO en el remoto. Este script
# hornea eso en vez de dejarlo a la disciplina de cada sesión
# (`memoria/git-push-puede-salir-exit-0-sin-haber-pusheado.md`).
#
# Códigos de salida, cada causa con el suyo — dos causas que comparten un exit code hacen que el
# mensaje tenga que elegir una (`memoria/dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una.md`):
#   0  mergeado Y rama borrada, las dos cosas VERIFICADAS contra el remoto
#   1  el PR no está verde  → no se intentó mergear
#   2  falta `gh` en el PATH → no se pudo medir nada (no es "no verde")
#   3  se intentó el merge y el remoto NO dice MERGED → el merge no ocurrió
#   4  mergeado, pero la rama sigue en el remoto → trabajo a medias, hay que volver
#   5  el CI TODAVÍA está corriendo (cero jobs fallados y cero ausentes) → no se intentó
#      mergear, y **no es «no verde»**: no hay nada que arreglar, hay que esperar. Antes esto
#      salía por 1 con el texto «NO está verde», heredado de `ci-verde.sh`, que fundía las dos
#      causas en su propio rc=1 — medido por auditoría el 2026-10-08 sobre el PR #948 con los 6
#      jobs IN_PROGRESS/QUEUED. Delegar el gate hace que este script herede sus fusiones: el
#      arreglo no valía sin propagarlo acá
set -uo pipefail

PR="${1:-}"
[ -n "$PR" ] || { echo "uso: mergear-pr.sh <número de PR>"; exit 1; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v gh >/dev/null 2>&1 || {
  echo "❌ gh no está en el PATH: no puedo medir el estado del PR (≠ «no verde»)"; exit 2; }

estado_de() { gh pr view "$PR" --json state --jq '.state' 2>/dev/null; }
rama_de()   { gh pr view "$PR" --json headRefName --jq '.headRefName' 2>/dev/null; }

RAMA="$(rama_de)"
[ -n "$RAMA" ] || { echo "❌ no pude leer la rama del PR $PR"; exit 3; }

# ── Paso 1: el gate. Se DELEGA a ci-verde.sh, no se reimplementa: si la definición de "verde"
# vive en dos lugares, una de las dos envejece.
if [ "$(estado_de)" = "MERGED" ]; then
  echo "ℹ️  PR $PR ya estaba MERGED — no reintento el merge, sólo cierro la rama (idempotente)"
else
  echo "── gate: ci-verde.sh $PR"
  # El rc se CAPTURA en vez de negarse: `if !` colapsa todos los no-cero en un solo mensaje, y
  # el 3 del gate («todavía corriendo») no es la misma noticia que el 1 («algún job falló»).
  bash "$ROOT/scripts/ci-verde.sh" "$PR"; rc_gate=$?
  if [ "$rc_gate" -eq 3 ]; then
    echo "⏳ PR $PR TODAVÍA NO terminó el CI: cero jobs fallados y cero ausentes — no se intentó mergear. No hay nada que arreglar, esperá: gh pr checks $PR --watch"
    exit 5
  fi
  if [ "$rc_gate" -ne 0 ]; then
    echo "❌ PR $PR NO está verde (gate rc=$rc_gate) — no se intentó mergear"; exit 1
  fi
  # ── Paso 2: el merge. El rc se IGNORA a propósito: no es el veredicto.
  salida_merge="$(gh pr merge "$PR" --squash 2>&1)"; rc_merge=$?
  # ── Paso 3: el veredicto, leído del remoto.
  if [ "$(estado_de)" != "MERGED" ]; then
    echo "❌ el remoto NO dice MERGED (rc de gh = $rc_merge). Salida real:"
    printf '%s\n' "$salida_merge" | sed 's/^/     /'
    exit 3
  fi
  if [ "$rc_merge" -ne 0 ]; then
    echo "⚠️  gh salió rc=$rc_merge y el merge SÍ está hecho — era la fase local, no el merge:"
    printf '%s\n' "$salida_merge" | sed 's/^/     /'
  fi
fi
COMMIT="$(gh pr view "$PR" --json mergeCommit --jq '.mergeCommit.oid' 2>/dev/null | cut -c1-8)"
echo "✅ PR $PR MERGED en el remoto · commit ${COMMIT:-?}"

# ── Paso 4: la rama. Va aparte porque el --delete-branch de `gh` se pierde con el rc=1, y su
# veredicto también es el remoto. ⚠️ este push dispara el pre-push completo (batería + gitleaks):
# puede pasar de 2 minutos, así que el llamador lo corre en background si le importa.
if [ -z "$(git ls-remote --heads origin "$RAMA" 2>/dev/null)" ]; then
  echo "✅ rama '$RAMA' ya no está en el remoto"
  exit 0
fi
echo "── borrando rama '$RAMA' (dispara el pre-push, puede tardar)"
git push origin --delete "$RAMA" >/dev/null 2>&1 || true
if [ -n "$(git ls-remote --heads origin "$RAMA" 2>/dev/null)" ]; then
  echo "❌ la rama '$RAMA' SIGUE en el remoto: el merge está hecho pero el trabajo quedó a medias"
  exit 4
fi
echo "✅ rama '$RAMA' borrada del remoto (verificado con ls-remote, no por exit code)"
