"""SM-D1 — CANARIO INVERTIDO de `choices`: ningún productor emite más de 2 opciones (contrato 2026-10-14).

El DoD viejo de SM-D1 pedía medir en device «un `choices` de 3+ opciones se ve y se elige». Medido por
planificación el 2026-10-14: el ÚNICO productor es la confirmación HITL (`Confirmar`/`Cancelar`) y tiene
EXACTAMENTE 2; no hay camino de producción con 3+. Sembrar un backend falso para que el device vea 3
opciones mide un sistema que no es el nuestro, así que el DoD se enmienda (la UI con 3+ se ejercita en
test de COMPONENTE, que inyecta N sin backend).

Lo que NO puede pasar en silencio: que mañana alguien emita un tercer `choice` y el DoD «3+ se ve y se
elige» vuelva a quedar sin medir, sin que nadie se entere. Este test mira la EMISIÓN y se pone rojo ese día,
con un mensaje que dice qué falta (medir 3+ en device y en componente).

Estático (AST, sin DB, sin red, sin importar el módulo): corre en la PC y en el VPS.

Qué mira: toda lista literal de `choices` en `apps/copiloto/*.py` y `motor/backend/agent/*.py` (no tests):
  · asignación a un nombre `*CHOICES*` (p. ej. `_CONFIRM_CHOICES`);
  · keyword `choices=[...]`;
  · clave `"choices": [...]` de un dict;
  · `return [...]` de una función cuyo nombre contiene `choices`.
Y toda forma de `choices=` que NO puede contar (`choices=algo_calculado`) se acusa como «no analizable»:
un productor dinámico nuevo no puede pasar sin que alguien decida cómo se mide.

Control positivo (por qué no es ciego): `auditar_fuente` corre sobre fuentes mutadas en memoria —una
constante con 3, un keyword con 3, una clave de dict con 3, una función `*_choices` con 3, y un `choices=`
calculado— y TIENE que acusar cada una; el recorrido real exige haber mirado > 0 listas y haber visto los
dos productores conocidos por su nombre.

Limitación declarada: no ve una lista armada en un nombre que no contenga «choices» y se pase por
variable. Para eso está el test de componente de 3+ en las dos apps.
"""
import ast
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
DIRS = [RAIZ / "apps" / "copiloto", RAIZ / "motor" / "backend" / "agent"]
MAX_CHOICES = 2

# Productores que el recorrido REAL tiene que haber visto: si cambia el nombre y el canario deja de
# mirarlos, el verde sería ciego.
_PRODUCTORES_CONOCIDOS = {
    "apps/copiloto/dispatcher_emprendedor.py": "_CONFIRM_CHOICES",
    "motor/backend/agent/dispatch.py": "_CONFIRM_CHOICES",
    "motor/backend/agent/conversation_workflow.py": "_confirm_choices",
}

_QUE_HACER = (
    "un productor emite MÁS de {max} `choices`. El DoD «3+ opciones se ven y se eligen» de SM-D1 se enmendó "
    "porque ese caso no existía en producción; ahora existe y hay que medirlo: (1) test de COMPONENTE con "
    "esa cantidad en las dos apps (mobile `ChipsDesambiguacion`/`ListaMensajes`, web `DisambiguationChips`), "
    "y (2) device con el sustrato real. Este test no se saltea con --no-verify ni se relaja a mano: se "
    "actualiza `MAX_CHOICES` recién cuando (1) y (2) tienen evidencia."
)


def _es_nombre_de_choices(nombre: str) -> bool:
    return "choices" in nombre.lower()


def _largo_si_lista(nodo: ast.AST):
    return len(nodo.elts) if isinstance(nodo, ast.List) else None


def _es_forma_segura(valor: ast.AST) -> bool:
    """Formas de `choices=` que no necesitan contarse acá: se cuentan en su definición o no emiten."""
    if isinstance(valor, ast.Constant):                       # choices=None
        return True
    if isinstance(valor, ast.Name):                           # choices=choices (reenvío) / constante contada
        return True
    if isinstance(valor, ast.Call):
        f = valor.func
        nombre = f.id if isinstance(f, ast.Name) else (f.attr if isinstance(f, ast.Attribute) else "")
        if nombre == "list" and len(valor.args) == 1 and isinstance(valor.args[0], ast.Name):
            return True                                       # list(_CONFIRM_CHOICES)
        if _es_nombre_de_choices(nombre) or nombre == "get":  # _confirm_choices(...) / payload.get("choices")
            return True
    if isinstance(valor, ast.BoolOp):                         # choices or []
        return all(_es_forma_segura(v) or isinstance(v, ast.List) for v in valor.values)
    return False


