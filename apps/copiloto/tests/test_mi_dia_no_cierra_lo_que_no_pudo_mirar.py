"""Mi día no cierra «por el HECHO» lo que no pudo MIRAR.

Defecto (pedido de manejo-de-errores, 2026-11-03): con Composio caído, `conexiones_caidas` se tragaba el
error y devolvía `[]`; el reconciliador leía ese vacío como «ya no está caído» y cerraba la tarjeta
«Reconectá Gmail» como HECHA, con la conexión todavía vencida. El schedule diario (sin Composio inyectado)
tenía el mismo hueco.
"""
from __future__ import annotations

import os
import time
import uuid

import pytest

from conexiones_salud import diagnostico_conexiones
from mi_dia_detector import REGLA_CONEXION_CAIDA, detectar_todos
from mi_dia_orquestador import avanzar_tablero
from mp_credential_store import MpCredentialStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL) con RLS FORCE")

GMAIL_VENCIDO = [{"toolkit": "gmail", "status": "EXPIRED"}]
GMAIL_SANO = [{"toolkit": "gmail", "status": "ACTIVE"}]


class _Mp:
    def __init__(self, salud="conectado"): self._s = salud
    def salud(self): return self._s


def _sano(conexiones):
    return lambda: conexiones


def _roto():
    raise RuntimeError("composio 500")


# ── puro ─────────────────────────────────────────────────────────────────────────────────────────

def test_diagnostico_con_fuente_sana_esta_mirado():
    assert diagnostico_conexiones(_Mp(), _sano(GMAIL_VENCIDO)) == (["gmail"], True)
    assert diagnostico_conexiones(_Mp(), _sano(GMAIL_SANO)) == ([], True)


def test_diagnostico_composio_que_lanza_NO_esta_mirado_y_mp_sigue_valiendo():
    assert diagnostico_conexiones(_Mp("caido"), _roto) == (["mercadopago"], False)
    assert diagnostico_conexiones(_Mp(), _roto) == ([], False)


def test_diagnostico_sin_fuente_inyectada_NO_esta_mirado():
    assert diagnostico_conexiones(_Mp(), None) == ([], False)


def test_el_fallo_de_composio_deja_rastro(monkeypatch):
    import log_estructurado
    vistos = []
    monkeypatch.setattr(log_estructurado, "log_error", lambda exc, **kw: vistos.append((exc, kw)))
    diagnostico_conexiones(_Mp(), _roto)
    assert len(vistos) == 1 and vistos[0][1]["extra"]["costura"] == "composio_list_connections"


# ── orquestador sin DB: lo que se llama y lo que no ───────────────────────────────────────────────

class _Crudos(dict):
    sin_fuente: dict = {}


def _orquestar(monkeypatch, crudos, cierres):
    import mi_dia_orquestador as orq

    class _Av:
        def __init__(self, *a, **k): pass
        def silenciados(self, regla): return set()
        def emitir(self, *a, **k): pass
        def liberar_ausentes(self, *a, **k): pass

    class _Ta:
        def __init__(self, *a, **k): pass
        def crear_si_no_existe(self, *a, **k): pass
        def cerrar_resueltas(self, regla, vigentes, solo_entidades=None):
            cierres.append((regla, None if solo_entidades is None else set(solo_entidades)))
            return 0
        def listar_tablero(self): return {}

    monkeypatch.setattr(orq, "detectar_todos", lambda *a, **k: crudos)
    monkeypatch.setattr(orq, "AvisosEmitidosStore", _Av)
    monkeypatch.setattr(orq, "TarjetaStore", _Ta)
    orq.avanzar_tablero(None, "t")


def test_regla_sin_fuente_se_acota_a_lo_mirado_y_las_demas_cierran_normal(monkeypatch):
    from mi_dia_detector import REGLAS_AUTO_CIERRE
    otras = [r for r in REGLAS_AUTO_CIERRE if r != REGLA_CONEXION_CAIDA]
    crudos = _Crudos({REGLA_CONEXION_CAIDA: [], **{r: [] for r in otras}})
    crudos.sin_fuente = {REGLA_CONEXION_CAIDA: frozenset({"mercadopago"})}
    cierres: list = []
    _orquestar(monkeypatch, crudos, cierres)
    por_regla = dict(cierres)
    assert por_regla[REGLA_CONEXION_CAIDA] == {"mercadopago"}   # HOSTIL: Composio no se cierra por ausencia
    assert all(por_regla[r] is None for r in otras)             # las reglas sin relación cierran normal


def test_control_con_fuente_mirada_la_regla_cierra_sin_acotar(monkeypatch):
    crudos = _Crudos({REGLA_CONEXION_CAIDA: []})
    cierres: list = []
    _orquestar(monkeypatch, crudos, cierres)
    assert cierres == [(REGLA_CONEXION_CAIDA, None)]


# ── PG real con RLS FORCE ────────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _fernet(monkeypatch):
    from clients.agent.providers.crypto import FernetCrypto
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


