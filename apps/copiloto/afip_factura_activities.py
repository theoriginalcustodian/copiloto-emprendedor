"""Activities de emisión, anulación y consulta de comprobantes (capa CLIENTE).

Separadas del workflow (mismo criterio que `afip_onboarding_activities`): corren fuera del sandbox de
Temporal, así que pueden importar el gateway y psycopg2. I/O bloqueante vía `asyncio.to_thread`.

**Reparto de responsabilidades:** acá NO se decide nada fiscal. El payload llega ya armado y validado
por `afip_rules` desde el workflow; estas funciones sólo hablan con AFIP y con la base. Si una regla
fiscal apareciera acá, existiría en dos lugares y se desincronizaría.
"""
from __future__ import annotations

from latido import con_latido
import asyncio
from datetime import date, datetime

from temporalio import activity
from temporalio.exceptions import ApplicationError

_gateway_factory = None
_cred_store_factory = None
_perfil_store_factory = None
_comprobante_store_factory = None
_composio_gateway = None


def set_factura_deps(gateway_factory, cred_store_factory, perfil_store_factory,
                     comprobante_store_factory) -> None:
    """Inyecta las fábricas per-tenant. SYNC, se llama en el composition root del worker."""
    global _gateway_factory, _cred_store_factory, _perfil_store_factory, _comprobante_store_factory
    _gateway_factory = gateway_factory
    _cred_store_factory = cred_store_factory
    _perfil_store_factory = perfil_store_factory
    _comprobante_store_factory = comprobante_store_factory


def set_drive_deps(composio_gateway) -> None:
    """El gateway Composio para archivar el PDF en el Drive del emprendedor.

    Aparte de `set_factura_deps` y no dentro: el archivado es opcional y no comparte nada con la
    emisión. Un worker sin Composio cableado sigue emitiendo facturas — sólo no archiva.
    """
    global _composio_gateway
    _composio_gateway = composio_gateway


def _gateway_con_certificado(cliente_id: str, cuit: str):
    """Construye el gateway con el certificado ACTIVO del tenant. Fail-closed si no lo tiene.

    El ambiente sale de la credencial, NO de una constante: el certificado de producción sólo sirve
    contra el endpoint de producción. Antes se construía siempre en homologación, así que un tenant
    con credencial de producción emitía —o intentaba emitir— contra el ambiente equivocado.
    """
    creds = _cred_store_factory(cliente_id).get(cuit)
    if not creds:
        raise ApplicationError(
            f"el tenant no tiene certificado AFIP para el CUIT {cuit}",
            type="SinCertificado", non_retryable=True)
    return _gateway_factory(cuit, creds["cert"], creds["key"], creds.get("ambiente", "dev"))


def _cargar_contexto_sync(cliente_id: str, cuit: str) -> dict:
    perfil = _perfil_store_factory(cliente_id).get(cuit)
    tiene_cert = _cred_store_factory(cliente_id).get(cuit) is not None
    if perfil and isinstance(perfil.get("inicio_actividades"), date):
        perfil = {**perfil, "inicio_actividades": perfil["inicio_actividades"].isoformat()}
    return {"perfil": perfil, "tiene_certificado": tiene_cert}


@activity.defn
async def cargar_contexto_factura(cliente_id: str, cuit: str) -> dict:
    """Perfil fiscal + si hay certificado. El workflow lo necesita para validar antes de emitir."""
    return await asyncio.to_thread(_cargar_contexto_sync, cliente_id, cuit)


