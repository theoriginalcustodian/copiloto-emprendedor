#!/usr/bin/env bash
# Arranca Metro para apps/mobile, garantizando primero que apps/mobile/.env exista.
#
# Un git worktree nuevo NUNCA trae .env (gitignored) -- sin él, EXPO_PUBLIC_API_BASE queda vacío
# horneado en el bundle y la app falla con "No pudimos conectarnos" (error de red genérico,
# indistinguible de un problema real de servidor o de credenciales). El loader de Expo
# ("env: load .env") corre ANTES de que metro.config.js se ejecute, así que un check ahí llegaría
# tarde para la corrida en curso -- tiene que resolverse ACÁ, antes de invocar `expo start`.
# Ver memoria `metro-en-windows-no-sigue-links-de-node-modules-en-worktrees.md`.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/apps/mobile/.env"
EXTRA_ARGS=()

if [[ ! -f "$ENV_FILE" ]]; then
  SHARED_ROOT="${ROOT%%/.claude/worktrees/*}"
  SHARED_ENV="$SHARED_ROOT/apps/mobile/.env"

  if [[ "$SHARED_ROOT" != "$ROOT" && -f "$SHARED_ENV" ]]; then
    cp "$SHARED_ENV" "$ENV_FILE"
    echo "[start-metro] apps/mobile/.env faltaba en este worktree -- copiado desde $SHARED_ENV." >&2
    EXTRA_ARGS+=(--clear)  # el bundle pudo haberse cacheado antes con la env vacía
  else
    echo "[start-metro] ERROR: apps/mobile/.env no existe en $ROOT y no se encontró un checkout compartido de donde copiarlo." >&2
    echo "[start-metro] Sin este archivo, EXPO_PUBLIC_API_BASE queda vacío y la app falla con \"No pudimos conectarnos\" al primer fetch." >&2
    echo "[start-metro] Creá apps/mobile/.env (ver apps/mobile/.env.template) antes de reintentar." >&2
    exit 1
  fi
fi

cd "$ROOT/apps/mobile"
exec npx expo start --dev-client "${EXTRA_ARGS[@]}" "$@"