@pytest.fixture
def tenant(conn_de_tenant):
    t = str(uuid.uuid4())
    yield t
    conn = conn_de_tenant(t)()
    with conn.cursor() as cur:
        for tabla in ("mp_credentials", "copiloto_mi_dia_tarjetas", "copiloto_avisos_emitidos",
                      "copiloto_eventos"):
            cur.execute(f"DELETE FROM uc_factory.{tabla} WHERE cliente_id = %s", (t,))
    conn.close()


def _tarjetas_gmail(tab):
    return [t for estado in ("para_hoy", "haciendo") for t in tab.get(estado, [])
            if t["regla"] == REGLA_CONEXION_CAIDA and t["entidad_id"] == "gmail"]


def _hechas_gmail(tab):
    return [t for t in tab.get("hecha", [])
            if t["regla"] == REGLA_CONEXION_CAIDA and t["entidad_id"] == "gmail"]


@necesita_pg
def test_control_gmail_vencido_crea_y_mantiene_la_tarjeta(conn_de_tenant, tenant):
    for _ in range(2):
        tab = avanzar_tablero(conn_de_tenant(tenant), tenant, _sano(GMAIL_VENCIDO))
        assert len(_tarjetas_gmail(tab)) == 1


@necesita_pg
def test_HOSTIL_composio_lanza_la_tarjeta_NO_se_cierra(conn_de_tenant, tenant):
    avanzar_tablero(conn_de_tenant(tenant), tenant, _sano(GMAIL_VENCIDO))        # nace la tarjeta
    tab = avanzar_tablero(conn_de_tenant(tenant), tenant, _roto)                 # Composio cae
    assert len(_tarjetas_gmail(tab)) == 1, "la tarjeta debe seguir abierta"
    assert not _hechas_gmail(tab), "no se cierra «por el hecho» lo que no se pudo mirar"


@necesita_pg
def test_HOSTIL_sin_composio_inyectado_el_schedule_tampoco_cierra(conn_de_tenant, tenant):
    avanzar_tablero(conn_de_tenant(tenant), tenant, _sano(GMAIL_VENCIDO))
    tab = avanzar_tablero(conn_de_tenant(tenant), tenant, None)
    assert len(_tarjetas_gmail(tab)) == 1 and not _hechas_gmail(tab)


@necesita_pg
def test_con_fuente_sana_y_conexion_recuperada_SI_se_cierra(conn_de_tenant, tenant):
    avanzar_tablero(conn_de_tenant(tenant), tenant, _sano(GMAIL_VENCIDO))
    tab = avanzar_tablero(conn_de_tenant(tenant), tenant, _sano(GMAIL_SANO))
    assert not _tarjetas_gmail(tab) and len(_hechas_gmail(tab)) == 1


@necesita_pg
def test_la_pasada_ciega_no_impide_cerrar_cuando_la_fuente_vuelve(conn_de_tenant, tenant):
    avanzar_tablero(conn_de_tenant(tenant), tenant, _sano(GMAIL_VENCIDO))
    avanzar_tablero(conn_de_tenant(tenant), tenant, _roto)
    tab = avanzar_tablero(conn_de_tenant(tenant), tenant, _sano(GMAIL_SANO))
    assert len(_hechas_gmail(tab)) == 1


@necesita_pg
def test_MP_recuperado_sigue_cerrando_aunque_Composio_no_se_pueda_mirar(conn_de_tenant, tenant):
    """Lo que SÍ se miró (MP, de la DB) no queda rehén de la fuente que falló."""
    mp = MpCredentialStore(conn_de_tenant(tenant), tenant, _Crypto())
    mp.save("s1", access_token="AT", refresh_token="RT", expires_at=int(time.time()) + 86400)
    mp.marcar_reauth("s1")
    avanzar_tablero(conn_de_tenant(tenant), tenant, _sano(GMAIL_VENCIDO))
    mp.save("s1", access_token="AT2", refresh_token="RT2", expires_at=int(time.time()) + 86400)
    tab = avanzar_tablero(conn_de_tenant(tenant), tenant, _roto)
    mp_abierta = [t for e in ("para_hoy", "haciendo") for t in tab.get(e, [])
                  if t["regla"] == REGLA_CONEXION_CAIDA and t["entidad_id"] == "mercadopago"]
    assert not mp_abierta and len(_tarjetas_gmail(tab)) == 1


@necesita_pg
def test_detectar_todos_marca_sin_fuente_solo_si_no_se_miro(conn_de_tenant, tenant):
    acotado = {REGLA_CONEXION_CAIDA: frozenset({"mercadopago"})}
    assert detectar_todos(conn_de_tenant(tenant), tenant, composio_conexiones=_roto).sin_fuente == acotado
    assert detectar_todos(conn_de_tenant(tenant), tenant).sin_fuente == acotado
    assert detectar_todos(conn_de_tenant(tenant), tenant,
                          composio_conexiones=_sano(GMAIL_SANO)).sin_fuente == {}


class _Crypto:
    def encrypt(self, s): return s
    def decrypt(self, s): return s
