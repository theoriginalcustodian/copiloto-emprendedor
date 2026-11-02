"""SM-H2 — cancelar la propuesta de factura DE VERDAD, y que `confirmar` la rechace después.

Antes: el chat decía «la cancelé» sin herramienta, `POST /cancelar` era un signal fire-and-forget que
contestaba 200 aunque la factura ya estuviera emitida, y la card seguía mostrando Emitir sobre una
propuesta cancelada. Acá se ejercita el workflow REAL (Temporal time-skipping) y la herramienta del
agente con fakes de las dos dependencias de red.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import date

import pytest
from temporalio import activity
from temporalio.service import RPCError
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from afip_factura_workflow import FacturaWorkflow

COLA = "cancelar-test"
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


async def _borrador_listo(env):
    hoy = (await env.get_current_time()).date()
    handle = await env.client.start_workflow(
        FacturaWorkflow.run, args=["t1", CUIT, f"idem-{uuid.uuid4()}"],
        id=f"fact-{uuid.uuid4()}", task_queue=COLA)
    await handle.signal("cargar_datos_venta", {"fecha": hoy.isoformat(), "concepto": 1,
                                               "condicion_venta": "contado"})
    await handle.signal("agregar_item", {"descripcion": "Servicio", "cantidad": "1",
                                         "precio_unitario": "100.00"})
    await handle.signal("cargar_cliente", {"tipo_doc": 99, "nro_doc": "0", "nombre": "Consumidor"})
    for _ in range(300):
        estado = await handle.query("estado")
        if estado["estado"] == "esperando_confirmacion":
            return handle
    raise AssertionError(f"la factura no llegó al gate HITL: {estado}")


@pytest.mark.asyncio
async def test_cancelar_por_update_y_confirmar_despues_NO_emite():
    """EL TEST QUE IMPORTA: cancelada, el token que antes servía ya no emite."""
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(emisiones)):
            handle = await _borrador_listo(env)
            token = (await handle.query("estado"))["token_confirmacion"]

            assert (await handle.execute_update("cancelar"))["aceptado"] is True
            await handle.result()

            estado = await handle.query("estado")
            assert estado["estado"] == "cancelada", "la propuesta cancelada debe leerse como `cancelada`"
            # confirmar sobre el workflow ya cerrado: el update no puede viajar (no emite).
            with pytest.raises(RPCError):
                await handle.execute_update("confirmar", token)

    assert emisiones == [], "una factura cancelada NO puede emitirse"


@pytest.mark.asyncio
async def test_cancelar_por_signal_y_confirmar_en_la_misma_tanda_gana_la_cancelacion():
    """Cancelar (signal, camino viejo) antes de confirmar: la cancelación manda, no emite."""
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(emisiones)):
            handle = await _borrador_listo(env)
            token = (await handle.query("estado"))["token_confirmacion"]
            await handle.signal("cancelar")
            await handle.signal("confirmar", token)
            resultado = await handle.result()

    assert resultado["estado"] == "cancelada"
    assert emisiones == []


@pytest.mark.asyncio
async def test_cancelar_una_ya_emitida_se_RECHAZA_con_codigo_propio():
    """Control positivo del otro lado: confirmada y emitida, cancelar dice `factura_ya_emitida`."""
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(emisiones)):
            handle = await _borrador_listo(env)
            token = (await handle.query("estado"))["token_confirmacion"]
            assert (await handle.execute_update("confirmar", token))["aceptado"] is True
            # el update `cancelar` puede caer con el workflow ya cerrado (RPCError) o contestar el
            # rechazo si todavía corre: en ningún caso `aceptado`.
            try:
                r = await handle.execute_update("cancelar")
                assert r["aceptado"] is False and r["motivo_codigo"] == "factura_ya_emitida"
            except RPCError:
                pass
            await handle.result()

    assert emisiones == [11], "emitió exactamente una vez; el cancelar tardío no la deshace"


# ── herramienta del agente ────────────────────────────────────────────────────────────────────

class _Ctx:
    cliente_id = "tenant-A"


def _run_tool(buscar, cancelar):
    import tool_catalog
    return tool_catalog._run_cancelar_factura({}, _Ctx(), "idem-1", buscar, cancelar)


def test_tool_cancelar_aceptada_afirma_y_devuelve_el_id():
    async def buscar(cid):
        assert cid == "tenant-A", "el agente no elige el tenant: sale del ctx del request"
        return "dictado-1"

    async def cancelar(cid, fid):
        return {"aceptado": True, "motivo": None, "motivo_codigo": None}

    r = _run_tool(buscar, cancelar)
    assert r.is_write is True and r.observation["factura_id"] == "dictado-1"


def test_tool_cancelar_rechazada_NO_dice_que_cancelo():
    async def buscar(cid):
        return "dictado-1"

    async def cancelar(cid, fid):
        return {"aceptado": False, "motivo": "la factura ya se emitió", "motivo_codigo": "factura_ya_emitida"}

    r = _run_tool(buscar, cancelar)
    assert r.is_write is False
    assert r.observation["motivo_codigo"] == "factura_ya_emitida"
    assert r.observation["result"].startswith("NO se canceló")


def test_tool_cancelar_sin_borrador_abierto_no_finge():
    llamadas = []

    async def buscar(cid):
        return None

    async def cancelar(cid, fid):
        llamadas.append(fid)

    r = _run_tool(buscar, cancelar)
    assert r.is_write is False and llamadas == []
    assert "NO digas" in r.observation["result"]


def test_tool_cancelar_sin_dependencias_es_error_de_negocio():
    r = _run_tool(None, None)
    assert r.status == "error"


# ── capa web: el workflow cerrado se traduce a un rechazo DISTINGUIBLE ───────────────────────

class _HandleCerrado:
    """Workflow ya cerrado: el update da NOT_FOUND, la query sí responde (patrón medido de Temporal)."""
    def __init__(self, estado):
        self._estado = estado

    async def execute_update(self, nombre, *args):
        from temporalio.service import RPCStatusCode
        raise RPCError("update not found", RPCStatusCode.NOT_FOUND, b"")

    async def query(self, nombre, *args):
        return {"estado": self._estado}


class _ClienteTemporal:
    def __init__(self, estado):
        self._h = _HandleCerrado(estado)

    def get_workflow_handle(self, wf_id):
        return self._h


def test_web_confirmar_sobre_cancelada_da_factura_cancelada_no_404():
    import web
    r = asyncio.run(web.make_confirmar_factura(_ClienteTemporal("cancelada"))("t1", "f1", "tok"))
    assert r["aceptado"] is False and r["motivo_codigo"] == "factura_cancelada"


def test_web_cancelar_repetido_sobre_cancelada_es_idempotente():
    import web
    r = asyncio.run(web.make_cancelar_factura(_ClienteTemporal("cancelada"))("t1", "f1"))
    assert r["aceptado"] is True


def test_web_cancelar_sobre_emitida_da_factura_ya_emitida():
    import web
    r = asyncio.run(web.make_cancelar_factura(_ClienteTemporal("emitida"))("t1", "f1"))
    assert r["aceptado"] is False and r["motivo_codigo"] == "factura_ya_emitida"
