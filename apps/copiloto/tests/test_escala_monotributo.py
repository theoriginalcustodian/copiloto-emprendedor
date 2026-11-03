"""SM-N36 -- la escala de monotributo versionada y el `tope` de `GET /contabilidad/resumen`.

El modo de falla que protege este archivo NO da síntoma: un tope viejo se ve bien y es falso. Por eso cada
rama del cálculo tiene su test, y el de «escala vencida => null» ejercita el caso hostil (la fecha pasa el
`vigencia_hasta`), no sólo el happy-path.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import date
from decimal import Decimal

import pytest
from fastapi import Depends, Header, HTTPException
from fastapi.testclient import TestClient

import escala_monotributo as em
from afip_credential_store import AfipPerfilStore
from contabilidad_web import create_contabilidad_app

TOPES = {c: str(1_000_000 * (i + 1)) for i, c in enumerate(em.CATEGORIAS)}   # sintéticos: NO son cifras de ARCA
ESCALA = {"vigencia_desde": "2026-08-01", "vigencia_hasta": "2027-01-31",
          "fuente": "https://example.test/escala-de-prueba", "topes": TOPES}
UMBRALES = {"amarillo_pct": 80, "rojo_pct": 95, "aviso_pct": 80}


def _config(tmp_path, escalas=None, umbrales=None):
    p = tmp_path / "escala.json"
    p.write_text(json.dumps({"umbrales": umbrales or UMBRALES, "escalas": [ESCALA] if escalas is None else escalas}),
                 encoding="utf-8")
    return em.cargar(p)


# --- el archivo REAL ---------------------------------------------------------------------------------------

def test_el_json_real_carga_y_declara_dueno_y_como_actualizar():
    """La config que se despliega es válida, y lleva escrito quién la mantiene y cómo (DoD 1): sin dueño
    la deuda vuelve en la próxima resolución de ARCA."""
    crudo = json.loads(em.RUTA_POR_DEFECTO.read_text(encoding="utf-8"))
    assert crudo["propietario"].strip() and crudo["como_actualizar"].strip()
    em.cargar()   # no levanta


# --- carga y validación ------------------------------------------------------------------------------------

@pytest.mark.parametrize("mutar,fragmento", [
    (lambda e: e.update(fuente=""), "fuente"),
    (lambda e: e.update(vigencia_hasta="2026-07-31"), "anterior"),
    (lambda e: e.update(vigencia_desde="agosto"), "fecha"),
    (lambda e: e["topes"].pop("K"), "categorías"),
    (lambda e: e["topes"].update(B="abc"), "número"),
    (lambda e: e["topes"].update(B="0"), "> 0"),
    (lambda e: e["topes"].update(B=TOPES["A"]), "creciente"),
])
def test_una_escala_malformada_ABORTA_no_degrada_a_sin_escala(tmp_path, mutar, fragmento):
    e = json.loads(json.dumps(ESCALA))
    mutar(e)
    with pytest.raises(em.EscalaInvalida, match=fragmento):
        _config(tmp_path, escalas=[e])


def test_dos_escalas_que_se_solapan_abortan(tmp_path):
    otra = {**ESCALA, "vigencia_desde": "2026-12-01", "vigencia_hasta": "2027-06-30"}
    with pytest.raises(em.EscalaInvalida, match="solapan"):
        _config(tmp_path, escalas=[ESCALA, otra])


def test_umbrales_incoherentes_abortan(tmp_path):
    with pytest.raises(em.EscalaInvalida, match="umbrales"):
        _config(tmp_path, umbrales={**UMBRALES, "amarillo_pct": 99})


# --- el cálculo: las DOS ramas + el control adversarial ----------------------------------------------------

def test_con_categoria_y_escala_vigente_el_tope_se_calcula(tmp_path):
    cfg = _config(tmp_path)
    m = em.medidor(cfg, "A", Decimal("500000.00"), date(2026, 11, 3))
    assert m == {"valor": "1000000.00", "porcentaje": 50.0, "semaforo": "verde"}
    assert em.medidor(cfg, "C", Decimal("2850000.00"), date(2026, 11, 3))["semaforo"] == "rojo"   # 95 %
    assert em.medidor(cfg, "C", Decimal("2400000.00"), date(2026, 11, 3))["semaforo"] == "amarillo"   # 80 %


@pytest.mark.parametrize("categoria", [None, "", "Z", "a", "AA", 3])
def test_sin_categoria_valida_el_tope_es_null(tmp_path, categoria):
    assert em.medidor(_config(tmp_path), categoria, Decimal("1"), date(2026, 11, 3)) is None


def test_sin_ninguna_escala_cargada_el_tope_es_null(tmp_path):
    """El estado en que se despliega: config con el formato correcto y CERO filas."""
    assert em.medidor(_config(tmp_path, escalas=[]), "A", Decimal("1"), date(2026, 11, 3)) is None


def test_ESCALA_VENCIDA_da_null_nunca_el_tope_viejo(tmp_path):
    """DoD 3 -- el caso que no da síntoma. El último día vigente el tope existe; el día siguiente, null."""
    cfg = _config(tmp_path)
    assert em.medidor(cfg, "A", Decimal("1"), date(2027, 1, 31)) is not None
    assert em.medidor(cfg, "A", Decimal("1"), date(2027, 2, 1)) is None
    assert em.medidor(cfg, "A", Decimal("1"), date(2026, 7, 31)) is None      # todavía no vigente


def test_con_dos_escalas_se_usa_la_vigente_de_HOY_no_la_ultima_del_archivo(tmp_path):
    nueva = {**ESCALA, "vigencia_desde": "2027-02-01", "vigencia_hasta": "2027-07-31",
             "topes": {c: str(int(v) * 2) for c, v in TOPES.items()}}
    cfg = _config(tmp_path, escalas=[nueva, ESCALA])     # orden invertido a propósito
    assert em.tope_de(cfg, "A", date(2026, 11, 3)) == Decimal("1000000")
    assert em.tope_de(cfg, "A", date(2027, 3, 1)) == Decimal("2000000")


# --- el endpoint -------------------------------------------------------------------------------------------

class _Cobros:
    def total_periodo(self, periodo=None):
        return {"periodo": "2026-11", "total": "0.00", "mes_anterior": None}

    def top_clientes(self, periodo=None, *, limite=5):
        return []


class _Gastos:
    def resumen(self, periodo=None):
        return {"total": "0.00", "por_categoria": [], "mes_anterior": None}


class _Facturado:
    def __init__(self, doce):
        self._doce = doce

    def total_periodo(self, periodo=None):
        return {"periodo": "0.00", "doce_meses": self._doce}


def _cliente(tmp_path, categorias, *, doce="500000.00", hoy=date(2026, 11, 3), escalas=None):
    def require_tenant(x_tenant: str = Header(...)):
        if not x_tenant:
            raise HTTPException(401)
        return x_tenant
    app = create_contabilidad_app(
        require_tenant=require_tenant, cobro_store_factory=lambda cid: _Cobros(),
        gasto_store_factory=lambda cid: _Gastos(), afip_comprobante_store_factory=lambda cid: _Facturado(doce),
        categoria_monotributo_factory=lambda cid: categorias.get(cid),
        escala=_config(tmp_path, escalas=escalas), hoy_fn=lambda: hoy)
    return TestClient(app)


def _tope(cli, tenant):
    return cli.get("/contabilidad/resumen", headers={"x-tenant": tenant}).json()["facturado"]["tope"]


def test_endpoint_devuelve_el_tope_calculado_con_la_forma_que_consume_el_front(tmp_path):
    cli = _cliente(tmp_path, {"A": "A"})
    assert _tope(cli, "A") == {"valor": "1000000.00", "porcentaje": 50.0, "semaforo": "verde"}


def test_endpoint_sin_categoria_sigue_en_null(tmp_path):
    assert _tope(_cliente(tmp_path, {}), "A") is None


def test_endpoint_con_escala_vencida_es_null_aunque_haya_categoria(tmp_path):
    assert _tope(_cliente(tmp_path, {"A": "A"}, hoy=date(2027, 2, 1)), "A") is None


def test_ADVERSARIAL_la_categoria_de_un_tenant_no_define_el_tope_de_otro(tmp_path):
    """A tiene categoría; B no. B pide su resumen: su tope es null, no el de A."""
    cli = _cliente(tmp_path, {"A": "A"})
    assert _tope(cli, "A") is not None
    assert _tope(cli, "B") is None


# --- el store contra Postgres REAL (corre en el VPS) -------------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL")
necesita_pg = pytest.mark.skipif(not DATABASE_URL, reason="requiere DATABASE_URL (corre en el VPS)")

CUIT = "20111111112"


def _guardar(conn_de_tenant, tenant, *, condicion="monotributo", categoria=None, cuit=CUIT):
    AfipPerfilStore(conn_de_tenant(tenant), tenant).save(
        cuit, razon_social="X", domicilio_comercial="Calle 1", condicion_iva=condicion,
        ingresos_brutos="20-1-2", inicio_actividades=date(2020, 1, 1), punto_venta=1,
        categoria_monotributo=categoria)


@pytest.fixture
def tenants_pg():
    return str(uuid.uuid4()), str(uuid.uuid4())


@pytest.fixture
def limpiar_perfiles(conn_de_tenant, tenants_pg):
    yield
    for t in tenants_pg:
        with conn_de_tenant(t)().cursor() as cur:
            cur.execute("DELETE FROM uc_factory.afip_perfil WHERE cliente_id = %s", (t,))


@necesita_pg
def test_pg_la_categoria_se_guarda_se_lee_y_no_mandarla_conserva_la_anterior(conn_de_tenant, tenants_pg, limpiar_perfiles):
    a, _ = tenants_pg
    store = AfipPerfilStore(conn_de_tenant(a), a)
    _guardar(conn_de_tenant, a, categoria="C")
    assert store.categoria_monotributo() == "C"
    assert store.get(CUIT)["categoria_monotributo"] == "C"
    _guardar(conn_de_tenant, a, categoria=None)          # un cliente viejo que no manda el campo
    assert store.categoria_monotributo() == "C"          # no la borra
    _guardar(conn_de_tenant, a, categoria="D")
    assert store.categoria_monotributo() == "D"


@necesita_pg
def test_pg_si_la_condicion_deja_de_ser_monotributo_la_categoria_se_LIMPIA(conn_de_tenant, tenants_pg, limpiar_perfiles):
    """Si quedara colgada, un responsable inscripto tendría un `tope` calculado contra una categoría que ya no
    tiene -- y llegaría como número correcto."""
    a, _ = tenants_pg
    store = AfipPerfilStore(conn_de_tenant(a), a)
    _guardar(conn_de_tenant, a, categoria="C")
    _guardar(conn_de_tenant, a, condicion="responsable_inscripto", categoria="C")   # aun mandándola
    assert store.get(CUIT)["categoria_monotributo"] is None
    assert store.categoria_monotributo() is None
    _guardar(conn_de_tenant, a, condicion="monotributo")      # vuelve a monotributo SIN categoría
    assert store.categoria_monotributo() is None              # no resucita la vieja


@necesita_pg
def test_pg_ADVERSARIAL_la_categoria_de_A_no_se_ve_desde_B(conn_de_tenant, tenants_pg, limpiar_perfiles):
    a, b = tenants_pg
    _guardar(conn_de_tenant, a, categoria="K")
    assert AfipPerfilStore(conn_de_tenant(a), a).categoria_monotributo() == "K"     # control positivo
    assert AfipPerfilStore(conn_de_tenant(b), b).categoria_monotributo() is None
    _guardar(conn_de_tenant, b, categoria="A")                                       # mismo CUIT, otro tenant
    assert AfipPerfilStore(conn_de_tenant(a), a).categoria_monotributo() == "K"
