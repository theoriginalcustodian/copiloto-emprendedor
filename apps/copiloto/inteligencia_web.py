"""INTELIGENCIA DE NEGOCIO — endpoints (capa CLIENTE, multi-tenant). Contrato: `contrato_..._inteligencia-de-negocio`.

`GET /inteligencia/portada` (§3.1): el resumen del negocio — caja, mes, serie, mejores clientes, por
cobrar. La app ya cableó su adapter contra esta forma (`packages/core/.../inteligencia.ts`), así que la
clave de arriba `caja` **tiene que estar siempre**: el adapter la usa de centinela para distinguir "la
portada respondió" de "la ruta no existe y el front-door devolvió el HTML del SPA"
(`catch-all-vuelve-no-desplegado-indistinguible-de-roto`).

`GET /inteligencia/graficos/{facturacion,entro-vs-salio,categorias,margen-trabajo}` (§2,
`dato_..._IN-capa-de-queries-forma-final`): los 4 gráficos. Cada uno acepta `?detalle=<segmento>` —
MISMA query, agregado o desglosado, sin segundo camino al mismo número (§0). `entro-vs-salio` reusa
`_serie_mensual` de la portada tal cual, sólo renombra las claves; `margen-trabajo` reusa
`TrabajoStore.margen()` (la ficha del presupuesto), agregado por raíz de cadena. El chat (§3) viene en
un módulo aparte, todavía no expuesto acá.

Mismo patrón que el resto de los `*_web.py`: deps inyectadas, se testea entero sin DB ni Temporal; el
`cliente_id` sale SIEMPRE de `Depends(require_tenant)`.
"""
from __future__ import annotations

import asyncio
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from trabajo_store import TrabajoInexistente


class ChatIn(BaseModel):
    texto: str
    session_id: str = ""


def create_inteligencia_app(*, require_tenant: Callable,
                            queries_factory: Callable | None = None,
                            chat_factory: Callable | None = None) -> FastAPI:
    """`queries_factory(cliente_id) -> InteligenciaQueries`. `chat_factory(cliente_id) ->
    InteligenciaChat`. Ambos opcionales a propósito: sin ellos (los tests del front-door que no arman
    DB/LLM) el endpoint devuelve la forma final con datos en cero, y la app no se entera del cambio —
    la misma forma en los dos casos, como `actividad_web`."""
    app = FastAPI(title="Copiloto Inteligencia")

    @app.get("/inteligencia/portada")
    async def portada(cliente_id: str = Depends(require_tenant)) -> dict:
        if queries_factory is None:
            # Forma final, datos vacíos: los importes en "0.00" son un cero CALCULADO (no hay
            # movimientos), no un dato ausente — la app distingue por la presencia de la clave `caja`.
            return {
                "caja": {"saldo": "0.00", "moneda": "ARS"},
                "mes": {"ingresos": "0.00", "gastos": "0.00", "rentabilidad": "0.00",
                        "facturado": "0.00", "cobrado": "0.00"},
                "serie_mensual": [],
                "mejores_clientes": [],
                "por_cobrar": {"total": "0.00", "vencido": "0.00"},
            }
        return await asyncio.to_thread(lambda: queries_factory(cliente_id).portada())

    @app.get("/inteligencia/graficos/facturacion")
    async def facturacion(detalle: str | None = None, cliente_id: str = Depends(require_tenant)) -> dict:
        if queries_factory is None:
            return {"mes": detalle, "filas": []} if detalle else \
                   {"tipo": "barras", "periodo": "", "serie": []}
        q = queries_factory(cliente_id)
        if detalle:
            return await asyncio.to_thread(lambda: q.facturacion_detalle_mes(detalle))
        return await asyncio.to_thread(q.facturacion_por_mes)

    @app.get("/inteligencia/graficos/entro-vs-salio")
    async def entro_vs_salio(detalle: str | None = None,
                             cliente_id: str = Depends(require_tenant)) -> dict:
        if queries_factory is None:
            if detalle:
                mes, _, lado = detalle.partition(":")
                return {"mes": mes, "lado": lado or "entro", "filas": []}
            return {"tipo": "barras_enfrentadas", "periodo": "", "serie": []}
        q = queries_factory(cliente_id)
        if detalle:
            mes, sep, lado = detalle.partition(":")
            if not sep:
                raise HTTPException(status_code=400, detail="detalle tiene que ser <mes>:<entro|salio>")
            try:
                return await asyncio.to_thread(lambda: q.entro_vs_salio_detalle(mes, lado))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
        return await asyncio.to_thread(q.entro_vs_salio)

    @app.get("/inteligencia/graficos/categorias")
    async def categorias(mes: str | None = None, detalle: str | None = None,
                         cliente_id: str = Depends(require_tenant)) -> dict:
        if queries_factory is None:
            if detalle:
                return {"mes": mes, "categoria": detalle, "filas": []}
            return {"tipo": "torta", "periodo": mes or "", "serie": []}
        q = queries_factory(cliente_id)
        try:
            if detalle:
                return await asyncio.to_thread(lambda: q.categoria_detalle(mes, detalle))
            return await asyncio.to_thread(lambda: q.torta_categorias(mes))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    @app.get("/inteligencia/graficos/margen-trabajo")
    async def margen_trabajo(detalle: str | None = None,
                             cliente_id: str = Depends(require_tenant)) -> dict:
        if queries_factory is None:
            if detalle:
                eslabon, _, ref = detalle.partition(":")
                return {"trabajo": {"presupuesto": None, "comprobante": None, "cobros": []},
                       "cobrado": "0.00", "gastado": "0.00", "margen": "0.00", "gastos_imputados": 0}
            return {"tipo": "barras", "trabajos": [], "sin_ingreso": []}
        q = queries_factory(cliente_id)
        if detalle:
            eslabon, sep, ref = detalle.partition(":")
            if not sep or not ref.isdigit():
                raise HTTPException(status_code=400,
                                    detail="detalle tiene que ser <eslabon>:<ref numérico>")
            try:
                return await asyncio.to_thread(lambda: q.margen_trabajo_detalle(eslabon, int(ref)))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
            except TrabajoInexistente as e:
                raise HTTPException(status_code=404, detail="trabajo inexistente") from e
        return await asyncio.to_thread(q.margen_por_trabajo)

    @app.post("/inteligencia/chat")
    async def chat(payload: ChatIn, cliente_id: str = Depends(require_tenant)) -> dict:
        if chat_factory is None:
            return {"respuesta": "No tengo ese dato.", "fuente": "no-se"}
        c = chat_factory(cliente_id)
        return await asyncio.to_thread(lambda: c.responder(payload.texto))

    return app
