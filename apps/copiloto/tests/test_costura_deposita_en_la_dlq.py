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

    @app.get("/dato-invalido")
    def _de_negocio():  # noqa: ANN202
        # `ValueError` es `business_error` en la taxonomía: reintentarlo da el mismo resultado.
        raise ValueError("el importe no es un número")

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


# ======================================================================================
# `diferido` — ítem 2.5. Los tres tests de abajo son UNA sola afirmación en tres partes:
# el campo es la conjunción de dos condiciones, y hace falta un caso que falle por cada
# una. Con el positivo solo, un `diferido` cableado a `True` pasaría igual — y diría
# "lo estamos procesando" ante un error que nadie va a reintentar, que es la falla cara.
# ======================================================================================
@necesita_pg
def test_un_error_de_INFRA_depositado_se_informa_como_diferido(tenant_de_prueba, conn_de_tenant):
    cid = tenant_de_prueba
    cliente = TestClient(_app_con_dlq(conn_de_tenant(cid), cid), raise_server_exceptions=False)

    respuesta = cliente.get("/revienta")

    assert respuesta.status_code == 500, "sigue siendo 500, no 202: la operación NO se aceptó"
    cuerpo = respuesta.json()
    assert cuerpo["diferido"] is True
    assert cuerpo["codigo"], "el código se muestra igual — es lo que el usuario cita si escribe"
    # Y lo dice porque el trauma EXISTE, no porque la categoría lo prometa.
    (trauma,) = TraumaStore(conn_de_tenant(cid), cid).listar()
    assert trauma["estado"] == PENDIENTE


@necesita_pg
def test_CONTROL_un_error_de_NEGOCIO_no_se_informa_como_diferido(tenant_de_prueba, conn_de_tenant):
    """Con la DLQ **viva**, a propósito: si este caso corriera sin base, el `False` saldría por falta
    de depósito y el test no diría nada sobre la categoría, que es justo lo que viene a probar."""
    cid = tenant_de_prueba
    cliente = TestClient(_app_con_dlq(conn_de_tenant(cid), cid), raise_server_exceptions=False)

    cuerpo = cliente.get("/dato-invalido").json()

    assert cuerpo["diferido"] is False, \
        "un business_error no lo reintenta nadie; decir que sí deja al usuario esperando para siempre"
    # El trauma igual se deposita — queda para que un humano lo mire. Depositar y reintentar son
    # decisiones distintas, y sólo la segunda depende de la categoría.
    (trauma,) = TraumaStore(conn_de_tenant(cid), cid).listar()
    assert trauma["error_type"] == "ValueError"


def test_con_la_DLQ_CAIDA_no_se_promete_reintento_y_el_500_igual_sale():
    """La otra mitad de la conjunción. Sin este test, `diferido = es_reintentable(categoria)` —sin
    mirar el depósito— pasaría los dos de arriba, y prometería reintentar un error que no quedó en
    ninguna cola. No necesita Postgres: el caso ES que no hay base."""
    def _fabrica_rota(_cliente_id: str):  # noqa: ANN202
        raise ConnectionError("la DLQ no responde")

    app = FastAPI()

    @app.middleware("http")
    async def _tenant(request, call_next):  # noqa: ANN001, ANN202
        request.state.cliente_id = str(uuid.uuid4())
        return await call_next(request)

    registrar_captura_global(app, traumas=_fabrica_rota)

    @app.get("/revienta")
    def _revienta():  # noqa: ANN202
        raise ConnectionError("la base no responde")   # infra_error: reintentable POR CATEGORÍA

    respuesta = TestClient(app, raise_server_exceptions=False).get("/revienta")

    assert respuesta.status_code == 500, "el 500 sale igual: la DLQ caída no puede tragarse el error"
    cuerpo = respuesta.json()
    assert cuerpo["codigo"], "y con su código, que es lo único que le queda al usuario"
    assert cuerpo["diferido"] is False


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
