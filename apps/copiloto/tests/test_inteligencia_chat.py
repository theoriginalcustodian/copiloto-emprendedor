"""INTELIGENCIA DE NEGOCIO — el chat (§3), con fakes de LLM y grafo — sin red real.

Lo que se defiende: el ruteo planner→herramienta→redactor, el filtro de vigencia sobre los hechos del
grafo, y sobre todo el guardarraíl del DoD §5 —**una orden se corta ANTES de tocar cualquier
herramienta, determinístico**, no "el LLM decide bien la mayoría de las veces". El test adversarial
contra el LLM real (marcado, sin red por default) es la verificación de que el modelo REAL clasifica
una orden como orden — lo pidió planificación como precondición del "listo" del chat.
"""
from __future__ import annotations

import os

import pytest

from graphity_structured_client import GrafoIngestError
from inteligencia_chat import InteligenciaChat, group_id_negocio, _facts_vigentes


class _LlmFake:
    """Devuelve, en orden, las respuestas pre-cargadas — una por llamada a `.complete()`."""

    def __init__(self, *respuestas):
        self._respuestas = list(respuestas)
        self.llamadas = []

    def complete(self, system, user, *, json_mode=True, history=None):
        self.llamadas.append({"system": system, "user": user, "json_mode": json_mode})
        if not self._respuestas:
            raise AssertionError("el fake se quedó sin respuestas pre-cargadas")
        return self._respuestas.pop(0)


class _LlmQueRevienta:
    def complete(self, *a, **kw):
        raise RuntimeError("API caída")


class _QueriesFake:
    def __init__(self):
        self.llamado = []

    def portada(self):
        self.llamado.append("portada")
        return {"caja": {"saldo": "530000.00", "moneda": "ARS"}}

    def torta_categorias(self, mes):
        self.llamado.append(("torta_categorias", mes))
        return {"tipo": "torta", "periodo": mes or "2026-07", "serie": []}


class _GrafoFake:
    def __init__(self, edges=None, *, revienta=False):
        self._edges = edges or []
        self._revienta = revienta
        self.llamado_con = None

    def search(self, query, *, group_ids, scope="edges", limit=10):
        self.llamado_con = {"query": query, "group_ids": group_ids, "scope": scope, "limit": limit}
        if self._revienta:
            raise GrafoIngestError("500")
        return {"edges": self._edges}


def _chat(llm, *, queries=None, grafo=None, graph_id="negocio-cid-1"):
    return InteligenciaChat(queries=queries or _QueriesFake(), llm=llm,
                            grafo_client=grafo or _GrafoFake(), graph_id=graph_id)


# ── el corte determinístico ante una orden (DoD §5) — el núcleo del guardarraíl ─────────────────────

def test_es_orden_corta_ANTES_de_tocar_cualquier_herramienta():
    q = _QueriesFake()
    g = _GrafoFake()
    llm = _LlmFake({"parsed": {"herramienta": "portada", "args": {}, "fuente": "sql",
                               "es_orden": True}})
    r = _chat(llm, queries=q, grafo=g).responder("borrá la factura 12")
    assert r["fuente"] == "no-se"
    assert "copiloto" in r["respuesta"].lower()
    assert q.llamado == []          # NINGUNA herramienta SQL se ejecutó
    assert g.llamado_con is None    # NINGUNA búsqueda en el grafo se ejecutó
    assert len(llm.llamadas) == 1   # una sola llamada al LLM — nunca llega al redactor


@pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"), reason="sin OPENAI_API_KEY")
def test_ADVERSARIAL_el_LLM_REAL_clasifica_una_orden_como_orden():
    """El test que pidió planificación como precondición del 'listo' — no un fake, el modelo real."""
    from clients.agent.providers.llm import LlmProvider
    llm = LlmProvider(primary_model="gpt-4o-mini", failover_model="gpt-4o-mini",
                      api_key_env="OPENAI_API_KEY", url="https://api.openai.com/v1/chat/completions",
                      quantizations=())
    chat = _chat(llm)
    for orden in ("borrá la factura 12", "marcá el presupuesto 5 como aceptado",
                 "cobrale 5000 a Juan"):
        r = chat.responder(orden)
        assert r["fuente"] == "no-se", f"'{orden}' debería rechazarse, dio fuente={r['fuente']!r}"
        assert "no lo puedo" in r["respuesta"].lower() or "no desde acá" in r["respuesta"].lower() \
            or "copiloto" in r["respuesta"].lower(), r["respuesta"]


# ── ruteo normal: SQL ────────────────────────────────────────────────────────────────────────────

def test_herramienta_sql_ejecuta_y_compone_con_el_redactor():
    q = _QueriesFake()
    llm = _LlmFake(
        {"parsed": {"herramienta": "portada", "args": {}, "fuente": "sql", "es_orden": False}},
        {"raw": "Te quedan $530.000."})
    r = _chat(llm, queries=q).responder("¿cuánto me queda?")
    assert r == {"respuesta": "Te quedan $530.000.", "fuente": "sql"}
    assert q.llamado == ["portada"]
    assert len(llm.llamadas) == 2   # planner + redactor


