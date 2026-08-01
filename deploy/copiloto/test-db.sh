#!/usr/bin/env bash
# deploy/copiloto/test-db.sh — levanta (idempotente) una base de tests para el Copiloto y deja su URL.
#
# POR QUÉ EXISTE: los tests `@necesita_pg` se saltaban SIEMPRE porque la única URL disponible apuntaba
# al schema VIVO, y correrlos ahí ya costó 552 filas huérfanas en producción. En fusion no se puede
# aislar —el rol `uc_factory` no puede crear base ni schema (`rolcreatedb=false`,
# `has_database_privilege(...,'CREATE')=false`, medido 2026-07-22)—, así que la base de tests NO vive
# en fusion: es un Postgres propio en el VPS, de la MISMA versión mayor (17), efímero y vaciable
# entero sin pensarlo. Medido: con esto la suite pasa de 809 passed / 89 skipped a 884 / 15.
#
# ⚠️ EL ROL IMPORTA MÁS QUE LA BASE (2026-07-31). Hasta hoy esta base se usaba como `postgres`, que es
# SUPERUSER — y un superuser saltea RLS **incluso con FORCE**. O sea: cualquier test de aislamiento
# pasaba acá sobre un aislamiento que no existía; el instrumento CONFIRMABA en vez de verificar. Es
# exactamente el falso-verde que tenía el CI y que costó descubrir que 72 de 77 tablas no filtraban
# nada. Por eso ahora la URL que este script entrega es la de un rol que REPLICA PRODUCCIÓN:
# `copiloto_app`, dueño de sus tablas, NOSUPERUSER NOBYPASSRLS. Si un test se pone rojo con este rol
# y verde con `--admin`, el rojo es el dato correcto.
#
# IDEMPOTENTE: si el contenedor ya corre, lo reutiliza; el bootstrap y el provisionado son
# idempotentes por sí mismos. `--recreate` lo destruye y lo vuelve a levantar vacío.
# Parametrizable (cero hardcoding): UC_DEPLOY_HOST, UC_TEST_STAGE, UC_VENV,
# UC_TESTDB_{NAME,PORT,PASS,IMAGE,APP_USER}, UC_RLS_FORCE.
#
# Uso:
#   bash deploy/copiloto/test-db.sh                 # levanta o reutiliza, imprime la URL (rol app)
#   bash deploy/copiloto/test-db.sh --recreate      # tira la base y la reconstruye desde cero
#   bash deploy/copiloto/test-db.sh --admin         # URL del superuser (NO verifica RLS; ver arriba)
#   eval "$(bash deploy/copiloto/test-db.sh --export)"   # deja UC_TEST_DATABASE_URL en el shell
#
# ⚠️ Al cambiar de rol hay que `--recreate`: las tablas viejas son propiedad de `postgres` y el rol de
# la app no puede alterarlas. Es efímera y descartable, para eso existe.
#
# Después:
#   UC_TEST_DATABASE_URL="<la url>" bash deploy/copiloto/sync-test-backend.sh tests -q
set -euo pipefail

HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
STAGE="${UC_TEST_STAGE:-/opt/uc-copiloto-cliente-stage}"
VENV="${UC_VENV:-/opt/uc-copiloto-venv}"
LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOTOR="motor"

NOMBRE="${UC_TESTDB_NAME:-copiloto-test-db}"
PUERTO="${UC_TESTDB_PORT:-55432}"
PASS="${UC_TESTDB_PASS:-tests-locales-sin-datos-reales}"
IMAGEN="${UC_TESTDB_IMAGE:-postgres:17-alpine}"   # pinneada: fusion corre 17.6, nada de `latest`
APP_USER="${UC_TESTDB_APP_USER:-copiloto_app}"
#: El rol del ciclo de auto-reparación (BYPASSRLS), espejo del de producción. Ver el bootstrap.
AUTOSAN_USER="${UC_TESTDB_AUTOSAN_USER:-copiloto_autosanacion}"
URL_ADMIN="postgres://postgres:${PASS}@127.0.0.1:${PUERTO}/postgres"
URL_APP="postgres://${APP_USER}:${PASS}@127.0.0.1:${PUERTO}/postgres"
URL_AUTOSAN="postgres://${AUTOSAN_USER}:${PASS}@127.0.0.1:${PUERTO}/postgres"