def auditar_fuente(src: str, ruta: str = "<memoria>"):
    """(violaciones, listas_miradas, nombres_vistos). Pura: recibe el texto, no toca disco."""
    violaciones: list[str] = []
    miradas = 0
    nombres: set[str] = set()
    arbol = ast.parse(src)

    def contar(nodo: ast.AST, donde: str) -> None:
        nonlocal miradas
        n = _largo_si_lista(nodo)
        if n is None:
            return
        miradas += 1
        if n > MAX_CHOICES:
            violaciones.append(f"{ruta}:{getattr(nodo, 'lineno', '?')} {donde} emite {n} choices")

    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Assign):
            for t in nodo.targets:
                if isinstance(t, ast.Name) and _es_nombre_de_choices(t.id):
                    nombres.add(t.id)
                    contar(nodo.value, f"`{t.id}`")
        elif isinstance(nodo, ast.keyword) and nodo.arg == "choices":
            if isinstance(nodo.value, ast.List):
                contar(nodo.value, "keyword `choices=`")
            elif not _es_forma_segura(nodo.value):
                violaciones.append(
                    f"{ruta}:{getattr(nodo.value, 'lineno', '?')} `choices=` con una forma NO ANALIZABLE "
                    f"({ast.unparse(nodo.value)[:60]}): un productor dinámico nuevo tiene que decidirse acá"
                )
        elif isinstance(nodo, ast.Dict):
            for k, v in zip(nodo.keys, nodo.values):
                if isinstance(k, ast.Constant) and k.value == "choices":
                    contar(v, 'clave `"choices"`')
        elif isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef)) and _es_nombre_de_choices(nodo.name):
            nombres.add(nodo.name)
            for sub in ast.walk(nodo):
                if isinstance(sub, ast.Return) and sub.value is not None:
                    contar(sub.value, f"`{nodo.name}()`")
    return violaciones, miradas, nombres


def _fuentes_reales():
    for d in DIRS:
        for p in sorted(d.glob("*.py")):
            if p.name.startswith("test_") or p.name == "conftest.py":
                continue
            yield p


def test_ningun_productor_emite_mas_de_dos_choices():
    violaciones: list[str] = []
    miradas = 0
    vistos: dict[str, set[str]] = {}
    for p in _fuentes_reales():
        v, m, nombres = auditar_fuente(p.read_text(encoding="utf-8"), p.relative_to(RAIZ).as_posix())
        violaciones += v
        miradas += m
        vistos[p.relative_to(RAIZ).as_posix()] = nombres
    assert miradas > 0, "el canario miró 0 listas de choices: un recorrido vacío pasa siempre"
    assert not violaciones, f"{_QUE_HACER.format(max=MAX_CHOICES)} Hallazgos: {violaciones}"
    faltan = [f"{ruta}::{n}" for ruta, n in _PRODUCTORES_CONOCIDOS.items() if n not in vistos.get(ruta, set())]
    assert not faltan, (
        f"el canario dejó de ver productores que conocía: {faltan}. Si se renombraron o se movieron, "
        f"actualizar `_PRODUCTORES_CONOCIDOS`; si no, el verde es ciego."
    )


def test_el_canario_dispara_con_una_constante_de_tres():
    v, m, _ = auditar_fuente('_CONFIRM_CHOICES = [{"label":"a"},{"label":"b"},{"label":"c"}]')
    assert m == 1 and v and "3 choices" in v[0], v


def test_el_canario_dispara_con_un_keyword_de_tres():
    v, _, _ = auditar_fuente('f(choices=[{"l":1},{"l":2},{"l":3}])')
    assert v and "keyword" in v[0], v


def test_el_canario_dispara_con_una_clave_de_dict_de_tres():
    v, _, _ = auditar_fuente('x = {"text": "hola", "choices": [{"l":1},{"l":2},{"l":3}]}')
    assert v and "clave" in v[0], v


def test_el_canario_dispara_con_una_funcion_de_choices_de_tres():
    v, _, nombres = auditar_fuente('def _mis_choices():\n    return [{"l":1},{"l":2},{"l":3}]\n')
    assert v and "_mis_choices" in v[0] and "_mis_choices" in nombres, (v, nombres)


def test_el_canario_acusa_un_choices_calculado():
    v, _, _ = auditar_fuente('f(choices=[mk(o) for o in opciones])')   # list-comp: no es ast.List, no se puede contar
    assert v and "NO ANALIZABLE" in v[0], v


def test_el_canario_no_acusa_los_dos_choices_legitimos():
    """CONTROL NEGATIVO: lo que existe hoy (2) no puede marcar rojo, o el canario es un falso positivo."""
    v, m, _ = auditar_fuente('_CONFIRM_CHOICES = [{"label":"Confirmar"},{"label":"Cancelar"}]\nf(choices=list(_CONFIRM_CHOICES))')
    assert v == [] and m == 1, (v, m)
