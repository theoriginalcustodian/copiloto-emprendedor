#!/usr/bin/env bash
# =============================================================================
# deploy/copiloto/gotrue/deploy-gotrue.sh — levanta la GoTrue DEDICADA del copiloto.
# Corre EN EL VPS (se sincroniza con el resto de deploy/copiloto). IDEMPOTENTE:
#   - genera copiloto-gotrue.env (secreto+pw+keys) SOLO la 1ª vez (preserva secretos)
#   - `docker compose up -d` recrea solo lo cambiado
#   - se puede correr N veces sin duplicar nada ni rotar secretos
#
# NO toca el copiloto vivo (el cutover es un paso SEPARADO: migrate-and-cutover.sh).
# Deja el stack corriendo + AUTO-VALIDADO contra realidad (health + admin-create +
# password login + decode con la función REAL del copiloto + limpia el user de prueba).
#
# Parametrizable (cero hardcoding): UC_ENV_DIR, UC_VENV, COPILOTO_AUTH_PORT,
# COPILOTO_JWT_ISSUER, GOTRUE_SITE_URL, GOTRUE_URI_ALLOW_LIST.
# =============================================================================
set -euo pipefail

ENVDIR="${UC_ENV_DIR:-/etc/unreal-copilot}"
VENV="${UC_VENV:-/opt/uc-copiloto-venv}"
STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COPILOTO_SRC="${UC_COPILOTO_SRC:-/opt/uc-repos/copiloto/apps/copiloto}"
COPILOTO_REF="${UC_COPILOTO_REF:-/opt/uc-repos/copiloto/deploy/skeleton_kit/archetypes/conversational_agent/reference}"
ENVFILE="$ENVDIR/copiloto-gotrue.env"
PORT="${COPILOTO_AUTH_PORT:-9997}"
COMPOSE=(docker compose --env-file "$ENVFILE" -f "$STACK_DIR/docker-compose.gotrue.yml")

echo "==> [1/5] env server-side ($ENVFILE) — genera solo la 1ª vez (preserva secretos)"
if [ ! -f "$ENVFILE" ]; then
  umask 077
  {
    echo "COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-copiloto-auth}"
    echo "COPILOTO_AUTH_PORT=$PORT"
    echo "COPILOTO_SUPABASE_URL=http://127.0.0.1:$PORT"
    echo "COPILOTO_JWT_SECRET=$(openssl rand -hex 32)"
    echo "COPILOTO_JWT_ISSUER=${COPILOTO_JWT_ISSUER:-https://copiloto-auth.local/auth/v1}"
    echo "GOTRUE_SITE_URL=${GOTRUE_SITE_URL:-https://copiloto.178-105-191-1.sslip.io}"
    echo "GOTRUE_URI_ALLOW_LIST=${GOTRUE_URI_ALLOW_LIST:-https://copiloto.178-105-191-1.sslip.io/*}"
    echo "GOTRUE_PG_PASSWORD=$(openssl rand -hex 24)"
    echo "GOTRUE_PG_DB=postgres"
    echo "GOTRUE_TAG=v2.186.0"
    echo "CADDY_TAG=2"
    echo "GOTRUE_JWT_EXP=3600"
    echo "GOTRUE_DISABLE_SIGNUP=true"
    echo "GOTRUE_EXTERNAL_GOOGLE_ENABLED=false"
    echo "GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID="
    echo "GOTRUE_EXTERNAL_GOOGLE_SECRET="
    echo "GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI="
  } > "$ENVFILE"
  chmod 600 "$ENVFILE"
  echo "    generado (secreto+pw nuevos, 600)"
else
  echo "    ya existe -> preservo secretos (idempotente)"
fi