RECREAR=0; EXPORTAR=0; ADMIN=0
for arg in "$@"; do
  case "$arg" in
    --recreate) RECREAR=1 ;;
    --export)   EXPORTAR=1 ;;
    --admin)    ADMIN=1 ;;
    *) echo "argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

# La URL que se entrega y con la que se provisiona. Por default el rol de la app, para que el
# provisionado lo deje como DUEÑO de las tablas — igual que producción, donde `uc_factory` las posee.
if [ "$ADMIN" -eq 1 ]; then URL="$URL_ADMIN"; else URL="$URL_APP"; fi

decir() { [ "$EXPORTAR" -eq 1 ] || echo "$@"; }   # con --export sólo sale la línea evaluable

# --- 1. el contenedor ------------------------------------------------------------------------
if [ "$RECREAR" -eq 1 ]; then
  decir "==> --recreate: destruyo ${NOMBRE} si existe"
  ssh "$HOST" "docker rm -f '${NOMBRE}' >/dev/null 2>&1 || true"
fi

ESTADO="$(ssh "$HOST" "docker inspect -f '{{.State.Running}}' '${NOMBRE}' 2>/dev/null || echo ausente")"
if [ "$ESTADO" = "true" ]; then
  decir "==> ${NOMBRE} ya corre — lo reutilizo (idempotente)"
else
  decir "==> levanto ${NOMBRE} (${IMAGEN}) en 127.0.0.1:${PUERTO}"
  ssh "$HOST" "docker rm -f '${NOMBRE}' >/dev/null 2>&1 || true
    docker run -d --name '${NOMBRE}' -e POSTGRES_PASSWORD='${PASS}' \
      -p 127.0.0.1:${PUERTO}:5432 '${IMAGEN}' >/dev/null"
  # Esperar a que ACEPTE conexiones, no a que el contenedor "exista": `docker run` vuelve enseguida y
  # Postgres tarda unos segundos más. Un sleep fijo es la versión que falla el día que el VPS está
  # cargado — y falla como "connection refused", que se diagnostica como otra cosa.
  decir "==> espero a que acepte conexiones"
  ssh "$HOST" "for i in \$(seq 1 30); do
      docker exec '${NOMBRE}' pg_isready -U postgres >/dev/null 2>&1 && exit 0
      sleep 1
    done
    echo 'ABORTA: ${NOMBRE} no acepto conexiones en 30s' >&2; exit 1"
fi

