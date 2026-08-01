#!/usr/bin/env bash
# deploy/copiloto/provision-rol-autosanacion.sh — el rol con el que corre el ciclo de auto-reparación.
#
# POR QUÉ EXISTE (decisión del operador, 2026-08-01). El ciclo de autosanación es **uno solo para
# toda la app**, no uno por emprendedor: repara bugs de NUESTRO código, y un bug no es de un tenant.
# La topología anterior —un Schedule por tenant— hacía que el día que haya 5000 emprendedores
# hubiera 5000 procesos a las 04:00 resolviendo, N veces, el mismo defecto.
#
# Un ciclo único necesita ver la DLQ entera, y la DLQ tiene RLS forzado. De ahí este rol.
#
# POR QUÉ `BYPASSRLS` Y NO SUPERUSUARIO. Misma capacidad para esta función, radio de daño mucho más
# chico: `BYPASSRLS` saltea las policies, pero **no otorga un solo permiso**. Lo que el rol puede
# tocar está acotado por los GRANT de abajo — hoy, exactamente UNA tabla (`copiloto_traumas`). Un
# superusuario, en cambio, puede leer y escribir todo, apagar RLS en cualquier tabla y crear roles.
# La pregunta "¿esto no perjudica la seguridad?" tiene respuesta medible: el rol no tiene acceso a
# ninguna tabla de negocio, y el `\dp` del final lo demuestra en vez de afirmarlo.
#
# IDEMPOTENTE. Corrible N veces: si el rol ya existe **no se rota la contraseña** (se reusa la del
# DSN ya guardado), los GRANT son declarativos y la línea del env se reemplaza, no se duplica.
#
# CONTROL DIFERENCIAL (el gate, no un adorno). Un rol que no llega a conectar por el pooler, o que
# conecta pero sigue sujeto a RLS, devolvería **0 traumas** — o sea "no hay nada que reparar", que es
# indistinguible de funcionar bien. Es exactamente el fallo de
# `memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`. Por eso el final no pregunta "¿anduvo?"
# sino "¿ve algo que la conexión normal NO ve?": inserta una fila sonda de un tenant ajeno, exige
# que el rol nuevo la vea SIN declarar tenant y que `uc_factory` NO la vea, y recién ahí da verde.
#
# Parametrizable (cero hardcoding):
#   UC_DEPLOY_HOST            alias SSH del VPS del copiloto     (default: unreal-copilot)
#   UC_FUSION_HOST            alias SSH de la DB, DESDE ese VPS  (default: fusion)
#   UC_ENV_DIR                dir de EnvironmentFile             (default: /etc/unreal-copilot)
#   UC_FUSION_DB_CONTAINER    contenedor de Postgres en fusion   (default: supabase-db)
#   UC_FUSION_DB_SUPERUSER    rol superusuario para el DDL       (default: supabase_admin)
#   UC_AUTOSANACION_ROLE      nombre del rol a crear             (default: copiloto_autosanacion)
set -euo pipefail

HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
FUSION="${UC_FUSION_HOST:-fusion}"
ENVDIR="${UC_ENV_DIR:-/etc/unreal-copilot}"
CONTAINER="${UC_FUSION_DB_CONTAINER:-supabase-db}"
SUPERUSER="${UC_FUSION_DB_SUPERUSER:-supabase_admin}"
ROL="${UC_AUTOSANACION_ROLE:-copiloto_autosanacion}"

echo "==> Provisionando el rol '$ROL' (BYPASSRLS, acotado a la DLQ) vía $HOST -> $FUSION"

# TODO server-side. La contraseña se genera en el VPS, viaja a fusion por STDIN (nunca por argv, así
# no aparece en el `ps` de nadie) y queda en el env del VPS. En ningún momento baja a la PC.
ssh "$HOST" bash -s -- "$FUSION" "$ENVDIR" "$CONTAINER" "$SUPERUSER" "$ROL" <<'REMOTO'
set -euo pipefail
FUSION="$1"; ENVDIR="$2"; CONTAINER="$3"; SUPERUSER="$4"; ROL="$5"
ENVFILE="$ENVDIR/copiloto.env"
VAR="COPILOTO_AUTOSANACION_DSN"

