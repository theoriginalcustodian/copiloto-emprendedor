"""Las 6 fábricas de `web.py` piden el workflow id **derivado del token**, no el id del request.

Es el control que el repo pagó más caro en su historia: ADR-013 §3.3.4 especificó un guard
cross-tenant, el código nunca lo codificó, y el drift vivió ~2 meses en prod (BOLA / OWASP
API1:2023) porque ningún test probó «A pide lo de B». Acá el guard **sí** está codificado —las 6
fábricas llaman `_wf_id_factura(cliente_id, …)` / `_wf_id_anulacion(cliente_id, …)`, verificado
línea por línea— y lo que faltaba era el test que lo ejerce **sobre el código de producción**.

Por qué los tests que ya existen no lo cubren, y es sutil:

- `test_afip_web_facturas.py:131,168,187,201` son adversariales de verdad, pero contra un `Espia`
  (`:35-64`) que **re-compone el id por su cuenta** con el mismo helper. Prueban el contrato del
  espía, no el wiring de `web.py`: si una fábrica real dejara de pasar el `cliente_id`, el espía
  seguiría respondiendo bien y el test seguiría verde.
- `test_afip_web_facturas.py:149` afirma el helper (`_wf_id_factura("t1","f1") == "factura-t1-f1"`).
  Ese control existe y es correcto — pero un helper correcto que **nadie llama** da verde igual.
- Los tests que sí llaman las fábricas reales usan fakes que **descartan** el id:
  `test_consultar_estado_503.py:40` (`get_workflow_handle(self, wid)  # noqa: ARG002`),
  `test_signal_anulacion_reenvia_payload.py:25`, `test_afip_alta_fallida.py:74`.

O sea: estaban cubiertos el helper y el espía, y **no la costura entre los dos**
(`memoria/el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar.md`). El modo de falla
concreto que esto caza: si `make_consultar_factura` pasara `factura_id` crudo como workflow id, un
tenant operaría la factura de otro adivinando el id, y **ningún test de la suite se pondría rojo**.

El docstring de `_wf_id_factura` (`web.py:241-245`) ya afirma «el prefijo sale SIEMPRE del token,
nunca del request». Este archivo es lo que convierte esa afirmación en un control
(`memoria/el-guard-se-satisface-con-su-propio-comentario.md`).
"""
from __future__ import annotations

import asyncio

import pytest

from web import (
    make_confirmar_anulacion,
    make_confirmar_factura,
    make_consultar_anulacion,
    make_consultar_factura,
    make_signal_anulacion,
    make_signal_factura,
)

TENANT_A = "tenant-aaa"
TENANT_B = "tenant-bbb"
RECURSO = "rec-123"


class _HandleFake:
    """No simula el workflow: lo único medido es el id con el que se pidió el handle.

    Cada método devuelve algo inocuo porque la fábrica sigue su camino después de pedir el handle, y
    si explotara perderíamos el registro del id — que es justo el dato que buscamos.
    """

    async def describe(self):
        raise RuntimeError("sin workflow real: irrelevante para el id")

    async def signal(self, *a, **k):
        return None

    async def execute_update(self, *a, **k):
        return {}

    async def query(self, *a, **k):
        return None


class _ClienteEspia:
    """Registra el id EXACTO que la fábrica le pide. No lo reconstruye: eso sería circular."""

    def __init__(self) -> None:
        self.pedidos: list[str] = []

    def get_workflow_handle(self, wid, *a, **k):
        self.pedidos.append(wid)
        return _HandleFake()


# (fábrica, args extra tras (cliente_id, recurso_id), prefijo esperado)
FABRICAS = [
    (make_consultar_factura,   (),                   "factura"),
    (make_confirmar_factura,   ("tok-x",),           "factura"),
    (make_signal_factura,      ("nombre", {"a": 1}), "factura"),
    (make_confirmar_anulacion, (),                   "anulacion"),
    (make_consultar_anulacion, (),                   "anulacion"),
    (make_signal_anulacion,    ("nombre", {"a": 1}), "anulacion"),
]
IDS = [f.__name__ for f, _, _ in FABRICAS]


def _pedir(fabrica, cliente_id: str, extra: tuple) -> list[str]:
    espia = _ClienteEspia()
    fn = fabrica(espia)
    try:
        asyncio.run(fn(cliente_id, RECURSO, *extra))
    except Exception:
        # El handle fake no simula un workflow: lo que importa ya quedó registrado al pedirlo.
        pass
    return espia.pedidos


@pytest.mark.parametrize("fabrica,extra,prefijo", FABRICAS, ids=IDS)
def test_el_id_pedido_lleva_el_cliente_id(fabrica, extra, prefijo):
    """El id es literal y sale del primer argumento, que en producción es el `cliente_id` del token."""
    pedidos = _pedir(fabrica, TENANT_A, extra)
    assert pedidos == [f"{prefijo}-{TENANT_A}-{RECURSO}"], (
        f"{fabrica.__name__} pidió {pedidos!r}. Si el id no lleva el cliente_id, un tenant opera el "
        f"recurso de otro adivinando el id (BOLA / OWASP API1:2023, el caso raíz de ADR-013)"
    )


@pytest.mark.parametrize("fabrica,extra,prefijo", FABRICAS, ids=IDS)
def test_ADVERSARIAL_dos_tenants_con_el_MISMO_recurso_id_piden_ids_DISTINTOS(fabrica, extra, prefijo):
    """El caso hostil: A y B piden el mismo `recurso_id`.

    Es la forma que importa. Un test que sólo afirme el literal de A pasaría igual si la fábrica
    ignorara el `cliente_id` y usara una constante; este exige que los dos tenants **difieran**, que
    es lo que hace al id inalcanzable para el ajeno.
    """
    de_a = _pedir(fabrica, TENANT_A, extra)
    de_b = _pedir(fabrica, TENANT_B, extra)
    assert de_a and de_b and de_a != de_b, (
        f"{fabrica.__name__}: A pidió {de_a!r} y B pidió {de_b!r}. Iguales significa que el id no "
        f"depende del tenant y el aislamiento no existe"
    )
    assert TENANT_A in de_a[0] and TENANT_A not in de_b[0]


def test_CONTROL_POSITIVO_el_espia_registra_de_verdad():
    """Sin esto, los de arriba no distinguen «el id es correcto» de «el espía nunca se usó».

    Un `_ClienteEspia` que no registrara nada dejaría `pedidos == []`, y un `assert pedidos == [...]`
    con la lista vacía del lado izquierdo fallaría — pero el `!=` del adversarial de dos tenants
    pasaría con dos listas vacías si no se le exigiera `de_a and de_b`. Esto lo cierra de frente.
    """
    espia = _ClienteEspia()
    assert espia.pedidos == []
    espia.get_workflow_handle("id-de-prueba")
    assert espia.pedidos == ["id-de-prueba"]