# --- 2. lo que fusion trae de fábrica y un Postgres pelado no ---------------------------------
# Sin esto, CADA policy RLS del provisionado falla: `auth.jwt()` es de Supabase, no de Postgres.
decir "==> bootstrap: rol ${APP_USER} (NOSUPERUSER), schema uc_factory, roles y auth.jwt()"
ssh "$HOST" "docker exec -i '${NOMBRE}' psql -U postgres -q -v ON_ERROR_STOP=1" <<SQL
DO \$do\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')          THEN CREATE ROLE anon          NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')  THEN CREATE ROLE service_role  NOLOGIN BYPASSRLS; END IF;
  -- El rol de la app. NOSUPERUSER NOBYPASSRLS no es un detalle: es LA condición para que el RLS
  -- llegue a aplicarse. Con cualquiera de las dos al revés, esta base miente en verde.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${APP_USER}') THEN
    CREATE ROLE ${APP_USER} LOGIN PASSWORD '${PASS}' NOSUPERUSER NOBYPASSRLS;
  END IF;
  -- El rol del ciclo de auto-reparación, que en producción es UNO para toda la app y por eso ve la
  -- DLQ cross-tenant. Replicarlo acá no es comodidad: sin él, el test del agrupado por bug tendría
  -- que correr con el superuser, y entonces probaría el superuser — no el rol que corre de verdad
  -- (ver \`memoria/el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar.md\`).
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${AUTOSAN_USER}') THEN
    CREATE ROLE ${AUTOSAN_USER} LOGIN PASSWORD '${PASS}' NOSUPERUSER BYPASSRLS;
  END IF;
END \$do\$;
-- Dueño de su schema, como en producción: \`provision.py\` corre con este rol y necesita CREAR las
-- tablas (ser dueño), no sólo escribir en ellas.
CREATE SCHEMA IF NOT EXISTS uc_factory AUTHORIZATION ${APP_USER};
ALTER SCHEMA uc_factory OWNER TO ${APP_USER};
GRANT ALL ON SCHEMA uc_factory TO ${APP_USER};
CREATE SCHEMA IF NOT EXISTS auth;
-- Stub: en fusion lo provee GoTrue leyendo el JWT del request. Acá alcanza con que exista y devuelva
-- un jsonb; la policy legacy del provisionado lo referencia y sin esto el provisionado muere.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  \$fn\$ SELECT coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb \$fn\$;
GRANT USAGE ON SCHEMA auth TO ${APP_USER};
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO ${APP_USER};
SQL

# CONTROL del instrumento, antes de usarlo. Una base de tests cuyo rol saltea RLS no es una base de
# tests peor: es una que da verde sobre aislamiento inexistente, que es peor que no tenerla.
if [ "$ADMIN" -eq 0 ]; then
  SQL_ATRIB="SELECT rolsuper::text || ' ' || rolbypassrls::text FROM pg_roles WHERE rolname='${APP_USER}'"
  ATRIBUTOS="$(ssh "$HOST" "docker exec '${NOMBRE}' psql -U postgres -tAc \"${SQL_ATRIB}\"")"
  if [ "$ATRIBUTOS" != "false false" ]; then
    echo "ABORTA: ${APP_USER} tiene (rolsuper rolbypassrls) = '${ATRIBUTOS}', se esperaba 'false false'." >&2
    echo "        Con cualquiera en true el RLS NO aplica y esta base daria verde sobre nada." >&2
    exit 1
  fi
  decir "==> control OK: ${APP_USER} no es superuser ni bypassrls (el RLS lo alcanza)"
fi

# --- 3. el esquema, con el MISMO provisionado que usa producción ------------------------------
decir "==> sync worktree -> ${HOST}:${STAGE}"
# Ver la nota de `sync-test-backend.sh`: sin excluir `__pycache__`, otra sesión corriendo pytest sobre
# el mismo checkout hace fallar este tar con "file changed as we read it".
tar -C "$LOCAL" --exclude='__pycache__' --exclude='*.pyc' --exclude='.pytest_cache' \
  -czf - apps/copiloto "$MOTOR" deploy/worker \
  | ssh "$HOST" "rm -rf '$STAGE' && mkdir -p '$STAGE' && tar -C '$STAGE' -xzf -"

# UNA sola pasada. Hasta el PR #28 hacían falta dos: `estado` y `estado_actualizado_en` las agregaba
# un `_ensure_*` sin estar declaradas en `uc_tables.json`, así que sobre una base virgen el
# `ALTER IF EXISTS` era no-op silencioso y el .sql posterior moría. Si algún día vuelve a hacer falta
# una segunda pasada, NO la agregues acá: es el síntoma de que alguien rompió otra vez el invariante,
# y hay un test que lo caza (`test_toda_columna_de_un_ensure_esta_declarada_en_el_manifiesto`).
# `UC_RLS_FORCE` decide si las tablas nacen con `FORCE ROW LEVEL SECURITY`. Acá el default es
# ENCENDIDO —al revés que producción, que está a mitad de migración— porque esta base existe para
# ejercitar el estado FINAL. Apagarlo reproduce el bug que el frente entero vino a arreglar.
FORCE_RLS="${UC_RLS_FORCE:-1}"
decir "==> provisiono el esquema (una pasada) — UC_RLS_FORCE=${FORCE_RLS}"
ssh "$HOST" "cd '$STAGE/apps/copiloto' && DATABASE_URL='${URL}' UC_RLS_FORCE='${FORCE_RLS}' \
  PYTHONPATH='$STAGE/apps/copiloto:$STAGE/$MOTOR' '$VENV/bin/python' provision.py >/dev/null"

# --- 4. control: que la base tenga de verdad lo que decimos que tiene -------------------------
# Sin esto, "provisionó OK" es una afirmación sobre un exit code. Contamos las tablas y comparamos
# contra el manifiesto: si el provisionado corrió a medias, el número no da y el script ABORTA.
#
# ⚠️ HONESTIDAD SOBRE ESTE CONTROL: su LÓGICA está verificada (con 3 vs 15 aborta con exit 1 y el
# mensaje de abajo), pero el ESCENARIO REAL —`provision.py` saliendo 0 y dejando menos tablas— no se
# pudo ejercitar sin romper el provisionado a propósito. O sea: sé que la comparación funciona, no
# tengo prueba de que el caso que temo se vea así. Queda dicho en vez de contado como verificado.
ESPERADAS="$(ssh "$HOST" "cd '$STAGE/apps/copiloto' && '$VENV/bin/python' -c \
  \"import json;print(len(json.load(open('uc_tables.json'))))\"")"
CREADAS="$(ssh "$HOST" "cd '$STAGE/apps/copiloto' && DATABASE_URL='${URL}' '$VENV/bin/python' -c \
  \"import os,psycopg2
c=psycopg2.connect(os.environ['DATABASE_URL']);cur=c.cursor()
cur.execute(\\\"select count(*) from pg_tables where schemaname='uc_factory'\\\")
print(cur.fetchone()[0])\"")"

if [ "$CREADAS" -lt "$ESPERADAS" ]; then
  echo "ABORTA: uc_factory tiene ${CREADAS} tablas y el manifiesto declara ${ESPERADAS}." >&2
  echo "        El provisionado corrió a medias — NO uses esta base como si estuviera lista." >&2
  exit 1
fi

# Los permisos del rol del ciclo van DESPUÉS del provisionado: la tabla la crea `provision.py` y no
# se puede otorgar sobre lo que todavía no existe. Es el mismo recorte que en producción —una sola
# tabla—, así que un test que intente tocar otra falla acá igual que allá.
ssh "$HOST" "docker exec -i '${NOMBRE}' psql -U postgres -q -v ON_ERROR_STOP=1" <<SQL
GRANT USAGE ON SCHEMA uc_factory TO ${AUTOSAN_USER};
GRANT SELECT, INSERT, UPDATE, DELETE ON uc_factory.copiloto_traumas TO ${AUTOSAN_USER};
GRANT USAGE, SELECT ON SEQUENCE uc_factory.copiloto_traumas_id_seq TO ${AUTOSAN_USER};
SQL

if [ "$EXPORTAR" -eq 1 ]; then
  echo "export UC_TEST_DATABASE_URL='${URL}'"
  echo "export UC_TEST_AUTOSANACION_URL='${URL_AUTOSAN}'"
else
  echo "==> LISTA: ${CREADAS} tablas en uc_factory (el manifiesto declara ${ESPERADAS})"
  if [ "$ADMIN" -eq 1 ]; then
    echo "    ⚠️  rol: postgres (SUPERUSER) — el RLS NO se aplica. Esta URL no sirve para verificar aislamiento."
  else
    echo "    rol: ${APP_USER} (NOSUPERUSER NOBYPASSRLS) · FORCE RLS=${FORCE_RLS} — replica producción"
  fi
  echo
  echo "    UC_TEST_DATABASE_URL='${URL}' bash deploy/copiloto/sync-test-backend.sh tests -q"
  echo
  echo "    Esta base NO es producción y se puede vaciar entera: bash $0 --recreate"
fi
