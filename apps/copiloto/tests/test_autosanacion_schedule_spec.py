"""El spec del Schedule del ciclo: cuántas veces dispara por día, y si el deploy lo sincroniza.

POR QUÉ EXISTE. Estas dos funciones deciden algo que después NADIE vuelve a mirar: si el Schedule
vivo se actualiza o el deploy dice "ya existía" y sigue de largo. Un error acá no rompe nada — deja
el sistema exactamente como estaba, con el log diciendo que todo salió bien. Es el modo de fallo más
caro que tiene este repo, así que las partes puras se prueban acá y no en el VPS a mano.

Se ejercita también el desacuerdo que motivó el cambio (2026-08-01): el tope diario de 5 no limitaba
nada mientras hubiera UN disparo por día, porque cada ejecución repara un solo trauma.
"""
from __future__ import annotations

import pytest

pytest.importorskip("temporalio", reason="el spec se construye con tipos del SDK de Temporal")

import ensure_autosanacion_schedules as ens  # noqa: E402


class _Cal:
    """Doble del `ScheduleCalendarSpec` vivo: sólo hace falta que exponga `.hour`."""

    def __init__(self, hour):
        self.hour = hour


class _Spec:
    def __init__(self, calendars):
        self.calendars = calendars


def _rango(start, end=0, step=0):
    from temporalio.client import ScheduleRange

    return ScheduleRange(start, end, step)


def test_el_default_son_CINCO_disparos_uno_por_cada_reparacion_que_el_tope_permite(monkeypatch):
    """00, 02, 04, 06 y 08 — el techo real pasa a ser el tope, no la frecuencia."""
    for env, valor in (("COPILOTO_AUTOSANACION_HORA", "0"),
                       ("COPILOTO_AUTOSANACION_HORA_FIN", "8"),
                       ("COPILOTO_AUTOSANACION_PASO_HORAS", "2")):
        monkeypatch.setenv(env, valor)
    ens.HORA_INICIO, ens.HORA_FIN, ens.PASO_HORAS = 0, 8, 2

    assert ens.horas_de_disparo() == [0, 2, 4, 6, 8]
    assert len(ens.horas_de_disparo()) == 5, "menos de 5 y el tope diario vuelve a ser decorativo"


def test_un_rango_de_una_sola_hora_no_se_lee_como_de_la_4_a_la_0():
    """`ScheduleRange(4)` deja `end=0` y `step=0`.

    Leído crudo, `range(4, 0+1)` es **vacío**: el spec vivo parecería no disparar nunca y el deploy
    lo "actualizaría" en cada corrida. La expansión tiene que tratar `end` ausente como `start`.
    """
    assert ens._horas_del_spec(_Spec([_Cal([_rango(4)])])) == [4]


def test_expande_el_rango_con_paso_igual_que_el_spec_que_escribe():
    """Ida y vuelta: lo que el script escribe es lo que el script lee. Sin esto, el `==` que decide
    si actualizar compara peras con manzanas y el Schedule se reescribe en todos los deploys."""
    ens.HORA_INICIO, ens.HORA_FIN, ens.PASO_HORAS = 0, 8, 2

    assert ens._horas_del_spec(ens._spec()) == ens.horas_de_disparo() == [0, 2, 4, 6, 8]


def test_detecta_que_el_schedule_VIEJO_de_un_disparo_hay_que_actualizarlo():
    """El caso real de este deploy: en prod vive un Schedule de las 04:00 y nada avisa que quedó
    corto. La comparación tiene que dar distinto, o el cambio de frecuencia nunca llega."""
    ens.HORA_INICIO, ens.HORA_FIN, ens.PASO_HORAS = 0, 8, 2
    vivo = ens._horas_del_spec(_Spec([_Cal([_rango(4)])]))

    assert vivo == [4]
    assert vivo != ens.horas_de_disparo(), "si esto empata, el deploy dice 'ya existía' y no cambia nada"


def test_un_paso_invalido_no_puede_dejar_el_ciclo_sin_disparos():
    """`step=0` en `range()` lanza `ValueError`. Un env mal tipeado apagaría el ciclo entero por la
    puerta de atrás — y apagado se ve igual que "no había nada que reparar"."""
    ens.HORA_INICIO, ens.HORA_FIN, ens.PASO_HORAS = 0, 8, 0

    assert ens.horas_de_disparo() == list(range(0, 9)), "el paso inválido degrada a 1, no a vacío"
