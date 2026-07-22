"""Endpoints de CLIENTES (capa CLIENTE, multi-tenant). Contrato: `contrato_..._clientes`.

**Hito 1 = el punto de encuentro (§9): los dos GET.** **Hito 3 = el alta, la edición parcial y el
`409` con el dueño del documento** (§2, §3.4, §7) — es la precondición del hito 7 de FRONTEND, la
pantalla de alta a mano. El backfill es el hito 2.

Mismo patrón que `gastos_web.py`: deps inyectadas, se testea entero sin DB. `cliente_id` sale SIEMPRE
de `Depends(require_tenant)`; un id de otro tenant devuelve **404, no 403** —confirmar que un recurso
ajeno existe ya es filtrar información.
"""
from __future__ import annotations

import asyncio
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from cliente_store import (DOC_CONSUMIDOR_FINAL, LIMITES, ORIGENES, ClienteDuplicado,
                           documento_incoherente, inferir_doc_tipo, normalizar_documento)

LIMITE_LISTADO_DEFAULT = 50
LIMITE_LISTADO_MAX = 200


class ClienteBody(BaseModel):
    """Todos los campos opcionales **para pydantic** y obligatorios donde corresponde en el handler.

    No es descuido, y es el mismo criterio que `NuevoGastoBody`: pydantic rechaza un faltante con
    **422** y un `detail` en su formato (`[{type, loc, msg}]`); acá hace falta **400 con el motivo en
    texto**, porque es una pantalla donde el emprendedor tiene que leer *«falta el nombre»*.

    🔴 **El mismo body sirve para el alta y para la edición, y ahí está el punto:** la edición es
    PARCIAL, así que el handler no mira los valores sino `model_fields_set` —qué claves vinieron de
    verdad—. Con defaults en `None` y sin ese chequeo, editar el contacto mandaría `domicilio=None` y
    **borraría** el domicilio que vino de las facturas de AFIP, sin que nadie lo haya tocado.
    """
    nombre: str | None = None
    doc_tipo: int | None = None
    doc_nro: str | int | None = None
    condicion_iva: int | None = None
    domicilio: str | None = None
    # 🔴 `email` y `telefono` son DOS claves independientes, no un `contacto` de texto libre.
    # Llenar el mail y dejar el teléfono vacío tiene que mandar **sólo `email`**: si viaja
    # `telefono: ""`, la edición parcial lo interpreta como «borralo» y se lleva puesto el que el
    # backfill sacó de un presupuesto viejo, sin ningún error. Es el mismo bug del domicilio, con
    # otro nombre — y el que ya está cubierto por un test no cubre a éste.
    email: str | None = None
    telefono: str | None = None
    notas: str | None = None
    origen: str | None = None
    # 🔴 `forzar` NO es un campo del cliente: es la respuesta del emprendedor a «ya tenés uno que se
    # llama así». Aplica **sólo** al choque por NOMBRE; contra un choque por documento se ignora, y
    # sigue saliendo 409 — dos CUIT iguales no son dos personas, son un error de tipeo. Se saca del
    # body antes de llegar al store para que no se confunda con un dato a guardar.
    forzar: bool = False


def _validar(datos: dict, *, es_alta: bool) -> dict:
    """Las reglas de §7, sobre las claves que VINIERON. En el alta faltar `nombre` es 400; en la
    edición, no mandarlo es simplemente no cambiarlo."""
    if es_alta or "nombre" in datos:
        nombre = (datos.get("nombre") or "").strip()
        if not nombre:
            raise HTTPException(status_code=400, detail="falta el nombre")
        datos["nombre"] = nombre

    if "doc_nro" in datos and datos["doc_nro"] is not None:
        doc = normalizar_documento(datos["doc_nro"])
        datos["doc_nro"] = doc
        # 🔴 El tipo EXPLÍCITO y el largo del número tienen que poder ser ciertos a la vez. «CUIT» con
        # 7 dígitos no es un dato incompleto: es un dato **imposible**, y hoy entraba — el 400 de abajo
        # sólo mira el caso en que NADIE dijo el tipo. Medido antes de agregarlo: **0 filas existentes**
        # lo incumplen en las tres tablas, así que no traba ninguna edición que hoy funcione.
        motivo = documento_incoherente(datos.get("doc_tipo"), doc)
        if motivo:
            raise HTTPException(status_code=400, detail=motivo)
        if doc and datos.get("doc_tipo") is None:
            # El tipo derivado del largo (11 = CUIT, 7-8 = DNI). Si el número no tiene un largo de
            # documento argentino, es 400: eso ya no es derivar, sería inventar.
            tipo = inferir_doc_tipo(doc)
            if tipo is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"no se reconoce el documento {datos['doc_nro']!r} "
                           f"(un CUIT tiene 11 dígitos y un DNI 7 u 8)")
            datos["doc_tipo"] = tipo

    if datos.get("doc_tipo") is not None and int(datos["doc_tipo"]) == DOC_CONSUMIDOR_FINAL:
        # §3.2. Si esto entrara, la dedup por documento colapsaría TODAS las ventas de mostrador en
        # un único registro fantasma con el grueso de la facturación adentro.
        raise HTTPException(status_code=400,
                            detail="un cliente no puede ser consumidor final (99): "
                                   "una venta a consumidor final es una venta sin cliente")

    if "origen" in datos and datos["origen"] is not None:
        if str(datos["origen"]).strip().lower() not in ORIGENES:
            raise HTTPException(status_code=400,
                                detail=f"origen tiene que ser uno de: {', '.join(ORIGENES)}")
        datos["origen"] = str(datos["origen"]).strip().lower()

    for campo, tope in LIMITES.items():
        if campo in datos and datos[campo] is not None and len(str(datos[campo])) > tope:
            raise HTTPException(status_code=400,
                                detail=f"{campo} no puede superar los {tope} caracteres")
    return datos


