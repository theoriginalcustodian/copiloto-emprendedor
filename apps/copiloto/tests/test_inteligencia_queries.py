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

import datetime
import os
import uuid
from decimal import Decimal

import pytest

from cobro_store import CobroStore
from gasto_store import CATEGORIAS, GastoStore, hoy_del_negocio
from inteligencia_queries import DIAS_VENCIDO, InteligenciaQueries
from presupuesto_store import PresupuestoStore
from trabajo_store import TrabajoStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def tenants(conn_de_tenant):
    """Dos tenants sintéticos —A y B— y el barrido de TODO lo que esta prueba escriba.

    `copiloto_eventos` entra en el barrido: los stores loguean ahí desde el hito 5 §1.1, y si no se
    limpia, cada corrida deja huérfanos en producción (la lección que ese hito pagó caro).

    Con RLS hay que borrar UNA VEZ POR TENANT, con la conexión de ese tenant — una sola conexión no
    puede ver (ni borrar) las filas de ambos a la vez."""
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            for t in ("copiloto_cobros", "copiloto_gastos", "mp_payments", "afip_comprobantes",
                      "copiloto_presupuesto_items", "copiloto_presupuestos", "copiloto_eventos"):
                cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id = %s", (cid,))
        conn.close()


# ── helpers de inserción (el territorio, no un sustituto) ────────────────────────────────────────

def _dia_del_negocio(dias_atras: int = 0) -> datetime.date:
    """El "hoy" del NEGOCIO (UTC−3), no el de Postgres.

    Estos helpers escribían `CURRENT_DATE`, que Postgres evalúa en la zona del servidor —UTC en el
    CI—, mientras las queries que se están probando recortan el mes con `hoy_del_negocio()`. Las dos
    definiciones difieren durante las 3 horas de la noche argentina en que allá ya es el día
    siguiente: entre las 21:00 y las 00:00 del último día del mes, las filas se escribían en el mes
    entrante y las consultas seguían mirando el que terminaba, así que TODO leía `0.00`.

    No es hipotético — es lo que pasó: 7 tests de este archivo se pusieron rojos en el CI del
    2026-08-01T00:19Z, cuando en Argentina eran las 21:19 del 31/7. Y estaba escrito de antemano en
    el docstring de `hoy_del_negocio`, que explica por qué la columna `fecha` **no tiene DEFAULT en
    SQL**: *"dos definiciones de 'hoy' que divergen 3 horas por día es exactamente el tipo de bug que
    aparece sólo a veces, de noche, y se cierra como 'no reproducible'"*. El fixture reintrodujo por
    la puerta de atrás la trampa que el store había cerrado por la de adelante.
    """
    return hoy_del_negocio() - datetime.timedelta(days=dias_atras)


def _comprobante(conn_de_tenant, cid, total, *, nro=1, estado="emitida", dias_atras=0,
                 receptor="Cliente Uno"):
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.afip_comprobantes
                       (cliente_id, cuit, tipo_cbte, punto_venta, nro, cae,
                        fecha_emision, total, estado, receptor_nombre)
                       VALUES (%s,'30712345678',6,1,%s,'CAE-TEST',
                               %s, %s, %s, %s) RETURNING id""",
                    (cid, nro, _dia_del_negocio(dias_atras), total, estado, receptor))
        return cur.fetchone()[0]


def _gasto(conn_de_tenant, cid, monto, *, categoria="otros", dias_atras=0):
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.copiloto_gastos (cliente_id, monto, fecha, categoria)
                       VALUES (%s, %s, %s, %s)""",
                    (cid, monto, _dia_del_negocio(dias_atras), categoria))


