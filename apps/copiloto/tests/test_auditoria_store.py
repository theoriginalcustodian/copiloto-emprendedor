"""CONS1 — el registro de auditoría escribe por tenant, lee cross-tenant, y NUNCA se muta.

Corre contra Postgres real: lo que importa acá (`WITH CHECK`, el `RETURNING id`, el trigger de
`auditoria_append_only.sql`) es comportamiento de la base, no del código Python.
"""
from __future__ import annotations

import os
import uuid

import pytest

from auditoria_store import TABLA, AuditoriaStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_rol_consola = pytest.mark.skipif(
    not os.environ.get("COPILOTO_CONSOLA_DSN"),
    reason="requiere el rol de lectura de la Consola (BYPASSRLS): levantá la base con "
           "`test-db.sh --export` y pasá COPILOTO_CONSOLA_DSN a sync-test-backend.sh")


def _store(conn_de_tenant, cid):
    return AuditoriaStore(conn_de_tenant(cid), cid)


@pytest.fixture
def tenant(conn_de_tenant):
    cid = str(uuid.uuid4())
    yield cid
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        # No hay DELETE que valga: append-only. Sólo confirmamos que la fila quedó (nada que limpiar).
        cur.execute(f"SELECT count(*) FROM {TABLA} WHERE cliente_id = %s", (cid,))
    conn.close()


@necesita_pg
def test_registrar_escribe_con_el_tenant_declarado_y_devuelve_el_id(conn_de_tenant, tenant):
    store = _store(conn_de_tenant, tenant)
    fila_id = store.registrar(admin_user_id=str(uuid.uuid4()), admin_email="admin@test.invalid",
                              accion="suspender_tenant", detalle={"motivo": "test"})
    assert isinstance(fila_id, int)

    conn = conn_de_tenant(tenant)()
    with conn.cursor() as cur:
        cur.execute(f"SELECT cliente_id::text, admin_email, accion, resultado, detalle "
                    f"FROM {TABLA} WHERE id = %s", (fila_id,))
        cid, email, accion, resultado, detalle = cur.fetchone()
    conn.close()
    assert cid == tenant
    assert email == "admin@test.invalid"
    assert accion == "suspender_tenant"
    assert resultado == "exitoso"          # default
    assert detalle == {"motivo": "test"}


@necesita_pg
def test_registrar_LANZA_si_falla_a_diferencia_de_trauma_store(conn_de_tenant, tenant):
    """Divergencia deliberada de `trauma_store.depositar` (que nunca lanza): acá un fallo al escribir
    NO puede pasar desapercibido, porque el registro es la precondición de la mutación que lo llama."""
    import psycopg2

    store = _store(conn_de_tenant, tenant)
    with pytest.raises(psycopg2.Error):
        # admin_email es NOT NULL — None fuerza el fallo sin simular nada más elaborado.
        store.registrar(admin_user_id=str(uuid.uuid4()), admin_email=None, accion="x")


@necesita_pg
def test_listar_con_conexion_de_tenant_no_ve_lo_de_otro_tenant(conn_de_tenant):
    tenant_a, tenant_b = str(uuid.uuid4()), str(uuid.uuid4())
    marca = f"test-aisl-{uuid.uuid4().hex[:8]}"
    _store(conn_de_tenant, tenant_a).registrar(
        admin_user_id=tenant_a, admin_email="a@test.invalid", accion=marca)
    _store(conn_de_tenant, tenant_b).registrar(
        admin_user_id=tenant_b, admin_email="b@test.invalid", accion=marca)

    vistos_a = _store(conn_de_tenant, tenant_a).listar(limite=50)
    assert all(f["cliente_id"] == tenant_a for f in vistos_a if f["accion"] == marca)
    assert any(f["accion"] == marca for f in vistos_a)

    vistos_b = _store(conn_de_tenant, tenant_b).listar(limite=50)
    assert all(f["cliente_id"] == tenant_b for f in vistos_b if f["accion"] == marca)


@necesita_pg
@necesita_rol_consola
def test_listar_cross_tenant_con_el_rol_de_la_consola_ve_ambos(conn_de_tenant):
    """Control positivo: sin esto, dos `listar()` tenant-scoped que nunca se cruzan no prueban que la
    consola pueda ver todo junto — sólo que el aislamiento normal funciona, que ya cubre el test de
    arriba."""
    import psycopg2

    tenant_a, tenant_b = str(uuid.uuid4()), str(uuid.uuid4())
    marca = f"test-cross-{uuid.uuid4().hex[:8]}"
    _store(conn_de_tenant, tenant_a).registrar(
        admin_user_id=tenant_a, admin_email="a@test.invalid", accion=marca)
    _store(conn_de_tenant, tenant_b).registrar(
        admin_user_id=tenant_b, admin_email="b@test.invalid", accion=marca)

    def factory_consola():
        return psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"])

    store_consola = AuditoriaStore(factory_consola)
    vistos = store_consola.listar(limite=200)
    clientes_vistos = {f["cliente_id"] for f in vistos if f["accion"] == marca}
    assert clientes_vistos == {tenant_a, tenant_b}, (
        f"la consola vio {clientes_vistos} para la marca {marca!r}, se esperaban ambos tenants")
