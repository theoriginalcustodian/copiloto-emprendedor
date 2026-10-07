"""Control positivo de MECLAVESRUNTIME + MECLAVESRESTO: el comparador tiene que ver las dos
direcciones, para /me y para /auth/login.

Corre local y en el VPS con pytest. Lo que prueba: una clave de mentira en la respuesta (sobra) y
una clave declarada que no llega (falta) salen ROJO, y el set real lee verde.
"""
import pytest

from meclaves_check import cargar_claves_declaradas, cargar_claves_login_declaradas, comparar_claves

DECLARADAS = cargar_claves_declaradas()
DECLARADAS_LOGIN = cargar_claves_login_declaradas()


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


# ── MECLAVESRESTO: mismo comparador, mismo criterio, para CLAVES_LOGIN (apps/copiloto/auth_login_contrato.py) ──

def test_lector_carga_el_set_real_de_login():
    # 7 claves desde #916 (MECLAVESRESTO): GoTrue real devuelve expires_at/weak_password además
    # de las 5 originales -- opción A (declarar, no podar), ver auth_login_contrato.py:20-22.
    assert DECLARADAS_LOGIN == frozenset({
        "access_token", "token_type", "expires_in", "expires_at",
        "refresh_token", "user", "weak_password",
    })


def test_login_set_real_sin_diferencias_es_verde():
    assert comparar_claves(DECLARADAS_LOGIN, DECLARADAS_LOGIN) == ([], [])


def test_login_clave_de_mentira_en_la_respuesta_es_roja_y_se_nombra():
    sobra, falta = comparar_claves(DECLARADAS_LOGIN | {"clave_de_mentira"}, DECLARADAS_LOGIN)
    assert sobra == ["clave_de_mentira"]
    assert falta == []


def test_login_clave_declarada_que_no_llega_es_roja_y_se_nombra():
    sobra, falta = comparar_claves(DECLARADAS_LOGIN - {"refresh_token"}, DECLARADAS_LOGIN)
    assert sobra == []
    assert falta == ["refresh_token"]
