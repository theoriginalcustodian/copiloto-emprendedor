"""FastAPI de AFIP (capa CLIENTE): perfil fiscal + alta ARCA, para la pantalla de Ajustes.

Molde: `create_mp_app`. Router-fábrica con todas las dependencias inyectadas (testeable con fakes),
`Depends(require_tenant)` para resolver el tenant, e I/O sync (psycopg2 + gateway) vía `asyncio.to_thread`.

🔴 **`POST /afip/conectar` es el único endpoint del sistema que recibe la clave fiscal.** Lo que hace con
ella, en orden: la mete en el claim-check cifrado con TTL de 15 minutos, obtiene un handle opaco, arranca
el workflow con ese handle, y se olvida. La clave nunca se guarda, nunca se loguea, nunca viaja a Temporal
y nunca vuelve en una respuesta.
"""
from __future__ import annotations

import asyncio
from datetime import date
from typing import Callable, Literal

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from afip_credential_store import ClaveFiscal
from afip_rules import CondicionEmisor, PerfilFiscal, validar_cuit, validar_perfil


class PerfilBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)
    razon_social: str
    domicilio_comercial: str
    condicion_iva: str
    ingresos_brutos: str
    inicio_actividades: date
    punto_venta: int = 1


# Homologación es el default en TODA la superficie: si el ambiente se omite por un bug del cliente o
# un campo que se perdió en un refactor, el peor caso es una factura de prueba sin efecto fiscal. Al
# revés —default a producción— el peor caso es un comprobante fiscal real que el usuario no quiso.
AMBIENTE_DEFAULT = "dev"
_NOMBRE_AMBIENTE = {"dev": "homologación (pruebas)", "prod": "producción"}


class ConectarBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)
    usuario: str
    clave_fiscal: str = Field(repr=False)  # `repr=False`: que no salga en un log de pydantic
    ambiente: Literal["dev", "prod"] = AMBIENTE_DEFAULT


class AmbienteBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)
    ambiente: Literal["dev", "prod"]


class NuevaFacturaBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)


class ConfirmarBody(BaseModel):
    token: str


class AnularBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)
    tipo_cbte: int
    punto_venta: int
    nro: int