echo "==> [2/5] derivar service_role + anon keys (JWT firmados con el secreto propio) si faltan"
set -a; . "$ENVFILE"; set +a
if ! grep -q '^COPILOTO_SERVICE_ROLE_KEY=' "$ENVFILE"; then
  gen_key() { "$VENV/bin/python" -c "import jwt,time,os; print(jwt.encode({'role':'$1','iss':os.environ['COPILOTO_JWT_ISSUER'],'iat':int(time.time()),'exp':int(time.time())+10*365*24*3600}, os.environ['COPILOTO_JWT_SECRET'], algorithm='HS256'))"; }
  printf 'COPILOTO_SERVICE_ROLE_KEY=%s\n' "$(gen_key service_role)" >> "$ENVFILE"
  printf 'COPILOTO_ANON_KEY=%s\n' "$(gen_key anon)" >> "$ENVFILE"
  chmod 600 "$ENVFILE"
  set -a; . "$ENVFILE"; set +a
  echo "    derivadas (10y exp, firmadas con COPILOTO_JWT_SECRET)"
else
  echo "    ya presentes (idempotente)"
fi

echo "==> [3/5] docker compose up -d (pinned; idempotente)"
"${COMPOSE[@]}" up -d

echo "==> [4/5] esperar GoTrue healthy (via proxy loopback /auth/v1/health)"
code=""
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/auth/v1/health" 2>/dev/null || true)
  [ "$code" = "200" ] && break
  sleep 1
done
if [ "$code" != "200" ]; then
  echo "    GoTrue NO healthy (last=$code) — logs:"; "${COMPOSE[@]}" logs --tail 40 auth; exit 1
fi
echo "    healthy ✅"

echo "==> [5/5] auto-validación contra el stack REAL (admin create + login + decode real + cleanup)"
SRK="$COPILOTO_SERVICE_ROLE_KEY"
EMAIL="selftest+$(openssl rand -hex 4)@copiloto.local"
PW="Self-$(openssl rand -hex 8)!"
CREATE=$(curl -s -X POST "http://127.0.0.1:$PORT/auth/v1/admin/users" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"email_confirm\":true}")
NEWUID=$(echo "$CREATE" | "$VENV/bin/python" -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
[ -n "$NEWUID" ] || { echo "    admin create FALLO: $CREATE"; exit 1; }
LOGIN=$(curl -s -X POST "http://127.0.0.1:$PORT/auth/v1/token?grant_type=password" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
ACCESS=$(echo "$LOGIN" | "$VENV/bin/python" -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
[ -n "$ACCESS" ] || { echo "    password login FALLO: $LOGIN"; curl -s -X DELETE "http://127.0.0.1:$PORT/auth/v1/admin/users/$NEWUID" -H "apikey: $SRK" -H "Authorization: Bearer $SRK" >/dev/null 2>&1 || true; exit 1; }
TOKEN="$ACCESS" SECRET="$COPILOTO_JWT_SECRET" ISSUER="$COPILOTO_JWT_ISSUER" "$VENV/bin/python" - <<PY || { echo "    decode FALLO"; exit 1; }
import os, sys
sys.path.insert(0, "$COPILOTO_SRC"); sys.path.insert(0, "$COPILOTO_REF")
import jwt
from auth import decode_supabase_jwt
tok=os.environ["TOKEN"]; sec=os.environ["SECRET"]; iss=os.environ["ISSUER"]
c = decode_supabase_jwt(tok, secret=sec)                # decode REAL del copiloto (drop-in)
assert jwt.decode(tok, sec, algorithms=["HS256"], audience="authenticated", issuer=iss, options={"require":["exp","sub"]})["iss"]==iss
print("    decode_supabase_jwt REAL OK + iss propio verificado ✅")
PY
# limpiar el user de prueba (no dejar rastro)
curl -s -X DELETE "http://127.0.0.1:$PORT/auth/v1/admin/users/$NEWUID" -H "apikey: $SRK" -H "Authorization: Bearer $SRK" >/dev/null 2>&1 || true
echo "==> GoTrue dedicada ARRIBA y auto-validada. (cutover = migrate-and-cutover.sh, paso separado)"
