"""Cliente del orquestador RAG de fusion (SOP4, camino C) -- contrato cerrado, no se re-negocia.

`POST /rag/answer` discrimina por el campo `outcome`, NUNCA por el texto de la respuesta:

  answered     (200) -> `answer` tiene contenido, se muestra tal cual.
  refused      (200) -> `answer` viene en `null` A PROPÓSITO ("lo que no viaja no se puede filtrar").
                        el motivo va en `refusal_reason` (low_cluster_coherence | hhem_low_faithfulness).
  unavailable  (503) -> el motor no pudo trabajar. Trae `reason`.
  timeout / connection refused -> se trata como `unavailable` (mismo mensaje al usuario).

`refused` y `unavailable` NO pueden verse iguales desde el agente: uno es "no hay base para responder
esto", el otro "el motor no pudo trabajar". Colapsarlos en un error genérico es exactamente el punto
donde un LLM chico (GPT-4o-mini) improvisa -- que es el fallo que este diseño existe para evitar.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Callable

import httpx

ANSWERED = "answered"
REFUSED = "refused"
UNAVAILABLE = "unavailable"

_READ_TIMEOUT_S = 20.0  # el RAG puede tardar (retrieval + rerank + gates); más que un tool de dominio


@dataclass
class RagRespuesta:
    outcome: str                    # answered | refused | unavailable
    answer: str | None = None       # sólo si outcome == answered
    refusal_reason: str | None = None   # sólo si outcome == refused
    reason: str | None = None       # sólo si outcome == unavailable


class OrquestadorRagClient:
    """Cliente mínimo del orquestador HTTP de fusion. `healthz()` NO requiere token (verificado contra
    el servicio real, 2026-08-07); `answer()` sí."""

    def __init__(self, *, base_url: str, token: str, namespace: str,
                 client: httpx.Client | None = None) -> None:
        self._base = base_url.rstrip("/")
        self._token = token
        self._namespace = namespace
        self._client = client or httpx.Client(timeout=_READ_TIMEOUT_S)

    @classmethod
    def from_env(cls, *, namespace: str, env: dict | None = None) -> "OrquestadorRagClient":
        """`token` SIEMPRE de env (vault del VPS) -- nunca hardcoded, nunca por el buzón (contrato
        SOP4). Sin `RAG_ORQUESTADOR_BASE_URL`/`_TOKEN` -> `RuntimeError` explícito, mismo criterio que
        `SoporteClasificador.from_env` (apagado ruidoso, no un cliente mudo)."""
        e = env if env is not None else os.environ
        base = e.get("RAG_ORQUESTADOR_BASE_URL")
        token = e.get("RAG_ORQUESTADOR_TOKEN")
        if not base or not token:
            raise RuntimeError(
                "faltan RAG_ORQUESTADOR_BASE_URL / RAG_ORQUESTADOR_TOKEN (orquestador RAG de fusion) "
                "en el env del copiloto")
        return cls(base_url=base, token=token, namespace=namespace)

    def healthz(self) -> bool:
        """Liveness, NO gasta modelo ni requiere token (contrato SOP4). Usado para verificar
        conectividad mientras el token no está disponible, y como control N1 (apagado real)."""
        try:
            resp = self._client.get(self._base + "/healthz")
            return resp.status_code == 200
        except (httpx.TimeoutException, httpx.TransportError):
            return False

    def answer(self, query: str, *, cliente_id: str | None = None) -> RagRespuesta:
        """`cliente_id=None` a propósito por default: el contrato de fusion lo declara así para
        namespaces de conocimiento general (no filtra por tenant -- eso lo hace el toolset de SQL,
        nunca el RAG, C8). Timeout/connection error -> UNAVAILABLE, mismo trato que un 503 real."""
        body = {"query": query, "namespace": self._namespace, "cliente_id": cliente_id}
        headers = {"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"}
        try:
            resp = self._client.post(self._base + "/rag/answer", headers=headers, json=body)
        except (httpx.TimeoutException, httpx.TransportError):
            return RagRespuesta(outcome=UNAVAILABLE, reason="timeout_o_conexion_caida")

        if resp.status_code == 503:
            data = resp.json() if _es_json(resp) else {}
            return RagRespuesta(outcome=UNAVAILABLE, reason=data.get("reason", "servicio_no_disponible"))
        if resp.status_code != 200:
            # No documentado por el contrato (ej. 401 sin token válido) -- fail-safe: se trata como
            # UNAVAILABLE, nunca como "respuesta vacía silenciosa".
            return RagRespuesta(outcome=UNAVAILABLE, reason=f"http_{resp.status_code}_inesperado")

        data = resp.json()
        outcome = data.get("outcome")
        if outcome == ANSWERED:
            return RagRespuesta(outcome=ANSWERED, answer=data.get("answer"))
        if outcome == REFUSED:
            return RagRespuesta(outcome=REFUSED, refusal_reason=data.get("refusal_reason"))
        # outcome ausente o desconocido con HTTP 200 -- el contrato sólo define estos dos para 200.
        return RagRespuesta(outcome=UNAVAILABLE, reason=f"outcome_inesperado:{outcome!r}")


def _es_json(resp: httpx.Response) -> bool:
    try:
        resp.json()
        return True
    except ValueError:
        return False


def build_rag_client_factory(namespace: str, env: dict | None = None) -> Callable[[], OrquestadorRagClient | None]:
    """`() -> OrquestadorRagClient | None` -- boundary para el composition root del worker de soporte.
    `None` si el env no está completo (apagado explícito, ver `from_env`); la tool lo maneja como
    UNAVAILABLE, nunca como excepción no capturada en medio de un turno del agente."""
    def factory() -> OrquestadorRagClient | None:
        try:
            return OrquestadorRagClient.from_env(namespace=namespace, env=env)
        except RuntimeError:
            return None

    return factory
