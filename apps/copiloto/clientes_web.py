"""Endpoints de CLIENTES (capa CLIENTE, multi-tenant). Contrato: `contrato_..._clientes`.

**Hito 1 = el punto de encuentro (§9): los dos GET, devolviendo vacío.** El alta, la edición y el
`409` del documento repetido son el hito 3; el backfill, el hito 2. Se despliega esto primero para que
la app cablee en paralelo contra la forma final, sin esperar el resto.

Mismo patrón que `gastos_web.py`: deps inyectadas, se testea entero sin DB. `cliente_id` sale SIEMPRE
de `Depends(require_tenant)`; un id de otro tenant devuelve **404, no 403** —confirmar que un recurso
ajeno existe ya es filtrar información.
"""
from __future__ import annotations

import asyncio
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException

LIMITE_LISTADO_DEFAULT = 50
LIMITE_LISTADO_MAX = 200


def create_clientes_app(*, require_tenant: Callable, cliente_store_factory: Callable) -> FastAPI:
    app = FastAPI(title="Copiloto Clientes")

    # ⚠️ GUARD DEL ORDEN DE RUTAS — leer antes de agregar cualquier ruta acá.
    #
    # FastAPI resuelve por ORDEN DE REGISTRO. **Todo segmento fijo (`/clientes/loquesea`) va declarado
    # ANTES de `/clientes/{cliente}`.** Al revés, el texto cae en la ruta del id, no parsea como
    # entero, y muere con `422 int_parsing` sobre un parámetro que el cliente nunca mandó — un error
    # que manda a buscar el bug del lado equivocado.
    #
    # Hoy no hay ningún segmento fijo, y el guard está igual **por eso mismo**: el que agregue el
    # primero es justamente el que no va a saber. (FRONTEND lo midió sobre `/presupuestos/resumen`, y
    # después encontró que la app arrastraba un `/clientes/opciones` muerto de la herencia clínica —
    # ese se elimina, no sobrevive en ninguna forma.)
    #
    # Si agregás uno: declaralo ARRIBA de `detalle_cliente` y sumale su test por HTTP. Un test que
    # llame al handler directo NO ve esto: el routing no participa.

    @app.get("/clientes")
    async def listar_clientes(q: str = "", limit: int = LIMITE_LISTADO_DEFAULT,
                              cliente_id: str = Depends(require_tenant)) -> dict:
        limit = max(1, min(int(limit), LIMITE_LISTADO_MAX))
        clientes, total = await asyncio.to_thread(
            lambda: cliente_store_factory(cliente_id).listar(q=q, limit=limit))
        # Cartera vacía → 200 con lista vacía. Nunca 404: «todavía no hay clientes» es una pantalla,
        # no un error, y es exactamente el estado hasta que corra el backfill del hito 2.
        return {"clientes": clientes, "total": total}

    @app.get("/clientes/{cliente}")
    async def detalle_cliente(cliente: int, cliente_id: str = Depends(require_tenant)) -> dict:
        ficha = await asyncio.to_thread(cliente_store_factory(cliente_id).detalle, cliente)
        if ficha is None:
            raise HTTPException(status_code=404, detail="cliente no encontrado")
        # Devuelve SECCIONES, no un objeto plano (contrato §13): sumar «sus facturas» o «sus gastos»
        # después no cambia el contrato de los consumidores actuales. `presupuestos` y `facturas`
        # llegan en el hito 3; hoy viajan vacías y declaradas, que es distinto de no estar.
        return {"cliente": ficha, "presupuestos": [], "facturas": []}

    return app
