#!/usr/bin/env bash
# deploy/copiloto/deploy.sh — deploy vivo del Copiloto del Emprendedor (Task 11, plan
# 2026-07-03-copiloto-deploy-multitenant.md). Se ejecuta DESDE la PC del operador (mismo patrón que
# <scratchpad>/deploy_sync_test.sh): sincroniza el worktree -> VPS y desde ahí orquesta TODO
# server-side por SSH. Secretos NUNCA bajan a la PC ni se imprimen (SUPABASE_JWT_SECRET se
# sourcea VPS->fusion y se escribe directo en /etc/unreal-copilot/copiloto.env, server-side).
#
# IDEMPOTENTE: corrible N veces sin duplicar unidades, sin re-agregar bloques de Caddy, sin romper
# hermes/temporal/mp/el vhost raíz (Caddy SOLO se recarga si `caddy validate` da OK; si no valida,
# aborta dejando el Caddyfile original intacto).
#
# Parametrizable (cero hardcoding — un 2º entorno solo pisa estas env vars, sin editar el script):
#   UC_DEPLOY_HOST        alias SSH del VPS destino          (default: unreal-copilot)
#   UC_DEPLOY_PATH        path estable del código en el VPS   (default: /opt/uc-repos/copiloto)
#   UC_ENV_DIR            dir de EnvironmentFile del VPS      (default: /etc/unreal-copilot)
#   UC_VENV               venv Python del VPS                 (default: /opt/uc-copiloto-venv)
#   COPILOTO_WEB_PORT     puerto donde escucha uvicorn         (default: 8099)
#   UC_BASE_DOMAIN        dominio base (sslip.io del VPS)      (default: 178-105-191-1.sslip.io)
#   UC_COPILOTO_SUBDOMAIN subdominio nuevo del front-door      (default: copiloto)
#   UC_MP_SUBDOMAIN       subdominio existente de MercadoPago  (default: mp)
#   UC_SKIP_DRIFT_CHECK   saltea el guard de checkout-vs-main   (default: sin setear = guard activo)
set -euo pipefail

LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Guard: un checkout desactualizado sube apps/copiloto/motor TAL CUAL el disco y regresiona en
# silencio código ya arreglado en origin/main -- sin conflicto de git, sin error (pasó el
# 2026-07-23: /actividad y /inteligencia/* volvieron a romperse por un deploy desde una rama vieja).
# Ver memoria/deploy-sh-no-valida-checkout-al-dia-con-main.md. Escape hatch UC_SKIP_DRIFT_CHECK=1
# para el caso legítimo de desplegar una rama de feature aislada a propósito.
if [ -z "${UC_SKIP_DRIFT_CHECK:-}" ]; then
  git -C "$LOCAL" fetch origin main --quiet
  DRIFT="$(git -C "$LOCAL" diff origin/main -- apps/copiloto motor | wc -l)"
  if [ "$DRIFT" -ne 0 ]; then
    echo "ABORT: el checkout local difiere de origin/main en apps/copiloto/motor ($DRIFT líneas de diff)." >&2
    echo "Desplegar así regresiona en silencio código ya arreglado en main. Rebaseá/mergeá primero," >&2
    echo "o si el drift es intencional corré con UC_SKIP_DRIFT_CHECK=1." >&2
    exit 1
  fi
fi
HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
REMOTE="${UC_DEPLOY_PATH:-/opt/uc-repos/copiloto}"
ENVDIR="${UC_ENV_DIR:-/etc/unreal-copilot}"
VENV="${UC_VENV:-/opt/uc-copiloto-venv}"
WEB_PORT="${COPILOTO_WEB_PORT:-8099}"
BASE_DOMAIN="${UC_BASE_DOMAIN:-178-105-191-1.sslip.io}"
COPILOTO_SUBDOMAIN="${UC_COPILOTO_SUBDOMAIN:-copiloto}"
MP_SUBDOMAIN="${UC_MP_SUBDOMAIN:-mp}"
MOTOR="motor"                                     # motor VENDORIZADO en el repo (Fase 2 graduación; antes: deploy/skeleton_kit/.../reference)
WORKER="deploy/worker"
WEB_UNIT="uc-copiloto-web.service"
WORKER_UNIT="uc-copiloto-worker.service"

