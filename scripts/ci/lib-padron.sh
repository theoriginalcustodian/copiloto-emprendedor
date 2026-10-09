#!/usr/bin/env bash
# Padrón de ids AUTORIZADOS — UNA sola definición, consumida por el gate y por el goal.
#
# Por qué es una lib y no está copiada en los dos: el mismo defecto ya vivió dos veces en
# este repo y el fix llegó a una sola mitad (memoria/el-mismo-defecto-vivia-dos-veces-*).
# Acá viven el patrón de id y el descubrimiento del padrón; nadie los redefine.
#
# Se descubre por glob sobre lo versionado, NO se hardcodea. Dos fuentes, unidas:
#   1) el working tree del worktree actual
#   2) origin/main  — porque un worktree parado en una rama vieja NO tiene los docs nuevos:
#      medido 2026-10-08, el ARRANQUE del sprint mobile estaba en main y ausente del
#      checkout, así que todos los ids M-* se habrían reportado como FANTASMA.
# El padrón es un hecho compartido del repo, no del branch donde estás parado.

RE_ID='\b(BL-[A-Z0-9]+|DEC-[0-9]+|M-[0-9]+)\b'

# Patrón de nombre de los docs-padrón. `-acta-` va anclado con guiones a propósito:
# `*acta*` matcheaba «comp-ACTA-cion» (2026-07-22-compactacion-a-umbral-investigacion.md),
# metiendo un doc de investigación al padrón. Un glob laxo infla el padrón con ruido y
# un padrón inflado aprueba cualquier cosa.
RE_DOC_PADRON='(backlog|-acta-|ARRANQUE)'

padron_texto() {
  local raiz="${1:-.}" f
  # (1) working tree
  while IFS= read -r f; do [ -f "$f" ] && cat "$f"; done < <(
    find "$raiz/docs/copiloto-emprendedor" -maxdepth 1 -name '*.md' 2>/dev/null \
      | grep -E "$RE_DOC_PADRON" || true)
  # (2) origin/main (tolerante: si el ref no existe, no pasa nada)
  while IFS= read -r f; do
    [ -n "$f" ] && git -C "$raiz" show "origin/main:$f" 2>/dev/null
  done < <(git -C "$raiz" ls-tree -r --name-only origin/main -- docs/copiloto-emprendedor 2>/dev/null \
      | grep -E "$RE_DOC_PADRON" || true)
}

# Lista ordenada y única de ids autorizados.
padron_ids() { padron_texto "${1:-.}" | grep -ohE "$RE_ID" | sort -u; }

# Dónde vive un id: devuelve  <path>:<línea>|<texto de la línea>  o vacío si no está.
# Busca primero en el working tree (path clickeable) y después en origin/main.
padron_donde() {
  local id="$1" raiz="${2:-.}" f hit
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    hit="$(grep -nE "(^|[^A-Z0-9-])$id([^A-Z0-9-]|$)" "$f" | grep -E ':[[:space:]]*\|' | head -1)"
    [ -z "$hit" ] && hit="$(grep -nE "(^|[^A-Z0-9-])$id([^A-Z0-9-]|$)" "$f" | head -1)"
    if [ -n "$hit" ]; then
      printf '%s:%s|%s\n' "${f#$raiz/}" "${hit%%:*}" "$(printf '%s' "${hit#*:}" | sed 's/^[[:space:]]*//')"
      return 0
    fi
  done < <(find "$raiz/docs/copiloto-emprendedor" -maxdepth 1 -name '*.md' 2>/dev/null | grep -E "$RE_DOC_PADRON" || true)
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    hit="$(git -C "$raiz" show "origin/main:$f" 2>/dev/null | grep -nE "(^|[^A-Z0-9-])$id([^A-Z0-9-]|$)" | grep -E ':[[:space:]]*\|' | head -1)"
    if [ -n "$hit" ]; then
      printf 'origin/main:%s:%s|%s\n' "$f" "${hit%%:*}" "$(printf '%s' "${hit#*:}" | sed 's/^[[:space:]]*//')"
      return 0
    fi
  done < <(git -C "$raiz" ls-tree -r --name-only origin/main -- docs/copiloto-emprendedor 2>/dev/null | grep -E "$RE_DOC_PADRON" || true)
  return 1
}
