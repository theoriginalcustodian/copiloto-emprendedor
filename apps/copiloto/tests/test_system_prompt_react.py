"""Test del SYSTEM_PROMPT_REACT (Task 13): precondición dura del spike 2 -- el prompt del motor ReAct
NO debe filtrar lenguaje de gate (confirm/pendiente/aprob/botón), porque contárselo al modelo rompe el
tool-calling nativo (0/3 empírico, ver plan). El gate vive en el sistema (executor), no en el prompt."""
import sys
from pathlib import Path


from system_prompt import SYSTEM_PROMPT_REACT  # noqa: E402


def test_react_prompt_has_no_gate_language():
    low = SYSTEM_PROMPT_REACT.lower()
    for forbidden in ("confirm", "pendiente", "aprob", "botón", "boton"):
        assert forbidden not in low, f"el prompt ReAct filtra lenguaje de gate: {forbidden}"


def test_react_prompt_instructs_chaining_and_no_json():
    low = SYSTEM_PROMPT_REACT.lower()
    assert "json" not in low                     # tool-calling nativo, no JSON-mode
    assert "encaden" in low or "varias" in low    # instruye tareas concatenadas


def test_react_prompt_has_scope_and_ask_guards():
    """Guardas de comportamiento (afinado 2026-07-05): (a) hacer SOLO lo pedido (anti sobre-actuación),
    (b) pedir el dato faltante en vez de inventarlo. NO son lenguaje de gate → no rompen el tool-calling
    (el test de arriba sigue garantizando que no filtra confirm/pendiente/aprob/botón)."""
    low = SYSTEM_PROMPT_REACT.lower()
    assert "solo lo que" in low                   # (a) anti sobre-actuación
    assert "falta un dato" in low and "pedí" in low   # (b) pedir el dato faltante, no inventar


def test_react_prompt_forbids_narrating_without_tool_call():
    """Complemento barato del fix narra-sin-hacer ([[copiloto-narra-la-accion-sin-ejecutarla]]): el prompt
    prohíbe afirmar una acción ejecutada sin el tool_call real de ESE turno. NO es lenguaje de gate (no
    menciona confirm/pendiente/aprob/botón — el test de arriba lo sigue garantizando)."""
    low = SYSTEM_PROMPT_REACT.lower()
    assert "ya hiciste algo" in low or "ya lo hice" in low
    assert "este turno" in low


def test_react_prompt_forbids_inventing_contacto():
    """Hallazgo 2026-08-03 (Hito P device): el LLM completaba email/teléfono de un cliente con un valor
    plausible aunque el emprendedor no lo hubiera dictado -- una validación de forma en la tool no puede
    distinguir un mail real de uno inventado con formato válido. Decisión de planificación: fix en el
    prompt, mismo criterio que "no inventes un dato que no tengas"."""
    low = SYSTEM_PROMPT_REACT.lower()
    assert "contacto" in low
    assert "email" in low and "teléfono" in low
    assert "inventad" in low or "dejalos vacíos" in low