echo "==> [1/7] sync worktree -> ${HOST}:${REMOTE} (clean; preserva apps/copiloto-web/{node_modules,dist} entre deploys)"
# rm QUIRÚRGICO: `apps/copiloto` (backend) + `deploy` + `motor` (vendorizado), NUNCA todo `apps/` -> no borra el frontend
# `apps/copiloto-web` (fix de la colisión histórica deploy.sh <-> sync-web.sh). Del frontend se limpia
# solo el source (preservando node_modules+dist para no reinstalar/reconstruir de cero cada deploy).
tar -C "$LOCAL" \
    --exclude='apps/copiloto-web/node_modules' --exclude='apps/copiloto-web/dist' --exclude='apps/copiloto-web/.vite' \
    -czf - apps/copiloto apps/copiloto-web "$MOTOR" "$WORKER" deploy/copiloto \
  | ssh "$HOST" "mkdir -p '$REMOTE' && rm -rf '$REMOTE'/apps/copiloto '$REMOTE'/deploy '$REMOTE'/motor && { [ -d '$REMOTE/apps/copiloto-web' ] && find '$REMOTE/apps/copiloto-web' -mindepth 1 -maxdepth 1 ! -name node_modules ! -name dist -exec rm -rf {} + || true; } && mkdir -p '$REMOTE' && tar -C '$REMOTE' -xzf -"

echo "==> [frontend] build PWA en el VPS (fetch-fonts + npm install + vite build) -> dist servido mismo-origen por _mount_spa (web.py)"
ssh "$HOST" bash -s -- "$REMOTE" <<'REMOTE_WEB'
set -euo pipefail
REMOTE="$1"
cd "$REMOTE/apps/copiloto-web"
# fuentes self-hosted reales (idempotente por tamaño -> reemplaza placeholders <2KB por los woff2 reales)
bash "$REMOTE/deploy/copiloto/fetch-fonts.sh"
npm install --no-audit --no-fund --loglevel=error
npm run build
test -f dist/index.html
echo "frontend build OK -> $REMOTE/apps/copiloto-web/dist ($(du -sh dist | cut -f1))"
REMOTE_WEB

echo "==> [2/7] auth: repoint a la GoTrue DEDICADA — SOLO si el cutover ya se completó (marker); self-healing"
# Gate de seguridad (review A2): repointear apenas existe copiloto-gotrue.env puede apuntar el copiloto
# a una GoTrue VACÍA (deploy-gotrue.sh corrido pero migrate-and-cutover.sh no, o un DR fresco) → caída
# total de auth por un deploy que no pretendía tocar auth. El repoint procede SOLO si migrate-and-cutover.sh
# dejó el marker `.gotrue-cutover-done`; si falta, se SALTEA (aviso) y el deploy continúa (auth intacta).
# El repoint en sí lo hace repoint-env.sh (FUENTE ÚNICA, compartida con migrate-and-cutover.sh → sin drift).
ssh "$HOST" bash -s -- "$ENVDIR" "$REMOTE" <<'REMOTE_AUTH'
set -euo pipefail
ENVDIR="$1"; REMOTE="$2"
if [ ! -f "$ENVDIR/.gotrue-cutover-done" ]; then
  echo "AVISO [2/7]: falta $ENVDIR/.gotrue-cutover-done -> cutover a GoTrue dedicada NO completado; NO se repointea auth."
  echo "  Completá el cutover con deploy/copiloto/gotrue/migrate-and-cutover.sh. El resto del deploy continúa."
else
  UC_ENV_DIR="$ENVDIR" bash "$REMOTE/deploy/copiloto/gotrue/repoint-env.sh"
fi
REMOTE_AUTH

echo "==> [3/7] pin de deps (idempotente: pip no reinstala si ya satisface el rango)"
# python-multipart: dep de FastAPI para Form(...)/File(...) (/chat/audio, voz-backend) -- sin ella
# FastAPI levanta RuntimeError al arrancar ("Form data requires python-multipart to be installed").
ssh "$HOST" "'$VENV/bin/pip' install -q 'PyJWT>=2.8.0' 'fastapi>=0.110' 'uvicorn>=0.29' 'httpx>=0.27' 'pydantic>=2' 'python-multipart>=0.0.9'"

