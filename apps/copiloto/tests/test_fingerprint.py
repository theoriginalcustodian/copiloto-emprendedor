"""Item 1.1 — el fingerprint que agrupa el mismo error en vez de 147 líneas sueltas.

Estado medido antes de esto (censo del 2026-07-28): `fingerprint=0 · structlog=0 · dlq=0` en todo el
repo, con 147 handlers `except` y **6 loggers reales en 32k LOC**. Sin fingerprint, dos ocurrencias
del mismo fallo son dos líneas sin relación: no hay forma de contar "esto pasó 40 veces" ni de
deduplicar nada aguas abajo, que es la precondición de la DLQ (Fase 2) y de la autosanación (Fase 3).

**Portado de ARCA** (`lib/shared/temporal/err00-djb2-hash.ts:28-36`), no inventado. El algoritmo es
djb2 clásico 32-bit → hex de 8 chars, y su propia doc advierte: *"el algoritmo DEBE ser byte-idéntico
[…] un cambio en la fórmula rompería la compatibilidad"*. Por eso el test de paridad con vectores
calculados a mano: si alguien "optimiza" la fórmula, el dedupe cross-plataforma se parte en silencio.

**El control que hace que estos tests valgan algo:** verificar que errores DISTINTOS dan fingerprints
DISTINTOS. Sin eso, un `return "x"` constante pasaría el test de estabilidad con nota perfecta —
sería el instrumento que confirma en vez de verificar.
"""
from __future__ import annotations

import pytest

from fingerprint import djb2_hash, fingerprint_de_error


class TestDjb2Paridad:
    """Paridad byte a byte con la implementación de ARCA — el dedupe es cross-plataforma."""

    @pytest.mark.parametrize(
        "entrada,esperado",
        [
            # Vectores del djb2 clásico: hash=5381; hash=((hash<<5)+hash+c) & 0xFFFFFFFF.
            # Verificados con la aritmética explícita al lado — la primera versión de este test
            # traía `ab -> 00597834`, calculado mal a mano, y el test lo cazó. Se dejan las cuentas
            # para que el próximo pueda comprobarlas sin volver a confiar en nadie.
            ("", "00001505"),          # 5381                                  = 0x1505
            ("a", "0002b606"),         # 5381*33 + 97      = 177670            = 0x2b606
            ("ab", "00597728"),        # 177670*33 + 98    = 5863208           = 0x597728
            ("abc", "0b885c8b"),       # 5863208*33 + 99   = 193485963         = 0xb885c8b
        ],
    )
    def test_vectores_conocidos(self, entrada: str, esperado: str) -> None:
        assert djb2_hash(entrada) == esperado

    def test_siempre_8_chars_hex(self) -> None:
        for s in ["", "x", "un error largo " * 40, "áéíóú ñ 中文"]:
            h = djb2_hash(s)
            assert len(h) == 8, f"{s!r} dio {h!r}"
            int(h, 16)  # revienta si no es hex


class TestFingerprintDeError:
    def test_el_mismo_error_da_el_mismo_fingerprint(self) -> None:
        a = fingerprint_de_error(workflow="FacturaWorkflow", error_type="ErrorAfip",
                                 error_message="CAE rechazado por el WS")
        b = fingerprint_de_error(workflow="FacturaWorkflow", error_type="ErrorAfip",
                                 error_message="CAE rechazado por el WS")
        assert a == b

    @pytest.mark.parametrize(
        "campo,valor",
        [("workflow", "OtroWorkflow"), ("error_type", "OtroError"),
         ("error_message", "otro mensaje")],
    )
    def test_CONTROL_errores_distintos_dan_fingerprints_DISTINTOS(self, campo: str, valor: str) -> None:
        """EL CONTROL. Sin esto, `return "x"` pasaría el test de estabilidad de arriba."""
        base = {"workflow": "FacturaWorkflow", "error_type": "ErrorAfip", "error_message": "CAE rechazado"}
        distinto = {**base, campo: valor}
        assert fingerprint_de_error(**base) != fingerprint_de_error(**distinto), \
            f"cambiar {campo} no cambió el fingerprint: colisión que fusionaría errores distintos"

    def test_el_mensaje_se_trunca_a_200_para_que_el_ruido_no_parta_el_grupo(self) -> None:
        """Un mensaje con un id/timestamp variable al final NO debe generar un fingerprint nuevo cada
        vez: el corte a 200 chars es lo que mantiene juntas las ocurrencias del MISMO fallo."""
        prefijo = "timeout consultando AFIP para el comprobante " + ("x" * 200)
        a = fingerprint_de_error(workflow="W", error_type="E", error_message=prefijo + " id=1")
        b = fingerprint_de_error(workflow="W", error_type="E", error_message=prefijo + " id=99999")
        assert a == b

    def test_el_mensaje_None_no_revienta(self) -> None:
        """Un error sin mensaje sigue siendo agrupable — la captura nunca puede fallar por esto."""
        h = fingerprint_de_error(workflow="W", error_type="E", error_message=None)
        assert len(h) == 8

    def test_desde_una_excepcion_real(self) -> None:
        """El uso real: se le pasa la excepción, no strings sueltos."""
        try:
            raise ValueError("monto inválido")
        except ValueError as exc:
            h = fingerprint_de_error(workflow="W", exc=exc)
        assert h == fingerprint_de_error(workflow="W", error_type="ValueError",
                                         error_message="monto inválido")
