#!/usr/bin/env bash
# deploy/copiloto/verifica-build-sha.sh — el index.html buildeado DEBE declarar el SHA real.
# Por qué (2026-10-06, hallazgo de frontend2): si el build no recibe VITE_BUILD_SHA, el shell sale con
# el placeholder `unknown` (apps/copiloto-web/src/util/buildSha.ts) y nadie lo nota: el único control de
# versión del frontend deja de decir qué build sirve. Este script falla ruidoso en ese caso.
# Uso: verifica-build-sha.sh <ruta/index.html> <sha-esperado>
set -euo pipefail

html="${1:?falta la ruta del index.html}"
sha="${2:?falta el SHA esperado}"

if ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ABORT: el SHA del build no es de 40 hex (recibido '$sha'): el shell quedaría 'unknown'." >&2
  exit 1
fi

if ! grep -q "data-build-sha=\"$sha\"" "$html"; then
  declarado="$(grep -o 'data-build-sha="[^"]*"' "$html" | head -1 || true)"
  echo "ABORT: $html no declara data-build-sha=\"$sha\" (declara: ${declarado:-<ninguno>})." >&2
  exit 1
fi

echo "    ok: data-build-sha=$sha"
