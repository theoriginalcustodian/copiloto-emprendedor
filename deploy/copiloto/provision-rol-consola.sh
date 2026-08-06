#!/usr/bin/env bash
# deploy/copiloto/provision-rol-consola.sh — el rol con el que la Consola de Operador lee cross-tenant.
#
# POR QUÉ EXISTE (CONS0a, 2026-08-06). La consola es cross-tenant por definición (specs
# docs/copiloto-emprendedor/2026-08-06-SPECS-consola-de-operador.md §7-8): necesita ver uso/costo LLM
# (A3), feedback (A4) y la DLQ agrupada (A5) de TODOS los tenants a la vez. El rol normal de la app
# está sujeto a RLS FORCE y ve 0 filas sin declarar un tenant — es el comportamiento correcto para el
# resto de la app, pero inservible acá. Hoy el único camino documentado es Supabase Studio como
# superusuario (`queries/metering_dashboard.sql`), que no es un camino programático ni auditable.
#
# POR QUÉ ESTE PATRÓN (reutilizado, no inventado). Es EXACTAMENTE `provision-rol-autosanacion.sh`
# — mismo mecanismo (`BYPASSRLS` + GRANT acotado), mismo control diferencial — aplicado a otro
# consumidor. `BYPASSRLS` saltea las policies; NO otorga permisos. Lo que el rol puede tocar lo deciden
# los GRANT de abajo — hoy, SELECT en 4 tablas, ninguna de escritura.
#
# CONS1 (2026-08-06) agregó `copiloto_auditoria` a la lista: la consola necesita leer el registro de
# auditoría cross-tenant (A6), igual que ya lee metering/feedback/traumas.
#
# POR QUÉ UN ROL PROPIO Y NO REUSAR `copiloto_autosanacion` (que ya lee `copiloto_traumas`). Separación
# de superficie: `copiloto_autosanacion` es un credential de WORKER, nunca pensado para quedar detrás
# de un endpoint HTTP. Mezclarlo ampliaría el radio de daño de un futuro bug en `/admin/*` al ciclo de
# autosanación entero. Cada consumidor, su propio rol — el costo es un script más, no una excepción.
#
# QUÉ NO HACE ESTE ROL. Sólo LEE. La acción "reintentar un trauma" (§6 de las specs) no escribe con
# este rol: dispara el mismo camino que ya usa el worker (Temporal signal / activity), que sí corre
# con `copiloto_autosanacion`. Si algún día la consola necesita escribir directo, es un GRANT nuevo y
# explícito acá, no un ensanche silencioso de éste.
#
# IDEMPOTENTE. Corrible N veces: si el rol ya existe no se rota la contraseña, los GRANT son
# declarativos, la línea del env se reemplaza.
#
# CONTROL DIFERENCIAL. Un rol que no llega a conectar, o que conecta pero sigue sujeto a RLS,
# devolvería "0 filas" en las 3 tablas — indistinguible de "no hay datos todavía". Por eso el final no
# pregunta "¿anduvo?" sino "¿ve algo de ≥2 tenants a la vez que la conexión normal, sin tenant, no ve?".
#
# Parametrizable (cero hardcoding):
#   UC_DEPLOY_HOST            alias SSH del VPS del copiloto     (default: unreal-copilot)
#   UC_FUSION_HOST            alias SSH de la DB, DESDE ese VPS  (default: fusion)
#   UC_ENV_DIR                dir de EnvironmentFile             (default: /etc/unreal-copilot)
#   UC_FUSION_DB_CONTAINER    contenedor de Postgres en fusion   (default: supabase-db)
#   UC_FUSION_DB_SUPERUSER    rol superusuario para el DDL       (default: supabase_admin)
#   UC_CONSOLA_ROLE           nombre del rol a crear             (default: copiloto_consola)
set -euo pipefail

HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
FUSION="${UC_FUSION_HOST:-fusion}"
ENVDIR="${UC_ENV_DIR:-/etc/unreal-copilot}"
CONTAINER="${UC_FUSION_DB_CONTAINER:-supabase-db}"
SUPERUSER="${UC_FUSION_DB_SUPERUSER:-supabase_admin}"
ROL="${UC_CONSOLA_ROLE:-copiloto_consola}"

