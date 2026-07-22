"""¿El perfil del negocio LLEGA de verdad al system prompt?

Se ejercita la activity real (`call_llm_tools`) con un provider falso que CAPTURA el system con el que
lo invocan. Eso es lo que se verifica: el string que recibe el modelo — no que la función devolvió
algo. Un test que sólo comprobara el valor de retorno pasaría igual si el bloque nunca se antepusiera.

No depende de cuota de LLM ni de red: por eso vive acá y no en el E2E.
"""
from __future__ import annotations

import pytest
from backend.agent.agent_activities import call_llm_tools
from backend.agent.agent_runtime import register_domain, reset_registry

from perfil_negocio_prompt import bloque_de_contexto

PROMPT_BASE = "PROMPT-BASE-DEL-COPILOTO"


class _LlmEspia:
    """Captura el `system` con el que se llama al modelo. Es el único punto donde se puede observar
    si el bloque del perfil llegó — el resto son intenciones."""

    def __init__(self) -> None:
        self.systems: list[str] = []

    def complete_tools(self, system, messages, tools, tool_choice="auto"):
        self.systems.append(system)
        return {"tool_calls": [], "content": "ok", "finish_reason": "stop",
                "model": "falso", "failed_over": False}


def _registrar(perfil_provider=None) -> _LlmEspia:
    reset_registry()
    espia = _LlmEspia()
    register_domain("dom-test", system_prompt=PROMPT_BASE, llm_provider=espia, dispatcher=None,
                    engine_mode="react", tool_schemas=[], tool_executor=lambda *a, **k: None,
                    perfil_provider=perfil_provider)
    return espia


@pytest.mark.asyncio
async def test_sin_perfil_provider_el_prompt_queda_BYTE_A_BYTE_igual():
    """El caso de TODOS los dominios que no tienen perfil (y de todo tenant que no entró a Ajustes):
    el prompt no puede cambiar ni un carácter respecto de antes de este frente."""
    espia = _registrar(perfil_provider=None)
    await call_llm_tools({"domain": "dom-test", "messages": [], "cliente_id": "cid-A"})
    assert espia.systems == [PROMPT_BASE]


@pytest.mark.asyncio
async def test_con_perfil_el_bloque_se_antepone_al_prompt():
    perfil = {"nombre_comercial": "Electricidad Pérez", "que_vende": "Instalaciones eléctricas",
              "a_quien": "ambos", "formalidad": "formal", "largo_respuesta": "breve",
              "nombre_copiloto": "Copi", "horario_atencion": "8 a 17"}
    espia = _registrar(perfil_provider=lambda cid: bloque_de_contexto(perfil))
    await call_llm_tools({"domain": "dom-test", "messages": [], "cliente_id": "cid-A"})
    system = espia.systems[0]
    assert PROMPT_BASE in system
    assert "Electricidad Pérez" in system
    assert "Copi" in system
    assert "Instalaciones eléctricas" in system


@pytest.mark.asyncio
async def test_el_perfil_va_ANTES_que_la_memoria_en_el_system():
    """🔴 El orden que preserva el prefijo de prompt-cache. Invertirlo no rompe nada visible —el
    modelo lee lo mismo— pero invalida el cache en cada turno, y eso sólo se ve en la factura."""
    espia = _registrar(perfil_provider=lambda cid: "BLOQUE-PERFIL")
    await call_llm_tools({"domain": "dom-test", "messages": [], "cliente_id": "cid-A",
                          "system_extra": "CONTEXTO-DE-MEMORIA"})
    system = espia.systems[0]
    assert system.index("BLOQUE-PERFIL") < system.index("CONTEXTO-DE-MEMORIA")


@pytest.mark.asyncio
async def test_sin_cliente_id_no_se_invoca_al_provider():
    """El `cliente_id` viaja en el payload desde el workflow. Si faltara (dominio viejo, llamada de
    otro camino), NO se puede adivinar de quién es el perfil: se omite, nunca se toma "alguno"."""
    llamadas = []

    def _provider(cid):
        llamadas.append(cid)
        return "NO-DEBERIA-APARECER"

    espia = _registrar(perfil_provider=_provider)
    await call_llm_tools({"domain": "dom-test", "messages": []})
    assert llamadas == []
    assert espia.systems == [PROMPT_BASE]


@pytest.mark.asyncio
async def test_si_el_provider_EXPLOTA_el_turno_sigue():
    """El perfil es contexto, no correctitud: una caída de la base no puede dejar al emprendedor sin
    poder chatear. Degrada al prompt de siempre."""
    def _explota(cid):
        raise RuntimeError("la base se cayó")

    espia = _registrar(perfil_provider=_explota)
    r = await call_llm_tools({"domain": "dom-test", "messages": [], "cliente_id": "cid-A",
                              "system_extra": "CONTEXTO-DE-MEMORIA"})
    assert r["content"] == "ok"
    assert espia.systems[0] == PROMPT_BASE + "\n\n" + "CONTEXTO-DE-MEMORIA"


@pytest.mark.asyncio
async def test_perfil_vacio_no_deja_separadores_colgando():
    """Un tenant con la fila creada pero todos los campos en blanco devuelve `""`. El system no puede
    quedar con saltos de línea sueltos que corran el prefijo cacheable sin aportar nada."""
    espia = _registrar(perfil_provider=lambda cid: "")
    await call_llm_tools({"domain": "dom-test", "messages": [], "cliente_id": "cid-A",
                          "system_extra": "CONTEXTO-DE-MEMORIA"})
    assert espia.systems[0] == PROMPT_BASE + "\n\n" + "CONTEXTO-DE-MEMORIA"


@pytest.mark.asyncio
async def test_dos_tenants_reciben_SU_perfil_y_no_el_del_otro():
    """Multitenant: el provider se invoca con el `cliente_id` del payload, que sale del workflow de
    ESA conversación. Si alguien lo cacheara a nivel proceso, este test lo cazaría."""
    perfiles = {"cid-A": "PERFIL-DE-A", "cid-B": "PERFIL-DE-B"}
    espia = _registrar(perfil_provider=lambda cid: perfiles.get(cid, ""))
    await call_llm_tools({"domain": "dom-test", "messages": [], "cliente_id": "cid-A"})
    await call_llm_tools({"domain": "dom-test", "messages": [], "cliente_id": "cid-B"})
    assert "PERFIL-DE-A" in espia.systems[0] and "PERFIL-DE-B" not in espia.systems[0]
    assert "PERFIL-DE-B" in espia.systems[1] and "PERFIL-DE-A" not in espia.systems[1]
