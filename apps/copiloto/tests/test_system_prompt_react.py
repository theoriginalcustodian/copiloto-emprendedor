"""Test del SYSTEM_PROMPT_REACT (Task 13): precondición dura del spike 2 -- el prompt del motor ReAct
NO debe filtrar lenguaje de gate (confirm/pendiente/aprob/botón), porque contárselo al modelo rompe el
tool-calling nativo (0/3 empírico, ver plan). El gate vive en el sistema (executor), no en el prompt."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

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
