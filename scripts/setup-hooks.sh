#!/usr/bin/env bash
# scripts/setup-hooks.sh — activa el pre-push hook del arco autopoiético (sync del grafo de código).
#
# QUÉ HACE, una vez por clon: apunta core.hooksPath a .githooks/, para que en cada `git push` corra
# .githooks/pre-push y sincronice el grafo de código (graphify → Graphity bridge, incremental, 0 LLM).
# Idempotente: correlo N veces sin efecto extra. Sin este paso el hook está en el repo pero NO corre.
#
# Uso:  bash scripts/setup-hooks.sh
# (No hay `make` en el toolchain de esta máquina — por eso es un script, no un target de Makefile.)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BRIDGE_DEFAULT="C:/Proyectos/Claude/Claude code/graphify-graphity-bridge"
BRIDGE="${GRAPHITY_BRIDGE_PATH:-$BRIDGE_DEFAULT}"

# 1. Activar el hook (idempotente).
git config core.hooksPath .githooks
echo "[setup-hooks] ✅ core.hooksPath = .githooks — el grafo se sincroniza en cada push."

# 2. Verificar las precondiciones que el hook exige, o el push abortará (fail-closed).
ok=1
if ! command -v uv >/dev/null 2>&1; then
  echo "[setup-hooks] ⚠  'uv' no está en el PATH — el hook abortará el push hasta instalarlo (https://docs.astral.sh/uv/)." >&2
  ok=0
fi
if [ ! -d "$BRIDGE" ]; then
  echo "[setup-hooks] ⚠  no encuentro el bridge en '$BRIDGE'." >&2
  echo "[setup-hooks]    seteá GRAPHITY_BRIDGE_PATH al path real, o cloná graphify-graphity-bridge ahí." >&2
  ok=0
fi

# 3. ¿Primer sync ya corrió? (el checkpoint habilita el modo incremental — sin él, el 1er push hace full).
if [ -f "$BRIDGE/.bridge/checkpoint-copiloto-emprendedor.db" ]; then
  echo "[setup-hooks] ✅ checkpoint presente — los push sincronizan incremental (solo lo cambiado)."
else
  echo "[setup-hooks] ℹ  sin checkpoint todavía: el primer push hará un sync COMPLETO (una vez), después incremental."
  echo "[setup-hooks]    para adelantarlo sin pushear:  bash scripts/graph-sync.sh"
fi

if [ "$ok" -eq 1 ]; then
  echo "[setup-hooks] Listo. Bypass ante fallo transitorio del bridge:  git push --no-verify"
else
  echo "[setup-hooks] Activado, pero faltan precondiciones (arriba). Hasta resolverlas: git push --no-verify" >&2
fi
