#!/usr/bin/env bash
# scripts/graph-sync.sh — sync manual del grafo de código (mismo bridge que corre el pre-push hook).
#
# Cuándo: para adelantar el PRIMER sync sin pushear, o forzar un resync completo. En el día a día NO
# hace falta correrlo — el pre-push hook (.githooks/pre-push) sincroniza incremental en cada push.
#
# Uso:  bash scripts/graph-sync.sh
set -euo pipefail

BRIDGE="${GRAPHITY_BRIDGE_PATH:-C:/Proyectos/Claude/Claude code/graphify-graphity-bridge}"
CKPT=".bridge/checkpoint-copiloto-emprendedor.db"

[ -d "$BRIDGE" ] || { echo "[graph-sync] ❌ no encuentro el bridge en '$BRIDGE' — seteá GRAPHITY_BRIDGE_PATH." >&2; exit 1; }
command -v uv >/dev/null 2>&1 || { echo "[graph-sync] ❌ 'uv' no está en el PATH." >&2; exit 1; }

cd "$BRIDGE"
echo "[graph-sync] sincronizando el grafo de copiloto-emprendedor (graphify + ingest + reconcile)…"
uv run bridge --config config/repos.toml --repo copiloto-emprendedor sync --checkpoint "$CKPT"
echo "[graph-sync] ✅ grafo sincronizado (checkpoint: $BRIDGE/$CKPT)"
