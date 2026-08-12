"""B3/C8 (lote higiene, 2026-08-12): `make_signal_anulacion` aceptaba `payload` y lo descartaba --
llamaba `handle.signal(nombre)` sin el segundo argumento, a diferencia de su gemelo sano
`make_signal_factura`. Nadie lo notó porque ningún signal real de `AnulacionWorkflow` usa payload
todavía (bomba armada, no bug con síntoma). Control negativo: sin el fix, `handle.llamadas` guarda
sólo `(nombre,)` -- este test falla porque el payload nunca llegó, no porque algo explote."""
from __future__ import annotations

import pytest

from web import make_signal_anulacion, make_signal_factura


class _HandleFake:
    def __init__(self):
        self.llamadas = []

    async def signal(self, *args):
        self.llamadas.append(args)


class _ClientFake:
    def __init__(self, handle):
        self._handle = handle

    def get_workflow_handle(self, _wf_id):
        return self._handle


@pytest.mark.asyncio
async def test_signal_anulacion_reenvia_el_payload_no_solo_no_explota():
    handle = _HandleFake()
    signal_anulacion = make_signal_anulacion(_ClientFake(handle))
    payload = {"motivo": "cliente se arrepintió"}

    await signal_anulacion("cid-1", "anu-1", "algun_signal", payload)

    # La aserción que importa: el payload LLEGÓ tal cual, no sólo "no lanzó". Con el bug original,
    # `handle.llamadas` guardaba `("algun_signal",)` -- este assert lo hubiera cazado.
    assert handle.llamadas == [("algun_signal", payload)]


@pytest.mark.asyncio
async def test_signal_anulacion_sin_payload_no_manda_un_none_de_mas():
    handle = _HandleFake()
    signal_anulacion = make_signal_anulacion(_ClientFake(handle))

    await signal_anulacion("cid-1", "anu-1", "cancelar", None)

    assert handle.llamadas == [("cancelar",)]


@pytest.mark.asyncio
async def test_signal_anulacion_y_signal_factura_se_comportan_igual_ante_el_mismo_payload():
    """El contrato pide alinear con el gemelo, no inventar un tercer patrón -- lo verificamos
    comparando ambos comportamientos lado a lado, no leyendo el código a ojo."""
    handle_anulacion, handle_factura = _HandleFake(), _HandleFake()
    signal_anulacion = make_signal_anulacion(_ClientFake(handle_anulacion))
    signal_factura = make_signal_factura(_ClientFake(handle_factura))
    payload = {"campo": "valor"}

    await signal_anulacion("cid-1", "anu-1", "x", payload)
    await signal_factura("cid-1", "fac-1", "x", payload)

    assert handle_anulacion.llamadas == handle_factura.llamadas == [("x", payload)]
