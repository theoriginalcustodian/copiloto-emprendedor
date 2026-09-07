"""Tests de integración de los stores nuevos del hito-C (`CobroStore.total_periodo/top_clientes`,
`AfipComprobanteStore.total_periodo`) — contra Postgres REAL, no fakes.

**Por qué real.** El aislamiento entre tenants es un `WHERE cliente_id = %s` explícito, no sólo RLS
(regla del repo: RLS no es la única barrera). Un test con fakes por-tenant no puede detectar un WHERE
faltante -- probaría el fake, no el filtro. Y el cálculo de `queda`/la resta de notas de crédito es
aritmética real que sólo Postgres puede confirmar.

Corre en el VPS, con `DATABASE_URL` cargada (ver cabecera de `test_afip_stores_integracion.py`).
"""
from __future__ import annotations

import os
import uuid
from datetime import date
from decimal import Decimal

import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from afip_comprobante_store import AfipComprobanteStore
from afip_web import create_afip_app
from afip_rules import TipoComprobante
from cobro_store import CobroStore
from gasto_store import GastoStore

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="requiere DATABASE_URL (corre en el VPS)")

PERIODO = "2026-07"


@pytest.fixture
def tenant_a():
    return str(uuid.uuid4())


@pytest.fixture
def tenant_b():
    return str(uuid.uuid4())


@pytest.fixture(autouse=True)
def limpiar(conn_de_tenant, tenant_a, tenant_b):
    yield
    for cid in (tenant_a, tenant_b):
        conn_propia = conn_de_tenant(cid)()
        try:
            with conn_propia.cursor() as cur:
                for tabla in ("copiloto_cobros", "copiloto_gastos", "afip_comprobantes",
                              "copiloto_eventos"):
                    cur.execute(f"DELETE FROM uc_factory.{tabla} WHERE cliente_id = %s", (cid,))
        finally:
            conn_propia.close()


def _comprobante(cf, cid, *, tipo_cbte: int, total, nro: int, cbte_asoc_nro=None):
    AfipComprobanteStore(cf, cid).registrar(
        cuit="20111111112", tipo_cbte=tipo_cbte, punto_venta=1, nro=nro, cae=f"CAE{nro}",
        cae_vto=date(2026, 8, 1), fecha_emision=date(2026, 7, 15), doc_tipo=80,
        doc_nro="20222222223", total=total, cbte_asoc_nro=cbte_asoc_nro)


# --- 🔴 caja: dos ingresos + un gasto, y `queda` negativo ---

def test_caja_con_2_ingresos_y_1_gasto(conn_de_tenant, tenant_a):
    cf = conn_de_tenant(tenant_a)
    cobros = CobroStore(cf, tenant_a)
    gastos = GastoStore(cf, tenant_a)
    cobros.registrar_suelto(monto="60000.00", fecha=date(2026, 7, 5), cliente_nombre="Juan")
    cobros.registrar_suelto(monto="40000.00", fecha=date(2026, 7, 20), cliente_nombre="Ana")
    gastos.crear(monto="35000.00", fecha=date(2026, 7, 10), categoria="mercaderia")

    ingresos = cobros.total_periodo(PERIODO)
    salio = gastos.resumen(PERIODO)
    assert ingresos["total"] == "100000.00"
    assert salio["total"] == "35000.00"


def test_queda_negativo_cuando_los_gastos_superan_a_los_ingresos(conn_de_tenant, tenant_a):
    cf = conn_de_tenant(tenant_a)
    CobroStore(cf, tenant_a).registrar_suelto(monto="10000.00", fecha=date(2026, 7, 5))
    GastoStore(cf, tenant_a).crear(monto="50000.00", fecha=date(2026, 7, 10))

    entro = Decimal(CobroStore(cf, tenant_a).total_periodo(PERIODO)["total"])
    salio = Decimal(GastoStore(cf, tenant_a).resumen(PERIODO)["total"])
    assert entro - salio == Decimal("-40000.00")


