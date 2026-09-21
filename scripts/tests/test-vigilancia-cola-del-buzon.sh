#!/usr/bin/env bash
# test-vigilancia-cola-del-buzon.sh — el paso COLA lee el PLAN.md del buzón que se vigila.
#
# CASO REAL (21/09): planificación corre el vigilante desde un worktree con BUZON_DIR apuntando al
# buzón físico. cola-check.sh buscaba `coordinacion/PLAN.md` junto a SU script (el worktree, donde
# no existe) y el vigilante daba exit 1 en cada ciclo por «No existe PLAN.md»: alarma fija.
#
#   1. CASO: buzón con PLAN.md sano (hito arrancando) → el paso COLA no alarma
#   2. CONTROL POSITIVO: buzón con hito PENDIENTE sin arrancar → alarma con el id del hito
#      (prueba que el PLAN que lee es el del buzón, no que calló)
#   3. Nunca aparece «No existe» si el PLAN.md existe en el buzón
set -uo pipefail
# Todo con here-string: `productor | grep -q` con pipefail miente por SIGPIPE.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIG="$SCRIPT_DIR/../vigilancia-check.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

buzon() { # $1 = dir · $2 = estado del hito H9
  mkdir -p "$1"/{abierto,en-curso,cerrado}
  cat > "$1/PLAN.md" <<EOF
# plan de prueba
<!-- COLA-VIVA:INICIO -->
\`\`\`
H9 | hito de prueba | disparador de prueba | $2
\`\`\`
<!-- COLA-VIVA:FIN -->
EOF
}
correr() { # $1 = buzón
  mkdir -p "$TMP/transcripts"
  BUZON_DIR="$1" TRANSCRIPTS_DIR="$TMP/transcripts" bash "$VIG" --quiet --dry-run 2>&1
}

echo "── 1. CASO: PLAN sano en el buzón → sin alarma de COLA ──"
buzon "$TMP/sano" arrancando
sal="$(correr "$TMP/sano")"
if grep -qF "No existe" <<< "$sal"; then fail "sigue buscando el PLAN fuera del buzón: $sal"; else ok "no dice «No existe»"; fi
if grep -qF "COLA:" <<< "$sal"; then fail "alarma de COLA con hito arrancando: $sal"; else ok "sin alarma de COLA"; fi

echo "── 2. CONTROL POSITIVO: hito PENDIENTE en el buzón → alarma con su id ──"
buzon "$TMP/pendiente" pendiente
sal="$(correr "$TMP/pendiente")"
if grep -qF "hito H9 está PENDIENTE" <<< "$sal"; then ok "alarma con H9: lee el PLAN del buzón"; else fail "no vio el pendiente: $sal"; fi

echo
if [ "$fallos" -eq 0 ]; then echo "✅ test-vigilancia-cola-del-buzon: OK"; exit 0; fi
echo "❌ test-vigilancia-cola-del-buzon: $fallos fallo(s)"; exit 1
