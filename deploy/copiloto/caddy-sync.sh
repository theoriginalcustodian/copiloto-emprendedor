#!/usr/bin/env bash
# caddy-sync.sh — converge SOLO el Caddyfile de prod (SMTPVERIFYRUTA). NO reinicia web/worker, NO mueve
# `main`, NO toca el árbol del VPS: es el camino corto para directivas de Caddy que no esperan un deploy
# de app. Usa la MISMA lógica que deploy.sh [6/7] (caddy_converge.py): una sola fuente.
#
# Idempotente y convergente: correrlo N veces deja el mismo Caddyfile; si cambió el valor deseado,
# reemplaza el bloque vivo. Valida con `caddy validate` antes de tocar nada; reload sólo si validó.
#
# Uso:  bash deploy/copiloto/caddy-sync.sh
# Env:  los mismos UC_* que deploy.sh (UC_DEPLOY_HOST, UC_BASE_DOMAIN, UC_COPILOTO_SUBDOMAIN,
#       UC_MP_SUBDOMAIN, COPILOTO_WEB_PORT, UC_PUBLIC_HOST, UC_GOTRUE_PORT).
set -euo pipefail

LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
WEB_PORT="${COPILOTO_WEB_PORT:-8099}"
BASE_DOMAIN="${UC_BASE_DOMAIN:-178-105-191-1.sslip.io}"
COPILOTO_SUBDOMAIN="${UC_COPILOTO_SUBDOMAIN:-copiloto}"
MP_SUBDOMAIN="${UC_MP_SUBDOMAIN:-mp}"
PUBLIC_HOST="${UC_PUBLIC_HOST:-copilotoemprendedor.duckdns.org}"
GOTRUE_PORT="${UC_GOTRUE_PORT:-9997}"

echo "==> Converger Caddyfile en $HOST (${COPILOTO_SUBDOMAIN}.${BASE_DOMAIN}, ${PUBLIC_HOST} -> GoTrue :${GOTRUE_PORT}, API :${WEB_PORT})"
ssh "$HOST" python3 - "$BASE_DOMAIN" "$COPILOTO_SUBDOMAIN" "$MP_SUBDOMAIN" "$WEB_PORT" "$PUBLIC_HOST" "$GOTRUE_PORT" \
  < "$LOCAL/deploy/copiloto/caddy_converge.py"

ssh "$HOST" systemctl reload caddy
echo "Caddy recargado."

# Control de EFECTO (no de exit code): /auth/v1/verify sin token NO puede devolver el shell de la SPA.
# Un 200 text/html con data-build-sha = el handle no está (es el defecto que esto cierra).
cuerpo="$(curl -s --max-time 10 "https://${PUBLIC_HOST}/auth/v1/verify" || true)"
codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://${PUBLIC_HOST}/auth/v1/verify" || true)"
echo "verify (sin token) -> HTTP ${codigo}"
if grep -q 'data-build-sha' <<<"$cuerpo"; then
  echo "FALLA: /auth/v1/verify devuelve el shell de la SPA (el handle no llegó a prod)" >&2
  exit 1
fi
echo "OK: /auth/v1/verify ya no es el shell de la SPA"
