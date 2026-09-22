"""H-A3-3 (fila 4), hallazgo de planificación en peer review sobre #628: `_TEXTO_CALLBACK_SIN_GATE`
en `scripts/e2e_g6_durabilidad_worker_restart.py` es una copia a mano del literal que
`conversation_workflow.py` manda en la rama `kind == "callback" and not parked` -- sin invalidación
si alguien cambia el texto del workflow, el instrumento de H-A3-8 vuelve a dar verde falso (memoria
`una-cifra-en-un-comentario-es-un-cache-sin-invalidacion`). Este test lee los DOS archivos fuente
(no importa el script -- vive fuera del árbol de import de pytest) y falla si divergen.
"""
from __future__ import annotations

import re
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCRIPT = _REPO_ROOT / "scripts" / "e2e_g6_durabilidad_worker_restart.py"
_WORKFLOW = _REPO_ROOT / "motor" / "backend" / "agent" / "conversation_workflow.py"


def _literal_del_instrumento() -> str:
    texto = _SCRIPT.read_text(encoding="utf-8")
    m = re.search(r'_TEXTO_CALLBACK_SIN_GATE\s*=\s*"([^"]*)"', texto)
    assert m, "no se encontró _TEXTO_CALLBACK_SIN_GATE en el script -- ¿se renombró la constante?"
    return m.group(1)


def _rama_callback_sin_gate() -> str:
    texto = _WORKFLOW.read_text(encoding="utf-8")
    m = re.search(r'if kind == "callback" and not parked:\n(.*?\n)(?=\s*# ──|\s*if )', texto, re.DOTALL)
    assert m, ('no se encontró la rama `kind == "callback" and not parked` en conversation_workflow.py '
               '-- ¿se movió o renombró?')
    return m.group(1)


def test_el_literal_del_instrumento_sigue_calzando_con_la_rama_callback_sin_gate():
    """Control positivo: hoy calzan. Si alguien cambia el texto que manda el workflow en esa rama
    sin tocar el script, este assert se rompe -- el punto del test."""
    assert _literal_del_instrumento() in _rama_callback_sin_gate()


def test_control_negativo_un_literal_que_el_workflow_nunca_manda_no_calza():
    """El test SÍ discrimina: un literal inventado no debe encontrarse en la rama real."""
    assert "un texto que el workflow nunca manda" not in _rama_callback_sin_gate()
