"""La costura C3 registra TODO lo que falla — y nada de lo que no.

La integración real (que el interceptor vea la excepción con `cliente_id` y nombre de activity contra
el Temporal del VPS) ya está probada por el spike S1 → `spikes/RESULT.md`. Acá se fija el
**comportamiento** que ese spike habilitó, con sus controles:

- el caso normal (una activity que pasa) **no** puede ensuciar el log — si registrara siempre, el
  registro no significaría nada;
- la excepción llega al llamador **intacta**, no envuelta — envolverla cambiaría los reintentos de
  Temporal, que dependen del tipo;
- un error de **tipo nuevo** (sin categoría) se registra igual: si se perdiera, el que más importa ver
  sería justamente el invisible;
- un fallo **del propio registrador** no puede tumbar la activity.
"""
from __future__ import annotations

import json
import logging

import pytest

from interceptor_errores import _CapturaInbound, _cliente_id_de


class _InfoFalsa:
    activity_type = "execute_tool"
    attempt = 2
    workflow_id = "conv-web-cliente-1-sesion-9"


class _SiguienteQueFalla:
    def __init__(self, exc: BaseException) -> None:
        self._exc = exc

    async def execute_activity(self, _input):  # noqa: ANN001
        raise self._exc


class _SiguienteQuePasa:
    async def execute_activity(self, _input):  # noqa: ANN001
        return {"status": "ok"}


class _InputFalso:
    def __init__(self, payload) -> None:  # noqa: ANN001
        self.args = (payload,)


PAYLOAD = {
    "domain": "copiloto",
    "name": "registrar_gasto",
    "conv": {"cliente_id": "11111111-1111-1111-1111-111111111111"},
}


@pytest.fixture(autouse=True)
def _info(monkeypatch):
    monkeypatch.setattr("interceptor_errores.activity.info", lambda: _InfoFalsa())


def _lineas(caplog) -> list[dict]:
    salida = []
    for r in caplog.records:
        try:
            salida.append(json.loads(r.getMessage()))
        except (json.JSONDecodeError, TypeError):
            pass
    return salida


@pytest.mark.asyncio
async def test_una_activity_que_falla_deja_el_registro_con_tenant_y_tool(caplog):
    caplog.set_level(logging.WARNING)
    inter = _CapturaInbound(_SiguienteQueFalla(ConnectionError("upstream caido")))

    with pytest.raises(ConnectionError):
        await inter.execute_activity(_InputFalso(PAYLOAD))

    (reg,) = _lineas(caplog)
    assert reg["workflow"] == "execute_tool"
    assert reg["cliente_id"] == "11111111-1111-1111-1111-111111111111"
    assert reg["tool"] == "registrar_gasto"
    assert reg["costura"] == "activity_interceptor"
    assert reg["attempt"] == 2
    assert reg["fingerprint"]
    # El mensaje NO viaja: puede llevar PII o datos fiscales (misma decisión que `log_error`).
    assert "error_message" not in reg


@pytest.mark.asyncio
async def test_CONTROL_una_activity_que_PASA_no_registra_nada(caplog):
    """Sin esto, un registrador que escribe siempre pasaría todos los demás tests igual."""
    caplog.set_level(logging.WARNING)
    inter = _CapturaInbound(_SiguienteQuePasa())

    assert await inter.execute_activity(_InputFalso(PAYLOAD)) == {"status": "ok"}
    assert _lineas(caplog) == []


@pytest.mark.asyncio
async def test_la_excepcion_llega_INTACTA_al_llamador(caplog):
    """Registrar no puede cambiar lo registrado: Temporal decide el retry por el TIPO."""
    caplog.set_level(logging.WARNING)
    original = ValueError("dato invalido")
    inter = _CapturaInbound(_SiguienteQueFalla(original))

    with pytest.raises(ValueError) as capturada:
        await inter.execute_activity(_InputFalso(PAYLOAD))

    assert capturada.value is original  # la MISMA instancia, no una envoltura


@pytest.mark.asyncio
async def test_un_error_de_tipo_NUEVO_se_registra_marcado_y_no_se_pierde(caplog):
    """`categoria_de` levanta ante un tipo no registrado — a propósito. En la costura eso no puede
    hacer desaparecer el error: se marca SIN_CATEGORIA, que es ruidoso y accionable."""
    caplog.set_level(logging.WARNING)

    class ErrorNuncaVisto(Exception):
        pass

    inter = _CapturaInbound(_SiguienteQueFalla(ErrorNuncaVisto("primera vez")))
    with pytest.raises(ErrorNuncaVisto):
        await inter.execute_activity(_InputFalso(PAYLOAD))

    (reg,) = _lineas(caplog)
    assert reg["categoria"] == "SIN_CATEGORIA"
    assert reg["error_type"] == "ErrorNuncaVisto"


@pytest.mark.asyncio
async def test_si_el_REGISTRADOR_falla_la_activity_igual_propaga_su_error(monkeypatch, caplog):
    """Fallar registrando jamás puede costar más que el error que se estaba registrando."""
    caplog.set_level(logging.WARNING)
    monkeypatch.setattr("interceptor_errores.log_error",
                        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("el logger exploto")))

    inter = _CapturaInbound(_SiguienteQueFalla(ConnectionError("upstream caido")))
    with pytest.raises(ConnectionError):        # el error ORIGINAL, no el del logger
        await inter.execute_activity(_InputFalso(PAYLOAD))


@pytest.mark.parametrize(
    "payload, esperado",
    [
        ({"conv": {"cliente_id": "abc"}}, "abc"),          # shape del motor ReAct
        ({"cliente_id": "plano"}, "plano"),                 # shape de las activities de dominio
        ({"ctx": {"cliente_id": "en-ctx"}}, "en-ctx"),
        ({"conv": {}}, None),                               # presente pero vacío
        ({"otra": 1}, None),
        ("no-es-dict", None),
        (None, None),
    ],
)
def test_el_tenant_se_extrae_sin_asumir_un_shape_unico(payload, esperado):
    """Las activities NO comparten shape: el motor anida en `conv`, las de dominio lo mandan plano."""
    assert _cliente_id_de(payload) == esperado
