#!/usr/bin/env bash
# K-12 spike â€” corre EN EL VPS. GoTrue DESCARTABLE (proyecto gotrue-k12-test), loopback, secretos al vuelo.
# Uso: bash run-remote.sh up|matrix|down   (idempotente; `down` = down -v + rm del stage)
set -uo pipefail
STAGE=/tmp/gotrue-k12; P=gotrue-k12-test; PORT=9971; MAIL=8971
cd "$STAGE"
ENVF="$STAGE/k12.env"
dc() { docker compose -p "$P" --env-file "$ENVF" -f docker-compose.gotrue.yml -f docker-compose.k12-override.yml "$@"; }
b64() { python3 -c "import sys,base64;print(base64.urlsafe_b64encode(sys.stdin.buffer.read()).rstrip(b'=').decode())"; }
jwt() { python3 - "$1" "$2" <<'PY'
import sys,hmac,hashlib,base64,json
def e(b): return base64.urlsafe_b64encode(b).rstrip(b'=')
h=e(json.dumps({"alg":"HS256","typ":"JWT"}).encode()); p=e(json.dumps({"role":sys.argv[2],"iss":"k12"}).encode())
s=e(hmac.new(sys.argv[1].encode(),h+b'.'+p,hashlib.sha256).digest()); print((h+b'.'+p+b'.'+s).decode())
PY
}
setenvv() { # setenvv KEY VAL  (reemplaza o agrega)
  grep -v "^$1=" "$ENVF" > "$ENVF.t"; echo "$1=$2" >> "$ENVF.t"; mv "$ENVF.t" "$ENVF"; }
cmd_up() {
  if [ ! -f "$ENVF" ]; then
    JS=$(openssl rand -hex 32); PG=$(openssl rand -hex 16)
    cat > "$ENVF" <<E
COMPOSE_PROJECT_NAME=$P
COPILOTO_AUTH_PORT=$PORT
COPILOTO_SUPABASE_URL=http://127.0.0.1:$PORT
COPILOTO_JWT_SECRET=$JS
COPILOTO_JWT_ISSUER=https://k12.local/auth/v1
GOTRUE_SITE_URL=https://k12.local
GOTRUE_PG_PASSWORD=$PG
GOTRUE_PG_DB=postgres
GOTRUE_DISABLE_SIGNUP=true
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SMTP_HOST=mailpit
GOTRUE_SMTP_PORT=1025
GOTRUE_SMTP_ADMIN_EMAIL=admin@k12.local
K12_MAIL_PORT=$MAIL
E
    chmod 600 "$ENVF"
  fi
  dc up -d 2>&1 | tail -15
  for i in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/auth/v1/health" >/dev/null 2>&1 && { echo "health OK"; return 0; }; sleep 2; done
  echo "health FAIL"; dc logs auth | tail -20; return 1
}
cmd_down() { [ -f "$ENVF" ] && dc down -v --remove-orphans 2>&1 | tail -10; cd /; rm -rf "$STAGE"; echo "teardown done"; docker ps -a --filter "name=$P" --format '{{.Names}}'; docker volume ls -q | grep "$P" || echo "sin volumenes"; docker network ls -q --filter "name=$P" | grep . || echo "sin redes"; }

case "${1:-}" in up) cmd_up;; down) cmd_down;; matrix|extra|sinsmtp)
  # NO exportar el env-file al shell: compose da precedencia al entorno del proceso sobre --env-file
  # y pisaría los setenv de cada escenario (bug del primer run: AUTOCONFIRM quedaba en true).
  JS=$(grep "^COPILOTO_JWT_SECRET=" "$ENVF" | cut -d= -f2)
  export SERVICE_KEY="$(jwt "$JS" service_role)" ANON_KEY="$(jwt "$JS" anon)" PORT MAIL STAGE P
  python3 "${1}.py";;
 setenv) shift; setenvv "$@";; recreate) dc up -d --force-recreate auth 2>&1 | tail -3
  for i in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/auth/v1/health" >/dev/null 2>&1 && { echo "health OK"; exit 0; }; sleep 2; done; exit 1;;
 *) echo "uso: up|matrix|extra|sinsmtp|down"; exit 2;; esac
