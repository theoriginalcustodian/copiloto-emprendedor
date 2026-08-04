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

import os
import uuid

import pytest

from cliente_store import ClienteStore

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
