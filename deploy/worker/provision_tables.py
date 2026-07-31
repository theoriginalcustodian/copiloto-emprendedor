#!/usr/bin/env python3
"""R2 — Provisiona (idempotente) las tablas de una app en uc_factory con la convención RLS de fusion.

Absorbe el `ensure_tables.py` del scratchpad al mecanismo de la fábrica (catálogo de errores §C6). Lo invoca
la activity `provision_tables` del SeniorWorkflow ANTES de `validate_real`, leyendo el manifiesto
`<repo>/uc_tables.json` (lo emite el generador del plano; si no existe, la app no tiene tablas → no-op).

Cada tabla recibe: `id bigserial PRIMARY KEY` + `cliente_id uuid NOT NULL` + las columnas dadas; luego
ENABLE ROW LEVEL SECURITY + policy `tenant_isolation` (cliente_id = auth.jwt()->>'cliente_id', idéntica a las
tablas existentes de fusion) + grants a anon/authenticated/service_role. Idempotente (IF NOT EXISTS + DROP/CREATE
policy + GRANT repetible).

SEGURIDAD (anti-injection): el manifiesto viene de output generado (semi-confiable) y el worker tiene la cred de
admin de uc_factory → los nombres de tabla/columna se validan contra una allowlist (`^[a-z_][a-z0-9_]*$`), los
tipos SQL contra una allowlist de tipos base, y los modificadores contra un set cerrado. Nada cruza sin validar.

Uso (VPS, val-venv con psycopg2, env fusion-pg.env cargado):
  set -a; . /etc/unreal-copilot/fusion-pg.env; set +a
  /opt/uc-val-venv/bin/python provision_tables.py <uc_tables.json>
  # uc_tables.json = {"resources": ["name text NOT NULL", "capacity integer"], "bookings": [...]}
"""
import json
import os
import re
import sys

SCHEMA = "uc_factory"
GRANTEES = ["anon", "authenticated", "service_role"]

#: Función que resuelve el tenant de la conexión, usada por TODAS las policies.
#: Lee `request.jwt.claims`, la GUC que setea PostgREST **y** que la app declara al abrir cada
#: conexión directa (`apps/copiloto/contexto_tenant.py`). Un solo modelo de policy sirve para los dos
#: caminos de acceso: bifurcar la seguridad por camino es cómo se cuela un agujero en el que nadie mira.
#: Sin claims devuelve NULL → ninguna fila matchea → **fail-closed**, que es el comportamiento correcto
#: ante un olvido.
def _force_rls() -> bool:
    """¿Aplicar `FORCE ROW LEVEL SECURITY`? Ver el comentario en `provision()`.

    Se lee en cada llamada (no como constante de módulo) para que un test pueda ejercitar las dos
    ramas sin reimportar: una rama que ningún test puede recorrer es una rama sin verificar.
    """
    return os.environ.get("UC_RLS_FORCE", "").strip().lower() in ("1", "true", "yes")


TENANT_FN = f"{SCHEMA}.current_cliente_id"
_TENANT_SQL = f"{TENANT_FN}()"
_TENANT_FN_DDL = f"""
CREATE OR REPLACE FUNCTION {TENANT_FN}() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'cliente_id', '')::uuid
$fn$;
"""
# IMPORTANTE: validar con re.fullmatch (NO .match): en Python `$` matchea ANTES de un `\n` final, así que un
# `match` con `$` deja pasar identificadores con newline embebido (review adversarial — finding LOW). fullmatch
# + regex sin anclas cierra ese hueco.
_IDENT_RE = re.compile(r"[a-z_][a-z0-9_]*")
# tipos SQL base permitidos (sin el modificador de precisión, que se valida aparte)
_TYPES = {"text", "varchar", "char", "integer", "int", "bigint", "smallint", "boolean", "bool",
          "numeric", "decimal", "real", "double", "timestamptz", "timestamp", "date", "time",
          "uuid", "jsonb", "json"}
