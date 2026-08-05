"""`TarjetaStore` — guards estructurales (sin DB, igual que `test_presupuesto_derivados.py`) más la
validación de estado que no necesita conexión, más el aislamiento cross-tenant contra Postgres real
(M-WEB RLS, hallazgo 2026-08-04,
`pedido_planificacion-a-backend_MWEB-RLS-adversarial-concepto-perfil-negocio-midia.md`).

Los tests de arriba ya cubrían la lógica del módulo; lo que faltaba era el mismo patrón de
`test_cliente_store.py`/`test_concepto_store.py`: conexiones reales por tenant (`conn_de_tenant`,
RLS `FORCE`), actor A intentando activamente el recurso de B — ver el bloque al final del archivo."""
from __future__ import annotations

import inspect
import os
import uuid

import pytest

import mi_dia_tarjeta_store as store

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


def test_mover_valida_estado_ANTES_de_tocar_la_db():
    """`EstadoInvalido` se dispara en el primer `if`, antes de abrir conexión — un `conn_factory=None`
    no debería ni importar acá."""
    s = store.TarjetaStore(conn_factory=None, cliente_id="cid-A")
    with pytest.raises(store.EstadoInvalido):
        s.mover(1, "archivada_a_mano")


def test_crear_si_no_existe_usa_on_conflict_parcial_where_regla_not_null():
    """Sin el `WHERE regla IS NOT NULL` en el `ON CONFLICT`, Postgres pide el predicado EXACTO del
    índice parcial (`mi_dia_migrations.sql`) o rechaza la sentencia — este test cazaría el drift si
    alguien edita uno de los dos lados sin el otro."""
    fuente = inspect.getsource(store.TarjetaStore.crear_si_no_existe)
    assert "ON CONFLICT" in fuente
    assert "WHERE regla IS NOT NULL" in fuente
    assert "DO NOTHING" in fuente


def test_cerrar_resueltas_solo_toca_para_hoy_y_haciendo():
    """Una tarjeta ya `hecha` no se puede re-cerrar ni reabrir por reconciliación — sólo por acción
    explícita (`mover`)."""
    fuente = inspect.getsource(store.TarjetaStore.cerrar_resueltas)
    assert "estado IN (%s, %s)" in fuente


def test_estados_orden_y_valores_no_cambian_sin_querer():
    assert store.ESTADOS == (store.PARA_HOY, store.HACIENDO, store.HECHA)
    assert store.ESTADOS == ("para_hoy", "haciendo", "hecha")


def test_caducidad_default_es_21_dias(monkeypatch):
    monkeypatch.delenv("COPILOTO_MI_DIA_CADUCIDAD_DIAS", raising=False)
    import importlib
    reloaded = importlib.reload(store)
    assert reloaded.DIAS_CADUCIDAD_TARJETA == 21
    monkeypatch.setattr(reloaded, "DIAS_CADUCIDAD_TARJETA", 21)  # deja el módulo como estaba


# ── aislamiento cross-tenant (Postgres real) ────────────────────────────────────────────────────

@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_mi_dia_tarjetas WHERE cliente_id = %s", (cid,))
        conn.close()


@necesita_pg
def test_aislamiento_A_no_ve_el_tablero_de_B(conn_de_tenant, tenants):
    a, b = tenants
    store.TarjetaStore(conn_de_tenant(b), b).crear_manual(texto="Secreto de B")
    tablero_a = store.TarjetaStore(conn_de_tenant(a), a).listar_tablero()
    assert tablero_a == {store.PARA_HOY: [], store.HACIENDO: [], store.HECHA: []}


@necesita_pg
def test_aislamiento_A_no_puede_mover_la_tarjeta_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creada = store.TarjetaStore(conn_de_tenant(b), b).crear_manual(texto="Secreto de B")
    resultado = store.TarjetaStore(conn_de_tenant(a), a).mover(int(creada["id"]), store.HECHA)
    assert resultado is None
    tablero_b = store.TarjetaStore(conn_de_tenant(b), b).listar_tablero()
    assert tablero_b[store.PARA_HOY][0]["id"] == creada["id"]  # sigue donde nació, no se movió


@necesita_pg
def test_aislamiento_A_no_puede_borrar_la_tarjeta_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creada = store.TarjetaStore(conn_de_tenant(b), b).crear_manual(texto="Secreto de B")
    borrada = store.TarjetaStore(conn_de_tenant(a), a).borrar(int(creada["id"]))
    assert borrada is False
    tablero_b = store.TarjetaStore(conn_de_tenant(b), b).listar_tablero()
    assert tablero_b[store.PARA_HOY][0]["id"] == creada["id"]
