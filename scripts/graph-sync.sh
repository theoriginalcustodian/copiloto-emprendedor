#!/usr/bin/env bash
# scripts/graph-sync.sh — sync VERIFICADO del grafo de código. Camino ÚNICO de invocación
# del sync: .githooks/pre-push llama a ESTE script (no duplica `uv run bridge` inline), así
# el hook, el uso manual y cualquier agente en background heredan la misma verificación.
#
# Por qué "verificado" (evidencia 2026-07-24, tasks/b12f3vc5e.output): un sync reportó
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
#   bash scripts/graph-sync.sh                 # sync completo
#   bash scripts/graph-sync.sh --since <ref>    # incremental desde <ref> (lo usa el pre-push hook)
#
# Nota: sin -e a propósito — necesitamos leer PIPESTATUS y decidir nosotros, no abortar en
# la línea del pipe antes de poder inspeccionar qué pasó.
set -uo pipefail

BRIDGE="${GRAPHITY_BRIDGE_PATH:-C:/Proyectos/Claude/Claude code/graphify-graphity-bridge}"
REPO_NAME="copiloto-emprendedor"
CKPT=".bridge/checkpoint-${REPO_NAME}.db"
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
  if [ -n "$SINCE" ]; then
    uv run bridge --config config/repos.toml --repo "$REPO_NAME" sync \
      --checkpoint "$CKPT" --since "$SINCE"
  else
    uv run bridge --config config/repos.toml --repo "$REPO_NAME" sync \
      --checkpoint "$CKPT"
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

verify_since="${SINCE:-HEAD~1}"
(
  cd "$BRIDGE"
  uv run python "$POSITIVE_CONTROL" --config config/repos.toml --repo "$REPO_NAME" --since "$verify_since"
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

echo "[graph-sync] ✅ grafo sincronizado y verificado (checkpoint: $BRIDGE/$CKPT)"
