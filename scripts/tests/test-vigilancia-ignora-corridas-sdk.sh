#!/usr/bin/env bash
# test-vigilancia-ignora-corridas-sdk.sh — una corrida del SDK no es una ventana sin rol.
#
# CASO REAL (21/09): un security-review del pre-push (entrypoint sdk-py) corría en wt-fe1b. El
# vigilante lo contó como «ventana activa SIN rol» y, por la regla de callar ante la duda, cambió
# la alarma de sesión muda por un AVISO. Si BACKEND hubiera estado callada de verdad, se tapaba.
#
#   1. CASO: rol viejo + corrida SDK fresca sin marcador → SESION MUDA (el SDK no la tapa)
#   2. CONTROL: rol viejo + ventana VSCode fresca sin marcador → AVISO (la regla de callar sigue)
#   3. El entrypoint puede estar después de los primeros 20 KB (review con diff largo)
set -uo pipefail
# Todo con here-string: `productor | grep -q` con pipefail miente por SIGPIPE.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIG="$SCRIPT_DIR/../vigilancia-check.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

mkdir -p "$TMP/buzon"/{abierto,en-curso,cerrado}

escenario() { # $1 = dir · $2 = entrypoint de la ventana fresca sin rol
  mkdir -p "$1"
  # BACKEND con su cron, callada hace 60 min
  printf '%s\n' '{"type":"user","entrypoint":"claude-vscode","message":{"content":"Monitor de PARÁLISIS (sesión BACKEND)."}}' > "$1/backend.jsonl"
  touch -d '-60 minutes' "$1/backend.jsonl"
  # ventana fresca sin marcador; el entrypoint va DESPUÉS de 25 KB de relleno (caso 3)
  { printf '{"type":"user","message":{"content":"Review this change: %s"}}\n' "$(head -c 25000 /dev/zero | tr '\0' 'x')"
    printf '{"type":"assistant","entrypoint":"%s"}\n' "$2"; } > "$1/fresca.jsonl"
}
correr() {
  BUZON_DIR="$TMP/buzon" TRANSCRIPTS_DIR="$1" TRANSCRIPTS_EXTRA_DIRS="" bash "$VIG" --quiet --dry-run 2>&1
}

echo "── 1. CASO: corrida SDK fresca no tapa a la sesión muda ──"
escenario "$TMP/sdk" sdk-py
sal="$(correr "$TMP/sdk")"
if grep -qF "SESION MUDA: BACKEND" <<< "$sal"; then ok "SESION MUDA: BACKEND"; else fail "no alarma la muda: $sal"; fi
if grep -qF "SIN rol" <<< "$sal"; then fail "la corrida SDK sigue contando como ventana sin rol"; else ok "el SDK no es ventana sin rol"; fi

echo "── 2. CONTROL: ventana VSCode fresca sin marcador → AVISO ──"
escenario "$TMP/vscode" claude-vscode
sal="$(correr "$TMP/vscode")"
if grep -qF "SIN rol identificable" <<< "$sal"; then ok "AVISO de ventana sin rol"; else fail "la regla de callar se rompió: $sal"; fi

echo
if [ "$fallos" -eq 0 ]; then echo "✅ test-vigilancia-ignora-corridas-sdk: OK"; exit 0; fi
echo "❌ test-vigilancia-ignora-corridas-sdk: $fallos fallo(s)"; exit 1
