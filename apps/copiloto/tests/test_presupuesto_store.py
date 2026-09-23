"""Aislamiento cross-tenant de `PresupuestoStore` contra Postgres real (hallazgo 2026-08-04, M-WEB RLS).

Los únicos `test_ADVERSARIAL_*` de presupuestos (`test_presupuestos_web.py`) corren contra
`_FakePresupuestoStore`, un dict en memoria — prueban que `presupuestos_web.py` pasa bien el tenant,
no que el SQL real de `PresupuestoStore` (`WHERE cliente_id=%s`) aísla contra Postgres/RLS. Mismo
patrón que `test_actividad_store.py`/`test_cliente_store.py`: conexiones reales por tenant
(`conn_de_tenant`, RLS `FORCE`), un actor A intentando activamente el recurso de B.
"""
from __future__ import annotations

import os
import uuid

import pytest

from presupuesto_store import PresupuestoStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_presupuesto_items WHERE cliente_id = %s",
                        (cid,))
            cur.execute("DELETE FROM uc_factory.copiloto_presupuestos WHERE cliente_id = %s", (cid,))
            cur.execute("DELETE FROM uc_factory.copiloto_eventos WHERE cliente_id = %s", (cid,))
        conn.close()


def _presu_de_b(conn_de_tenant, b):
    return PresupuestoStore(conn_de_tenant(b), b).crear(
        concepto="Secreto de B", receptor={"nombre": "Cliente de B"},
        items=[{"descripcion": "Trabajo", "cantidad": 1, "precio_unitario": "999999.00"}])


@necesita_pg
def test_aislamiento_A_no_ve_el_listado_de_B(conn_de_tenant, tenants):
    a, b = tenants
    _presu_de_b(conn_de_tenant, b)
    assert PresupuestoStore(conn_de_tenant(a), a).listar() == []


@necesita_pg
def test_aislamiento_A_no_lee_el_detalle_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = _presu_de_b(conn_de_tenant, b)
    assert PresupuestoStore(conn_de_tenant(a), a).detalle(creado["id"]) is None


@necesita_pg
def test_aislamiento_A_no_puede_adjuntar_doc_al_presupuesto_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = _presu_de_b(conn_de_tenant, b)
    PresupuestoStore(conn_de_tenant(a), a).adjuntar_doc(
        creado["id"], doc_id="doc-de-a", doc_link="https://a.example/doc")
    # UPDATE con WHERE cliente_id=%s: si A lograra tocarlo, esto lo detecta leyendo como B
    assert PresupuestoStore(conn_de_tenant(b), b).detalle(creado["id"])["doc_id"] is None


@necesita_pg
def test_aislamiento_A_no_puede_marcar_factura_en_el_presupuesto_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = _presu_de_b(conn_de_tenant, b)
    tocado = PresupuestoStore(conn_de_tenant(a), a).marcar_factura(creado["id"], "factura-de-a")
    assert tocado is False
    assert PresupuestoStore(conn_de_tenant(b), b).detalle(creado["id"])["factura_id"] is None


@necesita_pg
def test_aislamiento_A_no_puede_cambiar_el_estado_del_presupuesto_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = _presu_de_b(conn_de_tenant, b)
    resultado = PresupuestoStore(conn_de_tenant(a), a).cambiar_estado(creado["id"], "aprobado")
    assert resultado is None
    assert PresupuestoStore(conn_de_tenant(b), b).detalle(creado["id"])["estado"] == "pendiente"


# --- K-01 (BL-D1/BL-J1): idempotencia del alta, contra Postgres real ---------------------------

def _crear(store, **kw):
    return store.crear_idem(concepto="Reparación", receptor={"nombre": "Los Tilos"},
                            items=[{"descripcion": "Mano de obra", "cantidad": 1,
                                    "precio_unitario": "8000.00"}], **kw)


def _cuantos(conn_de_tenant, cid):
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM uc_factory.copiloto_presupuestos WHERE cliente_id = %s",
                    (cid,))
        return cur.fetchone()[0]


@necesita_pg
def test_K01_dos_crear_con_la_misma_idem_key_dejan_UN_registro(conn_de_tenant, tenants):
    a, _ = tenants
    store = PresupuestoStore(conn_de_tenant(a), a)
    p1, rep1 = _crear(store, idem_key="clave-k01-1")
    p2, rep2 = _crear(store, idem_key="clave-k01-1")
    assert (rep1, rep2) == (False, True)
    assert p1["id"] == p2["id"] and p1["numero"] == p2["numero"]
    assert _cuantos(conn_de_tenant, a) == 1          # conteo CON claims (la conexión ya las lleva)


@necesita_pg
def test_K01_sin_idem_key_o_con_None_repetido_sigue_creando_una_fila_nueva(conn_de_tenant, tenants):
    a, _ = tenants
    store = PresupuestoStore(conn_de_tenant(a), a)
    _crear(store); _crear(store, idem_key=None); _crear(store, idem_key="   ")
    assert _cuantos(conn_de_tenant, a) == 3


@necesita_pg
def test_K01_carrera_dos_altas_concurrentes_misma_clave_dejan_UN_registro(conn_de_tenant, tenants):
    """La ventana SELECT→INSERT: sin el índice único parcial, las dos pasarían el SELECT vacío."""
    from concurrent.futures import ThreadPoolExecutor
    a, _ = tenants
    def alta(_):
        return _crear(PresupuestoStore(conn_de_tenant(a), a), idem_key="clave-carrera")
    with ThreadPoolExecutor(max_workers=2) as ex:
        resultados = list(ex.map(alta, range(2)))
    assert _cuantos(conn_de_tenant, a) == 1
    assert len({r[0]["id"] for r in resultados}) == 1
    assert sorted(r[1] for r in resultados) == [False, True]


@necesita_pg
def test_K01_la_misma_clave_en_otro_tenant_NO_colisiona_ni_devuelve_lo_ajeno(conn_de_tenant, tenants):
    """Adversarial barato: la clave es única POR tenant; B con la clave de A crea el suyo."""
    a, b = tenants
    pa, _ = _crear(PresupuestoStore(conn_de_tenant(a), a), idem_key="clave-compartida")
    pb, rep = _crear(PresupuestoStore(conn_de_tenant(b), b), idem_key="clave-compartida")
    assert rep is False and pb["id"] != pa["id"]
    assert PresupuestoStore(conn_de_tenant(b), b).detalle(pa["id"]) is None
