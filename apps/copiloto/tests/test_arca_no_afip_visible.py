"""Gate BL-X5 (DA-11, mitad backend): «AFIP» ya no existe como nombre para el usuario -- es «ARCA»
(AFIP se renombró por ley). Mirror de `apps/copiloto-web/src/arcaNoAfipVisible.test.ts`: barre TODOS
los string literals de `apps/copiloto` (excepto `tests/`) que NO son docstrings, buscando la palabra
SUELTA `AFIP`/`Afip` (identificadores como `SIN_CERTIFICADO_AFIP` o `afip_rules.py` no matchean: el
`\\b` de la regex no corta adentro de un identificador, y los módulos/nombres de archivo no son
strings). Docstrings quedan afuera (documentación interna, no texto que el agente le dice al usuario)
-- mismo criterio que el gate web excluye comentarios.

ALLOWLIST explícita (control positivo + motivo, mismo patrón que `testid-paridad-excepciones.json`):
los ÚNICOS 3 hits reales del repo hoy son prompts INTERNOS de la autosanación (LLM-juez-de-parches y
el motivo de un gate de auto-reparación) -- nunca se le muestran al emprendedor, van a logs/alertas
del OPERADOR. Si aparece un hit nuevo fuera de esta lista, el gate es rojo: alguien tiene que decidir
si es ARCA o un nuevo caso interno legítimo (y sumarlo acá con motivo)."""
from __future__ import annotations

import ast
import re
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]   # apps/copiloto
_WORD = re.compile(r"\b(AFIP|Afip)\b")

#: Claves = SUBCADENA distintiva del string literal completo (los literales adyacentes de Python se
#: concatenan en UNA sola constante AST -- por eso se matchea por `in`, no por igualdad exacta).
_ALLOWLIST: dict[str, str] = {
    "toca emisión fiscal/AFIP (dominio DIAGNOSTIC_ONLY":
        "auditor_parches.py -- prompt del LLM-juez que aprueba/rechaza parches de autosanación; "
        "nunca llega al emprendedor.",
    "desactiva el guard de doble emisión fiscal — segunda factura con CAE real ante AFIP":
        "auditor_parches.py -- ejemplo fijo del prompt de arriba (parche que SÍ debe rechazarse).",
    "(CAE ante AFIP, secreto one-shot, token rotado). Nunca se auto-repara":
        "autosanacion_gates.py -- motivo interno de un Decision(False, ...) del gate DIAGNOSTIC_ONLY; "
        "va a logs/alertas del operador, no al chat del emprendedor.",
}


def _docstring_node_ids(tree: ast.AST) -> set[int]:
    ids: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) \
                    and isinstance(body[0].value.value, str):
                ids.add(id(body[0].value))
    return ids


def afip_visibles_en_archivo(path: Path) -> list[str]:
    """Strings NO-docstring de `path` que dicen «AFIP»/«Afip» suelto, sin los de la allowlist."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    docstrings = _docstring_node_ids(tree)
    hits: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docstrings:
            if _WORD.search(node.value) and not any(sub in node.value for sub in _ALLOWLIST):
                hits.append(node.value)
    return hits


def _archivos_de_produccion() -> list[Path]:
    return sorted(
        p for p in _ROOT.rglob("*.py")
        if "/tests/" not in p.as_posix() and p.name != "conftest.py"
    )


_ARCHIVOS = _archivos_de_produccion()


def test_control_positivo_el_detector_ve_AFIP_suelto_y_no_identificadores_ni_docstrings(tmp_path):
    src = tmp_path / "probe.py"
    src.write_text(
        'def f():\n'
        '    """docstring que nombra AFIP sin problema."""\n'
        '    SIN_CERTIFICADO_AFIP = "x"  # identificador, no string\n'
        '    return "portal de AFIP"\n',
        encoding="utf-8",
    )
    assert afip_visibles_en_archivo(src) == ["portal de AFIP"]


def test_la_allowlist_no_tiene_entradas_huerfanas():
    """Si una entrada de la allowlist ya no aparece en ningún archivo, es deuda invisible: o se borró
    el string sin destachar la excepción, o alguien la copió mal. Fail-closed, no silencioso."""
    textos_en_repo = [
        node.value
        for f in _ARCHIVOS
        for node in ast.walk(ast.parse(f.read_text(encoding="utf-8"), filename=str(f)))
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    ]
    huerfanas = [sub for sub in _ALLOWLIST if not any(sub in texto for texto in textos_en_repo)]
    assert huerfanas == [], f"entradas de la allowlist que ya no existen en el código: {huerfanas}"


def test_archivos_de_produccion_barridos_no_esta_vacio():
    assert len(_ARCHIVOS) > 20


def test_el_barrido_no_dice_AFIP_fuera_de_la_allowlist():
    hallados: dict[str, list[str]] = {}
    for f in _ARCHIVOS:
        hits = afip_visibles_en_archivo(f)
        if hits:
            hallados[str(f.relative_to(_ROOT.parent.parent))] = hits
    assert hallados == {}, (
        f"«AFIP» suelto fuera de la allowlist -- usar «ARCA» (o sumarlo a `_ALLOWLIST` con motivo "
        f"si es genuinamente interno): {hallados}"
    )