echo "==> Provisionando el rol '$ROL' (BYPASSRLS, SELECT-only en 3 tablas) vía $HOST -> $FUSION"

ssh "$HOST" bash -s -- "$FUSION" "$ENVDIR" "$CONTAINER" "$SUPERUSER" "$ROL" <<'REMOTO'
set -euo pipefail
FUSION="$1"; ENVDIR="$2"; CONTAINER="$3"; SUPERUSER="$4"; ROL="$5"
ENVFILE="$ENVDIR/copiloto.env"
VAR="COPILOTO_CONSOLA_DSN"

set -a; . "$ENVDIR/fusion-pg.env"; set +a
: "${PGHOST:?falta PGHOST en fusion-pg.env}"; : "${PGPORT:?falta PGPORT}"; : "${PGDATABASE:?falta PGDATABASE}"
: "${PGUSER:?falta PGUSER}"; : "${PGSCHEMA:=uc_factory}"

SUFIJO=""
case "$PGUSER" in *.*) SUFIJO=".${PGUSER#*.}";; esac
USUARIO_POOLER="${ROL}${SUFIJO}"

DSN_ACTUAL="$(sudo grep -E "^${VAR}=" "$ENVFILE" 2>/dev/null | head -1 | cut -d= -f2- || true)"
if [ -n "$DSN_ACTUAL" ]; then
  CLAVE="$(printf '%s' "$DSN_ACTUAL" | sed -E 's#^postgresql://[^:]+:([^@]+)@.*#\1#')"
  echo "    contraseña: se REUSA la del DSN ya provisionado (no se rota)"
else
  CLAVE="$(openssl rand -hex 24)"
  echo "    contraseña: generada (primera vez)"
fi

psql_super() { ssh -o BatchMode=yes "$FUSION" "docker exec -i -u postgres '$CONTAINER' psql -U '$SUPERUSER' -d '$PGDATABASE' -v ON_ERROR_STOP=1 $*"; }

cat <<SQL | psql_super -q -f -
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROL}') THEN
    CREATE ROLE ${ROL} LOGIN;
  END IF;
END
\$\$;
ALTER ROLE ${ROL} LOGIN BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
      PASSWORD '${CLAVE}';

-- El radio de daño real: SELECT, en 4 tablas, ninguna de escritura. Si mañana la consola necesita
-- otra tabla de lectura, se agrega acá y se ve en el diff.
GRANT USAGE ON SCHEMA ${PGSCHEMA} TO ${ROL};
GRANT SELECT ON ${PGSCHEMA}.copiloto_metering  TO ${ROL};
GRANT SELECT ON ${PGSCHEMA}.copiloto_feedback  TO ${ROL};
GRANT SELECT ON ${PGSCHEMA}.copiloto_traumas   TO ${ROL};
GRANT SELECT ON ${PGSCHEMA}.copiloto_auditoria TO ${ROL};

REVOKE ALL ON SCHEMA public FROM ${ROL};
SQL
echo "    DDL aplicado"

DSN="postgresql://${USUARIO_POOLER}:${CLAVE}@${PGHOST}:${PGPORT}/${PGDATABASE}"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
sudo grep -vE "^${VAR}=" "$ENVFILE" > "$TMP" || true
printf '%s=%s\n' "$VAR" "$DSN" >> "$TMP"
sudo install -m 600 -o root -g root "$TMP" "$ENVFILE"
echo "    $VAR escrito en $ENVFILE (usuario ${USUARIO_POOLER}, contraseña NO impresa)"

# ── CONTROL DIFERENCIAL ───────────────────────────────────────────────────────────────────────────
SONDA="probe-consola-$(date -u +%s)-$$"
TENANT_A="$(cat /proc/sys/kernel/random/uuid)"
TENANT_B="$(cat /proc/sys/kernel/random/uuid)"
cat <<SQL | psql_super -q -f - >/dev/null
INSERT INTO ${PGSCHEMA}.copiloto_metering (cliente_id, session_id, evento, model, tokens, created_at)
VALUES ('${TENANT_A}', '${SONDA}', 'llm_turno', 'probe-model', 1, now()),
       ('${TENANT_B}', '${SONDA}', 'llm_turno', 'probe-model', 1, now());
SQL

