"""FastAPI de AFIP (capa CLIENTE): perfil fiscal + alta ARCA, para la pantalla de Ajustes.

Molde: `create_mp_app`. Router-fábrica con todas las dependencias inyectadas (testeable con fakes),
`Depends(require_tenant)` para resolver el tenant, e I/O sync (psycopg2 + gateway) vía `asyncio.to_thread`.

🔴 **`POST /afip/conectar` es el único endpoint del sistema que recibe la clave fiscal.** Lo que hace con
ella, en orden: la mete en el claim-check cifrado con TTL de 15 minutos, obtiene un handle opaco, arranca
el workflow con ese handle, y se olvida. La clave nunca se guarda, nunca se loguea, nunca viaja a Temporal
y nunca vuelve en una respuesta.
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone
from typing import Callable, Literal

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from afip_credential_store import ClaveFiscal
from afip_rules import (CondicionEmisor, PerfilFiscal, rango_fechas_permitido,
                        validar_cuit, validar_perfil)
from gasto_store import hoy_del_negocio
from errores_web import (AMBIENTE_NO_VINCULADO, INGRESO_DUPLICADO_PROBABLE,
                         SIN_CERTIFICADO_AFIP, SIN_PERFIL_FISCAL, conflicto)
from cobro_store import CobroInvalido


class CobroBody(BaseModel):
    """Todo opcional salvo la intención. `monto` ausente = **el saldo completo**, que es el caso
    normal (el botón «Cobrada»); mandarlo habilita el parcial.

    `idem_key` es un uuid **por gesto del usuario**, no por request: es lo único que le permite al
    backend distinguir *«cobró dos veces»* de *«tocó dos veces»*. Ver el docstring del endpoint.
    """
    monto: str | float | int | None = None
    medio: str | None = None
    fecha: str | None = None
    idem_key: str | None = None


class IngresoBody(CobroBody):
    """El ingreso DICTADO. **Lo único obligatorio es el monto** — es la especificación textual del
    operador: *«tiene que entrar por voz con la mínima fricción, igual que si se lo dictara a la
    secretaria»*. A una secretaria le decís «me pagaron 85 mil» y lo anota: no te pide la fecha (es
    hoy), ni el medio, ni el número de comprobante.

    `confirmar_duplicado` existe para el segundo turno: si el backend detectó un ingreso parecido
    responde 409 con el candidato, y la app **vuelve a mandar lo mismo con este flag** cuando el
    emprendedor dice que son dos cobros distintos. Avisa, no prohíbe."""
    cliente_ref: int | None = None
    presupuesto_ref: int | None = None
    cliente_nombre: str | None = None
    concepto: str | None = None
    confirmar_duplicado: bool = False


class CompletarIngresoBody(BaseModel):
    """La respuesta al aviso de *«no me dijiste de quién ni cómo te pagaron»*. Parcial de verdad:
    completa el MISMO ingreso, no crea otro.

    🔴 **`fecha` y `monto` son los dos que pidió la card `ingreso_anotado`**, y los dos entran — el
    `monto` recién después de que PLANIFICACIÓN lo decidiera (2026-07-22), no antes:

    - **`fecha`** corrige lo que el resolvedor entendió mal (*«el lunes»* → hoy). Sin ella **no había
      forma de arreglarla nunca**: contestar por chat manda la respuesta al mismo resolvedor que ya
      falló.
    - **`monto`** es el campo **por el que la card existe**: un *«quince mil»* que Whisper oyó
      *«cincuenta mil»* sólo se detecta viéndolo, y una card que lo muestra sin dejar tocarlo **enseña
      que el número está bien**. La alternativa —Deshacer y redictar— son dos pasos, y el segundo
      vuelve a pasar por el reconocimiento que falló.

    **Sin rastro de auditoría, y es deliberado:** un ingreso dictado es la libreta del emprendedor, no
    un comprobante — una factura con CAE no se edita, se anula con nota de crédito. `created_at` no se
    toca al editar, así que se conserva cuándo se anotó. ⚠️ **La condición que lo daría vuelta:** si
    algún día un tercero —contador, exportación firmada, integración bancaria— consume estos ingresos
    como **declaración**, editar plata pasa a necesitar rastro. Hoy no existe ese consumidor.
    """
    cliente_nombre: str | None = None
    medio: str | None = None
    concepto: str | None = None
    cliente_ref: int | None = None
    presupuesto_ref: int | None = None
    fecha: str | None = None
    monto: str | float | int | None = None


class PerfilBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)
    razon_social: str
    domicilio_comercial: str
    condicion_iva: str
    ingresos_brutos: str
    inicio_actividades: date
    punto_venta: int = 1


# Homologación es el default en TODA la superficie: si el ambiente se omite por un bug del cliente o
# un campo que se perdió en un refactor, el peor caso es una factura de prueba sin efecto fiscal. Al
# revés —default a producción— el peor caso es un comprobante fiscal real que el usuario no quiso.
AMBIENTE_DEFAULT = "dev"
_NOMBRE_AMBIENTE = {"dev": "homologación (pruebas)", "prod": "producción"}


class ConectarBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)
    usuario: str
    clave_fiscal: str = Field(repr=False)  # `repr=False`: que no salga en un log de pydantic
    ambiente: Literal["dev", "prod"] = AMBIENTE_DEFAULT


class AmbienteBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)
    ambiente: Literal["dev", "prod"]


class AjustesBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)
    guardar_en_drive: bool


class NuevaFacturaBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)


class ConfirmarBody(BaseModel):
    token: str


class AnularBody(BaseModel):
    cuit: str = Field(min_length=11, max_length=11)
    tipo_cbte: int
    punto_venta: int
    nro: int


def create_afip_app(
    *,
    require_tenant: Callable,
    perfil_store_factory: Callable,
    cred_store_factory: Callable,
    handoff_factory: Callable,
    start_onboarding: Callable,
    consultar_onboarding: Callable | None = None,
    comprobante_store_factory: Callable | None = None,
    cobro_store_factory: Callable | None = None,
    iniciar_factura: Callable | None = None,
    consultar_factura: Callable | None = None,
    signal_factura: Callable | None = None,
    iniciar_anulacion: Callable | None = None,
    consultar_anulacion: Callable | None = None,
    signal_anulacion: Callable | None = None,
    composio_gateway=None,
) -> FastAPI:
    app = FastAPI(title="Copiloto AFIP")

    async def _drive_conectado(cliente_id: str) -> bool | None:
        """¿El tenant tiene Google Drive vinculado? `None` si no se pudo averiguar.

        Nunca levanta: esto se sirve dentro de `GET /afip/estado`, que es la pantalla de Ajustes. Que
        Composio no responda no puede dejar al usuario sin ver si puede facturar — el archivado en
        Drive es una comodidad, el resto de esa respuesta no.
        """
        if composio_gateway is None:
            return None
        try:
            # `composio_user_id == cliente_id` (convención del proyecto, ver `context_factory`).
            estado = await asyncio.to_thread(
                composio_gateway.connection_status, str(cliente_id), "googledrive")
        except Exception:  # noqa: BLE001
            return None
        return str(estado or "").upper() == "ACTIVE"

    @app.get("/afip/perfil")
    async def leer_perfil(cuit: str, cliente_id: str = Depends(require_tenant)) -> dict:
        perfil = await asyncio.to_thread(perfil_store_factory(cliente_id).get, cuit)
        return {"perfil": perfil}

    @app.post("/afip/perfil")
    async def guardar_perfil(body: PerfilBody, cliente_id: str = Depends(require_tenant)) -> dict:
        """Valida con las MISMAS reglas que usa la emisión antes de aceptar el perfil.

        Si se validara sólo en el momento de facturar, el usuario cargaría datos en Ajustes, vería un
        tilde verde, y recién descubriría el problema al intentar emitir su primera factura.
        """
        try:
            condicion = CondicionEmisor(body.condicion_iva)
        except ValueError:
            raise HTTPException(422, detail=f"condicion_iva inválida: {body.condicion_iva}") from None

        errores = validar_perfil(PerfilFiscal(
            cuit=body.cuit, razon_social=body.razon_social,
            domicilio_comercial=body.domicilio_comercial, condicion_iva=condicion,
            ingresos_brutos=body.ingresos_brutos, inicio_actividades=body.inicio_actividades,
            punto_venta=body.punto_venta))
        if errores:
            raise HTTPException(422, detail=[{"codigo": e.codigo, "campo": e.campo,
                                              "mensaje": e.mensaje} for e in errores])

        await asyncio.to_thread(
            perfil_store_factory(cliente_id).save, body.cuit,
            razon_social=body.razon_social, domicilio_comercial=body.domicilio_comercial,
            condicion_iva=condicion.value, ingresos_brutos=body.ingresos_brutos,
            inicio_actividades=body.inicio_actividades, punto_venta=body.punto_venta)
        return {"ok": True}

    @app.post("/afip/ajustes")
    async def guardar_ajustes(body: AjustesBody, cliente_id: str = Depends(require_tenant)) -> dict:
        """Ajuste "guardar mis facturas en Drive".

        409 si el CUIT no tiene perfil: sin fila que actualizar, el UPDATE sería un no-op silencioso y
        el usuario se quedaría con el toggle prendido en pantalla y nada guardado en la base.
        """
        guardado = await asyncio.to_thread(
            perfil_store_factory(cliente_id).set_guardar_en_drive, body.cuit, body.guardar_en_drive)
        if not guardado:
            raise conflicto(SIN_PERFIL_FISCAL,
                            "todavía no cargaste tus datos fiscales para ese CUIT")
        return {"ok": True, "guardar_en_drive": body.guardar_en_drive}

    @app.post("/afip/conectar")
    async def conectar(body: ConectarBody, cliente_id: str = Depends(require_tenant)) -> dict:
        """Alta ante ARCA. Recibe la clave fiscal, la deja en el claim-check y arranca el workflow."""
        if not validar_cuit(body.cuit):
            raise HTTPException(422, detail="CUIT inválido")
        if not body.clave_fiscal.strip():
            raise HTTPException(422, detail="falta la clave fiscal")

        handle = await asyncio.to_thread(
            handoff_factory(cliente_id).stash, ClaveFiscal(body.clave_fiscal))

        # A partir de acá la clave ya no se toca: al workflow sólo viaja el handle.
        workflow_id = await _maybe_async(
            start_onboarding, cliente_id, body.cuit, handle, body.ambiente)
        return {"ok": True, "workflow_id": workflow_id, "ambiente": body.ambiente,
                "mensaje": f"Estamos vinculando tu cuenta con ARCA en "
                           f"{_NOMBRE_AMBIENTE[body.ambiente]}. Puede demorar unos minutos."}

    # -- facturación --------------------------------------------------------
    # Superficie REST sobre la máquina de estados. Cada endpoint manda un signal o lee la query: el
    # estado de la factura vive en el workflow, NO en el front. Si la app se cierra a mitad de la carga,
    # al volver se lee `GET /afip/facturas/{id}` y se sigue donde estaba.

    @app.post("/afip/facturas")
    async def crear_factura(body: NuevaFacturaBody, cliente_id: str = Depends(require_tenant)) -> dict:
        """Abre un borrador. Devuelve el `id` con el que se opera de acá en adelante.

        Sin certificado NO se abre nada: 409. Antes se arrancaba el workflow igual y éste moría en el
        acto con `estado="rechazada"` — que en este dominio se lee como "AFIP rechazó tu factura" y no
        como "todavía no vinculaste tu cuenta". Un usuario nuevo, que es el 100% de los usuarios el
        primer día, veía un rechazo fiscal inventado y además quemaba un workflow por cada toque.
        (Hallazgo de la sesión frontend, 2026-07-21.)
        """
        if iniciar_factura is None:
            raise HTTPException(503, detail="facturación no disponible")

        creds = await asyncio.to_thread(cred_store_factory(cliente_id).get, body.cuit)
        if not creds:
            raise conflicto(SIN_CERTIFICADO_AFIP, "Todavía no vinculaste tu cuenta de ARCA.")

        factura_id = await _maybe_async(iniciar_factura, cliente_id, body.cuit)
        return {"ok": True, "factura_id": factura_id}

    @app.get("/afip/facturas/{factura_id}")
    async def estado_factura(factura_id: str, cliente_id: str = Depends(require_tenant)) -> dict:
        """Estado consultable del borrador.

        ⚠️ Para la UI: el primer estado tras crear la factura puede venir con `perfil_ausente` mientras
        el workflow todavía está cargando el contexto. NO es un error — hay que reconsultar hasta que
        converja (típicamente <1s).
        """
        estado = await _maybe_async(consultar_factura, cliente_id, factura_id)
        if estado is None:
            raise HTTPException(404, detail="factura no encontrada")
        # 🔴 El RANGO, no el predicado. `fecha_valida_para_afip` ya existía «para que la UI pueda
        # deshabilitar fechas antes de que el usuario tipee», pero con un predicado la app tendría que
        # preguntar fecha por fecha — o reimplementar la R4 en TypeScript. **Una regla fiscal escrita
        # en dos lenguajes diverge sola**, y el día que AFIP mueva el margen quedarían dos verdades,
        # con la del cliente ganando porque es la que deshabilita el calendario.
        #
        # `hoy` es el del NEGOCIO (UTC-3) y no `date.today()`: a las 22:00 de Buenos Aires ya es el día
        # siguiente en UTC, y el rango se correría un día justo en el borde donde importa.
        fecha_min, fecha_max = rango_fechas_permitido(
            hoy_del_negocio(datetime.now(timezone.utc)))
        return {**estado, "fecha_min": fecha_min.isoformat(), "fecha_max": fecha_max.isoformat()}

    @app.post("/afip/facturas/{factura_id}/datos-venta")
    async def set_datos_venta(factura_id: str, body: dict,
                              cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_factura, cliente_id, factura_id, "cargar_datos_venta", body)
        return {"ok": True}

    @app.post("/afip/facturas/{factura_id}/items")
    async def agregar_item(factura_id: str, body: dict,
                           cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_factura, cliente_id, factura_id, "agregar_item", body)
        return {"ok": True}

    @app.delete("/afip/facturas/{factura_id}/items/{indice}")
    async def quitar_item(factura_id: str, indice: int,
                          cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_factura, cliente_id, factura_id, "quitar_item", indice)
        return {"ok": True}

    @app.post("/afip/facturas/{factura_id}/cliente")
    async def set_cliente(factura_id: str, body: dict,
                          cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_factura, cliente_id, factura_id, "cargar_cliente", body)
        return {"ok": True}

    @app.post("/afip/facturas/{factura_id}/confirmar")
    async def confirmar_factura(factura_id: str, body: ConfirmarBody,
                                cliente_id: str = Depends(require_tenant)) -> dict:
        """Emite. El `token` sale de `token_confirmacion` del estado — el mismo que se mostró en el resumen.

        Si el borrador cambió después de que la UI leyó el token, esto es un no-op con motivo: el
        usuario tiene que volver a mirar el resumen. Es deliberado, no un bug.
        """
        await _maybe_async(signal_factura, cliente_id, factura_id, "confirmar", body.token)
        # TODO(deuda gestionada · 2026-07-21 · propietario: operador · pagar antes de abrir la API a
        # terceros): este `ok` —y el de los otros cinco endpoints de signal— significa "recibí tu
        # pedido", NO "salió bien". Un signal puede ser un no-op y la respuesta es idéntica: medido,
        # `confirmar` con un token inválido devuelve 200 {"ok": true} y no emite nada. El cliente sólo
        # lo distingue poleando `motivo_codigo`. La app actual lo hace bien, pero el nombre miente y
        # el próximo consumidor va a leerlo como "confirmado".
        # Fix propuesto: `202 Accepted` + {"aceptado": true}. Requiere coordinar con el release del
        # frontend, por eso no se cambió acá. Ver coordinacion/2026-07-21_respuesta_backend-*.md
        return {"ok": True}

    @app.post("/afip/facturas/{factura_id}/cancelar")
    async def cancelar_factura(factura_id: str, cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_factura, cliente_id, factura_id, "cancelar", None)
        return {"ok": True}

    @app.get("/afip/comprobantes")
    async def listar(cuit: str, limite: int = 50,
                     cliente_id: str = Depends(require_tenant)) -> dict:
        """"Mis facturas". ⚠️ `pdf_url` expira a las 24 h de emitida y NO se re-hostea."""
        if comprobante_store_factory is None:
            return {"comprobantes": []}
        filas = await asyncio.to_thread(
            comprobante_store_factory(cliente_id).listar, cuit=cuit, limite=min(int(limite), 200))
        return {"comprobantes": filas}

    # ── COBROS ───────────────────────────────────────────────────────────────────────────────────
    #
    # ⚠️ `/afip/comprobantes/impagos` va ANTES de `/afip/comprobantes/{comprobante_id}`, y no es
    # cosmética: FastAPI resuelve por orden de declaración, así que declarado después, "impagos"
    # entraría por la ruta del `{comprobante_id}: int` y moriría con `422 int_parsing`. Es el mismo
    # guard que ya está anotado abajo — acá es el caso REAL que ese comentario anticipaba.

    def _cobros(cliente_id: str):
        if cobro_store_factory is None:
            raise HTTPException(status_code=503, detail="cobros no disponible")
        return cobro_store_factory(cliente_id)

    @app.get("/afip/comprobantes/impagos")
    async def impagos(cliente_id: str = Depends(require_tenant)) -> dict:
        """*«¿Quién me debe?»* — la pregunta que hasta el hito 3 no se podía contestar.

        Trae las filas **y el total**: la pantalla no suma nada. Si sumara del lado del cliente, el
        total sería correcto sólo si toda la deuda entró en la página pedida — y ese error aparece
        justo cuando hay muchas facturas, que es cuando el número importa.
        """
        return await asyncio.to_thread(_cobros(cliente_id).impagos)

    @app.get("/ingresos")
    async def listar_ingresos(limite: int = 100,
                              cliente_id: str = Depends(require_tenant)) -> dict:
        """TODO lo que entró: facturas cobradas, MercadoPago y lo dictado, **distinguible por origen**."""
        return await asyncio.to_thread(lambda: _cobros(cliente_id).listar_ingresos(limite=limite))

    @app.delete("/ingresos/{ingreso_id}")
    async def borrar_ingreso(ingreso_id: int, cliente_id: str = Depends(require_tenant)) -> dict:
        """Borra un ingreso DICTADO. Que arrepentirse sea fácil es lo que permite que guardar sea
        rápido: si borrar costara más que equivocarse, el sistema tendría que preguntar antes de
        anotar — y preguntar antes es lo que hace que el emprendedor deje de anotar."""
        if not await asyncio.to_thread(_cobros(cliente_id).borrar_ingreso, ingreso_id):
            raise HTTPException(status_code=404, detail="ingreso no encontrado o no es borrable")
        return {"borrado": ingreso_id}

    @app.patch("/ingresos/{ingreso_id}")
    async def completar_ingreso(ingreso_id: int, body: CompletarIngresoBody,
                                cliente_id: str = Depends(require_tenant)) -> dict:
        """Completa lo que faltó, **en el mismo ingreso**. Es la segunda mitad de «guarda igual, pero
        avisa»: el aviso no sirve de nada si contestar crea un registro nuevo."""
        cambios = body.model_dump(exclude_unset=True)
        # El `except` es nuevo y llegó CON `fecha`: hasta que este body la aceptó, `completar` no
        # podía levantar `CobroInvalido` —sólo tocaba texto— así que no hacía falta. Agregar el campo
        # sin esto dejaba una fecha ilegible saliendo como **500**: un error del servidor por un dato
        # del usuario, que además la app no sabe leer. Mismo 400 que las otras dos puertas.
        try:
            ingreso = await asyncio.to_thread(_cobros(cliente_id).completar, ingreso_id, cambios)
        except CobroInvalido as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        if ingreso is None:
            raise HTTPException(status_code=404, detail="ingreso no encontrado")
        return {"ingreso": ingreso}

    @app.post("/ingresos", status_code=201)
    async def registrar_ingreso(body: IngresoBody,
                                cliente_id: str = Depends(require_tenant)) -> dict:
        """Un cobro SIN factura: *«me pagaron 85 mil en efectivo por el trabajo de la panadería»*.

        🔴 **Sin esto la caja miente.** Hasta acá un cobro sólo existía si había pasado por
        MercadoPago: el efectivo y las transferencias no dejaban rastro de ninguna clase, así que
        *«entró $840.000»* dejaba afuera lo que en este mercado puede ser la mitad de los ingresos.

        La respuesta trae `origen: "manual"`. No es decorativo: un cobro que el sistema **vio** no es
        la misma evidencia que uno que alguien **tipeó**, y la pantalla tiene que poder mostrarlo.

        🔴 **Lo único obligatorio es el monto.** Todo lo demás es opcional, a propósito: un formulario
        que exige medio de pago y cliente para anotar que te pagaron es lo que hace que el emprendedor
        deje de anotar — y volvemos a la caja que miente. La respuesta trae `falta: [...]` para que el
        copiloto **avise después de guardar** (*«no me dijiste de quién ni cómo te pagaron»*). Pedir ≠
        exigir, y **la app no puede exigir más que esto**.

        🔴 **El duplicado, en cambio, se pregunta ANTES → 409 con el candidato.** Los dos casos tienen
        costos distintos: un dato faltante **se ve** y se completa cuando aparezca; un ingreso de más
        **infla la caja y no se ve nunca**. Reintentar con `confirmar_duplicado: true` lo guarda igual
        — avisa, no prohíbe: el emprendedor sabe mejor que el sistema si le pagaron dos veces.
        """
        store = _cobros(cliente_id)
        try:
            if not body.confirmar_duplicado:
                candidato = await asyncio.to_thread(
                    lambda: store.posible_duplicado(monto=body.monto,
                                                    cliente_nombre=body.cliente_nombre or ""))
                if candidato:
                    raise conflicto(
                        INGRESO_DUPLICADO_PROBABLE,
                        "hay un ingreso parecido de estos días — ¿es otro cobro o el mismo?",
                        candidato=candidato,
                        # La app no tiene que adivinar cómo insistir: se lo decimos.
                        reintentar_con={"confirmar_duplicado": True})
            cobro = await asyncio.to_thread(
                lambda: store.registrar_suelto(
                    monto=body.monto, medio=body.medio or "", fecha=body.fecha,
                    cliente_ref=body.cliente_ref, presupuesto_ref=body.presupuesto_ref,
                    idem_key=body.idem_key, cliente_nombre=body.cliente_nombre or "",
                    concepto=body.concepto or ""))
        except CobroInvalido as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        return {"ingreso": cobro}

    @app.post("/afip/comprobantes/{comprobante_id}/cobros", status_code=201)
    async def registrar_cobro(comprobante_id: int, body: CobroBody,
                              cliente_id: str = Depends(require_tenant)) -> dict:
        """Registra un cobro (total o parcial). Sin `monto`, cobra **el saldo completo**.

        🔴 **Mandá `idem_key`.** Con clave, repetir la request devuelve el mismo cobro y no crea otro
        —lo garantiza un índice único, no un `if` que tendría carrera—. Sin clave no hay
        deduplicación, **y es correcto**: dos cobros parciales del mismo monto son un caso real, y el
        backend no puede distinguirlos de un doble toque. Esa distinción sólo la sabe quien hizo el
        gesto. Ver [[idempotencia-con-un-if-tiene-ventana]] — el mismo mecanismo que costó dos CAE.

        Códigos: 400 monto ≤ 0 o mayor al saldo · 404 el comprobante no es de este tenant.
        """
        try:
            cobro, resumen = await asyncio.to_thread(
                lambda: _cobros(cliente_id).registrar(
                    comprobante_id, monto=body.monto, medio=body.medio or "",
                    fecha=body.fecha, idem_key=body.idem_key))
        except CobroInvalido as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        if cobro is None:
            raise HTTPException(status_code=404, detail="comprobante no encontrado")
        return {"cobro": cobro, "comprobante": resumen}

    @app.delete("/afip/comprobantes/{comprobante_id}/cobros/{cobro_id}")
    async def borrar_cobro(comprobante_id: int, cobro_id: int,
                           cliente_id: str = Depends(require_tenant)) -> dict:
        """Deshace un cobro mal cargado. Sin esto la única salida sería tocar la base a mano."""
        resumen = await asyncio.to_thread(_cobros(cliente_id).borrar, comprobante_id, cobro_id)
        if resumen is None:
            raise HTTPException(status_code=404, detail="cobro no encontrado")
        return {"comprobante": resumen}

    @app.get("/afip/comprobantes/{comprobante_id}/cobros")
    async def listar_cobros(comprobante_id: int,
                            cliente_id: str = Depends(require_tenant)) -> dict:
        store = _cobros(cliente_id)
        resumen = await asyncio.to_thread(store.resumen, comprobante_id)
        if resumen is None:
            raise HTTPException(status_code=404, detail="comprobante no encontrado")
        cobros = await asyncio.to_thread(store.listar, comprobante_id)
        return {"cobros": cobros, "comprobante": resumen}

    # ⚠️ ORDEN: va DESPUÉS de `/afip/comprobantes`. Hoy no colisiona con `.../anular` porque aquél es
    # POST y éste GET, pero si alguien agrega un `GET /afip/comprobantes/loquesea` debajo de esta
    # línea, el texto va a caer acá y morir con `422 int_parsing`. Mismo guard que en `gastos_web.py`
    # y `clientes_web.py` — el que agregue el primero es el que no va a saber.
    @app.get("/afip/comprobantes/{comprobante_id}")
    async def detalle_comprobante(comprobante_id: int,
                                  cliente_id: str = Depends(require_tenant)) -> dict:
        """El detalle de UN comprobante por su **id de fila** — el único identificador con el que la
        app puede direccionarlo desde afuera (un ítem de «actividad reciente», un link, una
        notificación).

        Lo pidió FRONTEND al cablear el tap: `"factura:42"` no ruteaba a ningún lado porque el listado
        devolvía comprobantes **sin id** y el detalle sólo se abría pasando el objeto entero.

        Ojo con el otro espacio de ids: `/afip/facturas/{factura_id}` toma el **id del workflow** de
        emisión (`presu-12`, un uuid). Ése sirve MIENTRAS se emite; éste, DESPUÉS.

        **404 si es de otro tenant, no 403:** confirmar que ese id existe ya es filtrar información.
        """
        if comprobante_store_factory is None:
            raise HTTPException(503, detail="comprobantes no disponible")
        fila = await asyncio.to_thread(
            comprobante_store_factory(cliente_id).detalle_por_id, comprobante_id)
        if fila is None:
            raise HTTPException(status_code=404, detail="comprobante no encontrado")
        return fila

    @app.post("/afip/comprobantes/anular")
    async def anular(body: AnularBody, cliente_id: str = Depends(require_tenant)) -> dict:
        """Emite la nota de crédito que neutraliza la factura.

        No es un borrado: fiscalmente una factura autorizada no se elimina. La UI tiene que decirlo.
        """
        if iniciar_anulacion is None:
            raise HTTPException(503, detail="anulación no disponible")
        anulacion_id = await _maybe_async(
            iniciar_anulacion, cliente_id, body.cuit, body.tipo_cbte, body.punto_venta, body.nro)
        return {"ok": True, "anulacion_id": anulacion_id}

    @app.get("/afip/anulaciones/{anulacion_id}")
    async def estado_anulacion(anulacion_id: str, cliente_id: str = Depends(require_tenant)) -> dict:
        estado = await _maybe_async(consultar_anulacion, cliente_id, anulacion_id)
        if estado is None:
            raise HTTPException(404, detail="anulación no encontrada")
        return estado

    @app.post("/afip/anulaciones/{anulacion_id}/confirmar")
    async def confirmar_anulacion(anulacion_id: str,
                                  cliente_id: str = Depends(require_tenant)) -> dict:
        await _maybe_async(signal_anulacion, cliente_id, anulacion_id, "confirmar", None)
        return {"ok": True}

    @app.get("/afip/estado")
    async def estado(cuit: str | None = None, cliente_id: str = Depends(require_tenant)) -> dict:
        """Lo que la pantalla de Ajustes muestra: si ya puede facturar y, si está en curso, en qué paso.

        `cuit` es OPCIONAL a propósito. Si no viene, se resuelve con el CUIT vinculado por este tenant
        y se DEVUELVE en la respuesta. Sin esto, el CUIT sería estado derivado viviendo en el cliente:
        el emprendedor cambia de teléfono, la app no lo encuentra en el almacenamiento local, y le
        muestra "cargá tus datos fiscales" sobre un perfil que existe — empujándolo a rehacer un alta
        que ya hizo. La app puede cachearlo igual; lo que no puede es ser la fuente de verdad.
        """
        cred_store = cred_store_factory(cliente_id)
        if cuit is None:
            cuit = await asyncio.to_thread(cred_store.primer_cuit)
        if cuit is None:
            # Tenant nuevo: todavía no vinculó nada. No es un error — es el estado inicial de Ajustes.
            # `drive_conectado` va TAMBIÉN acá: esta rama devuelve un dict aparte, y omitir el campo
            # lo dejaría `undefined` justo en la pantalla del usuario nuevo, que es donde el aviso de
            # conectar Drive más hace falta. Dos returns con formas distintas es una trampa —
            # cualquier campo nuevo hay que acordarse de ponerlo en los dos.
            return {"cuit": None, "conectado": False, "ws_autorizados": [], "ambiente": None,
                    "ambientes_vinculados": [], "perfil_completo": False, "puede_facturar": False,
                    "onboarding": None, "drive_conectado": await _drive_conectado(cliente_id)}

        creds = await asyncio.to_thread(cred_store.get, cuit)
        vinculados = await asyncio.to_thread(cred_store.ambientes_vinculados, cuit)
        perfil = await asyncio.to_thread(perfil_store_factory(cliente_id).get, cuit)
        progreso = None
        if consultar_onboarding is not None:
            progreso = await _maybe_async(consultar_onboarding, cliente_id, cuit)

        return {
            "cuit": cuit,
            "conectado": bool(creds),
            "ws_autorizados": (creds or {}).get("ws_autorizados") or [],
            "ambiente": (creds or {}).get("ambiente"),
            "ambientes_vinculados": vinculados,
            "perfil_completo": bool(perfil),
            "puede_facturar": bool(creds) and bool(perfil),
            "onboarding": progreso,
            # TRES estados, no dos: True / False / None. `None` es "no pude averiguarlo" (Composio no
            # respondió o no está cableado) y NO es lo mismo que "no está conectado". Colapsarlos
            # haría que una caída de Composio se muestre como "conectá tu Drive" sobre una cuenta que
            # sí está vinculada — un rastro pisando el hecho, el error que ya pagamos con el alta.
            "drive_conectado": await _drive_conectado(cliente_id),
        }

    @app.post("/afip/ambiente")
    async def cambiar_ambiente(body: AmbienteBody,
                               cliente_id: str = Depends(require_tenant)) -> dict:
        """Toggle homologación ↔ producción entre ambientes YA vinculados.

        Si el ambiente pedido no tiene certificado devuelve 409, no 500: es un caso esperado del
        producto (el usuario todavía no vinculó ese ambiente), y la app tiene que ofrecerle el alta.
        """
        ok = await asyncio.to_thread(
            cred_store_factory(cliente_id).activar, body.cuit, body.ambiente)
        if not ok:
            raise conflicto(
                AMBIENTE_NO_VINCULADO,
                f"Todavía no vinculaste tu cuenta de ARCA en {_NOMBRE_AMBIENTE[body.ambiente]}.",
                ambiente=body.ambiente)
        return {"ok": True, "ambiente": body.ambiente}

    return app


async def _maybe_async(fn, *args):
    """Permite inyectar un arrancador sync (tests) o async (cliente real de Temporal)."""
    res = fn(*args)
    if asyncio.iscoroutine(res):
        return await res
    return res