def _emitir_sync(cliente_id: str, cuit: str, payload: dict, idem_key: str,
                 workflow_id: str, receptor_nombre: str = "",
                 nro_reservado: int | None = None) -> dict:
    """Emite en AFIP y registra el comprobante. Idempotente en dos capas.

    Capa 1 — la base: si `idem_key` ya tiene un comprobante registrado, se devuelve ese sin volver a
    emitir. Cubre el reintento después de un éxito completo.

    Capa 2 — AFIP: antes de emitir se pregunta si el número **que vamos a usar** ya fue autorizado.
    Cubre la ventana fea: AFIP autorizó, el proceso se cayó antes de registrar, y el reintento estaría
    por emitir una SEGUNDA factura. Una factura duplicada sólo se arregla con una nota de crédito.

    ⚠️ **Por qué `nro_reservado` viene de afuera.** Calcular el número acá (`ultimo_autorizado + 1`)
    hacía que la capa 2 fuera inútil justo en el caso que dice cubrir: si AFIP autorizó el 11 y la
    respuesta se perdió, el reintento consulta `getLastVoucher` → ya devuelve **11** → pregunta por el
    **12**, que por construcción nunca se emitió → "no existe" → **emite el 12**. Dos CAE por un
    pedido. Con el número reservado por el workflow —que es durable y no recalcula— el reintento
    interroga el **mismo** número que intentó, que es la única pregunta que puede detectar la
    autorización perdida. Default `None` para no romper el replay de las ejecuciones que arrancaron
    con 6 argumentos (mismo criterio que `receptor_nombre`).
    """
    store = _comprobante_store_factory(cliente_id)
    ya = store.por_idem_key(idem_key)
    if ya:
        return {"ok": True, "duplicado": True, **ya}

    gateway = _gateway_con_certificado(cliente_id, cuit)
    punto_venta = int(payload["PtoVta"])
    tipo_cbte = int(payload["CbteTipo"])

    # `CbtesAsoc` es lo que convierte a este comprobante en la nota de crédito que anula a otro, y no
    # en una NC suelta (ver `armar_payload_nota_credito`). Guardar ese puntero en NUESTRO libro —en la
    # MISMA escritura que el CAE— es lo que después permite preguntar "¿esta factura ya tiene una NC?"
    # sin depender del flag `estado`, que lo escribe un UPDATE posterior y separado que puede fallar.
    _asoc = (payload.get("CbtesAsoc") or [None])[0]
    cbte_asoc_nro = (int(_asoc["Nro"])
                     if isinstance(_asoc, dict) and _asoc.get("Nro") is not None else None)

    siguiente = (nro_reservado if nro_reservado is not None
                 else gateway.ultimo_comprobante(punto_venta=punto_venta, tipo_cbte=tipo_cbte) + 1)
    if gateway.existe_comprobante(numero=siguiente, punto_venta=punto_venta, tipo_cbte=tipo_cbte):
        info = gateway.info_comprobante(numero=siguiente, punto_venta=punto_venta, tipo_cbte=tipo_cbte)
        activity.logger.warning(
            "el comprobante %s-%s ya estaba autorizado en AFIP: se adopta en vez de reemitir",
            punto_venta, siguiente)
        # El campo del código de autorización CAMBIA según la operación del WS: `FECompConsultar`
        # lo devuelve en `CodAutorizacion`/`FchVto`, mientras que `FECAESolicitar` usa `CAE`/`CAEFchVto`.
        # Leer sólo uno hace que un comprobante REAL se lea como inexistente y se reemita. La suite
        # ARCA pagó exactamente este caso contra AFIP real (`mot07-consulta-fe.ts:151-155`, FIX smoke
        # 2026-06-15: "antes buscaba det.CAE → devolvía found:false pese a que AFIP traía el
        # comprobante real"). Se aceptan ambos.
        cae = str(info.get("CodAutorizacion") or info.get("CAE") or "")
        if cae:
            comprobante_id = store.registrar(
                cuit=cuit, tipo_cbte=tipo_cbte, punto_venta=punto_venta, nro=siguiente, cae=cae,
                cae_vto=_fecha(info.get("FchVto") or info.get("CAEFchVto")),
                fecha_emision=_fecha(info.get("CbteFch")),
                doc_tipo=payload.get("DocTipo"), doc_nro=str(payload.get("DocNro") or ""),
                receptor_nombre=receptor_nombre or None, cbte_asoc_nro=cbte_asoc_nro,
                total=payload.get("ImpTotal"), idem_key=idem_key, workflow_id=workflow_id)
            return {"ok": True, "duplicado": True, "id": comprobante_id, "cae": cae, "nro": siguiente,
                    "tipo_cbte": tipo_cbte, "punto_venta": punto_venta}

    from afip_gateway import RechazoAfip

    try:
        res = gateway.emitir(payload)
    except RechazoAfip as exc:
        # Rechazo de negocio: NO se reintenta. Es un resultado, no una falla.
        raise ApplicationError(str(exc), type="RechazoAfip", non_retryable=True) from None

    comprobante_id = store.registrar(
        cuit=cuit, tipo_cbte=tipo_cbte, punto_venta=punto_venta, nro=res.numero, cae=res.cae,
        cae_vto=res.cae_vto, fecha_emision=_fecha(payload.get("CbteFch")),
        doc_tipo=payload.get("DocTipo"), doc_nro=str(payload.get("DocNro") or ""),
        receptor_nombre=receptor_nombre or None, cbte_asoc_nro=cbte_asoc_nro,
        total=payload.get("ImpTotal"), idem_key=idem_key, workflow_id=workflow_id)

    return {"ok": True, "duplicado": False, "id": comprobante_id, "cae": res.cae,
            "cae_vto": res.cae_vto.isoformat(),
            "nro": res.numero, "tipo_cbte": tipo_cbte, "punto_venta": punto_venta,
            "resultado": res.resultado}