def _mp_payment(conn_de_tenant, cid, amount, *, status="approved", pid=None):
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.mp_payments
                       (cliente_id, payment_id, seller_user_id, status, amount, occurred_at)
                       VALUES (%s, %s, 'seller-1', %s, %s, now())""",
                    (cid, pid or str(uuid.uuid4()), status, amount))


def _ingresos_portada(q):
    return Decimal(q.portada()["mes"]["ingresos"])


# ── el control del §1.bis: el DoD, corrido ───────────────────────────────────────────────────────

@necesita_pg
def test_control_del_1bis_un_ingreso_dictado_hace_subir_ENTRO(conn_de_tenant, tenants):
    """🔴 El control del contrato §1.bis, CORRIDO, no leído. Cargar un ingreso dictado y verificar que
    «Entró» (mes.ingresos) sube exactamente por ese monto. Si el SQL leyera una tabla sola, este número
    no se movería y la caja mentiría con un número prolijo."""
    a, _ = tenants
    q = InteligenciaQueries(conn_de_tenant(a), a)
    antes = _ingresos_portada(q)

    CobroStore(conn_de_tenant(a), a).registrar_suelto(monto="85000.00", medio="efectivo",
                                                 cliente_nombre="Panadería Los Tilos")

    despues = _ingresos_portada(q)
    assert despues - antes == Decimal("85000.00"), "un ingreso dictado tiene que subir «Entró»"
    # Y también en el mes actual de la serie: la portada y el gráfico leen la MISMA definición (§0).
    serie = q.portada()["serie_mensual"]
    assert Decimal(serie[-1]["ingresos"]) >= Decimal("85000.00")


@necesita_pg
def test_ENTRO_son_los_TRES_origenes_y_el_MP_no_aprobado_no_cuenta(conn_de_tenant, tenants):
    """«Entró» = cobros de factura + dictados + MercadoPago aprobado. Un pago MP `pending` NO entra:
    todavía no es plata que entró."""
    a, _ = tenants
    comp = _comprobante(conn_de_tenant, a, "1000.00")
    CobroStore(conn_de_tenant(a), a).registrar(comp, monto="1000.00")          # factura
    CobroStore(conn_de_tenant(a), a).registrar_suelto(monto="500.00", medio="efectivo")  # dictado
    _mp_payment(conn_de_tenant, a, "300.00", status="approved")             # MP aprobado
    _mp_payment(conn_de_tenant, a, "999.00", status="pending")              # MP pendiente → NO cuenta

    assert _ingresos_portada(InteligenciaQueries(conn_de_tenant(a), a)) == Decimal("1800.00")


@necesita_pg
def test_caja_y_rentabilidad_son_entro_menos_salio_del_mes(conn_de_tenant, tenants):
    a, _ = tenants
    CobroStore(conn_de_tenant(a), a).registrar_suelto(monto="1000.00", medio="efectivo")
    _gasto(conn_de_tenant, a, "400.00", categoria="mercaderia")
    mes = InteligenciaQueries(conn_de_tenant(a), a).portada()
    assert Decimal(mes["mes"]["gastos"]) == Decimal("400.00")
    assert Decimal(mes["mes"]["rentabilidad"]) == Decimal("600.00")
    assert Decimal(mes["caja"]["saldo"]) == Decimal("600.00")
    assert mes["caja"]["moneda"] == "ARS"


@necesita_pg
def test_facturado_no_es_cobrado(conn_de_tenant, tenants):
    """Emitir sube «facturado» y NO «cobrado»; recién el cobro sube «cobrado». Son dos números
    distintos y el contrato los pide por separado."""
    a, _ = tenants
    comp = _comprobante(conn_de_tenant, a, "2000.00")
    p1 = InteligenciaQueries(conn_de_tenant(a), a).portada()["mes"]
    assert Decimal(p1["facturado"]) == Decimal("2000.00")
    assert Decimal(p1["cobrado"]) == Decimal("0.00")

    CobroStore(conn_de_tenant(a), a).registrar(comp, monto="1200.00")
    p2 = InteligenciaQueries(conn_de_tenant(a), a).portada()["mes"]
    assert Decimal(p2["facturado"]) == Decimal("2000.00")   # facturado no cambia
    assert Decimal(p2["cobrado"]) == Decimal("1200.00")     # cobrado sí


@necesita_pg
def test_por_cobrar_reusa_impagos_y_separa_lo_vencido(conn_de_tenant, tenants):
    """`por_cobrar.total` == el `total_adeudado` de la pantalla «Te deben» (mismo cálculo, §0). Una
    factura emitida hace más de `DIAS_VENCIDO` días y sin cobrar cae en `vencido`."""
    a, _ = tenants
    _comprobante(conn_de_tenant, a, "1000.00", nro=1, dias_atras=DIAS_VENCIDO + 5)   # vencida
    _comprobante(conn_de_tenant, a, "700.00", nro=2, dias_atras=0)                   # al día
    pc = InteligenciaQueries(conn_de_tenant(a), a).portada()["por_cobrar"]
    assert Decimal(pc["total"]) == Decimal("1700.00")
    assert Decimal(pc["vencido"]) == Decimal("1000.00")


@necesita_pg
def test_una_factura_anulada_no_es_deuda(conn_de_tenant, tenants):
    a, _ = tenants
    _comprobante(conn_de_tenant, a, "5000.00", estado="anulada")
    assert Decimal(InteligenciaQueries(conn_de_tenant(a), a).portada()["por_cobrar"]["total"]) == Decimal("0.00")


@necesita_pg
def test_serie_mensual_seis_meses_continuos_sin_huecos(conn_de_tenant, tenants):
    a, _ = tenants
    CobroStore(conn_de_tenant(a), a).registrar_suelto(monto="1234.00", medio="efectivo")
    serie = InteligenciaQueries(conn_de_tenant(a), a).portada()["serie_mensual"]
    assert len(serie) == 6
    # Sin huecos: cada punto tiene mes/ingresos/gastos, aunque sea "0.00".
    assert all(set(p) == {"mes", "ingresos", "gastos"} for p in serie)
    assert Decimal(serie[-1]["ingresos"]) == Decimal("1234.00")   # el mes actual refleja el ingreso


@necesita_pg
def test_mejores_clientes_resuelve_el_nombre_y_ordena(conn_de_tenant, tenants):
    a, _ = tenants
    CobroStore(conn_de_tenant(a), a).registrar_suelto(monto="900.00", cliente_nombre="Cliente Grande")
    CobroStore(conn_de_tenant(a), a).registrar_suelto(monto="100.00", cliente_nombre="Cliente Chico")
    CobroStore(conn_de_tenant(a), a).registrar_suelto(monto="50.00")   # sin nombre → afuera del ranking
    ranking = InteligenciaQueries(conn_de_tenant(a), a).portada()["mejores_clientes"]
    assert [c["cliente"] for c in ranking] == ["Cliente Grande", "Cliente Chico"]
    assert ranking[0]["total"] == "900.00"


# ── aislamiento adversarial (regla 7): A no ve la caja de B por ninguna cara ──────────────────────
#
# Dos barreras y el test las cruza las dos: el filtro `cliente_id` explícito de cada store/query, y
# el RLS de la base — la conexión de A nace declarando A, así que las filas de B le son invisibles
# incluso si alguna query se olvidara del WHERE.

@necesita_pg
def test_aislamiento_A_no_ve_los_ingresos_de_B(conn_de_tenant, tenants):
    a, b = tenants
    CobroStore(conn_de_tenant(b), b).registrar_suelto(monto="999999.00", medio="efectivo")
    _mp_payment(conn_de_tenant, b, "888888.00", status="approved")
    _gasto(conn_de_tenant, b, "777777.00")
    portada_a = InteligenciaQueries(conn_de_tenant(a), a).portada()
    assert Decimal(portada_a["mes"]["ingresos"]) == Decimal("0.00")
    assert Decimal(portada_a["mes"]["gastos"]) == Decimal("0.00")
    assert Decimal(portada_a["caja"]["saldo"]) == Decimal("0.00")


# ── gráfico 1: facturación por mes ────────────────────────────────────────────────────────────────

@necesita_pg
def test_facturacion_por_mes_suma_y_cuenta_solo_lo_no_anulado_con_cae(conn_de_tenant, tenants):
    a, _ = tenants
    _comprobante(conn_de_tenant, a, "1000.00", nro=1)
    _comprobante(conn_de_tenant, a, "2000.00", nro=2)
    _comprobante(conn_de_tenant, a, "5000.00", nro=3, estado="anulada")   # no cuenta
    g = InteligenciaQueries(conn_de_tenant(a), a).facturacion_por_mes()
    assert len(g["serie"]) == 6
    assert g["tipo"] == "barras"
    ultimo = g["serie"][-1]
    assert Decimal(ultimo["total"]) == Decimal("3000.00")
    assert ultimo["cantidad"] == 2


@necesita_pg
def test_facturacion_detalle_mes_trae_las_filas_del_mismo_mes(conn_de_tenant, tenants):
    a, _ = tenants
    _comprobante(conn_de_tenant, a, "1000.00", nro=1, receptor="Panadería Los Tilos")
    mes_actual = InteligenciaQueries(conn_de_tenant(a), a).facturacion_por_mes()["serie"][-1]["mes"]
    det = InteligenciaQueries(conn_de_tenant(a), a).facturacion_detalle_mes(mes_actual)
    assert det["mes"] == mes_actual
    assert len(det["filas"]) == 1
    fila = det["filas"][0]
    assert fila["cliente"] == "Panadería Los Tilos"
    assert fila["total"] == "1000.00"
    assert fila["numero"] == "0001-00000001"


# ── gráfico 2: entró vs salió — MISMA definición que la portada ─────────────────────────────────────

@necesita_pg
def test_entro_vs_salio_es_identico_a_la_serie_de_portada_con_otro_nombre(conn_de_tenant, tenants):
    a, _ = tenants
    CobroStore(conn_de_tenant(a), a).registrar_suelto(monto="500.00", medio="efectivo")
    _gasto(conn_de_tenant, a, "200.00")
    q = InteligenciaQueries(conn_de_tenant(a), a)
    portada_serie = q.portada()["serie_mensual"]
    grafico = q.entro_vs_salio()
    assert len(grafico["serie"]) == len(portada_serie) == 6
    for p, g in zip(portada_serie, grafico["serie"]):
        assert p["mes"] == g["mes"]
        assert p["ingresos"] == g["entro"]
        assert p["gastos"] == g["salio"]


@necesita_pg
def test_entro_vs_salio_detalle_distingue_origen_en_entro_y_categoria_en_salio(conn_de_tenant, tenants):
    a, _ = tenants
    comp = _comprobante(conn_de_tenant, a, "1000.00")
    CobroStore(conn_de_tenant(a), a).registrar(comp, monto="1000.00")                       # origen factura
    CobroStore(conn_de_tenant(a), a).registrar_suelto(monto="300.00", medio="efectivo")     # origen manual
    _mp_payment(conn_de_tenant, a, "150.00", status="approved")                          # mercadopago
    _gasto(conn_de_tenant, a, "400.00", categoria="mercaderia")
    q = InteligenciaQueries(conn_de_tenant(a), a)
    mes_actual = q.entro_vs_salio()["serie"][-1]["mes"]

    entro = q.entro_vs_salio_detalle(mes_actual, "entro")
    assert entro["lado"] == "entro"
    origenes = sorted(f["origen"] for f in entro["filas"])
    assert origenes == ["factura", "manual", "mercadopago"]

    salio = q.entro_vs_salio_detalle(mes_actual, "salio")
    assert salio["lado"] == "salio"
    assert salio["filas"][0]["categoria"] == "mercaderia"


@necesita_pg
def test_entro_vs_salio_detalle_lado_invalido_rechaza(conn_de_tenant, tenants):
    a, _ = tenants
    with pytest.raises(ValueError):
        InteligenciaQueries(conn_de_tenant(a), a).entro_vs_salio_detalle("2026-07", "arriba")


# ── gráfico 3: en qué se me va — torta con las 8 categorías SIEMPRE ─────────────────────────────────

@necesita_pg
def test_torta_categorias_trae_las_ocho_aunque_solo_una_tenga_gasto(conn_de_tenant, tenants):
    a, _ = tenants
    _gasto(conn_de_tenant, a, "400.00", categoria="mercaderia")
    g = InteligenciaQueries(conn_de_tenant(a), a).torta_categorias()
    assert [c["categoria"] for c in g["serie"]] == list(CATEGORIAS)
    por_cat = {c["categoria"]: c["total"] for c in g["serie"]}
    assert por_cat["mercaderia"] == "400.00"
    assert por_cat["sueldos"] == "0.00"


@necesita_pg
def test_categoria_detalle_trae_las_filas_de_esa_categoria_solamente(conn_de_tenant, tenants):
    a, _ = tenants
    _gasto(conn_de_tenant, a, "400.00", categoria="mercaderia")
    _gasto(conn_de_tenant, a, "100.00", categoria="transporte")
    mes_actual = InteligenciaQueries(conn_de_tenant(a), a).torta_categorias()["periodo"]
    det = InteligenciaQueries(conn_de_tenant(a), a).categoria_detalle(mes_actual, "mercaderia")
    assert len(det["filas"]) == 1
    assert det["filas"][0]["monto"] == "400.00"


@necesita_pg
def test_categoria_detalle_categoria_invalida_rechaza(conn_de_tenant, tenants):
    a, _ = tenants
    with pytest.raises(ValueError):
        InteligenciaQueries(conn_de_tenant(a), a).categoria_detalle(None, "inventada")


# ── aislamiento adversarial de los 3 gráficos nuevos (regla 7) ──────────────────────────────────────

@necesita_pg
def test_aislamiento_A_no_ve_los_graficos_de_B(conn_de_tenant, tenants):
    a, b = tenants
    _comprobante(conn_de_tenant, b, "999999.00")
    CobroStore(conn_de_tenant(b), b).registrar_suelto(monto="888888.00", medio="efectivo")
    _gasto(conn_de_tenant, b, "777777.00", categoria="mercaderia")
    q = InteligenciaQueries(conn_de_tenant(a), a)
    assert Decimal(q.facturacion_por_mes()["serie"][-1]["total"]) == Decimal("0.00")
    assert Decimal(q.entro_vs_salio()["serie"][-1]["entro"]) == Decimal("0.00")
    assert all(c["total"] == "0.00" for c in q.torta_categorias()["serie"])


# ── gráfico 4: cuánto me dejó cada trabajo — reusa TrabajoStore, no reinventa el cálculo ────────────

def _trabajo_completo(conn_de_tenant, cid, *, nro=800):
    """Presupuesto → factura enlazados como en producción (`factura_id` + `workflow_id`) — mismo
    helper que `test_imputacion_y_margen.py`, reusado acá para no reinventar el armado de la cadena."""
    presupuestos = PresupuestoStore(conn_de_tenant(cid), cid)
    p = presupuestos.crear(concepto="Pintura", receptor={"nombre": "Panadería Los Tilos"},
                           items=[{"descripcion": "Living", "cantidad": Decimal(1),
                                   "precio_unitario": Decimal("100000"), "codigo": ""}])
    factura_id = f"presu-{p['id']}"
    presupuestos.marcar_factura(p["id"], factura_id)
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.afip_comprobantes
                       (cliente_id, cuit, tipo_cbte, punto_venta, nro, cae, fecha_emision, total,
                        estado, receptor_nombre, workflow_id)
                       VALUES (%s,'30712345678',6,1,%s,'CAE-T',%s,'100000.00','emitida',
                               'Panadería Los Tilos', %s) RETURNING id""",
                    (cid, nro, _dia_del_negocio(), f"factura-{cid}-{factura_id}"))
        comprobante = cur.fetchone()[0]
    return p["id"], comprobante


