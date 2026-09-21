"""K-15: el ejemplo de tono sale de la misma tabla que el prompt real y el endpoint lo sirve."""
from __future__ import annotations

import itertools

import pytest

import perfil_negocio_prompt as pnp
from perfil_negocio_store import FORMALIDAD, LARGO_RESPUESTA

COMBINACIONES = list(itertools.product(sorted(FORMALIDAD), sorted(LARGO_RESPUESTA)))


def test_hay_ejemplo_para_cada_combinacion_y_no_sobra_ninguno():
    assert set(pnp._EJEMPLO_TEXTO) == set(itertools.product(pnp._FORMALIDAD_TEXTO, pnp._LARGO_TEXTO))
    assert set(pnp._FORMALIDAD_TEXTO) == set(FORMALIDAD) and set(pnp._LARGO_TEXTO) == set(LARGO_RESPUESTA)


@pytest.mark.parametrize("formalidad,largo", COMBINACIONES)
def test_el_prompt_real_de_cada_combinacion_lleva_las_instrucciones_que_el_ejemplo_ilustra(formalidad, largo):
    bloque = pnp.bloque_de_contexto({"formalidad": formalidad, "largo_respuesta": largo})
    assert pnp._FORMALIDAD_TEXTO[formalidad] in bloque and pnp._LARGO_TEXTO[largo] in bloque
    ejemplo = pnp.ejemplo_de_tono(formalidad, largo)
    assert ejemplo and ejemplo.strip()


def test_los_cuatro_ejemplos_son_distintos_entre_si():
    assert len({pnp.ejemplo_de_tono(f, l) for f, l in COMBINACIONES}) == 4


def test_breve_es_mas_corto_que_detallado_en_cada_registro():
    for f in FORMALIDAD:
        assert len(pnp.ejemplo_de_tono(f, "breve")) < len(pnp.ejemplo_de_tono(f, "detallado"))


@pytest.mark.parametrize("f,l", [("informal", "breve"), ("cercano", "eterno"), ("", ""), ("Formal", "breve")])
def test_valor_invalido_da_none(f, l):
    assert pnp.ejemplo_de_tono(f, l) is None