# El valor de un DEFAULT es la ÚNICA parte libre del manifiesto -> allowlist ESTRICTA y cerrada (review adversarial
# CRITICAL: un regex laxo permitía `DEFAULT 'x')--` (paren-breakout + comment-out del CREATE TABLE) y
# `DEFAULT pg_sleep(0)`/`current_setting(...)`/`(SELECT ...)` (stored-expression injection ejecutándose con
# privilegio ADMIN en cada INSERT)). Solo: entero, literal-string SIN comilla/newline embebido, o keyword segura.
_DEFAULT_VAL = r"(\d+|'[^'\n]*'|true|false|null|now\(\))"
_MODIFIER_RE = re.compile(rf"(NOT\s+NULL|NULL)?\s*(DEFAULT\s+{_DEFAULT_VAL})?", re.IGNORECASE)
# columnas sin tipo explícito → heurística de inferencia (compat con el formato del generador)
_NUM = {"qty", "stock_qty", "reorder_threshold", "capacity", "current_step", "step_order",
        "interval_days", "reminder_lead_seconds", "delay_seconds", "quantity", "amount", "price"}


def _ident(name: str) -> str:
    """Valida un identificador (tabla/columna) contra la allowlist antes de interpolarlo en SQL.
    fullmatch (no .match): cierra el hueco del `\\n` final que `$` deja pasar."""
    if not _IDENT_RE.fullmatch(name):
        raise ValueError(f"identificador inválido (anti-injection): {name!r}")
    return name


def _infer_type(name: str) -> str:
    n = name.lower()
    if n.endswith("_id"):
        return "bigint"
    if n == "deleted" or n.startswith("is_"):
        return "boolean NOT NULL DEFAULT false"
    if (n in _NUM or n.endswith(("_seconds", "_days", "_qty", "_count", "_step", "_at", "_start", "_end"))
            or n in {"scheduled_at", "current_period_end", "occurred_at"}):
        return "bigint"
    return "text"


def _coldef(col: str) -> str:
    """Acepta 'name text NOT NULL' (tipado) o solo 'name' (infiere). Valida nombre, tipo y modificadores."""
    parts = col.strip().split()
    if not parts:
        raise ValueError("columna vacía en el manifiesto")
    name = _ident(parts[0])
    if len(parts) == 1:                                  # sin tipo → inferir (el inferido es de fuente confiable)
        return f'"{name}" {_infer_type(name)}'
    sqltype = parts[1].lower()
    base = sqltype.split("(")[0]                         # numeric(10,2) -> numeric
    if base not in _TYPES:
        raise ValueError(f"tipo SQL no permitido: {sqltype!r} (col {name})")
    # el modificador de precisión, si lo hay, debe ser solo dígitos/coma: numeric(10,2)
    if "(" in sqltype and not re.fullmatch(r"[a-z]+\(\d+(,\d+)?\)", sqltype):
        raise ValueError(f"tipo SQL malformado: {sqltype!r} (col {name})")
    rest = " ".join(parts[2:])
    if rest and not _MODIFIER_RE.fullmatch(rest):
        raise ValueError(f"modificador de columna no permitido: {rest!r} (col {name})")
    return f'"{name}" {sqltype}' + (f" {rest}" if rest else "")