def _conflicto(exc: ClienteDuplicado) -> JSONResponse:
    """El `409` de §3.4, **con la ficha entera del dueño** y no sólo su id.

    Para la app esto NO es un error rojo: es *«ya lo tenés»* + llevar a esa ficha. Con el id pelado
    haría falta un segundo GET sólo para poder nombrarlo, y el mensaje que el contrato pide —*«ese
    documento ya es de Juan Pérez»*— depende del nombre.
    """
    quien = (exc.duenio or {}).get("nombre") or "otro cliente"
    return JSONResponse(status_code=409,
                        content={"detail": f"ese {exc.por} ya es de {quien}",
                                 "por": exc.por, "cliente": exc.duenio})


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

    @app.post("/clientes", status_code=201)
    async def crear_cliente(body: ClienteBody, cliente_id: str = Depends(require_tenant)):
        # `exclude_unset` también en el alta: así el store recibe sólo lo que vino y sus defaults
        # valen. Y `_validar` corre ANTES de tocar la base — la sonda de despliegue manda `{}` y
        # tiene que dar 400 sin escribir nada.
        datos = _validar(body.model_dump(exclude_unset=True), es_alta=True)
        datos.setdefault("origen", "manual")
        forzar = bool(datos.pop("forzar", False))
        try:
            return await asyncio.to_thread(
                lambda: cliente_store_factory(cliente_id).crear(forzar=forzar, **datos))
        except ClienteDuplicado as exc:
            return _conflicto(exc)

    @app.post("/clientes/{cliente}")
    async def editar_cliente(cliente: int, body: ClienteBody,
                             cliente_id: str = Depends(require_tenant)):
        """Edición PARCIAL: las claves ausentes no se tocan (§2, §6.bis punto 4).

        🔴 `exclude_unset=True` es toda la regla, y la distinción que hace es la que importa: una
        clave que **no vino** no se toca; una que vino en `null` **borra**. Sin eso, la app que manda
        el objeto entero del formulario pisa con vacíos el domicilio y el contacto que el backfill
        sacó de las facturas de AFIP — datos que ningún formulario muestra porque nadie los cargó a
        mano, y que desaparecerían sin ningún error.
        """
        datos = _validar(body.model_dump(exclude_unset=True), es_alta=False)
        datos.pop("origen", None)      # el origen dice CÓMO nació el cliente; editarlo sería mentir
        forzar = bool(datos.pop("forzar", False))
        try:
            ficha = await asyncio.to_thread(
                lambda: cliente_store_factory(cliente_id).editar(cliente, datos, forzar=forzar))
        except ClienteDuplicado as exc:
            return _conflicto(exc)
        if ficha is None:
            raise HTTPException(status_code=404, detail="cliente no encontrado")
        return ficha

    @app.get("/clientes/{cliente}")
    async def detalle_cliente(cliente: int, cliente_id: str = Depends(require_tenant)) -> dict:
        ficha = await asyncio.to_thread(cliente_store_factory(cliente_id).detalle, cliente)
        if ficha is None:
            raise HTTPException(status_code=404, detail="cliente no encontrado")
        # Devuelve SECCIONES, no un objeto plano (contrato §13): sumar «sus facturas» o «sus gastos»
        # después no cambia el contrato de los consumidores actuales.
        #
        # `presupuestos` y `facturas` viajan vacías y DECLARADAS, que es distinto de no estar. En el
        # hito 1 escribí acá que llegaban «en el hito 3», y estaba mal: el historial se cuelga del
        # `cliente_ref` de §5, que lo llena el backfill — o sea el **hito 2**. Se corrige en vez de
        # dejarlo, porque un comentario que promete una fecha equivocada es peor que no prometer
        # nada: el que lo lee no vuelve a verificar.
        return {"cliente": ficha, "presupuestos": [], "facturas": []}

    return app
