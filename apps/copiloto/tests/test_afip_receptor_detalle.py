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

    ID_FILA = 4242

    def __init__(self, dedup: dict | None = None) -> None:
        self.registrado: dict = {}
        self.dedup = dedup   # si está, `por_idem_key` lo devuelve (simula el reintento post-éxito)

    def por_idem_key(self, idem_key):
        return self.dedup

    def registrar(self, **kw):
        self.registrado = kw
        # El real devuelve el `id` de fila (fresco o el que ya estaba); la activity lo expone en su
        # resultado. Sin esto, `comprobante_id` sería None y la card de éxito no podría cobrar.
        return self.ID_FILA


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


# ── el pedido_ de FRONTEND: el `id` de fila viaja en el resultado del workflow ────────────────────

def test_el_resultado_de_una_emision_fresca_trae_el_id_de_fila(monkeypatch):
    """La card de éxito necesita el `id` para ofrecer «¿ya la cobraste?» (`/afip/comprobantes/{id}/cobros`).
    Sin él, `ResultadoEmision.id` es null y la sección de cobro no se dibuja. El id sale de `registrar`."""
    store = StoreEspia()
    _cablear(monkeypatch, store)

    resultado = act._emitir_sync("t1", CUIT, PAYLOAD, "idem-fresca", "wf-1", "Juan Pérez")

    assert resultado["duplicado"] is False
    assert resultado["id"] == StoreEspia.ID_FILA


def test_el_reintento_post_exito_tambien_trae_el_id(monkeypatch):
    """El camino de dedup (`por_idem_key` encuentra el comprobante ya emitido) también expone el `id`:
    si el usuario reintenta y cae en el dedup, la card sigue pudiendo ofrecer el cobro."""
    ya_emitido = {"id": 99, "cae": "X", "nro": 8, "tipo_cbte": 11, "punto_venta": 1,
                  "receptor_nombre": "Juan Pérez"}
    store = StoreEspia(dedup=ya_emitido)
    _cablear(monkeypatch, store)

    resultado = act._emitir_sync("t1", CUIT, PAYLOAD, "idem-repetida", "wf-1", "Juan Pérez")

    assert resultado["duplicado"] is True
    assert resultado["id"] == 99
