#!/usr/bin/env bash
# test-podar-worktrees.sh — las guardas de un script que BORRA DIRECTORIOS no se verifican leyéndolas.
#
# Este script es la excepción donde el control positivo importa más que en cualquier otro: el modo de
# falla no es un reporte equivocado, es el WIP de otra sesión en la papelera. Los casos de abajo son
# los dos que costaron plata el 2026-08-13 durante su propia construcción:
#
#   1. NEGATIVO — un worktree con trabajo sin commitear JAMÁS puede caer en PODABLES.
#   2. NEGATIVO — el dry-run (default) no puede invocar NINGÚN comando git que borre (worktree
#      remove/prune, branch -d/-D). Se mide lo que el SCRIPT hace, no el estado global: la primera
#      versión comparaba la cantidad de `git worktree list`, que es compartida por las sesiones
#      paralelas — el 2026-09-22 dio 27 → 28 porque backend creó un worktree en ese segundo, y el
#      gate del SHA mergeado de FE2 quedó rojo por algo que el script no hizo.
#   3. POSITIVO — un worktree recién creado y ensuciado APARECE, y aparece en SUCIOS.
#      Sin el 3, el 1 pasaría también si el script simplemente no viera nada (verde por ausencia — la
#      falla que este repo ya pagó dos veces en un solo día).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PODAR="$REPO_ROOT/scripts/podar-worktrees.sh"

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

echo "test-podar-worktrees"

# NO SE SALTEA NI SE PONE ROJO POR EL ENTORNO. La primera versión exigía `origin/main` y en Actions
# (fetch-depth=1, sin esa ref) el test era rojo SIEMPRE — un test siempre-rojo se termina sacando del
# gate, que es la misma pérdida que un skip silencioso con otra cara. El script acepta `PODAR_REF`
# justo para esto: donde no hay `origin/main` se ejercita contra `HEAD`. Los tres casos de abajo no
# dependen de cuál sea la ref base — verifican las guardas, no la clasificación de merge.
if git -C "$REPO_ROOT" rev-parse --verify -q origin/main >/dev/null; then
  export PODAR_REF="origin/main"
else
  export PODAR_REF="HEAD"
  echo "  ℹ️  sin ref origin/main en este checkout — se ejercita contra HEAD"
fi

principal="$(git -C "$REPO_ROOT" worktree list --porcelain | awk '/^worktree /{print substr($0,10); exit}')"
victima="$principal/.claude/worktrees/.test-podar-$$"
rama="test/podar-worktrees-$$"

limpiar() {
  git -C "$REPO_ROOT" worktree remove --force "$victima" >/dev/null 2>&1
  git -C "$REPO_ROOT" branch -D "$rama" >/dev/null 2>&1
  git -C "$REPO_ROOT" worktree prune >/dev/null 2>&1
}
trap limpiar EXIT

if ! git -C "$REPO_ROOT" worktree add -q -b "$rama" "$victima" "$PODAR_REF" 2>/dev/null; then
  fail "no pude crear el worktree de prueba — sin él no se verifica ninguna guarda"
  echo; echo "❌ test-podar-worktrees: $fallos fallo(s)"; exit 1
fi

# Se lo ensucia con un archivo NUEVO: es el caso que más duele, porque un untracked no está en
# ninguna rama y su pérdida es total.
echo "trabajo sin commitear que no está en ninguna rama" > "$victima/NO-BORRAR-ESTO.txt"

# Shim de git: registra CADA invocación del script y delega en el git real. El registro es de esta
# corrida y de nadie más — lo que otra sesión haga con sus worktrees en paralelo no entra.
shim="$(mktemp -d)"; registro="$shim/llamadas.log"; git_real="$(command -v git)"
printf '#!/usr/bin/env bash
printf "%%s\n" "$*" >> "%s"
exec "%s" "$@"
' "$registro" "$git_real" > "$shim/git"
chmod +x "$shim/git"
trap 'limpiar; rm -rf "$shim"' EXIT
mutante='worktree (remove|prune)|branch (-d|-D|--delete)'

