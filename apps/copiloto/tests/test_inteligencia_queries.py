"""INTELIGENCIA DE NEGOCIO — la capa de queries, contra Postgres real.

Contra la base y no contra fakes, a propósito: lo que este módulo promete —que «Entró» son los TRES
orígenes, que un `JOIN` que no matchea no devuelva un cero prolijo, que un tenant no vea la caja de
otro— **vive en el SQL**. Un fake que devuelve lo que le pido confirmaría las tres cosas sin que
ninguna sea cierta.

El test central es el **control del §1.bis** (`test_control_del_1bis_...`): el contrato pide que se
CORRA, no que se lea —cargar un ingreso dictado y ver que «Entró» sube—. Un `JOIN` mal hecho devuelve
el mismo número prolijo sin protestar (`vacio-no-es-hallazgo-correr-el-control`); este test es
exactamente ese control, horneado en la suite.
"""
from __future__ import annotations

import os
import uuid
from decimal import Decimal

import pytest

from cobro_store import CobroStore
from inteligencia_queries import DIAS_VENCIDO, InteligenciaQueries

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def conn_factory():
    import psycopg2

    def factory():
        c = psycopg2.connect(os.environ["DATABASE_URL"])
        c.autocommit = True
        return c
    return factory


@pytest.fixture
def tenants(conn_factory):
    """Dos tenants sintéticos —A y B— y el barrido de TODO lo que esta prueba escriba.

    `copiloto_eventos` entra en el barrido: los stores loguean ahí desde el hito 5 §1.1, y si no se
    limpia, cada corrida deja huérfanos en producción (la lección que ese hito pagó caro)."""
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    conn = conn_factory()
    with conn.cursor() as cur:
        for t in ("copiloto_cobros", "copiloto_gastos", "mp_payments", "afip_comprobantes",
                  "copiloto_eventos"):
            cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id IN (%s, %s)", (a, b))
    conn.close()


# ── helpers de inserción (el territorio, no un sustituto) ────────────────────────────────────────

def _comprobante(conn_factory, cid, total, *, nro=1, estado="emitida", dias_atras=0,
                 receptor="Cliente Uno"):
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.afip_comprobantes
                       (cliente_id, cuit, tipo_cbte, punto_venta, nro, cae,
                        fecha_emision, total, estado, receptor_nombre)
                       VALUES (%s,'30712345678',6,1,%s,'CAE-TEST',
                               CURRENT_DATE - %s, %s, %s, %s) RETURNING id""",
                    (cid, nro, dias_atras, total, estado, receptor))
        return cur.fetchone()[0]


def _gasto(conn_factory, cid, monto, *, categoria="otros", dias_atras=0):
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.copiloto_gastos (cliente_id, monto, fecha, categoria)
                       VALUES (%s, %s, CURRENT_DATE - %s, %s)""",
                    (cid, monto, dias_atras, categoria))


