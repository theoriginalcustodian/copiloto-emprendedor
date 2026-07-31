"""La costura C2 registra los fallos de CUALQUIER ruta — y no toca las respuestas de negocio.

El valor de esta costura no es que registre: es **qué NO registra**. Un handler que anotara también
los 404 y 409 llenaría el log de operación normal, y en dos semanas nadie lo miraría — el mismo modo
de fallo que ya obligó a descartar dos reglas de lint en este repo
([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]). Por eso los tests de control pesan tanto
como los positivos.
"""
from __future__ import annotations

import json
import logging

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from handler_errores_web import registrar_captura_global


@pytest.fixture()
def cliente() -> TestClient:
    app = FastAPI()
    registrar_captura_global(app)

    @app.get("/revienta")
    def _revienta():  # noqa: ANN202
        raise ConnectionError("la base no responde")

    @app.get("/tipo-nuevo")
    def _tipo_nuevo():  # noqa: ANN202
        class ErrorNuncaVisto(Exception):
            pass
        raise ErrorNuncaVisto("primera vez")

    @app.get("/no-existe-el-recurso")
    def _cuatro_cero_cuatro():  # noqa: ANN202
        raise HTTPException(status_code=404, detail="presupuesto no encontrado")

    @app.get("/ya-facturado")
    def _conflicto():  # noqa: ANN202
        raise HTTPException(status_code=409, detail="ya fue facturado")

    @app.get("/todo-bien")
    def _ok():  # noqa: ANN202
        return {"ok": True}

    # `raise_server_exceptions=False` para que el TestClient devuelva la respuesta del handler en vez
    # de re-lanzar: sin esto se estaría probando el cliente de test, no la costura.
    return TestClient(app, raise_server_exceptions=False)


def _lineas(caplog) -> list[dict]:
    salida = []
    for r in caplog.records:
        try:
            salida.append(json.loads(r.getMessage()))
        except (json.JSONDecodeError, TypeError):
            pass
    return salida


def test_una_excepcion_no_manejada_queda_registrada_y_devuelve_su_codigo(cliente, caplog):
    caplog.set_level(logging.WARNING)

    r = cliente.get("/revienta")

    assert r.status_code == 500
    cuerpo = r.json()
    assert cuerpo["detail"] == "error interno del servidor"
    # El usuario recibe el fingerprint para citarlo, nunca el mensaje de la excepción.
    assert cuerpo["codigo"]
    assert "la base no responde" not in json.dumps(cuerpo)

    (reg,) = _lineas(caplog)
    assert reg["fingerprint"] == cuerpo["codigo"]     # el mismo id de los dos lados
    assert reg["costura"] == "http_handler"
    assert "GET" in reg["workflow"] and "/revienta" in reg["workflow"]
    assert "error_message" not in reg                  # PII / datos fiscales


@pytest.mark.parametrize("ruta, codigo", [("/no-existe-el-recurso", 404), ("/ya-facturado", 409)])
def test_CONTROL_una_respuesta_de_NEGOCIO_no_se_registra_ni_cambia(cliente, caplog, ruta, codigo):
    """404 y 409 son respuestas correctas, no fallos. Si se registraran, el log dejaría de significar
    algo — y encima cambiarles el código rompería a los clientes que ya los manejan."""
    caplog.set_level(logging.WARNING)

    r = cliente.get(ruta)

    assert r.status_code == codigo          # intacto: la costura no se mete
    assert _lineas(caplog) == []            # y no ensucia el log


def test_CONTROL_una_ruta_que_anda_no_registra_nada(cliente, caplog):
    caplog.set_level(logging.WARNING)

    assert cliente.get("/todo-bien").json() == {"ok": True}
    assert _lineas(caplog) == []


def test_un_error_de_tipo_NUEVO_se_marca_en_vez_de_perderse(cliente, caplog):
    caplog.set_level(logging.WARNING)

    assert cliente.get("/tipo-nuevo").status_code == 500

    (reg,) = _lineas(caplog)
    assert reg["categoria"] == "SIN_CATEGORIA"
    assert reg["error_type"] == "ErrorNuncaVisto"


def test_dos_errores_IGUALES_comparten_fingerprint_y_dos_distintos_no(cliente, caplog):
    """El fingerprint es la clave del depósito de la Fase 2: si no discriminara, la DLQ colapsaría
    errores distintos en una sola entrada."""
    caplog.set_level(logging.WARNING)

    a = cliente.get("/revienta").json()["codigo"]
    b = cliente.get("/revienta").json()["codigo"]
    c = cliente.get("/tipo-nuevo").json()["codigo"]

    assert a == b
    assert a != c
