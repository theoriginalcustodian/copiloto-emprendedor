#!/usr/bin/env bash
# test-podar-worktrees.sh — las guardas de un script que BORRA DIRECTORIOS no se verifican leyéndolas.
#
# Este script es la excepción donde el control positivo importa más que en cualquier otro: el modo de
# falla no es un reporte equivocado, es el WIP de otra sesión en la papelera. Los casos de abajo son
# los dos que costaron plata el 2026-08-13 durante su propia construcción:
#
#   1. NEGATIVO — un worktree con trabajo sin commitear JAMÁS puede caer en PODABLES.
#   2. NEGATIVO — el dry-run (default) no puede cambiar la cantidad de worktrees registrados.
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

if ! git -C "$REPO_ROOT" rev-parse --verify -q origin/main >/dev/null; then
  fail "no hay ref origin/main — el script aborta por diseño y no se puede verificar nada"
  echo; echo "❌ test-podar-worktrees: $fallos fallo(s)"; exit 1
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

if ! git -C "$REPO_ROOT" worktree add -q -b "$rama" "$victima" origin/main 2>/dev/null; then
  fail "no pude crear el worktree de prueba — sin él no se verifica ninguna guarda"
  echo; echo "❌ test-podar-worktrees: $fallos fallo(s)"; exit 1
fi

# Se lo ensucia con un archivo NUEVO: es el caso que más duele, porque un untracked no está en
# ninguna rama y su pérdida es total.
echo "trabajo sin commitear que no está en ninguna rama" > "$victima/NO-BORRAR-ESTO.txt"

antes="$(git -C "$REPO_ROOT" worktree list | wc -l)"
salida="$(bash "$PODAR" --horas 0 2>&1)"
despues="$(git -C "$REPO_ROOT" worktree list | wc -l)"

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
if [ "$antes" = "$despues" ] && [ -f "$victima/NO-BORRAR-ESTO.txt" ]; then
  ok "2 NEGATIVO · el dry-run no borró worktrees ni archivos ($antes → $despues)"
else
  fail "2 NEGATIVO · el dry-run modificó algo: $antes → $despues, archivo=$( [ -f "$victima/NO-BORRAR-ESTO.txt" ] && echo presente || echo BORRADO)"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-podar-worktrees: todo verde"
  exit 0
fi
echo "❌ test-podar-worktrees: $fallos fallo(s)"
exit 1
