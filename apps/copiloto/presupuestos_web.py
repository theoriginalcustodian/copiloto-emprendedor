"""Endpoints de PRESUPUESTOS y PERFIL DEL NEGOCIO (capa CLIENTE, multi-tenant).

Router aparte montado por `web.py` (mismo patrón que `afip_web.py`): las deps entran inyectadas, así
que se testea entero sin Temporal, sin DB y sin Composio reales.

Regla dura del repo: `cliente_id` sale SIEMPRE de `Depends(require_tenant)`. Ningún endpoint acepta un
id de tenant por query o body — y ninguno acepta tampoco un id de recurso ajeno: `/presupuestos/{id}`
resuelve filtrando por el tenant del token, así que un id de otro devuelve 404 (no 403: confirmar que
un recurso ajeno existe ya es filtrar información).

Códigos, declarados (COORDINACION.md §3.bis — el 404 lo define el endpoint):
  400  el body no valida            404  no existe PARA ESTE TENANT
  409  conflicto de estado          422  falta un campo / el path no tipa
"""
from __future__ import annotations

import asyncio
import logging
from decimal import Decimal, InvalidOperation
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from perfil_negocio_store import A_QUIEN, CAMPOS, FORMALIDAD, LARGO_RESPUESTA, LIMITES

_log = logging.getLogger(__name__)

LIMITE_LISTADO_DEFAULT = 50
LIMITE_LISTADO_MAX = 200


# --- perfil del negocio -----------------------------------------------------------

class PerfilBody(BaseModel):
    """Todos los campos opcionales: la actualización es PARCIAL (las claves ausentes no se tocan).

    Se valida a mano y no con `Literal[...]` para poder devolver **400 con el motivo** en vez del 422
    genérico de pydantic: es una pantalla de ajustes, y "a_quien tiene que ser uno de: empresas,
    consumidor_final, ambos" es accionable; "value is not a valid enumeration member" no.
    """
    que_vende: str | None = None
    a_quien: str | None = None
    nombre_comercial: str | None = None
    horario_atencion: str | None = None
    formalidad: str | None = None
    largo_respuesta: str | None = None
    nombre_copiloto: str | None = None


def _validar_perfil(body: PerfilBody) -> dict:
    cambios = {c: getattr(body, c) for c in CAMPOS if getattr(body, c) is not None}
    if not cambios:
        raise HTTPException(status_code=400, detail="no mandaste ningún campo para actualizar")
    for campo, permitidos in (("a_quien", A_QUIEN), ("formalidad", FORMALIDAD),
                              ("largo_respuesta", LARGO_RESPUESTA)):
        if campo in cambios and cambios[campo] not in permitidos:
            raise HTTPException(
                status_code=400,
                detail=f"{campo} tiene que ser uno de: {', '.join(permitidos)}")
    for campo, tope in LIMITES.items():
        if campo in cambios and len(cambios[campo]) > tope:
            raise HTTPException(status_code=400,
                                detail=f"{campo} no puede superar los {tope} caracteres")
    return cambios


# --- presupuestos -----------------------------------------------------------------

class ReceptorBody(BaseModel):
    nombre: str = Field(min_length=1)
    doc_tipo: int | None = None
    doc_nro: str | None = None
    condicion_iva: int | None = 5
    domicilio: str | None = ""
    contacto: str | None = ""


class ItemBody(BaseModel):
    descripcion: str = Field(min_length=1)
    cantidad: str | float | int = 1
    precio_unitario: str | float | int = 0
    codigo: str | None = ""


class NuevoPresupuestoBody(BaseModel):
    concepto: str = Field(min_length=1, max_length=120)
    receptor: ReceptorBody
    items: list[ItemBody] = Field(min_length=1)
    moneda: str = "ARS"
    reemplaza_a: int | None = None


def _decimal_o_400(valor, campo: str) -> Decimal:
    """Los montos llegan como string (§2.2 del contrato: son plata y el float de JS pierde precisión).
    Un valor no numérico es 400 con el campo nombrado, no un 500 al hacer la aritmética."""
    try:
        d = Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(status_code=400, detail=f"{campo} no es un número: {valor!r}") from None
    if d < 0:
        raise HTTPException(status_code=400, detail=f"{campo} no puede ser negativo")
    return d


