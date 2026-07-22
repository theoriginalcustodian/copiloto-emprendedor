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

from concepto_store import ConceptoDuplicado, ConceptoInvalido
from perfil_negocio_store import (A_QUIEN, AUTOMATICO, CAMPOS, CONFIRMACION, FORMALIDAD,
                                  LARGO_RESPUESTA, LIMITES, MODOS)
from errores_web import (CONCEPTO_DUPLICADO, FALTA_CUIT, MODO_AUTOMATICO_NO_DISPONIBLE,
                         PRESUPUESTO_NO_FACTURABLE,
                         PRESUPUESTO_YA_FACTURADO, TRANSICION_INVALIDA, conflicto)
from presupuesto_store import ESTADOS, TransicionInvalida, factura_id_de_presupuesto

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
    modo_ceremonia: str | None = None


def _validar_perfil(body: PerfilBody) -> dict:
    cambios = {c: getattr(body, c) for c in CAMPOS if getattr(body, c) is not None}
    if not cambios:
        raise HTTPException(status_code=400, detail="no mandaste ningún campo para actualizar")
    for campo, permitidos in (("a_quien", A_QUIEN), ("formalidad", FORMALIDAD),
                              ("largo_respuesta", LARGO_RESPUESTA),
                              # 🔴 `modo_ceremonia` se valida en la ESCRITURA además de leerse
                              # fail-closed. Sin esto, un `automatic` con typo entraría a la base y
                              # el emprendedor vería «Automático» en la pantalla mientras el backend
                              # —que lee bien— sigue pidiendo confirmación: los dos correctos por
                              # separado, y el producto mintiendo.
                              # El enum sigue aceptando LOS DOS: `automatic` (typo) es un valor que no
                              # existe → 400, y `automatico` es un valor real que está en pausa → 409
                              # con el motivo. Colapsarlos en un 400 «tiene que ser uno de:
                              # confirmacion» le diría a la app que el modo automático no existe, y la
                              # app tendría que inventar el porqué para mostrarlo.
                              ("modo_ceremonia", MODOS)):
        if campo in cambios and cambios[campo] not in permitidos:
            raise HTTPException(
                status_code=400,
                detail=f"{campo} tiene que ser uno de: {', '.join(permitidos)}")
    for campo, tope in LIMITES.items():
        if campo in cambios and len(cambios[campo]) > tope:
            raise HTTPException(status_code=400,
                                detail=f"{campo} no puede superar los {tope} caracteres")
    return cambios


# 🔴 El modo automático se rechaza EN EL BACKEND, no se esconde en la app.
#
# El contrato de modos §3 dice «el backend decide y el backend impone; la app refleja». Si esto
# quedara aceptable por HTTP y sólo gris en la UI, alcanzaría un `POST /perfil-negocio` para ponerse
# en el modo que sabemos peligroso — y la restricción viviría en la capa que el propio contrato dice
# que NO decide.
#
# Por qué está bloqueado: el copiloto narra acciones que no ejecutó a partir del tercer turno, y en
# automático ese fallo es INVISIBLE (no falta ninguna card, el copiloto dice «listo», no hay nada que
# mirar). En confirmación la card es el testigo. Deuda GESTIONADA, con dueño y condición de pago:
# se retira cuando la corrección del motor esté viva. Ver `copiloto-narra-la-accion-sin-ejecutarla`.
_POR_QUE_NO_AUTOMATICO = (
    "El modo automático está en pausa: el copiloto todavía puede decir que hizo algo que no hizo, y "
    "sin la tarjeta de confirmación eso no se ve. Se habilita cuando esté corregido.")


def _modo_habilitado(cambios: dict) -> None:
    if cambios.get("modo_ceremonia") == AUTOMATICO:
        raise conflicto(MODO_AUTOMATICO_NO_DISPONIBLE, _POR_QUE_NO_AUTOMATICO,
                        modo_vigente=CONFIRMACION)


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


class EstadoBody(BaseModel):
    """El estado pedido. Se valida a mano contra `ESTADOS` para devolver 400 con el motivo en vez del
    422 genérico de pydantic: la app necesita saber cuáles son los válidos, no que "no es un miembro
    válido de la enumeración"."""
    estado: str


class ConceptoBody(BaseModel):
    """Alta y edición del catálogo. Todos opcionales porque la edición es **parcial de verdad**: la
    clave ausente no se toca, y `precio_referencia: null` explícito lo borra. Si el body declarara
    valores por defecto, guardar el nombre borraría el precio."""
    nombre: str | None = None
    precio_referencia: str | float | int | None = None
    activo: bool | None = None


