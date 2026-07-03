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
#   UC_FUSION_SSH_ALIAS   alias SSH (en el VPS) hacia fusion   (default: fusion)
#   COPILOTO_WEB_PORT     puerto donde escucha uvicorn         (default: 8099)
#   UC_BASE_DOMAIN        dominio base (sslip.io del VPS)      (default: 178-105-191-1.sslip.io)
#   UC_COPILOTO_SUBDOMAIN subdominio nuevo del front-door      (default: copiloto)
#   UC_MP_SUBDOMAIN       subdominio existente de MercadoPago  (default: mp)
set -euo pipefail

LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
REMOTE="${UC_DEPLOY_PATH:-/opt/uc-repos/copiloto}"
ENVDIR="${UC_ENV_DIR:-/etc/unreal-copilot}"
VENV="${UC_VENV:-/opt/uc-copiloto-venv}"
FUSION_ALIAS="${UC_FUSION_SSH_ALIAS:-fusion}"
WEB_PORT="${COPILOTO_WEB_PORT:-8099}"
BASE_DOMAIN="${UC_BASE_DOMAIN:-178-105-191-1.sslip.io}"
COPILOTO_SUBDOMAIN="${UC_COPILOTO_SUBDOMAIN:-copiloto}"
MP_SUBDOMAIN="${UC_MP_SUBDOMAIN:-mp}"
REF="deploy/skeleton_kit/archetypes/conversational_agent/reference"
WORKER="deploy/worker"
WEB_UNIT="uc-copiloto-web.service"
WORKER_UNIT="uc-copiloto-worker.service"

echo "==> [1/7] sync worktree -> ${HOST}:${REMOTE} (clean, idempotente: rm -rf + tar, sin stale files)"
tar -C "$LOCAL" -czf - apps/copiloto "$REF" "$WORKER" deploy/copiloto \
  | ssh "$HOST" "mkdir -p '$REMOTE' && rm -rf '$REMOTE'/apps '$REMOTE'/deploy && mkdir -p '$REMOTE' && tar -C '$REMOTE' -xzf -"

echo "==> [2/7] SUPABASE_JWT_SECRET server-side (VPS -> ${FUSION_ALIAS}), idempotente, sin imprimir el valor"
ssh "$HOST" bash -s -- "$ENVDIR" "$FUSION_ALIAS" <<'REMOTE_JWT'
set -euo pipefail
ENVDIR="$1"; FUSION_ALIAS="$2"
ENVFILE="$ENVDIR/copiloto.env"
[ -f "$ENVFILE" ] || { echo "FALTA $ENVFILE" >&2; exit 1; }
# `-n` (stdin de /dev/null) es OBLIGATORIO acá: este script YA está corriendo dentro de un `bash -s`
# alimentado por un heredoc sobre el canal SSH exterior. Un ssh anidado SIN `-n` hereda ese mismo fd 0
# y, por default (sin -n), reenvía su stdin al comando remoto -> compite por los bytes restantes del
# heredoc exterior y los descarta en silencio (el resto del script queda sin ejecutar, exit 0, CERO
# output -- reproducido empíricamente: sin `-n` esta línea en adelante nunca corría). `-n` aísla el
# stdin del ssh anidado del heredoc exterior -- el fix canónico para "ssh dentro de un script leído
# por stdin" (mismo gotcha que `ssh` dentro de un `while read` sin `-n`/`</dev/null`).
SECRET="$(ssh -n -o BatchMode=yes "root@${FUSION_ALIAS}" "grep '^JWT_SECRET=' /opt/supabase/source/docker/.env | head -1 | cut -d= -f2-")"
if [ -z "$SECRET" ]; then
  echo "FALTA JWT_SECRET en ${FUSION_ALIAS}:/opt/supabase/source/docker/.env" >&2
  exit 1
fi
if grep -q '^SUPABASE_JWT_SECRET=' "$ENVFILE"; then
  sed -i "s|^SUPABASE_JWT_SECRET=.*|SUPABASE_JWT_SECRET=${SECRET}|" "$ENVFILE"
else
  printf 'SUPABASE_JWT_SECRET=%s\n' "$SECRET" >> "$ENVFILE"
fi
unset SECRET
chmod 600 "$ENVFILE"
if grep -q '^SUPABASE_JWT_SECRET=' "$ENVFILE"; then
  echo "SUPABASE_JWT_SECRET: OK (presente en $ENVFILE, valor NO impreso)"
else
  echo "SUPABASE_JWT_SECRET: FALLO al escribir $ENVFILE" >&2
  exit 1
fi
REMOTE_JWT

echo "==> [3/7] pin de deps (idempotente: pip no reinstala si ya satisface el rango)"
ssh "$HOST" "'$VENV/bin/pip' install -q 'PyJWT>=2.8.0' 'fastapi>=0.110' 'uvicorn>=0.29' 'httpx>=0.27' 'pydantic>=2'"

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

echo "==> [5/7] instalar units systemd (idempotente: copy+daemon-reload+enable --now, no duplica)"
ssh "$HOST" bash -s -- "$REMOTE" "$WEB_UNIT" "$WORKER_UNIT" <<'REMOTE_UNITS'
set -euo pipefail
REMOTE="$1"; WEB_UNIT="$2"; WORKER_UNIT="$3"
install -m 644 "$REMOTE/deploy/copiloto/$WEB_UNIT" "/etc/systemd/system/$WEB_UNIT"
install -m 644 "$REMOTE/deploy/copiloto/$WORKER_UNIT" "/etc/systemd/system/$WORKER_UNIT"
systemctl daemon-reload
systemctl enable --now "$WEB_UNIT"
systemctl enable --now "$WORKER_UNIT"
echo "--- systemctl is-active (post enable --now) ---"
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
echo "--- caddy validate (post-reload sanity) ---"
caddy validate --config /etc/caddy/Caddyfile
echo "--- vhosts preexistentes siguen respondiendo (status code informativo, hermes/temporal usan basic_auth -> 401 esperado) ---"
curl -s -o /dev/null -w 'root: %{http_code}\n' "https://${BASE_DOMAIN}/" || true
curl -s -o /dev/null -w 'hermes: %{http_code}\n' "https://hermes.${BASE_DOMAIN}/" || true
curl -s -o /dev/null -w 'temporal: %{http_code}\n' "https://temporal.${BASE_DOMAIN}/" || true
REMOTE_SMOKE

echo "==> Deploy completo."
