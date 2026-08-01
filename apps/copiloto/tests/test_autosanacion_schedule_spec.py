"""El Schedule del ciclo: cuántas veces dispara por día, y si el deploy lo sincroniza de verdad.

POR QUÉ EXISTE. `ensure_schedule` decide algo que después nadie vuelve a mirar: si el Schedule vivo
se actualiza, o el deploy imprime "ya existía" y sigue de largo. Equivocarse acá **no rompe nada** —
deja el sistema como estaba, con el log en tono de éxito. Un cambio de frecuencia aprobado por el
operador se volvería un no-op invisible. Ver [[idempotente-no-es-convergente]].

NOTA SOBRE LOS DOBLES. Las horas se comparan expandidas, y la forma real se midió contra el
temporalio 1.28.0 del VPS y contra el Schedule vivo: el constructor y el server **normalizan**
(`ScheduleRange(4)` llega como `start=4, end=4, step=1`) y `hour`/`minute` vienen en **tupla**. Los
dobles de acá replican esa forma. Una versión anterior de este archivo probaba contra una forma
inventada (`end=0` sin normalizar) y por eso **no podía fallar**: la mutación del código lo delató.
"""
from __future__ import annotations

import pytest

pytest.importorskip("temporalio", reason="el spec se construye con tipos del SDK de Temporal")

import ensure_autosanacion_schedules as ens  # noqa: E402


# ---------------------------------------------------------------- dobles

class _Cal:
    def __init__(self, hour):
        self.hour = tuple(hour)      # tupla, como llega del server


class _Spec:
    def __init__(self, calendars):
        self.calendars = tuple(calendars)


class _Descripcion:
    """`ScheduleDescription`: lo que devuelve `describe()`."""

    def __init__(self, schedule):
        self.schedule = schedule


class _EntradaDeUpdate:
    """`ScheduleUpdateInput`: envuelve la descripción en un campo `description` — dos niveles, no
    uno. Es la forma que exige el SDK (`ScheduleUpdateInput.__dataclass_fields__ == ['description']`
    en temporalio 1.28.0), y equivocarla acá haría pasar un test contra un contrato inventado."""

    def __init__(self, schedule):
        self.description = _Descripcion(schedule)


class _HandleFalso:
    """Doble del `ScheduleHandle`: registra si le pidieron un update y con qué quedó el Schedule."""

    def __init__(self, schedule):
        self._schedule = schedule
        self.updates = 0

    async def describe(self):
        return _Descripcion(self._schedule)

    async def update(self, updater):
        self.updates += 1
        resultado = updater(_EntradaDeUpdate(self._schedule))
        self._schedule = resultado.schedule


class _ClienteFalso:
    def __init__(self, handle):
        self._handle = handle

    async def create_schedule(self, *_a, **_kw):
        from temporalio.client import ScheduleAlreadyRunningError

        raise ScheduleAlreadyRunningError()

    def get_schedule_handle(self, _id):
        return self._handle


def _schedule_vivo(horas, *, pausado, nota):
    """Un Schedule como el que hay en producción: dispara a `horas`, con su `state` propio."""
    from temporalio.client import (Schedule, ScheduleActionStartWorkflow, ScheduleRange,
                                   ScheduleState)

    return Schedule(
        action=ScheduleActionStartWorkflow("AutosanacionWorkflow", id="autosanacion-run",
                                           task_queue="agent-emprendedor"),
        spec=_Spec([_Cal([ScheduleRange(h, h, 1) for h in horas])]),
        state=ScheduleState(paused=pausado, note=nota),
    )


@pytest.fixture(autouse=True)
def _frecuencia_por_defecto():
    """00/02/04/06/08 — el default declarado. Se restaura para no contaminar otros tests."""
    previo = (ens.HORA_INICIO, ens.HORA_FIN, ens.PASO_HORAS)
    ens.HORA_INICIO, ens.HORA_FIN, ens.PASO_HORAS = 0, 8, 2
    yield
    ens.HORA_INICIO, ens.HORA_FIN, ens.PASO_HORAS = previo


# ---------------------------------------------------------------- el spec declarado

def test_el_default_son_CINCO_disparos_uno_por_cada_reparacion_que_el_tope_permite():
    """Cada ejecución repara UN trauma: los disparos son el techo real de bugs/día. Con menos de 5,
    el tope diario de 5 vuelve a ser decorativo — que es como estuvo hasta el 2026-08-01."""
    assert ens.horas_de_disparo() == [0, 2, 4, 6, 8]


def test_lo_que_el_script_escribe_es_lo_que_el_script_lee():
    """Ida y vuelta. Si `_spec()` y `_horas_del_spec()` se desincronizan, el `==` que decide si hay
    que actualizar compara peras con manzanas y el Schedule se reescribe en cada deploy."""
    assert ens._horas_del_spec(ens._spec()) == ens.horas_de_disparo() == [0, 2, 4, 6, 8]


def test_un_paso_invalido_no_puede_dejar_el_ciclo_sin_disparos():
    """`range(0, 9, 0)` lanza `ValueError`. Un env mal tipeado apagaría el ciclo por la puerta de
    atrás — y apagado se ve igual que "no había nada que reparar"."""
    ens.PASO_HORAS = 0

    assert ens.horas_de_disparo() == list(range(0, 9)), "el paso inválido degrada a 1, no a vacío"


# ---------------------------------------------------------------- la convergencia

@pytest.mark.asyncio
async def test_el_schedule_VIEJO_de_un_disparo_se_actualiza_al_nuevo_spec():
    """El caso real de este deploy: en prod vivía un Schedule de las 04:00. Sin este update, el
    cambio de frecuencia queda en el repo y nunca llega al sistema."""
    handle = _HandleFalso(_schedule_vivo([4], pausado=False, nota=None))
    cliente = _ClienteFalso(handle)

    resultado = await ens.ensure_schedule(cliente, "agent-emprendedor")

    assert handle.updates == 1, "el Schedule difería y NO se actualizó: el deploy sería un no-op"
    assert ens._horas_del_spec(handle._schedule.spec) == [0, 2, 4, 6, 8]
    assert "spec actualizado" in resultado and "1→5" in resultado


@pytest.mark.asyncio
async def test_actualizar_el_spec_NO_reanuda_un_schedule_pausado_a_mano():
    """La razón por la que este script no actualizaba nada: si alguien pausó el ciclo porque se
    estaba portando mal, un deploy no puede volver a encenderlo. Converge el `spec`, no el `state`."""
    handle = _HandleFalso(_schedule_vivo([4], pausado=True, nota="pausado a mano: PRs ruidosos"))

    await ens.ensure_schedule(_ClienteFalso(handle), "agent-emprendedor")

    assert handle._schedule.state.paused is True, "el deploy reanudó un ciclo que un humano apagó"
    assert handle._schedule.state.note == "pausado a mano: PRs ruidosos"
    assert ens._horas_del_spec(handle._schedule.spec) == [0, 2, 4, 6, 8], "y el spec sí convergió"


@pytest.mark.asyncio
async def test_si_ya_coincide_no_se_toca_el_schedule():
    """Idempotencia de verdad: converger no puede significar reescribir en cada deploy."""
    handle = _HandleFalso(_schedule_vivo([0, 2, 4, 6, 8], pausado=False, nota=None))

    resultado = await ens.ensure_schedule(_ClienteFalso(handle), "agent-emprendedor")

    assert handle.updates == 0
    assert resultado == "ya existía"