@necesita_pg
def test_margen_por_trabajo_un_gasto_imputado_sin_cobro_va_a_sin_ingreso(conn_de_tenant, tenants):
    a, _ = tenants
    p_id, _ = _trabajo_completo(conn_de_tenant, a, nro=801)
    gasto = GastoStore(conn_de_tenant(a), a).crear(monto=Decimal("15000"), categoria="herramientas")
    TrabajoStore(conn_de_tenant(a), a).imputar(gasto["id"], "presupuesto", p_id)

    g = InteligenciaQueries(conn_de_tenant(a), a).margen_por_trabajo()
    assert g["trabajos"] == []
    assert len(g["sin_ingreso"]) == 1
    item = g["sin_ingreso"][0]
    assert item["eslabon"] == "presupuesto" and item["ref"] == p_id
    assert item["gastado"] == "15000.00"
    assert item["gastos_imputados"] == 1
    assert "Panadería Los Tilos" in item["etiqueta"]


@necesita_pg
def test_margen_por_trabajo_imputar_a_dos_eslabones_del_mismo_trabajo_no_duplica(conn_de_tenant, tenants):
    """Un gasto imputado al PRESUPUESTO y un cobro contra su FACTURA son el mismo trabajo — tiene que
    aparecer UNA sola vez, con el margen correcto (§0: no hay dos caminos al mismo número)."""
    a, _ = tenants
    p_id, comp_id = _trabajo_completo(conn_de_tenant, a, nro=802)
    gasto = GastoStore(conn_de_tenant(a), a).crear(monto=Decimal("30000"), categoria="mercaderia")
    TrabajoStore(conn_de_tenant(a), a).imputar(gasto["id"], "presupuesto", p_id)
    CobroStore(conn_de_tenant(a), a).registrar(comp_id, monto="100000.00")

    g = InteligenciaQueries(conn_de_tenant(a), a).margen_por_trabajo()
    assert len(g["trabajos"]) == 1
    assert g["sin_ingreso"] == []
    item = g["trabajos"][0]
    assert item["cobrado"] == "100000.00"
    assert item["gastado"] == "30000.00"
    assert item["margen"] == "70000.00"
    assert item["gastos_imputados"] == 1