# ── De dónde salen host/puerto/base: del env que ya usa el worker, no de constantes ───────────────
set -a; . "$ENVDIR/fusion-pg.env"; set +a
: "${PGHOST:?falta PGHOST en fusion-pg.env}"; : "${PGPORT:?falta PGPORT}"; : "${PGDATABASE:?falta PGDATABASE}"
: "${PGUSER:?falta PGUSER}"; : "${PGSCHEMA:=uc_factory}"

# El pooler (Supavisor) identifica al tenant por el sufijo del usuario: `<rol>.<tenant_id>`. Se
# deriva del usuario que ya funciona en vez de escribirlo a mano — si el tenant cambia, esto lo
# sigue solo. Si el usuario NO tiene sufijo, la conexión es directa y el rol va pelado.
SUFIJO=""
case "$PGUSER" in *.*) SUFIJO=".${PGUSER#*.}";; esac
USUARIO_POOLER="${ROL}${SUFIJO}"

# ── Contraseña: se reusa si ya hay DSN; sólo se genera la primera vez ─────────────────────────────
# Rotar en cada corrida rompería la idempotencia de la peor forma: el worker vivo se quedaría con la
# vieja hasta el próximo restart y el ciclo fallaría de noche, sin nadie mirando.
DSN_ACTUAL="$(sudo grep -E "^${VAR}=" "$ENVFILE" 2>/dev/null | head -1 | cut -d= -f2- || true)"
if [ -n "$DSN_ACTUAL" ]; then
  CLAVE="$(printf '%s' "$DSN_ACTUAL" | sed -E 's#^postgresql://[^:]+:([^@]+)@.*#\1#')"
  echo "    contraseña: se REUSA la del DSN ya provisionado (no se rota)"
else
  CLAVE="$(openssl rand -hex 24)"   # hex: sin caracteres que haya que escapar en una URL
  echo "    contraseña: generada (primera vez)"
fi

psql_super() { ssh -o BatchMode=yes "$FUSION" "docker exec -i -u postgres '$CONTAINER' psql -U '$SUPERUSER' -d '$PGDATABASE' -v ON_ERROR_STOP=1 $*"; }

# ── DDL idempotente ───────────────────────────────────────────────────────────────────────────────
# `CREATE ROLE` no admite `IF NOT EXISTS`: por eso el `DO` con el catálogo, igual que
# `bootstrap-supabase-compat.sql`. El `ALTER` de afuera corre en los dos casos y deja el estado
# declarado (atributos + contraseña), no el que quedó de una corrida a medias.
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

