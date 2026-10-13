"""El payload REAL de AFIP archivado en el spike contra el contrato que el gateway lee.

Por qué existe (pedido de planificación 2026-10-12, hallazgo «ARCA es el único de 5 terceros sin
observación», mitad barata): `spikes/afip-emit-pdf/RESULT.md` guarda la respuesta textual de
`createNextVoucher` contra homologación (CAE 86290616895615) y NADA la leía — era evidencia sin
instrumento. Los tests de `test_afip_gateway.py` arman la respuesta a mano, y un dict escrito por el
mismo que escribió el parser concuerda consigo mismo aunque el WS diga otra cosa (ya pasó: la doc decía
`voucher_number` y el WS devuelve `voucherNumber`).

Qué mide acá, sin red, sin token y sin pedirle un secreto a nadie:
  1. que el bloque archivado se encuentra y parsea (si el RESULT.md cambia de forma, esto es ROJO, no skip);
  2. que su set de claves == `CLAVES_EMISION_WS` (lo que `emitir` lee), en las dos direcciones;
  3. CONTROL NEGATIVO: quitarle una clave al contrato (o inventarle una) da rojo y la nombra — sin esto el
     verde de (2) no distingue un comparador que ve de uno que no mira;
  4. que el gateway REAL traduce el payload archivado al `ResultadoEmision` esperado.

No cubre: volver a correr contra AFIP (secreto AfipSDK + CUIT compartido — decisión del operador) ni el
camino de rechazo, que el spike tampoco capturó.
"""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

import pytest

from afip_gateway import CLAVES_EMISION_WS, AfipGateway, ErrorAfip

# apps/copiloto/tests/<este archivo> -> raíz del repo (o del STAGE de sync-test-backend.sh, que
# empaqueta `spikes/afip-emit-pdf/RESULT.md` justamente para esto).
RESULT_MD = Path(__file__).resolve().parents[3] / "spikes" / "afip-emit-pdf" / "RESULT.md"

# El bloque ```json que sigue a la frase «devuelve, textual:» de la sección S1. Anclado a la frase y no a
# «el primer bloque json»: el archivo tiene otros (getVoucherInfo, QR) con claves distintas.
_ANCLA = re.compile(r"createNextVoucher\(data\)`\s*devuelve,\s*textual:\s*```json\s*(\{.*?\})\s*```", re.DOTALL)


def _payload_archivado() -> dict:
    assert RESULT_MD.is_file(), (
        f"no existe {RESULT_MD}: el test no puede mirar su sujeto. Si el spike se movió, actualizá RESULT_MD "
        "y el tar de deploy/copiloto/sync-test-backend.sh — esto NO se saltea."
    )
    coincidencias = _ANCLA.findall(RESULT_MD.read_text(encoding="utf-8"))
    assert len(coincidencias) == 1, (
        f"se esperaba 1 bloque «createNextVoucher(data) devuelve, textual» en RESULT.md y hay {len(coincidencias)}"
    )
    return json.loads(coincidencias[0])


def _comparar(recibidas, declaradas):
    """(sobra, falta): misma semántica que `meclaves_check.comparar_claves`, sin importar de deploy/."""
    recibidas, declaradas = frozenset(recibidas), frozenset(declaradas)
    return sorted(recibidas - declaradas), sorted(declaradas - recibidas)


class _Billing:
    def __init__(self, respuesta):
        self._respuesta = respuesta

    def createNextVoucher(self, data):  # noqa: N802 - la firma es la del SDK
        return self._respuesta


class _Cliente:
    def __init__(self, billing):
        self.ElectronicBilling = billing


def _gateway(respuesta) -> AfipGateway:
    return AfipGateway(cuit="20409378472", access_token="token-de-prueba",
                       cliente_factory=lambda: _Cliente(_Billing(respuesta)))


def test_el_payload_archivado_se_encuentra_y_es_el_de_la_homologacion():
    p = _payload_archivado()
    # El CAE que RESULT.md cita en su tabla de S1 como «primera emisión»: ancla de que leímos el bloque correcto.
    assert p["CAE"] == "86290616895615"


def test_set_de_claves_archivado_coincide_con_el_contrato_del_gateway():
    sobra, falta = _comparar(_payload_archivado().keys(), CLAVES_EMISION_WS)
    assert (sobra, falta) == ([], []), (
        f"el WS devolvió {sobra} que el gateway no declara · el gateway lee {falta} que el WS no devolvió"
    )


@pytest.mark.parametrize("clave", sorted(CLAVES_EMISION_WS))
def test_control_negativo_quitarle_una_clave_al_contrato_da_rojo(clave):
    sobra, falta = _comparar(_payload_archivado().keys(), CLAVES_EMISION_WS - {clave})
    assert sobra == [clave] and falta == []


def test_control_negativo_inventarle_una_clave_al_contrato_da_rojo():
    sobra, falta = _comparar(_payload_archivado().keys(), CLAVES_EMISION_WS | {"clave_de_mentira"})
    assert sobra == [] and falta == ["clave_de_mentira"]


def test_el_gateway_real_traduce_el_payload_archivado():
    res = _gateway(_payload_archivado()).emitir({"CbteTipo": 11})
    assert (res.cae, res.cae_vto, res.numero, res.resultado) == ("86290616895615", date(2026, 7, 31), 14678, "A")


@pytest.mark.parametrize("clave", sorted(CLAVES_EMISION_WS))
def test_sin_una_clave_del_contrato_el_gateway_falla_ruidoso(clave):
    """Contraparte del anterior: el payload archivado SIN una clave no pasa como emisión (fail-closed)."""
    incompleto = {k: v for k, v in _payload_archivado().items() if k != clave}
    with pytest.raises(ErrorAfip, match="incompleta"):
        _gateway(incompleto).emitir({"CbteTipo": 11})