echo "==> [3.5/7] GROQ_API_KEY server-side (clinic-agent.env -> copiloto.env), idempotente, sin imprimir el valor"
# La voz de /chat/audio (voz-backend) reusa la MISMA key que ya usa el agente de agenda (clinic-
# management) para su STT -- vive server-side en ${ENVDIR}/clinic-agent.env (nunca en este repo ni
# en el chat). Copiarla a copiloto.env es la fuente de verdad de ESTE servicio -- si mañana rota,
# rotar en clinic-agent.env y re-correr este deploy la propaga, sin duplicar el secreto a mano.
ssh "$HOST" bash -s -- "$ENVDIR" <<'REMOTE_GROQ'
set -euo pipefail
ENVDIR="$1"
SRC="$ENVDIR/clinic-agent.env"
DST="$ENVDIR/copiloto.env"
[ -f "$DST" ] || { echo "FALTA $DST" >&2; exit 1; }
if [ ! -f "$SRC" ]; then
  echo "AVISO: no existe $SRC -- /chat/audio quedará SIN configurar (503 'voz no configurada'), el resto del front-door sigue OK" >&2
else
  SECRET="$(grep '^GROQ_API_KEY=' "$SRC" | head -1 | cut -d= -f2-)"
  if [ -z "$SECRET" ]; then
    echo "AVISO: $SRC no tiene GROQ_API_KEY -- /chat/audio quedará SIN configurar (503), el resto del front-door sigue OK" >&2
  else
    if grep -q '^GROQ_API_KEY=' "$DST"; then
      sed -i "s|^GROQ_API_KEY=.*|GROQ_API_KEY=${SECRET}|" "$DST"
    else
      printf 'GROQ_API_KEY=%s\n' "$SECRET" >> "$DST"
    fi
    unset SECRET
    chmod 600 "$DST"
    echo "GROQ_API_KEY: OK (presente en $DST, valor NO impreso)"
  fi
fi
REMOTE_GROQ

echo "==> [4/7] provision.py (idempotente: CREATE ... IF NOT EXISTS / DROP+CREATE policy / GRANT repetible)"
ssh "$HOST" bash -s -- "$REMOTE" "$ENVDIR" "$VENV" <<'REMOTE_PROVISION'
set -euo pipefail
REMOTE="$1"; ENVDIR="$2"; VENV="$3"
set -a
. "$ENVDIR/fusion-pg.env"
set +a
cd "$REMOTE/apps/copiloto"
"$VENV/bin/python" provision.py
REMOTE_PROVISION

echo "==> [4.5/7] ensure_mi_dia_schedules.py (idempotente: ScheduleAlreadyRunningError -> ya existía, no duplica)"
ssh "$HOST" bash -s -- "$REMOTE" "$ENVDIR" "$VENV" <<'REMOTE_MI_DIA_SCHEDULES'
set -euo pipefail
REMOTE="$1"; ENVDIR="$2"; VENV="$3"
set -a
. "$ENVDIR/fusion-pg.env"
. "$ENVDIR/copiloto.env"
set +a
cd "$REMOTE/deploy/worker"
"$VENV/bin/python" ensure_mi_dia_schedules.py
REMOTE_MI_DIA_SCHEDULES

echo "==> [5/7] instalar units systemd (idempotente: copy+daemon-reload+enable --now, no duplica)"
ssh "$HOST" bash -s -- "$REMOTE" "$WEB_UNIT" "$WORKER_UNIT" <<'REMOTE_UNITS'
set -euo pipefail
REMOTE="$1"; WEB_UNIT="$2"; WORKER_UNIT="$3"
install -m 644 "$REMOTE/deploy/copiloto/$WEB_UNIT" "/etc/systemd/system/$WEB_UNIT"
install -m 644 "$REMOTE/deploy/copiloto/$WORKER_UNIT" "/etc/systemd/system/$WORKER_UNIT"
systemctl daemon-reload
systemctl enable "$WEB_UNIT" "$WORKER_UNIT"
# restart (NO solo enable --now): en un REDEPLOY los servicios YA corren, y `enable --now` no reinicia
# un servicio activo -> el código nuevo NO se cargaría. `restart` arranca si está parado y reinicia si
# está activo -> un redeploy siempre carga el código sincronizado. (Breve downtime por reinicio; OK para deploy.)
systemctl restart "$WEB_UNIT" "$WORKER_UNIT"
echo "--- systemctl is-active (post restart) ---"
systemctl is-active "$WEB_UNIT"
systemctl is-active "$WORKER_UNIT"
REMOTE_UNITS

