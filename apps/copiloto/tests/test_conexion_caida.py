"""K-09 (BL-J4): salud por conexión. «Caído» (hubo conexión y ya no sirve) ≠ «nunca conectado».

Mitad pura (sin DB): `composio_caidos`, `build_catalog(status)`. Mitad PG real con RLS FORCE: la salud de
MercadoPago por tenant, `caja.incompleta`, la tarjeta `conexion_caida` del tablero y su auto-cierre al
reconectar. Adversarial: la caída de B no se ve desde A en ninguna de las tres caras.
"""
from __future__ import annotations

import os
import time
import uuid

import pytest

from catalog import build_catalog
from conexiones_salud import composio_caidos, conexiones_caidas
from inteligencia_queries import InteligenciaQueries
from mi_dia_detector import REGLA_CONEXION_CAIDA
from mi_dia_orquestador import avanzar_tablero
from mp_credential_store import MpCredentialStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL) con RLS FORCE")

FUTURO = int(time.time()) + 86400 * 90


class _Crypto:
    def encrypt(self, s): return s
    def decrypt(self, s): return s


# ── puro ─────────────────────────────────────────────────────────────────────────────────────────

def test_composio_expired_sin_activa_es_caido_y_en_curso_no():
    con = [{"toolkit": "gmail", "status": "EXPIRED"}, {"toolkit": "googledrive", "status": "INITIATED"},
           {"toolkit": "googlecalendar", "status": "ACTIVE"}, {"toolkit": "googlecalendar", "status": "EXPIRED"}]
    assert composio_caidos(con) == ["gmail"]     # calendar tiene otra cuenta ACTIVE; drive sólo está en curso


def test_catalogo_status_tres_estados_y_connected_derivado():
    cat = {s["key"]: s for s in build_catalog(
        valid_toolkits={"gmail", "googledrive", "googlecalendar"}, mp_connected=False,
        composio_connected=["googledrive"], mp_status="caido", composio_caidos=["gmail"])}
    assert (cat["mercadopago"]["status"], cat["mercadopago"]["connected"]) == ("caido", False)
    assert (cat["gmail"]["status"], cat["gmail"]["connected"]) == ("caido", False)
    assert (cat["googledrive"]["status"], cat["googledrive"]["connected"]) == ("conectado", True)
    assert (cat["googlecalendar"]["status"], cat["googlecalendar"]["connected"]) == ("nunca_conectado", False)


def test_catalogo_compat_sin_los_argumentos_nuevos():
    cat = {s["key"]: s for s in build_catalog(valid_toolkits={"gmail"}, mp_connected=True, composio_connected=[])}
    assert cat["mercadopago"]["status"] == "conectado" and cat["mercadopago"]["connected"] is True
    assert cat["gmail"]["status"] == "nunca_conectado"


def test_composio_que_falla_no_borra_el_aviso_de_mp():
    class _Mp:
        def salud(self): return "caido"

    def _roto():
        raise RuntimeError("composio 500")
    assert conexiones_caidas(_Mp(), _roto) == ["mercadopago"]


# ── PG real ──────────────────────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _fernet(monkeypatch):
    """`avanzar_tablero` corre TODAS las reglas, incluida la del certificado, que descifra."""
    from clients.agent.providers.crypto import FernetCrypto
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


@pytest.fixture
def tenants(conn_de_tenant):
    """Dos tenants sintéticos; barrido POR TENANT (RLS) de lo que estas pruebas escriben."""
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            for t in ("mp_credentials", "copiloto_mi_dia_tarjetas", "copiloto_avisos_emitidos",
                      "copiloto_eventos"):
                cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id = %s", (cid,))
        conn.close()


def _mp(conn_de_tenant, t):
    return MpCredentialStore(conn_de_tenant(t), t, _Crypto())


