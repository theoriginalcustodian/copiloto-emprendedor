"""FACTID: `make_iniciar_factura` con `idem_key` de cliente deriva `factura_id` DETERMINÍSTICO.

Sin `idem_key` (retrocompatible), `factura_id = uuid.uuid4().hex` — distinto en cada llamada, y
`USE_EXISTING` no protege nada contra un id que nunca puede repetirse: dos toques reales (doble click,
reintento de red, dos pestañas) abrían DOS workflows y podían emitir DOS facturas AFIP con CAE real
(spike FACTID, `spikes/afip-idem-carrera-real/RESULT.md`). Con `idem_key`, el segundo toque con la
MISMA clave no abre un workflow nuevo: adopta el que ya existe, igual que
`make_abrir_borrador_de_presupuesto`.
"""
from __future__ import annotations

import pytest
from temporalio.common import WorkflowIDConflictPolicy
from temporalio.exceptions import WorkflowAlreadyStartedError

from web import make_iniciar_factura

CLIENTE = "cid-A"
CUIT = "20111111112"


class _TemporalClientFake:
    """Simula el servidor: la MISMA `id` con `id_conflict_policy=FAIL` rechaza el segundo arranque."""

    def __init__(self) -> None:
        self.arranques: list[dict] = []
        self._vivos: set[str] = set()

    async def start_workflow(self, workflow_type, *, args, id, task_queue, id_conflict_policy):
        self.arranques.append({"id": id, "id_conflict_policy": id_conflict_policy})
        if id in self._vivos and id_conflict_policy == WorkflowIDConflictPolicy.FAIL:
            raise WorkflowAlreadyStartedError(id, workflow_type)
        self._vivos.add(id)


@pytest.mark.asyncio
async def test_sin_idem_key_cada_llamada_abre_un_workflow_distinto():
    """Control diferencial: preserva el comportamiento viejo, id aleatorio, USE_EXISTING."""
    client = _TemporalClientFake()
    iniciar = make_iniciar_factura(client)

    f1 = await iniciar(CLIENTE, CUIT)
    f2 = await iniciar(CLIENTE, CUIT)

    assert f1 != f2, "sin idem_key, dos toques siguen abriendo dos workflows -- comportamiento viejo"
    assert len(client.arranques) == 2
    assert all(a["id_conflict_policy"] == WorkflowIDConflictPolicy.USE_EXISTING for a in client.arranques)


@pytest.mark.asyncio
async def test_con_idem_key_el_segundo_toque_adopta_el_mismo_factura_id():
    """EL TEST QUE IMPORTA. Dos llamadas con la MISMA idem_key -> mismo factura_id, un solo
    workflow real corriendo (la segunda choca con FAIL y se adopta, no se crea otro)."""
    client = _TemporalClientFake()
    iniciar = make_iniciar_factura(client)

    f1 = await iniciar(CLIENTE, CUIT, "idem-del-cliente-1")
    f2 = await iniciar(CLIENTE, CUIT, "idem-del-cliente-1")

    assert f1 == f2, "la misma idem_key tiene que devolver el mismo factura_id"
    assert len(client.arranques) == 2, "se intenta arrancar las dos veces (FAIL es la señal atómica)"
    assert all(a["id_conflict_policy"] == WorkflowIDConflictPolicy.FAIL for a in client.arranques)
    assert client.arranques[0]["id"] == client.arranques[1]["id"]


@pytest.mark.asyncio
async def test_idem_keys_distintas_producen_factura_id_distintos():
    """Control positivo: la derivación depende de la clave, no es una constante disfrazada."""
    client = _TemporalClientFake()
    iniciar = make_iniciar_factura(client)

    f1 = await iniciar(CLIENTE, CUIT, "intento-A")
    f2 = await iniciar(CLIENTE, CUIT, "intento-B")

    assert f1 != f2
