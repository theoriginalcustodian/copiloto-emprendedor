"""Dictado desde una función por el chat (contrato 2026-10-13): `POST /chat` con `kind="dictado:<destino>"`.

Qué se prueba, y por qué cada bloque existe:

1. UNA whitelist: `/transcribir`, el parser de `kind` y la activity leen la MISMA tabla (`dictado_destinos`).
2. El rechazo: un destino fuera de la lista es 422 y NO llega al workflow (ni como válido ni por el flujo
   genérico). Sin este control, el adapter web degradaba cualquier `kind` desconocido a «text» en silencio.
3. El mecanismo: el destino viaja namespaceado en el `channel_ref` y la activity angosta el turno a la tool
   del destino (primer paso `required`, tras el resultado `none`).
4. El control positivo de (3): una sesión NORMAL conserva el catálogo completo y `auto`.

El camino completo con el workflow real vive en `test_dictado_e2e.py` (requiere el test-server de Temporal).
"""
from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import dictado_destinos as DD
import tool_catalog
import web as web_module
from backend.agent import agent_activities as A
from backend.agent.agent_runtime import register_domain, reset_registry
from test_audio import _WEBM_HEADER, _mp_fernet_key_env  # noqa: F401 — fixture autouse
from test_audio import _build_app as _build_audio_app
from test_audio import _require_tenant_fixed as _tenant_audio
from test_web_app import _build_app, _require_tenant_fixed

DESTINOS = ["gasto", "ingreso", "presupuesto", "cliente"]


# ── 1. una sola whitelist ────────────────────────────────────────────────────────────────────────

def test_la_whitelist_de_transcribir_es_la_misma_definicion_que_la_del_parser_de_kind():
    assert web_module.CONTEXTOS_TRANSCRIBIR is DD.CONTEXTOS_TRANSCRIBIR
    # el parser acepta EXACTAMENTE los de la lista, ni uno más ni uno menos (candidatos incluye intrusos)
    candidatos = set(DESTINOS) | {"factura", "mi-dia", "chat", "soporte", "gastos", ""}
    aceptados = set()
    for c in candidatos:
        try:
            if DD.destino_de_kind(f"dictado:{c}") == c:
                aceptados.add(c)
        except DD.DestinoDictadoInvalido:
            pass
    assert aceptados == set(DD.CONTEXTOS_TRANSCRIBIR) == set(DESTINOS)


def test_web_py_no_redefine_la_lista_con_un_literal():
    src = (Path(web_module.__file__)).read_text(encoding="utf-8")
    assert 'frozenset({"gasto"' not in src and '"presupuesto", "cliente"' not in src, \
        "web.py volvió a tener su propia lista de destinos de dictado"


@pytest.mark.parametrize("destino", DESTINOS)
def test_cada_destino_resuelve_una_tool_real_del_catalogo_que_no_escribe(destino):
    tool = DD.DESTINOS_DICTADO[destino].tool
    nombres = {t["function"]["name"] for t in tool_catalog.build_tool_catalog()}
    assert tool in nombres
    assert tool not in tool_catalog.WRITE_TOOLS, "un dictado crudo no puede abrir un write"


def test_factura_no_esta_y_no_se_resuelve():
    assert "factura" not in DD.CONTEXTOS_TRANSCRIBIR
    with pytest.raises(DD.DestinoDictadoInvalido):
        DD.destino_de_kind("dictado:factura")


@pytest.mark.parametrize("kind", ["text", "callback", "needs_stt", None, ""])
def test_un_kind_que_no_es_dictado_no_es_un_dictado(kind):
    assert DD.destino_de_kind(kind) is None


def test_session_de_dictado_es_idempotente():
    s = DD.session_de_dictado("gasto", "abc")
    assert s == "dictado:gasto:abc"
    assert DD.session_de_dictado("gasto", s) == s
    assert DD.destino_de_session(s) == "gasto"
    assert DD.destino_de_session("abc") is None