def create_afip_app(
    *,
    require_tenant: Callable,
    perfil_store_factory: Callable,
    cred_store_factory: Callable,
    handoff_factory: Callable,
    start_onboarding: Callable,
    consultar_onboarding: Callable | None = None,
    comprobante_store_factory: Callable | None = None,
    iniciar_factura: Callable | None = None,
    consultar_factura: Callable | None = None,
    signal_factura: Callable | None = None,
    iniciar_anulacion: Callable | None = None,
    consultar_anulacion: Callable | None = None,
    signal_anulacion: Callable | None = None,
) -> FastAPI:
    app = FastAPI(title="Copiloto AFIP")

    @app.get("/afip/perfil")
    async def leer_perfil(cuit: str, cliente_id: str = Depends(require_tenant)) -> dict:
        perfil = await asyncio.to_thread(perfil_store_factory(cliente_id).get, cuit)
        return {"perfil": perfil}

    @app.post("/afip/perfil")
    async def guardar_perfil(body: PerfilBody, cliente_id: str = Depends(require_tenant)) -> dict:
        """Valida con las MISMAS reglas que usa la emisión antes de aceptar el perfil.

        Si se validara sólo en el momento de facturar, el usuario cargaría datos en Ajustes, vería un
        tilde verde, y recién descubriría el problema al intentar emitir su primera factura.
        """
        try:
            condicion = CondicionEmisor(body.condicion_iva)
        except ValueError:
            raise HTTPException(422, detail=f"condicion_iva inválida: {body.condicion_iva}") from None

        errores = validar_perfil(PerfilFiscal(
            cuit=body.cuit, razon_social=body.razon_social,
            domicilio_comercial=body.domicilio_comercial, condicion_iva=condicion,
            ingresos_brutos=body.ingresos_brutos, inicio_actividades=body.inicio_actividades,
            punto_venta=body.punto_venta))
        if errores:
            raise HTTPException(422, detail=[{"codigo": e.codigo, "campo": e.campo,
                                              "mensaje": e.mensaje} for e in errores])

        await asyncio.to_thread(
            perfil_store_factory(cliente_id).save, body.cuit,
            razon_social=body.razon_social, domicilio_comercial=body.domicilio_comercial,
            condicion_iva=condicion.value, ingresos_brutos=body.ingresos_brutos,
            inicio_actividades=body.inicio_actividades, punto_venta=body.punto_venta)
        return {"ok": True}

    @app.post("/afip/conectar")
    async def conectar(body: ConectarBody, cliente_id: str = Depends(require_tenant)) -> dict:
        """Alta ante ARCA. Recibe la clave fiscal, la deja en el claim-check y arranca el workflow."""
        if not validar_cuit(body.cuit):
            raise HTTPException(422, detail="CUIT inválido")
        if not body.clave_fiscal.strip():
            raise HTTPException(422, detail="falta la clave fiscal")

        handle = await asyncio.to_thread(
            handoff_factory(cliente_id).stash, ClaveFiscal(body.clave_fiscal))

        # A partir de acá la clave ya no se toca: al workflow sólo viaja el handle.
        workflow_id = await _maybe_async(
            start_onboarding, cliente_id, body.cuit, handle, body.ambiente)
        return {"ok": True, "workflow_id": workflow_id, "ambiente": body.ambiente,
                "mensaje": f"Estamos vinculando tu cuenta con ARCA en "
                           f"{_NOMBRE_AMBIENTE[body.ambiente]}. Puede demorar unos minutos."}

    # -- facturación --------------------------------------------------------
    # Superficie REST sobre la máquina de estados. Cada endpoint manda un signal o lee la query: el
    # estado de la factura vive en el workflow, NO en el front. Si la app se cierra a mitad de la carga,
    # al volver se lee `GET /afip/facturas/{id}` y se sigue donde estaba.

    @app.post("/afip/facturas")
    async def crear_factura(body: NuevaFacturaBody, cliente_id: str = Depends(require_tenant)) -> dict:
        """Abre un borrador. Devuelve el `id` con el que se opera de acá en adelante.

        Sin certificado NO se abre nada: 409. Antes se arrancaba el workflow igual y éste moría en el
        acto con `estado="rechazada"` — que en este dominio se lee como "AFIP rechazó tu factura" y no
        como "todavía no vinculaste tu cuenta". Un usuario nuevo, que es el 100% de los usuarios el
        primer día, veía un rechazo fiscal inventado y además quemaba un workflow por cada toque.
        (Hallazgo de la sesión frontend, 2026-07-21.)
        """
        if iniciar_factura is None:
            raise HTTPException(503, detail="facturación no disponible")

        creds = await asyncio.to_thread(cred_store_factory(cliente_id).get, body.cuit)
        if not creds:
            raise HTTPException(409, detail={
                "codigo": "sin_certificado_afip",
                "mensaje": "Todavía no vinculaste tu cuenta de ARCA."})

        factura_id = await _maybe_async(iniciar_factura, cliente_id, body.cuit)
        return {"ok": True, "factura_id": factura_id}

    @app.get("/afip/facturas/{factura_id}")
    async def estado_factura(factura_id: str, cliente_id: str = Depends(require_tenant)) -> dict:
        """Estado consultable del borrador.

        ⚠️ Para la UI: el primer estado tras crear la factura puede venir con `perfil_ausente` mientras
        el workflow todavía está cargando el contexto. NO es un error — hay que reconsultar hasta que
        converja (típicamente <1s).
        """
        estado = await _maybe_async(consultar_factura, cliente_id, factura_id)
        if estado is None:
            raise HTTPException(404, detail="factura no encontrada")
        return estado

    @app.post("/afip/facturas/{factura_id}/datos-venta")
    async def set_datos_venta(factura_id: str, body: dict,
                              cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_factura, cliente_id, factura_id, "cargar_datos_venta", body)
        return {"ok": True}

    @app.post("/afip/facturas/{factura_id}/items")
    async def agregar_item(factura_id: str, body: dict,
                           cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_factura, cliente_id, factura_id, "agregar_item", body)
        return {"ok": True}

    @app.delete("/afip/facturas/{factura_id}/items/{indice}")
    async def quitar_item(factura_id: str, indice: int,
                          cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_factura, cliente_id, factura_id, "quitar_item", indice)
        return {"ok": True}

    @app.post("/afip/facturas/{factura_id}/cliente")
    async def set_cliente(factura_id: str, body: dict,
                          cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_factura, cliente_id, factura_id, "cargar_cliente", body)
        return {"ok": True}

    @app.post("/afip/facturas/{factura_id}/confirmar")
    async def confirmar_factura(factura_id: str, body: ConfirmarBody,
                                cliente_id: str = Depends(require_tenant)) -> dict:
        """Emite. El `token` sale de `token_confirmacion` del estado — el mismo que se mostró en el resumen.

        Si el borrador cambió después de que la UI leyó el token, esto es un no-op con motivo: el
        usuario tiene que volver a mirar el resumen. Es deliberado, no un bug.
        """
        await _maybe_async(signal_factura, cliente_id, factura_id, "confirmar", body.token)
        return {"ok": True}

    @app.post("/afip/facturas/{factura_id}/cancelar")
    async def cancelar_factura(factura_id: str, cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_factura, cliente_id, factura_id, "cancelar", None)
        return {"ok": True}

    @app.get("/afip/comprobantes")
    async def listar(cuit: str, limite: int = 50,
                     cliente_id: str = Depends(require_tenant)) -> dict:
        """"Mis facturas". ⚠️ `pdf_url` expira a las 24 h de emitida y NO se re-hostea."""
        if comprobante_store_factory is None:
            return {"comprobantes": []}
        filas = await asyncio.to_thread(
            comprobante_store_factory(cliente_id).listar, cuit=cuit, limite=min(int(limite), 200))
        return {"comprobantes": filas}

    @app.post("/afip/comprobantes/anular")
    async def anular(body: AnularBody, cliente_id: str = Depends(require_tenant)) -> dict:
        """Emite la nota de crédito que neutraliza la factura.

        No es un borrado: fiscalmente una factura autorizada no se elimina. La UI tiene que decirlo.
        """
        if iniciar_anulacion is None:
            raise HTTPException(503, detail="anulación no disponible")
        anulacion_id = await _maybe_async(
            iniciar_anulacion, cliente_id, body.cuit, body.tipo_cbte, body.punto_venta, body.nro)
        return {"ok": True, "anulacion_id": anulacion_id}

    @app.get("/afip/anulaciones/{anulacion_id}")
    async def estado_anulacion(anulacion_id: str, cliente_id: str = Depends(require_tenant)) -> dict:
        estado = await _maybe_async(consultar_anulacion, cliente_id, anulacion_id)
        if estado is None:
            raise HTTPException(404, detail="anulación no encontrada")
        return estado

    @app.post("/afip/anulaciones/{anulacion_id}/confirmar")
    async def confirmar_anulacion(anulacion_id: str,
                                  cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_anulacion, cliente_id, anulacion_id, "confirmar", None)
        return {"ok": True}

    @app.get("/afip/estado")
    async def estado(cuit: str | None = None, cliente_id: str = Depends(require_tenant)) -> dict:
        """Lo que la pantalla de Ajustes muestra: si ya puede facturar y, si está en curso, en qué paso.

        `cuit` es OPCIONAL a propósito. Si no viene, se resuelve con el CUIT vinculado por este tenant
        y se DEVUELVE en la respuesta. Sin esto, el CUIT sería estado derivado viviendo en el cliente:
        el emprendedor cambia de teléfono, la app no lo encuentra en el almacenamiento local, y le
        muestra "cargá tus datos fiscales" sobre un perfil que existe — empujándolo a rehacer un alta
        que ya hizo. La app puede cachearlo igual; lo que no puede es ser la fuente de verdad.
        """
        cred_store = cred_store_factory(cliente_id)
        if cuit is None:
            cuit = await asyncio.to_thread(cred_store.primer_cuit)
        if cuit is None:
            # Tenant nuevo: todavía no vinculó nada. No es un error — es el estado inicial de Ajustes.
            return {"cuit": None, "conectado": False, "ws_autorizados": [], "ambiente": None,
                    "ambientes_vinculados": [], "perfil_completo": False, "puede_facturar": False,
                    "onboarding": None}

        creds = await asyncio.to_thread(cred_store.get, cuit)
        vinculados = await asyncio.to_thread(cred_store.ambientes_vinculados, cuit)
        perfil = await asyncio.to_thread(perfil_store_factory(cliente_id).get, cuit)
        progreso = None
        if consultar_onboarding is not None:
            progreso = await _maybe_async(consultar_onboarding, cliente_id, cuit)

        return {
            "cuit": cuit,
            "conectado": bool(creds),
            "ws_autorizados": (creds or {}).get("ws_autorizados") or [],
            "ambiente": (creds or {}).get("ambiente"),
            "ambientes_vinculados": vinculados,
            "perfil_completo": bool(perfil),
            "puede_facturar": bool(creds) and bool(perfil),
            "onboarding": progreso,
        }

    @app.post("/afip/ambiente")
    async def cambiar_ambiente(body: AmbienteBody,
                               cliente_id: str = Depends(require_tenant)) -> dict:
        """Toggle homologación ↔ producción entre ambientes YA vinculados.

        Si el ambiente pedido no tiene certificado devuelve 409, no 500: es un caso esperado del
        producto (el usuario todavía no vinculó ese ambiente), y la app tiene que ofrecerle el alta.
        """
        ok = await asyncio.to_thread(
            cred_store_factory(cliente_id).activar, body.cuit, body.ambiente)
        if not ok:
            raise HTTPException(409, detail={
                "codigo": "ambiente_no_vinculado",
                "ambiente": body.ambiente,
                "mensaje": f"Todavía no vinculaste tu cuenta de ARCA en {_NOMBRE_AMBIENTE[body.ambiente]}."})
        return {"ok": True, "ambiente": body.ambiente}

    return app


async def _maybe_async(fn, *args):
    """Permite inyectar un arrancador sync (tests) o async (cliente real de Temporal)."""
    res = fn(*args)
    if asyncio.iscoroutine(res):
        return await res
    return res
