#!/usr/bin/env bash
# scripts/graph-sync.sh — sync del grafo de código, SIEMPRE desde origin/main.
#
# Por qué un worktree dedicado y no este checkout (decisión del operador, 2026-07-31):
# graphify parsea el WORKING TREE EN DISCO y sella `valid_at` con la fecha de HEAD. El checkout de
# trabajo lo comparten 3 sesiones y vive en una rama — llegó a estar 111 commits detrás de main, así
# que el grafo quedaba con contenido de hoy y fecha de hace 4 días, y podía contener código que no
# estaba en ninguna rama. Clavando un árbol en origin/main, contenido y fecha salen del MISMO ref.
#
# El grafo es el modelo que la app tiene de sí misma y lo consume el ciclo de autosanación: si
# describe otra cosa que la desplegada, el sanador razona sobre código que no fallo. Para el backend
# —lo que el sanador parchea— main EQUIVALE a prod, porque el gate de drift de `deploy.sh` aborta si
# `apps/copiloto` o `motor` difieren de origin/main.
#
# Uso:  bash scripts/graph-sync.sh            # actualiza el worktree a origin/main y sincroniza
#       UC_GRAPH_FORCE=1 bash scripts/...     # además saltea el tope del reconcile (ver abajo)
#
# Antes de usar UC_GRAPH_FORCE=1, correr el dry-run y MIRAR la lista:
#   cd "$BRIDGE" && uv run python <repo>/scripts/graphity_dry_run_reconcile.py \
#       --config config/repos.toml --repo copiloto-emprendedor
# `--force` sin haber mirado es un borrado a ciegas: el guard del reconcile existe justamente para
# frenar eso, y ya cazó una anomalía real (221 objetos, 2026-07-31).
set -euo pipefail

BRIDGE="${GRAPHITY_BRIDGE_PATH:-C:/Proyectos/Claude/Claude code/graphify-graphity-bridge}"
CKPT=".bridge/checkpoint-copiloto-emprendedor.db"
WT="${UC_GRAPH_WORKTREE:-C:/gfw-src/copiloto-main}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ -d "$BRIDGE" ] || { echo "[graph-sync] ❌ no encuentro el bridge en '$BRIDGE' — seteá GRAPHITY_BRIDGE_PATH." >&2; exit 1; }
command -v uv >/dev/null 2>&1 || { echo "[graph-sync] ❌ 'uv' no está en el PATH." >&2; exit 1; }

# Guarda dura: el worktree del grafo NO puede ser el checkout de trabajo. Si lo fuera, este script
# haría `checkout --detach` sobre el árbol donde otra sesión está trabajando y le volaría el WIP.
if [ "$(cd "$WT" 2>/dev/null && pwd || echo _)" = "$(cd "$REPO" && pwd)" ]; then
  echo "[graph-sync] ❌ UC_GRAPH_WORKTREE apunta al checkout de trabajo ('$REPO')." >&2
  echo "[graph-sync]    Este script hace 'checkout --detach' sobre él: pisaría el trabajo de otra sesión." >&2
  exit 1
fi

echo "[graph-sync] actualizando el árbol del grafo a origin/main…"
git -C "$REPO" fetch origin main --quiet
if [ ! -d "$WT" ]; then
  echo "[graph-sync] (el worktree no existía — creándolo en '$WT')"
  git -C "$REPO" worktree add --detach "$WT" origin/main
else
  # Worktree DEDICADO y detached: acá `checkout --detach` es seguro (no es el checkout compartido,
  # no hay rama que perder, no hay WIP). La regla de "nunca checkout" aplica al árbol de trabajo.
  git -C "$WT" checkout --detach origin/main --quiet
  git -C "$WT" clean -qfd    # restos de un sync anterior no pueden entrar al grafo como código vivo
fi

SHA="$(git -C "$WT" rev-parse HEAD)"
ESPERADO="$(git -C "$REPO" rev-parse origin/main)"
# Control positivo: sin esto, un fetch fallido o un worktree trabado sincronizaría un árbol viejo y
# el sync reportaría OK igual — que es exactamente el modo de fallo que originó este script.
[ "$SHA" = "$ESPERADO" ] || { echo "[graph-sync] ❌ el árbol quedó en $SHA y origin/main es $ESPERADO." >&2; exit 1; }
echo "[graph-sync] árbol en origin/main @ ${SHA:0:12} ✓"

cd "$BRIDGE"
echo "[graph-sync] sincronizando (graphify + ingest + reconcile)…"
if [ -n "${UC_GRAPH_FORCE:-}" ]; then
  uv run bridge --config config/repos.toml --repo copiloto-emprendedor sync --checkpoint "$CKPT" --force
else
  uv run bridge --config config/repos.toml --repo copiloto-emprendedor sync --checkpoint "$CKPT"
fi
# Marcador del ÚLTIMO SHA SINCRONIZADO CON ÉXITO. Se escribe recién acá, después del sync: si el
# sync falla, el marcador queda viejo y el próximo push vuelve a intentar. Usar el HEAD del worktree
# como marcador sería un instrumento que confirma — quedaría en main aunque el sync hubiera reventado.
mkdir -p "$BRIDGE/.bridge"
printf '%s\n' "$SHA" > "$BRIDGE/.bridge/last-synced-copiloto-emprendedor.sha"
echo "[graph-sync] ✅ grafo sincronizado desde origin/main @ ${SHA:0:12}"
