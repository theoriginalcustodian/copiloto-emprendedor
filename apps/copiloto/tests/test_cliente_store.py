"""Aislamiento cross-tenant de `ClienteStore` contra Postgres real (hallazgo 2026-08-04, M-WEB RLS).

`cliente_store.py` declara en su propio docstring "hay un test adversarial que lo ejercita" — no
lo había: los únicos `test_ADVERSARIAL_*` (`test_clientes_web.py`) corren contra `_FakeClienteStore`,
un dict en memoria que reimplementa su propio filtro por `cliente_id` en Python. Prueban que
`clientes_web.py` pasa bien el tenant al store que le dan, no que el SQL real de `ClienteStore`
(`WHERE cliente_id = %s`) aísla contra Postgres/RLS. Este archivo cierra ese gap con el mismo patrón
que `test_actividad_store.py`/`test_inteligencia_queries.py`: conexiones reales por tenant
(`conn_de_tenant`, RLS `FORCE`), un actor A intentando activamente el recurso de B.
"""
from __future__ import annotations

import datetime
import os
import uuid

import pytest

from afip_comprobante_store import ESTADO_ANULADA, ESTADO_EMITIDA, AfipComprobanteStore
from cliente_store import DOC_CONSUMIDOR_FINAL, DOC_DNI, ClienteStore
from gasto_store import hoy_del_negocio

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_clientes WHERE cliente_id = %s", (cid,))
        conn.close()


@necesita_pg
def test_aislamiento_A_no_ve_el_listado_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = ClienteStore(conn_de_tenant(b), b).crear(nombre="Secreto de B")
    items, total = ClienteStore(conn_de_tenant(a), a).listar()
    assert items == [] and total == 0
    items, total = ClienteStore(conn_de_tenant(a), a).listar(q="secreto")
    assert items == [] and total == 0
    # control: B sigue viendo lo suyo (si el fixture de creación fallara en silencio, todo daría vacío)
    assert ClienteStore(conn_de_tenant(b), b).detalle(creado["id"])["nombre"] == "Secreto de B"


@necesita_pg
def test_aislamiento_A_no_lee_el_detalle_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = ClienteStore(conn_de_tenant(b), b).crear(nombre="Secreto de B")
    assert ClienteStore(conn_de_tenant(a), a).detalle(creado["id"]) is None


@necesita_pg
def test_aislamiento_A_no_puede_editar_el_cliente_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = ClienteStore(conn_de_tenant(b), b).crear(nombre="Secreto de B")
    resultado = ClienteStore(conn_de_tenant(a), a).editar(creado["id"], {"nombre": "Pisado por A"})
    assert resultado is None
    # el dato de B queda intacto — un edit "silencioso" que sí escribiera sería peor que un 404
    assert ClienteStore(conn_de_tenant(b), b).detalle(creado["id"])["nombre"] == "Secreto de B"


@necesita_pg
def test_aislamiento_A_no_ve_el_resumen_de_operaciones_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = ClienteStore(conn_de_tenant(b), b).crear(nombre="Secreto de B")
    assert ClienteStore(conn_de_tenant(a), a).resumen_operaciones(creado["id"]) is None


def _derivado(conn_de_tenant, cid, nombre, *, dias_atras=0):
    """Alta `derivado` con `created_at` puesto a mano (el mes corriente se recorta por esa columna)."""
    c = ClienteStore(conn_de_tenant(cid), cid).crear(nombre=nombre, origen="derivado")
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("UPDATE uc_factory.copiloto_clientes SET created_at = now() - make_interval(days => %s) "
                    "WHERE cliente_id = %s AND id = %s", (dias_atras, cid, c["id"]))
    conn.close()


@necesita_pg
def test_K04_agregados_este_mes_supera_una_pagina_y_coincide_con_un_count_con_claims(conn_de_tenant, tenants):
    a, _ = tenants
    for i in range(5):
        _derivado(conn_de_tenant, a, f"Solo {i}")
    _derivado(conn_de_tenant, a, "De hace dos meses", dias_atras=hoy_del_negocio().day + 40)
    ClienteStore(conn_de_tenant(a), a).crear(nombre="Manual del mes")  # origen manual: no cuenta
    store = ClienteStore(conn_de_tenant(a), a)
    items, total = store.listar(limit=2)
    assert len(items) == 2 and total == 7                      # más resultados que la página
    conn = conn_de_tenant(a)()                                 # conteo CON claims del tenant
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM uc_factory.copiloto_clientes WHERE cliente_id = %s "
                    "AND origen = 'derivado' AND created_at >= date_trunc('month', now() AT TIME ZONE "
                    "'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires'", (a,))
        esperado = cur.fetchone()[0]
    conn.close()
    assert store.agregados_este_mes() == esperado == 5