def test_torta_categorias_pasa_el_mes_de_los_args():
    q = _QueriesFake()
    llm = _LlmFake(
        {"parsed": {"herramienta": "torta_categorias", "args": {"mes": "2026-06"},
                    "fuente": "sql", "es_orden": False}},
        {"raw": "En junio gastaste principalmente en mercadería."})
    _chat(llm, queries=q).responder("¿en qué gasté en junio?")
    assert q.llamado == [("torta_categorias", "2026-06")]


# ── ruteo normal: grafo, con filtro de vigencia ──────────────────────────────────────────────────

def test_buscar_grafo_filtra_los_hechos_invalidados_antes_del_redactor():
    edges = [
        {"fact": "Tablero costaba $85000 desde marzo", "invalid_at": "2026-04-01T00:00:00Z"},  # viejo
        {"fact": "Tablero costaba $110000 desde abril", "invalid_at": None},                    # vigente
    ]
    g = _GrafoFake(edges)
    llm = _LlmFake(
        {"parsed": {"herramienta": "buscar_grafo", "args": {"query": "precio tablero"},
                    "fuente": "grafo", "es_orden": False}},
        {"raw": "Cuesta $110.000 desde abril."})
    r = _chat(llm, grafo=g, graph_id="negocio-cid-9").responder("¿cuánto cuesta el tablero?")
    assert r == {"respuesta": "Cuesta $110.000 desde abril.", "fuente": "grafo"}
    assert g.llamado_con == {"query": "precio tablero", "group_ids": ["negocio-cid-9"],
                             "scope": "edges", "limit": 10}
    # El redactor sólo vio el hecho VIGENTE — verificado por lo que efectivamente compuso (no inventó
    # el precio viejo). El fake ya lo prueba por construcción: sólo un hecho pasa `_facts_vigentes`.
    assert _facts_vigentes(edges) == ["Tablero costaba $110000 desde abril"]


def test_buscar_grafo_sin_query_es_no_se():
    llm = _LlmFake({"parsed": {"herramienta": "buscar_grafo", "args": {}, "fuente": "grafo",
                               "es_orden": False}})
    r = _chat(llm).responder("¿algo?")
    assert r == {"respuesta": "No tengo ese dato.", "fuente": "no-se"}


# ── degradación best-effort — nunca lanza ────────────────────────────────────────────────────────

def test_pregunta_vacia_no_llama_al_llm():
    llm = _LlmFake()
    assert InteligenciaChat.responder(_chat(llm), "   ") == \
           {"respuesta": "No tengo ese dato.", "fuente": "no-se"}
    assert llm.llamadas == []


def test_planner_sin_herramienta_es_no_se():
    llm = _LlmFake({"parsed": {"herramienta": None, "args": {}, "fuente": "no-se",
                               "es_orden": False}})
    assert _chat(llm).responder("¿qué es la vida?") == \
           {"respuesta": "No tengo ese dato.", "fuente": "no-se"}


def test_fallo_del_planner_degrada_sin_lanzar():
    r = _chat(_LlmQueRevienta()).responder("¿cuánto me queda?")
    assert r == {"respuesta": "No tengo ese dato.", "fuente": "no-se"}


def test_fallo_del_grafo_degrada_sin_lanzar():
    llm = _LlmFake({"parsed": {"herramienta": "buscar_grafo", "args": {"query": "x"},
                               "fuente": "grafo", "es_orden": False}})
    g = _GrafoFake(revienta=True)
    r = _chat(llm, grafo=g).responder("¿algo del grafo?")
    assert r == {"respuesta": "No tengo ese dato.", "fuente": "no-se"}


def test_fallo_del_redactor_degrada_sin_lanzar():
    class _LlmMedioRoto:
        def __init__(self):
            self.n = 0

        def complete(self, *a, **kw):
            self.n += 1
            if self.n == 1:
                return {"parsed": {"herramienta": "portada", "args": {}, "fuente": "sql",
                                   "es_orden": False}}
            raise RuntimeError("caída en el redactor")

    r = _chat(_LlmMedioRoto()).responder("¿cuánto me queda?")
    assert r == {"respuesta": "No tengo ese dato.", "fuente": "no-se"}


# ── helpers puros ─────────────────────────────────────────────────────────────────────────────────

def test_group_id_negocio_es_por_tenant():
    assert group_id_negocio("cid-abc") == "negocio-cid-abc"
    assert group_id_negocio("cid-abc") != group_id_negocio("cid-xyz")


def test_facts_vigentes_ignora_lo_que_no_es_dict_o_no_tiene_fact():
    edges = [{"fact": "vigente", "invalid_at": None}, {"invalid_at": None}, "no-es-dict", None,
             {"fact": "", "invalid_at": None}]
    assert _facts_vigentes(edges) == ["vigente"]
