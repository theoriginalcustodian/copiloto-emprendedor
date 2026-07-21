"""Archivado del PDF de una factura en el Drive del emprendedor (capa CLIENTE).

**El problema que resuelve.** El PDF que genera AfipSDK vive en una URL que expira a las 24 h y que no
re-hosteamos. Pasado ese plazo, el botón "Compartir" de la app apunta a un link muerto: el emprendedor
que quiere reenviar la factura de la semana pasada no puede. Acá el PDF se copia a SU Drive, así que la
guarda queda en su cuenta —no en nuestra infraestructura— y el link no vence.

**Por qué `UPLOAD_FROM_URL` y no bajar el archivo nosotros.** Composio baja la URL server-side y la sube
a Drive en una sola llamada: el PDF nunca pasa por nuestro front-door, que es compartido por todos los
tenants y ya tiene un cap de 25 MB por otro motivo. Verificado contra el catálogo real el 2026-07-21:
`source_url` debe ser públicamente accesible, y la de AfipSDK lo es mientras vive — que es exactamente
la ventana en la que corre el archivado.

**Sobre el permiso público.** Los archivos suben PRIVADOS (medido: un extraño recibe HTTP 401), así que
un link de Drive sin compartir no le sirve al cliente que recibe la factura. Decisión del operador
(2026-07-21): compartir en el momento de archivar, no al tocar "Compartir". El costo es que cada factura
archivada queda con un link permanente que cualquiera con la URL puede abrir; el beneficio es que
compartir no depende de una llamada de red justo cuando el usuario está por mandársela al cliente. Los
datos expuestos son del CLIENTE del emprendedor (nombre, documento, importe), no del emprendedor: la
decisión de exponerlos la toma alguien que no es el titular del dato. Queda asentado como deliberado.
"""
from __future__ import annotations

from dataclasses import dataclass

CARPETA = "Facturas"

SLUG_BUSCAR_CARPETA = "GOOGLEDRIVE_FIND_FOLDER"
SLUG_CREAR_CARPETA = "GOOGLEDRIVE_CREATE_FOLDER"
SLUG_SUBIR = "GOOGLEDRIVE_UPLOAD_FROM_URL"
SLUG_COMPARTIR = "GOOGLEDRIVE_CREATE_PERMISSION"


@dataclass(frozen=True)
class ResultadoArchivado:
    """`compartido=False` con `file_id` presente es un archivado ÚTIL: el archivo está guardado y no
    se pierde a las 24 h; sólo el emprendedor no puede pasarle el link a un tercero todavía."""
    file_id: str | None
    link: str | None
    compartido: bool
    motivo: str | None = None

    @property
    def guardado(self) -> bool:
        return bool(self.file_id)

    def como_dict(self) -> dict:
        return {"guardado": self.guardado, "file_id": self.file_id, "link": self.link,
                "compartido": self.compartido, "motivo": self.motivo}


def nombre_de_archivo(*, cuit: str, tipo_cbte: int, punto_venta: int, nro: int) -> str:
    """Nombre ordenable y único dentro de la carpeta. Con ceros a la izquierda para que el orden
    alfabético del Drive coincida con el numérico — sin eso, la factura 10 aparece antes que la 9."""
    return f"{cuit}_{tipo_cbte:03d}_{punto_venta:05d}_{nro:08d}.pdf"


def _datos(respuesta) -> dict:
    """Composio anida distinto según el slug: a veces `data`, a veces `data.response_data`."""
    if not isinstance(respuesta, dict):
        return {}
    d = respuesta.get("data") or {}
    if isinstance(d, dict) and isinstance(d.get("response_data"), dict):
        d = d["response_data"]
    return d if isinstance(d, dict) else {}


def _primer_id(respuesta) -> str | None:
    """El id de la primera carpeta encontrada. FIND_FOLDER devuelve la lista bajo claves distintas
    según la versión, así que se prueban las conocidas en vez de asumir una."""
    d = _datos(respuesta)
    for clave in ("files", "folders", "results"):
        items = d.get(clave)
        if isinstance(items, list) and items:
            primero = items[0]
            if isinstance(primero, dict) and primero.get("id"):
                return str(primero["id"])
    return str(d["id"]) if d.get("id") else None


def asegurar_carpeta(gateway, *, user_id: str, nombre: str = CARPETA) -> str | None:
    """Devuelve el id de la carpeta, creándola sólo si no existe. Idempotente por construcción: sin el
    FIND previo, cada factura crearía otra carpeta homónima (Drive las permite duplicadas)."""
    encontrada = _primer_id(gateway.execute(
        SLUG_BUSCAR_CARPETA, user_id=user_id, arguments={"name_exact": nombre}, confirmed=True))
    if encontrada:
        return encontrada
    return _primer_id(gateway.execute(
        SLUG_CREAR_CARPETA, user_id=user_id, arguments={"name": nombre}, confirmed=True))


def archivar_pdf(gateway, *, user_id: str, nombre: str, pdf_url: str,
                 compartir: bool = True) -> ResultadoArchivado:
    """Sube el PDF a la carpeta del emprendedor y (si se pide) lo deja accesible por link.

    `confirmed=True` en cada llamada: el gate HITL del gateway existe para lo que el AGENTE decide en
    una conversación. Esto no lo decide el agente — lo autorizó el usuario en Ajustes, que es un
    consentimiento explícito y persistente, más fuerte que un "sí" en el chat. Pedir confirmación acá
    colgaría el archivado esperando una respuesta que nadie va a dar: el workflow corre solo.
    """
    carpeta = asegurar_carpeta(gateway, user_id=user_id)

    argumentos = {"name": nombre, "source_url": pdf_url, "mime_type": "application/pdf"}
    if carpeta:
        argumentos["parent_folder_id"] = carpeta
    # Sin carpeta el archivo va a la raíz del Drive. Prolijidad perdida, factura salvada: preferible a
    # no archivar por no haber podido crear una carpeta.

    subida = _datos(gateway.execute(SLUG_SUBIR, user_id=user_id, arguments=argumentos, confirmed=True))
    file_id = subida.get("id") or subida.get("file_id")
    # `webContentLink` descarga el archivo; `webViewLink` abre el visor de Drive. Para el botón
    # "Descargar" de la card el que sirve es el primero — con el otro el usuario termina en una página
    # de Drive en vez de con el PDF (medido el 2026-07-21).
    link = (subida.get("webContentLink") or subida.get("web_content_link")
            or subida.get("webViewLink") or subida.get("web_view_link"))

    if not file_id:
        return ResultadoArchivado(None, None, False, motivo="drive_no_devolvio_id")

    if not compartir:
        return ResultadoArchivado(str(file_id), link, False)

    try:
        gateway.execute(SLUG_COMPARTIR, user_id=user_id,
                        arguments={"file_id": str(file_id), "role": "reader", "type": "anyone"},
                        confirmed=True)
    except Exception as exc:  # noqa: BLE001
        # El archivo YA está guardado: eso es lo que evita perder la factura a las 24 h. No poder
        # compartirlo es una degradación, no un fracaso — devolverlo como fallo borraría el `file_id`
        # de un archivo que existe y quedaría huérfano en el Drive del usuario.
        return ResultadoArchivado(str(file_id), link, False,
                                  motivo=f"guardado_sin_compartir: {type(exc).__name__}")

    return ResultadoArchivado(str(file_id), link, True)