echo "==> [6/7] Caddy: agregar vhost ${COPILOTO_SUBDOMAIN}.* + rewrite /callback en ${MP_SUBDOMAIN}.* (idempotente; valida ANTES de reload; aborta sin tocar si no valida)"
ssh "$HOST" python3 - "$BASE_DOMAIN" "$COPILOTO_SUBDOMAIN" "$MP_SUBDOMAIN" "$WEB_PORT" <<'REMOTE_CADDY'
import re
import shutil
import subprocess
import sys

base_domain, copiloto_sub, mp_sub, web_port = sys.argv[1:5]
path = "/etc/caddy/Caddyfile"
with open(path, encoding="utf-8") as f:
    content = f.read()

copiloto_host = f"{copiloto_sub}.{base_domain}"
mp_host = f"{mp_sub}.{base_domain}"
changed = False

if copiloto_host in content:
    print(f"= bloque {copiloto_host} ya existe (no-op)")
else:
    content = content.rstrip("\n") + f"\n\n{copiloto_host} {{\n    reverse_proxy 127.0.0.1:{web_port}\n}}\n"
    changed = True
    print(f"+ agregado bloque {copiloto_host} -> 127.0.0.1:{web_port}")

pattern = re.compile(r"(" + re.escape(mp_host) + r"\s*\{)(.*?)(\n\})", re.DOTALL)
m = pattern.search(content)
if not m:
    print(f"ERROR: no encontre el bloque {mp_host} en {path}", file=sys.stderr)
    sys.exit(1)

if "rewrite /callback /mp/callback" in m.group(2):
    print(f"= rewrite /callback ya presente en {mp_host} (no-op)")
else:
    new_body = "\n    rewrite /callback /mp/callback" + m.group(2)
    content = content[: m.start()] + m.group(1) + new_body + m.group(3) + content[m.end():]
    changed = True
    print(f"+ agregado 'rewrite /callback /mp/callback' en {mp_host}")

if not changed:
    print("Caddyfile sin cambios (ya aplicado previamente) -- no-op idempotente, sin reload")
    sys.exit(0)

tmp = path + ".new"
with open(tmp, "w", encoding="utf-8") as f:
    f.write(content)

result = subprocess.run(["caddy", "validate", "--config", tmp], capture_output=True, text=True)
if result.returncode != 0:
    print("CADDY VALIDATE FALLO -- abortando SIN aplicar (Caddyfile original intacto)", file=sys.stderr)
    print(result.stdout, file=sys.stderr)
    print(result.stderr, file=sys.stderr)
    sys.exit(1)

shutil.copy(path, path + ".bak")
shutil.move(tmp, path)
print("Caddyfile actualizado + validado OK (backup en Caddyfile.bak)")
REMOTE_CADDY

# El script python de arriba solo escribe/valida; el reload es un paso separado y explícito para
# que quede claro en el log qué exit code correspondió a qué (si el python abortó con exit!=0,
# `set -e` corta ANTES de llegar a este reload).
ssh "$HOST" systemctl reload caddy
echo "Caddy recargado."

echo "==> [7/7] Smoke (evidencia real, no autoevaluación)"
ssh "$HOST" bash -s -- "$WEB_UNIT" "$WORKER_UNIT" "$WEB_PORT" "$BASE_DOMAIN" <<'REMOTE_SMOKE'
set -euo pipefail
WEB_UNIT="$1"; WORKER_UNIT="$2"; WEB_PORT="$3"; BASE_DOMAIN="$4"
echo "--- systemctl is-active ---"
systemctl is-active "$WEB_UNIT"
systemctl is-active "$WORKER_UNIT"
echo "--- curl /healthz (127.0.0.1:$WEB_PORT) ---"
curl -sf "http://127.0.0.1:${WEB_PORT}/healthz"; echo
echo "--- curl / (SPA index servido mismo-origen por _mount_spa) ---"
curl -sf "http://127.0.0.1:${WEB_PORT}/" | head -c 200; echo
echo "--- caddy validate (post-reload sanity) ---"
caddy validate --config /etc/caddy/Caddyfile
echo "--- vhosts preexistentes siguen respondiendo (status code informativo, hermes/temporal usan basic_auth -> 401 esperado) ---"
curl -s -o /dev/null -w 'root: %{http_code}\n' "https://${BASE_DOMAIN}/" || true
curl -s -o /dev/null -w 'hermes: %{http_code}\n' "https://hermes.${BASE_DOMAIN}/" || true
curl -s -o /dev/null -w 'temporal: %{http_code}\n' "https://temporal.${BASE_DOMAIN}/" || true
REMOTE_SMOKE

echo "==> Deploy completo."
