"""`POST .../confirmar` contestaba lo mismo con el token bueno que con el vencido.

El gate HITL iba por **signal**, que es fire-and-forget: el endpoint acusaba recibo con
`200 {"ok": true}` y se acabó. Medido, `confirmar` con un token desactualizado devolvía exactamente
esa respuesta y no emitía nada. La app sobrevivía porque después releía el estado; el problema es que
el contrato dice «confirmado» cuando significa «recibí tu pedido», y el próximo consumidor —una
integración, un agente— iba a dar por emitida una factura que no existe.

Ahora va por **Workflow Update**, la primitiva de Temporal que devuelve al cliente lo que el workflow
decidió. Validado antes de escribir nada, contra el cluster real (1.29.7): el update viaja, el rechazo
vuelve, y un signal y un update pueden compartir nombre de wire — por eso el signal QUEDA, para las
ejecuciones en vuelo y los clientes viejos.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from afip_factura_workflow import FacturaWorkflow

COLA = "confirmar-test"
CUIT = "20269996065"

PERFIL = {"cuit": CUIT, "razon_social": "Juan Pérez", "domicilio_comercial": "Calle 1",
          "condicion_iva": "monotributo", "ingresos_brutos": "exento",
          "inicio_actividades": date(2020, 1, 1).isoformat(), "punto_venta": 1}


def _actividades(emisiones: list):
    @activity.defn(name="cargar_contexto_factura")
    async def cargar_contexto_factura(cliente_id: str, cuit: str) -> dict:
        return {"perfil": dict(PERFIL), "tiene_certificado": True}

    @activity.defn(name="reservar_numero_comprobante")
    async def reservar_numero_comprobante(cliente_id: str, cuit: str, punto_venta: int,
                                          tipo_cbte: int) -> int:
        return 11

    @activity.defn(name="emitir_comprobante")
    async def emitir_comprobante(cliente_id: str, cuit: str, payload: dict, idem_key: str,
                                 workflow_id: str, receptor_nombre: str = "",
                                 nro_reservado: int | None = None) -> dict:
        emisiones.append(nro_reservado)
        return {"ok": True, "duplicado": False, "id": 1, "cae": "CAE-11", "nro": 11,
                "cae_vto": "2026-08-01", "tipo_cbte": 11, "punto_venta": 1, "total": "100.00",
                "estado": "emitida"}

    @activity.defn(name="generar_pdf_comprobante")
    async def generar_pdf_comprobante(*args, **kwargs) -> dict:
        return {"ok": False}

    @activity.defn(name="archivar_factura_en_drive")
    async def archivar_factura_en_drive(*args, **kwargs) -> dict:
        return {"ok": False}

    return [cargar_contexto_factura, reservar_numero_comprobante, emitir_comprobante,
            generar_pdf_comprobante, archivar_factura_en_drive]


async def _borrador_listo(env, emisiones: list):
    """Arranca una factura y la deja en el gate HITL: datos de venta, ítem y receptor cargados.

    Los tres hacen falta — `siguiente_estado` DERIVA el estado de los slots, así que faltando
    cualquiera nunca se llega a `esperando_confirmacion`. Y la fecha sale del reloj del entorno
    (`get_current_time`), no de `date.today()`: con time-skipping el workflow ve la hora del test
    server, y una fecha fuera de ±10 días la rechaza la R4.
    """
    hoy = (await env.get_current_time()).date()
    handle = await env.client.start_workflow(
        FacturaWorkflow.run, args=["t1", CUIT, f"idem-{uuid.uuid4()}"],
        id=f"fact-{uuid.uuid4()}", task_queue=COLA)
    await handle.signal("cargar_datos_venta", {"fecha": hoy.isoformat(), "concepto": 1,
                                               "condicion_venta": "contado"})
    await handle.signal("agregar_item", {"descripcion": "Servicio", "cantidad": "1",
                                         "precio_unitario": "100.00"})
    await handle.signal("cargar_cliente", {"tipo_doc": 99, "nro_doc": "0", "nombre": "Consumidor"})

    # Cota explícita: un borrador que no llega al gate tiene que FALLAR diciendo en qué estado quedó,
    # no colgar el test hasta el timeout del runner.
    for _ in range(300):
        estado = await handle.query("estado")
        if estado["estado"] == "esperando_confirmacion":
            return handle
    raise AssertionError(f"la factura no llegó al gate HITL: {estado}")


@pytest.mark.asyncio
async def test_confirmar_con_token_vencido_lo_DICE_en_vez_de_contestar_ok():
    """EL TEST QUE IMPORTA. Antes esto era indistinguible de una confirmación válida."""
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(emisiones)):
            handle = await _borrador_listo(env, emisiones)

            resultado = await handle.execute_update("confirmar", "TOKEN-QUE-YA-NO-CORRESPONDE")

            assert resultado["aceptado"] is False, "el rechazo se reportaba como éxito"
            assert resultado["motivo_codigo"] == "token_desactualizado"
            assert emisiones == [], "no puede haber emitido nada"

            # Control positivo en la misma ejecución: con el token FRESCO sí se toma y sí emite.
            token = (await handle.query("estado"))["token_confirmacion"]
            assert (await handle.execute_update("confirmar", token))["aceptado"] is True
            await handle.result()

    assert emisiones == [11], "con el token bueno tenía que emitir exactamente una vez"


@pytest.mark.asyncio
async def test_reconfirmar_lo_ya_confirmado_es_idempotente():
    """Un reintento del mismo POST —red lenta, botón tocado dos veces— no puede contestar
    'rechazado' sobre una confirmación que sí ocurrió."""
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(emisiones)):
            handle = await _borrador_listo(env, emisiones)
            token = (await handle.query("estado"))["token_confirmacion"]

            primero = await handle.execute_update("confirmar", token)
            segundo = await handle.execute_update("confirmar", "cualquier-cosa")

            assert primero["aceptado"] is True and segundo["aceptado"] is True
            await handle.result()

    assert emisiones == [11], "la segunda confirmación no puede emitir una segunda factura"


@pytest.mark.asyncio
async def test_el_signal_viejo_sigue_funcionando():
    """Las ejecuciones en vuelo y cualquier cliente que todavía mande el signal tienen que seguir
    confirmando. Si esto se pusiera rojo, el update habría reemplazado al signal en vez de sumarse."""
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(emisiones)):
            handle = await _borrador_listo(env, emisiones)
            token = (await handle.query("estado"))["token_confirmacion"]
            await handle.signal("confirmar", token)
            await handle.result()

    assert emisiones == [11]


# ---------------------------------------------------------------------------
# El endpoint: `aceptado:false` tiene que salir como 409, no como 200.
# ---------------------------------------------------------------------------

def _app_afip(confirmar):
    from fastapi import FastAPI

    from afip_web import create_afip_app

    app: FastAPI = create_afip_app(
        require_tenant=lambda: "t1",
        perfil_store_factory=lambda cid: None,
        cred_store_factory=lambda cid: None,
        handoff_factory=lambda cid: None,
        start_onboarding=lambda *a, **k: None,
        confirmar_factura=confirmar,
        signal_factura=lambda *a, **k: None)
    return app


def test_la_confirmacion_rechazada_sale_como_409():
    from fastapi.testclient import TestClient

    async def confirmar(cliente_id, factura_id, token):
        return {"aceptado": False, "motivo": "revisá el resumen",
                "motivo_codigo": "token_desactualizado"}

    r = TestClient(_app_afip(confirmar)).post("/afip/facturas/f1/confirmar", json={"token": "x"})

    assert r.status_code == 409, "un rechazo contestado con 200 es la mentira que este fix elimina"
    detalle = r.json()["detail"]
    # El 409 pasa por `errores_web.conflicto`, que obliga a declarar el código — un `HTTPException(409)`
    # a mano lo caza `test_errores_web.py::test_ningun_409_escrito_a_mano`.
    assert detalle["codigo"] == "confirmacion_no_tomada"
    assert detalle["mensaje"] == "revisá el resumen"
    assert detalle["motivo_codigo"] == "token_desactualizado", "el porqué puntual lo pone el workflow"


def test_control_la_confirmacion_aceptada_sigue_dando_200():
    from fastapi.testclient import TestClient

    async def confirmar(cliente_id, factura_id, token):
        return {"aceptado": True, "motivo": None, "motivo_codigo": None}

    r = TestClient(_app_afip(confirmar)).post("/afip/facturas/f1/confirmar", json={"token": "x"})

    assert r.status_code == 200
    assert r.json() == {"ok": True, "aceptado": True}


def test_sin_la_dependencia_inyectada_cae_al_signal_de_siempre():
    """Fallback: un montaje que no inyecte `confirmar_factura` no puede quedar roto."""
    from fastapi.testclient import TestClient

    señales: list = []

    async def signal(cliente_id, factura_id, nombre, payload):
        señales.append((nombre, payload))

    from afip_web import create_afip_app

    app = create_afip_app(
        require_tenant=lambda: "t1", perfil_store_factory=lambda cid: None,
        cred_store_factory=lambda cid: None, handoff_factory=lambda cid: None,
        start_onboarding=lambda *a, **k: None, signal_factura=signal)

    r = TestClient(app).post("/afip/facturas/f1/confirmar", json={"token": "x"})

    assert r.status_code == 200 and r.json() == {"ok": True}
    assert señales == [("confirmar", "x")]
