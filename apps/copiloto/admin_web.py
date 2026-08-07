"""CONSOLA DE OPERADOR (capa CLIENTE). CONS0b levantó `GET /admin/salud` como el sujeto de prueba
mínimo del gate de autorización. CONS2 lo llena de contenido real (A1) y agrega A3. CONS3 agrega A5.
CONS4 agrega A4. CONS7 agrega las 2 primeras acciones que MUTAN (7a suspender/reactivar, 7b
reintentar trauma) -- 7c (cambiar tier) queda fuera de v1, sin sustrato (ver el contrato).
`GET /admin/auditoria` (A6) expone `AuditoriaStore.listar()` (ya existía desde CONS1, sin ruta HTTP
propia) -- desbloquea CONS6 (web), que la necesita junto con A5/A4 ya servidas.

`temporal_client`/`consola_conn_factory` son `None` por default para no romper el composition root
de ningún test que sólo ejercite el gate de `require_admin` (CONS0b) sin levantar Temporal/Postgres
de verdad -- en ese caso los endpoints devuelven 503, no un traceback. `conn_factory` (CONS7, nuevo)
es el MISMO que usa el resto de la app (rol dueño, ya envuelto con `conexion_con_tenant` en
`serve.py`) -- `consola_conn_factory` es `SELECT`-only y no puede escribir ni `tenants` ni
`copiloto_auditoria`.
"""
from __future__ import annotations

from typing import Callable

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from admin_errores import buscar_por_id, motivo_prohibido, resumen_errores
from admin_salud import estado_salud
from admin_soporte import resumen_soporte
from admin_tenants import ESTADOS_VALIDOS, cambiar_estado
from admin_uso import resumen_uso
from auditoria_store import AuditoriaStore
from contexto_tenant import tenant
from errores_web import TRAUMA_DOMINIO_PROHIBIDO, conflicto
from trauma_store import TraumaStore


class _CambiarEstadoTenantBody(BaseModel):
    status: str


def create_admin_app(*, require_admin: Callable, temporal_client=None,
                     temporal_namespace: str = "default", temporal_task_queue: str = "agent-emprendedor",
                     consola_conn_factory: Callable | None = None,
                     conn_factory: Callable | None = None) -> FastAPI:
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

    @app.get("/admin/soporte")
    async def soporte(limite: int = 50, claims: dict = Depends(require_admin)) -> dict:
        if consola_conn_factory is None:
            raise HTTPException(status_code=503, detail="rol copiloto_consola no configurado")
        return {"tickets": resumen_soporte(consola_conn_factory, limite=limite)}

    @app.get("/admin/auditoria")
    async def auditoria(cliente_id: str | None = None, admin_user_id: str | None = None,
                        limite: int = 50, claims: dict = Depends(require_admin)) -> dict:
        """A6. `AuditoriaStore.listar()` ya existe desde CONS1 -- este endpoint sólo la expone;
        CONS6 (web) es quien la consume."""
        if consola_conn_factory is None:
            raise HTTPException(status_code=503, detail="rol copiloto_consola no configurado")
        return {"auditoria": AuditoriaStore(consola_conn_factory).listar(
            cliente_id=cliente_id, admin_user_id=admin_user_id, limite=limite)}

    @app.post("/admin/tenants/{cliente_id}/estado")
    async def tenants_estado(cliente_id: str, body: _CambiarEstadoTenantBody,
                             claims: dict = Depends(require_admin)) -> dict:
        """CONS7a. El PUNTO DE APLICACIÓN real es `auth.require_tenant` -- acá sólo se escribe la
        columna y se audita. Idempotente: cambiar al estado que ya tenía igual audita (`§6` del
        contrato: "el intento es el hecho auditable")."""
        if body.status not in ESTADOS_VALIDOS:
            raise HTTPException(status_code=422,
                                detail=f"status debe ser uno de {ESTADOS_VALIDOS}, recibí {body.status!r}")
        if conn_factory is None:
            raise HTTPException(status_code=503, detail="conn_factory no configurado")
        with tenant(cliente_id):
            anterior = cambiar_estado(conn_factory, cliente_id=cliente_id, nuevo_estado=body.status)
            if anterior is None:
                raise HTTPException(status_code=404, detail="tenant no encontrado")
            # ANTES de responder (docstring del módulo): si esto lanza, la mutación no se confirma
            # como exitosa ante el operador -- una mutación sin auditoría es lo que CONS1 impide.
            AuditoriaStore(conn_factory, cliente_id).registrar(
                admin_user_id=claims["sub"], admin_email=claims.get("email") or "",
                accion="tenant.estado",
                detalle={"cliente_id": cliente_id, "de": anterior, "a": body.status})
        return {"cliente_id": cliente_id, "de": anterior, "a": body.status}

    @app.post("/admin/errores/{trauma_id}/reintentar")
    async def errores_reintentar(trauma_id: int, claims: dict = Depends(require_admin)) -> dict:
        """CONS7b. Uno por vez -- no existe (ni va a existir) una ruta de reintento en lote. El
        gate sale de `autosanacion_gates.dominio_prohibido`, la MISMA fuente que usa el ciclo
        automático -- ver `admin_errores.motivo_prohibido`."""
        if consola_conn_factory is None or conn_factory is None:
            raise HTTPException(status_code=503, detail="conn_factory no configurado")
        trauma = buscar_por_id(consola_conn_factory, trauma_id)
        if trauma is None:
            raise HTTPException(status_code=404, detail="trauma no encontrado")
        cliente_id = trauma["cliente_id"]
        dominio = motivo_prohibido(trauma)
        admin_user_id, admin_email = claims["sub"], claims.get("email") or ""
        detalle = {"trauma_id": trauma_id, "fingerprint": trauma["fingerprint"], "dominio": dominio}
        if dominio:
            with tenant(cliente_id):
                # Un intento BLOQUEADO también es un hecho auditable (contrato, DoD de CONS7b) --
                # `resultado != "exitoso"`, nunca se omite la fila sólo porque se rechazó.
                AuditoriaStore(conn_factory, cliente_id).registrar(
                    admin_user_id=admin_user_id, admin_email=admin_email,
                    accion="trauma.reintento", detalle=detalle, resultado="rechazado")
            raise conflicto(
                TRAUMA_DOMINIO_PROHIBIDO,
                f"dominio DIAGNOSTIC_ONLY: {dominio} -- efecto irreversible y externo, nunca se "
                "auto-repara",
                dominio=dominio)
        with tenant(cliente_id):
            TraumaStore(conn_factory, cliente_id).reabrir(trauma_id)
            AuditoriaStore(conn_factory, cliente_id).registrar(
                admin_user_id=admin_user_id, admin_email=admin_email,
                accion="trauma.reintento", detalle=detalle)
        return {"trauma_id": trauma_id, "estado": "pendiente"}

    return app