def test_periodo_sin_movimientos_da_cero_no_null_en_el_total(conn_de_tenant, tenant_a):
    cf = conn_de_tenant(tenant_a)
    r = CobroStore(cf, tenant_a).total_periodo("2020-01")
    assert r["total"] == "0.00" and r["mes_anterior"] is None


# --- 🔴 cliente_ref como int, no string ---

def test_top_clientes_cliente_ref_es_int(conn_de_tenant, tenant_a):
    cf = conn_de_tenant(tenant_a)
    CobroStore(cf, tenant_a).registrar_suelto(monto="84000.00", fecha=date(2026, 7, 5),
                                              cliente_ref=12, cliente_nombre="Ferretería López")
    top = CobroStore(cf, tenant_a).top_clientes(PERIODO)
    assert len(top) == 1
    assert top[0] == {"cliente_ref": 12, "nombre": "Ferretería López", "total": "84000.00"}
    assert isinstance(top[0]["cliente_ref"], int)


def test_top_clientes_ignora_cobros_sin_cliente_ref(conn_de_tenant, tenant_a):
    cf = conn_de_tenant(tenant_a)
    CobroStore(cf, tenant_a).registrar_suelto(monto="5000.00", fecha=date(2026, 7, 5))  # sin cliente_ref
    assert CobroStore(cf, tenant_a).top_clientes(PERIODO) == []


# --- 🔴 facturado: las notas de crédito RESTAN ---

def test_facturado_resta_la_nota_de_credito(conn_de_tenant, tenant_a):
    cf = conn_de_tenant(tenant_a)
    _comprobante(cf, tenant_a, tipo_cbte=int(TipoComprobante.FACTURA_B), total="100000.00", nro=1)
    _comprobante(cf, tenant_a, tipo_cbte=int(TipoComprobante.NOTA_CREDITO_B), total="20000.00",
                nro=2, cbte_asoc_nro=1)
    r = AfipComprobanteStore(cf, tenant_a).total_periodo(PERIODO)
    assert r["periodo"] == "80000.00"


def test_facturado_no_es_lo_mismo_que_caja(conn_de_tenant, tenant_a):
    """🔴 La regla que sostiene todo el hito: una factura emitida NO mueve `caja.entro`, y un cobro
    dictado NO mueve `facturado`. Si alguna de las dos se contaminara, este test lo mostraría."""
    cf = conn_de_tenant(tenant_a)
    _comprobante(cf, tenant_a, tipo_cbte=int(TipoComprobante.FACTURA_B), total="80000.00", nro=1)
    CobroStore(cf, tenant_a).registrar_suelto(monto="30000.00", fecha=date(2026, 7, 5))

    assert CobroStore(cf, tenant_a).total_periodo(PERIODO)["total"] == "30000.00"
    assert AfipComprobanteStore(cf, tenant_a).total_periodo(PERIODO)["periodo"] == "80000.00"


# --- 🔴 adversarial cross-tenant (bloquea el cierre, no es opcional) ---

def test_ADVERSARIAL_caja_de_A_no_incluye_nada_de_B(conn_de_tenant, tenant_a, tenant_b):
    cf_a, cf_b = conn_de_tenant(tenant_a), conn_de_tenant(tenant_b)
    CobroStore(cf_a, tenant_a).registrar_suelto(monto="10000.00", fecha=date(2026, 7, 5))
    GastoStore(cf_a, tenant_a).crear(monto="1000.00", fecha=date(2026, 7, 5))
    CobroStore(cf_b, tenant_b).registrar_suelto(monto="999999.00", fecha=date(2026, 7, 5))
    GastoStore(cf_b, tenant_b).crear(monto="888888.00", fecha=date(2026, 7, 5))

    assert CobroStore(cf_a, tenant_a).total_periodo(PERIODO)["total"] == "10000.00"
    assert GastoStore(cf_a, tenant_a).resumen(PERIODO)["total"] == "1000.00"


