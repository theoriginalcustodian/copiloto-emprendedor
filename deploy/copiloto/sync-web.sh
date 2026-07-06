#!/usr/bin/env bash
# deploy/copiloto/sync-web.sh — sync + build del cliente PWA (Task 5, plan
# 2026-07-03-copiloto-cliente-web.md). Corre DESDE la PC del operador (mismo patrón que
# deploy/copiloto/deploy.sh): sincroniza SOLO `apps/copiloto-web` al VPS y ahí baja fuentes +
# instala deps + builda. NO instala systemd/Caddy (eso es Task 8 -- servir el `dist/` resultante
# es un paso posterior, separado); este script se limita a dejar un `dist/` fresco en el VPS.
#
# IDEMPOTENTE: rm -rf del subárbol propio (`apps/copiloto-web`, NO todo `apps/`) + re-extract,
# corrible N veces sin acumular stale files. `npm install` (no `npm ci`) porque no asumimos un
# lockfile pre-generado -- ver constraint del Task 5.
#
# OJO -- colisión conocida con deploy.sh (backend, fuera de mi ownership, NO tocar):
#   deploy.sh hace `rm -rf '$REMOTE'/apps '$REMOTE'/deploy` y su tar SOLO contiene `apps/copiloto`
#   (no `apps/copiloto-web`) -- si deploy.sh corre DESPUÉS de este script sobre el mismo
#   UC_DEPLOY_PATH, borra `apps/copiloto-web` sin volver a crearlo. Orden seguro: correr
#   sync-web.sh DESPUÉS de deploy.sh, o re-correr sync-web.sh si deploy.sh corrió más tarde.
#   Este script sincroniza también su propio fetch-fonts.sh (deploy/copiloto/fetch-fonts.sh) para
#   no depender de que deploy.sh haya corrido antes -- self-contained.
#
# Parametrizable (cero hardcoding -- mismo estilo/defaults que deploy.sh):
#   UC_DEPLOY_HOST   alias SSH del VPS destino        (default: unreal-copilot)
#   UC_DEPLOY_PATH   path estable del código en el VPS (default: /opt/uc-repos/copiloto)
#   UC_AUTH_URL      base pública de auth para el botón Google (VITE_AUTH_URL en el build).
#                    (default: https://copilotoemprendedor.duckdns.org — dominio propio; evita el bloqueo
#                    de *.sslip.io en resolvers de terceros. El OAuth de auth vive en el MISMO dominio
#                    del chat, no en un subdominio auth.*). Vacío ("") ⇒ botón Google OCULTO.
set -euo pipefail

LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
REMOTE="${UC_DEPLOY_PATH:-/opt/uc-repos/copiloto}"
AUTH_URL="${UC_AUTH_URL-https://copilotoemprendedor.duckdns.org}"   # default = dominio propio duckdns (no *.sslip.io, que redes de terceros bloquean). nota: `-` (no `:-`) para permitir UC_AUTH_URL="" explícito
WEB_SUBDIR="apps/copiloto-web"

echo "==> [1/3] sync ${WEB_SUBDIR} + deploy/copiloto/fetch-fonts.sh -> ${HOST}:${REMOTE} (clean, idempotente, sin node_modules/dist)"
tar -C "$LOCAL" \
  --exclude="${WEB_SUBDIR}/node_modules" \
  --exclude="${WEB_SUBDIR}/dist" \
  -czf - "$WEB_SUBDIR" deploy/copiloto/fetch-fonts.sh \
  | ssh "$HOST" "mkdir -p '$REMOTE/apps' '$REMOTE/deploy/copiloto' && rm -rf '$REMOTE/$WEB_SUBDIR' && tar -C '$REMOTE' -xzf -"

echo "==> [2/3] fuentes self-hosted (idempotente: fetch-fonts.sh no re-baja si ya está)"
ssh "$HOST" "bash '$REMOTE/deploy/copiloto/fetch-fonts.sh'"

echo "==> [3/3] npm install (NO ci -- sin lockfile pre-generado asumido) + build (VITE_AUTH_URL=${AUTH_URL:-<vacío→sin botón Google>})"
ssh "$HOST" bash -s -- "$REMOTE/$WEB_SUBDIR" "$AUTH_URL" <<'REMOTE_BUILD'
set -euo pipefail
WEB_DIR="$1"; AUTH_URL="$2"
cd "$WEB_DIR"
npm install
# Vite hornea las VITE_* del entorno al bundle. VITE_AUTH_URL habilita el botón "Entrar con Google"
# (vacío ⇒ botón oculto). Cero hardcoding: sale del parámetro UC_AUTH_URL (default dominio propio duckdns).
VITE_AUTH_URL="$AUTH_URL" npm run build
echo "--- dist/ generado en: ---"
realpath "$WEB_DIR/dist"
REMOTE_BUILD

echo "==> sync-web.sh completo."
