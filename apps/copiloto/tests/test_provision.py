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


# ---------------------------------------------------------------------------
# El invariante de los `_ensure_*`, que hasta hoy vivía sólo en los docstrings
# ---------------------------------------------------------------------------

def test_toda_columna_de_un_ensure_esta_declarada_en_el_manifiesto():
    """Cada `_ensure_*` supone que su columna TAMBIEN esta en `uc_tables.json`. Sin eso, base virgen rota.

    El docstring de `_ensure_reply_card_column` lo dice textual: *«sobre una DB fresca `IF EXISTS` la
    vuelve no-op y el CREATE TABLE ya la incluye (declarada en uc_tables.json)»*. Las dos mitades son
    necesarias: el `ALTER` migra la base que YA existe, y el manifiesto construye la que NO existe.

    🔴 **Nada verificaba la segunda mitad, y se rompio.** `_ensure_presupuesto_estado` agrego `estado`
    y `estado_actualizado_en` sin declararlas. Sobre una base virgen: la tabla todavia no existe -> el
    `ALTER IF EXISTS` es no-op **y no protesta** -> el pase estandar crea la tabla sin la columna ->
    `inteligencia_migrations.sql` la referencia y muere. Medido: pasada 1 FALLA, pasada 2 OK.

    Nadie lo vio en 2 meses porque **en produccion la tabla siempre existia**. El unico escenario que
    lo expone es el que nunca se corrio: levantar la base desde cero (DR, staging, region nueva).

    Este test lo hace imposible por construccion: agregar un `_ensure_*` sin declarar su columna
    en el manifiesto **no compila el gate**.
    """
    import json
    import re
    from pathlib import Path

    aqui = Path(__file__).resolve().parent.parent
    manifiesto = json.loads((aqui / "uc_tables.json").read_text(encoding="utf-8"))
    fuente = (aqui / "provision.py").read_text(encoding="utf-8")

    patron = re.compile(r"ALTER TABLE IF EXISTS \{SCHEMA\}\.(\w+)[^;]*?"
                        r"ADD COLUMN IF NOT EXISTS (\w+)", re.S)
    agregadas = sorted(set(patron.findall(fuente)))

    # Control del propio instrumento: si el regex deja de matchear (alguien cambia la forma del
    # ALTER), la lista queda vacia y el test pasaria sin verificar NADA. Un cero aca no es
    # "ningun ensure": es el barrido roto.
    assert len(agregadas) >= 8, (
        f"el barrido encontro solo {len(agregadas)} columnas de `_ensure_*` — el regex esta roto, "
        f"no es que no haya. Revisar el patron contra la forma actual del ALTER en provision.py")

    sin_declarar = [f"{tabla}.{col}" for tabla, col in agregadas
                    if not any(c.split()[0] == col for c in manifiesto.get(tabla, []))]

    assert not sin_declarar, (
        f"estas columnas las agrega un `_ensure_*` pero NO estan en uc_tables.json: {sin_declarar}. "
        f"Sobre una base virgen el `ALTER IF EXISTS` es no-op silencioso y la tabla nace sin ellas. "
        f"Declaralas en el manifiesto con el MISMO tipo/default que usa el ensure.")
