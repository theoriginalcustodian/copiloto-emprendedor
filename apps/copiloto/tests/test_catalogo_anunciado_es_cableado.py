"""SM-E2 — lo que el catálogo ANUNCIA y lo que está CABLEADO coinciden, ítem por ítem.

Medido antes del fix: Gmail anunciaba «Leer mails» y «Buscar» con `TOOLS = {"gmail_send": ...}`;
Calendar anunciaba «Buscar turnos» con una sola acción (`calendar_book`); Drive anunciaba «Crear/Buscar
archivo» con `TOOLS = {}` (podado). La promesa vivía en `_PRESENTATION` (copy a mano) y la verdad en
`TOOLS`: dos fuentes que ningún test comparaba.

Acá se comparan las DOS direcciones:
  - toda promesa del catálogo (`alcance`) cita una acción REAL (tool del executor, o un camino cableado
    aparte declarado en `ACCIONES_SIN_TOOL`);
  - toda tool de un conector del catálogo está anunciada (no se esconde una capacidad que existe).
"""
from __future__ import annotations

import pytest

import catalog
import services
from tool_catalog import TOOL_INDEX


def _tools_reales_por_servicio() -> dict[str, set[str]]:
    """{clave del catálogo: tools que el executor sabe ejecutar para ese conector}."""
    por = {mod.TOOLKIT: set(mod.TOOLS) for mod in services.modules().values()}
    por["googlecalendar"] = {n for n, kind in TOOL_INDEX.items() if kind == ("calendar",)}
    por[catalog.MERCADOPAGO_KEY] = {n for n, kind in TOOL_INDEX.items() if kind == ("mp",)}
    return por


def test_control_positivo_el_universo_de_tools_no_esta_vacio():
    por = _tools_reales_por_servicio()
    assert por["gmail"] == {"gmail_send"}
    assert por["googlecalendar"] == {"calendar_book"}
    assert por[catalog.MERCADOPAGO_KEY] == {"mp_charge"}
    assert por["googledrive"] == set()          # podado: es el caso que originó la ficha


@pytest.mark.parametrize("servicio", sorted(catalog._PRESENTATION))
def test_cada_promesa_cita_una_accion_real(servicio):
    reales = _tools_reales_por_servicio().get(servicio, set())
    for item in catalog._PRESENTATION[servicio]["alcance"]:
        accion = item["accion"]
        assert accion in reales or accion in catalog.ACCIONES_SIN_TOOL, (
            f"{servicio}: anuncia «{item['texto']}» pero `{accion}` no es una tool cableada de ese "
            f"conector ({sorted(reales)}) ni un camino declarado en ACCIONES_SIN_TOOL")


@pytest.mark.parametrize("servicio", sorted(catalog._PRESENTATION))
def test_cada_tool_cableada_esta_anunciada(servicio):
    anunciadas = {i["accion"] for i in catalog._PRESENTATION[servicio]["alcance"]}
    faltan = _tools_reales_por_servicio().get(servicio, set()) - anunciadas
    assert not faltan, f"{servicio}: tools cableadas que el catálogo no anuncia: {sorted(faltan)}"


def test_ningun_conector_con_tools_queda_sin_copy_dedicado():
    """Un servicio nuevo con tools que no está en `_PRESENTATION` saldría con `alcance: []`: sin
    promesa, pero también sin decir qué hace. Que alguien lo escriba (y pase los tests de arriba)."""
    sin_copy = {k for k, tools in _tools_reales_por_servicio().items()
                if tools and k not in catalog._PRESENTATION}
    assert sin_copy == set()


def test_la_accion_interna_no_viaja_en_la_respuesta():
    """El enum de la card es cerrado: `alcance_items` emite sólo texto+condicion."""
    entrada = catalog._entry("gmail", kind="composio", connected=False)
    assert entrada["alcance_items"] == [{"texto": "Enviar mails", "condicion": "requiere_ok"}]
    assert entrada["capabilities"] == ["Enviar mails"]
    card = catalog.requiere_conexion_card("gmail", "Gmail")
    assert all(set(i) == {"texto", "condicion"} for i in card["alcance"])


def test_el_catalogo_gmail_ya_no_promete_leer_ni_buscar():
    textos = [i["texto"] for i in catalog._entry("gmail", kind="composio", connected=False)["alcance_items"]]
    assert "Leer mails" not in textos and "Buscar" not in textos
