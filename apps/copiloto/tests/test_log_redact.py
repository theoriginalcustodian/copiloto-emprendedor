import logging

from log_redact import RedactarQueryFilter, instalar, redactar


def test_enmascara_cuit_y_conserva_el_resto():
    assert redactar("/afip/comprobantes?cuit=20123456789&limite=10") == "/afip/comprobantes?cuit=***&limite=10"
    assert redactar("/afip/estado?x=1&CUIT=27111111113") == "/afip/estado?x=1&CUIT=***"


def test_sin_query_sensible_no_cambia():
    assert redactar("/health") == "/health"


def test_filtro_sobre_registro_real_de_uvicorn_access():
    rec = logging.LogRecord("uvicorn.access", logging.INFO, "", 0,
                            '%s - "%s %s HTTP/%s" %d',
                            ("1.2.3.4:5", "GET", "/afip/estado?cuit=20123456789", "1.1", 200), None)
    assert RedactarQueryFilter().filter(rec) is True
    assert "20123456789" not in rec.getMessage() and "cuit=***" in rec.getMessage()


def test_control_negativo_sin_filtro_el_cuit_se_ve():
    rec = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, "%s", ("/afip/estado?cuit=20123456789",), None)
    assert "20123456789" in rec.getMessage()


def test_instalar_es_idempotente():
    instalar(); instalar()
    n = sum(isinstance(f, RedactarQueryFilter) for f in logging.getLogger("uvicorn.access").filters)
    assert n == 1
