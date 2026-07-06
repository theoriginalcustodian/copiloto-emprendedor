#!/usr/bin/env bash
# sync-motor.sh — mantiene `motor/` (vendorizado) alineado con el arquetipo `conversational_agent`
# de la fábrica `unreal-copilot`, hasta el fork duro. Patrón vendorizar-con-sync (fleet-platform).
#
#   ./scripts/sync-motor.sh check   → reporta drift (dry-run, no muta)
#   ./scripts/sync-motor.sh sync    → actualiza motor/ desde la fábrica (revisar el git diff después)
#
# La fábrica se ubica con UC_FABRICA_PATH (default: ../unreal-copilot).
set -euo pipefail

FABRICA="${UC_FABRICA_PATH:-../unreal-copilot}"
SRC="$FABRICA/deploy/skeleton_kit/archetypes/conversational_agent/reference"
DST="motor"

cd "$(dirname "$0")/.."   # raíz del repo

if [ ! -d "$SRC" ]; then
  echo "ERROR: no encuentro el arquetipo en '$SRC'. Seteá UC_FABRICA_PATH al checkout de unreal-copilot." >&2
  exit 1
fi

case "${1:-check}" in
  check)
    echo "== drift motor/ vs fábrica ($SRC) =="
    if diff=$(rsync -rcn --delete --out-format='%n' "$SRC/" "$DST/" | grep -v '/$'); [ -n "$diff" ]; then
      echo "$diff"; echo "-- hay drift (corré 'sync' para alinear) --"; exit 1
    else
      echo "sin drift ✓"
    fi ;;
  sync)
    rsync -rc --delete "$SRC/" "$DST/"
    echo "motor/ sincronizado desde $SRC. Revisá y commiteá:"
    git status --short motor/ ;;
  *)
    echo "uso: $0 [check|sync]" >&2; exit 1 ;;
esac
