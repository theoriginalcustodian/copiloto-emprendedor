"""`estado()` (`FacturaWorkflow`) no serializaba `self._borrador.receptor`, aunque `cargar_cliente`
ya lo dejaba seteado en el estado interno del workflow.

Consecuencia real, en device: `PantallaFacturacion.tsx` adopta un borrador externo (card
`factura_propuesta` del chat, o "Facturar desde presupuesto") cuyo receptor ya viene cargado —por el
LLM o por `POST /presupuestos/{id}/facturar`, que señala `cargar_cliente` con los datos del
presupuesto ANTES de que la pantalla exista— pero `PasoResumen` no tenía nada que mostrar: el backend
sabía quién era el cliente y el front no.

No es una regresión: es un campo que nunca viajó. Hallazgo de la pasada de device de D12.
"""
from __future__ import annotations

import uuid
from datetime import date

import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from afip_factura_workflow import FacturaWorkflow

COLA = "estado-receptor-test"
CUIT = "20269996065"


async def _arrancar(env) -> object:
    return await env.client.start_workflow(
        FacturaWorkflow.run, args=["t1", CUIT, f"idem-{uuid.uuid4()}"],
        id=f"fact-{uuid.uuid4()}", task_queue=COLA)


@pytest.mark.asyncio
async def test_cargar_cliente_seguido_de_estado_devuelve_el_receptor_serializado():
    """El camino manual: la pantalla de factura carga el cliente por el signal de siempre."""
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow]):
            handle = await _arrancar(env)
            await handle.signal("cargar_cliente", {
                "tipo_doc": 80, "nro_doc": "20269996065", "nombre": "Cliente SA",
                "condicion_iva": 1, "domicilio": "Av. Siempre Viva 742",
            })

            estado = await handle.query("estado")

            assert estado["receptor"] == {
                "condicion_iva": 1, "tipo_doc": 80, "nro_doc": "20269996065",
                "nombre": "Cliente SA", "domicilio": "Av. Siempre Viva 742",
            }


@pytest.mark.asyncio
async def test_receptor_precargado_desde_presupuesto_tambien_se_expone():
    """El camino automático: `POST /presupuestos/{id}/facturar` (`presupuestos_web.py:362-368`)

    señala `cargar_cliente` con el shape exacto que arma desde `presupuesto["receptor"]` —mismas
    claves, mismo signal— antes de que la pantalla haga ninguna consulta. Es el mismo mecanismo que
    el test anterior visto desde el otro caller; lo que confirma es que el campo llega
    independientemente de QUIÉN mandó el signal.
    """
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow]):
            handle = await _arrancar(env)
            await handle.signal("cargar_cliente", {
                "nombre": "Emprendimiento del presupuesto",
                "tipo_doc": 96, "nro_doc": "30123456789",
                "condicion_iva": 5, "domicilio": "Ruta 8 km 44",
            })

            estado = await handle.query("estado")

            assert estado["receptor"] == {
                "condicion_iva": 5, "tipo_doc": 96, "nro_doc": "30123456789",
                "nombre": "Emprendimiento del presupuesto", "domicilio": "Ruta 8 km 44",
            }


@pytest.mark.asyncio
async def test_receptor_null_cuando_el_borrador_nunca_recibio_cliente():
    """Caso de hoy, sin romper: un borrador recién abierto no tiene cliente todavía."""
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow]):
            handle = await _arrancar(env)

            estado = await handle.query("estado")

            assert estado["receptor"] is None