# ── 2. el front-door: rechazo + mecanismo ────────────────────────────────────────────────────────

@pytest.fixture
def rutas(monkeypatch):
    """Registra cada llamada a `route_inbound` (lo que el front-door le entrega al workflow)."""
    vistos: list[dict] = []

    async def _fake(client, *, adapter, cliente_id, domain, task_queue, raw_update, extra_config=None):
        vistos.append({"raw_update": raw_update, "extra_config": extra_config, "cliente_id": cliente_id})
        msg = adapter.normalize_inbound(raw_update)
        return None if msg is None else f"conv-web-{cliente_id}-{msg.channel_ref}"

    monkeypatch.setattr(web_module, "route_inbound", _fake)
    return vistos


def _chat(session_id="s1", kind="text", cid="cid-A", text="gasté cinco mil de nafta"):
    app, _ = _build_app(require_tenant=_require_tenant_fixed(cid))
    return TestClient(app).post("/chat", json={"session_id": session_id, "text": text, "kind": kind})


@pytest.mark.parametrize("destino", DESTINOS)
def test_el_dictado_de_cada_destino_va_namespaceado_y_con_kind_text(rutas, destino):
    r = _chat(kind=f"dictado:{destino}")
    assert r.status_code == 200
    esperado = f"dictado:{destino}:s1"
    body = r.json()
    assert body["accepted"] is True and body["session_id"] == esperado
    assert body["wf_id"] == f"conv-web-cid-A-{esperado}"
    assert len(rutas) == 1
    assert rutas[0]["raw_update"] == {"session_id": esperado, "text": "gasté cinco mil de nafta", "kind": "text"}
    assert rutas[0]["extra_config"]["idle_timeout_seconds"] == DD.IDLE_TIMEOUT_DICTADO_S


@pytest.mark.parametrize("kind", ["dictado:factura", "dictado:", "dictado:GASTO", "dictado:gasto:x",
                                  "dictado:../etc", "dictado: gasto"])
def test_ADVERSARIAL_un_destino_fuera_de_la_lista_es_422_y_no_llega_al_workflow(rutas, kind):
    r = _chat(kind=kind)
    assert r.status_code == 422, r.text
    assert rutas == [], "el rechazo no puede despachar nada (ni como válido ni por el flujo genérico)"


def test_CONTROL_el_chat_normal_no_cambia(rutas):
    r = _chat(session_id="s1", kind="text")
    assert r.status_code == 200
    assert r.json() == {"wf_id": "conv-web-cid-A-s1", "accepted": True, "session_id": "s1"}
    assert rutas[0]["raw_update"] == {"session_id": "s1", "text": "gasté cinco mil de nafta", "kind": "text"}
    assert rutas[0]["extra_config"]["idle_timeout_seconds"] != DD.IDLE_TIMEOUT_DICTADO_S


def test_ADVERSARIAL_un_chat_normal_no_puede_abrir_el_scope_de_dictado_por_el_session_id(rutas):
    """El namespace angosta las tools del turno: sólo lo abre `kind=dictado:*`."""
    for kind in ("text", "callback"):
        r = _chat(session_id="dictado:gasto:s1", kind=kind)
        assert r.status_code == 422
    assert rutas == []


def test_ADVERSARIAL_un_dictado_no_re_etiqueta_la_sesion_de_otro_destino(rutas):
    r = _chat(session_id="dictado:ingreso:s1", kind="dictado:gasto")
    assert r.status_code == 422 and rutas == []


def test_el_cliente_puede_reenviar_el_session_id_efectivo_sin_que_se_duplique_el_prefijo(rutas):
    r = _chat(session_id="dictado:gasto:s1", kind="dictado:gasto")
    assert r.status_code == 200 and r.json()["session_id"] == "dictado:gasto:s1"