salida="$(PATH="$shim:$PATH" bash "$PODAR" --horas 0 2>&1)"

# ── 3. POSITIVO primero: si el script no ve al sujeto, los negativos no prueban nada ─────────
if printf '%s' "$salida" | grep -q ".test-podar-$$"; then
  ok "3 POSITIVO · el worktree de prueba aparece en el informe (el script lo está viendo)"
else
  fail "3 POSITIVO · el script no vio el worktree de prueba; los otros casos serían verde-por-ausencia"
fi

# ── 1. NEGATIVO: sucio ⇒ nunca podable ───────────────────────────────────────────────────────
sucios_bloque="$(printf '%s' "$salida" | awk '/SUCIOS/{on=1;next} /^$/{on=0} on')"
podables_bloque="$(printf '%s' "$salida" | awk '/PODABLES/{on=1;next} /^$/{on=0} on')"
if printf '%s' "$sucios_bloque" | grep -q ".test-podar-$$" \
   && ! printf '%s' "$podables_bloque" | grep -q ".test-podar-$$"; then
  ok "1 NEGATIVO · con un untracked, cae en SUCIOS y NO en PODABLES"
else
  fail "1 NEGATIVO · un worktree con trabajo sin commitear no quedó protegido; salida=<$salida>"
fi

# ── 2. NEGATIVO: el dry-run no toca nada ─────────────────────────────────────────────────────
# Control positivo del shim, antes del negativo: si el registro no ve las lecturas del script (`worktree
# list`), un "0 comandos que borran" sería verde por ausencia. Y el patrón tiene que reconocer un
# comando que borra de verdad: `worktree prune -n` (dry-run de git, inofensivo) pasado por el mismo shim.
PATH="$shim:$PATH" git -C "$REPO_ROOT" worktree prune -n >/dev/null 2>&1
lecturas="$(grep -c 'worktree list' "$registro" 2>/dev/null || true)"
patron_ve="$(tail -1 "$registro" | grep -cE "$mutante" || true)"
mutaciones="$(sed '$d' "$registro" | grep -E "$mutante" || true)"
if [ "${lecturas:-0}" -gt 0 ] && [ "$patron_ve" = "1" ] && [ -z "$mutaciones" ] && [ -f "$victima/NO-BORRAR-ESTO.txt" ]; then
  ok "2 NEGATIVO · el dry-run no invocó ningún git que borre (vio $lecturas lecturas; el patrón sí caza un prune) y el archivo sigue"
else
  fail "2 NEGATIVO · lecturas=${lecturas:-0} patrón_ve=$patron_ve mutaciones=<$mutaciones> archivo=$( [ -f "$victima/NO-BORRAR-ESTO.txt" ] && echo presente || echo BORRADO)"
fi

# ── 4. NEGATIVO: el flag de test no puede usarse para borrar ─────────────────────────────────
# `PODAR_REF` se agregó para poder testear donde no hay `origin/main`. Pero la ref decide qué cuenta
# como "ya mergeado": con `HEAD` el informe pasó de 0 a 15 podables. Un flag de test que también
# funcione en modo destructivo es un agujero abierto al arreglar otro.
out4="$(PODAR_REF=HEAD bash "$PODAR" --podar --horas 0 2>&1)"; rc4=$?
if [ "$rc4" -eq 2 ] && printf '%s' "$out4" | grep -q "origin/main"; then
  ok "4 NEGATIVO · PODAR_REF ≠ origin/main con --podar aborta antes de tocar nada"
else
  fail "4 NEGATIVO · esperaba exit 2 rechazando la ref; rc=$rc4 out=<$out4>"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-podar-worktrees: todo verde"
  exit 0
fi
echo "❌ test-podar-worktrees: $fallos fallo(s)"
exit 1
