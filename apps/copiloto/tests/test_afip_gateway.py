"""Tests del `AfipGateway` con un cliente falso — sin red, sin token real.

El objetivo no es probar que AfipSDK funciona (eso lo probó el spike contra homologación real): es
probar la **traducción** que hace el gateway entre la respuesta cruda del WS y el contrato del dominio.
Ahí es donde vive el riesgo: el shape real tiene claves en camelCase, formatos de fecha mezclados, y
errores de negocio que no se deben reintentar.
"""
from __future__ import annotations

from datetime import date

import pytest

from afip_gateway import AfipGateway, ErrorAfip, RechazoAfip

TOKEN = "token-de-prueba"


class BillingFake:
    def __init__(self, *, respuesta=None, pdf=None, excepcion=None, info=None):
        self._respuesta = respuesta
        self._pdf = pdf
        self._excepcion = excepcion
        self._info = info
        self.payloads: list[dict] = []

    def createNextVoucher(self, data):  # noqa: N802 - la firma es la del SDK
        self.payloads.append(data)
        if self._excepcion:
            raise self._excepcion
        return self._respuesta

    def createPDF(self, data):  # noqa: N802
        self.payloads.append(data)
        if self._excepcion:
            raise self._excepcion
        return self._pdf

    def getVoucherInfo(self, numero, pto, tipo):  # noqa: N802
        if self._excepcion:
            raise self._excepcion
        return self._info

    def getServerStatus(self):  # noqa: N802
        return {"AppServer": "OK", "DbServer": "OK", "AuthServer": "OK"}

    def getLastVoucher(self, pto, tipo):  # noqa: N802
        return 14680


class ClienteFake:
    def __init__(self, billing):
        self.ElectronicBilling = billing


def gateway(billing) -> AfipGateway:
    return AfipGateway(cuit="20409378472", access_token=TOKEN, cliente_factory=lambda: ClienteFake(billing))


# ---------------------------------------------------------------------------
# Construcción / fail-closed
# ---------------------------------------------------------------------------


def test_sin_token_falla_al_construir(monkeypatch):
    """Fail-closed: sin token no se construye el gateway, no se descubre al primer request."""
    monkeypatch.delenv("AFIP_ACCESS_TOKEN", raising=False)
    with pytest.raises(ErrorAfip, match="AFIP_ACCESS_TOKEN"):
        AfipGateway(cuit="20409378472")


def test_toma_el_token_del_env(monkeypatch):
    monkeypatch.setenv("AFIP_ACCESS_TOKEN", TOKEN)
    assert AfipGateway(cuit="20409378472") is not None


# ---------------------------------------------------------------------------
# Emisión — el shape real del WS
# ---------------------------------------------------------------------------


def test_emitir_lee_voucher_number_en_camel_case():
    """La doc dice `voucher_number`; el WS devuelve `voucherNumber`. Vale el shape del servicio."""
    billing = BillingFake(respuesta={"CAE": "86290616997729", "CAEFchVto": "2026-07-31", "voucherNumber": 14681})
    res = gateway(billing).emitir({"CbteTipo": 11})
    assert res.cae == "86290616997729"
    assert res.numero == 14681
    assert res.cae_vto == date(2026, 7, 31)


def test_emitir_acepta_tambien_snake_case_por_compatibilidad():
    billing = BillingFake(respuesta={"CAE": "1", "CAEFchVto": "2026-07-31", "voucher_number": 7})
    assert gateway(billing).emitir({}).numero == 7


def test_emitir_con_respuesta_vacia_falla_ruidoso():
    """Un vacío no se interpreta como éxito: sin CAE no hay factura."""
    with pytest.raises(ErrorAfip, match="vacía"):
        gateway(BillingFake(respuesta=None)).emitir({})


def test_emitir_con_respuesta_incompleta_falla_ruidoso():
    billing = BillingFake(respuesta={"CAE": "123"})  # sin número ni vencimiento
    with pytest.raises(ErrorAfip, match="incompleta"):
        gateway(billing).emitir({})


@pytest.mark.parametrize("codigo", ["(10016)", "(10243)", "(11002)"])
def test_rechazo_de_negocio_no_es_reintentable(codigo):
    """ADVERSARIAL: un rechazo de AFIP tiene que salir como `RechazoAfip`, no como error técnico.

    Si sale como `ErrorAfip`, la retry policy de la activity lo reintenta contra un rechazo permanente
    — el mismo patrón que en PR #114 colgó el chat con retries infinitos.
    """
    billing = BillingFake(excepcion=Exception(f"{codigo} el comprobante no es correlativo"))
    with pytest.raises(RechazoAfip):
        gateway(billing).emitir({})


def test_error_de_transporte_si_es_reintentable():
    billing = BillingFake(excepcion=Exception("connection reset by peer"))
    with pytest.raises(ErrorAfip):
        gateway(billing).emitir({})


def test_el_payload_llega_intacto_al_ws():
    """El gateway no reescribe reglas fiscales: pasa lo que `afip_rules` armó."""
    billing = BillingFake(respuesta={"CAE": "1", "CAEFchVto": "2026-07-31", "voucherNumber": 1})
    payload = {"CbteTipo": 11, "CondicionIVAReceptorId": 5, "DocTipo": 99, "MonId": "PES"}
    gateway(billing).emitir(payload)
    assert billing.payloads[0] == payload


