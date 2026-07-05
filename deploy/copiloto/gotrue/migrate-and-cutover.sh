#!/usr/bin/env bash
# =============================================================================
# deploy/copiloto/gotrue/migrate-and-cutover.sh — CUTOVER del copiloto a la GoTrue DEDICADA.
# Corre EN EL VPS, DESPUÉS de deploy-gotrue.sh (stack arriba + auto-validado).
#
# Orden (de-riskeado): backup env -> migrar tenants -> repoint env -> restart -> smoke E2E vivo.
# Escribe el marker `.gotrue-cutover-done` SOLO si el smoke pasa (gate de deploy.sh [2/7]).
# ROLLBACK — dos capas:
#   (config) restaurar los .bak-pre-gotrue-* + systemctl restart  → auth vuelve a fusion.
#   (DB)     los tenants quedaron con auth_user_id de la dedicada; para que el login de fusion vuelva
#            a resolver hay que restaurar auth_user_id desde el mapeo persistido ($MAP_OUT). Sin ese
#            paso, un rollback solo-config deja a los migrados en 403. Ver eco final.
# Idempotente: migración append-only (no rota secretos ni pierde creds); repoint es upsert.
# =============================================================================
set -euo pipefail

ENVDIR="${UC_ENV_DIR:-/etc/unreal-copilot}"
VENV="${UC_VENV:-/opt/uc-copiloto-venv}"
STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COPILOTO_SRC="${UC_COPILOTO_SRC:-/opt/uc-repos/copiloto/apps/copiloto}"
WEB_PORT="${COPILOTO_WEB_PORT:-8099}"
STAMP="${CUTOVER_STAMP:?pasá CUTOVER_STAMP=YYYYmmddTHHMMSSZ (date se calcula fuera para no depender de él acá)}"

GOTRUE_ENV="$ENVDIR/copiloto-gotrue.env"
COPILOTO_ENV="$ENVDIR/copiloto.env"
SUPA_ENV="$ENVDIR/fusion-supabase.env"
PGENV="$ENVDIR/fusion-pg.env"
CREDS_OUT="$ENVDIR/copiloto-migrated-creds.txt"
MAP_OUT="$ENVDIR/copiloto-gotrue-migration-map.tsv"
MARKER="$ENVDIR/.gotrue-cutover-done"

for f in "$GOTRUE_ENV" "$COPILOTO_ENV" "$SUPA_ENV" "$PGENV"; do
  [ -f "$f" ] || { echo "FALTA $f" >&2; exit 1; }
done

echo "==> [1/5] backup env-files (rollback = restaurar estos + restart)"
cp -a "$COPILOTO_ENV" "$COPILOTO_ENV.bak-pre-gotrue-$STAMP"
cp -a "$SUPA_ENV"     "$SUPA_ENV.bak-pre-gotrue-$STAMP"
echo "    $COPILOTO_ENV.bak-pre-gotrue-$STAMP"
echo "    $SUPA_ENV.bak-pre-gotrue-$STAMP"

echo "==> [2/5] migrar tenants a la GoTrue dedicada (recrea users + UPDATE auth_user_id, preserva cliente_id)"
(
  set -a; . "$GOTRUE_ENV"; . "$PGENV"; set +a
  export SUPABASE_URL="$COPILOTO_SUPABASE_URL" SERVICE_ROLE_KEY="$COPILOTO_SERVICE_ROLE_KEY"
  export UC_COPILOTO_SRC="$COPILOTO_SRC"
  cd "$COPILOTO_SRC"
  "$VENV/bin/python" "$STACK_DIR/migrate_tenants.py" --creds-out "$CREDS_OUT" --map-out "$MAP_OUT"
)

echo "==> [3/5] repoint env-files a la GoTrue dedicada (fuente única repoint-env.sh, compartida con deploy.sh)"
UC_ENV_DIR="$ENVDIR" bash "$STACK_DIR/repoint-env.sh"

echo "==> [4/5] restart del copiloto (carga secreto+issuer+URL nuevos)"
systemctl restart uc-copiloto-web uc-copiloto-worker
echo "    is-active: $(systemctl is-active uc-copiloto-web) / $(systemctl is-active uc-copiloto-worker)"
# esperar readiness del front-door
for i in $(seq 1 30); do
  curl -sf "http://127.0.0.1:$WEB_PORT/healthz" >/dev/null 2>&1 && break; sleep 1
done

echo "==> [5/5] smoke E2E vivo: login de un tenant migrado -> /me 200 (prueba dedicada + iss propio + registry)"
if [ ! -s "$CREDS_OUT" ]; then
  echo "    (sin creds nuevas — corrida idempotente sobre tenants ya migrados; se omite el login smoke)"
else
  read -r SM_EMAIL SM_PW < <(grep -v '^#' "$CREDS_OUT" | head -1)
  LOGIN=$(curl -s -X POST "http://127.0.0.1:$WEB_PORT/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$SM_EMAIL\",\"password\":\"$SM_PW\"}")
  ACCESS=$(echo "$LOGIN" | "$VENV/bin/python" -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
  [ -n "$ACCESS" ] || { echo "    smoke login FALLO (email de prueba oculto): respuesta=$(echo "$LOGIN" | head -c 120)"; exit 1; }
  ME_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$WEB_PORT/me" -H "Authorization: Bearer $ACCESS")
  [ "$ME_CODE" = "200" ] || { echo "    smoke /me FALLO: HTTP $ME_CODE"; exit 1; }
  echo "    smoke OK: login tenant migrado (GoTrue dedicada) + /me 200 (require_tenant validó iss propio + resolvió cliente_id) ✅"
fi

# Marker de cutover-done: SOLO tras el smoke verde. deploy.sh [2/7] gatea el repoint en su existencia
# → un deploy/DR pre-cutover NO repointea a ciegas a una GoTrue posiblemente vacía (review A2).
date -u +%FT%TZ > "$MARKER"; chmod 600 "$MARKER"

echo ""
echo "==> CUTOVER COMPLETO. El copiloto valida/emite contra su GoTrue DEDICADA (aislada de fusion). Marker: $MARKER"
echo "    Passwords temporales de tenants migrados: $CREDS_OUT (600). Mapeo rollback-DB: $MAP_OUT (600)."
echo "    ROLLBACK (config): cp $COPILOTO_ENV.bak-pre-gotrue-$STAMP $COPILOTO_ENV ; cp $SUPA_ENV.bak-pre-gotrue-$STAMP $SUPA_ENV ; rm -f $MARKER ; systemctl restart uc-copiloto-web uc-copiloto-worker"
echo "    ROLLBACK (DB, si hace falta que el login de fusion resuelva): restaurar auth_user_id desde $MAP_OUT"
echo "      (por fila cliente_id<TAB>old<TAB>new:  UPDATE uc_factory.tenants SET auth_user_id=old WHERE cliente_id=... )"
