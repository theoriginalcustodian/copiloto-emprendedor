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
