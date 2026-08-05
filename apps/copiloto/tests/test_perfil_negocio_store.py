"""`PerfilNegocioStore` contra Postgres real — happy path + aislamiento cross-tenant (M-WEB RLS,
hallazgo 2026-08-04, `pedido_planificacion-a-backend_MWEB-RLS-adversarial-concepto-perfil-negocio-midia.md`).

Cero archivos de test existían para este store (`perfil_negocio_store.py`) antes de este archivo.
Mismo patrón que `test_cliente_store.py`/`test_concepto_store.py`: conexiones reales por tenant
(`conn_de_tenant`, RLS `FORCE`), actor A intentando activamente el recurso de B.
"""
from __future__ import annotations

import os
import uuid

import pytest

from perfil_negocio_store import CONFIRMACION, AUTOMATICO, PerfilNegocioStore, modo_de

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_perfil_negocio WHERE cliente_id = %s", (cid,))
        conn.close()


# ── happy path ────────────────────────────────────────────────────────────────────────────────────

@necesita_pg
def test_get_de_tenant_sin_perfil_es_none(conn_de_tenant, tenants):
    a, _ = tenants
    assert PerfilNegocioStore(conn_de_tenant(a), a).get() is None


@necesita_pg
def test_upsert_crea_con_defaults_del_resto(conn_de_tenant, tenants):
    a, _ = tenants
    store = PerfilNegocioStore(conn_de_tenant(a), a)
    perfil = store.upsert({"nombre_comercial": "Pinturas Lin"})
    assert perfil["nombre_comercial"] == "Pinturas Lin"
    assert perfil["a_quien"] == "ambos"  # default
    assert perfil["modo_ceremonia"] == CONFIRMACION  # default, aun para tenant nuevo


@necesita_pg
def test_upsert_parcial_no_pisa_lo_ya_guardado(conn_de_tenant, tenants):
    a, _ = tenants
    store = PerfilNegocioStore(conn_de_tenant(a), a)
    store.upsert({"nombre_comercial": "Pinturas Lin", "formalidad": "formal"})
    editado = store.upsert({"horario_atencion": "9 a 18"})
    assert editado["nombre_comercial"] == "Pinturas Lin"
    assert editado["formalidad"] == "formal"
    assert editado["horario_atencion"] == "9 a 18"


@necesita_pg
def test_modo_de_fail_closed_ante_perfil_none(conn_de_tenant, tenants):
    a, _ = tenants
    assert modo_de(PerfilNegocioStore(conn_de_tenant(a), a).get()) == CONFIRMACION


@necesita_pg
def test_modo_de_automatico_cuando_se_configura(conn_de_tenant, tenants):
    a, _ = tenants
    store = PerfilNegocioStore(conn_de_tenant(a), a)
    perfil = store.upsert({"modo_ceremonia": AUTOMATICO})
    assert modo_de(perfil) == AUTOMATICO


# ── aislamiento cross-tenant ─────────────────────────────────────────────────────────────────────

@necesita_pg
def test_aislamiento_A_no_ve_el_perfil_de_B(conn_de_tenant, tenants):
    a, b = tenants
    PerfilNegocioStore(conn_de_tenant(b), b).upsert({"nombre_comercial": "Secreto de B"})
    assert PerfilNegocioStore(conn_de_tenant(a), a).get() is None
    # control: B sigue viendo lo suyo
    assert PerfilNegocioStore(conn_de_tenant(b), b).get()["nombre_comercial"] == "Secreto de B"


@necesita_pg
def test_aislamiento_upsert_de_A_no_toca_el_perfil_de_B(conn_de_tenant, tenants):
    a, b = tenants
    PerfilNegocioStore(conn_de_tenant(b), b).upsert({"nombre_comercial": "Secreto de B"})
    PerfilNegocioStore(conn_de_tenant(a), a).upsert({"nombre_comercial": "Pisado por A"})
    assert PerfilNegocioStore(conn_de_tenant(b), b).get()["nombre_comercial"] == "Secreto de B"