# ---------------------------------------------------------------------------
# Fechas — el WS mezcla formatos
# ---------------------------------------------------------------------------


def test_parsea_vencimiento_en_formato_yyyymmdd():
    billing = BillingFake(respuesta={"CAE": "1", "CAEFchVto": "20260731", "voucherNumber": 1})
    assert gateway(billing).emitir({}).cae_vto == date(2026, 7, 31)


# ---------------------------------------------------------------------------
# Check-before-act
# ---------------------------------------------------------------------------


def test_existe_comprobante_true_cuando_afip_lo_tiene():
    billing = BillingFake(info={"ResultGet": {"CbteDesde": 14679, "Resultado": "A"}})
    assert gateway(billing).existe_comprobante(numero=14679, punto_venta=1, tipo_cbte=11)


def test_existe_comprobante_false_cuando_no_hay_nada():
    assert not gateway(BillingFake(info={})).existe_comprobante(numero=1, punto_venta=1, tipo_cbte=11)


def test_existe_comprobante_no_explota_si_el_ws_falla():
    """Ante un error de consulta devuelve False: el llamador decide, no se aborta la emisión por esto.

    ⚠️ DEUDA CONOCIDA (plan de errores §Fase 0, item 0.1d): este `False` es **fail-open** — el
    llamador lo lee como "no existe" y reemite. Este test hoy CONFIRMA ese comportamiento en vez de
    vigilarlo. Se invierte cuando 0.1d pase a bloqueante, tras el baseline sin falsos positivos
    (criterio adoptado de ARCA `12_DUAL_CHECK:139`). Propietario: BACKEND.
    """
    billing = BillingFake(excepcion=Exception("timeout"))
    assert not gateway(billing).existe_comprobante(numero=1, punto_venta=1, tipo_cbte=11)


def test_info_comprobante_devuelve_result_get_plano():
    billing = BillingFake(info={"ResultGet": {"Resultado": "A", "CodAutorizacion": "123"}})
    info = gateway(billing).info_comprobante(numero=1, punto_venta=1, tipo_cbte=11)
    assert info["Resultado"] == "A"
    assert info["CodAutorizacion"] == "123"


def test_info_comprobante_soporta_result_get_como_LISTA():
    """El WS no es consistente: `ResultGet` puede venir como lista.

    Antes se devolvía `{}` ante esta forma — y `{}` lo lee el check-before-act como "el comprobante
    no existe", habilitando una SEGUNDA emisión sobre una respuesta perfectamente válida de AFIP.
    """
    billing = BillingFake(info={"ResultGet": [{"Resultado": "A", "CodAutorizacion": "123"}]})
    info = gateway(billing).info_comprobante(numero=1, punto_venta=1, tipo_cbte=11)
    assert info["CodAutorizacion"] == "123"


def test_existe_comprobante_true_con_result_get_como_LISTA():
    """El corolario del anterior sobre el guard: una lista no puede leerse como ausencia."""
    billing = BillingFake(info={"ResultGet": [{"CbteDesde": 14679, "Resultado": "A"}]})
    assert gateway(billing).existe_comprobante(numero=14679, punto_venta=1, tipo_cbte=11)


def test_info_comprobante_soporta_respuesta_sin_envoltorio():
    """Algunas respuestas llegan ya planas, sin la clave `ResultGet`."""
    billing = BillingFake(info={"Resultado": "A", "CodAutorizacion": "123"})
    assert gateway(billing).info_comprobante(numero=1, punto_venta=1, tipo_cbte=11)["CodAutorizacion"] == "123"


def test_info_comprobante_lista_vacia_es_ausencia_real():
    """Control negativo: una lista VACÍA sí es ausencia — el fix no debe inventar un comprobante."""
    billing = BillingFake(info={"ResultGet": []})
    assert gateway(billing).info_comprobante(numero=1, punto_venta=1, tipo_cbte=11) == {}
    assert not gateway(billing).existe_comprobante(numero=1, punto_venta=1, tipo_cbte=11)


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------


def test_generar_pdf_devuelve_url():
    billing = BillingFake(pdf={"file": "https://s3/x.pdf", "file_name": "factura", "file_expiration": None})
    res = gateway(billing).generar_pdf(template="invoice-c", params={"cae": "1"}, nombre_archivo="factura")
    assert res.url == "https://s3/x.pdf"


def test_generar_pdf_sin_url_falla():
    with pytest.raises(ErrorAfip, match="no devolvió URL"):
        gateway(BillingFake(pdf={})).generar_pdf(template="invoice-c", params={}, nombre_archivo="x")


def test_generar_pdf_arma_el_cuerpo_con_template_y_params():
    billing = BillingFake(pdf={"file": "https://s3/x.pdf"})
    gateway(billing).generar_pdf(template="invoice-c", params={"cae": "9"}, nombre_archivo="f1")
    cuerpo = billing.payloads[0]
    assert cuerpo["template"]["name"] == "invoice-c"
    assert cuerpo["template"]["params"] == {"cae": "9"}
    assert cuerpo["file_name"] == "f1"
