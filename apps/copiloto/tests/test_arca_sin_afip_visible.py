"""BL-X5 (mitad backend): ARCA es el nombre vigente; «AFIP» suelta NO puede aparecer en lo que ve el usuario.

Alcance: strings de código (no docstrings) de `apps/copiloto/*.py` + la KB de usuario. Los identificadores,
docstrings, comentarios y tests NO cuentan (es rename de texto visible, no de nombres internos).
Excepciones documentadas:
- `INTERNOS`: prompts/gates para el auditor y la autosanación (los lee un LLM interno o el operador, no el emprendedor).
- «ex AFIP» / «antes AFIP»: el prompt del agente y la KB conservan la equivalencia para que entienda a quien
  todavía dice «AFIP» (el usuario puede escribirlo; el agente tiene que seguir entendiéndolo).
Un test que sólo mira «0 hits» pasaría también si no leyera nada: `_hits` se prueba con un control positivo.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1]
KB = APP.parents[1] / "docs" / "copiloto-emprendedor" / "kb-usuario"
INTERNOS = {"auditor_parches.py", "autosanacion_gates.py"}
_AFIP = re.compile(r"\bAFIP\b")
_EQUIV = re.compile(r"\b(?:ex|antes)[ -]AFIP\b", re.IGNORECASE)


def _visible(texto: str) -> bool:
    return bool(_AFIP.search(_EQUIV.sub("", texto)))


def _hits(fuente: str) -> list[tuple[int, str]]:
    """Strings no-docstring con «AFIP» suelta en una fuente Python."""
    tree = ast.parse(fuente)
    docs = set()
    for n in ast.walk(tree):
        if isinstance(n, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and n.body:
            b = n.body[0]
            if isinstance(b, ast.Expr) and isinstance(b.value, ast.Constant) and isinstance(b.value.value, str):
                docs.add(id(b.value))
    return [(n.lineno, " ".join(n.value.split())[:80]) for n in ast.walk(tree)
            if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in docs and _visible(n.value)]


def test_control_el_detector_ve_un_AFIP_visible_e_ignora_docstring_y_equivalencia():
    assert _hits('x = "Tu certificado de AFIP venció"')                      # positivo: lo caza
    assert not _hits('def f():\n    """habla de AFIP"""\n    return 1')      # docstring: no cuenta
    assert not _hits('x = "una factura electrónica ARCA (ex AFIP)"')         # equivalencia: permitida
    assert _visible("ante AFIP") and not _visible("ante ARCA")


def test_ningun_string_visible_de_apps_copiloto_dice_AFIP():
    malos = []
    for f in sorted(APP.glob("*.py")):
        if f.name in INTERNOS or f.name.startswith("test_"):
            continue
        malos += [f"{f.name}:{ln}: {t}" for ln, t in _hits(f.read_text(encoding="utf-8"))]
    assert not malos, "«AFIP» visible (usar «ARCA»):\n" + "\n".join(malos)


def test_la_kb_de_usuario_no_dice_AFIP_suelta():
    if not KB.is_dir():   # el stage del VPS sólo sincroniza código; en CI (checkout completo) SÍ corre
        pytest.skip("kb-usuario no está en este árbol (stage del VPS): lo cubre el checkout completo de CI")
    assert list(KB.glob("*.md")), "kb-usuario vacía: el test estaría verde por ausencia"
    malos = [f"{f.name}:{i}" for f in sorted(KB.glob("*.md"))
             for i, l in enumerate(f.read_text(encoding="utf-8").splitlines(), 1) if _visible(l)]
    assert not malos, "«AFIP» suelta en la KB (usar «ARCA»): " + ", ".join(malos)


def test_el_prompt_del_agente_conserva_la_equivalencia_para_entender_AFIP():
    from tool_catalog import EMITIR_FACTURA_SCHEMA
    d = EMITIR_FACTURA_SCHEMA["function"]["description"]
    assert "ARCA" in d and "ex AFIP" in d
