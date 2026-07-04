"""Test adversarial de aislamiento cross-emprendedor de la MEMORIA conversacional (regla dura de seguridad).

Contraparte de nivel-memoria de test_adversarial_multitenant.py (que cubre Postgres): ejercita el camino
HOSTIL contra la instancia Graphity VIVA. Dos emprendedores (cliente_id UUID) escriben cada uno un fact
distintivo en SU user graph; se verifica que `recall(A)` trae lo de A y NUNCA lo de B (y viceversa). Sin este
test, el aislamiento cross-emprendedor de la memoria queda [UNVERIFIED] (CLAUDE.md global §Seguridad — "control
de autorización sin test adversarial = control no verificado"). El aislamiento se apoya en user_id distinto
derivado del cliente_id UUID (no-adivinable) + namespacing físico del server (ADR-040, verificado 2026-07-04).

Requiere la instancia viva (GRAPHITY_BASE_URL + GRAPHITY_API_KEY) → SKIP si faltan. Corre EN EL VPS (tiene la
key + red a graphitymt). Usa un namespace de test propio y hace `forget` de ambos user graphs en el teardown."""
from __future__ import annotations

import os
import sys
import time
import uuid
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP))

from graphity_memory_client import GraphityMemoryClient  # noqa: E402
from memory_provider import MemoryProvider  # noqa: E402

pytestmark = pytest.mark.skipif(
    not (os.environ.get("GRAPHITY_BASE_URL") and os.environ.get("GRAPHITY_API_KEY")),
    reason="requiere instancia Graphity viva (GRAPHITY_BASE_URL + GRAPHITY_API_KEY)")

# Nombres propios improbables en datos reales (mismo criterio que el spike ADR-040: términos no-ambiguos).
_TERM_A = "ZzwayneShoes"
_TERM_B = "ZzkentShoes"
# Namespace de test aislado del de producción ("copiloto") → jamás toca la memoria de un emprendedor real.
_TEST_NS = f"copilototest-{uuid.uuid4().hex[:8]}"
_INGEST_TIMEOUT_S = 120   # add_messages dispara extracción LLM server-side (puede tardar; poll generoso)
_POLL_S = 4


@pytest.fixture
def provider() -> MemoryProvider:
    client = GraphityMemoryClient(base_url=os.environ["GRAPHITY_BASE_URL"],
                                  api_key=os.environ["GRAPHITY_API_KEY"])
    return MemoryProvider(client, namespace=_TEST_NS, facts_limit=30, message_count=10)


@pytest.fixture
def two_emprendedores(provider):
    """2 cliente_id UUID frescos. Teardown: forget de ambos (borra user graph + cascade + Neo4j)."""
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    provider.forget(a)
    provider.forget(b)


def _wait_recall_contains(provider: MemoryProvider, cid: str, thread_ref: str, needle: str) -> str:
    """Poll del recall hasta que el fact propio aparezca (confirma que la extracción ingirió) o timeout."""
    deadline = time.monotonic() + _INGEST_TIMEOUT_S
    ctx = ""
    while time.monotonic() < deadline:
        ctx = provider.recall(cid, thread_ref)
        if needle.lower() in ctx.lower():
            return ctx
        time.sleep(_POLL_S)
    return ctx


def test_recall_isolation_cross_emprendedor(provider, two_emprendedores):
    a, b = two_emprendedores

    provider.remember(a, "web", [
        {"role": "user", "content": "Hola, tengo un emprendimiento."},
        {"role": "user", "content": f"Mi local se llama {_TERM_A} y vende zapatillas de running."}])
    provider.remember(b, "web", [
        {"role": "user", "content": "Hola, tengo un emprendimiento."},
        {"role": "user", "content": f"Mi local se llama {_TERM_B} y vende zapatillas de running."}])

    ctx_a = _wait_recall_contains(provider, a, "web", _TERM_A)
    ctx_b = _wait_recall_contains(provider, b, "web", _TERM_B)

    # Control positivo: cada emprendedor recupera SU propio dato (si esto falla, el assert de aislamiento
    # sería vacuo — pasaría igual con un recall siempre-vacío o una ingesta que nunca ocurrió).
    assert _TERM_A.lower() in ctx_a.lower(), f"A no recuperó su propio dato — ctx_a={ctx_a!r}"
    assert _TERM_B.lower() in ctx_b.lower(), f"B no recuperó su propio dato — ctx_b={ctx_b!r}"

    # ADVERSARIAL: A NUNCA ve el término de B, B NUNCA ve el de A (aislamiento cross-emprendedor real).
    assert _TERM_B.lower() not in ctx_a.lower(), f"LEAK: A vio el dato de B — ctx_a={ctx_a!r}"
    assert _TERM_A.lower() not in ctx_b.lower(), f"LEAK: B vio el dato de A — ctx_b={ctx_b!r}"