@activity.defn
async def reservar_numero_comprobante(cliente_id: str, cuit: str, punto_venta: int,
                                      tipo_cbte: int) -> int:
    """Devuelve el número que se va a emitir (`último autorizado + 1`). **Read-only: no escribe nada.**

    Existe para que el número lo decida el WORKFLOW y no la activity de emisión. Temporal guarda el
    resultado en el event history, así que un reintento de la emisión reusa el MISMO número en vez de
    recalcularlo contra un contador de AFIP que ya avanzó. Sin esto, el check-before-act de
    `emitir_comprobante` interroga un número que nunca se emitió y no puede detectar la autorización
    perdida (ver el docstring de `_emitir_sync`).
    """
    return await asyncio.to_thread(_reservar_numero_sync, cliente_id, cuit, punto_venta, tipo_cbte)


def _reservar_numero_sync(cliente_id: str, cuit: str, punto_venta: int, tipo_cbte: int) -> int:
    gateway = _gateway_con_certificado(cliente_id, cuit)
    return gateway.ultimo_comprobante(punto_venta=punto_venta, tipo_cbte=tipo_cbte) + 1


@activity.defn
async def emitir_comprobante(cliente_id: str, cuit: str, payload: dict, idem_key: str,
                             workflow_id: str, receptor_nombre: str = "",
                             nro_reservado: int | None = None) -> dict:
    """`receptor_nombre` y `nro_reservado` con default para no romper el replay de las ejecuciones que
    arrancaron con 5 y 6 argumentos. `receptor_nombre` va aparte del payload porque el WSFE no lo pide:
    AFIP identifica al receptor por tipo y número de documento, así que el nombre no viaja en el
    comprobante — pero es lo primero que una persona busca al abrir una factura vieja."""
    # `con_latido` (item #12): la emisión bloquea el hilo hasta ~3 min contra el WS de AFIP. Latir deja
    # que Temporal distinga "lento" de "muerto" en segundos en vez de esperar el start_to_close entero.
    # ⚠️ Latir NO cambia la semántica de reintento: el guard anti-doble-emisión sigue siendo el número
    # reservado por el workflow + `FECompConsultar`. Esto sólo acelera la DETECCIÓN de un worker caído.
    return await con_latido(
        asyncio.to_thread(_emitir_sync, cliente_id, cuit, payload, idem_key, workflow_id,
                          receptor_nombre, nro_reservado))


def _generar_pdf_sync(cliente_id: str, cuit: str, template: str, params: dict,
                      nro: int, tipo_cbte: int, punto_venta: int) -> dict:
    gateway = _gateway_con_certificado(cliente_id, cuit)
    nombre = f"{cuit}_{tipo_cbte:03d}_{punto_venta:05d}_{nro:08d}"
    pdf = gateway.generar_pdf(template=template, params=params, nombre_archivo=nombre)

    # `adjuntar_pdf` y NO `registrar`: esto es una actualización PARCIAL de un comprobante que ya
    # existe. `registrar` es un upsert completo cuyo `estado` default es "emitida", así que pisaba el
    # estado — y como el PDF se genera después del CAE, una factura anulada en el medio volvía sola a
    # "emitida" al terminar su PDF.
    _comprobante_store_factory(cliente_id).adjuntar_pdf(
        cuit=cuit, tipo_cbte=tipo_cbte, punto_venta=punto_venta, nro=nro,
        pdf_url=pdf.url, pdf_expira_at=pdf.expira_at)
    return {"url": pdf.url, "nombre": pdf.nombre,
            "expira_at": pdf.expira_at.isoformat() if pdf.expira_at else None}


@activity.defn
async def generar_pdf_comprobante(cliente_id: str, cuit: str, template: str, params: dict,
                                  nro: int, tipo_cbte: int, punto_venta: int) -> dict:
    """Genera el PDF. ⚠️ La URL expira a las 24 h y NO la re-hosteamos: la UI debe avisarlo."""
    return await asyncio.to_thread(_generar_pdf_sync, cliente_id, cuit, template, params,
                                   nro, tipo_cbte, punto_venta)


def _archivar_en_drive_sync(cliente_id: str, cuit: str, tipo_cbte: int, punto_venta: int,
                            nro: int, pdf_url: str) -> dict:
    """Copia el PDF al Drive del emprendedor si él lo activó en Ajustes.

    Falla BLANDO en todos sus caminos: la factura ya tiene CAE y existe en AFIP. Ni el ajuste apagado,
    ni la falta de Composio, ni un error de Drive pueden convertir una emisión exitosa en un fallo.
    Cada salida dice POR QUÉ no se archivó, para que la UI muestre el aviso de las 24 h con motivo en
    vez de un silencio.
    """
    from afip_drive import archivar_pdf, nombre_de_archivo

    perfil = _perfil_store_factory(cliente_id).get(cuit)
    if not perfil or not perfil.get("guardar_en_drive"):
        return {"guardado": False, "motivo": "desactivado"}
    if _composio_gateway is None:
        return {"guardado": False, "motivo": "composio_no_disponible"}

    nombre = nombre_de_archivo(cuit=cuit, tipo_cbte=tipo_cbte, punto_venta=punto_venta, nro=nro)
    # `composio_user_id == cliente_id` es la convención del proyecto (ver `context_factory`): un solo
    # identificador de tenant en todo el sistema.
    resultado = archivar_pdf(_composio_gateway, user_id=str(cliente_id), nombre=nombre,
                             pdf_url=pdf_url)

    if resultado.guardado:
        _comprobante_store_factory(cliente_id).adjuntar_drive(
            cuit=cuit, tipo_cbte=tipo_cbte, punto_venta=punto_venta, nro=nro,
            drive_file_id=resultado.file_id, drive_link=resultado.link)
    return resultado.como_dict()


