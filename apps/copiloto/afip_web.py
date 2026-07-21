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
from typing import Callable

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


class ConectarBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)
    usuario: str
    clave_fiscal: str = Field(repr=False)  # `repr=False`: que no salga en un log de pydantic


def create_afip_app(
    *,
    require_tenant: Callable,
    perfil_store_factory: Callable,
    cred_store_factory: Callable,
    handoff_factory: Callable,
    start_onboarding: Callable,
    consultar_onboarding: Callable | None = None,
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
        workflow_id = await _maybe_async(start_onboarding, cliente_id, body.cuit, handle)
        return {"ok": True, "workflow_id": workflow_id,
                "mensaje": "Estamos vinculando tu cuenta con ARCA. Puede demorar unos minutos."}

    @app.get("/afip/estado")
    async def estado(cuit: str, cliente_id: str = Depends(require_tenant)) -> dict:
        """Lo que la pantalla de Ajustes muestra: si ya puede facturar y, si está en curso, en qué paso."""
        creds = await asyncio.to_thread(cred_store_factory(cliente_id).get, cuit)
        perfil = await asyncio.to_thread(perfil_store_factory(cliente_id).get, cuit)
        progreso = None
        if consultar_onboarding is not None:
            progreso = await _maybe_async(consultar_onboarding, cliente_id, cuit)

        return {
            "conectado": bool(creds),
            "ws_autorizados": (creds or {}).get("ws_autorizados") or [],
            "perfil_completo": bool(perfil),
            "puede_facturar": bool(creds) and bool(perfil),
            "onboarding": progreso,
        }

    return app


async def _maybe_async(fn, *args):
    """Permite inyectar un arrancador sync (tests) o async (cliente real de Temporal)."""
    res = fn(*args)
    if asyncio.iscoroutine(res):
        return await res
    return res
