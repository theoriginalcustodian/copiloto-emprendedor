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
from soporte_store import SOPORTE_TECNICO, TicketStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            for t in ("afip_comprobantes", "copiloto_presupuestos", "copiloto_gastos",
                      "copiloto_clientes", "copiloto_cobros", "copiloto_eventos",
                      "copiloto_mensajes", "copiloto_tickets", "copiloto_ticket_secuencia"):
                cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id = %s", (cid,))
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
def test_la_union_incluye_los_ingresos_dictados(conn_de_tenant, tenants):
    a, _ = tenants
    cf = conn_de_tenant(a)
    _cobro(cf, a, "500.00", medio="efectivo", cliente_nombre="Panadería")
    items = ActividadStore(cf, a).listar()["items"]
    ing = [i for i in items if i["tipo"] == "ingreso"]
    assert len(ing) == 1
    assert ing[0]["signo"] == "entra"
    assert ing[0]["monto"] == "500.00"
    assert ing[0]["titulo"].startswith("Ingreso")


@necesita_pg
def test_el_cobro_de_factura_se_titula_distinto_del_dictado(conn_de_tenant, tenants):
    a, _ = tenants
    cf = conn_de_tenant(a)
    _cobro(cf, a, "100.00", origen="factura")
    ing = [i for i in ActividadStore(cf, a).listar()["items"] if i["tipo"] == "ingreso"]
    assert ing[0]["titulo"] == "Cobro de factura"


# ── filtro funcion ────────────────────────────────────────────────────────────────────────────────

@necesita_pg
def test_funcion_gastos_solo_trae_gastos(conn_de_tenant, tenants):
    a, _ = tenants
    cf = conn_de_tenant(a)
    _gasto(cf, a, "100.00")
    _cobro(cf, a, "200.00")
    _comprobante(cf, a, "300.00", nro=1)
    pagina = ActividadStore(cf, a).listar(funcion="gastos")
    assert _tipos(pagina) == {"gasto"}


@necesita_pg
def test_funcion_facturacion_junta_factura_y_nota_credito(conn_de_tenant, tenants):
    a, _ = tenants
    cf = conn_de_tenant(a)
    _comprobante(cf, a, "1000.00", nro=1, tipo_cbte=6)    # factura B
    _comprobante(cf, a, "200.00", nro=2, tipo_cbte=13)    # nota de crédito C
    _gasto(cf, a, "50.00")
    pagina = ActividadStore(cf, a).listar(funcion="facturacion")
    assert _tipos(pagina) == {"factura", "nota_credito"}   # el gasto queda afuera


@necesita_pg
def test_funcion_ingresos_trae_los_cobros(conn_de_tenant, tenants):
    a, _ = tenants
    cf = conn_de_tenant(a)
    _cobro(cf, a, "800.00", medio="transferencia")
    _gasto(cf, a, "50.00")
    pagina = ActividadStore(cf, a).listar(funcion="ingresos")
    assert _tipos(pagina) == {"ingreso"}


# ── filtro q (búsqueda) ───────────────────────────────────────────────────────────────────────────

@necesita_pg
def test_q_filtra_por_titulo_y_detalle_case_insensitive(conn_de_tenant, tenants):
    a, _ = tenants
    cf = conn_de_tenant(a)
    _gasto(cf, a, "8500.00", proveedor="Nafta YPF")   # 'nafta' cae en detalle
    _gasto(cf, a, "200.00", proveedor="Kiosco")
    items = ActividadStore(cf, a).listar(q="nafta")["items"]   # minúsculas → ILIKE
    assert len(items) == 1 and "Nafta" in items[0]["detalle"]


@necesita_pg
def test_q_escapa_los_comodines_de_LIKE(conn_de_tenant, tenants):
    """`q='%'` NO puede traer todo: el `%` se escapa como texto literal. Sin el escape, `%` sería
    "cualquier cosa" y el buscador devolvería la actividad entera ante un carácter."""
    a, _ = tenants
    cf = conn_de_tenant(a)
    _gasto(cf, a, "100.00", proveedor="Uno")
    _gasto(cf, a, "200.00", proveedor="Dos")
    store = ActividadStore(cf, a)
    assert len(store.listar(q="")["items"]) == 2       # sin filtro, están los dos
    assert store.listar(q="%")["items"] == []          # '%' literal no matchea ninguno → escapado


