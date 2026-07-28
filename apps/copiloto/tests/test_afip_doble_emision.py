"""La autorización perdida: AFIP autorizó, la respuesta no llegó, y el reintento emite OTRA factura.

Es el peor fallo del sistema —dos comprobantes con CAE real ante el fisco por un solo pedido, que
sólo se arregla con una nota de crédito— y el guard que decía cubrirlo no podía hacerlo.

El guard hacía `siguiente = ultimo_autorizado + 1` y preguntaba si **ese** existía. Pero
`ultimo_autorizado` es `getLastVoucher`, que refleja lo que AFIP ya autorizó:

    intento 1:  getLastVoucher = 10  ->  siguiente = 11  ->  no existe  ->  emite
                AFIP AUTORIZA EL 11  ->  se corta la red  ->  no se registra  ->  la activity lanza
    reintento:  getLastVoucher = 11  ->  siguiente = 12  ->  no existe (correcto)  ->  EMITE EL 12

La pregunta era tautológicamente negativa: el número siguiente, por construcción, nunca fue emitido.
El fix mueve la decisión del número al workflow, que es durable y no recalcula, de modo que el
reintento interroga **el mismo número que intentó** — la única pregunta capaz de detectar la
autorización perdida.
"""
from __future__ import annotations

import afip_factura_activities as act

CUIT = "20269996065"
PAYLOAD = {"PtoVta": 1, "CbteTipo": 11, "DocTipo": 96, "DocNro": "20111111112",
           "ImpTotal": 100.0, "CbteFch": "20260721"}


class StoreVacio:
    """La base NO tiene el comprobante: es justo el estado tras la autorización perdida."""

    def __init__(self) -> None:
        self.registrado: dict = {}

    def por_idem_key(self, idem_key):
        return None            # nunca se registró — la capa 1 no puede ayudar

    def registrar(self, **kw):
        self.registrado = kw
        return 4242


class GatewayAutorizacionPerdida:
    """AFIP ya autorizó el 11 y su contador lo refleja; nosotros no lo registramos.

    `emitir` cuenta las emisiones en vez de fallar: así el test mide el DAÑO (cuántas facturas se
    emitieron) y no una excepción intermedia.
    """

    def __init__(self) -> None:
        self.emisiones: list[int] = []

    def ultimo_comprobante(self, *, punto_venta, tipo_cbte):
        return 11                                   # AFIP ya cuenta el 11 que autorizó

    def existe_comprobante(self, *, numero, punto_venta, tipo_cbte):
        return numero == 11                         # sólo el 11 existe

    def info_comprobante(self, *, numero, punto_venta, tipo_cbte):
        if numero != 11:
            return {}
        return {"CodAutorizacion": "CAE-DEL-11", "FchVto": "20260801", "CbteFch": "20260721"}

    def emitir(self, payload):
        nro = 12 + len(self.emisiones)
        self.emisiones.append(nro)

        class Res:
            cae = f"CAE-NUEVO-{nro}"
            numero = nro
            resultado = "A"

            class cae_vto:  # noqa: N801
                @staticmethod
                def isoformat():
                    return "2026-08-01"

        return Res()


def _cablear(monkeypatch, store, gateway):
    monkeypatch.setattr(act, "_comprobante_store_factory", lambda cid: store)
    monkeypatch.setattr(act, "_cred_store_factory",
                        lambda cid: type("C", (), {"get": lambda self, c: {"cert": "x", "key": "y"}})())
    monkeypatch.setattr(act, "_gateway_factory", lambda *a, **k: gateway)


def test_el_reintento_con_numero_RESERVADO_adopta_en_vez_de_emitir_de_nuevo(monkeypatch):
    """EL TEST QUE IMPORTA. Con el número que el workflow reservó, el reintento pregunta por el 11
    —el que realmente intentó— lo encuentra autorizado, y lo adopta. Cero emisiones nuevas."""
    store, gw = StoreVacio(), GatewayAutorizacionPerdida()
    _cablear(monkeypatch, store, gw)

    resultado = act._emitir_sync("t1", CUIT, PAYLOAD, "idem-1", "wf-1", "Juan Pérez",
                                 nro_reservado=11)

    assert gw.emisiones == [], "se emitió una SEGUNDA factura sobre una autorización que ya existía"
    assert resultado["duplicado"] is True
    assert resultado["cae"] == "CAE-DEL-11"
    assert resultado["nro"] == 11
    assert store.registrado["nro"] == 11, "hay que registrar el comprobante REAL, no uno nuevo"


def test_control_sin_numero_reservado_el_guard_NO_puede_detectarlo(monkeypatch):
    """CONTROL DIFERENCIAL — este test documenta el bug, no lo arregla.

    Sin el número reservado, la activity recalcula `getLastVoucher + 1` = 12, pregunta por el 12
    (que nunca se emitió), le dicen "no existe", y emite. Es el camino viejo, y se deja verde a
    propósito: si algún día empezara a fallar, significa que alguien cambió el camino de compatibilidad
    del que dependen las ejecuciones en vuelo (ver `workflow.patched("reservar-nro-antes-de-emitir")`).
    """
    store, gw = StoreVacio(), GatewayAutorizacionPerdida()
    _cablear(monkeypatch, store, gw)

    act._emitir_sync("t1", CUIT, PAYLOAD, "idem-2", "wf-2", "Juan Pérez")   # sin nro_reservado

    assert gw.emisiones == [12], "el camino viejo emite el 12: es exactamente la doble emisión"


def test_el_numero_reservado_se_usa_tal_cual_aunque_afip_no_lo_tenga(monkeypatch):
    """Control positivo del camino feliz: si el número reservado NO está autorizado, se emite ese
    mismo número — reservar no debe cambiar el comportamiento cuando no hubo autorización perdida."""
    store = StoreVacio()

    class GatewayLimpio(GatewayAutorizacionPerdida):
        def existe_comprobante(self, *, numero, punto_venta, tipo_cbte):
            return False                              # nada autorizado todavía

    gw = GatewayLimpio()
    _cablear(monkeypatch, store, gw)

    resultado = act._emitir_sync("t1", CUIT, PAYLOAD, "idem-3", "wf-3", "Juan Pérez",
                                 nro_reservado=11)

    assert len(gw.emisiones) == 1, "tenía que emitir exactamente una vez"
    assert resultado["duplicado"] is False


def test_reservar_numero_es_el_siguiente_al_ultimo_autorizado(monkeypatch):
    """La activity de reserva es read-only y devuelve `último + 1`."""
    gw = GatewayAutorizacionPerdida()
    monkeypatch.setattr(act, "_cred_store_factory",
                        lambda cid: type("C", (), {"get": lambda self, c: {"cert": "x", "key": "y"}})())
    monkeypatch.setattr(act, "_gateway_factory", lambda *a, **k: gw)

    assert act._reservar_numero_sync("t1", CUIT, 1, 11) == 12
    assert gw.emisiones == [], "reservar no puede emitir nada"
