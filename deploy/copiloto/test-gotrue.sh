#!/usr/bin/env bash
# deploy/copiloto/test-gotrue.sh — levanta (idempotente) una GoTrue de TEST efímera y deja sus
# credenciales para pytest.
#
# POR QUÉ EXISTE: K-12 (BL-J11) se regresionaba contra un `httpx.MockTransport` que simulaba GoTrue
# (`apps/copiloto/tests/test_cambiar_cuenta.py`). Integración > mocks es regla dura del repo
# (CLAUDE.md raíz §Testing) y la auditoría A2 lo marcó explícito: "no acepto el sustituto" — el DoD
# pide una GoTrue real con cuentas efímeras, nunca `copiloto-auth` de prod. Mismo criterio que
# `test-db.sh` con Postgres: una base/servicio efímero propio, nunca compartido con producción.
#
# QUÉ LEVANTA: el MISMO compose de producción (`docker-compose.gotrue.yml`, GoTrue v2.186.0 — la
# imagen y el contrato de token son idénticos a `copiloto-auth`) + un override de test (mailpit para
# capturar SMTP sin salir a internet, y 3 vars que prod no necesita exponer). Aislado por
# `COMPOSE_PROJECT_NAME` + puertos loopback propios (9971/8971 por default) — nunca comparte red,
# volumen ni puerto con `copiloto-auth`. Validado empíricamente por el spike
# `spikes/gotrue-cambiar-mail-contrasena/` (RESULT.md, matriz de códigos de error contra GoTrue real).
#
# IDEMPOTENTE: si el stack ya corre, lo reutiliza; los secretos se generan UNA vez y se guardan
# server-side (`$STAGE/test-gotrue.env`, chmod 600, JAMÁS en el repo). `--recreate` lo tira y lo
# vuelve a levantar (cuentas nuevas, base de auth vacía). `--down` lo destruye por completo.
# Parametrizable (cero hardcoding): UC_DEPLOY_HOST, UC_TESTGOTRUE_{STAGE,NAME,PORT,MAIL_PORT}.
#
# Uso:
#   bash deploy/copiloto/test-gotrue.sh                    # levanta o reutiliza, imprime credenciales
#   bash deploy/copiloto/test-gotrue.sh --recreate          # tira el stack y lo reconstruye vacío
#   bash deploy/copiloto/test-gotrue.sh --down              # teardown completo (containers+vol+red+stage)
#   eval "$(bash deploy/copiloto/test-gotrue.sh --export)"  # deja UC_TEST_GOTRUE_* en el shell
#
# Después:
#   UC_TEST_GOTRUE_URL="..." UC_TEST_GOTRUE_JWT_SECRET="..." \
#   UC_TEST_GOTRUE_SERVICE_ROLE_KEY="..." UC_TEST_GOTRUE_ANON_KEY="..." \
#     bash deploy/copiloto/sync-test-backend.sh tests/test_cambiar_cuenta_gotrue_real.py -q
#   (o exportadas por `eval` arriba: `sync-test-backend.sh` las reenvía solas, ver su wiring)
set -euo pipefail

HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
STAGE="${UC_TESTGOTRUE_STAGE:-/tmp/copiloto-test-gotrue}"   # efímero a propósito: ahí viven los secretos
LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GOTRUE_DIR="deploy/copiloto/gotrue"

PROJECT="${UC_TESTGOTRUE_NAME:-copiloto-test-gotrue}"
PORT="${UC_TESTGOTRUE_PORT:-9971}"
MAILPORT="${UC_TESTGOTRUE_MAIL_PORT:-8971}"
ENVF="$STAGE/test-gotrue.env"

RECREAR=0; EXPORTAR=0; DOWN=0
for arg in "$@"; do
  case "$arg" in
    --recreate) RECREAR=1 ;;
    --export)   EXPORTAR=1 ;;
    --down)     DOWN=1 ;;
    *) echo "argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

decir() { [ "$EXPORTAR" -eq 1 ] || echo "$@"; }   # con --export sólo sale lo evaluable

dc() {
  ssh "$HOST" "cd '$STAGE' && docker compose -p '$PROJECT' --env-file '$ENVF' \
    -f docker-compose.gotrue.yml -f docker-compose.test-override.yml $*"
}

# --- teardown completo ---------------------------------------------------------------------------
if [ "$DOWN" -eq 1 ]; then
  if ssh "$HOST" "test -f '$ENVF'"; then
    dc "down -v --remove-orphans" 2>&1 | tail -10
  fi
  ssh "$HOST" "rm -rf '$STAGE'"
  echo "==> teardown hecho. Verificación (debe salir vacío):"
  ssh "$HOST" "docker ps -a --filter \"name=${PROJECT}\" --format '{{.Names}}'"
  ssh "$HOST" "docker volume ls -q | grep '${PROJECT}' || echo '  sin volumenes'"
  ssh "$HOST" "docker network ls -q --filter \"name=${PROJECT}\" | grep . || echo '  sin redes'"
  exit 0
fi

if [ "$RECREAR" -eq 1 ] && ssh "$HOST" "test -f '$ENVF'"; then
  decir "==> --recreate: tiro el stack ${PROJECT} (queda el env-file, cuentas de auth se pierden)"
  dc "down -v --remove-orphans" >/dev/null 2>&1 || true
