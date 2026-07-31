"""Los gates deciden qué se auto-repara — y equivocarse hacia el permiso emite una factura.

Casi todo corre sin Postgres (son env vars y strings), así que el grueso es barato y corre siempre.
Sólo `tiene_indice_unico` toca la base, porque su punto es justamente **preguntarle a la base** en vez
de creerle a un catálogo.
"""
from __future__ import annotations

import os

import pytest

from autosanacion_gates import (DOMINIOS_PROHIBIDOS, ENV_KILL_SWITCH, ENV_TOPE_DIARIO,
                                TOPE_DIARIO_DEFAULT, apagado, dominio_prohibido, puede_reparar,
                                tiene_indice_unico, tope_diario)

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")


# ======================================================================================
# Kill switch
# ======================================================================================
def test_por_defecto_el_ciclo_esta_ENCENDIDO(monkeypatch):
    """Control positivo: si `apagado()` devolviera siempre True, todos los tests de rechazo de abajo
    pasarían y estarían midiendo nada."""
    monkeypatch.delenv(ENV_KILL_SWITCH, raising=False)
    assert apagado() is False
    assert puede_reparar(ruta="cobro_store.py", reparaciones_hoy=0).permitido


@pytest.mark.parametrize("valor", ["1", "true", "TRUE", "yes", "Yes"])
def test_el_kill_switch_apaga_con_cualquiera_de_sus_formas(monkeypatch, valor):
    monkeypatch.setenv(ENV_KILL_SWITCH, valor)
    assert apagado() is True
    d = puede_reparar(ruta="cobro_store.py", reparaciones_hoy=0)
    assert not d.permitido and "kill switch" in d.motivo


def test_el_kill_switch_se_lee_en_CADA_decision_no_al_arrancar(monkeypatch):
    """Apagarlo tiene que surtir efecto sin reiniciar el worker. Si hiciera falta un reinicio, no
    sería un kill switch — sería un cambio de configuración."""
    monkeypatch.delenv(ENV_KILL_SWITCH, raising=False)
    assert puede_reparar(ruta="x.py", reparaciones_hoy=0).permitido
    monkeypatch.setenv(ENV_KILL_SWITCH, "1")
    assert not puede_reparar(ruta="x.py", reparaciones_hoy=0).permitido


# ======================================================================================
# Tope diario
# ======================================================================================
def test_el_tope_es_parametrizable(monkeypatch):
    monkeypatch.setenv(ENV_TOPE_DIARIO, "2")
    assert tope_diario() == 2
    assert puede_reparar(ruta="x.py", reparaciones_hoy=1).permitido
    assert not puede_reparar(ruta="x.py", reparaciones_hoy=2).permitido


@pytest.mark.parametrize("basura", ["cero", "", "0", "-3", "3.5"])
def test_un_tope_INVALIDO_no_puede_significar_SIN_TOPE(monkeypatch, basura):
    """El modo de fallo caro: un env mal tipeado que desactive el límite. Degradar al default es lo
    seguro; lanzar tampoco sirve, porque apagaría el ciclo por un error de configuración."""
    monkeypatch.setenv(ENV_TOPE_DIARIO, basura)
    assert tope_diario() == TOPE_DIARIO_DEFAULT


def test_el_mensaje_del_tope_dice_el_NUMERO(monkeypatch):
    """Un rechazo que no dice cuánto ni de cuánto obliga a ir a leer el código para entenderlo."""
    monkeypatch.setenv(ENV_TOPE_DIARIO, "3")
    d = puede_reparar(ruta="x.py", reparaciones_hoy=3)
    assert "3/3" in d.motivo


# ======================================================================================
# DIAGNOSTIC_ONLY — el gate que no se negocia
# ======================================================================================
@pytest.mark.parametrize("ruta", [
    "apps/copiloto/afip_factura_activities.py",
    "AFIP_GATEWAY.PY",                                  # mayúsculas
    "activity:afip_comprobante_store.registrar",        # nombre de activity, no path
    "/opt/uc-repos/copiloto/apps/copiloto/mp_credential_store.py",
])
def test_el_dominio_fiscal_y_los_irreversibles_NUNCA_se_reparan(ruta, monkeypatch):
    """Coincide por substring a propósito: un path, un módulo o un nombre de activity tienen que caer
    igual. Equivocarse hacia el rechazo es gratis; equivocarse hacia el permiso **emite una factura
    con CAE real ante AFIP**."""
    monkeypatch.delenv(ENV_KILL_SWITCH, raising=False)
    assert dominio_prohibido(ruta) is not None
    d = puede_reparar(ruta=ruta, reparaciones_hoy=0)
    assert not d.permitido and "DIAGNOSTIC_ONLY" in d.motivo


def test_CONTROL_un_modulo_normal_NO_es_dominio_prohibido():
    """Sin este control, un `dominio_prohibido` que devolviera siempre algo haría pasar todo lo de
    arriba mientras bloquea el ciclo entero."""
    assert dominio_prohibido("apps/copiloto/cobro_store.py") is None
    assert dominio_prohibido("") is None
    assert dominio_prohibido(None) is None  # type: ignore[arg-type]


def test_el_fiscal_gana_incluso_con_el_tope_libre_y_el_switch_encendido(monkeypatch):
    """Orden de precedencia: ningún gate más permisivo puede habilitar el dominio prohibido."""
    monkeypatch.delenv(ENV_KILL_SWITCH, raising=False)
    monkeypatch.setenv(ENV_TOPE_DIARIO, "999")
    assert not puede_reparar(ruta="afip_gateway.py", reparaciones_hoy=0).permitido


def test_la_lista_de_prohibidos_cubre_los_TRES_efectos_irreversibles():
    """No es una lista de "áreas sensibles": es la de dominios cuyo reintento tiene efecto externo e
    irreversible. Si alguien saca uno, que sea a la vista."""
    assert any("afip_factura" in d for d in DOMINIOS_PROHIBIDOS), "falta la emisión fiscal (CAE)"
    assert any("onboarding" in d for d in DOMINIOS_PROHIBIDOS), "falta el secreto one-shot del RPA"
    assert any("mp_credential" in d for d in DOMINIOS_PROHIBIDOS), "falta la rotación de token de MP"


# ======================================================================================
# La whitelist sale del índice único (spike S3)
# ======================================================================================
@necesita_pg
def test_la_base_confirma_el_indice_unico_de_la_DLQ(conn_de_tenant):
    """`copiloto_traumas` tiene índice único `(cliente_id, fingerprint)` — el que hace que su upsert
    sea idempotente de verdad. Que la función lo encuentre es el control positivo de todo el gate."""
    conn = conn_de_tenant("11111111-1111-1111-1111-111111111111")()
    try:
        assert tiene_indice_unico(conn, "copiloto_traumas", ("cliente_id", "fingerprint")) is True
    finally:
        conn.close()


@necesita_pg
def test_una_combinacion_SIN_indice_unico_devuelve_False(conn_de_tenant):
    """El control negativo. Sin él, un `tiene_indice_unico` que devolviera siempre True marcaría como
    reinyectable **cualquier** operación — y la lección de S3 es que sin índice la ventana se
    atraviesa: 8 hilos pasaron el `if` y sólo el índice evitó las 8 filas."""
    conn = conn_de_tenant("11111111-1111-1111-1111-111111111111")()
    try:
        assert tiene_indice_unico(conn, "copiloto_traumas", ("workflow", "error_type")) is False
        assert tiene_indice_unico(conn, "tabla_que_no_existe", ("cliente_id",)) is False
    finally:
        conn.close()
