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

from afip_comprobante_store import AfipComprobanteStore
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
