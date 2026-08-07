"""CONS7a -- suspender/reactivar tenant. HTTP end-to-end contra Postgres real: la suspensión se
verifica por HTTP (un 403 en un endpoint protegido por `require_tenant`), no por el valor de la
columna -- DoD explícito del contrato. Complementa el test rápido con fake conn_factory de
`test_auth.py::test_require_tenant_suspendido_da_403_y_activo_da_200_MISMO_TEST`.
"""
from __future__ import annotations

import os
import time
import uuid

import jwt
import psycopg2
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from admin_tenants import cambiar_estado, listar_tenants
from admin_web import create_admin_app
from auditoria_store import AuditoriaStore
from auth import make_require_admin, make_require_tenant
from contexto_tenant import conexion_con_tenant
from contexto_tenant import tenant as declarar_tenant_scope

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_rol_consola = pytest.mark.skipif(
    not os.environ.get("COPILOTO_CONSOLA_DSN"),
    reason="requiere el rol de lectura de la Consola (BYPASSRLS): levantá la base con "
           "`test-db.sh --export` y pasá COPILOTO_CONSOLA_DSN a sync-test-backend.sh")

SECRET = "test-secret-not-real"
SCHEMA = "uc_factory"


def _factory_consola():
    return psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"])


def _tok_admin(*, admin: bool) -> str:
    claims = {"sub": str(uuid.uuid4()), "aud": "authenticated", "exp": int(time.time()) + 3600}
    if admin:
        claims["app_metadata"] = {"copiloto_admin": True}
    return jwt.encode(claims, SECRET, algorithm="HS256")


def _owner_conn_factory():
    """`conexion_con_tenant` (mismo wrapping que `serve.py`): sin esto, la escritura de auditoría
    en `test_registrar_auditoria_de_tenant_estado_queda_escrita` -- `copiloto_auditoria` tiene
    `FORCE` -- se rechazaría en silencio (0 filas) en vez de fallar con un error que lo delate."""
    def f():
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        conn.autocommit = True
        return conn
    return conexion_con_tenant(f)


def _tok(sub: str) -> str:
    return jwt.encode({"sub": sub, "aud": "authenticated", "exp": int(time.time()) + 3600},
                      SECRET, algorithm="HS256")


@pytest.fixture
def tenant_real():
    """Siembra UN tenant en `uc_factory.tenants` (sin RLS/FORCE -- conexión cruda, mismo patrón que
    `test_adversarial_multitenant.py::_conn_factory_cruda`). Limpia `tenants` al final -- NO su
    auditoría: `copiloto_auditoria` es append-only por trigger (CONS1), ni el dueño puede borrarla,
    y no es un bug de este test: es el sistema bajo prueba haciendo lo que tiene que hacer."""
    cf = _owner_conn_factory()
    auth_user_id, cliente_id = str(uuid.uuid4()), str(uuid.uuid4())
    conn = cf()
    with conn.cursor() as cur:
        # `composio_user_id` es NOT NULL -- mismo patrón que
        # `test_adversarial_multitenant.py::two_tenants` (usa el propio `cliente_id` como valor).
        cur.execute(
            f"INSERT INTO {SCHEMA}.tenants (auth_user_id, cliente_id, email, composio_user_id) "
            f"VALUES (%s, %s, %s, %s)",
            (auth_user_id, cliente_id, f"cons7a-{uuid.uuid4().hex[:8]}@test.invalid", cliente_id))
    yield auth_user_id, cliente_id
    conn2 = cf()
    with conn2.cursor() as cur:
        cur.execute(f"DELETE FROM {SCHEMA}.tenants WHERE cliente_id = %s", (cliente_id,))


def _toy_app() -> FastAPI:
    """El "endpoint de negocio" que el guard protege -- cualquiera sirve, `require_tenant` es el
    MISMO para todos (`/chat`, `/reply`, `/me`...); no hace falta levantar `web.py` entero."""
    app = FastAPI()
    require_tenant = make_require_tenant(secret=SECRET, conn_factory=_owner_conn_factory())

    @app.get("/whoami")
    def whoami(cliente_id: str = Depends(require_tenant)):
        return {"cliente_id": cliente_id}

    return app


@necesita_pg
def test_suspender_bloquea_por_HTTP_y_reactivar_lo_devuelve_MISMO_TEST(tenant_real):
    """DoD del contrato: "Suspender -> el tenant deja de operar verificado por HTTP" +
    "Reactivar lo devuelve a operar (ida y vuelta, no sólo ida)"."""
    auth_user_id, cliente_id = tenant_real
    client = TestClient(_toy_app())
    tok = _tok(auth_user_id)

    # Activo por default (provision.py: `status text NOT NULL DEFAULT 'active'`) -> control positivo.
    assert client.get("/whoami", headers={"Authorization": f"Bearer {tok}"}).status_code == 200

    anterior = cambiar_estado(_owner_conn_factory(), cliente_id=cliente_id, nuevo_estado="suspended")
    assert anterior == "active"
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 403

    anterior2 = cambiar_estado(_owner_conn_factory(), cliente_id=cliente_id, nuevo_estado="active")
    assert anterior2 == "suspended"
    assert client.get("/whoami", headers={"Authorization": f"Bearer {tok}"}).status_code == 200


