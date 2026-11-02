"""SM-N7 — la `description` del catálogo que AFIRMA que el agente ESCRIBE coincide con lo cableado.

Hermano de `test_catalogo_descripcion_afirma_capacidad` (SM-N3, que ató la LECTURA). Las otras cuatro
descripciones prometen una escritura —«Generá links de cobro», «Agendá reuniones», «Guardá tus facturas»,
«Agregá filas»— y sólo las cubría `alcance` (el permiso), no el texto. Una promesa de escritura
incumplida se descubre con el efecto ausente y sin error que la delate.

Acá la afirmación se compara con el MECANISMO que cada servicio usa para escribir, nunca con una constante:
  - módulos de `services/`: alguna op de `TOOLS` que está en `WRITE_OPS` (la fuente con que el executor
    decide qué es write);
  - Calendar y Mercado Pago (tools de 1ra clase): una tool de `TOOL_INDEX` hacia su destino que está en
    `WRITE_TOOLS`;
  - Drive: NO tiene tool (el agente no sube archivos); escribe la activity de archivado, así que el
    mecanismo es «la activity existe y la policy deja pasar los slugs que ella usa».
"""
from __future__ import annotations

import re

import pytest

import afip_factura_activities
import catalog
import services
import tool_catalog
from services import drive

_AFIRMA_ESCRIBIR = re.compile(r"\b(?:gener|envi|agend|guard|cre|agreg)[aá]\b", re.I)

# Destino de la tool de 1ra clase en `TOOL_INDEX` para los dos servicios que no viven en `services/`.
_DESTINO_PRIMERA_CLASE = {"googlecalendar": ("calendar",), catalog.MERCADOPAGO_KEY: ("mp",)}


def escribe_el_cableado(servicio: str) -> bool:
    """El servicio tiene un camino de escritura realmente cableado."""
    if servicio in _DESTINO_PRIMERA_CLASE:
        destino = _DESTINO_PRIMERA_CLASE[servicio]
        return any(kind == destino and name in tool_catalog.WRITE_TOOLS
                   for name, kind in tool_catalog.TOOL_INDEX.items())
    if servicio == "googledrive":
        return (callable(getattr(afip_factura_activities, "archivar_factura_en_drive", None))
                and bool(drive.ARCHIVADO_SLUGS) and drive.ARCHIVADO_SLUGS <= drive.POLICY.write)
    mod = {m.TOOLKIT: m for m in services.modules().values()}[servicio]
    return any(op in mod.WRITE_OPS for op in mod.TOOLS.values())


def desajuste(servicio: str) -> str | None:
    """None si el texto dice lo que el cableado hace; si no, qué no coincide."""
    afirma = bool(_AFIRMA_ESCRIBIR.search(catalog._PRESENTATION[servicio]["description"]))
    escribe = escribe_el_cableado(servicio)
    if afirma and not escribe:
        return f"{servicio}: la descripción promete escribir pero no hay un camino de escritura cableado"
    if escribe and not afirma:
        return f"{servicio}: hay escritura cableada pero la descripción no la afirma"
    return None


SERVICIOS = ("gmail", "googledocs", "googlesheets", "googledrive", "googlecalendar", catalog.MERCADOPAGO_KEY)


def test_el_universo_no_esta_vacio_y_el_barrido_ve_los_seis():
    """Control del barrido: si el regex no viera una descripción, el test pasaría mudo."""
    assert set(SERVICIOS) <= set(catalog._PRESENTATION)
    for s in SERVICIOS:
        assert _AFIRMA_ESCRIBIR.search(catalog._PRESENTATION[s]["description"]), s
        assert escribe_el_cableado(s), s


@pytest.mark.parametrize("servicio", SERVICIOS)
def test_la_descripcion_de_escritura_coincide_con_lo_cableado(servicio):
    assert desajuste(servicio) is None


# ── controles positivos: cada dirección tiene que poner ROJO el instrumento ──────────────────────────

def test_control_descablear_sheets_pone_ROJO(monkeypatch):
    from services import sheets
    assert desajuste("googlesheets") is None
    monkeypatch.setattr(sheets, "TOOLS", {})
    assert desajuste("googlesheets") is not None


def test_control_descablear_mp_y_calendar_pone_ROJO(monkeypatch):
    for servicio, tool in (("mercadopago", "mp_charge"), ("googlecalendar", "calendar_book")):
        assert desajuste(servicio) is None
        monkeypatch.setattr(tool_catalog, "WRITE_TOOLS", tool_catalog.WRITE_TOOLS - {tool})
        assert desajuste(servicio) is not None
        monkeypatch.undo()


def test_control_podar_la_policy_de_drive_pone_ROJO(monkeypatch):
    assert desajuste("googledrive") is None
    monkeypatch.setattr(drive, "POLICY", drive.ToolkitPolicy(version=drive.DRIVE_VERSION, read=drive.POLICY.read,
                                                              write=frozenset()))
    assert desajuste("googledrive") is not None


def test_control_texto_que_promete_escribir_sin_cablear_pone_ROJO(monkeypatch):
    """Dirección «afirmar una capacidad no cableada»: el texto sigue prometiendo «Agregá filas» sin tool ni op de escritura."""
    from services import sheets
    monkeypatch.setattr(sheets, "TOOLS", {})
    monkeypatch.setattr(sheets, "WRITE_OPS", frozenset())
    assert "Agregá" in catalog._PRESENTATION["googlesheets"]["description"]
    assert desajuste("googlesheets") is not None


def test_control_cableado_cuyo_texto_dejo_de_afirmarlo_pone_ROJO(monkeypatch):
    monkeypatch.setitem(catalog._PRESENTATION["googlesheets"], "description", "Tus planillas de Google Sheets.")
    assert desajuste("googlesheets") is not None