limpiar_sonda() {
  printf "DELETE FROM %s.copiloto_metering WHERE session_id = '%s';\n" \
    "$PGSCHEMA" "$SONDA" | psql_super -q -f - >/dev/null 2>&1 || true
}
trap 'limpiar_sonda; rm -f "$TMP"' EXIT

/opt/uc-copiloto-venv/bin/python - "$DSN" "$TENANT_A" "$TENANT_B" "$SONDA" "$PGSCHEMA" <<'PY'
import os, sys, psycopg2

dsn_nuevo, tenant_a, tenant_b, sonda, schema = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
tabla = f"{schema}.copiloto_metering"
fallos = []

try:
    with psycopg2.connect(dsn_nuevo) as c1, c1.cursor() as cur:
        cur.execute("SELECT current_user, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user")
        usuario, bypass, es_super = cur.fetchone()
        cur.execute(f"SELECT count(DISTINCT cliente_id) FROM {tabla} WHERE session_id = %s", (sonda,))
        tenants_vistos = cur.fetchone()[0]
    print(f"    rol nuevo   : conecta OK como {usuario!r}, bypassrls={bypass}, superuser={es_super}, "
          f"ve {tenants_vistos}/2 tenants de la sonda")
    if not bypass:
        fallos.append("el rol nuevo NO tiene BYPASSRLS")
    if es_super:
        fallos.append("el rol nuevo es SUPERUSER -- radio de daño mucho mayor al necesario")
    if tenants_vistos != 2:
        fallos.append(f"el rol nuevo ve {tenants_vistos}/2 tenants de la sonda -- no es cross-tenant real")
except Exception as exc:
    fallos.append(f"el rol nuevo no pudo conectar/consultar: {type(exc).__name__}: {exc}")

# Control negativo: la conexión normal del worker, SIN tenant declarado, no debe ver la sonda.
try:
    with psycopg2.connect(os.environ["DATABASE_URL"]) as c2, c2.cursor() as cur:
        cur.execute(f"SELECT count(*) FROM {tabla} WHERE session_id = %s", (sonda,))
        ve_viejo = cur.fetchone()[0]
    print(f"    rol del app : ve la sonda = {ve_viejo} (tiene que ser 0)")
    if ve_viejo != 0:
        fallos.append(f"la conexión normal ve {ve_viejo} filas sin declarar tenant: RLS NO aplica, "
                      "así que el control de arriba es vacío")
except Exception as exc:
    fallos.append(f"no se pudo correr el control negativo: {type(exc).__name__}: {exc}")

# Control de escritura: el rol nuevo NO debe poder escribir (sólo SELECT).
try:
    with psycopg2.connect(dsn_nuevo) as c3, c3.cursor() as cur:
        cur.execute(
            f"INSERT INTO {tabla} (cliente_id, session_id, evento, model, tokens) VALUES (%s, %s, 'x', 'x', 1)",
            (tenant_a, sonda),
        )
    fallos.append("el rol nuevo pudo ESCRIBIR en copiloto_metering -- el GRANT es más amplio de lo declarado")
except psycopg2.errors.InsufficientPrivilege:
    print("    rol nuevo   : intenta INSERT en copiloto_metering -> RECHAZADO (sólo SELECT, como se declaró)")
except Exception as exc:
    print(f"    rol nuevo   : intenta INSERT -> RECHAZADO ({type(exc).__name__})")

if fallos:
    print("\n❌ CONTROL DIFERENCIAL ROJO:")
    for f in fallos:
        print(f"   - {f}")
    sys.exit(1)
print("\n✅ CONTROL DIFERENCIAL VERDE: el rol ve ≥2 tenants a la vez, sólo lee, la conexión normal no ve nada.")
PY

echo
echo "==> Permisos efectivos del rol (medido, no afirmado):"
printf "SELECT table_schema||'.'||table_name AS tabla, string_agg(privilege_type, ',' ORDER BY privilege_type) AS permisos FROM information_schema.role_table_grants WHERE grantee = '%s' GROUP BY 1 ORDER BY 1;\n" "$ROL" | psql_super -f -
REMOTO

echo
echo "==> Listo. El front-door toma el DSN en el próximo restart (EnvironmentFile se lee al arrancar)."