@necesita_pg
def test_cambiar_estado_tenant_inexistente_da_None(tenant_real):
    assert cambiar_estado(_owner_conn_factory(), cliente_id=str(uuid.uuid4()),
                          nuevo_estado="suspended") is None


@necesita_pg
def test_registrar_auditoria_de_tenant_estado_queda_escrita(tenant_real):
    """La auditoría es precondición de la mutación (`AuditoriaStore` docstring) -- acá se ejercita
    tal cual la usa el endpoint: conexión declarando el tenant AFECTADO, no uno del admin."""
    _, cliente_id = tenant_real
    cambiar_estado(_owner_conn_factory(), cliente_id=cliente_id, nuevo_estado="suspended")
    with declarar_tenant_scope(cliente_id):
        # `admin_user_id` es `uuid` en la tabla (el user id real de GoTrue en prod) -- tiene que
        # serlo acá también.
        fila_id = AuditoriaStore(_owner_conn_factory(), cliente_id).registrar(
            admin_user_id=str(uuid.uuid4()), admin_email="admin@test.invalid", accion="tenant.estado",
            detalle={"cliente_id": cliente_id, "de": "active", "a": "suspended"})
    assert fila_id > 0


def _sembrar_tenant(*, email: str, status: str = "active") -> str:
    """Mismo patrón que `tenant_real`, pero con `status` elegible -- CTA1 necesita filtrar por
    estado, y `tenant_real` siempre siembra en el default `active`."""
    cf = _owner_conn_factory()
    cliente_id = str(uuid.uuid4())
    conn = cf()
    with conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO {SCHEMA}.tenants (auth_user_id, cliente_id, email, composio_user_id, status) "
            f"VALUES (%s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), cliente_id, email, cliente_id, status))
    return cliente_id


def _limpiar_tenant(cliente_id: str) -> None:
    conn = _owner_conn_factory()()
    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {SCHEMA}.tenants WHERE cliente_id = %s", (cliente_id,))


@necesita_pg
@necesita_rol_consola
def test_listar_tenants_no_expone_composio_user_id(conn_de_tenant):
    """CTA1: `composio_user_id` es NOT NULL en la fila sembrada -- si `listar_tenants` lo
    seleccionara por accidente (ej. `SELECT *`), este test lo detecta."""
    email = f"cta1-listar-{uuid.uuid4().hex[:8]}@test.invalid"
    cliente_id = _sembrar_tenant(email=email)
    try:
        filas = listar_tenants(_factory_consola, limite=500)
        fila = next(f for f in filas if f["cliente_id"] == cliente_id)
        assert "composio_user_id" not in fila
        assert fila["email"] == email
        assert fila["status"] == "active"
        assert fila["created_at"] is not None
    finally:
        _limpiar_tenant(cliente_id)


@necesita_pg
@necesita_rol_consola
def test_listar_tenants_filtra_por_estado(conn_de_tenant):
    activo = _sembrar_tenant(email=f"cta1-activo-{uuid.uuid4().hex[:8]}@test.invalid", status="active")
    suspendido = _sembrar_tenant(
        email=f"cta1-suspendido-{uuid.uuid4().hex[:8]}@test.invalid", status="suspended")
    try:
        filas = listar_tenants(_factory_consola, estado="suspended", limite=500)
        ids_vistos = {f["cliente_id"] for f in filas}
        assert suspendido in ids_vistos
        assert activo not in ids_vistos
    finally:
        _limpiar_tenant(activo)
        _limpiar_tenant(suspendido)


def _client() -> "TestClient":
    app = create_admin_app(require_admin=make_require_admin(secret=SECRET),
                           consola_conn_factory=_factory_consola, conn_factory=_owner_conn_factory())
    return TestClient(app)


@necesita_pg
@necesita_rol_consola
def test_http_usuario_normal_403_y_admin_200_MISMO_TEST():
    """ADVERSARIAL propio del endpoint, con control positivo y negativo en la MISMA corrida --
    mismo patrón que `test_admin_auditoria.py`, decorado igual (el 200 toca Postgres vía
    `consola_conn_factory`)."""
    client = _client()
    resp_normal = client.get("/admin/tenants", headers={"Authorization": f"Bearer {_tok_admin(admin=False)}"})
    assert resp_normal.status_code == 403

    resp_admin = client.get("/admin/tenants", headers={"Authorization": f"Bearer {_tok_admin(admin=True)}"})
    assert resp_admin.status_code == 200
    body = resp_admin.json()
    assert "tenants" in body and "total" in body


def test_http_limite_topeado_en_500(monkeypatch):
    """DoD: `?limite=10000` no puede pedirle 10000 filas al store -- el tope vive en el endpoint,
    mismo patrón que `test_admin_auditoria.py::test_http_limite_topeado_en_500`."""
    import admin_web

    capturado = {}

    def _espia(conn_factory, *, estado=None, limite=50):
        capturado["limite"] = limite
        return []

    monkeypatch.setattr(admin_web, "listar_tenants", _espia)
    resp = _client().get("/admin/tenants", params={"limite": 10000},
                         headers={"Authorization": f"Bearer {_tok_admin(admin=True)}"})
    assert resp.status_code == 200
    assert capturado["limite"] == 500
