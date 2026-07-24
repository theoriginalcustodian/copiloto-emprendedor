""""Mi día" — endpoints (capa CLIENTE, multi-tenant). Contrato: `mi-dia-y-el-detector-proactivo`.

`GET /mi-dia/tablero` (§2): corre el pipeline completo (`mi_dia_orquestador.avanzar_tablero`) y
devuelve el Kanban actualizado — `{para_hoy: [...], haciendo: [...], hecha: [...]}`. Interino: hoy
el pipeline corre EN el GET (sin Temporal Schedule todavía, deuda visible — ver TODO en
`mi_dia_orquestador.py`); cuando el Schedule exista, este endpoint sólo lee (`TarjetaStore.listar_tablero`)
y el disparo diario lo hace el workflow. La FORMA del endpoint no cambia entre las dos versiones.

`POST /mi-dia/tarjetas`, `PATCH /mi-dia/tarjetas/{id}/estado`, `DELETE /mi-dia/tarjetas/{id}` (§2.4):
manual, y el mismo camino que usan las tools de voz del copiloto.

Mismo patrón que el resto de los `*_web.py`: deps inyectadas, se testea entero sin DB; el
`cliente_id` sale SIEMPRE de `Depends(require_tenant)`.
"""
from __future__ import annotations

import asyncio
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from mi_dia_tarjeta_store import ESTADOS, SOLAPAS_TITULOS, EstadoInvalido


class TarjetaBody(BaseModel):
    texto: str


class EstadoBody(BaseModel):
    """Se valida a mano contra `ESTADOS` para devolver 400 con el motivo, no el 422 genérico de
    pydantic — mismo criterio que `presupuestos_web.EstadoBody`."""
    estado: str


def create_mi_dia_app(*, require_tenant: Callable,
                      tarjeta_store_factory: Callable | None = None,
                      avanzar_tablero_fn: Callable | None = None) -> FastAPI:
    """`tarjeta_store_factory(cliente_id) -> TarjetaStore`. `avanzar_tablero_fn(conn_factory,
    cliente_id)` es `mi_dia_orquestador.avanzar_tablero` — inyectado (no importado directo) para que
    los tests del front-door puedan correr sin DB, igual que el resto de los `*_web.py`.

    Ambos opcionales a propósito: sin ellos el tablero devuelve la forma final vacía, y la app no
    se entera del cambio — mismo criterio que `inteligencia_web.portada`."""
    app = FastAPI(title="Copiloto Mi Día")

    def _store(cliente_id: str):
        if tarjeta_store_factory is None:
            raise HTTPException(status_code=503, detail="Mi día no está disponible")
        return tarjeta_store_factory(cliente_id)

    def _solapas(por_estado: dict) -> dict:
        """`{para_hoy: [...], ...}` (forma interna de `TarjetaStore.listar_tablero`) →
        `{solapas: [{id, titulo, tarjetas}, ...]}` — la forma que consume la app (acordada con
        frontend en el buzón; `id` de solapa = el `estado` interno, orden fijo §2.3)."""
        return {"solapas": [{"id": e, "titulo": SOLAPAS_TITULOS[e], "tarjetas": por_estado.get(e, [])}
                            for e in ESTADOS]}

    @app.get("/mi-dia/tablero")
    async def tablero(cliente_id: str = Depends(require_tenant)) -> dict:
        if tarjeta_store_factory is None or avanzar_tablero_fn is None:
            return _solapas({})
        return _solapas(await asyncio.to_thread(avanzar_tablero_fn, cliente_id))

    @app.post("/mi-dia/tarjetas", status_code=201)
    async def crear_tarjeta(body: TarjetaBody, cliente_id: str = Depends(require_tenant)) -> dict:
        if not body.texto.strip():
            raise HTTPException(status_code=400, detail="texto vacío")
        tarjeta = await asyncio.to_thread(_store(cliente_id).crear_manual, body.texto)
        return {"tarjeta": tarjeta}

    @app.patch("/mi-dia/tarjetas/{tarjeta_id}/estado")
    async def mover_tarjeta(tarjeta_id: int, body: EstadoBody,
                            cliente_id: str = Depends(require_tenant)) -> dict:
        if body.estado not in ESTADOS:
            raise HTTPException(status_code=400,
                                detail=f"estado tiene que ser uno de: {', '.join(ESTADOS)}")
        try:
            tarjeta = await asyncio.to_thread(_store(cliente_id).mover, tarjeta_id, body.estado)
        except EstadoInvalido as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        if tarjeta is None:
            raise HTTPException(status_code=404, detail="tarjeta no encontrada")
        return {"tarjeta": tarjeta}

    @app.delete("/mi-dia/tarjetas/{tarjeta_id}")
    async def borrar_tarjeta(tarjeta_id: int, cliente_id: str = Depends(require_tenant)) -> dict:
        ok = await asyncio.to_thread(_store(cliente_id).borrar, tarjeta_id)
        if not ok:
            raise HTTPException(status_code=404, detail="tarjeta no encontrada")
        return {"ok": True}

    return app
