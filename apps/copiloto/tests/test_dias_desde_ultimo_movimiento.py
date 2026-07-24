"""`trabajo_store._dias_desde_ultimo_movimiento` — guard de tipos, sin Postgres.

🔴 Existe porque el bug YA pasó: `(CURRENT_DATE - max(fecha))` en Postgres devuelve `int`, no
`interval` — psycopg2 entrega un `int` de punta a punta. Un `.days` sobre ese valor tira
`AttributeError: 'int' object has no attribute 'days'`. Lo cazó el E2E de device contra la base
real (hito 7, `GET /mi-dia/tablero` → 500), porque los tests de `mi_dia_detector` pasan `dias` YA
calculado como fixture y nunca ejercitan este fetch. Este archivo prueba el tipo REAL, con `int`
plano — sin necesitar Postgres levantado.
"""
from __future__ import annotations

from trabajo_store import _dias_desde_ultimo_movimiento


def test_acepta_int_plano_no_timedelta():
    """El caso que rompía: `int` con `.days` tiraba AttributeError. Si esto no fuera un `int` plano
    (por ejemplo si alguien "arregla" el bug envolviendo en `timedelta` de nuevo), este test explota
    apenas se le pase algo con `.days` en vez de un `int` — cualquier tipo raro que no soporte `min()`
    entre enteros lo cazaría."""
    assert _dias_desde_ultimo_movimiento(5, 10) == 5
    assert isinstance(_dias_desde_ultimo_movimiento(5, 10), int)


def test_toma_el_MINIMO_o_sea_el_mas_reciente():
    assert _dias_desde_ultimo_movimiento(20, 3) == 3


def test_ignora_none():
    assert _dias_desde_ultimo_movimiento(None, 7) == 7
    assert _dias_desde_ultimo_movimiento(7, None) == 7


def test_todos_none_da_none():
    assert _dias_desde_ultimo_movimiento(None, None) is None


def test_cero_dias_hoy_mismo_no_se_confunde_con_ausente():
    """`0` (movimiento HOY) es un valor válido, no "sin dato" — `is not None`, no un `if d:` que lo
    tiraría por falsy."""
    assert _dias_desde_ultimo_movimiento(0, 15) == 0