# ── cursor dentro de la vista filtrada + aislamiento ──────────────────────────────────────────────

@necesita_pg
def test_el_cursor_pagina_dentro_del_filtro_sin_repetir(conn_de_tenant, tenants):
    a, _ = tenants
    cf = conn_de_tenant(a)
    for _ in range(3):
        _gasto(cf, a, "100.00")
    store = ActividadStore(cf, a)
    p1 = store.listar(funcion="gastos", limit=2)
    assert len(p1["items"]) == 2 and p1["cursor"] is not None
    p2 = store.listar(funcion="gastos", limit=2, desde=parsear_cursor(p1["cursor"]))
    assert len(p2["items"]) == 1                         # el 3ro, sin repetir
    ids_p1 = {i["id"] for i in p1["items"]}
    assert p2["items"][0]["id"] not in ids_p1


@necesita_pg
def test_aislamiento_A_no_ve_la_actividad_de_B(conn_de_tenant, tenants):
    a, b = tenants
    cf_b = conn_de_tenant(b)
    _gasto(cf_b, b, "999999.00", proveedor="Secreto de B")
    _cobro(cf_b, b, "888888.00")
    cf_a = conn_de_tenant(a)
    assert ActividadStore(cf_a, a).listar()["items"] == []
    assert ActividadStore(cf_a, a).listar(q="secreto")["items"] == []


# ── SOP6/S6-8 -- la respuesta del operador entra al feed, reusando copiloto_mensajes tal cual ──────

@necesita_pg
def test_S6_8_la_respuesta_del_operador_aparece_como_ticket_respuesta_en_el_feed(conn_de_tenant, tenants):
    a, _ = tenants
    cf = conn_de_tenant(a)
    store = TicketStore(cf, a)
    creado = store.crear_ticket(canal=SOPORTE_TECNICO, asunto="no puedo facturar", primer_mensaje="x")
    mensaje_id = store.agregar_mensaje(ticket_id=creado["id"], autor="operador", texto="ya lo vemos")

    items = ActividadStore(cf, a).listar()["items"]
    respuestas = [i for i in items if i["tipo"] == "ticket_respuesta"]
    assert len(respuestas) == 1
    assert respuestas[0]["id"] == f"ticket_respuesta:{creado['id']}:{mensaje_id}"
    assert respuestas[0]["titulo"] == f"Respuesta a tu ticket {creado['codigo']}"


@necesita_pg
def test_S6_8_el_mensaje_del_USUARIO_no_aparece_en_el_feed_solo_el_del_operador(conn_de_tenant, tenants):
    """El primer mensaje de `crear_ticket` es `autor='usuario'` -- si apareciera en el feed, el
    usuario vería notificado su propio mensaje como si alguien le hubiera respondido."""
    a, _ = tenants
    cf = conn_de_tenant(a)
    TicketStore(cf, a).crear_ticket(canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="mi propio mensaje")
    items = ActividadStore(cf, a).listar()["items"]
    assert [i for i in items if i["tipo"] == "ticket_respuesta"] == []


@necesita_pg
def test_S6_8_sin_funcion_propia_aparece_igual_en_el_feed_general(conn_de_tenant, tenants):
    """`ticket_respuesta` no pertenece a ninguna `_FUNCION_TIPOS` (mismo criterio que `cliente`: no
    es una función de negocio filtrable) -- pero el feed SIN filtro lo trae igual, junto al resto."""
    a, _ = tenants
    cf = conn_de_tenant(a)
    store = TicketStore(cf, a)
    creado = store.crear_ticket(canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="y")
    store.agregar_mensaje(ticket_id=creado["id"], autor="operador", texto="respuesta")
    _gasto(cf, a, "100.00")

    from actividad_store import _FUNCION_TIPOS
    assert "ticket_respuesta" not in {t for tipos in _FUNCION_TIPOS.values() for t in tipos}
    todos = ActividadStore(cf, a).listar()["items"]
    assert {i["tipo"] for i in todos} == {"ticket_respuesta", "gasto"}