def create_presupuestos_app(
    *,
    require_tenant: Callable,
    perfil_negocio_store_factory: Callable,
    presupuesto_store_factory: Callable,
    afip_cred_store_factory: Callable | None = None,
    iniciar_factura: Callable | None = None,
    signal_factura: Callable | None = None,
    generar_doc: Callable | None = None,
) -> FastAPI:
    """`generar_doc(cliente_id, presupuesto) -> dict|None` es opcional a propósito: sin él (o si
    falla) el presupuesto se crea igual, sin Doc. La creación NUNCA depende de que Google responda —
    misma decisión que el archivado del PDF en Drive."""
    app = FastAPI(title="Copiloto Presupuestos")

    async def _maybe_async(fn, *args):
        res = fn(*args)
        return await res if asyncio.iscoroutine(res) else res

    async def _cuit_del_tenant(cliente_id: str) -> str | None:
        """El CUIT con el que factura este tenant — el MÁS RECIENTEMENTE vinculado (MVP: uno por
        emprendedor), igual que lo resuelve `GET /afip/estado`.

        Sale del store de credenciales AFIP, su única fuente. No se duplica en el perfil del negocio:
        una segunda copia divergiría y obligaría al usuario a cargarlo dos veces."""
        if afip_cred_store_factory is None:
            return None
        try:
            return await asyncio.to_thread(afip_cred_store_factory(cliente_id).primer_cuit)
        except Exception:  # noqa: BLE001 — sin CUIT resoluble el endpoint responde 409, no 500
            return None

    # --- perfil del negocio -------------------------------------------------------

    @app.get("/perfil-negocio")
    async def leer_perfil(cliente_id: str = Depends(require_tenant)) -> dict:
        """`{"perfil": null}` con 200 —NO 404— cuando el tenant nunca configuró nada.

        Es el estado normal del primer día. Un 404 acá haría que el cliente trate "todavía no lo
        llenó" como "algo salió mal", y encima choca con el 404 semántico del resto del router."""
        perfil = await asyncio.to_thread(perfil_negocio_store_factory(cliente_id).get)
        return {"perfil": perfil}

    @app.post("/perfil-negocio")
    async def guardar_perfil(body: PerfilBody, cliente_id: str = Depends(require_tenant)) -> dict:
        cambios = _validar_perfil(body)          # 400 ANTES de tocar la base: el control de "¿está
                                                 # desplegado?" manda `{}` y no debe escribir nada.
        perfil = await asyncio.to_thread(perfil_negocio_store_factory(cliente_id).upsert, cambios)
        return {"perfil": perfil}

    # --- presupuestos -------------------------------------------------------------

    @app.post("/presupuestos", status_code=201)
    async def crear_presupuesto(body: NuevoPresupuestoBody,
                                cliente_id: str = Depends(require_tenant)) -> dict:
        """Crea el presupuesto y, si se puede, su Doc. El `total` lo calcula el store.

        Orden deliberado: primero la fila (que es la fuente de verdad), después el Doc (que es una
        proyección). Al revés, un fallo de Google dejaría al usuario sin presupuesto por un documento
        que ni siquiera es donde vive el dato."""
        items = []
        for i, it in enumerate(body.items):
            items.append({
                "descripcion": it.descripcion,
                "cantidad": _decimal_o_400(it.cantidad, f"items[{i}].cantidad"),
                "precio_unitario": _decimal_o_400(it.precio_unitario, f"items[{i}].precio_unitario"),
                "codigo": it.codigo or "",
            })
        store = presupuesto_store_factory(cliente_id)
        presupuesto = await asyncio.to_thread(
            lambda: store.crear(concepto=body.concepto, receptor=body.receptor.model_dump(),
                                items=items, moneda=body.moneda, reemplaza_a=body.reemplaza_a))

        if generar_doc is not None:
            try:
                doc = await _maybe_async(generar_doc, cliente_id, presupuesto)
                if doc and doc.get("doc_id"):
                    await asyncio.to_thread(
                        store.adjuntar_doc, presupuesto["id"],
                        doc.get("doc_id"), doc.get("doc_link"), doc.get("sheet_fila"))
                    presupuesto = await asyncio.to_thread(store.detalle, presupuesto["id"])
            except Exception as exc:  # noqa: BLE001 — el Doc es una comodidad, no la fuente de verdad
                _log.warning("presupuesto %s creado SIN Doc (cliente=%s): %s",
                             presupuesto["id"], cliente_id, exc)
        return {"presupuesto": presupuesto}

    @app.get("/presupuestos")
    async def listar_presupuestos(limit: int = LIMITE_LISTADO_DEFAULT,
                                  incluir_reemplazados: bool = False,
                                  cliente_id: str = Depends(require_tenant)) -> dict:
        """Sin presupuestos → `200 {"presupuestos": []}`. Nunca 404: una lista vacía es un resultado.

        Por default oculta los reemplazados (el N° 7 corregido deja de verse cuando existe el N° 8);
        `?incluir_reemplazados=true` trae el historial completo."""
        limit = max(1, min(int(limit), LIMITE_LISTADO_MAX))
        filas = await asyncio.to_thread(
            lambda: presupuesto_store_factory(cliente_id).listar(
                limit=limit, incluir_reemplazados=incluir_reemplazados))
        return {"presupuestos": filas}

    @app.get("/presupuestos/{presupuesto_id}")
    async def detalle_presupuesto(presupuesto_id: int,
                                  cliente_id: str = Depends(require_tenant)) -> dict:
        presupuesto = await asyncio.to_thread(
            presupuesto_store_factory(cliente_id).detalle, presupuesto_id)
        if presupuesto is None:
            raise HTTPException(status_code=404, detail="presupuesto no encontrado")
        return {"presupuesto": presupuesto}

    @app.post("/presupuestos/{presupuesto_id}/facturar")
    async def facturar_presupuesto(presupuesto_id: int,
                                   cliente_id: str = Depends(require_tenant)) -> dict:
        """Arma un BORRADOR de factura con los datos del presupuesto y devuelve su `factura_id`.

        🔴 NO emite. Emitir es un acto fiscal y su gate de confirmación (token atado al contenido
        exacto que se le mostró al usuario) no se saltea ni se duplica: el cliente sigue por
        `GET /afip/facturas/{factura_id}` → `POST .../confirmar`, la pantalla que ya existe.

        409 si ya se facturó de verdad. Se mira `facturado` (el comprobante con CAE), NO `factura_id`:
        un borrador que el usuario canceló deja `factura_id` puesto, y bloquear por eso dejaría el
        presupuesto imposible de facturar para siempre.
        """
        store = presupuesto_store_factory(cliente_id)
        presupuesto = await asyncio.to_thread(store.detalle, presupuesto_id)
        if presupuesto is None:
            raise HTTPException(status_code=404, detail="presupuesto no encontrado")
        if presupuesto.get("facturado"):
            raise HTTPException(status_code=409, detail={
                "mensaje": "el presupuesto ya fue facturado",
                "factura_id": presupuesto.get("factura_id")})
        if iniciar_factura is None or signal_factura is None:
            raise HTTPException(status_code=503, detail="la facturación no está disponible")

        cuit = await _maybe_async(_cuit_del_tenant, cliente_id)
        if not cuit:
            raise HTTPException(status_code=409, detail="falta el perfil fiscal (CUIT)")

        factura_id = await _maybe_async(iniciar_factura, cliente_id, cuit)
        # El receptor primero y los ítems después, en el mismo orden en que los carga la pantalla de
        # factura. Las claves son EXACTAMENTE las que consume `FacturaWorkflow.agregar_item` /
        # `cargar_cliente` — por eso `presupuesto_items` se nombró igual: la transferencia es directa
        # y no hay traducción de campos que pueda driftear.
        await _maybe_async(signal_factura, cliente_id, factura_id, "cargar_cliente", {
            "nombre": presupuesto["receptor"]["nombre"],
            "tipo_doc": presupuesto["receptor"]["doc_tipo"],
            "nro_doc": presupuesto["receptor"]["doc_nro"],
            "condicion_iva": presupuesto["receptor"]["condicion_iva"],
            "domicilio": presupuesto["receptor"]["domicilio"],
        })
        for it in presupuesto.get("items", []):
            await _maybe_async(signal_factura, cliente_id, factura_id, "agregar_item", {
                "descripcion": it["descripcion"], "cantidad": it["cantidad"],
                "precio_unitario": it["precio_unitario"], "codigo": it.get("codigo", "")})
        await asyncio.to_thread(store.marcar_factura, presupuesto_id, factura_id)
        return {"factura_id": factura_id}

    return app
