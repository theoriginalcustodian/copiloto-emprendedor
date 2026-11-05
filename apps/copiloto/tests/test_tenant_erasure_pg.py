"""SEC-D8 contra Postgres real: el borrado de A deja intacto a B, retiene lo declarado y es idempotente.

Incluye el caso HOSTIL (regla dura del repo: un control de aislamiento sin test adversarial queda
[UNVERIFIED]): una conexión del tenant A que pide borrar el `cliente_id` de B no toca nada de B, porque
las tablas con `FORCE` filtran por el tenant declarado en la conexión (segunda línea tras el
`WHERE cliente_id`). OJO al leer: una conexión CRUDA (sin tenant) ve 0 filas de una tabla `FORCE`, así
que el estado de esas tablas se lee SIEMPRE por la conexión del tenant (`_n`), nunca por `_sql`.
"""
from __future__ import annotations

import os
import uuid

import pytest

import tenant_erasure_store as store
from auditoria_store import AuditoriaStore
from cliente_store import ClienteStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


def _sql(sql: str, params: tuple = ()):
    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall() if cur.description else None
    finally:
        conn.close()


def _alta_tenant(cid: str) -> str:
    auth = str(uuid.uuid4())
    _sql("INSERT INTO uc_factory.tenants (auth_user_id, cliente_id, email, composio_user_id) "
         "VALUES (%s, %s, %s, %s)", (auth, cid, f"{cid}@test.invalid", f"composio-{cid}"))
    return auth


def _n(conn_de_tenant, cid: str, tabla: str) -> int:
    """Filas de `cid` en una tabla FORCE, leídas COMO ese tenant (una conexión cruda vería 0)."""
    conn = conn_de_tenant(cid)()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT count(*) FROM uc_factory.{tabla} WHERE cliente_id = %s", (cid,))
            return cur.fetchone()[0]
    finally:
        conn.close()


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        _sql("DELETE FROM uc_factory.copiloto_clientes WHERE cliente_id = %s", (cid,))
        _sql("DELETE FROM uc_factory.tenants WHERE cliente_id = %s", (cid,))


@necesita_pg
def test_toda_tabla_del_copiloto_con_cliente_id_esta_clasificada():
    """Una tabla nueva `copiloto_*`/`afip_*`/`mp_*` sin clasificar escaparía del borrado en silencio."""
    filas = _sql("SELECT DISTINCT table_name FROM information_schema.columns "
                 "WHERE table_schema = 'uc_factory' AND column_name = 'cliente_id'")
    del_copiloto = {r[0] for r in filas if r[0].startswith(store.PREFIJOS_DEL_COPILOTO)}
    sin_clasificar = del_copiloto - store.tablas_clasificadas()
    assert not sin_clasificar, f"tablas del copiloto SIN clasificar para SEC-D8: {sorted(sin_clasificar)}"
    # control positivo: el instrumento ve tablas (si el filtro estuviera roto, el conjunto sería vacío)
    assert {"copiloto_clientes", "afip_perfil", "mp_credentials"} <= del_copiloto
    # y las clasificadas existen de verdad (un nombre mal escrito en TABLAS_BORRAR reventaría el borrado)
    inexistentes = (set(store.TABLAS_BORRAR) | set(store.TABLAS_RETENER)) - {r[0] for r in filas}
    assert not inexistentes, f"clasificadas que no existen en la base: {sorted(inexistentes)}"


@necesita_pg
def test_borrar_A_no_toca_a_B_retiene_auditoria_y_es_idempotente(conn_de_tenant, tenants):
    a, b = tenants
    _alta_tenant(a)
    _alta_tenant(b)
    ClienteStore(conn_de_tenant(a), a).crear(nombre="Cliente de A")
    ClienteStore(conn_de_tenant(b), b).crear(nombre="Cliente de B")
    AuditoriaStore(conn_de_tenant(a), a).registrar(admin_user_id=str(uuid.uuid4()), admin_email="op@x.invalid",
                                                   accion="tenant.estado", detalle={"x": 1})

    recibo = store.borrar_datos(conn_de_tenant(a), a)

    assert recibo["copiloto_clientes"] == 1 and recibo["tenants"] == 1
    assert _n(conn_de_tenant, a, "copiloto_clientes") == 0
    assert _sql("SELECT count(*) FROM uc_factory.tenants WHERE cliente_id = %s", (a,))[0][0] == 0
    # B intacto (control: si el borrado fuera global, B también estaría vacío)
    assert _n(conn_de_tenant, b, "copiloto_clientes") == 1
    assert _sql("SELECT count(*) FROM uc_factory.tenants WHERE cliente_id = %s", (b,))[0][0] == 1
    # RETENIDA: la auditoría (append-only) de A sigue ahí
    assert _n(conn_de_tenant, a, "copiloto_auditoria") == 1
    # idempotente: segunda corrida = todo ceros, sin error
    assert sum(store.borrar_datos(conn_de_tenant(a), a).values()) == 0


@necesita_pg
def test_ADVERSARIAL_conexion_de_A_con_el_cliente_id_de_B_no_borra_los_datos_de_B(conn_de_tenant, tenants):
    a, b = tenants
    ClienteStore(conn_de_tenant(b), b).crear(nombre="Cliente de B")
    assert _n(conn_de_tenant, b, "copiloto_clientes") == 1     # control: el instrumento ve a B
    # actor hostil: conexión declarada como A, pero pide borrar el cliente_id de B
    store.borrar_datos(conn_de_tenant(a), b)
    assert _n(conn_de_tenant, b, "copiloto_clientes") == 1


@necesita_pg
def test_exportar_trae_solo_lo_del_tenant_y_nunca_credenciales_ni_auditoria(conn_de_tenant, tenants):
    a, b = tenants
    ClienteStore(conn_de_tenant(a), a).crear(nombre="Cliente de A")
    ClienteStore(conn_de_tenant(b), b).crear(nombre="Cliente de B")

    out = store.exportar_datos(conn_de_tenant(a), a)

    nombres = [f["nombre"] for f in out["tablas"]["copiloto_clientes"]]
    assert nombres == ["Cliente de A"]                       # ni rastro de B
    assert "Cliente de B" not in str(out)
    for prohibida in store.TABLAS_SIN_EXPORTAR:
        assert prohibida not in out["tablas"], f"{prohibida} no debe exportarse"
    assert set(out["excluidas"]) == set(store.TABLAS_SIN_EXPORTAR)
