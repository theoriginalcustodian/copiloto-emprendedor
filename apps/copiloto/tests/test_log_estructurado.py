"""Item 1.2 — que un error deje un rastro CONSULTABLE, no una frase en prosa.

Estado medido (censo 2026-07-28): **6 loggers reales en 32k LOC** de backend, `structlog=0`,
`request_id=0`. Los 147 handlers `except` que existen mayormente deciden bien —el censo probó que
casi ninguno evapora un fallo— pero **no dejan nada que se pueda contar, agrupar ni buscar**. Esa es
la diferencia entre "hay un problema" y "este problema, en este tenant, 40 veces desde el martes".

**Dos hechos medidos que este módulo respeta, y que no son obvios:**

1. `_log.warning` llega a journald; `.info` **no**. Verificado en el VPS: el unit tiene
   `StandardOutput=journal` y `logging.lastResort` sólo emite `warning+` a stderr cuando nadie llamó
   a `basicConfig`. Un log de error en `.info` es un log que no existe.
2. El campo `error_message` **no** va al registro estructurado. Puede traer datos fiscales o PII —
   ARCA lo excluye explícitamente de su audit log (`err00-handle-global-error.ts:403-413`) y acá
   aplica igual: el fingerprint identifica el error sin exponer su contenido.

El control que sostiene todo: un JSON con las claves correctas pero que **nadie emite** es
indistinguible de no tener nada. Por eso se afirma sobre lo que sale por el logger real.
"""
from __future__ import annotations

import json
import logging

import pytest

from log_estructurado import log_error


@pytest.fixture()
def capturado(caplog: pytest.LogCaptureFixture):
    caplog.set_level(logging.DEBUG, logger="copiloto")
    return caplog


def _json_de(caplog) -> dict:
    assert caplog.records, "no se emitió NINGÚN registro: el log no existe"
    return json.loads(caplog.records[-1].getMessage())


class TestLogError:
    def test_emite_json_parseable_con_el_contexto_minimo(self, capturado) -> None:
        try:
            raise ValueError("monto inválido")
        except ValueError as exc:
            log_error(exc, workflow="FacturaWorkflow", cliente_id="c-1", duration_ms=12)

        d = _json_de(capturado)
        assert d["workflow"] == "FacturaWorkflow"
        assert d["cliente_id"] == "c-1"
        assert d["error_type"] == "ValueError"
        assert d["duration_ms"] == 12
        assert len(d["fingerprint"]) == 8

    def test_el_nivel_es_warning_o_mas_porque_info_NO_llega_a_journald(self, capturado) -> None:
        """Medido en el VPS: `.info` no aparece en journalctl. Un error logueado en info es un error
        que nadie va a ver — el nivel no es cosmético acá."""
        try:
            raise RuntimeError("x")
        except RuntimeError as exc:
            log_error(exc, workflow="W", cliente_id="c-1")

        assert capturado.records[-1].levelno >= logging.WARNING

    def test_NO_filtra_el_mensaje_del_error_por_PII_y_datos_fiscales(self, capturado) -> None:
        """El mensaje puede traer un CUIT, un monto o un nombre. El fingerprint identifica el error
        sin exponer su contenido — mismo criterio que el audit log de ARCA."""
        try:
            raise ValueError("CUIT 20-12345678-9 rechazado, monto 150000")
        except ValueError as exc:
            log_error(exc, workflow="W", cliente_id="c-1")

        crudo = capturado.records[-1].getMessage()
        assert "20-12345678-9" not in crudo
        assert "150000" not in crudo

    def test_el_mismo_error_dos_veces_da_el_MISMO_fingerprint(self, capturado) -> None:
        """Es lo que permite contar. Sin esto el log estructurado es prosa con llaves."""
        for _ in range(2):
            try:
                raise ValueError("mismo fallo")
            except ValueError as exc:
                log_error(exc, workflow="W", cliente_id="c-1")

        fps = [json.loads(r.getMessage())["fingerprint"] for r in capturado.records[-2:]]
        assert fps[0] == fps[1]

    def test_CONTROL_errores_distintos_dan_fingerprints_distintos(self, capturado) -> None:
        for msg in ("fallo A", "fallo B"):
            try:
                raise ValueError(msg)
            except ValueError as exc:
                log_error(exc, workflow="W", cliente_id="c-1")

        fps = [json.loads(r.getMessage())["fingerprint"] for r in capturado.records[-2:]]
        assert fps[0] != fps[1]

    def test_loguear_NUNCA_puede_romper_el_flujo(self, capturado) -> None:
        """Un objeto no serializable en el contexto no puede tumbar el turno del usuario: registrar un
        error jamás debe generar un error nuevo (principio directo de ARCA)."""
        class NoSerializable:
            pass

        try:
            raise ValueError("x")
        except ValueError as exc:
            log_error(exc, workflow="W", cliente_id="c-1", extra={"raro": NoSerializable()})

        # No explotó, y aun así dejó rastro.
        assert capturado.records, "se tragó el log entero al fallar la serialización"
