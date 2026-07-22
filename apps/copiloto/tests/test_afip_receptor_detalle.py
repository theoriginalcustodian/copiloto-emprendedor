"""El detalle de una factura tiene que decir A QUIÉN se le facturó.

El WSFE identifica al receptor por tipo y número de documento; el nombre no viaja en el comprobante.
Por eso no quedaba registrado en ningún lado, y el listado ni siquiera devolvía el documento: la
pantalla de detalle sólo podía mostrar número, importe y CAE — nunca "Juan Pérez".
"""
from __future__ import annotations

import afip_factura_activities as act

CUIT = "20269996065"


class StoreEspia:
    """Registra lo que se le pidió guardar y devuelve filas como las que arma el SELECT real."""

    def __init__(self) -> None:
        self.registrado: dict = {}

    def por_idem_key(self, idem_key):
        return None

    def registrar(self, **kw):
        self.registrado = kw


class GatewayFake:
    def ultimo_comprobante(self, *, punto_venta, tipo_cbte):
        return 7

    def existe_comprobante(self, *, numero, punto_venta, tipo_cbte):
        return False

    def emitir(self, payload):
        class Res:
            cae = "86290621776472"
            numero = 8
            resultado = "A"

            class cae_vto:  # noqa: N801
                @staticmethod
                def isoformat():
                    return "2026-08-01"

        return Res()


PAYLOAD = {"PtoVta": 1, "CbteTipo": 11, "DocTipo": 96, "DocNro": "20111111112",
           "ImpTotal": 100.0, "CbteFch": "20260721"}


def _cablear(monkeypatch, store):
    monkeypatch.setattr(act, "_comprobante_store_factory", lambda cid: store)
    monkeypatch.setattr(act, "_cred_store_factory",
                        lambda cid: type("C", (), {"get": lambda self, c: {"cert": "x", "key": "y"}})())
    monkeypatch.setattr(act, "_gateway_factory", lambda *a, **k: GatewayFake())


def test_el_nombre_del_receptor_se_persiste(monkeypatch):
    store = StoreEspia()
    _cablear(monkeypatch, store)

    act._emitir_sync("t1", CUIT, PAYLOAD, "idem-1", "wf-1", "Juan Pérez")

    assert store.registrado["receptor_nombre"] == "Juan Pérez"
    assert store.registrado["doc_tipo"] == 96
    assert store.registrado["doc_nro"] == "20111111112"


def test_sin_nombre_se_guarda_null_no_cadena_vacia(monkeypatch):
    """`""` y `NULL` se ven igual en un `if` de Python pero no en la base ni en un `COALESCE`. Una
    venta a consumidor final sin nombre es ausencia de dato, no un nombre vacío."""
    store = StoreEspia()
    _cablear(monkeypatch, store)

    act._emitir_sync("t1", CUIT, PAYLOAD, "idem-2", "wf-2", "")

    assert store.registrado["receptor_nombre"] is None


def test_la_firma_vieja_sigue_andando(monkeypatch):
    """Las ejecuciones que arrancaron antes de este cambio replayan con 5 argumentos: si el parámetro
    no tuviera default, el replay las rompería."""
    store = StoreEspia()
    _cablear(monkeypatch, store)

    act._emitir_sync("t1", CUIT, PAYLOAD, "idem-3", "wf-3")

    assert store.registrado["receptor_nombre"] is None
    assert store.registrado["cae"] == "86290621776472"
