"""SM-E1 — un emisor Responsable Inscripto no puede tumbar la consulta de estado de la factura.

`estado()` (query de `FacturaWorkflow`) calcula `total` con `calcular_totales`, que para Factura A/B
levanta `NotImplementedError` (falta el desglose de IVA). Con un perfil RI, items y receptor cargados,
la consulta fallaba — y es la que la pantalla polea.

Ahora el perfil RI no pasa `validar_perfil` (`condicion_iva_no_soportada`): la factura no avanza a
confirmación y el total de lo que no se puede emitir es 0.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import date

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from afip_factura_workflow import FacturaWorkflow

COLA = "ri-no-explota-test"
CUIT = "20269996065"


def _actividades(condicion: str):
    @activity.defn(name="cargar_contexto_factura")
    async def cargar_contexto_factura(cliente_id: str, cuit: str) -> dict:
        return {"tiene_certificado": True, "perfil": {
            "cuit": CUIT, "razon_social": "Juan Pérez", "domicilio_comercial": "Calle 1",
            "condicion_iva": condicion, "ingresos_brutos": "1",
            "inicio_actividades": date(2020, 1, 1).isoformat(), "punto_venta": 1}}
    return [cargar_contexto_factura]


async def _estado(condicion: str) -> dict:
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(condicion)):
            h = await env.client.start_workflow(
                FacturaWorkflow.run, args=["t1", CUIT, f"idem-{uuid.uuid4()}"],
                id=f"fact-{uuid.uuid4()}", task_queue=COLA)
            await h.signal("agregar_item", {"descripcion": "Servicio", "cantidad": "1",
                                            "precio_unitario": "1000"})
            await h.signal("cargar_cliente", {"tipo_doc": 99, "nro_doc": "0", "nombre": "Consumidor",
                                              "condicion_iva": 5})
            await h.signal("cargar_datos_venta", {"fecha": date.today().isoformat(),
                                                  "concepto": 1, "condicion_venta": "Contado"})
            # Las señales llegan antes de que la actividad `cargar_contexto_factura` termine: sin
            # esperar al perfil, la query ve `perfil_ausente` y el test mediría otra cosa.
            for _ in range(100):
                estado = await h.query("estado")
                if not any(f["codigo"] == "perfil_ausente" for f in estado["faltantes"]):
                    return estado
                await asyncio.sleep(0.05)
            raise AssertionError(f"el perfil nunca se cargó: {estado}")


@pytest.mark.asyncio
async def test_perfil_responsable_inscripto_la_query_de_estado_no_explota_y_no_confirma():
    estado = await _estado("responsable_inscripto")
    assert estado["estado"] != "esperando_confirmacion"
    assert estado["token_confirmacion"] is None
    assert estado["total"] == "0.00"
    assert any(f["codigo"] == "condicion_iva_no_soportada" for f in estado["faltantes"])


@pytest.mark.asyncio
async def test_control_positivo_monotributo_con_los_mismos_datos_llega_a_confirmacion():
    """Sin esto el test de arriba pasaría también si el setup (señales/actividad) estuviera roto."""
    estado = await _estado("monotributo")
    assert estado["estado"] == "esperando_confirmacion", estado
    assert estado["total"] == "1000.00"
    assert not any(f["codigo"] == "condicion_iva_no_soportada" for f in estado["faltantes"])