def test_ADVERSARIAL_facturado_de_A_no_incluye_nada_de_B(conn_de_tenant, tenant_a, tenant_b):
    cf_a, cf_b = conn_de_tenant(tenant_a), conn_de_tenant(tenant_b)
    _comprobante(cf_a, tenant_a, tipo_cbte=int(TipoComprobante.FACTURA_B), total="50000.00", nro=1)
    _comprobante(cf_b, tenant_b, tipo_cbte=int(TipoComprobante.FACTURA_B), total="777777.00", nro=1)

    assert AfipComprobanteStore(cf_a, tenant_a).total_periodo(PERIODO)["periodo"] == "50000.00"


def test_ADVERSARIAL_top_clientes_de_A_no_incluye_clientes_de_B(conn_de_tenant, tenant_a, tenant_b):
    cf_a, cf_b = conn_de_tenant(tenant_a), conn_de_tenant(tenant_b)
    CobroStore(cf_a, tenant_a).registrar_suelto(monto="1000.00", fecha=date(2026, 7, 5),
                                                cliente_ref=1, cliente_nombre="Cliente A")
    CobroStore(cf_b, tenant_b).registrar_suelto(monto="999999.00", fecha=date(2026, 7, 5),
                                                cliente_ref=1, cliente_nombre="Cliente B (ajeno)")

    top_a = CobroStore(cf_a, tenant_a).top_clientes(PERIODO)
    assert len(top_a) == 1 and top_a[0]["nombre"] == "Cliente A" and top_a[0]["total"] == "1000.00"


# --- 🔴 GET /ingresos/resumen — la RUTA, no sólo el store -----------------------------------------
#
# Los tests de arriba ejercitan `CobroStore.total_periodo` directamente. Eso NO prueba la ruta: el
# cálculo podía estar perfecto y la ruta no existir (que es exactamente como estuvo hasta hoy — la
# lógica escrita y huérfana). Estos van por HTTP, con `TestClient`, contra Postgres real y con el
# store REAL inyectado: sin fakes en el medio, porque lo que se quiere verificar —el filtro por
# tenant— vive en el `WHERE cliente_id = %s`, y un fake por-tenant lo confirmaría sin que exista.

def _app_ingresos(conn_de_tenant, tenant: str) -> TestClient:
    """App mínima con el `CobroStore` REAL del tenant dado. `require_tenant` fija quién pregunta."""
    afip = create_afip_app(
        require_tenant=lambda: tenant,
        perfil_store_factory=lambda cid: None,
        cred_store_factory=lambda cid: None,
        handoff_factory=lambda cid: None,
        start_onboarding=lambda *a: "wf",
        cobro_store_factory=lambda cid: CobroStore(conn_de_tenant(cid), cid),
    )
    app = FastAPI()
    app.mount("/", afip)
    return TestClient(app)


def test_ruta_resumen_devuelve_el_total_real_del_periodo(conn_de_tenant, tenant_a):
    cf = conn_de_tenant(tenant_a)
    CobroStore(cf, tenant_a).registrar_suelto(monto="60000.00", fecha=date(2026, 7, 5))
    CobroStore(cf, tenant_a).registrar_suelto(monto="40000.00", fecha=date(2026, 7, 20))

    r = _app_ingresos(conn_de_tenant, tenant_a).get(f"/ingresos/resumen?periodo={PERIODO}")

    assert r.status_code == 200
    assert r.json() == {"periodo": PERIODO, "total": "100000.00", "mes_anterior": None}


