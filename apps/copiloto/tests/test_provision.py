import os

import psycopg2
import pytest

from provision import SCHEMA, _ensure_clientes_email_telefono, provision

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def conn():
    c = psycopg2.connect(os.environ["DATABASE_URL"]); c.autocommit = True
    yield c; c.close()


def _exists(conn, sql, args=()):
    with conn.cursor() as cur:
        cur.execute(sql, args); return cur.fetchone()[0]


@necesita_pg
def test_provision_idempotent_creates_tenants_and_indexes(conn):
    provision(conn); provision(conn)   # 2x → idempotente, no explota
    assert _exists(conn, "select exists(select 1 from information_schema.tables where table_schema='uc_factory' and table_name='tenants')")
    assert _exists(conn, "select exists(select 1 from pg_indexes where schemaname='uc_factory' and indexname='tenants_cliente_id_key' or indexname='mp_credentials_tenant_seller')")
    # RLS habilitada en tenants
    assert _exists(conn, "select relrowsecurity from pg_class where relnamespace='uc_factory'::regnamespace and relname='tenants'")


# ── el guard que hace posible el `DROP COLUMN contacto` (paso 1 de 2) ─────────────────────────────
#
# No se puede probar contra `uc_factory` borrando la columna: es la base viva. Así que se prueba en
# dos mitades, y **ninguna sola alcanza**:
#
#   · la de abajo, con un doble, decide qué SQL se emite según lo que diga el catálogo;
#   · la última, contra Postgres real, comprueba que la consulta al catálogo **encuentra** la columna
#     hoy. Sin ésa, una consulta mal escrita (schema o nombre equivocado) devolvería `None` siempre y
#     el deploy se saltearía la migración **en silencio, con la columna presente** — un guard que
#     confirma en vez de verificar.

class _CursorFalso:
    """Cursor mínimo: registra el SQL y contesta el catálogo según `hay_contacto`."""

    def __init__(self, hay_contacto: bool):
        self.hay_contacto = hay_contacto
        self.sql: list[str] = []
        self.rowcount = 0
        self._ultimo = None

    def execute(self, sql, args=()):
        self.sql.append(sql)
        s = " ".join(sql.split())
        if "information_schema.columns" in s:
            self._ultimo = (1,) if self.hay_contacto else None
        elif s.upper().startswith("SELECT COUNT"):
            self._ultimo = (0,)
        else:
            self._ultimo = None

    def fetchone(self):
        return self._ultimo


class _ConnFalsa:
    def __init__(self, hay_contacto: bool):
        self.cur = _CursorFalso(hay_contacto)

    def cursor(self):
        return self.cur


def test_sin_la_columna_no_se_emite_UN_SOLO_sql_que_nombre_contacto():
    """El `WHERE contacto <> ''` contra una columna borrada tira `UndefinedColumn`, y dentro de una
    transacción eso aborta **el deploy entero**, no sólo esta migración."""
    c = _ConnFalsa(hay_contacto=False)

    _ensure_clientes_email_telefono(c)

    culpables = [s for s in c.cur.sql if "contacto" in s and "information_schema" not in s]
    assert culpables == [], f"emitió SQL contra una columna que no existe: {culpables}"
    # y aun así agregó email/telefono: saltear la migración no es saltear las columnas nuevas
    assert sum("ADD COLUMN IF NOT EXISTS" in s for s in c.cur.sql) == 2


def test_CONTROL_con_la_columna_presente_la_migracion_SI_corre():
    """Sin este control, el test de arriba pasaría igual si la función no hiciera nada nunca."""
    c = _ConnFalsa(hay_contacto=True)

    _ensure_clientes_email_telefono(c)

    assert any("UPDATE" in s and "contacto" in s for s in c.cur.sql), \
        "con la columna presente tiene que migrar, y no migró"


@necesita_pg
def test_la_consulta_del_guard_ENCUENTRA_la_columna_hoy(conn):
    """El guard mira `information_schema` — si mirara mal, diría «no está» **siempre**."""
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM information_schema.columns "
                    "WHERE table_schema = %s AND table_name = 'copiloto_clientes' "
                    "AND column_name = 'contacto'", (SCHEMA,))
        halla_contacto = cur.fetchone() is not None
        # el control del control: la misma consulta contra una columna que SÍ o SÍ existe
        cur.execute("SELECT 1 FROM information_schema.columns "
                    "WHERE table_schema = %s AND table_name = 'copiloto_clientes' "
                    "AND column_name = 'nombre'", (SCHEMA,))
        halla_nombre = cur.fetchone() is not None

    assert halla_nombre, "la consulta del guard no encuentra NI `nombre`: está mirando el lugar equivocado"
    # Mientras el paso 2 no se ejecute, `contacto` sigue ahí. Cuando se ejecute, este assert cae —
    # y ese día se borra junto con la migración, que es exactamente cuándo debe caer.
    assert halla_contacto, "`contacto` ya no está: retirá también la migración y este assert"
