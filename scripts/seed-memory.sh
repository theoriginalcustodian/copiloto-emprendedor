#!/usr/bin/env bash
# scripts/seed-memory.sh — siembra la memoria VERSIONADA del repo (memoria/) en el directorio de
# auto-memory de Claude Code para ESTE checkout, de modo que una sesión nueva arranque con el
# contexto completo del proyecto. Parte del init cero-fricción (ver HANDOFF.md).
#
# Claude Code guarda la auto-memory en ~/.claude/projects/<slug>/memory/, donde <slug> deriva del
# PATH del checkout. Este script copia memoria/ -> ese slug dir. La fuente de verdad es memoria/
# (versionada, viaja con el repo); el slug dir es solo la copia que el harness levanta.
#
#   ./scripts/seed-memory.sh                      # autodetecta el slug dir; lo crea si falta
#   CLAUDE_MEM_DIR=/ruta/al/memory ./scripts/seed-memory.sh   # override explícito
#
# IDEMPOTENTE: rsync --delete (o cp) espeja memoria/ -> destino; re-corrible N veces.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO/memoria"
[ -d "$SRC" ] || { echo "ERROR: no existe $SRC (¿corriste desde el repo?)" >&2; exit 1; }

PROJECTS="$HOME/.claude/projects"

# Deriva el slug de Claude Code para este checkout (bash puro, sin depender de python).
# /c/A/B/copiloto-emprendedor  ->  C:\A\B\...  ->  c--A-B-...-copiloto-emprendedor
default_slug() {
  local drive rest win slug first
  drive="$(printf '%s' "$REPO" | sed -E 's,^/([a-zA-Z])/.*,\1,')"
  rest="$(printf '%s' "$REPO" | sed -E 's,^/[a-zA-Z]/,,')"
  win="${drive}:\\${rest//\//\\}"                     # path estilo Windows con backslashes
  slug="$(printf '%s' "$win" | sed -E 's,[:\\/ ],-,g')"  # : \ / espacio -> '-'
  first="$(printf '%s' "${slug:0:1}" | tr 'A-Z' 'a-z')"  # drive a minúscula
  printf '%s%s' "$first" "${slug:1}"
}

DEST="${CLAUDE_MEM_DIR:-}"
if [ -z "$DEST" ]; then
  # 1) un slug dir YA existente para este repo (proyecto abierto al menos una vez en Claude Code)
  found="$(ls -d "$PROJECTS"/*copiloto-emprendedor 2>/dev/null | head -1 || true)"
  if [ -n "$found" ]; then
    DEST="$found/memory"
  else
    # 2) primera vez: computar el slug y crear el dir
    slug="$(default_slug)"
    [ -n "$slug" ] || { echo "ERROR: no pude derivar el slug; pasá CLAUDE_MEM_DIR=..." >&2; exit 1; }
    DEST="$PROJECTS/$slug/memory"
  fi
fi

mkdir -p "$DEST"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$SRC"/ "$DEST"/
else
  find "$DEST" -mindepth 1 -delete 2>/dev/null || true
  cp -a "$SRC"/. "$DEST"/
fi
echo "memoria sembrada -> $DEST ($(ls -1 "$DEST"/*.md 2>/dev/null | wc -l) archivos .md)"