def test_ruta_resumen_NO_es_el_total_de_listar_ingresos(conn_de_tenant, tenant_a):
    """El motivo de existir del endpoint: `/ingresos` suma las últimas N filas SIN recortar por
    fecha. Pintar ese número bajo «Cobraste este mes» le miente al usuario. Acá se prueba que los
    dos números son distintos cuando hay plata de otro mes — si alguien "simplificara" la ruta para
    devolver el total del listado, esto se pone rojo."""
    cf = conn_de_tenant(tenant_a)
    CobroStore(cf, tenant_a).registrar_suelto(monto="70000.00", fecha=date(2026, 7, 10))
    CobroStore(cf, tenant_a).registrar_suelto(monto="99000.00", fecha=date(2026, 5, 10))  # otro mes
    cli = _app_ingresos(conn_de_tenant, tenant_a)

    resumen = cli.get(f"/ingresos/resumen?periodo={PERIODO}").json()
    listado = cli.get("/ingresos").json()

    assert resumen["total"] == "70000.00"          # sólo julio
    assert Decimal(listado["total"]) == Decimal("169000.00")   # todo lo listado
    assert resumen["total"] != listado["total"]


def test_ruta_resumen_ADVERSARIAL_el_tenant_A_no_ve_la_plata_del_B(conn_de_tenant, tenant_a,
                                                                  tenant_b):
    """🔴 Control de aislamiento ejercitado con un actor HOSTIL, no con el happy-path.

    Regla dura del repo: un control de autorización sin test adversarial es un control NO
    verificado. El happy-path ("cada quien ve lo suyo") pasa igual si el aislamiento no existe —
    sólo este caso detecta el fail-open. Es el mismo modo de fallo del drift de ADR-013 §3.3.4, que
    vivió ~2 meses en prod porque ningún test probó "A pide lo de B".

    Acá el endpoint expone **plata agregada**, así que una fuga no es un ID de más: es la
    facturación de otro negocio.

    ⚠️ **Alcance honesto de este test: verifica el SISTEMA, no aísla la capa de aplicación.** Hay dos
    barreras encima del mismo dato — el `WHERE cliente_id = %s` de `total_periodo` y el RLS `FORCE`
    de la tabla. Si alguien borrara el `WHERE`, es probable que RLS tapara la fuga y este test
    siguiera verde: defense-in-depth enmascara el control negativo de la capa interna (ya nos pasó,
    Fase D lote C). O sea: **este test prueba que el usuario no ve plata ajena, no prueba que el
    filtro app-side esté puesto.** Para eso hace falta ejercitarlo con RLS desactivado, que no es
    algo que un test de la suite deba hacer por su cuenta. Lo dejo dicho para que nadie lea este
    verde como más garantía de la que da.
    """
    CobroStore(conn_de_tenant(tenant_b), tenant_b).registrar_suelto(
        monto="500000.00", fecha=date(2026, 7, 15))
    # A no registró NADA en el período.
    r = _app_ingresos(conn_de_tenant, tenant_a).get(f"/ingresos/resumen?periodo={PERIODO}")

    assert r.status_code == 200
    # Si el `WHERE cliente_id` faltara, acá aparecerían los 500000 de B.
    assert r.json()["total"] == "0.00", "🔴 FUGA CROSS-TENANT: el resumen de A trae plata de B"


def test_ruta_resumen_no_la_come_la_ruta_del_id(conn_de_tenant, tenant_a):
    """El registro de `gastos_web.py:105`: si `/ingresos/resumen` se declara DESPUÉS de una ruta
    `/ingresos/{id}`, el segmento textual "resumen" cae ahí, no parsea como entero y muere con
    `422 int_parsing`. Se ejercita por HTTP porque es el routing lo que falla, no la función."""
    r = _app_ingresos(conn_de_tenant, tenant_a).get("/ingresos/resumen")
    assert r.status_code == 200, f"el routing se comió /resumen: {r.status_code} {r.text[:120]}"


def test_ruta_resumen_periodo_invalido_da_400_y_no_toca_la_base(conn_de_tenant, tenant_a):
    r = _app_ingresos(conn_de_tenant, tenant_a).get("/ingresos/resumen?periodo=julio")
    assert r.status_code == 400
    assert "periodo inválido" in r.json()["detail"]
