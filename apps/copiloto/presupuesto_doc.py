"""Genera el Google Doc del presupuesto y su fila de trazabilidad en Sheets.

Aislado de FastAPI y de Temporal a propósito: se testea con un gateway falso, sin red.

**Doc y Sheet son PROYECCIONES, no la fuente de verdad.** Si Google falla, si el emprendedor no tiene
`googledocs` conectado, o si borra el documento después, el presupuesto sigue completo en Postgres y
el botón Facturar sigue funcionando. Por eso nada de acá puede hacer fallar la creación — el caller
loguea y sigue.

Shapes verificados contra la API real el 2026-07-21 (spike con el gateway de producción):

    GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN(title, markdown_text)
      -> {"successful": true, "data": {"documentId": "1HsL…", "display_url": "https://…/edit", …}}

⚠️ El link se llama **`display_url`**, NO `webViewLink` ni `url`. Escribirlo de memoria por analogía
con Drive guarda `None` en silencio y el botón "Ver en Google Docs" no aparece nunca — sin error y
sin log. El `documentId` es **camelCase**, dentro de `data`.
"""
from __future__ import annotations

from dataclasses import dataclass

SLUG_CREAR_DOC = "GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN"
SLUG_APPEND_SHEET = "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND"

HOJA_TRAZABILIDAD = "Presupuestos"
CABECERA = ["Número", "Fecha", "Cliente", "Concepto", "Total", "Moneda", "Documento"]


@dataclass(frozen=True)
class ResultadoDoc:
    doc_id: str | None = None
    doc_link: str | None = None
    sheet_fila: str | None = None
    motivo: str | None = None

    def como_dict(self) -> dict:
        return {"doc_id": self.doc_id, "doc_link": self.doc_link,
                "sheet_fila": self.sheet_fila, "motivo": self.motivo}


def titulo_del_doc(presupuesto: dict) -> str:
    """Nombre del archivo en el Drive del usuario. Lleva el número y el cliente porque es lo que él va
    a buscar cuando lo abra desde Drive, no desde la app."""
    receptor = (presupuesto.get("receptor") or {}).get("nombre") or "Sin cliente"
    return f"Presupuesto N° {presupuesto.get('numero')} — {receptor}"


def markdown_del_presupuesto(presupuesto: dict, *, perfil_negocio: dict | None = None) -> str:
    """El cuerpo del Doc, en markdown.

    Sale ENTERO de los datos guardados: nada lo redacta un LLM. Un texto generado envejecería respecto
    de la fila (cambia el total y el documento sigue diciendo lo viejo), y encima costaría tokens en
    cada presupuesto.
    """
    perfil = perfil_negocio or {}
    encabezado = perfil.get("nombre_comercial") or ""
    receptor = presupuesto.get("receptor") or {}
    lineas = []
    if encabezado:
        lineas.append(f"# {encabezado}")
    lineas.append(f"## Presupuesto N° {presupuesto.get('numero')}")
    lineas.append("")
    if presupuesto.get("concepto"):
        lineas.append(f"**Concepto:** {presupuesto['concepto']}")
    lineas.append(f"**Cliente:** {receptor.get('nombre') or '-'}")
    if receptor.get("doc_nro"):
        lineas.append(f"**Documento:** {receptor.get('doc_nro')}")
    if receptor.get("domicilio"):
        lineas.append(f"**Domicilio:** {receptor['domicilio']}")
    lineas.append("")
    lineas.append("### Detalle")
    for it in presupuesto.get("items") or []:
        subtotal = _subtotal(it)
        lineas.append(f"- {it.get('descripcion')} — {it.get('cantidad')} × "
                      f"{it.get('precio_unitario')} = {subtotal}")
    lineas.append("")
    lineas.append(f"### Total: {presupuesto.get('total')} {presupuesto.get('moneda') or ''}".rstrip())
    if perfil.get("horario_atencion"):
        lineas.append("")
        lineas.append(f"_Horario de atención: {perfil['horario_atencion']}_")
    return "\n".join(lineas)


