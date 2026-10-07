"""Control positivo de MECLAVESRUNTIME: el comparador tiene que ver las dos direcciones.

Corre local y en el VPS con pytest. Lo que prueba: una clave de mentira en la respuesta (sobra) y
una clave declarada que no llega (falta) salen ROJO, y el set real lee verde.
"""
import pytest

from meclaves_check import cargar_claves_declaradas, comparar_claves

DECLARADAS = cargar_claves_declaradas()


def test_lector_carga_el_set_real():
    assert DECLARADAS == frozenset({
        "cliente_id", "email", "cuenta_google", "onboarding_completado", "mp_connected",
        "composio_connected", "es_admin", "legal_aceptado", "legal_version_aceptada",
    })


def test_set_real_sin_diferencias_es_verde():
    assert comparar_claves(DECLARADAS, DECLARADAS) == ([], [])


def test_clave_de_mentira_en_la_respuesta_es_roja_y_se_nombra():
    sobra, falta = comparar_claves(DECLARADAS | {"clave_de_mentira"}, DECLARADAS)
    assert sobra == ["clave_de_mentira"]
    assert falta == []


def test_clave_declarada_que_no_llega_es_roja_y_se_nombra():
    sobra, falta = comparar_claves(DECLARADAS - {"email"}, DECLARADAS)
    assert sobra == []
    assert falta == ["email"]


def test_set_declarado_vacio_se_niega_a_comparar():
    with pytest.raises(ValueError):
        comparar_claves({"email"}, frozenset())