def _mp_payment(conn_factory, cid, amount, *, status="approved", pid=None):
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.mp_payments
                       (cliente_id, payment_id, seller_user_id, status, amount, occurred_at)
                       VALUES (%s, %s, 'seller-1', %s, %s, now())""",
                    (cid, pid or str(uuid.uuid4()), status, amount))


def _ingresos_portada(q):
    return Decimal(q.portada()["mes"]["ingresos"])


# ── el control del §1.bis: el DoD, corrido ───────────────────────────────────────────────────────

@necesita_pg
def test_control_del_1bis_un_ingreso_dictado_hace_subir_ENTRO(conn_factory, tenants):
    """🔴 El control del contrato §1.bis, CORRIDO, no leído. Cargar un ingreso dictado y verificar que
    «Entró» (mes.ingresos) sube exactamente por ese monto. Si el SQL leyera una tabla sola, este número
    no se movería y la caja mentiría con un número prolijo."""
    a, _ = tenants
    q = InteligenciaQueries(conn_factory, a)
    antes = _ingresos_portada(q)

    CobroStore(conn_factory, a).registrar_suelto(monto="85000.00", medio="efectivo",
                                                 cliente_nombre="Panadería Los Tilos")

    despues = _ingresos_portada(q)
    assert despues - antes == Decimal("85000.00"), "un ingreso dictado tiene que subir «Entró»"
    # Y también en el mes actual de la serie: la portada y el gráfico leen la MISMA definición (§0).
    serie = q.portada()["serie_mensual"]
    assert Decimal(serie[-1]["ingresos"]) >= Decimal("85000.00")


@necesita_pg
def test_ENTRO_son_los_TRES_origenes_y_el_MP_no_aprobado_no_cuenta(conn_factory, tenants):
    """«Entró» = cobros de factura + dictados + MercadoPago aprobado. Un pago MP `pending` NO entra:
    todavía no es plata que entró."""
    a, _ = tenants
    comp = _comprobante(conn_factory, a, "1000.00")
    CobroStore(conn_factory, a).registrar(comp, monto="1000.00")          # factura
    CobroStore(conn_factory, a).registrar_suelto(monto="500.00", medio="efectivo")  # dictado
    _mp_payment(conn_factory, a, "300.00", status="approved")             # MP aprobado
    _mp_payment(conn_factory, a, "999.00", status="pending")              # MP pendiente → NO cuenta

    assert _ingresos_portada(InteligenciaQueries(conn_factory, a)) == Decimal("1800.00")


@necesita_pg
def test_caja_y_rentabilidad_son_entro_menos_salio_del_mes(conn_factory, tenants):
    a, _ = tenants
    CobroStore(conn_factory, a).registrar_suelto(monto="1000.00", medio="efectivo")
    _gasto(conn_factory, a, "400.00", categoria="mercaderia")
    mes = InteligenciaQueries(conn_factory, a).portada()
    assert Decimal(mes["mes"]["gastos"]) == Decimal("400.00")
    assert Decimal(mes["mes"]["rentabilidad"]) == Decimal("600.00")
    assert Decimal(mes["caja"]["saldo"]) == Decimal("600.00")
    assert mes["caja"]["moneda"] == "ARS"


@necesita_pg
def test_facturado_no_es_cobrado(conn_factory, tenants):
    """Emitir sube «facturado» y NO «cobrado»; recién el cobro sube «cobrado». Son dos números
    distintos y el contrato los pide por separado."""
    a, _ = tenants
    comp = _comprobante(conn_factory, a, "2000.00")
    p1 = InteligenciaQueries(conn_factory, a).portada()["mes"]
    assert Decimal(p1["facturado"]) == Decimal("2000.00")
    assert Decimal(p1["cobrado"]) == Decimal("0.00")

    CobroStore(conn_factory, a).registrar(comp, monto="1200.00")
    p2 = InteligenciaQueries(conn_factory, a).portada()["mes"]
    assert Decimal(p2["facturado"]) == Decimal("2000.00")   # facturado no cambia
    assert Decimal(p2["cobrado"]) == Decimal("1200.00")     # cobrado sí


@necesita_pg
def test_por_cobrar_reusa_impagos_y_separa_lo_vencido(conn_factory, tenants):
    """`por_cobrar.total` == el `total_adeudado` de la pantalla «Te deben» (mismo cálculo, §0). Una
    factura emitida hace más de `DIAS_VENCIDO` días y sin cobrar cae en `vencido`."""
    a, _ = tenants
    _comprobante(conn_factory, a, "1000.00", nro=1, dias_atras=DIAS_VENCIDO + 5)   # vencida
    _comprobante(conn_factory, a, "700.00", nro=2, dias_atras=0)                   # al día
    pc = InteligenciaQueries(conn_factory, a).portada()["por_cobrar"]
    assert Decimal(pc["total"]) == Decimal("1700.00")
    assert Decimal(pc["vencido"]) == Decimal("1000.00")


@necesita_pg
def test_una_factura_anulada_no_es_deuda(conn_factory, tenants):
    a, _ = tenants
    _comprobante(conn_factory, a, "5000.00", estado="anulada")
    assert Decimal(InteligenciaQueries(conn_factory, a).portada()["por_cobrar"]["total"]) == Decimal("0.00")


@necesita_pg
def test_serie_mensual_seis_meses_continuos_sin_huecos(conn_factory, tenants):
    a, _ = tenants
    CobroStore(conn_factory, a).registrar_suelto(monto="1234.00", medio="efectivo")
    serie = InteligenciaQueries(conn_factory, a).portada()["serie_mensual"]
    assert len(serie) == 6
    # Sin huecos: cada punto tiene mes/ingresos/gastos, aunque sea "0.00".
    assert all(set(p) == {"mes", "ingresos", "gastos"} for p in serie)
    assert Decimal(serie[-1]["ingresos"]) == Decimal("1234.00")   # el mes actual refleja el ingreso


@necesita_pg
def test_mejores_clientes_resuelve_el_nombre_y_ordena(conn_factory, tenants):
    a, _ = tenants
    CobroStore(conn_factory, a).registrar_suelto(monto="900.00", cliente_nombre="Cliente Grande")
    CobroStore(conn_factory, a).registrar_suelto(monto="100.00", cliente_nombre="Cliente Chico")
    CobroStore(conn_factory, a).registrar_suelto(monto="50.00")   # sin nombre → afuera del ranking
    ranking = InteligenciaQueries(conn_factory, a).portada()["mejores_clientes"]
    assert [c["cliente"] for c in ranking] == ["Cliente Grande", "Cliente Chico"]
    assert ranking[0]["total"] == "900.00"


# ── aislamiento adversarial (regla 7): A no ve la caja de B por ninguna cara ──────────────────────

@necesita_pg
def test_aislamiento_A_no_ve_los_ingresos_de_B(conn_factory, tenants):
    a, b = tenants
    CobroStore(conn_factory, b).registrar_suelto(monto="999999.00", medio="efectivo")
    _mp_payment(conn_factory, b, "888888.00", status="approved")
    _gasto(conn_factory, b, "777777.00")
    portada_a = InteligenciaQueries(conn_factory, a).portada()
    assert Decimal(portada_a["mes"]["ingresos"]) == Decimal("0.00")
    assert Decimal(portada_a["mes"]["gastos"]) == Decimal("0.00")
    assert Decimal(portada_a["caja"]["saldo"]) == Decimal("0.00")
