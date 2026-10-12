#!/usr/bin/env bash
# mi-buzon.sh <rol> [--todo] — "¿qué hay en el buzón PARA MÍ, sin lo que yo emití?"
#
# Existe porque cada prompt de monitoreo tenía la regla escrita a mano —`-a-<rol>_` y `-a-todos_`—
# y esos dos globs NO ven los destinos COMPUESTOS, que la convención sí produce
# (`-a-backend-y-planificacion_`, `-a-planificacion-backend-y-frontend2_`). El 2026-10-12
# planificación midió 9 mensajes invisibles por eso, uno un `urgente_` de 5 días. La regla no se
# vuelve a escribir en ningún prompt: se invoca este script, que delega en me_interpela()
# (lib/buzon-roles.sh) — la MISMA definición que usa el gate de vigilancia.
#
# Uso:  bash scripts/mi-buzon.sh planificacion
#       bash scripts/mi-buzon.sh backend --todo     # incluye en-curso/ y cerrado/<hoy>/
# Salida: un nombre por línea, más viejo primero (la antigüedad es la prioridad).
# Exit:  0 siempre que pudo mirar · 2 si no encuentra el buzón o falta el rol.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/buzon-roles.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/buzon-roles.sh"

ROL="${1:-}"
[ -z "$ROL" ] && { echo "uso: mi-buzon.sh <rol> [--todo]" >&2; exit 2; }
TODO=0; [ "${2:-}" = "--todo" ] && TODO=1

# `coordinacion/` NO está versionada y existe UNA sola vez: en el checkout principal. Derivarla del
# root de ESTE script dejaría al script ciego desde cualquier worktree, que es el caso NORMAL.
# Bloque gemelo de a-todos-sin-cierre.sh / archivar-buzon.sh / cola-check.sh, a propósito.
resolver_buzon() {
  if [ -n "${BUZON_DIR:-}" ]; then
    printf '%s' "$BUZON_DIR"
  elif [ -d "$REPO_ROOT/coordinacion" ]; then
    printf '%s' "$REPO_ROOT/coordinacion"
  else
    local gc
    gc="$(git -C "$REPO_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
    if [ -n "$gc" ]; then printf '%s' "$(dirname "$gc")/coordinacion"
    else printf '%s' "$REPO_ROOT/coordinacion"; fi
  fi
}
BUZON="$(resolver_buzon)"
[ -d "$BUZON" ] || { echo "mi-buzon: no encuentro el buzón ($BUZON)" >&2; exit 2; }

dirs=("$BUZON/abierto")
if [ "$TODO" = "1" ]; then
  dirs+=("$BUZON/en-curso")
  hoy="$(date +%Y-%m-%d)"
  [ -d "$BUZON/cerrado/$hoy" ] && dirs+=("$BUZON/cerrado/$hoy")
fi

# Se ordena por mtime ASCENDENTE: lo más viejo primero. Un buzón ordenado por nombre pone adelante
# lo más nuevo y entierra justo lo que lleva días sin leer — que es lo único que urge.
for d in "${dirs[@]}"; do
  [ -d "$d" ] || continue
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    n="$(basename -- "$f")"
    me_interpela "$ROL" "$n" || continue
    # Lo que YO emití no es novedad para mí: notificarlo es ruido disfrazado de mensaje. Se mide
    # con emisor_de_nombre(), no con un prefijo a mano, porque `frontend1-a-` y `frontend-a-` son
    # el mismo emisor para el frente de UI y un `case` suelto se olvida de uno de los dos.
    [ "$(emisor_de_nombre "$n")" = "$ROL" ] && continue
    printf '%s\n' "$n"
  done < <(find "$d" -maxdepth 1 -type f -name '*.md' -printf '%T@ %p\n' 2>/dev/null \
           | sort -n | cut -d' ' -f2-)
done
