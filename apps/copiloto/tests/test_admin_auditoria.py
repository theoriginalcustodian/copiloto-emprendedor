"""A6 -- `GET /admin/auditoria`, contra Postgres real vía `copiloto_consola`.

`AuditoriaStore.listar()` ya existía desde CONS1 (su docstring lo anticipa: "la lectura cross-tenant
para la consola, CONS6, usa el rol copiloto_consola"). Este test no reimplementa el INSERT --
siembra vía `AuditoriaStore.registrar()` con `conn_de_tenant`, mismo patrón que
`test_admin_tenants.py::test_registrar_auditoria_de_tenant_estado_queda_escrita`.

No hay test HTTP 403/200 acá: el gate `require_admin` es el MISMO para todo `/admin/*` y ya está
cubierto por `test_admin_web.py` (control positivo + adversarial + escalada) -- repetirlo por
endpoint sería el mismo control, no uno nuevo.
"""
from __future__ import annotations

import os
import uuid

import psycopg2
import pytest

from auditoria_store import AuditoriaStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_rol_consola = pytest.mark.skipif(
    not os.environ.get("COPILOTO_CONSOLA_DSN"),
    reason="requiere el rol de lectura de la Consola (BYPASSRLS): levantá la base con "
           "`test-db.sh --export` y pasá COPILOTO_CONSOLA_DSN a sync-test-backend.sh")


def _factory_consola():
    return psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"])


@necesita_pg
@necesita_rol_consola
def test_listar_ve_auditoria_cross_tenant(conn_de_tenant):
    """Dos tenants distintos escriben; la consola (BYPASSRLS) ve las dos filas -- sin esto CONS6
    no podría mostrar "todas las acciones de todos los admins"."""
    tenant_a, tenant_b = str(uuid.uuid4()), str(uuid.uuid4())
    admin = str(uuid.uuid4())
    AuditoriaStore(conn_de_tenant(tenant_a), tenant_a).registrar(
        admin_user_id=admin, admin_email="a@test.invalid", accion="tenant.estado",
        detalle={"de": "active", "a": "suspended"})
    AuditoriaStore(conn_de_tenant(tenant_b), tenant_b).registrar(
        admin_user_id=admin, admin_email="a@test.invalid", accion="trauma.reintento",
        detalle={"trauma_id": 1})

    filas = AuditoriaStore(_factory_consola).listar(admin_user_id=admin)
    accionadas = {f["cliente_id"] for f in filas}
    assert tenant_a in accionadas
    assert tenant_b in accionadas


@necesita_pg
@necesita_rol_consola
def test_listar_filtra_por_cliente_id(conn_de_tenant):
    tenant_a, tenant_b = str(uuid.uuid4()), str(uuid.uuid4())
    admin = str(uuid.uuid4())
    AuditoriaStore(conn_de_tenant(tenant_a), tenant_a).registrar(
        admin_user_id=admin, admin_email="a@test.invalid", accion="tenant.estado", detalle={})
    AuditoriaStore(conn_de_tenant(tenant_b), tenant_b).registrar(
        admin_user_id=admin, admin_email="a@test.invalid", accion="tenant.estado", detalle={})

    filas = AuditoriaStore(_factory_consola).listar(cliente_id=tenant_a)
    assert all(f["cliente_id"] == tenant_a for f in filas)
    assert any(f["cliente_id"] == tenant_a for f in filas)


@necesita_pg
@necesita_rol_consola
def test_listar_trae_accion_y_resultado_y_detalle_completo(conn_de_tenant):
    """A6 es transparencia sobre el ADMIN, no contenido del emprendedor -- a diferencia de A5
    (CONS3), acá `detalle` se expone completo a propósito: es lo que el propio admin escribió."""
    tenant = str(uuid.uuid4())
    admin = str(uuid.uuid4())
    AuditoriaStore(conn_de_tenant(tenant), tenant).registrar(
        admin_user_id=admin, admin_email="a@test.invalid", accion="trauma.reintento",
        detalle={"trauma_id": 42, "dominio": "afip_gateway"}, resultado="rechazado")

    filas = AuditoriaStore(_factory_consola).listar(cliente_id=tenant)
    fila = next(f for f in filas if f["cliente_id"] == tenant)
    assert fila["accion"] == "trauma.reintento"
    assert fila["resultado"] == "rechazado"
    assert fila["detalle"]["trauma_id"] == 42
    assert fila["detalle"]["dominio"] == "afip_gateway"
    assert fila["admin_email"] == "a@test.invalid"


@necesita_pg
def test_listar_con_conexion_de_tenant_NO_ve_cross_tenant(conn_de_tenant):
    """ADVERSARIAL -- conexión normal (RLS `FORCE`, sin `BYPASSRLS`) sólo ve su propio tenant, aunque
    otro tenant tenga auditoría en la misma tabla. Mismo patrón que
    `test_admin_errores.py::test_resumen_errores_con_conexion_de_tenant_NO_ve_cross_tenant`."""
    tenant_a, tenant_b = str(uuid.uuid4()), str(uuid.uuid4())
    admin = str(uuid.uuid4())
    AuditoriaStore(conn_de_tenant(tenant_a), tenant_a).registrar(
        admin_user_id=admin, admin_email="a@test.invalid", accion="tenant.estado", detalle={})
    AuditoriaStore(conn_de_tenant(tenant_b), tenant_b).registrar(
        admin_user_id=admin, admin_email="a@test.invalid", accion="tenant.estado", detalle={})

    filas = AuditoriaStore(conn_de_tenant(tenant_a), tenant_a).listar(admin_user_id=admin)
    accionadas = {f["cliente_id"] for f in filas}
    assert tenant_a in accionadas
    assert tenant_b not in accionadas
