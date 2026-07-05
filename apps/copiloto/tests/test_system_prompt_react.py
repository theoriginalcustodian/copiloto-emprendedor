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