def create_presupuestos_app(
    *,
    require_tenant: Callable,
    perfil_negocio_store_factory: Callable,
    presupuesto_store_factory: Callable,
    concepto_store_factory: Callable | None = None,
    afip_cred_store_factory: Callable | None = None,
    abrir_borrador: Callable | None = None,
    consultar_factura: Callable | None = None,
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
        _modo_habilitado(cambios)                # 409 con el motivo, NO un 400 mudo (ver el guard)
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

        🔴 ES IDEMPOTENTE mientras el borrador siga vivo: dos llamadas devuelven el MISMO
        `factura_id`, no dos borradores. Hasta el 2026-07-21 devolvía uno nuevo cada vez —200, sin
        protestar— y el camino terminaba en dos facturas con CAE del mismo trabajo si el usuario
        confirmaba las dos. El botón se toca más de una vez por caminos normales: volver del gate de
        confirmación, un doble tap, dos dispositivos. (Reportado y medido por la sesión FRONTEND.)

        La idempotencia NO se implementa con un `if ya_hay_borrador:` — eso deja una ventana entre
        consultar y crear, justo donde caen los dos toques simultáneos. Se apoya en un `factura_id`
        derivado del presupuesto (`factura_id_de_presupuesto`) y en que Temporal rechaza el segundo
        arranque del mismo workflow_id: la decisión es del servidor y es atómica.

        Códigos: 409 si ya se facturó de verdad (`facturado`, el comprobante con CAE — NO
        `factura_id`, que un borrador cancelado deja puesto y bloquearía el presupuesto para siempre).
        `borrador_nuevo: false` en la respuesta significa "te devuelvo el que ya tenías".
        """
        store = presupuesto_store_factory(cliente_id)
        presupuesto = await asyncio.to_thread(store.detalle, presupuesto_id)
        if presupuesto is None:
            raise HTTPException(status_code=404, detail="presupuesto no encontrado")
        if presupuesto.get("facturado"):
            raise conflicto(PRESUPUESTO_YA_FACTURADO, "el presupuesto ya fue facturado",
                            factura_id=presupuesto.get("factura_id"))
        if abrir_borrador is None or signal_factura is None:
            raise HTTPException(status_code=503, detail="la facturación no está disponible")

        cuit = await _maybe_async(_cuit_del_tenant, cliente_id)
        if not cuit:
            raise conflicto(FALTA_CUIT, "falta el perfil fiscal (CUIT)")

        factura_id = factura_id_de_presupuesto(presupuesto_id)

        # Segunda red, para el hueco que `facturado` no ve: si el borrador anterior EMITIÓ pero su
        # comprobante no llegó a `afip_comprobantes` (falló el guardado), `facturado` sigue en false y
        # sin esto se abriría un borrador nuevo sobre una factura que AFIP ya tiene. La fuente más
        # cercana al hecho es el propio workflow: si su resultado trae CAE, ya se emitió.
        if consultar_factura is not None:
            previo = await _maybe_async(consultar_factura, cliente_id, factura_id)
            if previo and (previo.get("resultado") or {}).get("cae"):
                await asyncio.to_thread(store.marcar_factura, presupuesto_id, factura_id)
                raise conflicto(PRESUPUESTO_YA_FACTURADO, "el presupuesto ya fue facturado",
                                factura_id=factura_id)

        nuevo = await _maybe_async(abrir_borrador, cliente_id, cuit, factura_id)
        if nuevo:
            # Los signals SÓLO en el borrador recién abierto. Re-enviarlos a uno que ya existe
            # DUPLICARÍA sus ítems: `agregar_item` acumula, no reemplaza — y una factura con el doble
            # de todo se ve perfectamente normal.
            #
            # El receptor primero y los ítems después, en el mismo orden en que los carga la pantalla
            # de factura. Las claves son EXACTAMENTE las que consume `FacturaWorkflow.agregar_item` /
            # `cargar_cliente` — por eso `presupuesto_items` se nombró igual: la transferencia es
            # directa y no hay traducción de campos que pueda driftear.
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
        # 🔴 Facturar IMPLICA aprobado (contrato §1): «Aprobado» no tiene botón propio a propósito —
        # nadie marca un estado por marcarlo, así que sale gratis de una acción que el emprendedor iba
        # a hacer igual. Es lo que hace que este estado se sostenga solo en vez de envejecer.
        #
        # Y si estaba `desestimado`, NO se revive en silencio: `cambiar_estado` levanta
        # `TransicionInvalida`. Facturar algo que se declaró perdido es una contradicción que merece
        # una decisión del emprendedor, no un arreglo automático.
        try:
            await asyncio.to_thread(store.cambiar_estado, presupuesto_id, "aprobado")
        except TransicionInvalida as exc:
            raise conflicto(PRESUPUESTO_NO_FACTURABLE,
                            f"el presupuesto está {exc.desde}: no se puede facturar sin revisarlo",
                            estado=exc.desde) from None
        return {"factura_id": factura_id, "borrador_nuevo": nuevo}

    @app.patch("/presupuestos/{presupuesto_id}/estado")
    async def cambiar_estado_presupuesto(presupuesto_id: int, body: EstadoBody,
                                         cliente_id: str = Depends(require_tenant)) -> dict:
        """Marca el desenlace: `aprobado` o `desestimado`.

        Códigos: 400 estado desconocido · 404 no es de este tenant · 409 la transición no existe
        (`desestimado → aprobado` se resuelve emitiendo un presupuesto nuevo, y **volver a
        `pendiente` no existe**: borraría información que alguien declaró).

        Re-marcar el estado que ya tiene devuelve 200, no 409: repetir la misma orden no es un
        conflicto, y la app puede reintentar sin miedo si se le cortó la red.
        """
        if body.estado not in ESTADOS:
            raise HTTPException(status_code=400,
                                detail=f"estado tiene que ser uno de: {', '.join(ESTADOS)}")
        store = presupuesto_store_factory(cliente_id)
        try:
            presupuesto = await asyncio.to_thread(store.cambiar_estado, presupuesto_id, body.estado)
        except TransicionInvalida as exc:
            raise conflicto(TRANSICION_INVALIDA, str(exc), estado=exc.desde) from None
        if presupuesto is None:
            raise HTTPException(status_code=404, detail="presupuesto no encontrado")
        return {"presupuesto": presupuesto}

    # --- catálogo de conceptos ----------------------------------------------------

    def _conceptos(cliente_id: str):
        if concepto_store_factory is None:
            raise HTTPException(status_code=503, detail="el catálogo no está disponible")
        return concepto_store_factory(cliente_id)

    @app.get("/conceptos")
    async def listar_conceptos(incluir_inactivos: bool = False,
                               cliente_id: str = Depends(require_tenant)) -> dict:
        """Sin conceptos → `200 {"conceptos": []}`. Una lista vacía es un resultado, no un 404."""
        filas = await asyncio.to_thread(
            lambda: _conceptos(cliente_id).listar(incluir_inactivos=incluir_inactivos))
        return {"conceptos": filas}

    @app.post("/conceptos", status_code=201)
    async def crear_concepto(body: ConceptoBody, cliente_id: str = Depends(require_tenant)) -> dict:
        store = _conceptos(cliente_id)
        try:
            concepto = await asyncio.to_thread(store.crear, body.nombre or "",
                                               body.precio_referencia)
        except ConceptoInvalido as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        except ConceptoDuplicado as exc:
            # El 409 trae la ficha del que ya está — mismo patrón que Clientes: así la app puede
            # ofrecer abrirlo en vez de dejar al emprendedor adivinando con qué chocó.
            raise conflicto(CONCEPTO_DUPLICADO, "ya tenés un concepto con ese nombre",
                            concepto=exc.existente) from None
        return {"concepto": concepto}

    @app.patch("/conceptos/{concepto_id}")
    async def editar_concepto(concepto_id: int, body: ConceptoBody,
                              cliente_id: str = Depends(require_tenant)) -> dict:
        """Edición PARCIAL: sólo se toca lo que vino en el body.

        `exclude_unset=True` no es un detalle: sin él, editar el nombre mandaría `precio_referencia:
        None` y borraría el precio. La clave ausente y el `null` explícito son cosas distintas.
        """
        cambios = body.model_dump(exclude_unset=True)
        store = _conceptos(cliente_id)
        try:
            concepto = await asyncio.to_thread(store.editar, concepto_id, cambios)
        except ConceptoInvalido as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        except ConceptoDuplicado as exc:
            raise conflicto(CONCEPTO_DUPLICADO, "ya tenés un concepto con ese nombre",
                            concepto=exc.existente) from None
        if concepto is None:
            raise HTTPException(status_code=404, detail="concepto no encontrado")
        return {"concepto": concepto}

    @app.delete("/conceptos/{concepto_id}")
    async def borrar_concepto(concepto_id: int, cliente_id: str = Depends(require_tenant)) -> dict:
        """**Desactiva**, no borra. Un concepto borrado de verdad dejaría los presupuestos viejos
        apuntando a la nada y le arrancaría al grafo la serie histórica de ese precio."""
        concepto = await asyncio.to_thread(_conceptos(cliente_id).desactivar, concepto_id)
        if concepto is None:
            raise HTTPException(status_code=404, detail="concepto no encontrado")
        return {"concepto": concepto}

    return app