fi

# --- 1. sync de los archivos de compose (nunca los secretos: esos nacen server-side) --------------
decir "==> sync compose -> ${HOST}:${STAGE}"
ssh "$HOST" "mkdir -p '$STAGE'"
tar -czf - -C "$LOCAL/$GOTRUE_DIR" \
  docker-compose.gotrue.yml Caddyfile init-auth-schema.sql docker-compose.test-override.yml \
  | ssh "$HOST" "tar -C '$STAGE' -xzf -"

# --- 2. secretos: generados UNA vez, server-side, chmod 600 ---------------------------------------
if ! ssh "$HOST" "test -f '$ENVF'"; then
  decir "==> primer levante: genero secretos en ${HOST}:${ENVF}"
  JWT_SECRET="$(ssh "$HOST" "openssl rand -hex 32")"
  PG_PASS="$(ssh "$HOST" "openssl rand -hex 16")"
  ssh "$HOST" "cat > '$ENVF' <<EOF
COMPOSE_PROJECT_NAME=${PROJECT}
COPILOTO_AUTH_PORT=${PORT}
COPILOTO_SUPABASE_URL=http://127.0.0.1:${PORT}
COPILOTO_JWT_SECRET=${JWT_SECRET}
COPILOTO_JWT_ISSUER=https://test-gotrue.local/auth/v1
GOTRUE_SITE_URL=https://test-gotrue.local
GOTRUE_PG_PASSWORD=${PG_PASS}
GOTRUE_PG_DB=postgres
GOTRUE_DISABLE_SIGNUP=true
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SMTP_HOST=mailpit
GOTRUE_SMTP_PORT=1025
GOTRUE_SMTP_ADMIN_EMAIL=admin@test-gotrue.local
UC_TESTGOTRUE_MAIL_PORT=${MAILPORT}
EOF
chmod 600 '$ENVF'"
else
  decir "==> secretos ya existen (idempotente) — los reutilizo"
fi
JWT_SECRET="$(ssh "$HOST" "grep '^COPILOTO_JWT_SECRET=' '$ENVF' | cut -d= -f2")"

# --- 3. el stack -----------------------------------------------------------------------------------
ESTADO="$(ssh "$HOST" "cd '$STAGE' && docker compose -p '$PROJECT' ps --status running -q proxy 2>/dev/null" || true)"
if [ -n "$ESTADO" ]; then
  decir "==> ${PROJECT} ya corre — lo reutilizo (idempotente)"
else
  decir "==> levanto ${PROJECT} en 127.0.0.1:${PORT} (mailpit en :${MAILPORT})"
  dc "up -d" 2>&1 | tail -15
fi

decir "==> espero /auth/v1/health"
if ! ssh "$HOST" "for i in \$(seq 1 30); do curl -fsS 'http://127.0.0.1:${PORT}/auth/v1/health' >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1"; then
  echo "ABORTA: ${PROJECT} no respondió health en 60s" >&2
  dc "logs auth" 2>&1 | tail -30
  exit 1
fi
decir "==> health OK"

# --- 4. JWTs de service_role/anon firmados con el mismo secreto que GoTrue -------------------------
# Mismo criterio que el spike (`run-remote.sh:jwt()`): HS256 mínimo, suficiente para que GoTrue
# valide `apikey`/`Authorization: Bearer` en /auth/v1/* (GoTrueAdmin sólo necesita el service_role).
FIRMAR='
import sys, hmac, hashlib, base64, json
def e(b): return base64.urlsafe_b64encode(b).rstrip(b"=")
h = e(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
p = e(json.dumps({"role": sys.argv[2], "iss": "copiloto-test-gotrue"}).encode())
s = e(hmac.new(sys.argv[1].encode(), h + b"." + p, hashlib.sha256).digest())
print((h + b"." + p + b"." + s).decode())
'
SERVICE_KEY="$(ssh "$HOST" "python3 -c '$FIRMAR' '$JWT_SECRET' service_role")"
ANON_KEY="$(ssh "$HOST" "python3 -c '$FIRMAR' '$JWT_SECRET' anon")"

if [ "$EXPORTAR" -eq 1 ]; then
  echo "export UC_TEST_GOTRUE_URL='http://127.0.0.1:${PORT}'"
  echo "export UC_TEST_GOTRUE_JWT_SECRET='${JWT_SECRET}'"
  echo "export UC_TEST_GOTRUE_SERVICE_ROLE_KEY='${SERVICE_KEY}'"
  echo "export UC_TEST_GOTRUE_ANON_KEY='${ANON_KEY}'"
else
  echo "==> LISTA: GoTrue de test en http://127.0.0.1:${PORT} (mailpit UI en http://127.0.0.1:${MAILPORT})"
  echo "    Efímera y descartable: bash $0 --recreate (vacía las cuentas) · bash $0 --down (la destruye)"
  echo
  echo "    eval \"\$(bash deploy/copiloto/test-gotrue.sh --export)\""
  echo "    bash deploy/copiloto/sync-test-backend.sh tests/test_cambiar_cuenta_gotrue_real.py -q"
fi
