#!/usr/bin/env bash
# deploy/copiloto/gotrue/activate-google-oauth.sh — activa Google OAuth en la GoTrue dedicada.
# IDEMPOTENTE. Corre EN EL VPS. NO contiene secretos: las creds llegan por ENV en runtime.
#
# Qué hace (todo idempotente, corrible N veces):
#   1) Upsert de las creds Google + flags en /etc/unreal-copilot/copiloto-gotrue.env (600, server-side).
#   2) Expone SOLO los paths OAuth del browser (/authorize, /callback) en un vhost host-level del Caddy
#      del VPS — NUNCA /auth/v1/* completo (eso publicaría /admin/* a Internet). Valida ANTES de reload;
#      aborta sin tocar el Caddyfile si no valida (hermes/temporal/mp/copiloto intactos).
#   3) Re-corre deploy-gotrue.sh (recrea el container auth con Google habilitado, preserva secretos).
#   4) Verifica: /authorize?provider=google → 302 a accounts.google.com + email/pass sigue 200 (no-regresión).
#
# ENV requerido:
#   GOOGLE_CLIENT_ID       client_id del OAuth client (Web application) de Google Cloud
#   GOOGLE_CLIENT_SECRET   client_secret
#   AUTH_VHOST             dominio público del proxy OAuth (ej: auth.178-105-191-1.sslip.io)
# ENV opcional:
#   ENVDIR    (default /etc/unreal-copilot)   ·   CADDYFILE (default /etc/caddy/Caddyfile)
#   REPO      (default /opt/uc-repos/copiloto) ·   PROXY_PORT (default: COPILOTO_AUTH_PORT del env, o 9997)
set -euo pipefail

: "${GOOGLE_CLIENT_ID:?falta GOOGLE_CLIENT_ID en el env}"
: "${GOOGLE_CLIENT_SECRET:?falta GOOGLE_CLIENT_SECRET en el env}"
: "${AUTH_VHOST:?falta AUTH_VHOST (ej auth.178-105-191-1.sslip.io)}"
ENVDIR="${ENVDIR:-/etc/unreal-copilot}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
REPO="${REPO:-/opt/uc-repos/copiloto}"
GOTRUE_ENV="$ENVDIR/copiloto-gotrue.env"
[ -f "$GOTRUE_ENV" ] || { echo "ERROR: no existe $GOTRUE_ENV (¿corriste deploy-gotrue.sh?)" >&2; exit 1; }
PROXY_PORT="${PROXY_PORT:-$(grep -E '^COPILOTO_AUTH_PORT=' "$GOTRUE_ENV" | cut -d= -f2 || true)}"
PROXY_PORT="${PROXY_PORT:-9997}"
CALLBACK="https://${AUTH_VHOST}/auth/v1/callback"

# --- upsert idempotente KEY=VALUE en un env file (escapa &,|,\ para sed) ---
upsert() {
  local file="$1" key="$2" val="$3" esc
  esc="$(printf '%s' "$val" | sed -e 's/[&|\\]/\\&/g')"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${esc}|" "$file"
  else
    printf '%s=%s\n' "$key" "$val" >> "$file"
  fi
}

echo "=== [1/4] upsert creds Google + flags en $GOTRUE_ENV (600) ==="
umask 077
upsert "$GOTRUE_ENV" GOTRUE_EXTERNAL_GOOGLE_ENABLED      "true"
upsert "$GOTRUE_ENV" GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID    "$GOOGLE_CLIENT_ID"
upsert "$GOTRUE_ENV" GOTRUE_EXTERNAL_GOOGLE_SECRET       "$GOOGLE_CLIENT_SECRET"
upsert "$GOTRUE_ENV" GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI "$CALLBACK"
# OAuth requiere permitir la creación del user en el callback. El signup email directo NO queda
# expuesto: el vhost público solo proxya /authorize + /callback (no /signup) y el backend usa admin API.
upsert "$GOTRUE_ENV" GOTRUE_DISABLE_SIGNUP              "false"
# GoTrue debe conocer su URL pública para el flujo OAuth del browser (no rompe el iss, fijado aparte).
upsert "$GOTRUE_ENV" COPILOTO_API_EXTERNAL_URL          "https://${AUTH_VHOST}"
chmod 600 "$GOTRUE_ENV"
echo "  ok (redirect_uri=$CALLBACK, api_external=https://${AUTH_VHOST})"

echo "=== [2/4] vhost OAuth-only en $CADDYFILE (idempotente + caddy validate; aborta sin tocar si no valida) ==="
python3 - "$CADDYFILE" "$AUTH_VHOST" "$PROXY_PORT" <<'PY'
import os, re, shutil, subprocess, sys
path, vhost, port = sys.argv[1:4]
with open(path, encoding="utf-8") as f:
    content = f.read()
