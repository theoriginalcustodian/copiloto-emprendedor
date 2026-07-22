"""Endpoints de GASTOS (capa CLIENTE, multi-tenant). Contrato: `contrato_..._gastos-fase1`.

Mismo patrón que `presupuestos_web.py`: deps inyectadas, se testea entero sin DB ni Temporal.

`cliente_id` sale SIEMPRE de `Depends(require_tenant)`; un id de otro tenant devuelve **404, no 403**
—confirmar que un recurso ajeno existe ya es filtrar información.
"""
from __future__ import annotations

import asyncio
import datetime
from decimal import Decimal, InvalidOperation
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from gasto_store import CATEGORIAS, LIMITES, ORIGENES
from trabajo_store import TrabajoInexistente

LIMITE_LISTADO_DEFAULT = 50
LIMITE_LISTADO_MAX = 200


class NuevoGastoBody(BaseModel):
    """Todos los campos son opcionales **para pydantic** y obligatorios donde corresponde en el
    handler. No es descuido: pydantic rechaza un campo faltante con **422** y un `detail` en su
    formato (`[{type, loc, msg}]`), y esto es una pantalla donde el usuario tiene que leer *«falta el
    monto»*. Validando a mano se responde **400 con el motivo en texto**, que es lo que el contrato
    pide y lo que la app puede mostrar tal cual.

    (FRONTEND midió que el endpoint hermano de presupuestos devuelve 422 y avisó que el DoD pedía 400.
    Se resuelve dando 400 de verdad — no bajando el status para contentar a la sonda.)
    """
    monto: str | float | int | None = None
    fecha: str | None = None
    categoria: str | None = None
    proveedor: str | None = None
    medio_pago: str | None = None
    descripcion: str | None = None
    origen: str | None = None
    monto_sugerido: str | float | int | None = None


def _monto_o_400(valor, campo: str = "monto") -> Decimal:
    if valor is None or str(valor).strip() == "":
        raise HTTPException(status_code=400, detail=f"falta {campo}")
    try:
        d = Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(status_code=400, detail=f"{campo} no es un número: {valor!r}") from None
    if d <= 0:
        raise HTTPException(status_code=400, detail=f"{campo} tiene que ser mayor a cero")
    return d


def _fecha_o_400(valor: str | None) -> datetime.date | None:
    if not valor:
        return None
    try:
        return datetime.date.fromisoformat(valor)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400,
                            detail=f"fecha inválida: {valor!r} (se espera YYYY-MM-DD)") from None


def _validar(body: NuevoGastoBody) -> dict:
    monto = _monto_o_400(body.monto)
    categoria = (body.categoria or "otros").strip().lower()
    if categoria not in CATEGORIAS:
        raise HTTPException(status_code=400,
                            detail=f"categoria tiene que ser una de: {', '.join(CATEGORIAS)}")
    origen = (body.origen or "").strip().lower()
    if origen not in ORIGENES:
        raise HTTPException(status_code=400,
                            detail=f"origen tiene que ser uno de: {', '.join(ORIGENES)}")
    campos = {"proveedor": body.proveedor or "", "medio_pago": body.medio_pago or "",
              "descripcion": body.descripcion or ""}
    for campo, tope in LIMITES.items():
        if len(campos[campo]) > tope:
            raise HTTPException(status_code=400,
                                detail=f"{campo} no puede superar los {tope} caracteres")
    return {"monto": monto, "fecha": _fecha_o_400(body.fecha), "categoria": categoria,
            "origen": origen,
            "monto_sugerido": (_monto_o_400(body.monto_sugerido, "monto_sugerido")
                               if body.monto_sugerido is not None else None),
            **campos}


class ImputacionBody(BaseModel):
    """A qué trabajo se imputa el gasto. **`eslabon: null` desimputa** — y desimputar tiene que ser
    tan fácil como imputar: si corregir un error costara más que cometerlo, el emprendedor deja los
    datos mal antes que pelearse con la pantalla."""
    eslabon: str | None = None
    ref: int | None = None


