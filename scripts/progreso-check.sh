#!/usr/bin/env bash
# progreso-check.sh — ¿hay trabajo acumulándose sin commitear / sin pushear / sin PR / mergeado
# pero con el worktree todavía vivo?
#
# CAUSA RAÍZ que resuelve (pedido del operador 2026-08-13, después de la auditoría D15): el barrido
# de 40 worktrees fue una foto manual, de una vez. Sin un chequeo recurrente, el mismo patrón vuelve
# a acumularse en silencio hasta la próxima auditoría manual — que sólo pasa cuando alguien la pide.
# Este script convierte esa foto en un chequeo barato y determinista, recorrible en cada ciclo de
# vigilancia (se compone en vigilancia-check.sh, igual que cola-check.sh/escaladores-buzon.sh).
#
# Qué mide, por cada worktree de `git worktree list` con rama real (no detached, no main):
#   a) WIP sin commitear — `git status --short` no vacío.
#   b) Commits sin pushear — HEAD adelante de su upstream (o sin upstream siquiera).
#   c) Pusheada pero sin ningún PR (abierto o cerrado) — nadie iba a mergear eso nunca por esa vía.
#   d) PR ya MERGEADO pero el worktree sigue vivo — candidato a limpieza (patrón D15 exacto).
#
# Requiere `gh` autenticado contra el repo. Si `gh` no está disponible, (c)/(d) se saltean con aviso
# — (a)/(b) son git puro y corren igual.
#
# Uso:
#   scripts/progreso-check.sh            # imprime siempre, con veredicto
#   scripts/progreso-check.sh --quiet    # sólo imprime si hay algo que atender
# Exit code: 0 = nada que atender · 1 = hay hallazgos (stdout es el reporte).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UMBRAL_WIP_MIN="${UMBRAL_WIP_MIN:-30}"
QUIET=0
for arg in "$@"; do [ "$arg" = "--quiet" ] && QUIET=1; done

GH_OK=1
command -v gh >/dev/null 2>&1 || GH_OK=0

hallazgos=()
add() { hallazgos+=("$1"); }

have_gh_pr_cache=""
gh_pr_para_rama() {   # imprime "STATE\tNUMBER" de cualquier PR (todo estado) para la rama, o nada
  local rama="$1"
  [ "$GH_OK" = "1" ] || return 0
  # `.[0]` solo (sin `// empty`) sobre un array vacío da `null` en jq, y la interpolación de string
  # lo vuelve el literal "null\tnull" — NO vacío. El chequeo `[ -z "$pr_info" ]` de más abajo
  # (pensado para "esta rama no tiene ningún PR") nunca disparaba: caía al `else`, comparaba
  # "null" contra "MERGED" (falso) y la rama quedaba sin alarma posible, ni huérfano ni sin-PR.
  # Probado en vivo (2026-08-13, bash -x): 3 de 5 worktrees reales tenían este patrón. `// empty`
  # hace que `pr_info` sea el string vacío real cuando no hay PR, que es lo que el resto del script
  # ya esperaba.
  gh pr list --repo "$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null | sed -E 's#.*github.com[:/]##; s#\.git$##')" \
    --head "$rama" --state all --json state,number --jq '.[0] // empty | "\(.state)\t\(.number)"' 2>/dev/null
}

