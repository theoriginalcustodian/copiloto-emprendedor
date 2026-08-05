"""`ConceptoStore` contra Postgres real — happy path + aislamiento cross-tenant (M-WEB RLS,
hallazgo 2026-08-04, `pedido_planificacion-a-backend_MWEB-RLS-adversarial-concepto-perfil-negocio-midia.md`).

Cero archivos de test existían para este store (`concepto_store.py`) antes de este archivo — no sólo
faltaba el adversarial. Mismo patrón que `test_cliente_store.py`/`test_presupuesto_store.py`:
conexiones reales por tenant (`conn_de_tenant`, RLS `FORCE`), actor A intentando activamente el
recurso de B.
"""
from __future__ import annotations

import os
import uuid

import pytest

from concepto_store import ConceptoDuplicado, ConceptoInvalido, ConceptoStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_conceptos WHERE cliente_id = %s", (cid,))
            cur.execute("DELETE FROM uc_factory.copiloto_eventos WHERE cliente_id = %s", (cid,))
        conn.close()


# ── happy path ────────────────────────────────────────────────────────────────────────────────────

@necesita_pg
def test_crear_y_obtener(conn_de_tenant, tenants):
    a, _ = tenants
    store = ConceptoStore(conn_de_tenant(a), a)
    creado = store.crear(nombre="Pintura de living", precio_referencia="15000.50")
    assert creado["nombre"] == "Pintura de living"
    assert creado["precio_referencia"] == "15000.50"
    assert creado["activo"] is True
    assert store.obtener(creado["id"]) == creado


@necesita_pg
def test_crear_sin_precio_queda_null(conn_de_tenant, tenants):
    a, _ = tenants
    creado = ConceptoStore(conn_de_tenant(a), a).crear(nombre="Instalación eléctrica")
    assert creado["precio_referencia"] is None


@necesita_pg
def test_crear_nombre_vacio_es_invalido(conn_de_tenant, tenants):
    a, _ = tenants
    with pytest.raises(ConceptoInvalido):
        ConceptoStore(conn_de_tenant(a), a).crear(nombre="   ")


@necesita_pg
def test_crear_precio_negativo_es_invalido(conn_de_tenant, tenants):
    a, _ = tenants
    with pytest.raises(ConceptoInvalido):
        ConceptoStore(conn_de_tenant(a), a).crear(nombre="Servicio", precio_referencia="-100")


@necesita_pg
def test_crear_duplicado_trae_el_existente(conn_de_tenant, tenants):
    a, _ = tenants
    store = ConceptoStore(conn_de_tenant(a), a)
    original = store.crear(nombre="Pintura de living")
    with pytest.raises(ConceptoDuplicado) as exc:
        store.crear(nombre="pintura  de  living")  # mismo normalizado, otra grafía
    assert exc.value.existente["id"] == original["id"]


@necesita_pg
def test_listar_excluye_inactivos_por_default(conn_de_tenant, tenants):
    a, _ = tenants
    store = ConceptoStore(conn_de_tenant(a), a)
    activo = store.crear(nombre="Activo")
    inactivo = store.crear(nombre="Inactivo")
    store.desactivar(inactivo["id"])
    listado = store.listar()
    assert [c["id"] for c in listado] == [activo["id"]]
    listado_todos = store.listar(incluir_inactivos=True)
    assert {c["id"] for c in listado_todos} == {activo["id"], inactivo["id"]}


@necesita_pg
def test_editar_es_parcial_no_pisa_el_precio_al_tocar_el_nombre(conn_de_tenant, tenants):
    a, _ = tenants
    store = ConceptoStore(conn_de_tenant(a), a)
    creado = store.crear(nombre="Pintura", precio_referencia="1000.00")
    editado = store.editar(creado["id"], {"nombre": "Pintura de exteriores"})
    assert editado["nombre"] == "Pintura de exteriores"
    assert editado["precio_referencia"] == "1000.00"


@necesita_pg
def test_desactivar_marca_activo_false(conn_de_tenant, tenants):
    a, _ = tenants
    store = ConceptoStore(conn_de_tenant(a), a)
    creado = store.crear(nombre="Concepto a apagar")
    apagado = store.desactivar(creado["id"])
    assert apagado["activo"] is False


# ── aislamiento cross-tenant ─────────────────────────────────────────────────────────────────────

@necesita_pg
def test_aislamiento_A_no_ve_el_listado_de_B(conn_de_tenant, tenants):
    a, b = tenants
    ConceptoStore(conn_de_tenant(b), b).crear(nombre="Secreto de B")
    assert ConceptoStore(conn_de_tenant(a), a).listar() == []
    assert ConceptoStore(conn_de_tenant(a), a).listar(incluir_inactivos=True) == []


@necesita_pg
def test_aislamiento_A_no_lee_el_detalle_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = ConceptoStore(conn_de_tenant(b), b).crear(nombre="Secreto de B")
    assert ConceptoStore(conn_de_tenant(a), a).obtener(creado["id"]) is None


@necesita_pg
def test_aislamiento_A_no_puede_editar_el_concepto_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = ConceptoStore(conn_de_tenant(b), b).crear(nombre="Secreto de B", precio_referencia="1.00")
    resultado = ConceptoStore(conn_de_tenant(a), a).editar(creado["id"], {"nombre": "Pisado por A"})
    assert resultado is None
    assert ConceptoStore(conn_de_tenant(b), b).obtener(creado["id"])["nombre"] == "Secreto de B"


@necesita_pg
def test_aislamiento_A_no_puede_desactivar_el_concepto_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = ConceptoStore(conn_de_tenant(b), b).crear(nombre="Secreto de B")
    resultado = ConceptoStore(conn_de_tenant(a), a).desactivar(creado["id"])
    assert resultado is None
    assert ConceptoStore(conn_de_tenant(b), b).obtener(creado["id"])["activo"] is True
