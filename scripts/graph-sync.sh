#!/usr/bin/env bash
# scripts/graph-sync.sh — sync VERIFICADO del grafo de código, SIEMPRE desde origin/main.
# Camino ÚNICO de invocación: .githooks/pre-push llama a ESTE script (no duplica `uv run bridge`
# inline), así el hook, el uso manual y cualquier agente en background heredan la misma verificación.
#
# Por qué un worktree dedicado y no este checkout (decisión del operador, 2026-07-31):
# graphify parsea el WORKING TREE EN DISCO y sella `valid_at` con la fecha de HEAD. El checkout de
# trabajo lo comparten 3 sesiones y vive en una rama — llegó a estar 111 commits detrás de main, así
# que el grafo quedaba con contenido de hoy y fecha de hace 4 días, y podía contener código que no
# estaba en ninguna rama. Clavando un árbol en origin/main, contenido y fecha salen del MISMO ref.
#
# El grafo es el modelo que la app tiene de sí misma y lo consume el ciclo de autosanación: si
# describe otra cosa que la desplegada, el sanador razona sobre código que no falló. Para el backend
# —lo que el sanador parchea— main EQUIVALE a prod, porque el gate de drift de `deploy.sh` aborta si
# `apps/copiloto` o `motor` difieren de origin/main.
#
# Por qué además "verificado" (evidencia 2026-07-24, tasks/b12f3vc5e.output): un sync reportó
# `exit 0` con `GraphityError: timeout` adentro. Causa raíz: en algún caller, un pipe
# (`cmd | tail`) devolvía el status de `tail`, no el del sync real — un instrumento así no
# falla, CONFIRMA (da permiso para seguir aunque el grafo haya quedado desactualizado).
# Esta envoltura cierra las 3 capas del gancho:
#   1. captura el status del comando REAL vía PIPESTATUS (no el de un pipe intermedio);
#   2. grepea su propia salida buscando patrones de error conocidos aunque el status sea 0
#      (defensa en profundidad: cubre también un futuro caller que trague el exit code, o
#      un cambio del CLI que empiece a atrapar GraphityError y devuelva 0 por error);
#   3. cierra con un control positivo automático (graphity_positive_control.py): busca en
#      Graphity un símbolo del commit recién sincronizado y falla ruidoso si no aparece —
#      la única de las tres capas que prueba que el dato llegó al servidor, no solo que el
#      proceso local no explotó.
#
# Uso:
#   bash scripts/graph-sync.sh                  # actualiza el worktree a origin/main y sincroniza (completo)
#   bash scripts/graph-sync.sh --since <ref>     # incremental desde <ref> (lo usa el pre-push hook)
#   UC_GRAPH_FORCE=1 bash scripts/graph-sync.sh  # además saltea el tope del reconcile (ver abajo)
#
# Antes de usar UC_GRAPH_FORCE=1, correr el dry-run y MIRAR la lista:
#   cd "$BRIDGE" && uv run python <repo>/scripts/graphity_dry_run_reconcile.py \
#       --config config/repos.toml --repo copiloto-emprendedor
# `--force` sin haber mirado es un borrado a ciegas: el guard del reconcile existe justamente para
# frenar eso, y ya cazó una anomalía real (221 objetos, 2026-07-31).
#
# Nota: sin -e a propósito — necesitamos leer PIPESTATUS y decidir nosotros, no abortar en
# la línea del pipe antes de poder inspeccionar qué pasó.
set -uo pipefail

BRIDGE="${GRAPHITY_BRIDGE_PATH:-C:/Proyectos/Claude/Claude code/graphify-graphity-bridge}"
REPO_NAME="${GRAPHITY_REPO_NAME:-copiloto-emprendedor}"
CKPT=".bridge/checkpoint-${REPO_NAME}.db"
WT="${UC_GRAPH_WORKTREE:-C:/gfw-src/copiloto-main}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POSITIVE_CONTROL="$SCRIPT_DIR/graphity_positive_control.py"

SINCE=""
if [ "${1:-}" = "--since" ]; then
  SINCE="${2:-}"
  if [ -z "$SINCE" ]; then
    echo "[graph-sync] ❌ --since requiere un ref git." >&2
    exit 2
  fi
fi

