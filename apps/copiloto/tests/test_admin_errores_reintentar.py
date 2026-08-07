"""CONS7b -- reintentar UN trauma del DLQ. HTTP end-to-end sobre `create_admin_app` real: los dos
casos (dominio prohibido y permitido) en la MISMA corrida -- DoD del contrato: "si sólo probás el
prohibido, un endpoint que rechaza todo pasa el test".
"""
from __future__ import annotations

import os
import time
import uuid

import jwt
import psycopg2
import pytest
from fastapi.testclient import TestClient

from admin_errores import buscar_por_id, motivo_prohibido
from admin_web import create_admin_app
from auth import make_require_admin
from contexto_tenant import conexion_con_tenant
from trauma_store import PENDIENTE, TraumaStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_rol_consola = pytest.mark.skipif(
    not os.environ.get("COPILOTO_CONSOLA_DSN"),
    reason="requiere el rol de lectura de la Consola: levantá con `test-db.sh --export` y pasá "
           "COPILOTO_CONSOLA_DSN a sync-test-backend.sh")

SECRET = "test-secret-not-real"


def _owner_conn_factory():
    """Mismo wrapping que `serve.py::_conn_factory_from_env`: `conexion_con_tenant` es lo que hace
    que la conexión declare el tenant que `with tenant(cid): ...` puso en el ContextVar dentro del
    endpoint -- sin esto, `copiloto_traumas`/`copiloto_auditoria` (con `FORCE`) rechazarían la
    escritura EN SILENCIO (0 filas, sin error) y el test mediría un endpoint roto como si anduviera."""
    def f():
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        conn.autocommit = True
        return conn
    return conexion_con_tenant(f)


def _consola_conn_factory():
    def f():
        return psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"])
    return f


def _tok_admin() -> str:
    # `sub` viaja a `copiloto_auditoria.admin_user_id`, tipado `uuid` -- en prod es el user id real
    # de GoTrue (siempre UUID); acá tiene que serlo también o el INSERT de la auditoría revienta.
    return jwt.encode({"sub": str(uuid.uuid4()), "aud": "authenticated", "exp": int(time.time()) + 3600,
                       "app_metadata": {"copiloto_admin": True}}, SECRET, algorithm="HS256")


@pytest.fixture
def nuevo_tenant(conn_de_tenant):
    creados: list[str] = []

    def _nuevo() -> str:
        cid = str(uuid.uuid4())
        creados.append(cid)
        return cid

    yield _nuevo

    for cid in creados:
        conn = conn_de_tenant(cid)()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM uc_factory.copiloto_traumas WHERE cliente_id = %s", (cid,))
                # `copiloto_auditoria` es append-only por trigger (CONS1, `auditoria_append_only.sql`)
                # -- NI EL DUEÑO puede borrarla. No se limpia a propósito: es el comportamiento
                # correcto del sistema bajo prueba, no algo que este fixture deba (o pueda) evadir.
            conn.commit()
        finally:
            conn.close()


def _client() -> TestClient:
    app = create_admin_app(require_admin=make_require_admin(secret=SECRET),
                           consola_conn_factory=_consola_conn_factory(),
                           conn_factory=_owner_conn_factory())
    return TestClient(app)


@necesita_pg
@necesita_rol_consola
def test_reintentar_dominio_prohibido_da_409_y_NO_cambia_de_estado(conn_de_tenant, nuevo_tenant):
    tenant_id = nuevo_tenant()
    fp = f"test-fp-{uuid.uuid4().hex[:8]}"
    store = TraumaStore(conn_de_tenant(tenant_id), tenant_id)
    store.depositar(
        fingerprint=fp, workflow="AfipFacturaWorkflow", error_type="TimeoutError",
        costura="activity_interceptor",
        contexto={"categoria": "business_error",
                  "origen": {"archivo": "apps/copiloto/afip_gateway.py", "linea": 12, "funcion": "x"}})
    trauma_id = next(f["id"] for f in store.listar() if f["fingerprint"] == fp)

    resp = _client().post(f"/admin/errores/{trauma_id}/reintentar",
                          headers={"Authorization": f"Bearer {_tok_admin()}"})
    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["codigo"] == "trauma_dominio_prohibido"
    assert detail["dominio"] == "afip_gateway"
    assert store.listar()[0]["estado"] == "pendiente"  # no lo tocó -- ya nació pendiente y sigue

    trauma = buscar_por_id(_consola_conn_factory(), trauma_id)
    assert trauma["estado"] == "pendiente"  # sin cambios: rechazado, no "reabierto de nuevo"


@necesita_pg
@necesita_rol_consola
def test_reintentar_dominio_permitido_vuelve_a_pendiente(conn_de_tenant, nuevo_tenant):
    tenant_id = nuevo_tenant()
    fp = f"test-fp-{uuid.uuid4().hex[:8]}"
    store = TraumaStore(conn_de_tenant(tenant_id), tenant_id)
    store.depositar(
        fingerprint=fp, workflow="CobroWorkflow", error_type="KeyError", costura="activity_interceptor",
        contexto={"categoria": "business_error",
                  "origen": {"archivo": "apps/copiloto/cobro_store.py", "linea": 9, "funcion": "x"}})
    trauma_id = next(f["id"] for f in store.listar() if f["fingerprint"] == fp)
    store.cerrar(trauma_id, estado="resuelto")  # simula que ya se había "resuelto"

    resp = _client().post(f"/admin/errores/{trauma_id}/reintentar",
                          headers={"Authorization": f"Bearer {_tok_admin()}"})
    assert resp.status_code == 200
    assert resp.json()["estado"] == "pendiente"
    assert store.listar()[0]["estado"] == PENDIENTE


@necesita_pg
def test_reintentar_trauma_inexistente_da_404():
    resp = _client().post("/admin/errores/999999999/reintentar",
                          headers={"Authorization": f"Bearer {_tok_admin()}"})
    assert resp.status_code == 404


def test_usuario_normal_403_en_reintentar():
    """ADVERSARIAL -- regla dura del repo: control de acceso sin este test = no verificado."""
    tok = jwt.encode({"sub": "u-1", "aud": "authenticated", "exp": int(time.time()) + 3600},
                     SECRET, algorithm="HS256")
    app = create_admin_app(require_admin=make_require_admin(secret=SECRET))
    resp = TestClient(app).post("/admin/errores/1/reintentar",
                                headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 403


def test_motivo_prohibido_via_workflow_o_costura_sin_origen():
    """Un trauma sin `origen` (nunca llegó a forjarse) igual puede caer en dominio prohibido si
    `workflow`/`costura` lo delatan -- equivocarse hacia el rechazo es gratis."""
    assert motivo_prohibido({"workflow": "w", "costura": "mp_credential_store", "contexto": None}) \
        == "mp_credential_store"
    assert motivo_prohibido({"workflow": "w", "costura": "c", "contexto": None}) is None
