#!/usr/bin/env bash
# =============================================================================
# deploy/copiloto/gotrue/repoint-env.sh — FUENTE ÚNICA del repoint de auth.
# Proyecta la config de la GoTrue DEDICADA (copiloto-gotrue.env) a los
# EnvironmentFiles que consume el proceso. Invocado (NO reimplementado) por
# deploy.sh [2/7] y migrate-and-cutover.sh → sin drift entre ambos (review B10).
#
# Idempotente. Corre EN EL VPS. Parametrizable por UC_ENV_DIR.
# =============================================================================
set -euo pipefail

ENVDIR="${UC_ENV_DIR:-/etc/unreal-copilot}"
GOTRUE_ENV="$ENVDIR/copiloto-gotrue.env"
COPILOTO_ENV="$ENVDIR/copiloto.env"
SUPA_ENV="$ENVDIR/fusion-supabase.env"

[ -f "$GOTRUE_ENV" ]   || { echo "FALTA $GOTRUE_ENV -> corré deploy-gotrue.sh primero" >&2; exit 1; }
[ -f "$COPILOTO_ENV" ] || { echo "FALTA $COPILOTO_ENV" >&2; exit 1; }
[ -f "$SUPA_ENV" ]     || { echo "FALTA $SUPA_ENV" >&2; exit 1; }

set -a; . "$GOTRUE_ENV"; set +a

# upsert KEY VALUE FILE — ESCAPA &, \ y el delimitador | del valor antes del reemplazo de sed.
# COPILOTO_JWT_ISSUER es la única var con valor arbitrario del operador (review B7): un & (URL con
# query) o \ lo corrompería silenciosamente → mismatch de iss → 401 en todos los tokens. Escapamos
# uniformemente por robustez (el resto son hex/base64url/url loopback, pero el escape es inofensivo).
upsert() {
  local k="$1" v="$2" f="$3" ve
  ve=$(printf '%s' "$v" | sed -e 's/[&|\\]/\\&/g')
  if grep -q "^${k}=" "$f"; then sed -i "s|^${k}=.*|${k}=${ve}|" "$f"; else printf '%s=%s\n' "$k" "$v" >> "$f"; fi
}

# Header aclaratorio en fusion-supabase.env (review B11: naming heredado; ahora apunta a la GoTrue
# DEDICADA, NO a fusion). Idempotente. Un `#` no afecta el sourcing del EnvironmentFile.
grep -q '^# NOTA: repurposed' "$SUPA_ENV" || sed -i '1i # NOTA: repurposed -> apunta a la GoTrue DEDICADA del copiloto (no a fusion). Ver deploy/copiloto/gotrue/README.md' "$SUPA_ENV"

upsert SUPABASE_JWT_SECRET       "$COPILOTO_JWT_SECRET"        "$COPILOTO_ENV"
upsert COPILOTO_JWT_ISSUER       "$COPILOTO_JWT_ISSUER"        "$COPILOTO_ENV"
# Flag que hace el iss-enforcement FAIL-CLOSED en serve.py (review M4): con el flag en true, la
# ausencia de COPILOTO_JWT_ISSUER aborta el arranque en vez de desactivar el control en silencio.
upsert COPILOTO_DEDICATED_GOTRUE "true"                        "$COPILOTO_ENV"
upsert SUPABASE_URL              "$COPILOTO_SUPABASE_URL"      "$SUPA_ENV"
upsert SERVICE_ROLE_KEY          "$COPILOTO_SERVICE_ROLE_KEY"  "$SUPA_ENV"
upsert ANON_KEY                  "$COPILOTO_ANON_KEY"          "$SUPA_ENV"
chmod 600 "$COPILOTO_ENV" "$SUPA_ENV"
echo "auth repoint OK (-> GoTrue dedicada; flag COPILOTO_DEDICATED_GOTRUE=true; valores NO impresos)"