def create_gastos_app(*, require_tenant: Callable, gasto_store_factory: Callable,
                      trabajo_store_factory: Callable | None = None) -> FastAPI:
    app = FastAPI(title="Copiloto Gastos")

    import asyncio

    # 🔴 `/gastos/resumen` se declara ANTES de `/gastos/{gasto_id}`. FastAPI resuelve por ORDEN DE
    # REGISTRO: al revés, el segmento textual "resumen" cae en la ruta del id, no parsea como entero,
    # y el resumen muere con `422 int_parsing` sobre un parámetro que el cliente nunca mandó — de los
    # errores que mandan a buscar el bug del lado equivocado.
    #
    # Lo midió FRONTEND contra `/presupuestos/resumen` (que no existe y devuelve exactamente ese 422)
    # ANTES de que este archivo existiera. Mover estas dos funciones de orden lo rompe en silencio:
    # por eso `test_gastos_web.py` lo ejercita por HTTP, donde el routing sí participa.
    @app.get("/gastos/resumen")
    async def resumen_gastos(periodo: str | None = None,
                             cliente_id: str = Depends(require_tenant)) -> dict:
        if periodo:
            try:
                datetime.date.fromisoformat(f"{periodo}-01")
            except (ValueError, TypeError):
                raise HTTPException(status_code=400,
                                    detail=f"periodo inválido: {periodo!r} (se espera YYYY-MM)") from None
        return await asyncio.to_thread(gasto_store_factory(cliente_id).resumen, periodo)

    @app.post("/gastos", status_code=201)
    async def crear_gasto(body: NuevoGastoBody,
                          cliente_id: str = Depends(require_tenant)) -> dict:
        datos = _validar(body)      # 400 ANTES de tocar la base: la sonda manda `{}` y no debe escribir
        return await asyncio.to_thread(lambda: gasto_store_factory(cliente_id).crear(**datos))

    @app.get("/gastos")
    async def listar_gastos(limit: int = LIMITE_LISTADO_DEFAULT,
                            cliente_id: str = Depends(require_tenant)) -> dict:
        limit = max(1, min(int(limit), LIMITE_LISTADO_MAX))
        gastos, total = await asyncio.to_thread(
            lambda: gasto_store_factory(cliente_id).listar(limit=limit))
        # Sin gastos → 200 con lista vacía. Nunca 404: una lista vacía es un resultado, y es
        # exactamente el estado del primer día.
        return {"gastos": gastos, "total": total}

    @app.get("/gastos/{gasto_id}")
    async def detalle_gasto(gasto_id: int, cliente_id: str = Depends(require_tenant)) -> dict:
        gasto = await asyncio.to_thread(gasto_store_factory(cliente_id).detalle, gasto_id)
        if gasto is None:
            raise HTTPException(status_code=404, detail="gasto no encontrado")
        return gasto

    # --- imputación al trabajo (addendum del hito 3) ------------------------------

    def _trabajos(cliente_id: str):
        if trabajo_store_factory is None:
            raise HTTPException(status_code=503, detail="la imputación no está disponible")
        return trabajo_store_factory(cliente_id)

    @app.put("/gastos/{gasto_id}/imputacion")
    async def imputar(gasto_id: int, body: ImputacionBody,
                      cliente_id: str = Depends(require_tenant)) -> dict:
        """Imputa el gasto a un trabajo, o lo desimputa con `{"eslabon": null}`.

        🔴 **Imputar NUNCA es obligatorio.** El gasto ya entró a la caja sin esto; lo que se gana es el
        margen de ese trabajo. Si imputar se volviera un requisito, el emprendedor dejaría de cargar
        gastos — y perderíamos el dato bueno por exigir el perfecto.

        Códigos: 400 eslabón desconocido · 404 el gasto **o el trabajo** no son de este tenant.
        """
        try:
            resultado = await asyncio.to_thread(
                _trabajos(cliente_id).imputar, gasto_id, body.eslabon, body.ref)
        except TrabajoInexistente:
            raise HTTPException(status_code=404, detail="ese trabajo no existe") from None
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        if resultado is None:
            raise HTTPException(status_code=404, detail="gasto no encontrado")
        return {"imputacion": resultado}

    @app.get("/trabajos/{eslabon}/{ref}/margen")
    async def margen(eslabon: str, ref: int, cliente_id: str = Depends(require_tenant)) -> dict:
        """*«¿Cuánto me dejó este trabajo?»* — desde cualquiera de los tres eslabones, mismo resultado.

        ⚠️ Devuelve `gastos_imputados` **al lado del número, siempre**. Un trabajo con 2 de 5 gastos
        imputados muestra un margen excelente y es falso: un margen incompleto se ve igual que uno
        bueno, y sin el conteo la pantalla no tiene con qué avisar.
        """
        try:
            return await asyncio.to_thread(_trabajos(cliente_id).margen, eslabon, ref)
        except TrabajoInexistente:
            raise HTTPException(status_code=404, detail="ese trabajo no existe") from None
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None

    return app
