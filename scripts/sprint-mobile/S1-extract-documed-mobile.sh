#!/usr/bin/env bash
# S1 — Extrae el árbol mobile de documed@<REF> a un staging read-only.
#
# Por qué script y no sub-agente: es UNA operación git. Que N agentes hagan
# `git show` sobre ~180 archivos cada uno quema ~200k tokens en re-leer lo mismo.
# Se extrae una vez, todos consumen el staging.
#
# documed es READ-ONLY: este script sólo LEE de ese repo (git archive), nunca escribe.
# Idempotente: re-correr con el mismo REF no cambia nada (compara el SHA guardado).
set -euo pipefail

REF="${1:-a6841474ac7b50d24d55112b09fb8d62852a5ae5}"
DOCUMED="${DOCUMED_REPO:-/c/Proyectos/Claude/Claude code/Agencia_IA_HyC/documed}"
DEST="${STAGING_DIR:-_staging/documed}"

# Subárboles a traer. `packages/core` viaja porque es el núcleo hexagonal que
# consumen tanto mobile como (a futuro) web — ver plan §2.
SUBTREES=(apps/mobile packages/core)

log() { printf '[S1] %s\n' "$*"; }
fail() { printf '[S1] ERROR: %s\n' "$*" >&2; exit 1; }

[ -d "$DOCUMED/.git" ] || fail "no encuentro el repo documed en '$DOCUMED' (seteá DOCUMED_REPO)"

# El REF tiene que existir Y ser un commit — un tag/rama movible rompería el pin.
FULL_SHA="$(git -C "$DOCUMED" rev-parse --verify "${REF}^{commit}" 2>/dev/null)" \
  || fail "el ref '$REF' no existe en documed"

STAMP="$DEST/.extracted-sha"
if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$FULL_SHA" ]; then
  log "ya extraído en $FULL_SHA — nada que hacer (idempotente)"
  exit 0
fi

log "extrayendo documed@${FULL_SHA:0:12} → $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"

for sub in "${SUBTREES[@]}"; do
  if ! git -C "$DOCUMED" cat-file -e "${FULL_SHA}:${sub}" 2>/dev/null; then
    fail "el subárbol '$sub' no existe en $FULL_SHA"
  fi
  mkdir -p "$DEST/$sub"
  # `git archive` en un solo pipe: sin checkout, sin tocar el working tree de documed.
  git -C "$DOCUMED" archive "$FULL_SHA" "$sub" | tar -x -C "$DEST" --strip-components=0
  log "  ✓ $sub"
done

echo "$FULL_SHA" > "$STAMP"

# Control de integridad: lo extraído debe coincidir con lo que git dice que hay.
# Un conteo que no cierra es la señal de que el archive se truncó — y truncarse
# en silencio es exactamente el modo de fallo que un "parece que anduvo" no ve.
for sub in "${SUBTREES[@]}"; do
  esperado=$(git -C "$DOCUMED" ls-tree -r --name-only "$FULL_SHA" -- "$sub" | wc -l | tr -d ' ')
  real=$(find "$DEST/$sub" -type f | wc -l | tr -d ' ')
  if [ "$esperado" != "$real" ]; then
    fail "conteo no cierra en '$sub': git dice $esperado, extraje $real"
  fi
  log "  ✓ $sub — $real archivos (coincide con git ls-tree)"
done

log "OK — staging listo en $DEST @ ${FULL_SHA:0:12}"
