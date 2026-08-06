#!/usr/bin/env bash
# deploy/copiloto/asignar-claim-admin.sh — otorga app_metadata.copiloto_admin=true a un usuario.
#
# POR QUÉ EXISTE (CONS0b, 2026-08-06). El gate `require_admin` de `/admin/*` (auth.py) lee
# `app_metadata.copiloto_admin`. Verificado empíricamente contra GoTrue real (fusion) que ese es
# el ÚNICO lugar seguro: sólo la Admin API puede escribirlo, y 3 intentos de auto-escalada desde
# el propio usuario (top-level, dentro de `data`, `data.app_metadata` anidado) fallaron los 3.
# Ver docs/copiloto-emprendedor/2026-08-06-RESULT-CONS0b-claim-admin.md.
#
# REUTILIZA `onboarding.GoTrueAdmin` (mismo import sys.path que `deploy-gotrue.sh` ya usa para
# `decode_supabase_jwt`) — `find_user_by_email` + `admin_grant_operador`, no reinventa el cliente
# HTTP de la Admin API.
#
# IDEMPOTENTE: correrlo N veces sobre el mismo email deja el mismo estado final (PUT merge, no
# toggle). Requiere que el usuario YA exista en GoTrue (signup/onboarding normal primero) —
# este script sólo OTORGA el claim, no crea cuentas.
#
# Uso:  bash deploy/copiloto/asignar-claim-admin.sh operador@dominio.com
set -euo pipefail

EMAIL="${1:?uso: $0 <email>}"
HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
ENVDIR="${UC_ENV_DIR:-/etc/unreal-copilot}"
COPILOTO_SRC="${UC_COPILOTO_SRC:-/opt/uc-repos/copiloto/apps/copiloto}"
COPILOTO_REF="${UC_COPILOTO_REF:-/opt/uc-repos/copiloto/motor}"

echo "==> Otorgando el claim de administrador a '$EMAIL' vía $HOST"

ssh "$HOST" bash -s -- "$ENVDIR" "$COPILOTO_SRC" "$COPILOTO_REF" "$EMAIL" <<'REMOTO'
set -euo pipefail
ENVDIR="$1"; COPILOTO_SRC="$2"; COPILOTO_REF="$3"; EMAIL="$4"
set -a; . "$ENVDIR/fusion-supabase.env"; set +a
: "${SUPABASE_URL:?falta SUPABASE_URL}"; : "${SERVICE_ROLE_KEY:?falta SERVICE_ROLE_KEY}"

/opt/uc-copiloto-venv/bin/python - "$COPILOTO_SRC" "$COPILOTO_REF" "$EMAIL" <<'PY'
import sys

copiloto_src, copiloto_ref, email = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, copiloto_src)
sys.path.insert(0, copiloto_ref)

from onboarding import GoTrueAdmin

admin = GoTrueAdmin.from_env()
user = admin.find_user_by_email(email)
if user is None:
    print(f"❌ '{email}' no existe en GoTrue -- creá la cuenta primero (signup/onboarding normal).")
    sys.exit(1)

user_id = user["id"]
antes = user.get("app_metadata", {})
print(f"    user_id={user_id}  app_metadata ANTES={antes}")

admin.admin_grant_operador(user_id)

despues = admin.find_user_by_email(email)
am = despues.get("app_metadata", {}) if despues else {}
print(f"    app_metadata DESPUÉS={am}")

if am.get("copiloto_admin") is not True:
    print("❌ el claim NO quedó seteado -- revisar la respuesta de la Admin API arriba.")
    sys.exit(1)
for k, v in antes.items():
    if k != "copiloto_admin" and am.get(k) != v:
        print(f"❌ el claim '{k}' que ya tenía el user CAMBIÓ ({v!r} -> {am.get(k)!r}) -- "
              "el merge no se comportó como se verificó en el spike, revisar antes de confiar en esto.")
        sys.exit(1)

print(f"✅ '{email}' ({user_id}) es administrador. Los claims previos sobrevivieron intactos.")
PY
REMOTO