if f"\n{vhost} " in content or content.startswith(f"{vhost} ") or f"\n{vhost}{{" in content:
    print(f"= vhost {vhost} ya existe (no-op)")
    sys.exit(0)
# Bloque OAuth-only: expone SOLO /authorize + /callback; TODO lo demas (incluido /admin/*) -> 404.
# Usar `handle` (bloques MUTUAMENTE EXCLUYENTES, respetan el orden escrito) y NO `respond 404` suelto:
# en Caddy `respond` tiene MAYOR prioridad de directiva que `reverse_proxy`, asi que un `respond 404`
# sin matcher intercepta TODO (incluido /authorize) ANTES del proxy -> el vhost entero da 404.
block = (
    f"\n{vhost} {{\n"
    f"    handle /auth/v1/authorize* {{\n"
    f"        reverse_proxy 127.0.0.1:{port}\n"
    f"    }}\n"
    f"    handle /auth/v1/callback* {{\n"
    f"        reverse_proxy 127.0.0.1:{port}\n"
    f"    }}\n"
    f"    handle {{\n"
    f"        respond 404\n"
    f"    }}\n"
    f"}}\n"
)
new = content.rstrip("\n") + "\n" + block
tmp = path + ".new"
with open(tmp, "w", encoding="utf-8") as f:
    f.write(new)
r = subprocess.run(["caddy", "validate", "--config", tmp], capture_output=True, text=True)
if r.returncode != 0:
    print("CADDY VALIDATE FALLO -- abortando SIN aplicar (Caddyfile intacto)", file=sys.stderr)
    print(r.stdout, r.stderr, file=sys.stderr)
    sys.exit(1)
# Preservar owner+mode ORIGINALES del Caddyfile: el proceso corre con umask heredado (077 del paso 1),
# y sin esto el archivo movido queda 600 root -> el usuario `caddy` no lo puede LEER en el reload
# ("permission denied") aunque `caddy validate` haya pasado. Capturar el stat ANTES del move y re-aplicarlo.
orig_st = os.stat(path)
shutil.copy(path, path + ".bak-google")
shutil.move(tmp, path)
os.chmod(path, orig_st.st_mode)
try:
    os.chown(path, orig_st.st_uid, orig_st.st_gid)
except PermissionError:
    pass
print(f"+ agregado vhost OAuth-only {vhost} -> 127.0.0.1:{port} (backup .bak-google, perms preservados)")
PY
systemctl reload caddy
echo "  caddy recargado"

echo "=== [3/4] deploy-gotrue.sh (recrea container auth con Google ON, preserva secretos) ==="
bash "$REPO/deploy/copiloto/gotrue/deploy-gotrue.sh" 2>&1 | tail -12

echo "=== [4/4] verificación ==="
# 4a) /authorize?provider=google debe redirigir (302) a accounts.google.com con el client_id.
echo "--- authorize -> Google (via loopback proxy, sin depender del cert publico aun) ---"
LOC="$(curl -s -o /dev/null -w '%{redirect_url}' "http://127.0.0.1:${PROXY_PORT}/auth/v1/authorize?provider=google" || true)"
echo "  redirect_url: ${LOC%%\?*}?<...>"
case "$LOC" in
  *accounts.google.com*client_id=${GOOGLE_CLIENT_ID}*) echo "  OK: 302 a Google con el client_id correcto" ;;
  *accounts.google.com*) echo "  OK: 302 a Google (client_id no verificado en la query)" ;;
  *) echo "  ⚠️  NO redirige a Google -- revisar (LOC=$LOC)"; ;;
esac
# 4b) el vhost publico responde (cert Let's Encrypt se emite en el 1er handshake; puede tardar).
echo "--- vhost publico https://${AUTH_VHOST}/auth/v1/authorize?provider=google (reintenta por el cert) ---"
for i in $(seq 1 6); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "https://${AUTH_VHOST}/auth/v1/authorize?provider=google" || true)"
  [ "$CODE" = "302" ] && { echo "  OK: publico responde 302"; break; }
  echo "  intento $i: http_code=$CODE (esperando cert/propagacion)"; sleep 5
done
# 4c) el vhost publico NO debe exponer el admin API.
ADMIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' "https://${AUTH_VHOST}/auth/v1/admin/users" || true)"
echo "--- admin API por el vhost publico: http_code=$ADMIN_CODE (debe ser 404) ---"
echo "=== LISTO (verificar el round-trip real con browser: click 'Entrar con Google') ==="
