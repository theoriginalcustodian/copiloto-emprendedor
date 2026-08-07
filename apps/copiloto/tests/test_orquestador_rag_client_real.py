"""`OrquestadorRagClient` contra el SERVICIO REAL de fusion (SOP4, C5/N1/N2/N6).

Opt-in (`RAG_ORQUESTADOR_TOKEN` en el env -- nunca en el repo, nunca en este archivo): sin él, se
salta con motivo explícito. El token real vive en `/etc/unreal-copilot/copiloto.env` del VPS; correr
este archivo requiere sourcearlo ANTES de invocar pytest (nunca pasa por un argumento de shell visible
en el historial)."""
from __future__ import annotations

import os

import pytest

from orquestador_rag_client import OrquestadorRagClient

necesita_rag = pytest.mark.skipif(not os.environ.get("RAG_ORQUESTADOR_TOKEN"),
                                  reason="requiere RAG_ORQUESTADOR_TOKEN real (canal de secretos, no repo)")


@pytest.fixture
def cliente() -> OrquestadorRagClient:
    return OrquestadorRagClient.from_env(namespace=os.environ.get("RAG_ORQUESTADOR_NAMESPACE",
                                                                   "copiloto-howto"))


def test_healthz_real_sin_token_es_true():
    """El contrato SOP4 lo declara explícito: healthz NO requiere token."""
    c = OrquestadorRagClient(base_url="https://rag-copiloto.89-167-20-226.sslip.io",
                             token="no-hace-falta-para-healthz", namespace="copiloto-howto")
    assert c.healthz() is True


@necesita_rag
def test_ANSWERED_real_una_pregunta_del_corpus_trae_contenido(cliente):
    """N6, el control positivo del corpus: sin esto, un retrieval completamente roto pasaría N2 con
    honores. Verificado 2026-08-07: el namespace YA tiene contenido (corrigió el estado que un `dato_`
    anterior de planificación declaraba vacío -- no se asumió, se corrió el control)."""
    r = cliente.answer("cómo emito una factura")
    assert r.outcome == "answered"
    assert r.answer and len(r.answer) > 20
    assert r.retrieved_count and r.retrieved_count > 0


@necesita_rag
def test_REFUSED_real_una_pregunta_fuera_de_dominio_no_la_contesta(cliente):
    """N2: pregunta cuya respuesta NO está en el corpus -> el gate de sufficiency rechaza, `answer`
    viene en null. Es el caso que caza el fallo propio de un modelo chico (SOP4)."""
    r = cliente.answer("cuál es la capital de Francia")
    assert r.outcome == "refused"
    assert r.answer is None
    assert r.refusal_reason  # el contrato NO fija un enum cerrado -- lo que importa es que venga


@necesita_rag
def test_UNAVAILABLE_real_token_invalido_degrada_sin_lanzar(cliente):
    """No es uno de los outcomes documentados (401), pero el cliente debe fail-safe a UNAVAILABLE --
    nunca una excepción no capturada en medio de un turno del agente."""
    c_malo = OrquestadorRagClient(base_url="https://rag-copiloto.89-167-20-226.sslip.io",
                                  token="token-invalido-de-prueba-e2e", namespace="copiloto-howto")
    r = c_malo.answer("cualquier cosa")
    assert r.outcome == "unavailable"


@necesita_rag
def test_UNAVAILABLE_real_endpoint_inalcanzable_es_el_N1_del_DoD(cliente):
    """N1: "RAG/orquestador apagado a propósito" -- no puedo apagar el servicio de fusion (no es mío),
    así que provoco la falla del lado del AGENTE: apuntar a un puerto cerrado es una conexión que
    realmente falla, no una que se razona. Mismo comportamiento que el servicio real caído."""
    c_inalcanzable = OrquestadorRagClient(
        base_url="https://rag-copiloto.89-167-20-226.sslip.io:9999", token="x", namespace="x")
    r = c_inalcanzable.answer("cualquier cosa")
    assert r.outcome == "unavailable"
    assert r.reason == "timeout_o_conexion_caida"
