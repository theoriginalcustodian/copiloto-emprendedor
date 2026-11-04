"""Entrada 47 del corpus (apps): los textos de `/catalog` son los del prototipo, que gana por norma.

Fuente: `Prototipo frontend/odobi-ui/prototipo/index.html`, pantalla «Ajustes › Apps conectadas»
(`#s-apps`). La app móvil pinta `description` tal cual la manda el backend, así que si este mapa se
desvía del prototipo la pantalla difiere aunque el front sea idéntico (medido en device por frontend1).

Es un string contra un string A PROPÓSITO: lo que se fija es qué dice la fuente canónica. La
coherencia texto↔cableado ya la ata `test_catalogo_descripcion_afirma_capacidad.py` por mecanismo.
"""
from __future__ import annotations

import pytest

import catalog

PROTOTIPO = {
    "mercadopago": "Generar links de cobro para tus clientes.",
    "gmail": "Mandar correos por vos. No puede leerlos.",
    "googlecalendar": "Agendarte eventos y reuniones.",
    "googlesheets": "Agregar filas a tus planillas.",
    "googledocs": "Crear documentos o leer uno que ya tengas.",
    "googledrive": "Archiva tus facturas automáticamente. No se usa por chat.",
}


def test_el_prototipo_cubre_todos_los_servicios_con_copy_dedicado():
    """Si se suma un servicio a `_PRESENTATION` sin texto del prototipo, esto lo acusa."""
    assert set(catalog._PRESENTATION) == set(PROTOTIPO)


@pytest.mark.parametrize("servicio", sorted(PROTOTIPO))
def test_la_descripcion_es_la_del_prototipo(servicio):
    assert catalog._PRESENTATION[servicio]["description"] == PROTOTIPO[servicio]
