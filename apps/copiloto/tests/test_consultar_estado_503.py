""""No encontrada" y "no pude preguntar" eran la misma respuesta, y una de las dos es mentira.

`consultar_factura` y `consultar_anulacion` tenían un `except Exception: return None`, y el endpoint
traduce `None` a **404**. Un 404 es definitivo: el cliente deja de reintentar y le dice al usuario
que su factura no existe. Si lo que falló fue el cluster de Temporal —un restart, un timeout de red,
un deadline— esa factura existe, se está emitiendo, y acabamos de darle al usuario la única respuesta
que garantiza que nadie vuelva a mirar.

Ahora sólo `NOT_FOUND` significa "no existe". Todo lo demás es 503, que invita a reintentar.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from temporalio.service import RPCError, RPCStatusCode

from web import make_consultar_anulacion, make_consultar_factura

ESTADO = {"paso": "emitiendo", "terminado": False}


def _rpc(status: RPCStatusCode) -> RPCError:
    return RPCError("simulado", status, b"")


class _Handle:
    def __init__(self, *, exc: BaseException | None = None, estado: dict | None = None) -> None:
        self._exc, self._estado = exc, estado

    async def query(self, nombre: str):  # noqa: ARG002
        if self._exc is not None:
            raise self._exc
        return self._estado


class _Client:
    def __init__(self, handle: _Handle) -> None:
        self._handle = handle

    def get_workflow_handle(self, wid: str):  # noqa: ARG002
        return self._handle


@pytest.mark.asyncio
async def test_temporal_caido_da_503_y_no_404():
    """EL TEST QUE IMPORTA: el error recuperable no puede presentarse como definitivo."""
    consultar = make_consultar_factura(_Client(_Handle(exc=_rpc(RPCStatusCode.UNAVAILABLE))))

    with pytest.raises(HTTPException) as exc:
        await consultar("t1", "f1")

    assert exc.value.status_code == 503, "un cluster caído se reportaba como 'factura no encontrada'"


@pytest.mark.asyncio
async def test_control_la_factura_que_NO_existe_sigue_dando_404():
    """Control diferencial. Si esto empezara a dar 503, el fix habría roto el 404 legítimo — y una
    factura de otro tenant (cuyo workflow id no existe) dejaría de contestar 404."""
    consultar = make_consultar_factura(_Client(_Handle(exc=_rpc(RPCStatusCode.NOT_FOUND))))

    assert await consultar("t1", "f-inexistente") is None


@pytest.mark.asyncio
async def test_una_query_que_falla_por_replay_tampoco_es_un_404():
    """El workflow EXISTE pero su query no se puede ejecutar (el código cambió y el history ya no
    replaya). Decir "no encontrada" ahí es falso: hay que decir que no se pudo leer."""
    consultar = make_consultar_factura(_Client(_Handle(exc=RuntimeError("query failed"))))

    with pytest.raises(HTTPException) as exc:
        await consultar("t1", "f1")

    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_control_positivo_el_camino_feliz_devuelve_el_estado():
    """Sin esto, un `consultar` que siempre levantara pasaría los tres tests de arriba."""
    consultar = make_consultar_factura(_Client(_Handle(estado=ESTADO)))

    assert await consultar("t1", "f1") == ESTADO


@pytest.mark.asyncio
async def test_la_anulacion_tiene_el_mismo_criterio():
    consultar = make_consultar_anulacion(_Client(_Handle(exc=_rpc(RPCStatusCode.DEADLINE_EXCEEDED))))
    with pytest.raises(HTTPException) as exc:
        await consultar("t1", "a1")
    assert exc.value.status_code == 503

    ok = make_consultar_anulacion(_Client(_Handle(exc=_rpc(RPCStatusCode.NOT_FOUND))))
    assert await ok("t1", "a1") is None
