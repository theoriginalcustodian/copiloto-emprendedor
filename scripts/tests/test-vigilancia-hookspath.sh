#!/usr/bin/env bash
# test-vigilancia-hookspath.sh — el vigía tiene que gritar si `core.hooksPath` deja de ser `.githooks`.
#
# Por qué existe (H-A4-1, 2026-09-22): el pre-push con gitleaks dejó de correr dos veces porque la
# config local compartida quedó con una ruta absoluta, y nadie encontró quién la reescribe. `gate.sh`
# lo detecta sólo cuando alguien corre un gate; `vigilancia-check.sh` lo mira en cada latido.
#
#   1. CONTROL POSITIVO — hooksPath absoluto                     → alarma HOOKS (exit 1)
#   2. CONTROL POSITIVO — hooksPath sin setear                   → alarma HOOKS
#   3. CONTROL NEGATIVO — hooksPath = .githooks                  → sin HOOKS
#   4. AISLAMIENTO      — fixture (TRANSCRIPTS_DIR) sin HOOKS_REPO_DIR → el chequeo NO lee el .git
#                         de su árbol (probado sobre una copia con el .git roto, + control positivo)
#
# El caso 4 es el que protege a los demás tests: sin él, cualquier test de vigilancia daría rojo o
# verde según cómo esté configurado el repo de la máquina donde corre.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VIGILANCIA="$REPO_ROOT/scripts/vigilancia-check.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

mkdir -p "$TMP/buzon/abierto" "$TMP/buzon/en-curso" "$TMP/buzon/cerrado" "$TMP/transcripts/slug"
git -c init.defaultBranch=main init -q "$TMP/repo"

correr() {
  BUZON_DIR="$TMP/buzon" TRANSCRIPTS_DIR="$TMP/transcripts/slug" SLUGS_ROOT="$TMP/transcripts" \
    RAMAS_GIT_DIR="$TMP/repo" TRANSCRIPTS_EXTRA_DIRS="" "$@" bash "$VIGILANCIA" --quiet 2>&1
}

echo "1) hooksPath absoluto"
git -C "$TMP/repo" config core.hooksPath "C:/otro/worktree/.githooks"
out="$(correr env HOOKS_REPO_DIR="$TMP/repo")"; rc=$?
if [ "$rc" -eq 1 ] && grep -q "HOOKS: core.hooksPath='C:/otro/worktree/.githooks'" <<<"$out"; then
  ok "alarma con el valor absoluto"
else fail "esperaba exit 1 + HOOKS (rc=$rc): $out"; fi

echo "2) hooksPath sin setear"
git -C "$TMP/repo" config --unset core.hooksPath
out="$(correr env HOOKS_REPO_DIR="$TMP/repo")"; rc=$?
if [ "$rc" -eq 1 ] && grep -q "HOOKS: core.hooksPath='(sin setear)'" <<<"$out"; then
  ok "alarma sin setear"
else fail "esperaba exit 1 + HOOKS (rc=$rc): $out"; fi

echo "3) hooksPath = .githooks"
git -C "$TMP/repo" config core.hooksPath .githooks
out="$(correr env HOOKS_REPO_DIR="$TMP/repo")"
if grep -q "HOOKS:" <<<"$out"; then fail "no esperaba HOOKS: $out"; else ok "silencio con el valor correcto"; fi

echo "4) fixture sin HOOKS_REPO_DIR no lee el .git de su propio árbol"
# Contra el repo real este caso no discrimina: si su hooksPath está bien, el silencio sale igual
# aunque el chequeo haya corrido. Por eso se copia `scripts/` a un árbol con su PROPIO .git roto:
# ahí, si el chequeo leyera REPO_ROOT en modo fixture, aparecería HOOKS.
mkdir -p "$TMP/copia"; cp -r "$REPO_ROOT/scripts" "$TMP/copia/"
git -c init.defaultBranch=main init -q "$TMP/copia"
git -C "$TMP/copia" config core.hooksPath "C:/roto/.githooks"
VIG_COPIA="$TMP/copia/scripts/vigilancia-check.sh"
correr_copia() {
  BUZON_DIR="$TMP/buzon" TRANSCRIPTS_DIR="$TMP/transcripts/slug" SLUGS_ROOT="$TMP/transcripts" \
    RAMAS_GIT_DIR="$TMP/repo" TRANSCRIPTS_EXTRA_DIRS="" "$@" bash "$VIG_COPIA" --quiet 2>&1
}
out="$(correr_copia env)"
if grep -q "HOOKS:" <<<"$out"; then fail "el chequeo corrió en modo fixture: $out"; else ok "saltado en modo fixture"; fi
# Control positivo del caso 4: el mismo árbol, apuntado a propósito, SÍ da HOOKS. Sin esto el
# silencio de arriba podría venir de una copia que no lee nada.
out="$(correr_copia env HOOKS_REPO_DIR="$TMP/copia")"
if grep -q "HOOKS: core.hooksPath='C:/roto/.githooks'" <<<"$out"; then
  ok "control positivo: el árbol copiado sí está roto"
else fail "control positivo del caso 4 no dio HOOKS: $out"; fi

echo
if [ "$fallos" -eq 0 ]; then echo "test-vigilancia-hookspath: 5/5 ✅"; exit 0; fi
echo "test-vigilancia-hookspath: $fallos fallo(s) ❌"; exit 1