@necesita_pg
def test_K04_aislamiento_A_no_cuenta_los_derivados_de_B(conn_de_tenant, tenants):
    a, b = tenants
    _derivado(conn_de_tenant, b, "Derivado de B")
    _derivado(conn_de_tenant, b, "Otro de B")
    _derivado(conn_de_tenant, a, "Derivado de A")
    assert ClienteStore(conn_de_tenant(a), a).agregados_este_mes() == 1
    assert ClienteStore(conn_de_tenant(b), b).agregados_este_mes() == 2  # control: B ve los suyos


# --- BL-V18: conteo de comprobantes por cliente en el listado -----------------------------------

def _comprobante(conn_de_tenant, cid, nro, doc_tipo, doc_nro, estado=ESTADO_EMITIDA):
    AfipComprobanteStore(conn_de_tenant(cid), cid).registrar(
        cuit="30711111111", tipo_cbte=11, punto_venta=1, nro=nro, cae=f"CAE{nro}", cae_vto=None,
        fecha_emision=hoy_del_negocio(), doc_tipo=doc_tipo, doc_nro=doc_nro, total=100, estado=estado)


def _conteo(store, cliente_id: int) -> int:
    fila = {i["id"]: i for i in store.listar()[0]}[cliente_id]
    return fila["comprobantes_cantidad"]


@pytest.fixture
def comprobantes_limpios(conn_de_tenant, tenants):
    yield tenants
    for cid in tenants:
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.afip_comprobantes WHERE cliente_id = %s", (cid,))
        conn.close()


@necesita_pg
def test_BL_V18_listar_cuenta_los_comprobantes_del_documento_sin_anuladas(conn_de_tenant, comprobantes_limpios):
    a, _ = comprobantes_limpios
    store = ClienteStore(conn_de_tenant(a), a)
    cliente = store.crear(nombre="Con DNI", doc_tipo=DOC_DNI, doc_nro="30123456")
    _comprobante(conn_de_tenant, a, 1, DOC_DNI, "30123456")
    _comprobante(conn_de_tenant, a, 2, DOC_DNI, "30123456")
    _comprobante(conn_de_tenant, a, 3, DOC_DNI, "30123456", estado=ESTADO_ANULADA)   # no cuenta
    _comprobante(conn_de_tenant, a, 4, DOC_DNI, "99999999")                          # otro documento
    assert _conteo(store, cliente["id"]) == 2


@necesita_pg
def test_ADVERSARIAL_BL_V18_A_no_cuenta_los_comprobantes_de_B_con_el_mismo_documento(
        conn_de_tenant, comprobantes_limpios):
    a, b = comprobantes_limpios
    cli_a = ClienteStore(conn_de_tenant(a), a).crear(nombre="Cliente de A", doc_tipo=DOC_DNI, doc_nro="30123456")
    cli_b = ClienteStore(conn_de_tenant(b), b).crear(nombre="Cliente de B", doc_tipo=DOC_DNI, doc_nro="30123456")
    _comprobante(conn_de_tenant, a, 1, DOC_DNI, "30123456")
    _comprobante(conn_de_tenant, b, 1, DOC_DNI, "30123456")
    _comprobante(conn_de_tenant, b, 2, DOC_DNI, "30123456")
    assert _conteo(ClienteStore(conn_de_tenant(a), a), cli_a["id"]) == 1     # sólo el suyo
    assert _conteo(ClienteStore(conn_de_tenant(b), b), cli_b["id"]) == 2     # control: B ve los suyos


@necesita_pg
def test_BL_V18_cliente_sin_documento_cuenta_cero(conn_de_tenant, comprobantes_limpios):
    a, _ = comprobantes_limpios
    store = ClienteStore(conn_de_tenant(a), a)
    cliente = store.crear(nombre="Sin documento")
    # Un comprobante de consumidor final sin identificar NO es de este cliente: `doc_nro` vacío no matchea.
    _comprobante(conn_de_tenant, a, 1, DOC_CONSUMIDOR_FINAL, "")
    assert _conteo(store, cliente["id"]) == 0
