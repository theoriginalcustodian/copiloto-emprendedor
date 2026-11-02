"""SM-N3 — la `description` del catálogo que AFIRMA (o NIEGA) que el agente lee, coincide con lo cableado.

SM-K4 cambió el texto de Gmail a «Enviá mails desde el chat. No puede leerlos.»: una afirmación sobre el
código que vive lejos del código que la hace verdadera. `test_catalogo_anunciado_es_cableado` (SM-E2) ata
los ítems de `alcance`, no el texto libre de `description`; el día que alguien cablee una tool de lectura
de Gmail, el catálogo seguiría diciendo «no puede leerlos».

Acá la afirmación se compara con el MECANISMO —«¿el módulo expone alguna op que no sea de escritura?»
(`TOOLS` menos `WRITE_OPS`, la misma fuente con que el executor decide qué es write)—, nunca con una
constante: un test que compara el string con otro string sale verde aunque el cableado cambie.
"""
from __future__ import annotations

import re

import pytest

import catalog
import services

_NIEGA_LEER = re.compile(r"\bno puede leer", re.I)
_AFIRMA_LEER = re.compile(r"\b(le[eé]|leer|lee)\b", re.I)


def _lee_el_cableado(mod) -> bool:
    """El módulo expone al menos una tool cuya op NO es de escritura."""
    return any(op not in mod.WRITE_OPS for op in mod.TOOLS.values())


def desajuste(servicio: str, mod) -> str | None:
    """None si el texto dice lo que el cableado hace; si no, qué no coincide."""
    desc = catalog._PRESENTATION[servicio]["description"]
    niega = bool(_NIEGA_LEER.search(desc))
    afirma = bool(_AFIRMA_LEER.search(_NIEGA_LEER.sub("", desc)))
    lee = _lee_el_cableado(mod)
    if niega and lee:
        return f"{servicio}: la descripción dice «no puede leer» pero el módulo cablea lectura"
    if afirma and not lee:
        return f"{servicio}: la descripción promete leer pero el módulo no cablea ninguna lectura"
    return None


def _modulos_con_descripcion():
    return {mod.TOOLKIT: mod for mod in services.modules().values() if mod.TOOLKIT in catalog._PRESENTATION}


def test_el_universo_no_esta_vacio_y_el_barrido_ve_las_dos_formas_de_afirmacion():
    """Control del barrido: Gmail NIEGA leer y Docs lo AFIRMA — si el regex no los ve, el test pasa mudo."""
    mods = _modulos_con_descripcion()
    assert {"gmail", "googledocs"} <= set(mods)
    assert _NIEGA_LEER.search(catalog._PRESENTATION["gmail"]["description"])
    assert _AFIRMA_LEER.search(catalog._PRESENTATION["googledocs"]["description"])
    assert not _lee_el_cableado(mods["gmail"]) and _lee_el_cableado(mods["googledocs"])


@pytest.mark.parametrize("servicio", sorted(_modulos_con_descripcion()))
def test_la_descripcion_coincide_con_lo_cableado(servicio):
    assert desajuste(servicio, _modulos_con_descripcion()[servicio]) is None


def test_control_positivo_cablear_lectura_en_gmail_pone_ROJO_el_test(monkeypatch):
    """Sin esta corrida no se sabe si el test mide: con una tool de lectura cableada a propósito, el
    texto «No puede leerlos» deja de ser verdad y `desajuste` TIENE que acusarlo."""
    from services import gmail
    assert desajuste("gmail", gmail) is None
    monkeypatch.setitem(gmail.TOOLS, "gmail_read", "fetch")          # `fetch` no está en WRITE_OPS
    assert desajuste("gmail", gmail) is not None


def test_control_positivo_el_texto_que_promete_leer_sin_cablearlo_pone_ROJO(monkeypatch):
    """La dirección inversa: alguien «corrige» el texto a «leé tus mails» sin cablear nada."""
    from services import gmail
    monkeypatch.setitem(catalog._PRESENTATION["gmail"], "description", "Enviá y leé mails desde el chat.")
    assert desajuste("gmail", gmail) is not None
