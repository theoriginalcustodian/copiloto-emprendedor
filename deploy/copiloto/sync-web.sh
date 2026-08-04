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
# NOTA -- la colisión con deploy.sh que este comentario describía YA NO EXISTE. Decía que deploy.sh
#   hacía `rm -rf '$REMOTE'/apps` y por eso correrlo DESPUÉS de este script borraba la PWA. Medido el
#   2026-07-22 corriendo justo ese orden "peligroso" (sync-web.sh y después deploy.sh): el `dist/` y
#   el `sw.js` servido quedaron intactos. deploy.sh hoy borra `'$REMOTE'/apps/copiloto` --no `apps`
#   entero-- y de `apps/copiloto-web` preserva explícitamente `node_modules` y `dist`. Los dos
#   órdenes son seguros.
#
#   Se CORRIGE en vez de borrarse porque un aviso vencido no es inofensivo: hace ordenar deploys
#   alrededor de un peligro que ya no existe y, cuando alguien descubre que era falso, el descuento
#   se lo llevan también los demás avisos del archivo. Un aviso caduca igual que una evidencia; la
#   diferencia es que nadie lo va a chequear salvo que algo se rompa.
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
CORE_SUBDIR="packages/core"   # ADR-010: copiloto-web depende de @copiloto/core vía file:../../packages/core -- sin sincronizarlo, npm install en el VPS no resuelve el import (gap detectado 2026-08-04, PR#237)

echo "==> [1/3] sync ${WEB_SUBDIR} + ${CORE_SUBDIR} + deploy/copiloto/fetch-fonts.sh -> ${HOST}:${REMOTE} (clean, idempotente, sin node_modules/dist)"
tar -C "$LOCAL" \
  --exclude="${WEB_SUBDIR}/node_modules" \
  --exclude="${WEB_SUBDIR}/dist" \
  --exclude="${CORE_SUBDIR}/node_modules" \
  -czf - "$WEB_SUBDIR" "$CORE_SUBDIR" deploy/copiloto/fetch-fonts.sh \
  | ssh "$HOST" "mkdir -p '$REMOTE/apps' '$REMOTE/packages' '$REMOTE/deploy/copiloto' && rm -rf '$REMOTE/$WEB_SUBDIR' '$REMOTE/$CORE_SUBDIR' && tar -C '$REMOTE' -xzf -"

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
