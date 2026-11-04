#!/usr/bin/env bash
# Control positivo de SM-N52 (DoD 3): los tests de la Consola ¿dan ROJO si se les quita el aislamiento?
# Contenedor y puerto PROPIOS: mutar el `copiloto-test-db` compartido fabricaría rojos/verdes falsos a
# las otras sesiones. Reversión en trap. Uso: bash docs/Errores/controles/control-positivo-sm-n52-aislamiento-consola.sh "$PWD"  (requiere UC_SIN_PG en backend.sh)
set -uo pipefail
WT="$1"; cd "$WT"
export UC_TESTDB_NAME="${UC_TESTDB_NAME:-copiloto-test-db-control-n52}" UC_TESTDB_PORT="${UC_TESTDB_PORT:-55499}" UC_TEST_STAGE="${UC_TEST_STAGE:-/opt/uc-stage-control-n52}"
HOST="${UC_DEPLOY_HOST:-unreal-copilot}"; STAGE=$UC_TEST_STAGE; VENV="${UC_VENV:-/opt/uc-copiloto-venv}"
eval "$(bash deploy/copiloto/test-db.sh --export 2>/dev/null | grep '^export ')"
F="tests/test_admin_auditoria.py tests/test_admin_errores.py tests/test_admin_errores_reintentar.py tests/test_admin_soporte.py tests/test_admin_soporte_tickets.py tests/test_admin_tenants.py tests/test_admin_uso.py tests/test_auditoria_store.py tests/test_rls_invariantes.py"
T=uc_factory.copiloto_traumas
sqlx() { ssh "$HOST" "docker exec -i '$UC_TESTDB_NAME' psql -U postgres -q -v ON_ERROR_STOP=1 -c \"$1\""; }
revertir() {
  sqlx "REVOKE INSERT ON $T FROM copiloto_consola; ALTER TABLE $T ENABLE ROW LEVEL SECURITY; ALTER TABLE $T FORCE ROW LEVEL SECURITY;" >/dev/null 2>&1
}
trap revertir EXIT
correr_sin_provision() {  # provision.py re-aplicaría FORCE y BORRARÍA la mutación: se saltea a propósito
  ssh "$HOST" "UC_SIN_PG=1 DATABASE_URL='$UC_TEST_DATABASE_URL' UC_RLS_FORCE=1 COPILOTO_AUTOSANACION_DSN='$UC_TEST_AUTOSANACION_URL' COPILOTO_CONSOLA_DSN='$UC_TEST_CONSOLA_URL' PYTHONPATH='$STAGE/apps/copiloto:$STAGE/motor' PYTHON_BIN='$VENV/bin/python' bash '$STAGE/scripts/ci/backend.sh' $F -q -p no:cacheprovider -rfE" 2>&1 | grep -E "^(FAILED|ERROR) |passed|failed" | sed -E 's/ - .*//'
}

echo "### BASE (con provision): debe ser verde"
bash deploy/copiloto/sync-test-backend.sh $F -q -p no:cacheprovider 2>&1 | grep -E "passed|failed" | tail -1

echo "### MUTANTE 1: el rol de la Consola puede ESCRIBIR (GRANT INSERT en copiloto_traumas)"
sqlx "GRANT INSERT ON $T TO copiloto_consola;"; correr_sin_provision; revertir

echo "### MUTANTE 2: copiloto_traumas SIN RLS (un tenant ve lo de otro)"
sqlx "ALTER TABLE $T NO FORCE ROW LEVEL SECURITY; ALTER TABLE $T DISABLE ROW LEVEL SECURITY;"; correr_sin_provision; revertir

echo "### BASE de nuevo, sin provision (la reversión dejó todo como estaba): debe ser verde"
correr_sin_provision
ssh "$HOST" "docker rm -f '$UC_TESTDB_NAME'" >/dev/null 2>&1 && echo "### contenedor propio eliminado"
