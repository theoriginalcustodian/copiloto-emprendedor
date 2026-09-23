"""Idempotencia del alta de `GastoStore` contra Postgres real (contrato IDEM-gasto-duplica-plata).

Mismo patrón que la sección K-01 de `test_presupuesto_store.py`: un segundo "Guardar" sobre la
misma card (doble toque, reintento de red) no puede abrir un segundo registro financiero. El control
positivo es el propio test de dos claves DISTINTAS: si ese diera una sola fila, la deduplicación
estaría sobre-aplicando y el hallazgo sería el inverso (se pierden gastos reales).
"""
from __future__ import annotations

import os
import uuid
from decimal import Decimal

import pytest

from gasto_store import GastoStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_gastos WHERE cliente_id = %s", (cid,))
            cur.execute("DELETE FROM uc_factory.copiloto_eventos WHERE cliente_id = %s", (cid,))
        conn.close()


def _crear(store, **kw):
    return store.crear_idem(monto=Decimal("1500.00"), categoria="transporte",
                            descripcion="Nafta", **kw)


def _cuantos(conn_de_tenant, cid):
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM uc_factory.copiloto_gastos WHERE cliente_id = %s", (cid,))
        return cur.fetchone()[0]


@necesita_pg
def test_dos_crear_con_la_misma_idem_key_dejan_UN_registro(conn_de_tenant, tenants):
    a, _ = tenants
    store = GastoStore(conn_de_tenant(a), a)
    g1, rep1 = _crear(store, idem_key="clave-idem-1")
    g2, rep2 = _crear(store, idem_key="clave-idem-1")
    assert (rep1, rep2) == (False, True)
    assert g1["id"] == g2["id"]
    assert _cuantos(conn_de_tenant, a) == 1


@necesita_pg
def test_dos_claves_distintas_dejan_DOS_registros(conn_de_tenant, tenants):
    """Control positivo: si esto diera una sola fila, la deduplicación está sobre-aplicando."""
    a, _ = tenants
    store = GastoStore(conn_de_tenant(a), a)
    g1, rep1 = _crear(store, idem_key="clave-idem-a")
    g2, rep2 = _crear(store, idem_key="clave-idem-b")
    assert (rep1, rep2) == (False, False)
    assert g1["id"] != g2["id"]
    assert _cuantos(conn_de_tenant, a) == 2


@necesita_pg
def test_sin_idem_key_o_con_None_o_blanco_sigue_creando_una_fila_nueva(conn_de_tenant, tenants):
    a, _ = tenants
    store = GastoStore(conn_de_tenant(a), a)
    _crear(store); _crear(store, idem_key=None); _crear(store, idem_key="   ")
    assert _cuantos(conn_de_tenant, a) == 3


@necesita_pg
def test_carrera_dos_altas_concurrentes_misma_clave_dejan_UN_registro(conn_de_tenant, tenants):
    """La ventana SELECT→INSERT: sin el índice único parcial, las dos pasarían el SELECT vacío."""
    from concurrent.futures import ThreadPoolExecutor
    a, _ = tenants
    def alta(_):
        return _crear(GastoStore(conn_de_tenant(a), a), idem_key="clave-carrera")
    with ThreadPoolExecutor(max_workers=2) as ex:
        resultados = list(ex.map(alta, range(2)))
    assert _cuantos(conn_de_tenant, a) == 1
    assert len({r[0]["id"] for r in resultados}) == 1
    assert sorted(r[1] for r in resultados) == [False, True]


@necesita_pg
def test_la_misma_clave_en_otro_tenant_NO_colisiona_ni_devuelve_lo_ajeno(conn_de_tenant, tenants):
    """Adversarial barato: la clave es única POR tenant; B con la clave de A crea el suyo."""
    a, b = tenants
    ga, _ = _crear(GastoStore(conn_de_tenant(a), a), idem_key="clave-compartida")
    gb, rep = _crear(GastoStore(conn_de_tenant(b), b), idem_key="clave-compartida")
    assert rep is False and gb["id"] != ga["id"]
    assert GastoStore(conn_de_tenant(b), b).detalle(ga["id"]) is None