def provision(spec: dict, conn) -> list:
    """Aplica el manifiesto contra la conexión dada (idempotente). Devuelve la lista de tablas provisionadas.
    `conn` con autocommit (cada DDL es su propia transacción). Separado de main() para testearlo."""
    done = []
    cur = conn.cursor()
    # La función del tenant, ANTES de cualquier policy que la referencie. `CREATE OR REPLACE` la hace
    # idempotente y permite corregirla en una corrida posterior sin tocar las 77 policies.
    cur.execute(_TENANT_FN_DDL)
    for g in GRANTEES:
        cur.execute(f"GRANT EXECUTE ON FUNCTION {_TENANT_SQL} TO {g};")
    for table, cols in spec.items():
        t = _ident(table)
        coldefs = ",\n  ".join(['id bigserial PRIMARY KEY', 'cliente_id uuid NOT NULL']
                               + [_coldef(c) for c in cols])
        cur.execute(f'CREATE TABLE IF NOT EXISTS {SCHEMA}."{t}" (\n  {coldefs}\n);')
        # GUARD anti-colisión (raíz 2026-06-25): el schema uc_factory es COMPARTIDO entre todas las apps. Si una
        # tabla con nombre genérico (subscriptions/plans/orders…) YA existe porque OTRA app la creó con otro
        # esquema, `CREATE TABLE IF NOT EXISTS` la deja intacta -> las columnas declaradas faltan -> el fallo
        # recién aparece como PGRST204/205 dentro de validate_real (tarde y silencioso). Fail-loud acá: si una
        # columna de negocio declarada NO está en la tabla viva => COLISIÓN de nombres -> abortar con causa clara.
        declared = {_ident(c.split()[0]) for c in cols}
        cur.execute("SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema=%s AND table_name=%s", (SCHEMA, t))
        missing = sorted(declared - {r[0] for r in cur.fetchall()})
        if missing:
            raise ValueError(
                f"colisión de tabla: {SCHEMA}.{t} ya existe SIN las columnas {missing} (otra app la creó con "
                f"ese nombre en el schema compartido). Namespacá las tablas por app/sistema con un prefijo "
                f"(p.ej. '<app>_{t}'). Ver domain-cards/postgres.md §8.")
        cur.execute(f'ALTER TABLE {SCHEMA}."{t}" ENABLE ROW LEVEL SECURITY;')
        # ⚠️ FORCE no es opcional y su ausencia NO da síntoma. Medido el 2026-07-31: la app se conecta
        # con el rol DUEÑO de estas tablas, y Postgres exime al dueño de sus propias policies salvo
        # FORCE. Sin esta línea el RLS existe en el catálogo y no filtra NADA: una consulta sin JWT
        # devolvió filas de 3 tenants distintos. 72 de 77 tablas vivieron así.
        #
        # Detrás de flag SÓLO por el orden de despliegue, no por duda: activar FORCE **antes** de que
        # el código que declara el tenant esté corriendo dejaría a la app viendo 0 filas en todo, sin
        # un error que lo explique. Paso 1: desplegar el código (este flag apagado). Paso 2: verificar
        # por efecto que la GUC llega, y recién ahí encenderlo. El flag tiene fecha de retiro: cuando
        # las 77 tablas estén migradas, `FORCE` pasa a incondicional y esta rama se borra.
        # TODO(rls-force, backend, 2026-07-31): retirar el flag una vez migradas las 77 tablas.
        if _force_rls():
            cur.execute(f'ALTER TABLE {SCHEMA}."{t}" FORCE ROW LEVEL SECURITY;')
        cur.execute(f'DROP POLICY IF EXISTS tenant_isolation ON {SCHEMA}."{t}";')
        # `WITH CHECK` además de `USING`: sin él, un tenant filtra bien la LECTURA pero puede ESCRIBIR
        # filas con el cliente_id de otro. 65 de 70 policies estaban así.
        # `_TENANT_SQL` en vez de `auth.jwt()`: la app se conecta directo (psycopg2), donde `auth.jwt()`
        # es null — es el mismo patrón que las 5 tablas de `documed` ya usan en esta base.
        cur.execute(f'CREATE POLICY tenant_isolation ON {SCHEMA}."{t}" '
                    f"FOR ALL USING (cliente_id = {_TENANT_SQL}) "
                    f"WITH CHECK (cliente_id = {_TENANT_SQL});")
        for g in GRANTEES:
            cur.execute(f'GRANT SELECT, INSERT, UPDATE, DELETE ON {SCHEMA}."{t}" TO {g};')
            cur.execute(f'GRANT USAGE, SELECT ON SEQUENCE {SCHEMA}."{t}_id_seq" TO {g};')
        done.append(t)
        print(f"OK {SCHEMA}.{t} (+id +cliente_id +{len(cols)} cols, RLS+policy+grants)", flush=True)
    return done


def main() -> None:
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    if not isinstance(spec, dict):
        raise ValueError("uc_tables.json debe ser un objeto {tabla: [columnas]}")
    import psycopg2
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    provision(spec, conn)


if __name__ == "__main__":
    main()
