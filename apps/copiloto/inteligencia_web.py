"""INTELIGENCIA DE NEGOCIO — endpoints (capa CLIENTE, multi-tenant). Contrato: `contrato_..._inteligencia-de-negocio`.

Hoy sólo `GET /inteligencia/portada` (el §3.1 del `contrato_..._ADELANTAR`): el resumen del negocio —
caja, mes, serie, mejores clientes, por cobrar— contra la **forma final**, que es el punto de
encuentro temprano (§6). La app ya cableó su adapter contra esta forma (`packages/core/.../inteligencia.ts`),
así que la clave de arriba `caja` **tiene que estar siempre**: el adapter la usa de centinela para
distinguir "la portada respondió" de "la ruta no existe y el front-door devolvió el HTML del SPA"
(`catch-all-vuelve-no-desplegado-indistinguible-de-roto`).

Mismo patrón que el resto de los `*_web.py`: deps inyectadas, se testea entero sin DB ni Temporal; el
`cliente_id` sale SIEMPRE de `Depends(require_tenant)`. Los gráficos y el chat (§2/§3 del contrato)
son endpoints siguientes sobre la MISMA capa de queries (`inteligencia_queries`) — el invariante §0.
"""
from __future__ import annotations

import asyncio
from typing import Callable

from fastapi import Depends, FastAPI


def create_inteligencia_app(*, require_tenant: Callable,
                            queries_factory: Callable | None = None) -> FastAPI:
    """`queries_factory(cliente_id) -> InteligenciaQueries`. Opcional a propósito: sin él (los tests
    del front-door que no arman DB) el endpoint devuelve la forma final con datos en cero, y la app no
    se entera del cambio — la misma forma en los dos casos, como `actividad_web`."""
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

    return app
