"""apps/copiloto/provision.py — provisioning idempotente ÚNICO del Copiloto del Emprendedor (Task 1).

Pliega en UN script (paga la deuda M2 documentada en mp_indexes.sql — "provisioná y aparte aplicá el SQL"):

  1. Las tablas "estándar" declaradas en uc_tables.json (mp_credentials, mp_payments,
     copiloto_web_replies, copiloto_metering) vía el mecanismo genérico ya validado de la fábrica
     (deploy/worker/provision_tables.py): id bigserial PK + cliente_id uuid NOT NULL + columnas
     declaradas + RLS `tenant_isolation` + grants. Reuso puro (regla de oro #2), cero duplicación.

  2. `uc_factory.tenants` — registry `auth_user_id -> cliente_id` (spec §4). DDL BESPOKE, a propósito
     fuera del mecanismo genérico: su PK es `auth_user_id` (no `id bigserial`) y `cliente_id` es
     UNIQUE + DEFAULT gen_random_uuid() (no un simple filtro de partición NOT NULL). El mecanismo
     genérico no soporta esa forma, así que `tenants` se EXCLUYE explícitamente del pase estándar
     (`_STANDARD_ONLY`) aunque también aparece documentado en uc_tables.json (mismo formato de columnas,
     visibilidad del modelo de datos) — ver nota de concern en el reporte de la Task 1.

  3. Los índices únicos de `mp_indexes.sql` (M2): sin ellos, `MpCredentialStore`/`MpPaymentStore`
     fallan en runtime con "no unique or exclusion constraint matching ON CONFLICT". Se pliegan acá
     para que UN solo comando deje todo listo.

Idempotente: corrible N veces sin side effects (CREATE TABLE/INDEX IF NOT EXISTS, ENABLE RLS repetible,
policy con DROP+CREATE, GRANT repetible). Uso (VPS, venv con psycopg2, env fusion-pg.env cargado):

  set -a; . /etc/unreal-copilot/fusion-pg.env; set +a
  /opt/uc-copiloto-venv/bin/python provision.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
WORKER_DIR = APP_DIR.parents[1] / "deploy" / "worker"
sys.path.insert(0, str(WORKER_DIR))
from provision_tables import provision as _provision_standard  # noqa: E402  (mecanismo genérico, reuso)

SCHEMA = "uc_factory"
TENANTS_TABLE = "tenants"
UC_TABLES_JSON = APP_DIR / "uc_tables.json"
MP_INDEXES_SQL = APP_DIR / "mp_indexes.sql"


def _provision_tenants(conn) -> None:
    """DDL bespoke de uc_factory.tenants (spec §4 / Task 1). Fuera del mecanismo genérico a propósito:
    PK = auth_user_id (no id bigserial) y cliente_id UNIQUE + DEFAULT gen_random_uuid() (no un simple
    filtro de partición). Idempotente: CREATE TABLE/ENABLE RLS repetibles, policy con DROP+CREATE."""
    cur = conn.cursor()
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.{TENANTS_TABLE} (
            auth_user_id uuid PRIMARY KEY,
            cliente_id uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
            email text,
            composio_user_id text NOT NULL,
            status text NOT NULL DEFAULT 'active',
            created_at timestamptz DEFAULT now()
        );
    """)
    cur.execute(f"ALTER TABLE {SCHEMA}.{TENANTS_TABLE} ENABLE ROW LEVEL SECURITY;")
    cur.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {SCHEMA}.{TENANTS_TABLE};")
    cur.execute(
        f"CREATE POLICY tenant_isolation ON {SCHEMA}.{TENANTS_TABLE} "
        f"FOR ALL USING (cliente_id = ((auth.jwt() ->> 'cliente_id')::uuid));"
    )
    for grantee in ("anon", "authenticated", "service_role"):
        cur.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {SCHEMA}.{TENANTS_TABLE} TO {grantee};")
    print(f"OK {SCHEMA}.{TENANTS_TABLE} (auth_user_id PK, cliente_id UNIQUE, RLS+policy+grants)", flush=True)


def _apply_mp_indexes(conn) -> None:
    """Pliega mp_indexes.sql (paga M2): índices únicos que el ON CONFLICT de los stores MP exige.
    Ambas sentencias usan IF NOT EXISTS → idempotente. Un solo execute (sin params) corre las 2 DDL."""
    sql = MP_INDEXES_SQL.read_text(encoding="utf-8")
    cur = conn.cursor()
    cur.execute(sql)
    print(f"OK índices MP aplicados desde {MP_INDEXES_SQL.name}", flush=True)


def provision(conn) -> dict:
    """Provisiona TODO lo que el Copiloto necesita en uc_factory (idempotente, corrible N veces).
    `conn` con autocommit=True (cada DDL es su propia transacción, igual que provision_tables.py)."""
    manifest = json.load(open(UC_TABLES_JSON, encoding="utf-8"))
    standard_spec = {k: v for k, v in manifest.items() if k != TENANTS_TABLE}
    standard_done = _provision_standard(standard_spec, conn)
    _provision_tenants(conn)
    _apply_mp_indexes(conn)
    return {"standard_tables": standard_done, "tenants": TENANTS_TABLE, "mp_indexes_applied": True}


def main() -> None:
    import psycopg2
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    result = provision(conn)
    print(f"provision OK: {result}", flush=True)


if __name__ == "__main__":
    main()
