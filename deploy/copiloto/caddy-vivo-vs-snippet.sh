#!/usr/bin/env bash
# deploy/copiloto/caddy-vivo-vs-snippet.sh — SNIPPETMIENTE: diff de hosts entre Caddyfile.snippet y el
# Caddyfile VIVO del VPS, en las dos direcciones. SÓLO LECTURA: no escribe nada en el VPS ni en el repo.
#
# Lee únicamente las CABECERAS de bloque (`host {` en columna 0). Los `basic_auth`, hashes y demás
# directivas están indentados y no salen del VPS.
#
# Uso: bash deploy/copiloto/caddy-vivo-vs-snippet.sh
#   UC_DEPLOY_HOST  alias SSH del VPS (default: unreal-copilot)
# rc 0 = las dos direcciones vacías · 1 = hay divergencia (se lista) · 2 = no pude leer / nada que medir
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
OUT="$(mktemp)"; trap 'rm -f "$OUT"' EXIT

# El grep corre en el VPS: sólo viajan las cabeceras. Un fallo de ssh NO puede leerse como «sin
# divergencia»: se aborta antes de comparar (y el módulo da rc=2 con un listado vacío).
ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" \
  "grep -E '^[^[:space:]#}][^{]*\{[[:space:]]*\$' /etc/caddy/Caddyfile" > "$OUT" \
  || { echo "ABORT: no pude leer /etc/caddy/Caddyfile en $HOST" >&2; exit 2; }

PY="$(command -v python3 || command -v python)" || { echo "ABORT: no hay python3/python" >&2; exit 2; }
PYTHONIOENCODING=utf-8 "$PY" "$HERE/caddy_snippet_check.py" "$HERE/Caddyfile.snippet" "$OUT"