@necesita_pg
def test_margen_trabajo_detalle_es_el_mismo_objeto_que_trabajo_store_margen(conn_de_tenant, tenants):
    a, _ = tenants
    p_id, _ = _trabajo_completo(conn_de_tenant, a, nro=803)
    gasto = GastoStore(conn_de_tenant(a), a).crear(monto=Decimal("5000"), categoria="otros")
    TrabajoStore(conn_de_tenant(a), a).imputar(gasto["id"], "presupuesto", p_id)

    directo = TrabajoStore(conn_de_tenant(a), a).margen("presupuesto", p_id)
    via_iq = InteligenciaQueries(conn_de_tenant(a), a).margen_trabajo_detalle("presupuesto", p_id)
    assert directo == via_iq


@necesita_pg
def test_margen_por_trabajo_sin_ninguna_actividad_es_vacio(conn_de_tenant, tenants):
    a, _ = tenants
    assert InteligenciaQueries(conn_de_tenant(a), a).margen_por_trabajo() == \
           {"tipo": "barras", "trabajos": [], "sin_ingreso": []}


@necesita_pg
def test_margen_por_trabajo_aislamiento_A_no_ve_los_trabajos_de_B(conn_de_tenant, tenants):
    a, b = tenants
    p_id, _ = _trabajo_completo(conn_de_tenant, b, nro=804)
    gasto = GastoStore(conn_de_tenant(b), b).crear(monto=Decimal("9999"), categoria="otros")
    TrabajoStore(conn_de_tenant(b), b).imputar(gasto["id"], "presupuesto", p_id)

    assert InteligenciaQueries(conn_de_tenant(a), a).margen_por_trabajo() == \
           {"tipo": "barras", "trabajos": [], "sin_ingreso": []}