@activity.defn
async def archivar_factura_en_drive(cliente_id: str, cuit: str, tipo_cbte: int, punto_venta: int,
                                    nro: int, pdf_url: str) -> dict:
    """Archiva el PDF en el Drive del emprendedor. Nunca levanta: devuelve por qué no pudo.

    Si esto lanzara, el reintento de la activity volvería a subir el archivo y el emprendedor
    terminaría con copias duplicadas de la misma factura en su Drive.
    """
    try:
        # `con_latido` (item #12): subir a Drive bloquea el hilo hasta ~2 min.
        return await con_latido(
            asyncio.to_thread(_archivar_en_drive_sync, cliente_id, cuit, tipo_cbte,
                              punto_venta, nro, pdf_url))
    except Exception as exc:  # noqa: BLE001
        activity.logger.warning("archivado en Drive falló para %s-%s: %s", punto_venta, nro, exc)
        return {"guardado": False, "motivo": f"error_drive: {type(exc).__name__}"}


def _marcar_anulada_sync(cliente_id: str, cuit: str, tipo_cbte: int, punto_venta: int,
                         nro: int, nro_nc: int) -> dict:
    _comprobante_store_factory(cliente_id).marcar_anulada(
        cuit=cuit, tipo_cbte=tipo_cbte, punto_venta=punto_venta, nro=nro, nro_nota_credito=nro_nc)
    return {"ok": True}


@activity.defn
async def marcar_comprobante_anulado(cliente_id: str, cuit: str, tipo_cbte: int, punto_venta: int,
                                     nro: int, nro_nc: int) -> dict:
    return await asyncio.to_thread(_marcar_anulada_sync, cliente_id, cuit, tipo_cbte,
                                   punto_venta, nro, nro_nc)


def _buscar_comprobante_sync(cliente_id: str, cuit: str, tipo_cbte: int, punto_venta: int,
                             nro: int) -> dict | None:
    store = _comprobante_store_factory(cliente_id)
    comprobante = store.get(cuit=cuit, tipo_cbte=tipo_cbte, punto_venta=punto_venta, nro=nro)
    if comprobante is None:
        return None
    # El comprobante viaja con la respuesta a "¿ya hay una NC que te anule?". Va acá y no en una
    # activity nueva a propósito: agregar un paso al `AnulacionWorkflow` cambiaría su secuencia de
    # comandos y rompería por no-determinismo cualquier anulación en vuelo. Agregar una CLAVE al
    # resultado de una activity que ya existía no toca la secuencia — y las ejecuciones que replayan
    # un history viejo simplemente no la traen, que es el comportamiento de hoy.
    return {**comprobante,
            "nota_credito_nro": store.nota_credito_de(cuit=cuit, punto_venta=punto_venta, nro=nro)}


@activity.defn
async def buscar_comprobante(cliente_id: str, cuit: str, tipo_cbte: int, punto_venta: int,
                             nro: int) -> dict | None:
    return await asyncio.to_thread(_buscar_comprobante_sync, cliente_id, cuit, tipo_cbte,
                                   punto_venta, nro)


def _listar_sync(cliente_id: str, cuit: str, limite: int) -> list[dict]:
    return _comprobante_store_factory(cliente_id).listar(cuit=cuit, limite=limite)


@activity.defn
async def listar_comprobantes(cliente_id: str, cuit: str, limite: int = 50) -> list[dict]:
    """Lectura del libro propio. La fuente de verdad fiscal sigue siendo AFIP."""
    return await asyncio.to_thread(_listar_sync, cliente_id, cuit, limite)


def _fecha(valor) -> date | None:
    """AFIP mezcla `yyyymmdd` (string o int) e ISO. Se normaliza sin adivinar."""
    if valor in (None, ""):
        return None
    if isinstance(valor, date):
        return valor
    texto = str(valor).strip()
    if "-" in texto:
        return date.fromisoformat(texto)
    if len(texto) == 8 and texto.isdigit():
        return datetime.strptime(texto, "%Y%m%d").date()
    return None
