"""`TarjetaStore` — guards estructurales (sin DB, igual que `test_presupuesto_derivados.py`) más la
validación de estado que no necesita conexión."""
from __future__ import annotations

import inspect

import pytest

import mi_dia_tarjeta_store as store


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
