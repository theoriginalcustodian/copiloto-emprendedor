"""SM-P11 — dictar a `factura` NO emite nada ante ARCA, probado contra el workflow REAL.

Por qué existe este test: `factura` estuvo excluida de `dictado_destinos` con el argumento «emitir es
irreversible ante ARCA». El criterio de pertenencia es otro (¿la tool PROPONE o ejecuta?), y la protección real
no vive en esa tabla sino en `FacturaWorkflow.confirmar` (token atado al contenido de la card). Un control de
aislamiento declarado en un comentario y no ejercitado por un caso hostil es indistinguible de uno ausente:
acá se ejercita.

Qué se hace: el dictado corre por la misma `emitir_factura` del catálogo, con las MISMAS funciones de red de
producción (`make_signal_factura`, `make_consultar_factura`, `make_abrir_borrador_de_presupuesto` de `web`)
apuntadas al `FacturaWorkflow` de Temporal (time-skipping). Sólo se fakean las activities (la que "emite" cuenta
cuántas veces la llamaron: ESA es la medida de «tocó ARCA») y los stores de credencial/perfil.

Control positivo (sin él, `emisiones == []` podría ser un instrumento ciego): confirmar con el token de la card
SÍ emite, una vez.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import date

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

import dictado_destinos as DD
import tool_catalog
import web
from afip_factura_workflow import FacturaWorkflow
from test_facturar_por_voz import CUIT_EMISOR, _CredFake, _PerfilStoreFake, _perfil

COLA = "sm-p11-dictado-factura"
CLIENTE = "tenant-dictado"
CUIT_WF = "20269996065"
PERFIL_WF = {"cuit": CUIT_WF, "razon_social": "Juan Pérez", "domicilio_comercial": "Calle 1",
             "condicion_iva": "monotributo", "ingresos_brutos": "exento",
             "inicio_actividades": date(2020, 1, 1).isoformat(), "punto_venta": 1}


class _Ctx:
    cliente_id = CLIENTE
    composio_user_id = "42"


def _actividades(emisiones: list):
    @activity.defn(name="cargar_contexto_factura")
    async def cargar_contexto_factura(cliente_id: str, cuit: str) -> dict:
        return {"perfil": dict(PERFIL_WF), "tiene_certificado": True}

    @activity.defn(name="reservar_numero_comprobante")
    async def reservar_numero_comprobante(cliente_id: str, cuit: str, punto_venta: int, tipo_cbte: int) -> int:
        return 11

    @activity.defn(name="emitir_comprobante")
    async def emitir_comprobante(cliente_id: str, cuit: str, payload: dict, idem_key: str,
                                 workflow_id: str, receptor_nombre: str = "",
                                 nro_reservado: int | None = None) -> dict:
        emisiones.append(nro_reservado)          # <- ESTA es la medida de «tocó ARCA»
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


def _puente(loop, fn):
    """La tool corre `asyncio.run(...)` en OTRO hilo (así la llama el motor); el cliente de Temporal vive en el
    loop del test. Cada llamada de red de la tool se delega al loop dueño del cliente."""
    async def envuelta(*a, **k):
        return await asyncio.wrap_future(asyncio.run_coroutine_threadsafe(fn(*a, **k), loop))
    return envuelta


def _tool(env, loop, ahora_iso: str):
    async def sin_borrador_previo(cliente_id):
        return None                              # Visibility no es lo que se prueba: siempre borrador nuevo

    perfil = _perfil()
    return tool_catalog.make_tool_executor(
        None, now_iso_provider=lambda: ahora_iso,
        afip_cred_store_factory=lambda cid: _CredFake(CUIT_EMISOR),
        afip_perfil_store_factory=lambda cid: _PerfilStoreFake(perfil),
        abrir_borrador_dictado=_puente(loop, web.make_abrir_borrador_de_presupuesto(env.client, task_queue=COLA)),
        consultar_factura_dictado=_puente(loop, web.make_consultar_factura(env.client)),
        signal_factura_dictado=_puente(loop, web.make_signal_factura(env.client)),
        buscar_borrador_dictado=sin_borrador_previo)


async def _dictar_factura(env):
    """El turno de dictado: la MISMA tool que el scope de `dictado:factura` ofrece, con lo que dijo la persona."""
    loop = asyncio.get_running_loop()
    ahora = (await env.get_current_time()).replace(tzinfo=None).isoformat()
    ex = _tool(env, loop, ahora)
    item = {"descripcion": "el service", "cantidad": "1", "precio_unitario": "100"}
    res = await asyncio.to_thread(ex, "emitir_factura",
                                  {"cliente_nombre": "Consumidor Final", "items": [item]}, _Ctx(),
                                  confirmed=False, idem_key=f"dictado-{uuid.uuid4()}")
    return res


@pytest.mark.asyncio
async def test_ADVERSARIAL_dictar_una_factura_arma_la_card_y_NO_emite_ante_arca():
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(emisiones)):
            res = await _dictar_factura(env)

            assert res.status == "ok" and res.is_write is False
            assert res.artifact is not None and res.artifact.kind == "factura_propuesta"
            assert res.artifact.data["faltantes"] == [], "el caso hostil debe llegar al gate completo, no cortarse antes"
            assert "TODAVÍA NO está emitida" in res.observation["result"]

            handle = env.client.get_workflow_handle(web._wf_id_factura(CLIENTE, res.artifact.data["factura_id"]))
            estado = await handle.query("estado")
            assert estado["estado"] == "esperando_confirmacion", "el borrador queda esperando a la persona"
            assert estado["token_confirmacion"], "el gate existe: sin token no hay emisión"
            assert not (estado.get("resultado") or {}).get("cae")

            await env.sleep(3600)        # pasa el tiempo: nadie confirma → nada se emite solo
            assert (await handle.query("estado"))["estado"] == "esperando_confirmacion"
            await handle.signal("cancelar")
            await handle.result()

    assert emisiones == [], "dictar a `factura` tocó ARCA sin el confirm de la persona"


@pytest.mark.asyncio
async def test_ADVERSARIAL_un_token_que_no_es_el_de_la_card_no_emite():
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(emisiones)):
            res = await _dictar_factura(env)
            handle = env.client.get_workflow_handle(web._wf_id_factura(CLIENTE, res.artifact.data["factura_id"]))
            rechazo = await handle.execute_update("confirmar", "token-inventado")
            assert rechazo["aceptado"] is False
            assert (await handle.query("estado"))["estado"] == "esperando_confirmacion"
            await handle.signal("cancelar")
            await handle.result()

    assert emisiones == []


@pytest.mark.asyncio
async def test_CONTROL_POSITIVO_confirmar_con_el_token_de_la_card_SI_emite_una_vez():
    """Prueba que el instrumento VE una emisión: si esto fallara, los `emisiones == []` de arriba no valdrían."""
    emisiones: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[FacturaWorkflow],
                          activities=_actividades(emisiones)):
            res = await _dictar_factura(env)
            handle = env.client.get_workflow_handle(web._wf_id_factura(CLIENTE, res.artifact.data["factura_id"]))
            token = (await handle.query("estado"))["token_confirmacion"]
            assert (await handle.execute_update("confirmar", token))["aceptado"] is True
            await handle.result()

    assert emisiones == [11], "el confirm de la persona es el ÚNICO camino que emite, y emite una sola vez"


def test_el_scope_del_dictado_de_factura_ofrece_UNA_sola_tool_y_no_es_de_las_que_escriben():
    """El LLM de un dictado no tiene a mano nada que confirme ni anule: sólo `emitir_factura`, que propone."""
    scope = DD.scope_de_sesion("dictado:factura:s1")
    assert scope["tool_names"] == ["emitir_factura"]
    nombres = {t["function"]["name"] for t in tool_catalog.build_tool_catalog()}
    assert "emitir_factura" in nombres
    assert "emitir_factura" not in tool_catalog.WRITE_TOOLS
