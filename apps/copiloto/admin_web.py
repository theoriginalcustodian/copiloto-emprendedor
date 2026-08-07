"""CONSOLA DE OPERADOR (capa CLIENTE). CONS0b levantó `GET /admin/salud` como el sujeto de prueba
mínimo del gate de autorización. CONS2 lo llena de contenido real (A1) y agrega A3. CONS3 agrega A5.

`temporal_client`/`consola_conn_factory` son `None` por default para no romper el composition root
de ningún test que sólo ejercite el gate de `require_admin` (CONS0b) sin levantar Temporal/Postgres
de verdad -- en ese caso los endpoints devuelven 503, no un traceback.
"""
from __future__ import annotations

from typing import Callable

from fastapi import Depends, FastAPI, HTTPException

from admin_errores import resumen_errores
from admin_salud import estado_salud
from admin_uso import resumen_uso


def create_admin_app(*, require_admin: Callable, temporal_client=None,
                     temporal_namespace: str = "default", temporal_task_queue: str = "agent-emprendedor",
                     consola_conn_factory: Callable | None = None) -> FastAPI:
    app = FastAPI(title="Copiloto Consola")

    @app.get("/admin/salud")
    async def salud(claims: dict = Depends(require_admin)) -> dict:
        if temporal_client is None:
            raise HTTPException(status_code=503, detail="Temporal no conectado en este proceso")
        return await estado_salud(
            temporal_client, namespace=temporal_namespace, task_queue=temporal_task_queue)

    @app.get("/admin/uso")
    async def uso(horas: int = 24, claims: dict = Depends(require_admin)) -> dict:
        if consola_conn_factory is None:
            raise HTTPException(status_code=503, detail="rol copiloto_consola no configurado")
        return resumen_uso(consola_conn_factory, horas=horas)

    @app.get("/admin/errores")
    async def errores(estado: str | None = None, limite: int = 50,
                      claims: dict = Depends(require_admin)) -> dict:
        if consola_conn_factory is None:
            raise HTTPException(status_code=503, detail="rol copiloto_consola no configurado")
        return {"errores": resumen_errores(consola_conn_factory, estado=estado, limite=limite)}

    return app
