"""La unión de ACTIVIDAD contra Postgres real — la rama de ingresos y los filtros `funcion`/`q`.

Contra la base y no fakes, a propósito: lo que se prueba —que la unión incluya los cobros, que
`funcion` acote por tipo, que `q` filtre por `ILIKE` y ESCAPE los comodines, que el cursor pagine
DENTRO de la vista filtrada— vive en el SQL. Un fake devolvería lo que le pido sin ejecutar la query.
Es la primera cobertura pg de este store (antes sólo estaba el test web de routing).
"""
from __future__ import annotations

import os
import uuid
from decimal import Decimal

import pytest

from actividad_store import ActividadStore
from actividad_web import parsear_cursor

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
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    conn = conn_factory()
    with conn.cursor() as cur:
        for t in ("afip_comprobantes", "copiloto_presupuestos", "copiloto_gastos",
                  "copiloto_clientes", "copiloto_cobros", "copiloto_eventos"):
            cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id IN (%s, %s)", (a, b))
    conn.close()


def _gasto(cf, cid, monto, *, categoria="otros", proveedor=""):
    conn = cf()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.copiloto_gastos (cliente_id, monto, fecha, categoria, proveedor)
                       VALUES (%s, %s, CURRENT_DATE, %s, %s)""", (cid, monto, categoria, proveedor))


def _cobro(cf, cid, monto, *, origen="manual", medio="", cliente_nombre="", concepto=""):
    conn = cf()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.copiloto_cobros
                       (cliente_id, monto, medio, fecha, origen, cliente_nombre, concepto)
                       VALUES (%s, %s, %s, CURRENT_DATE, %s, %s, %s)""",
                    (cid, monto, medio, origen, cliente_nombre, concepto))


def _comprobante(cf, cid, total, *, nro, tipo_cbte=6, receptor="Cliente"):
    conn = cf()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.afip_comprobantes
                       (cliente_id, cuit, tipo_cbte, punto_venta, nro, cae, fecha_emision, total, receptor_nombre)
                       VALUES (%s, '30712345678', %s, 1, %s, 'CAE-X', CURRENT_DATE, %s, %s)""",
                    (cid, tipo_cbte, nro, total, receptor))


def _tipos(pagina):
    return {i["tipo"] for i in pagina["items"]}


# ── la rama de ingresos (la que faltaba) ──────────────────────────────────────────────────────────

@necesita_pg
def test_la_union_incluye_los_ingresos_dictados(conn_factory, tenants):
    a, _ = tenants
    _cobro(conn_factory, a, "500.00", medio="efectivo", cliente_nombre="Panadería")
    items = ActividadStore(conn_factory, a).listar()["items"]
    ing = [i for i in items if i["tipo"] == "ingreso"]
    assert len(ing) == 1
    assert ing[0]["signo"] == "entra"
    assert ing[0]["monto"] == "500.00"
    assert ing[0]["titulo"].startswith("Ingreso")


@necesita_pg
def test_el_cobro_de_factura_se_titula_distinto_del_dictado(conn_factory, tenants):
    a, _ = tenants
    _cobro(conn_factory, a, "100.00", origen="factura")
    ing = [i for i in ActividadStore(conn_factory, a).listar()["items"] if i["tipo"] == "ingreso"]
    assert ing[0]["titulo"] == "Cobro de factura"


# ── filtro funcion ────────────────────────────────────────────────────────────────────────────────

@necesita_pg
def test_funcion_gastos_solo_trae_gastos(conn_factory, tenants):
    a, _ = tenants
    _gasto(conn_factory, a, "100.00")
    _cobro(conn_factory, a, "200.00")
    _comprobante(conn_factory, a, "300.00", nro=1)
    pagina = ActividadStore(conn_factory, a).listar(funcion="gastos")
    assert _tipos(pagina) == {"gasto"}


@necesita_pg
def test_funcion_facturacion_junta_factura_y_nota_credito(conn_factory, tenants):
    a, _ = tenants
    _comprobante(conn_factory, a, "1000.00", nro=1, tipo_cbte=6)    # factura B
    _comprobante(conn_factory, a, "200.00", nro=2, tipo_cbte=13)    # nota de crédito C
    _gasto(conn_factory, a, "50.00")
    pagina = ActividadStore(conn_factory, a).listar(funcion="facturacion")
    assert _tipos(pagina) == {"factura", "nota_credito"}   # el gasto queda afuera


@necesita_pg
def test_funcion_ingresos_trae_los_cobros(conn_factory, tenants):
    a, _ = tenants
    _cobro(conn_factory, a, "800.00", medio="transferencia")
    _gasto(conn_factory, a, "50.00")
    pagina = ActividadStore(conn_factory, a).listar(funcion="ingresos")
    assert _tipos(pagina) == {"ingreso"}


# ── filtro q (búsqueda) ───────────────────────────────────────────────────────────────────────────

@necesita_pg
def test_q_filtra_por_titulo_y_detalle_case_insensitive(conn_factory, tenants):
    a, _ = tenants
    _gasto(conn_factory, a, "8500.00", proveedor="Nafta YPF")   # 'nafta' cae en detalle
    _gasto(conn_factory, a, "200.00", proveedor="Kiosco")
    items = ActividadStore(conn_factory, a).listar(q="nafta")["items"]   # minúsculas → ILIKE
    assert len(items) == 1 and "Nafta" in items[0]["detalle"]


@necesita_pg
def test_q_escapa_los_comodines_de_LIKE(conn_factory, tenants):
    """`q='%'` NO puede traer todo: el `%` se escapa como texto literal. Sin el escape, `%` sería
    "cualquier cosa" y el buscador devolvería la actividad entera ante un carácter."""
    a, _ = tenants
    _gasto(conn_factory, a, "100.00", proveedor="Uno")
    _gasto(conn_factory, a, "200.00", proveedor="Dos")
    store = ActividadStore(conn_factory, a)
    assert len(store.listar(q="")["items"]) == 2       # sin filtro, están los dos
    assert store.listar(q="%")["items"] == []          # '%' literal no matchea ninguno → escapado


# ── cursor dentro de la vista filtrada + aislamiento ──────────────────────────────────────────────

@necesita_pg
def test_el_cursor_pagina_dentro_del_filtro_sin_repetir(conn_factory, tenants):
    a, _ = tenants
    for _ in range(3):
        _gasto(conn_factory, a, "100.00")
    store = ActividadStore(conn_factory, a)
    p1 = store.listar(funcion="gastos", limit=2)
    assert len(p1["items"]) == 2 and p1["cursor"] is not None
    p2 = store.listar(funcion="gastos", limit=2, desde=parsear_cursor(p1["cursor"]))
    assert len(p2["items"]) == 1                         # el 3ro, sin repetir
    ids_p1 = {i["id"] for i in p1["items"]}
    assert p2["items"][0]["id"] not in ids_p1


@necesita_pg
def test_aislamiento_A_no_ve_la_actividad_de_B(conn_factory, tenants):
    a, b = tenants
    _gasto(conn_factory, b, "999999.00", proveedor="Secreto de B")
    _cobro(conn_factory, b, "888888.00")
    assert ActividadStore(conn_factory, a).listar()["items"] == []
    assert ActividadStore(conn_factory, a).listar(q="secreto")["items"] == []
