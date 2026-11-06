"""RAG al chat del emprendedor (contrato 2026-11-05): `consultar_base_de_conocimiento` en el catálogo del
dominio `emprendedor` Y ejecutable desde su `tool_executor`.

Camino de PRODUCCIÓN, no un executor armado a mano: `worker_b.build_worker_config(env, ...)` registra el
dominio y el test lo lee con `get_domain("emprendedor")` -- lo mismo que lee el motor en cada activity.
Lo único falso es el HTTP del orquestador (`OrquestadorRagClient.answer`); `from_env` y la factory son
los reales, así que la ausencia de `RAG_ORQUESTADOR_*` en el env también se ejercita de verdad.
Corre sin Postgres: `conn_factory` nunca se invoca."""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from backend.agent.agent_runtime import get_domain, reset_registry
from clients.agent.providers.crypto import FernetCrypto

import tool_catalog
import worker_b
from orquestador_rag_client import NAMESPACE_HOWTO_DEFAULT, OrquestadorRagClient, RagRespuesta
from soporte_agent_tools import CONSULTAR_KB_SCHEMA

NOMBRE = "consultar_base_de_conocimiento"
ENV_RAG = {"RAG_ORQUESTADOR_BASE_URL": "http://rag.invalid", "RAG_ORQUESTADOR_TOKEN": "tok-de-test"}
CTX = SimpleNamespace(cliente_id="cliente-A")


class _Conn:
    def cursor(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, *a, **k):
        pass

    def fetchone(self):
        return None


@pytest.fixture(autouse=True)
def _fernet(monkeypatch):
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


@pytest.fixture
def llamadas(monkeypatch):
    """Registra lo que llega al RAG y devuelve la respuesta que el test programe en `.respuesta`."""
    rec = SimpleNamespace(visto=[], respuesta=None, namespaces=[])

    def _answer(self, query, *, cliente_id=None):
        rec.visto.append((query, cliente_id))
        rec.namespaces.append(self._namespace)
        return rec.respuesta

    monkeypatch.setattr(OrquestadorRagClient, "answer", _answer)
    return rec


def _dominio(env):
    reset_registry()
    worker_b.build_worker_config(env, lambda: _Conn())
    return get_domain("emprendedor")


def _usar(dom, pregunta="¿cómo cargo un gasto?"):
    return dom["tool_executor"](NOMBRE, {"pregunta": pregunta}, CTX, confirmed=False, idem_key="k1")


# ── catálogo / índice / clasificación (DoD 1 y 6) ─────────────────────────────────────────────────
def test_la_tool_esta_en_el_catalogo_una_sola_vez_y_con_los_mismos_parametros_que_soporte():
    nombres = [s["function"]["name"] for s in tool_catalog.build_tool_catalog()]
    assert nombres.count(NOMBRE) == 1
    schema = next(s for s in tool_catalog.build_tool_catalog() if s["function"]["name"] == NOMBRE)
    assert schema["function"]["parameters"] == CONSULTAR_KB_SCHEMA["function"]["parameters"]


def test_la_descripcion_del_chat_se_acota_a_como_usar_la_app_y_no_dice_SIEMPRE():
    # La de soporte dice «SIEMPRE ... antes de responder cualquier pregunta»: en un chat que opera
    # dispararía en cada turno. Si alguien la vuelve a pegar tal cual, esto se pone rojo.
    d = tool_catalog.CONSULTAR_KB_EMPRENDEDOR_SCHEMA["function"]["description"]
    assert "SIEMPRE" not in d and "CÓMO USAR LA APP" in d
    assert "NO la uses para" in d


def test_es_read_puro_no_va_en_WRITE_TOOLS_ni_pide_confirmacion():
    assert NOMBRE in tool_catalog.TOOL_INDEX
    assert NOMBRE not in tool_catalog.WRITE_TOOLS


# ── composition root (DoD 2) ──────────────────────────────────────────────────────────────────────
def test_el_dominio_emprendedor_registrado_expone_la_tool_y_el_executor_la_ejecuta(llamadas):
    dom = _dominio(ENV_RAG)
    assert NOMBRE in [s["function"]["name"] for s in dom["tool_schemas"]]
    llamadas.respuesta = RagRespuesta(outcome="answered", answer="Andá a Gastos y tocá +.",
                                      retrieved_count=3, latency_ms=120)
    r = _usar(dom)
    assert llamadas.visto, "la pregunta no llegó al cliente del RAG: el executor no está enchufado"
    assert r.status == "ok" and r.is_write is False
    assert r.observation["outcome"] == "answered" and r.observation["answer"] == "Andá a Gastos y tocá +."


def test_la_pregunta_sale_tal_cual_y_sin_datos_del_tenant(llamadas):
    # MAESTRO: «los datos del negocio NO van al RAG jamás» -> cliente_id=None, query sin enriquecer.
    dom = _dominio(ENV_RAG)
    llamadas.respuesta = RagRespuesta(outcome="answered", answer="x")
    _usar(dom, "¿dónde veo mis facturas?")
    assert llamadas.visto == [("¿dónde veo mis facturas?", None)]
    assert llamadas.namespaces == [NAMESPACE_HOWTO_DEFAULT]


# ── los tres outcomes (DoD 3) ─────────────────────────────────────────────────────────────────────
def test_refused_no_trae_answer_y_answered_si_control_positivo(llamadas):
    dom = _dominio(ENV_RAG)
    llamadas.respuesta = RagRespuesta(outcome="answered", answer="una respuesta")
    assert "answer" in _usar(dom).observation          # control positivo: el instrumento SÍ ve un answer
    llamadas.respuesta = RagRespuesta(outcome="refused", refusal_reason="insufficient_context")
    r = _usar(dom, "¿cuál es la capital de Francia?")
    assert r.status == "ok"
    assert r.observation["outcome"] == "refused" and "answer" not in r.observation
    assert r.observation["refusal_reason"] == "insufficient_context"


def test_unavailable_del_servicio_trae_reason_sin_lanzar(llamadas):
    dom = _dominio(ENV_RAG)
    llamadas.respuesta = RagRespuesta(outcome="unavailable", reason="timeout_o_conexion_caida")
    r = _usar(dom)
    assert r.status == "ok"
    assert r.observation == {"outcome": "unavailable", "reason": "timeout_o_conexion_caida"}


def test_sin_RAG_ORQUESTADOR_en_el_env_degrada_a_unavailable_no_a_excepcion(llamadas):
    dom = _dominio({})
    r = _usar(dom)
    assert r.observation == {"outcome": "unavailable", "reason": "orquestador_no_configurado"}
    assert llamadas.visto == []                         # y no intentó hablar con nadie


def test_el_namespace_se_puede_pisar_por_env(llamadas):
    dom = _dominio({**ENV_RAG, "RAG_ORQUESTADOR_NAMESPACE": "otro-corpus"})
    llamadas.respuesta = RagRespuesta(outcome="answered", answer="x")
    _usar(dom)
    assert llamadas.namespaces == ["otro-corpus"]


def test_pregunta_vacia_es_error_de_negocio(llamadas):
    dom = _dominio(ENV_RAG)
    r = dom["tool_executor"](NOMBRE, {"pregunta": "  "}, CTX, confirmed=False, idem_key="k2")
    assert r.status == "error" and llamadas.visto == []
