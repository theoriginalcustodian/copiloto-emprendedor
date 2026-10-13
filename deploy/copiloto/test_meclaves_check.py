"""Control positivo de MECLAVESRUNTIME + MECLAVESRESTO: el comparador tiene que ver las dos
direcciones, para /me y para /auth/login.

Corre local y en el VPS con pytest. Lo que prueba: una clave de mentira en la respuesta (sobra) y
una clave declarada que no llega (falta) salen ROJO, y el set real lee verde.
"""
import pytest

from meclaves_check import (ENDPOINTS_RESTO, cargar_claves_declaradas, cargar_claves_de,
                            cargar_claves_login_declaradas, comparar_claves, env_override_contrato)

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


# ── MECLAVESRESTO (chat/reply/catalog/warm): mismo comparador, set leído de cada `<endpoint>_contrato.py` ──

SETS_RESTO = {
    "chat": frozenset({"wf_id", "accepted"}),
    "reply": frozenset({"replies", "next_id"}),
    "catalog": frozenset({"services"}),
    "warm": frozenset({"warmed"}),
}


def test_la_tabla_cubre_exactamente_los_cuatro_endpoints():
    assert set(ENDPOINTS_RESTO) == set(SETS_RESTO)


@pytest.mark.parametrize("endpoint", sorted(SETS_RESTO))
def test_resto_lector_carga_el_set_real(endpoint):
    assert cargar_claves_de(endpoint) == SETS_RESTO[endpoint]


@pytest.mark.parametrize("endpoint", sorted(SETS_RESTO))
def test_resto_clave_de_mentira_y_clave_faltante_son_rojas_y_se_nombran(endpoint):
    declaradas = cargar_claves_de(endpoint)
    sobra, falta = comparar_claves(declaradas | {"clave_de_mentira"}, declaradas)
    assert (sobra, falta) == (["clave_de_mentira"], [])
    una = sorted(declaradas)[0]
    sobra, falta = comparar_claves(declaradas - {una}, declaradas)
    assert (sobra, falta) == ([], [una])


@pytest.mark.parametrize("endpoint", sorted(SETS_RESTO))
def test_resto_el_override_por_env_apunta_al_contrato_desplegado(endpoint, tmp_path, monkeypatch):
    # Un "árbol desplegado" con un set DISTINTO del de main: si el override se ignorara, devolvería el real.
    atributo = "CLAVES_" + endpoint.upper()
    ruta = tmp_path / f"{endpoint}_contrato.py"
    ruta.write_text(f'{atributo} = frozenset({{"solo_en_el_desplegado"}})', encoding="utf-8")
    monkeypatch.setenv(env_override_contrato(endpoint), str(ruta))
    assert cargar_claves_de(endpoint) == frozenset({"solo_en_el_desplegado"})


def test_resto_endpoint_fuera_de_la_tabla_no_inventa_un_set():
    with pytest.raises(KeyError):
        cargar_claves_de("me")