@necesita_pg
def test_salud_recorre_nunca_conectado_caido_conectado(conn_de_tenant, tenants):
    a, _ = tenants
    mp = _mp(conn_de_tenant, a)
    assert mp.salud() == "nunca_conectado"
    mp.save("s1", access_token="AT", refresh_token="RT", expires_at=FUTURO)
    assert mp.salud() == "conectado"
    mp.marcar_reauth("s1")                       # MP rechazó el refresh_token
    assert mp.salud() == "caido"
    mp.save("s1", access_token="AT2", refresh_token="RT2", expires_at=FUTURO)   # reconectó
    assert mp.salud() == "conectado"
    mp.delete_all()                              # desconectó a propósito: NO es una caída
    assert mp.salud() == "nunca_conectado"


@necesita_pg
def test_token_vencido_sin_renovar_es_caido_y_update_tokens_lo_limpia(conn_de_tenant, tenants):
    a, _ = tenants
    mp = _mp(conn_de_tenant, a)
    mp.save("s1", access_token="AT", refresh_token="RT", expires_at=int(time.time()) - 10)
    assert mp.salud() == "caido"
    mp.update_tokens("s1", access_token="AT2", refresh_token="RT2", expires_at=FUTURO)
    assert mp.salud() == "conectado"
    mp.marcar_reauth("s1")
    mp.update_tokens("s1", access_token="AT3", refresh_token="RT3", expires_at=FUTURO)
    assert mp.salud() == "conectado"             # el refresh exitoso limpia la marca


@necesita_pg
def test_la_caida_de_B_no_se_ve_desde_A(conn_de_tenant, tenants):
    a, b = tenants
    _mp(conn_de_tenant, a).save("sa", access_token="AT", refresh_token="RT", expires_at=FUTURO)
    _mp(conn_de_tenant, b).save("sb", access_token="AT", refresh_token="RT", expires_at=FUTURO)
    _mp(conn_de_tenant, b).marcar_reauth("sb")
    assert _mp(conn_de_tenant, b).salud() == "caido"
    assert _mp(conn_de_tenant, a).salud() == "conectado"
    assert InteligenciaQueries(conn_de_tenant(a), a).portada()["caja"]["incompleta"] is False
    assert InteligenciaQueries(conn_de_tenant(b), b).portada()["caja"]["incompleta"] is True
    tab_a = avanzar_tablero(conn_de_tenant(a), a)
    assert not [t for e in tab_a.values() for t in e if t["regla"] == REGLA_CONEXION_CAIDA]
    # marcar_reauth de A con el seller de B no toca a B (WHERE cliente_id)
    _mp(conn_de_tenant, a).marcar_reauth("sb")
    assert _mp(conn_de_tenant, b).salud() == "caido"   # ya estaba; y A sigue sano:
    assert _mp(conn_de_tenant, a).salud() == "conectado"


@necesita_pg
def test_tarjeta_conexion_caida_aparece_critica_y_se_cierra_sola_al_reconectar(conn_de_tenant, tenants):
    a, _ = tenants
    mp = _mp(conn_de_tenant, a)
    mp.save("s1", access_token="AT", refresh_token="RT", expires_at=FUTURO)
    assert not [t for e in avanzar_tablero(conn_de_tenant(a), a).values() for t in e
                if t["regla"] == REGLA_CONEXION_CAIDA]
    mp.marcar_reauth("s1")
    tab = avanzar_tablero(conn_de_tenant(a), a)
    tarjetas = [t for e in tab.values() for t in e if t["regla"] == REGLA_CONEXION_CAIDA]
    assert len(tarjetas) == 1
    t = tarjetas[0]
    assert (t["criticidad"], t["verbo"], t["entidad_id"]) == ("critico", "Reconectar", "mercadopago")
    assert "Mercado Pago" in t["texto"] and "incompletos" in t["texto"]
    assert len([x for e in avanzar_tablero(conn_de_tenant(a), a).values() for x in e
                if x["regla"] == REGLA_CONEXION_CAIDA]) == 1        # idempotente: no duplica
    mp.save("s1", access_token="AT2", refresh_token="RT2", expires_at=FUTURO)   # reconectó
    tab = avanzar_tablero(conn_de_tenant(a), a)
    assert not [x for x in tab["para_hoy"] + tab["haciendo"] if x["regla"] == REGLA_CONEXION_CAIDA]
    assert [x for x in tab["hecha"] if x["regla"] == REGLA_CONEXION_CAIDA]  # se cerró por el hecho
