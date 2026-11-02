"""SM-N1 — el estado de la factura no dice `perfil_ausente` mientras el perfil TODAVÍA se está cargando.

Medido en prod (2026-11-02, canónico, 6 dictados idénticos): 2 terminaron en «cargá tus datos fiscales»
con un perfil válido guardado desde el 2026-10-14. Causa: `FacturaWorkflow` arranca con la activity
`cargar_contexto_factura`; hasta que vuelve, `_perfil` es None y la query `estado` calcula
`perfil_ausente`. La tool de voz manda signals y consulta enseguida: caía en esa ventana.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import date

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

import tool_catalog
from afip_factura_workflow import FacturaWorkflow

COLA = "n1-contexto-test"
CUIT = "20269996065"
PERFIL = {"cuit": CUIT, "razon_social": "Juan Pérez", "domicilio_comercial": "Calle 1",
          "condicion_iva": "monotributo", "ingresos_brutos": "exento",
          "inicio_actividades": date(2020, 1, 1).isoformat(), "punto_venta": 1}


def _actividades(puerta: asyncio.Event):
    @activity.defn(name="cargar_contexto_factura")
    async def cargar_contexto_factura(cliente_id: str, cuit: str) -> dict:
        await puerta.wait()          # la carga del perfil TARDA: es la ventana de la carrera
        return {"perfil": dict(PERFIL), "tiene_certificado": True}

    @activity.defn(name="reservar_numero_comprobante")
    async def reservar_numero_comprobante(*a, **k) -> int:
        return 1

    return [cargar_contexto_factura, reservar_numero_comprobante]


@pytest.mark.asyncio
async def test_el_estado_distingue_perfil_no_cargado_de_perfil_ausente():
    """Control positivo: ANTES de que la activity vuelva, `contexto_cargado` es False (y `faltantes`
    todavía miente `perfil_ausente`); DESPUÉS, True y el perfil existe. Si este test no viera la
    ventana, el fix de la tool esperaría una marca que nunca cambia."""
    puerta = asyncio.Event()
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(puerta)):
            handle = await env.client.start_workflow(
                FacturaWorkflow.run, args=["t1", CUIT, f"idem-{uuid.uuid4()}"],
                id=f"fact-{uuid.uuid4()}", task_queue=COLA)
            await handle.signal("agregar_item", {"descripcion": "Servicio", "cantidad": "1",
                                                 "precio_unitario": "100.00"})
            antes = await handle.query("estado")
            assert antes["contexto_cargado"] is False

            puerta.set()
            for _ in range(300):
                despues = await handle.query("estado")
                if despues["contexto_cargado"]:
                    break
            assert despues["contexto_cargado"] is True
            assert "perfil_ausente" not in [f["codigo"] for f in despues["faltantes"]]
            await handle.signal("cancelar")


class _Ctx:
    cliente_id = "tenant-a"
    composio_user_id = "42"


def test_la_tool_espera_a_que_el_contexto_este_cargado(monkeypatch):
    """La consulta devuelve `perfil_ausente` mientras `contexto_cargado` es False; la tool tiene que
    reintentar hasta verlo True y NO reportar el faltante espurio."""
    from test_facturar_por_voz import (CUIT_EMISOR, HOY_ISO, _CredFake, _FacturaBackendFake, _PerfilStoreFake,
                                       _perfil)

    monkeypatch.setattr(tool_catalog, "ESPERA_CONTEXTO_FACTURA_SEG", 0)
    perfil = _perfil()
    backend = _FacturaBackendFake(perfil=perfil)
    llamadas = {"n": 0}

    async def consultar(cliente_id, factura_id):
        estado = await backend.consultar(cliente_id, factura_id)
        if estado is None:
            return None
        llamadas["n"] += 1
        if llamadas["n"] <= 3:       # las 3 primeras consultas caen en la ventana de carga
            return {**estado, "contexto_cargado": False,
                    "faltantes": [{"codigo": "perfil_ausente", "campo": "perfil",
                                   "mensaje": "Falta cargar tus datos fiscales en Ajustes antes de poder facturar."}]}
        return {**estado, "contexto_cargado": True}

    ex = tool_catalog.make_tool_executor(
        None, now_iso_provider=lambda: HOY_ISO,
        afip_cred_store_factory=lambda cid: _CredFake(CUIT_EMISOR),
        afip_perfil_store_factory=lambda cid: _PerfilStoreFake(perfil),
        abrir_borrador_dictado=backend.abrir, consultar_factura_dictado=consultar,
        signal_factura_dictado=backend.signal, buscar_borrador_dictado=backend.buscar_abierto)
    item = {"descripcion": "el service", "cantidad": "1", "precio_unitario": "30000"}
    res = ex("emitir_factura", {"cliente_nombre": "Consumidor Final", "items": [item]}, _Ctx(),
             confirmed=False, idem_key="w1-1-0")
    assert res.artifact is not None, "esperó al contexto: arma la card, no pregunta por el perfil"
    assert res.artifact.data["faltantes"] == []
    assert llamadas["n"] >= 4


def test_sin_la_clave_contexto_cargado_se_toma_como_cargado(monkeypatch):
    """Una ejecución en vuelo (anterior a la marca) no trae la clave: no hay espera ni cuelgue."""
    from test_facturar_por_voz import (CUIT_EMISOR, HOY_ISO, _CredFake, _FacturaBackendFake, _PerfilStoreFake,
                                       _perfil)

    monkeypatch.setattr(tool_catalog, "ESPERA_CONTEXTO_FACTURA_SEG", 0)
    perfil = _perfil()
    backend = _FacturaBackendFake(perfil=perfil)
    llamadas = {"n": 0}

    async def consultar(cliente_id, factura_id):
        estado = await backend.consultar(cliente_id, factura_id)
        if estado is not None:
            llamadas["n"] += 1
        return estado

    ex = tool_catalog.make_tool_executor(
        None, now_iso_provider=lambda: HOY_ISO,
        afip_cred_store_factory=lambda cid: _CredFake(CUIT_EMISOR),
        afip_perfil_store_factory=lambda cid: _PerfilStoreFake(perfil),
        abrir_borrador_dictado=backend.abrir, consultar_factura_dictado=consultar,
        signal_factura_dictado=backend.signal, buscar_borrador_dictado=backend.buscar_abierto)
    item = {"descripcion": "x", "cantidad": "1", "precio_unitario": "100"}
    ex("emitir_factura", {"cliente_nombre": "Juan", "items": [item]}, _Ctx(), confirmed=False, idem_key="w1-1-0")
    assert llamadas["n"] == 1, "sin la clave no hay espera: una sola consulta, la de siempre"
