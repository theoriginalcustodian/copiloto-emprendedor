"""El alta que FALLA tiene que decir que falló.

El 2026-07-21 el operador tipeó mal su clave fiscal desde el teléfono. El workflow murió en 5
segundos y su query siguió respondiendo `paso="dando_de_alta", terminado=False` — la app poleó cinco
minutos esperando algo que ya estaba muerto.

El camino de error del onboarding nunca se había ejercitado: todas las pruebas previas usaron la
clave correcta. El docstring del workflow dice que el diferencial contra el competidor es que acá "el
progreso es estado real consultable"; en el camino feliz era cierto, en el de error era peor que el
del competidor —ellos muestran un mensaje inútil, nosotros uno FALSO.
"""
from __future__ import annotations

import pytest

from afip_onboarding_workflow import _MOTIVO_GENERICO, _motivo_legible
from web import _MOTIVO_ALTA_INTERRUMPIDA, make_consultar_onboarding


# ---------------------------------------------------------------------------
# El motivo que ve el usuario
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("crudo,esperado_en_copy", [
    ('{"status":"error","data":{"message":"Clave o usuario incorrecto"}}', "clave fiscal"),
    ("La clave está bloqueada por AFIP", "bloqueada"),
    ("handle_invalido_o_vencido", "venció"),
    ("read timeout", "tardó demasiado"),
])
def test_los_errores_conocidos_se_traducen_a_algo_accionable(crudo, esperado_en_copy):
    assert esperado_en_copy.lower() in _motivo_legible(Exception(crudo)).lower()


def test_un_error_desconocido_no_vuelca_el_texto_crudo():
    """El error puede arrastrar el cuerpo HTTP de AfipSDK, que en el peor caso refleja lo que se le
    mandó — incluida la clave. Un error no reconocido se cuenta genérico, y el detalle queda en el
    log de la activity, que es donde sirve."""
    secreto = "MiClaveFiscal123!"
    motivo = _motivo_legible(Exception(f'{{"sent":{{"password":"{secreto}"}}}}'))
    assert motivo == _MOTIVO_GENERICO
    assert secreto not in motivo


# ---------------------------------------------------------------------------
# El estado no puede decir "en curso" sobre un workflow muerto
# ---------------------------------------------------------------------------


class _Status:
    def __init__(self, nombre):
        self.name = nombre


class HandleFake:
    def __init__(self, progreso, status, query_rota=False):
        self._progreso = progreso
        self._status = status
        self._query_rota = query_rota

    async def query(self, _nombre):
        if self._query_rota:
            raise RuntimeError("replay failed: el código cambió desde que corrió esta ejecución")
        return self._progreso

    async def describe(self):
        return type("D", (), {"status": _Status(self._status)})()


class ClientFake:
    def __init__(self, handle):
        self._handle = handle

    def get_workflow_handle(self, _wf_id):
        return self._handle


EN_CURSO = {"paso": "dando_de_alta", "terminado": False, "ok": False, "motivo": None}


@pytest.mark.asyncio
async def test_workflow_muerto_se_reporta_terminado_aunque_la_query_diga_lo_contrario():
    """Una ejecución FAILED sigue respondiendo queries: devuelve el último estado del replay.

    Sin esto la app polea para siempre. Es lo que dejó al operador esperando.
    """
    consultar = make_consultar_onboarding(ClientFake(HandleFake(EN_CURSO, "FAILED")))
    estado = await consultar("t1", "20409378472")
    assert estado["terminado"] is True
    assert estado["paso"] == "fallido"
    assert estado["ok"] is False
    assert estado["motivo"] == _MOTIVO_ALTA_INTERRUMPIDA


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["TIMED_OUT", "TERMINATED", "CANCELED"])
async def test_cualquier_muerte_del_workflow_cuenta_no_solo_FAILED(status):
    """El try/except del workflow no puede atrapar un timeout ni un terminate. Por eso el chequeo va
    acá: honesto por construcción, no por que cada camino de error se acuerde de marcarse."""
    consultar = make_consultar_onboarding(ClientFake(HandleFake(EN_CURSO, status)))
    assert (await consultar("t1", "20409378472"))["terminado"] is True


@pytest.mark.asyncio
async def test_un_alta_en_curso_de_verdad_sigue_diciendo_en_curso():
    """El control: si el workflow VIVE, no se lo declara muerto. Sin esto el arreglo rompería el
    camino feliz —el alta tarda minutos— mostrando un fallo inexistente."""
    consultar = make_consultar_onboarding(ClientFake(HandleFake(EN_CURSO, "RUNNING")))
    estado = await consultar("t1", "20409378472")
    assert estado["terminado"] is False
    assert estado["paso"] == "dando_de_alta"


@pytest.mark.asyncio
async def test_un_alta_terminada_ok_no_se_toca():
    ok = {"paso": "habilitado", "terminado": True, "ok": True, "motivo": None}
    consultar = make_consultar_onboarding(ClientFake(HandleFake(ok, "COMPLETED")))
    assert await consultar("t1", "20409378472") == ok


@pytest.mark.asyncio
async def test_si_la_query_no_se_puede_replayar_igual_se_reporta_el_fin():
    """Caso real y contraintuitivo: arreglar el workflow ROMPE la query de las ejecuciones viejas.

    Una query replaya el history con el código ACTUAL. Al agregarle el try/except al `run()`, las
    ejecuciones que ya habían fallado dejaron de reproducirse — y la query pasó a lanzar. Si el estado
    dependiera sólo de la query, el alta muerta se vería como "sin información" en vez de como un
    fallo: se cambiaría una mentira por un silencio.

    Por eso el STATUS se pregunta primero: es un hecho del servidor y no ejecuta código.
    """
    consultar = make_consultar_onboarding(
        ClientFake(HandleFake(EN_CURSO, "FAILED", query_rota=True)))
    estado = await consultar("t1", "20409378472")
    assert estado["terminado"] is True
    assert estado["paso"] == "fallido"
    assert estado["motivo"] == _MOTIVO_ALTA_INTERRUMPIDA


@pytest.mark.asyncio
async def test_query_rota_pero_workflow_VIVO_no_se_declara_fallido():
    """El control del caso anterior: si todavía corre, un problema de lectura no lo mata."""
    consultar = make_consultar_onboarding(
        ClientFake(HandleFake(EN_CURSO, "RUNNING", query_rota=True)))
    estado = await consultar("t1", "20409378472")
    assert estado["terminado"] is False
    assert estado["paso"] == "dando_de_alta"
