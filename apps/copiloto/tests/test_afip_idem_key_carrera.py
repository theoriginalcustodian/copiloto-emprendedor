"""FACTID: dos ejecuciones concurrentes con la MISMA `idem_key` chocan contra el índice único.

Medido contra Postgres real en el spike (`spikes/afip-idem-carrera-real/RESULT.md`, `threading.Barrier`):
entre el `por_idem_key` de arriba y el `INSERT` no hay lock, así que dos ejecuciones pueden pasar el
chequeo ANTES de que cualquiera registre. Antes de este fix, la perdedora levantaba `UniqueViolation`
sin clasificar: quedaba como activity failure, Temporal la reintentaba con el MISMO `nro_reservado`, y
el reintento volvía a chocar contra el MISMO índice indefinidamente — el comprobante real de esa
ejecución (ya emitido en AFIP o adoptado) quedaba huérfano, invisible en "mis facturas".

Este test no reproduce la concurrencia con threads (eso ya lo hizo el spike contra Postgres real) sino
que fuerza el mismo efecto con un store falso que simula la carrera perdida: la PRIMERA llamada a
`registrar()` levanta `UniqueViolation` (alguien más ya ganó con esa `idem_key`), la segunda —sin
`idem_key`— tiene que tener éxito.
"""
from __future__ import annotations

import psycopg2

import afip_factura_activities as act

CUIT = "20269996065"
PAYLOAD = {"PtoVta": 1, "CbteTipo": 11, "DocTipo": 96, "DocNro": "20111111112",
           "ImpTotal": 100.0, "CbteFch": "20260721"}


class StoreCarreraPerdida:
    """Simula perder la carrera del índice único `afip_comprobantes_idem` una sola vez."""

    def __init__(self) -> None:
        self.llamadas: list[dict] = []
        self._primera = True

    def por_idem_key(self, idem_key):
        return None                                   # la capa 1 no la ve: la ganadora se la llevó

    def registrar(self, **kw):
        self.llamadas.append(kw)
        if self._primera and kw.get("idem_key") is not None:
            self._primera = False
            raise psycopg2.errors.UniqueViolation("duplicate key value violates unique constraint "
                                                   '"afip_comprobantes_idem"')
        return 9001


class GatewayEmiteUnaVez:
    """AFIP emite normalmente — la carrera es puramente de la capa de base, no de AFIP."""

    def ultimo_comprobante(self, *, punto_venta, tipo_cbte):
        return 10

    def existe_comprobante(self, *, numero, punto_venta, tipo_cbte):
        return False

    def emitir(self, payload):
        class Res:
            cae = "CAE-CARRERA-11"
            numero = 11
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


def test_la_perdedora_de_la_carrera_no_pierde_su_comprobante_real(monkeypatch):
    """EL TEST QUE IMPORTA. `UniqueViolation` no puede escapar como activity failure sin clasificar:
    el comprobante YA fue emitido en AFIP (efecto real, irreversible) y tiene que quedar registrado,
    aunque sea sin `idem_key` porque esa clave ya la tiene la ganadora."""
    store, gw = StoreCarreraPerdida(), GatewayEmiteUnaVez()
    _cablear(monkeypatch, store, gw)

    resultado = act._emitir_sync("t1", CUIT, PAYLOAD, "idem-carrera", "wf-perdedora", "Juan Pérez",
                                 nro_reservado=11)

    assert resultado["ok"] is True
    assert resultado["id"] == 9001, "el comprobante real tiene que quedar registrado, no perderse"
    assert resultado["alerta_doble_emision"] is True
    assert len(store.llamadas) == 2, "primer intento choca, segundo reintenta sin idem_key"
    assert store.llamadas[0]["idem_key"] == "idem-carrera"
    assert store.llamadas[1]["idem_key"] is None


def test_sin_carrera_el_camino_limpio_no_cambia(monkeypatch):
    """Control diferencial: sin colisión, una sola llamada a `registrar()`, sin alerta."""
    store, gw = StoreCarreraPerdida(), GatewayEmiteUnaVez()
    store._primera = False                            # desactiva la colisión simulada
    _cablear(monkeypatch, store, gw)

    resultado = act._emitir_sync("t1", CUIT, PAYLOAD, "idem-limpio", "wf-limpia", "Juan Pérez",
                                 nro_reservado=11)

    assert resultado["alerta_doble_emision"] is False
    assert len(store.llamadas) == 1
    assert store.llamadas[0]["idem_key"] == "idem-limpio"
