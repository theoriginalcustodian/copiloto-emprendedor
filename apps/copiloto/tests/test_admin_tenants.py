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

from admin_tenants import cambiar_estado
from auditoria_store import AuditoriaStore
from auth import make_require_tenant
from contexto_tenant import conexion_con_tenant
from contexto_tenant import tenant as declarar_tenant_scope

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")

SECRET = "test-secret-not-real"
SCHEMA = "uc_factory"


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
