"""La JUNTA entre la costura y la DLQ — el pedazo que ningún test de los dos lados cubría.

`test_handler_errores_web.py` verifica que la costura **registra**. `test_trauma_store.py` verifica
que la DLQ **deduplica y transiciona**. Los dos verdes, y entre ellos quedaba la pregunta que ninguno
hace: **¿el error que atrapa la costura llega efectivamente a la tabla?**

Es exactamente la falla que este repo ya pagó cuatro veces el 2026-07-21 —*cada lado verificó su
mitad y la costura no era de nadie*— y la que hoy volvió a aparecer en otra forma: 8 tests
adversariales verdes que no podían ver el fallo porque no pasaban por la pieza real
([[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]).

Por eso este test usa la **DLQ real contra Postgres**, no un doble: un mock de `TraumaStore` probaría
que la costura llama al mock, que es justamente lo que no está en duda.
"""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from deposito_traumas import fabrica_desde
from handler_errores_web import registrar_captura_global
from trauma_store import PENDIENTE, TraumaStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")


@pytest.fixture
def tenant_de_prueba(conn_de_tenant):
    cid = str(uuid.uuid4())
    yield cid
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM uc_factory.copiloto_traumas WHERE cliente_id = %s", (cid,))
    conn.close()


def _app_con_dlq(conn_factory, cliente_id: str | None) -> FastAPI:
    """Una app mínima con la costura enganchada a la DLQ real.

    `cliente_id` se pone en `request.state` con un middleware, que es donde lo deja `require_tenant`
    en producción — la costura lo lee de ahí y de ningún otro lado.
    """
    app = FastAPI()

    @app.middleware("http")
    async def _tenant(request, call_next):  # noqa: ANN001, ANN202
        if cliente_id:
            request.state.cliente_id = cliente_id
        return await call_next(request)

    registrar_captura_global(app, traumas=fabrica_desde(conn_factory))

    @app.get("/revienta")
    def _revienta():  # noqa: ANN202
        raise ConnectionError("la base no responde")

    @app.get("/no-existe")
    def _cuatro_cero_cuatro():  # noqa: ANN202
        raise HTTPException(status_code=404, detail="no está")

    return app


@necesita_pg
def test_un_500_de_CUALQUIER_ruta_termina_depositado_en_la_dlq(tenant_de_prueba, conn_de_tenant):
    cid = tenant_de_prueba
    cliente = TestClient(_app_con_dlq(conn_de_tenant(cid), cid), raise_server_exceptions=False)

    respuesta = cliente.get("/revienta")
    assert respuesta.status_code == 500
    codigo = respuesta.json()["codigo"]

    (trauma,) = TraumaStore(conn_de_tenant(cid), cid).listar()
    assert trauma["fingerprint"] == codigo, \
        "el código que vio el usuario no es el mismo con el que se depositó — no se pueden cruzar"
    assert trauma["error_type"] == "ConnectionError"
    assert trauma["costura"] == "http_handler"
    assert trauma["estado"] == PENDIENTE
    assert trauma["dedupe_count"] == 1


@necesita_pg
def test_el_MISMO_error_dos_veces_deja_UN_trauma_contado_dos(tenant_de_prueba, conn_de_tenant):
    """La deduplicación de punta a punta: dos requests, un trauma. Si cada request creara su fila, la
    DLQ se llenaría de ruido justo cuando algo falla en loop — que es cuando más hay que poder leerla."""
    cid = tenant_de_prueba
    cliente = TestClient(_app_con_dlq(conn_de_tenant(cid), cid), raise_server_exceptions=False)

    cliente.get("/revienta")
    cliente.get("/revienta")

    (trauma,) = TraumaStore(conn_de_tenant(cid), cid).listar()
    assert trauma["dedupe_count"] == 2


@necesita_pg
def test_CONTROL_un_404_de_negocio_NO_ensucia_la_dlq(tenant_de_prueba, conn_de_tenant):
    """El control que hace que lo de arriba signifique algo.

    Si los `HTTPException` también se depositaran, la DLQ se llenaría de operación normal —un
    presupuesto que no existe no es un fallo del sistema— y en dos semanas nadie la miraría. Es el
    mismo criterio con el que la costura ya decide qué loguear."""
    cid = tenant_de_prueba
    cliente = TestClient(_app_con_dlq(conn_de_tenant(cid), cid), raise_server_exceptions=False)

    assert cliente.get("/no-existe").status_code == 404
    assert TraumaStore(conn_de_tenant(cid), cid).listar() == []


@necesita_pg
def test_una_ruta_PUBLICA_sin_tenant_no_rompe_ni_deposita(conn_de_tenant):
    """Health y webhooks no tienen `cliente_id`. Sin tenant la fila no tendría dueño y el `WITH CHECK`
    la rechazaría — así que no se deposita, pero **el 500 tiene que salir igual y con su código**: el
    error ya quedó en el log, que es donde se lo va a buscar."""
    cid_para_conexion = str(uuid.uuid4())
    cliente = TestClient(_app_con_dlq(conn_de_tenant(cid_para_conexion), None),
                         raise_server_exceptions=False)

    respuesta = cliente.get("/revienta")
    assert respuesta.status_code == 500
    assert respuesta.json()["codigo"], "el usuario se quedó sin código de error"


def test_sin_DLQ_la_costura_sigue_capturando_igual():
    """El depósito es una mejora del registro, **nunca** una condición para registrar. Este es el
    único test del archivo que no necesita Postgres — a propósito: prueba justamente el caso en que no
    hay base."""
    app = FastAPI()
    registrar_captura_global(app, traumas=None)

    @app.get("/revienta")
    def _revienta():  # noqa: ANN202
        raise ConnectionError("sin base")

    respuesta = TestClient(app, raise_server_exceptions=False).get("/revienta")
    assert respuesta.status_code == 500
    assert respuesta.json()["codigo"]