-- El radio de daño real. \`BYPASSRLS\` saltea las policies de las tablas a las que el rol LLEGA;
-- llegar a una tabla es cuestión de GRANT, y acá hay exactamente uno. Si mañana el ciclo necesita
-- otra tabla, se agrega acá y se ve en el diff — que es justo el punto.
GRANT USAGE ON SCHEMA ${PGSCHEMA} TO ${ROL};
GRANT SELECT, INSERT, UPDATE, DELETE ON ${PGSCHEMA}.copiloto_traumas TO ${ROL};
GRANT USAGE, SELECT ON SEQUENCE ${PGSCHEMA}.copiloto_traumas_id_seq TO ${ROL};

-- Explícito y no por omisión: el rol NO hereda nada de los roles de Supabase ni del dueño.
REVOKE ALL ON SCHEMA public FROM ${ROL};
SQL
echo "    DDL aplicado"

# ── El DSN queda en el env del worker ─────────────────────────────────────────────────────────────
DSN="postgresql://${USUARIO_POOLER}:${CLAVE}@${PGHOST}:${PGPORT}/${PGDATABASE}"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
sudo grep -vE "^${VAR}=" "$ENVFILE" > "$TMP" || true
printf '%s=%s\n' "$VAR" "$DSN" >> "$TMP"
sudo install -m 600 -o root -g root "$TMP" "$ENVFILE"
echo "    $VAR escrito en $ENVFILE (usuario ${USUARIO_POOLER}, contraseña NO impresa)"

# ── CONTROL DIFERENCIAL ───────────────────────────────────────────────────────────────────────────
# Sin esto, "0 traumas" sería el resultado tanto si el rol anda como si no llega ni a conectar.
SONDA="probe-provision-$(date -u +%s)-$$"
TENANT_SONDA="$(cat /proc/sys/kernel/random/uuid)"
cat <<SQL | psql_super -q -f - >/dev/null
INSERT INTO ${PGSCHEMA}.copiloto_traumas (cliente_id, fingerprint, workflow, error_type, estado)
VALUES ('${TENANT_SONDA}', '${SONDA}', 'ProvisionRol', 'Sonda', 'pendiente');
SQL

limpiar_sonda() {
  printf "DELETE FROM %s.copiloto_traumas WHERE fingerprint = '%s';\n" "$PGSCHEMA" "$SONDA" \
    | psql_super -q -f - >/dev/null 2>&1 || true
}
trap 'limpiar_sonda; rm -f "$TMP"' EXIT

/opt/uc-copiloto-venv/bin/python - "$DSN" "$SONDA" "$PGSCHEMA" <<'PY'
import os, sys, psycopg2

dsn_nuevo, sonda, schema = sys.argv[1], sys.argv[2], sys.argv[3]
tabla = f"{schema}.copiloto_traumas"
fallos = []

# (1) El rol nuevo, SIN declarar tenant, tiene que ver la fila sonda.
try:
    with psycopg2.connect(dsn_nuevo) as c1, c1.cursor() as cur:
        cur.execute("SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user")
        usuario, bypass = cur.fetchone()
        cur.execute(f"SELECT count(*) FROM {tabla} WHERE fingerprint = %s", (sonda,))
        ve_nuevo = cur.fetchone()[0]
    print(f"    rol nuevo   : conecta OK como {usuario!r}, bypassrls={bypass}, ve la sonda = {ve_nuevo}")
    if not bypass:
        fallos.append("el rol nuevo NO tiene BYPASSRLS")
    if ve_nuevo != 1:
        fallos.append(f"el rol nuevo ve {ve_nuevo} filas de la sonda, esperaba 1 "
                      "(o no saltea RLS, o el pooler lo mandó a otra base)")
except Exception as exc:
    fallos.append(f"el rol nuevo no pudo conectar/consultar: {type(exc).__name__}: {exc}")

# (2) El control NEGATIVO, que es lo que hace que (1) signifique algo: la conexión normal del worker,
#     sin tenant declarado, NO debe ver la sonda. Si la viera, RLS no está aplicando y el verde de
#     arriba no probaría nada del rol nuevo.
try:
    with psycopg2.connect(os.environ["DATABASE_URL"]) as c2, c2.cursor() as cur:
        cur.execute(f"SELECT count(*) FROM {tabla} WHERE fingerprint = %s", (sonda,))
        ve_viejo = cur.fetchone()[0]
    print(f"    rol del app : ve la sonda = {ve_viejo} (tiene que ser 0)")
    if ve_viejo != 0:
        fallos.append(f"la conexión normal ve {ve_viejo} filas sin declarar tenant: RLS NO aplica, "
                      "así que el control de arriba es vacío")
except Exception as exc:
    fallos.append(f"no se pudo correr el control negativo: {type(exc).__name__}: {exc}")

if fallos:
    print("\n❌ CONTROL DIFERENCIAL ROJO:")
    for f in fallos:
        print(f"   - {f}")
    sys.exit(1)
print("\n✅ CONTROL DIFERENCIAL VERDE: el rol ve la DLQ entera, la conexión normal no.")
PY

echo
echo "==> Permisos efectivos del rol (lo que puede tocar, medido — no afirmado):"
printf "SELECT table_schema||'.'||table_name AS tabla, string_agg(privilege_type, ',' ORDER BY privilege_type) AS permisos FROM information_schema.role_table_grants WHERE grantee = '%s' GROUP BY 1 ORDER BY 1;\n" "$ROL" | psql_super -f -
REMOTO

echo
echo "==> Listo. El worker toma el DSN en el próximo restart (EnvironmentFile se lee al arrancar)."