def _subtotal(item: dict) -> str:
    from decimal import Decimal
    try:
        return str((Decimal(str(item.get("cantidad", 0)))
                    * Decimal(str(item.get("precio_unitario", 0)))).quantize(Decimal("0.01")))
    except Exception:  # noqa: BLE001 — el subtotal es cosmético; nunca romper el documento por él
        return ""


def _primer(res, *claves):
    """Saca la primera clave presente de `data`. Existe porque el nombre real (`display_url`) no es el
    que uno adivinaría, y una lista explícita es más honesta que asumir uno solo."""
    data = (res or {}).get("data") if isinstance(res, dict) else None
    if not isinstance(data, dict):
        return None
    for c in claves:
        if data.get(c):
            return str(data[c])
    return None


def generar_doc(gateway, *, user_id: str, presupuesto: dict,
                perfil_negocio: dict | None = None) -> ResultadoDoc:
    """Crea el Doc. `confirmed=True`: el gate HITL de Composio existe para lo que decide el AGENTE por
    su cuenta; acá el usuario pidió explícitamente crear el presupuesto."""
    try:
        res = gateway.execute(
            SLUG_CREAR_DOC, user_id=user_id, confirmed=True,
            arguments={"title": titulo_del_doc(presupuesto),
                       "markdown_text": markdown_del_presupuesto(
                           presupuesto, perfil_negocio=perfil_negocio)})
    except Exception as exc:  # noqa: BLE001 — sin Docs conectado el presupuesto se crea igual
        return ResultadoDoc(motivo=f"docs_no_disponible: {type(exc).__name__}")
    doc_id = _primer(res, "documentId", "document_id", "id")
    if not doc_id:
        return ResultadoDoc(motivo="docs_sin_document_id")
    # `display_url` primero: es el nombre REAL que devuelve la API (verificado). Los otros son
    # defensa por si cambia, y el armado a mano es el último recurso.
    link = _primer(res, "display_url", "webViewLink", "url") or \
        f"https://docs.google.com/document/d/{doc_id}/edit"
    return ResultadoDoc(doc_id=doc_id, doc_link=link)


def registrar_en_sheet(gateway, *, user_id: str, spreadsheet_id: str, presupuesto: dict,
                       doc_link: str | None) -> str | None:
    """Appendea la fila de trazabilidad en el Sheet del emprendedor. Devuelve el rango escrito o None.

    `VALUES_APPEND` resuelve la posición del lado de Google (después de la última fila con datos): no
    hay que leer, contar y escribir, así que no hay carrera con lo que el usuario esté editando.

    ⚠️ Los argumentos de este slug son **camelCase** (`spreadsheetId`, `valueInputOption`), a
    diferencia de `GOOGLESHEETS_BATCH_UPDATE` que los usa en snake_case. El gateway pasa `arguments`
    tal cual, así que equivocar el casing es un fallo silencioso.
    """
    if not spreadsheet_id:
        return None
    receptor = (presupuesto.get("receptor") or {}).get("nombre") or ""
    fila = [str(presupuesto.get("numero") or ""), str(presupuesto.get("fecha") or ""), receptor,
            presupuesto.get("concepto") or "", str(presupuesto.get("total") or ""),
            presupuesto.get("moneda") or "", doc_link or ""]
    try:
        res = gateway.execute(SLUG_APPEND_SHEET, user_id=user_id, confirmed=True, arguments={
            "spreadsheetId": spreadsheet_id,
            "range": f"{HOJA_TRAZABILIDAD}!A1",
            "valueInputOption": "USER_ENTERED",
            "values": [fila]})
    except Exception:  # noqa: BLE001 — la trazabilidad es una comodidad, no la fuente de verdad
        return None
    data = (res or {}).get("data") if isinstance(res, dict) else None
    if isinstance(data, dict):
        actualizado = data.get("updates") or {}
        return actualizado.get("updatedRange") or data.get("tableRange")
    return None
