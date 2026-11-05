"""Rutas del PROPIO usuario sobre sus datos (SEC-D8 · ISO 27701 7.3): portabilidad y supresión.

La identidad sale SIEMPRE del token (`require_tenant`): estas rutas no reciben `cliente_id` ni en path,
ni en query, ni en body — un tenant no puede apuntar a otro (OWASP API1:2023; ver
`test_tenant_erasure_adversarial.py`). El borrado exige confirmación explícita en el body para que un
`DELETE` accidental no destruya la cuenta, y es ASÍNCRONO: arranca el `TenantErasureWorkflow` durable
(202) y el estado real lo da Temporal, no un `ok` optimista.
"""
from __future__ import annotations

from typing import Awaitable, Callable

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

import tenant_erasure_store as store

CONFIRMACION = "BORRAR MI CUENTA"


class _BorrarCuentaBody(BaseModel):
    confirmar: str = ""


def create_cuenta_app(*, require_tenant: Callable, conn_factory: Callable | None = None,
                      iniciar_borrado: Callable[[str, str, str], Awaitable[None]] | None = None) -> FastAPI:
    app = FastAPI(title="Copiloto Cuenta")

    @app.get("/cuenta/exportar")
    def exportar(cliente_id: str = Depends(require_tenant)) -> dict:
        if conn_factory is None:
            raise HTTPException(status_code=503, detail="exportación no disponible")
        return store.exportar_datos(conn_factory, cliente_id)

    @app.delete("/cuenta", status_code=202)
    async def borrar(body: _BorrarCuentaBody, cliente_id: str = Depends(require_tenant)) -> dict:
        if body.confirmar != CONFIRMACION:
            raise HTTPException(status_code=422, detail=f"confirmar debe ser exactamente {CONFIRMACION!r}")
        if iniciar_borrado is None:
            raise HTTPException(status_code=503, detail="borrado no disponible")
        await iniciar_borrado(cliente_id, cliente_id, "")
        return {"estado": "en_curso"}

    return app
