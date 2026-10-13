"""F1.4 (issue #1003) — UN predicado de «lo facturado», citado por todos los consumidores.

**El defecto que cierra.** La misma pregunta —«¿qué facturó este mes?»— se respondía con cuatro
criterios según quién la hiciera, y dos se contradecían de signo:

  · `AfipComprobanteStore.total_periodo` (facturación/contabilidad): excluía la factura ANULADA **y
    además restaba** su nota de crédito ⇒ restaba dos veces.
  · `InteligenciaQueries._facturado` / `facturacion_por_mes` / `facturacion_detalle_mes` (portada, BI):
    excluía la anulada y **sumaba** la NC (`sum(total)` sin mirar el tipo) ⇒ inflaba.
  · `ClienteStore.resumen_operaciones` (ficha): con CAE, NC resta, sin filtrar anulada ⇒ el correcto.
  · `CobroStore.impagos` (quinto camino): traía la NC como DEUDA, sin mirar el tipo.

**El test pide el MISMO mes a las cuatro superficies y exige la MISMA cifra** — no cuatro tests de que
cada una responde algo. El caso que lo vuelve discriminante es el par factura-anulada + NC: es el que
cambia el signo, y con él las tres definiciones viejas daban −50000 / 150000 / 50000 para el mismo mes.

Corre en el VPS con `DATABASE_URL` (Postgres real: la aritmética de la resta vive en el SQL).
"""
from __future__ import annotations

import os
import pathlib
import uuid
from decimal import Decimal

import pytest

from afip_comprobante_store import AfipComprobanteStore
from afip_rules import (NOTAS_CREDITO, TipoComprobante, facturado_filtro_sql,
                        facturado_monto_sql)
from cliente_store import DOC_CUIT, ClienteStore
from cobro_store import CobroStore
from gasto_store import hoy_del_negocio
from inteligencia_queries import InteligenciaQueries

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")

_DOC_RECEPTOR = "20222222223"
_APP = pathlib.Path(__file__).resolve().parent.parent


@pytest.fixture
def tenant():
    cid = str(uuid.uuid4())
    yield cid


@pytest.fixture(autouse=True)
def _limpiar(conn_de_tenant, tenant):
    yield
    conn = conn_de_tenant(tenant)()
    try:
        with conn.cursor() as cur:
            for tabla in ("copiloto_cobros", "afip_comprobantes", "copiloto_clientes",
                          "copiloto_eventos"):
                cur.execute(f"DELETE FROM uc_factory.{tabla} WHERE cliente_id = %s", (tenant,))
    finally:
        conn.close()


def _cargar(cf, cid, *, tipo, nro, total, estado=None, asoc=None):
    return AfipComprobanteStore(cf, cid).registrar(
        cuit="20111111112", tipo_cbte=int(tipo), punto_venta=1, nro=nro, cae=f"CAE{nro}",
        cae_vto=None, fecha_emision=hoy_del_negocio(), doc_tipo=DOC_CUIT, doc_nro=_DOC_RECEPTOR,
        total=total, estado=estado, receptor_nombre="Cliente Uno", cbte_asoc_nro=asoc)


def _escenario(cf, cid):
    """Una factura vigente de 50000 + una de 100000 que se ANULÓ con su NC de 100000.
    El facturado NETO del mes es 50000 — la anulada y su NC se cancelan entre sí."""
    _cargar(cf, cid, tipo=TipoComprobante.FACTURA_B, nro=1, total="50000.00")
    _cargar(cf, cid, tipo=TipoComprobante.FACTURA_B, nro=2, total="100000.00", estado="anulada")
    return _cargar(cf, cid, tipo=TipoComprobante.NOTA_CREDITO_B, nro=3, total="100000.00", asoc=2)


@necesita_pg
def test_las_cuatro_superficies_dan_la_misma_cifra_para_el_mismo_mes(conn_de_tenant, tenant):
    cf = conn_de_tenant(tenant)
    _escenario(cf, tenant)
    q = InteligenciaQueries(cf, tenant)
    mes_actual = hoy_del_negocio().strftime("%Y-%m")

    portada = Decimal(q.portada()["mes"]["facturado"])
    barra = Decimal(next(m for m in q.facturacion_por_mes(2)["serie"]
                         if m["mes"] == mes_actual)["total"])
    detalle = sum((Decimal(f["total"]) for f in q.facturacion_detalle_mes(mes_actual)["filas"]),
                  Decimal(0))
    contabilidad = Decimal(AfipComprobanteStore(cf, tenant).total_periodo(mes_actual)["periodo"])

    cifras = {"portada": portada, "grafico": barra, "detalle": detalle, "facturacion": contabilidad}
    assert set(cifras.values()) == {Decimal("50000.00")}, (
        f"las superficies no coinciden sobre el mismo mes: {cifras} — esperado 50000.00 en todas "
        "(factura vigente 50000 + [factura anulada 100000 − su NC 100000])")


