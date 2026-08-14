"""`estado()` (`FacturaWorkflow`) no serializaba `self._borrador.datos_venta`, aunque
`cargar_datos_venta` ya lo dejaba seteado en el estado interno del workflow — mismo gap que tenía
`receptor` antes de PR #454 (`test_estado_expone_receptor.py`), mismo mecanismo.

Consecuencia real: un borrador creado por otra vía (por voz, o por presupuesto) que ya tiene
`datos_venta` cargado, al adoptarse en `PantallaFacturacion` (`facturaIdInicial`), deja el paso
"Datos de venta" mostrando vacío aunque el backend ya lo tenga.
"""
from __future__ import annotations

import uuid

import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from afip_factura_workflow import FacturaWorkflow

COLA = "estado-datos-venta-test"
CUIT = "20269996065"


async def _arrancar(env) -> object:
    return await env.client.start_workflow(
        FacturaWorkflow.run, args=["t1", CUIT, f"idem-{uuid.uuid4()}"],
        id=f"fact-{uuid.uuid4()}", task_queue=COLA)


@pytest.mark.asyncio
async def test_cargar_datos_venta_seguido_de_estado_devuelve_los_datos_serializados():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow]):
            handle = await _arrancar(env)
            await handle.signal("cargar_datos_venta", {
                "fecha": "2026-08-13", "concepto": 1, "condicion_venta": "contado",
            })

            estado = await handle.query("estado")

            assert estado["datos_venta"] == {
                "fecha": "2026-08-13", "concepto": 1, "condicion_venta": "contado",
                "fecha_servicio_desde": None, "fecha_servicio_hasta": None, "fecha_vto_pago": None,
            }


@pytest.mark.asyncio
async def test_datos_venta_con_fechas_de_servicio_tambien_se_expone():
    """Concepto servicios (2/3): las 3 fechas de servicio viajan completas."""
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow]):
            handle = await _arrancar(env)
            await handle.signal("cargar_datos_venta", {
                "fecha": "2026-08-13", "concepto": 2, "condicion_venta": "cuenta corriente",
                "fecha_servicio_desde": "2026-08-01", "fecha_servicio_hasta": "2026-08-31",
                "fecha_vto_pago": "2026-09-10",
            })

            estado = await handle.query("estado")

            assert estado["datos_venta"] == {
                "fecha": "2026-08-13", "concepto": 2, "condicion_venta": "cuenta corriente",
                "fecha_servicio_desde": "2026-08-01", "fecha_servicio_hasta": "2026-08-31",
                "fecha_vto_pago": "2026-09-10",
            }


@pytest.mark.asyncio
async def test_datos_venta_null_cuando_el_borrador_nunca_los_recibio():
    """Caso de hoy, sin romper: un borrador recién abierto no tiene datos de venta todavía."""
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow]):
            handle = await _arrancar(env)

            estado = await handle.query("estado")

            assert estado["datos_venta"] is None
