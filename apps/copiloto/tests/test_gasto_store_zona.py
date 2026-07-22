"""La zona horaria del negocio, probada con el instante INYECTADO.

Existe por una observación de FRONTEND: su sonda contra el vivo ejercitó este arreglo **por
casualidad** —corrió a las 01:41 UTC, o sea 22:41 en Argentina, justo dentro de la ventana de 3 horas
donde UTC y Argentina discrepan sobre qué día es—. La misma sonda al mediodía habría pasado sin probar
nada.

Un test que sólo detecta el bug si corre entre las 21:00 y las 23:59 de Argentina es verde por
casualidad las otras 21 horas del día. Acá el instante se inyecta, así que el poder de detección no
depende de cuándo corra el CI.
"""
from __future__ import annotations

import datetime

import pytest

from gasto_store import ZONA_DEL_NEGOCIO, hoy_del_negocio

UTC = datetime.timezone.utc


@pytest.mark.parametrize("instante_utc, dia_esperado, por_que", [
    # El caso que importa: en UTC ya es el día 22; en Argentina todavía es el 21.
    (datetime.datetime(2026, 7, 22, 1, 41, tzinfo=UTC), datetime.date(2026, 7, 21),
     "22:41 en Argentina — la ventana donde las dos definiciones de 'hoy' difieren"),
    # El borde exacto: 03:00 UTC = 00:00 de Argentina. El día cambia acá, no a medianoche UTC.
    (datetime.datetime(2026, 7, 22, 3, 0, tzinfo=UTC), datetime.date(2026, 7, 22),
     "medianoche de Argentina"),
    (datetime.datetime(2026, 7, 22, 2, 59, tzinfo=UTC), datetime.date(2026, 7, 21),
     "un minuto antes de la medianoche argentina"),
    # Mediodía: las dos zonas coinciden. Es el caso donde un test 'normal' pasaría igual con el
    # código roto — está acá justamente para que se vea que no discrimina.
    (datetime.datetime(2026, 7, 21, 15, 0, tzinfo=UTC), datetime.date(2026, 7, 21),
     "mediodía — las dos zonas coinciden, este caso NO discrimina"),
])
def test_hoy_es_hoy_en_argentina(instante_utc, dia_esperado, por_que):
    assert hoy_del_negocio(instante_utc) == dia_esperado, por_que


def test_el_ULTIMO_dia_del_mes_es_lo_que_rompe_el_resumen():
    """El bug caro no es el día: es el MES. Un gasto cargado el 31 a las 22:00 en Argentina cae en el
    mes siguiente si "hoy" se calcula en UTC — y aparece en el resumen equivocado, que es la única
    pantalla que justifica cargar gastos."""
    fin_de_mes = datetime.datetime(2026, 8, 1, 1, 0, tzinfo=UTC)   # 31/07 22:00 en Argentina
    assert hoy_del_negocio(fin_de_mes) == datetime.date(2026, 7, 31)
    assert hoy_del_negocio(fin_de_mes).month == 7, "cayó en agosto: el resumen de julio pierde el gasto"


def test_CONTROL_calcular_en_UTC_haria_fallar_estos_tests():
    """Sin este control, los de arriba no prueban nada: pasarían igual si `hoy_del_negocio` devolviera
    el día UTC, siempre que el CI corra de día. Acá se comprueba que la implementación INGENUA da otro
    resultado para los mismos instantes — o sea, que los tests de arriba discriminan de verdad."""
    instante = datetime.datetime(2026, 8, 1, 1, 0, tzinfo=UTC)
    ingenua = instante.date()                       # lo que daría `DEFAULT current_date` en Postgres
    correcta = hoy_del_negocio(instante)
    assert ingenua != correcta, "si estas dos coinciden, los tests de arriba son verdes por casualidad"
    assert (ingenua, correcta) == (datetime.date(2026, 8, 1), datetime.date(2026, 7, 31))


def test_la_zona_es_la_de_argentina_y_esta_declarada():
    assert ZONA_DEL_NEGOCIO.utcoffset(None) == datetime.timedelta(hours=-3)