def test_chat_audio_tampoco_abre_el_scope_por_el_session_id(rutas):
    app = _build_audio_app(require_tenant=_tenant_audio("cid-A"), transcribe=lambda b, ct: "hola")
    r = TestClient(app).post("/chat/audio", data={"session_id": "dictado:gasto:x"},
                             files={"audio": ("c.webm", _WEBM_HEADER + b"fake", "audio/webm")})
    assert r.status_code == 422 and rutas == []


# ── 3. la activity: el scope angosta el turno ────────────────────────────────────────────────────

class _Llm:
    def __init__(self):
        self.llamadas: list[dict] = []

    def complete_tools(self, system, messages, tools, *, tool_choice="auto", parallel_tool_calls=False):
        self.llamadas.append({"system": system, "tools": [t["function"]["name"] for t in tools],
                              "tool_choice": tool_choice})
        return {"tool_calls": [], "content": "ok", "finish_reason": "stop", "model": "m",
                "failed_over": False, "usage": {}}


def _registrar(llm, *, scope=DD.scope_de_sesion):
    reset_registry()
    register_domain("d", system_prompt="SYS", llm_provider=llm, dispatcher=lambda *a: None,
                    tool_schemas=tool_catalog.build_tool_catalog(), tool_executor=None,
                    engine_mode="react", session_scope=scope)


def _turno(session_id, *, ultimo="user"):
    msgs = [{"role": "user", "content": "gasté cinco mil"}]
    if ultimo == "tool":
        msgs += [{"role": "assistant", "content": None, "tool_calls": [{"id": "c", "type": "function",
                  "function": {"name": "registrar_gasto", "arguments": "{}"}}]},
                 {"role": "tool", "tool_call_id": "c", "content": "{}"}]
    return {"domain": "d", "messages": msgs, "tool_choice": "auto", "session_id": session_id}


@pytest.mark.parametrize("destino", DESTINOS)
def test_el_primer_paso_del_dictado_ofrece_SOLO_la_tool_del_destino_y_la_exige(destino):
    llm = _Llm()
    _registrar(llm)
    asyncio.run(A.call_llm_tools(_turno(f"dictado:{destino}:s1")))
    (ll,) = llm.llamadas
    assert ll["tools"] == [DD.DESTINOS_DICTADO[destino].tool]
    assert ll["tool_choice"] == "required"
    assert "NO preguntes" in ll["system"] and DD.DESTINOS_DICTADO[destino].tool in ll["system"]


def test_tras_el_resultado_de_la_tool_el_turno_cierra_con_texto_no_repite_la_tool():
    llm = _Llm()
    _registrar(llm)
    asyncio.run(A.call_llm_tools(_turno("dictado:gasto:s1", ultimo="tool")))
    assert llm.llamadas[0]["tool_choice"] == "none"


def test_CONTROL_una_sesion_normal_conserva_el_catalogo_completo_y_auto():
    llm = _Llm()
    _registrar(llm)
    asyncio.run(A.call_llm_tools(_turno("s1")))
    (ll,) = llm.llamadas
    assert ll["tool_choice"] == "auto"
    assert set(ll["tools"]) == {t["function"]["name"] for t in tool_catalog.build_tool_catalog()}
    assert "DICTADO DESDE" not in ll["system"]


def test_ADVERSARIAL_un_destino_fuera_de_la_lista_en_el_namespace_no_cae_al_catalogo_completo():
    """Defensa en profundidad (el front-door ya lo rechaza): ni LLM ni catálogo completo."""
    llm = _Llm()
    _registrar(llm)
    out = asyncio.run(A.call_llm_tools(_turno("dictado:factura:s1")))
    assert llm.llamadas == []
    assert out["tool_calls"] == [] and out["content"]


def test_una_tool_del_scope_que_dejo_de_existir_falla_cerrado_y_no_cae_al_catalogo():
    llm = _Llm()
    _registrar(llm, scope=lambda sid: {"tool_names": ["tool_que_ya_no_existe"], "system_extra": "x"})
    out = asyncio.run(A.call_llm_tools(_turno("dictado:gasto:s1")))
    assert llm.llamadas == [] and out["tool_calls"] == []