# `git worktree list` (sin --porcelain) alinea en columnas separadas por espacio — con paths que
# TIENEN espacios (este mismo repo: "Claude Claude code/copiloto-emprendedor") un `awk '{print $1}'`
# corta el path a la mitad y todo lo demás falla en silencio (probado en vivo: `continue` por
# "directorio no existe" en LOS 9 worktrees, cero hallazgos con WIP real de 23h de antigüedad
# sentado ahí). `--porcelain` da un registro por línea sin ambigüedad de columnas.
procesar_worktree() {
  local wt_path="$1" rama="$2" etiqueta sucio ultimo_mtime f ap m edad n_archivos
  local upstream ahead sin_pushear pr_info estado numero

  etiqueta="$(basename "$wt_path")"

  # (a) WIP sin commitear, con antigüedad mínima (evita alarmar sobre un worktree recién tocado)
  sucio="$(git -C "$wt_path" status --porcelain 2>/dev/null)"
  if [ -n "$sucio" ]; then
    ultimo_mtime=0
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      ap="$wt_path/$f"
      [ -f "$ap" ] || continue
      m="$(stat -c %Y "$ap" 2>/dev/null || echo 0)"
      [ "$m" -gt "$ultimo_mtime" ] && ultimo_mtime="$m"
    done < <(printf '%s\n' "$sucio" | awk '{print $NF}')
    if [ "$ultimo_mtime" -gt 0 ]; then
      edad=$(( ($(date +%s) - ultimo_mtime) / 60 ))
      if [ "$edad" -ge "$UMBRAL_WIP_MIN" ]; then
        n_archivos=$(printf '%s\n' "$sucio" | grep -c .)
        add "WIP SIN COMMITEAR: $etiqueta [$rama] — $n_archivos archivo(s), el más reciente hace ${edad}min."
      fi
    fi
  fi

  # (b) commits sin pushear — comparado contra `origin/<rama>`, NO contra `@{u}` (tracking local).
  # `@{u}` requiere que la rama tenga configurado `branch.<rama>.remote` — una rama puede estar
  # 100% pusheada y en sync con origin sin esa config local (falso positivo probado en vivo: el
  # propio checkout raíz, `docs/production-readiness-brief`, está IDÉNTICO a
  # `origin/docs/production-readiness-brief` pero sin upstream configurado — "NUNCA PUSHEADA" habría
  # sido una mentira). Lo único que importa es si el REMOTO tiene la rama y si HEAD la alcanza.
  if git -C "$wt_path" rev-parse --verify --quiet "refs/remotes/origin/$rama" >/dev/null; then
    upstream="origin/$rama"
    sin_pushear="$(git -C "$wt_path" rev-list --count "origin/$rama..HEAD" 2>/dev/null || echo 0)"
    [ "${sin_pushear:-0}" -gt 0 ] 2>/dev/null && add "SIN PUSHEAR: $etiqueta [$rama] — $sin_pushear commit(s) adelante de $upstream."
  else
    upstream=""
    ahead="$(git -C "$wt_path" rev-list --count main.."$rama" 2>/dev/null || echo 0)"
    [ "${ahead:-0}" -gt 0 ] 2>/dev/null && add "NUNCA PUSHEADA: $etiqueta [$rama] — $ahead commit(s) locales, la rama no existe en origin."
  fi

  # (c)/(d) estado del PR — SIEMPRE se consulta por nombre de rama (no depende de si el ref
  # `origin/<rama>` sigue existiendo LOCAL): GitHub borra la rama remota al mergear por default, así
  # que el caso más común de (d) es EXACTAMENTE el que un gate atado al ref local se perdería —
  # probado en vivo: `c6-cotas-chat-listas` tiene PR #410 MERGEADO pero `origin/<rama>` ya no existe
  # (borrada post-merge) y `gh pr list --head` la sigue encontrando igual, porque le pregunta a
  # GitHub, no al repo local.
  if [ "$GH_OK" = "1" ]; then
    pr_info="$(gh_pr_para_rama "$rama")"
    if [ -z "$pr_info" ]; then
      [ -n "$upstream" ] && add "PUSHEADA SIN PR: $etiqueta [$rama] — nadie la va a mergear por esta vía."
    else
      estado="$(printf '%s' "$pr_info" | cut -f1)"
      numero="$(printf '%s' "$pr_info" | cut -f2)"
      if [ "$estado" = "MERGED" ]; then
        add "WORKTREE HUÉRFANO: $etiqueta [$rama] — PR #$numero ya MERGEADO, el worktree sigue vivo (candidato a 'git worktree remove')."
      fi
    fi
  fi
}

# `git worktree list` (sin --porcelain) alinea en columnas separadas por espacio — con paths que
# TIENEN espacios (este mismo repo: "Claude Claude code/copiloto-emprendedor") un `awk '{print $1}'`
# corta el path a la mitad y todo lo demás falla en silencio (probado en vivo: `continue` por
# "directorio no existe" en LOS 9 worktrees, cero hallazgos con WIP real de 23h de antigüedad
# sentado ahí). `--porcelain` da un registro por línea sin ambigüedad de columnas — un bloque por
# worktree, separado por línea en blanco, sin garantía de blank final => se cierra el último bloque
# explícitamente después del loop.
wt_path=""; rama=""
while IFS= read -r linea; do
  case "$linea" in
    "worktree "*)
      if [ -n "$wt_path" ] && [ -n "$rama" ] && [ "$rama" != "main" ] && [ -d "$wt_path" ]; then
        procesar_worktree "$wt_path" "$rama"
      fi
      wt_path="${linea#worktree }"; rama=""
      ;;
    "branch "*) rama="${linea#branch refs/heads/}" ;;
  esac
done < <(git -C "$REPO_ROOT" worktree list --porcelain 2>/dev/null)
# último bloque del listado — no le sigue otra línea "worktree " que lo dispare
if [ -n "$wt_path" ] && [ -n "$rama" ] && [ "$rama" != "main" ] && [ -d "$wt_path" ]; then
  procesar_worktree "$wt_path" "$rama"
fi

if [ "${#hallazgos[@]}" -gt 0 ]; then
  printf '%s\n' "${hallazgos[@]}"
  [ "$GH_OK" = "0" ] && printf '%s\n' "(gh no disponible: (c)/(d) no se pudieron chequear)"
  exit 1
fi
[ "$QUIET" = "1" ] || echo "PROGRESO: sin acumulación detectada — $(date '+%Y-%m-%d %H:%M')."
exit 0
