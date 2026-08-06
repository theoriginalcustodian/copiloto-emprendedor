#!/usr/bin/env bash
# scripts/setup-vps-mirror.sh — ADR-001 paso 5: el repo deja de tener un único dueño (sólo GitHub).
#
# `git remote -v` hoy es sólo `origin` = GitHub: si GitHub cae, no hay dónde pushear un commit —
# el mismo punto único que este ADR entero vino a sacar del gate, ahora en la capa de abajo (el
# almacenamiento del código, no sólo de la definición de la suite). Un mirror bare en el VPS lo
# saca barato: no reemplaza a GitHub (`origin` sigue siendo el remoto real, con PRs/Actions/etc.),
# es un SEGUNDO lugar donde el commit existe si el primero no responde.
#
# Idempotente: agrega el remote `vps` sólo si falta, y el push es seguro de repetir.
#
# Uso: bash scripts/setup-vps-mirror.sh [rama]   (default: la rama actual)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
MIRROR_PATH="${UC_VPS_MIRROR_PATH:-/opt/uc-repos/copiloto-mirror.git}"
RAMA="${1:-$(git -C "$ROOT" branch --show-current)}"

ssh "$HOST" "test -d '$MIRROR_PATH' || (mkdir -p '$MIRROR_PATH' && git init --bare '$MIRROR_PATH')"

if ! git -C "$ROOT" remote get-url vps >/dev/null 2>&1; then
  git -C "$ROOT" remote add vps "$HOST:$MIRROR_PATH"
  echo "==> remote 'vps' agregado -> $HOST:$MIRROR_PATH"
else
  echo "==> remote 'vps' ya existía"
fi

echo "==> pusheando '$RAMA' a origin Y a vps"
git -C "$ROOT" push origin "$RAMA"
git -C "$ROOT" push vps "$RAMA"
echo "==> el commit existe en 2 lugares independientes: GitHub y $HOST:$MIRROR_PATH"
