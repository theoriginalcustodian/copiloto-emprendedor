"""A6 -- `GET /admin/auditoria`, contra Postgres real vía `copiloto_consola`.

Shape y DoD fijados por el contrato de planificación (`2026-08-07_contrato_..._A6-auditoria-no-
tiene-endpoint...`): `{"eventos": [...], "total": N}`, `limite` topeado en 500 (ACÁ, no en el
store -- el store sirve a más llamadores), y un adversarial HTTP PROPIO con control positivo --
a diferencia de CONS2-4, este endpoint SÍ lo pide explícito en el DoD, así que no alcanza con el
genérico de `test_admin_web.py`.

`AuditoriaStore.listar()` ya existía desde CONS1 (su docstring lo anticipa: "la lectura cross-tenant
para la consola, CONS6, usa el rol copiloto_consola"). Este test no reimplementa el INSERT --
siembra vía `AuditoriaStore.registrar()` con `conn_de_tenant`, mismo patrón que
`test_admin_tenants.py::test_registrar_auditoria_de_tenant_estado_queda_escrita`.
"""
from __future__ import annotations

import os
import time
import uuid

import jwt
import psycopg2
import pytest
from fastapi.testclient import TestClient

from admin_tenants import cambiar_estado
from admin_web import create_admin_app
from auditoria_store import AuditoriaStore
from auth import make_require_admin
from contexto_tenant import conexion_con_tenant

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_rol_consola = pytest.mark.skipif(
    not os.environ.get("COPILOTO_CONSOLA_DSN"),
    reason="requiere el rol de lectura de la Consola (BYPASSRLS): levantá la base con "
           "`test-db.sh --export` y pasá COPILOTO_CONSOLA_DSN a sync-test-backend.sh")

SECRET = "test-secret-not-real"


def _factory_consola():
    return psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"])


def _owner_conn_factory():
    """Mismo wrapping que `serve.py` -- sin esto, escribir en `copiloto_auditoria`/`tenants` (FORCE)
    se rechaza en silencio (0 filas) en vez de fallar con un error que lo delate."""
    def f():
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        conn.autocommit = True
        return conn
    return conexion_con_tenant(f)


def _tok(*, admin: bool) -> str:
    claims = {"sub": str(uuid.uuid4()), "aud": "authenticated", "exp": int(time.time()) + 3600}
    if admin:
        claims["app_metadata"] = {"copiloto_admin": True}
    return jwt.encode(claims, SECRET, algorithm="HS256")


@pytest.fixture
def tenant_real():
    """Siembra UN tenant real -- mismo patrón que `test_admin_tenants.py::tenant_real`. Necesario
    para escribir vía el endpoint HTTP `POST /admin/tenants/{id}/estado` (CONS7a), que es lo que
    el ciclo escribir->leer de este archivo ejercita de punta a punta."""
    cf = _owner_conn_factory()
    cliente_id = str(uuid.uuid4())
    conn = cf()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO uc_factory.tenants (auth_user_id, cliente_id, email, composio_user_id) "
            "VALUES (%s, %s, %s, %s)",
            (str(uuid.uuid4()), cliente_id, f"cons6a6-{uuid.uuid4().hex[:8]}@test.invalid", cliente_id))
    yield cliente_id
    conn2 = cf()
    with conn2.cursor() as cur:
        cur.execute("DELETE FROM uc_factory.tenants WHERE cliente_id = %s", (cliente_id,))


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


def _client() -> TestClient:
    app = create_admin_app(require_admin=make_require_admin(secret=SECRET),
                           consola_conn_factory=_factory_consola, conn_factory=_owner_conn_factory())
    return TestClient(app)


def test_http_usuario_normal_403_y_admin_200_MISMO_TEST():
    """ADVERSARIAL propio del endpoint -- el DoD del contrato lo pide explícito (a diferencia de
    CONS2-4, que reusan el genérico de `test_admin_web.py`). Control positivo y negativo en la
    MISMA corrida: sin el positivo, un 403 no probaría el gate, probaría un endpoint roto para
    todos (memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md)."""
    client = _client()
    resp_normal = client.get("/admin/auditoria", headers={"Authorization": f"Bearer {_tok(admin=False)}"})
    assert resp_normal.status_code == 403

    resp_admin = client.get("/admin/auditoria", headers={"Authorization": f"Bearer {_tok(admin=True)}"})
    assert resp_admin.status_code == 200
    body = resp_admin.json()
    assert "eventos" in body and "total" in body


def test_http_limite_topeado_en_500(monkeypatch):
    """DoD: `?limite=999999` no puede pedirle 999999 filas al store -- el tope vive en el endpoint."""
    capturado = {}

    def _espia(self, *, cliente_id=None, admin_user_id=None, limite=50):
        capturado["limite"] = limite
        return []

    monkeypatch.setattr(AuditoriaStore, "listar", _espia)
    resp = _client().get("/admin/auditoria", params={"limite": 999999},
                         headers={"Authorization": f"Bearer {_tok(admin=True)}"})
    assert resp.status_code == 200
    assert capturado["limite"] == 500


@necesita_pg
@necesita_rol_consola
def test_http_evento_escrito_por_cons7a_aparece_en_el_listado_con_detalle_intacto(tenant_real):
    """El ciclo completo escribir->leer que pide el DoD: CONS7a (`POST /admin/tenants/{id}/estado`)
    escribe la auditoría, A6 (`GET /admin/auditoria`) la lee -- MISMA instancia de `create_admin_app`,
    no dos mocks que coincidan por casualidad."""
    client = _client()
    tok = _tok(admin=True)
    resp_post = client.post(f"/admin/tenants/{tenant_real}/estado", json={"status": "suspended"},
                            headers={"Authorization": f"Bearer {tok}"})
    assert resp_post.status_code == 200

    resp_get = client.get("/admin/auditoria", params={"cliente_id": tenant_real},
                          headers={"Authorization": f"Bearer {tok}"})
    assert resp_get.status_code == 200
    body = resp_get.json()
    fila = next(f for f in body["eventos"] if f["cliente_id"] == tenant_real)
    assert fila["accion"] == "tenant.estado"
    assert fila["detalle"] == {"cliente_id": tenant_real, "de": "active", "a": "suspended"}
    assert body["total"] == len(body["eventos"])
