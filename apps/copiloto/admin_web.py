"""CONSOLA DE OPERADOR (capa CLIENTE). CONS0b: el sujeto de prueba del gate de autorización.

`GET /admin/salud` es el endpoint MÍNIMO que el contrato de CONS0b pide para tener algo real contra
qué correr los 3 tests adversariales (control positivo, 403, no-autoasignación) — no adelanta A1-A6
de las specs (docs/copiloto-emprendedor/2026-08-06-SPECS-consola-de-operador.md), que se implementan
en el sprint siguiente sobre esta misma base.
"""
from __future__ import annotations

from typing import Callable

from fastapi import Depends, FastAPI


def create_admin_app(*, require_admin: Callable) -> FastAPI:
    app = FastAPI(title="Copiloto Consola")

    @app.get("/admin/salud")
    async def salud(claims: dict = Depends(require_admin)) -> dict:
        return {"ok": True}

    return app
