import os

import psycopg2
import pytest

from provision import provision

pytestmark = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def conn():
    c = psycopg2.connect(os.environ["DATABASE_URL"]); c.autocommit = True
    yield c; c.close()


def _exists(conn, sql, args=()):
    with conn.cursor() as cur:
        cur.execute(sql, args); return cur.fetchone()[0]


def test_provision_idempotent_creates_tenants_and_indexes(conn):
    provision(conn); provision(conn)   # 2x → idempotente, no explota
    assert _exists(conn, "select exists(select 1 from information_schema.tables where table_schema='uc_factory' and table_name='tenants')")
    assert _exists(conn, "select exists(select 1 from pg_indexes where schemaname='uc_factory' and indexname='tenants_cliente_id_key' or indexname='mp_credentials_tenant_seller')")
    # RLS habilitada en tenants
    assert _exists(conn, "select relrowsecurity from pg_class where relnamespace='uc_factory'::regnamespace and relname='tenants'")