@necesita_pg
def test_la_ficha_del_cliente_coincide_con_las_cuatro(conn_de_tenant, tenant):
    """La quinta superficie: lo facturado a UN cliente. Con un solo cliente en el tenant tiene que
    dar la misma cifra que el total del mes — si no, la ficha usa otra definición."""
    cf = conn_de_tenant(tenant)
    _escenario(cf, tenant)
    cliente = ClienteStore(cf, tenant).crear(nombre="Cliente Uno", doc_tipo=DOC_CUIT,
                                             doc_nro=_DOC_RECEPTOR)
    ficha = ClienteStore(cf, tenant).resumen_operaciones(cliente["id"])
    assert ficha["facturado"] == "50000.00"
    assert (ficha["facturas"], ficha["notas_credito"]) == (2, 1)


@necesita_pg
def test_la_NC_suelta_resta_en_todas_las_superficies(conn_de_tenant, tenant):
    """El caso que 'cambia el signo' sin anulada de por medio: una factura de 80000 y una NC de 30000
    sobre ella (la factura sigue `emitida`). Neto 50000 — ninguna superficie puede sumar la NC."""
    cf = conn_de_tenant(tenant)
    _cargar(cf, tenant, tipo=TipoComprobante.FACTURA_B, nro=1, total="80000.00")
    _cargar(cf, tenant, tipo=TipoComprobante.NOTA_CREDITO_B, nro=2, total="30000.00", asoc=1)
    q = InteligenciaQueries(cf, tenant)
    mes_actual = hoy_del_negocio().strftime("%Y-%m")

    assert Decimal(q.portada()["mes"]["facturado"]) == Decimal("50000.00")
    assert Decimal(AfipComprobanteStore(cf, tenant).total_periodo(mes_actual)["periodo"]) == \
        Decimal("50000.00")


@necesita_pg
def test_la_NC_no_aparece_como_deuda(conn_de_tenant, tenant):
    """El quinto camino: `impagos` traía la NC (con CAE, sin cobro) como plata que te DEBEN."""
    cf = conn_de_tenant(tenant)
    _escenario(cf, tenant)
    r = CobroStore(cf, tenant).impagos()
    assert [c["nro"] for c in r["comprobantes"]] == [1], (
        f"sólo la factura vigente es deuda; llegó {[c['nro'] for c in r['comprobantes']]}")
    assert r["total_adeudado"] == "50000.00"


# ── el predicado como código: sin DB ────────────────────────────────────────────────────────────

def test_el_sql_del_predicado_sale_del_enum_no_de_una_lista_a_mano():
    sql = facturado_monto_sql()
    for codigo in NOTAS_CREDITO:
        assert str(int(codigo)) in sql
    assert "-total" in sql and facturado_filtro_sql() == "cae IS NOT NULL"
    assert facturado_monto_sql("c").count("c.") == 3 and facturado_filtro_sql("c") == "c.cae IS NOT NULL"


@pytest.mark.parametrize("modulo", ["afip_comprobante_store.py", "inteligencia_queries.py",
                                    "cliente_store.py"])
def test_ningun_consumidor_reescribe_el_signo_de_la_NC(modulo):
    """«0 definiciones alternativas», no «0 usos de la vieja»: el único lugar donde aparece el CASE
    que firma la NC es `afip_rules.facturado_monto_sql`. Un quinto consumidor que lo reescriba
    es el que diverge en el próximo cambio."""
    fuente = (_APP / modulo).read_text(encoding="utf-8")
    assert "facturado_monto_sql" in fuente, f"{modulo} no cita el predicado único"
    assert "THEN -total" not in fuente and "sum(total) FILTER" not in fuente, (
        f"{modulo} reescribe la firma de la NC en vez de citar afip_rules.facturado_monto_sql")