if [ ! -d "$BRIDGE" ]; then
  echo "[graph-sync] ❌ no encuentro el bridge en '$BRIDGE' — seteá GRAPHITY_BRIDGE_PATH." >&2
  exit 1
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "[graph-sync] ❌ 'uv' no está en el PATH." >&2
  exit 1
fi

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
# Control positivo del ÁRBOL: sin esto, un fetch fallido o un worktree trabado sincronizaría un árbol
# viejo y el sync reportaría OK igual — que es exactamente el modo de fallo que originó este script.
[ "$SHA" = "$ESPERADO" ] || { echo "[graph-sync] ❌ el árbol quedó en $SHA y origin/main es $ESPERADO." >&2; exit 1; }
echo "[graph-sync] árbol en origin/main @ ${SHA:0:12} ✓"

if [ -n "$SINCE" ]; then
  echo "[graph-sync] sync incremental de ${REPO_NAME} desde ${SINCE:0:12}…"
else
  echo "[graph-sync] sync completo de ${REPO_NAME}…"
fi

# Patrones de error que un exit 0 puede estar ocultando. GraphityError = el visto en el
# incidente; Traceback = cualquier excepción Python no atrapada; "abortado:"/"reconcile
# abortado:" = lo que imprime cli/main.py._run_reconcile y orchestrator/sync.py ante
# ReconcileError (umbral de borrado superado).
_ERROR_GREP='GraphityError|Traceback \(most recent call last\)|^abortado:|reconcile abortado:'

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

(
  cd "$BRIDGE"
  FORCE_FLAG=()
  [ -n "${UC_GRAPH_FORCE:-}" ] && FORCE_FLAG=(--force)
  if [ -n "$SINCE" ]; then
    uv run bridge --config config/repos.toml --repo "$REPO_NAME" sync \
      --checkpoint "$CKPT" --since "$SINCE" "${FORCE_FLAG[@]}"
  else
    uv run bridge --config config/repos.toml --repo "$REPO_NAME" sync \
      --checkpoint "$CKPT" "${FORCE_FLAG[@]}"
  fi
) 2>&1 | tee "$OUT"
sync_status="${PIPESTATUS[0]}"

if [ "$sync_status" -ne 0 ]; then
  echo "[graph-sync] ❌ el sync salió con status ${sync_status}." >&2
  exit "$sync_status"
fi
if grep -Eq "$_ERROR_GREP" "$OUT"; then
  echo "[graph-sync] ❌ exit 0 pero la salida tiene un patrón de error conocido (ver arriba) — tratado como fallo." >&2
  exit 1
fi

(
  cd "$BRIDGE"
  if [ -n "$SINCE" ]; then
    uv run python "$POSITIVE_CONTROL" --config config/repos.toml --repo "$REPO_NAME" --since "$SINCE"
  else
    uv run python "$POSITIVE_CONTROL" --config config/repos.toml --repo "$REPO_NAME"
  fi
)
pc_status=$?

if [ "$pc_status" -eq 1 ]; then
  echo "[graph-sync] ❌ control positivo FALLÓ — el grafo remoto no tiene el símbolo esperado." >&2
  exit 1
elif [ "$pc_status" -eq 2 ]; then
  echo "[graph-sync] ⚠️  control positivo no aplicable en este rango (ver arriba) — sync OK igual."
elif [ "$pc_status" -ne 0 ]; then
  echo "[graph-sync] ❌ control positivo terminó con status inesperado (${pc_status})." >&2
  exit 1
fi

# Marcador del ÚLTIMO SHA SINCRONIZADO CON ÉXITO. Se escribe recién acá, al final, después de las
# 3 capas de verificación: si cualquiera falla, el marcador queda viejo y el próximo push reintenta.
# Usar el HEAD del worktree como marcador sería un instrumento que confirma — quedaría en main aunque
# el sync/control positivo hubieran reventado. Lo consume .githooks/pre-push para decidir si hace
# falta sincronizar en absoluto.
mkdir -p "$BRIDGE/.bridge"
printf '%s\n' "$SHA" > "$BRIDGE/.bridge/last-synced-copiloto-emprendedor.sha"
echo "[graph-sync] ✅ grafo sincronizado y verificado desde origin/main @ ${SHA:0:12} (checkpoint: $BRIDGE/$CKPT)"
