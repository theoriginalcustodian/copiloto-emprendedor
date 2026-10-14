"""SM-C4 — CANARIO INVERTIDO de «la aceptación legal INFORMA, no BLOQUEA» (lado backend).

Regla vigente (decisión del operador 2026-10-13, `LEGALNOOPERA`): una cuenta con `legal_aceptado=false`
opera igual. El backend EXPONE la aceptación (`/me`) y la REGISTRA (`POST /me/legal/aceptar`); no la usa
para rechazar nada. El DoD viejo —«cuenta sin aceptación es rechazada al operar» + guard de backend— está
RETIRADO, y este test es lo que impide que vuelva por la puerta de atrás.

No exige un rechazo ni una UI que no existen (nacería rojo y se volvería escudo de los rojos propios):
mira la LECTURA, igual que `test_hitl_card_editable_canario.py` (#1146). Hoy el único código que toca la
aceptación es el store, el helper de `/me`, el handler de aceptar y el DDL/contrato. Un guard tendría que
leer la aceptación en OTRO lugar (un `Depends`, un handler, un middleware): este test se pone rojo ahí.

Estático (AST, sin DB ni red): corre en la PC y en el VPS.

Control positivo (por qué no es ciego): `auditar_fuente` corre sobre fuentes mutadas en memoria —un
módulo nuevo con un guard, una función nueva de web.py, el helper de `/me` que empieza a lanzar— y TIENE
que acusarlas; y el recorrido real exige haber mirado > 0 módulos y > 0 referencias.

Limitación declarada: lo que caza es el camino natural (los identificadores con su nombre). Un guard que
lea la columna por SQL a mano sin nombrar el store ni los campos no lo ve — para eso está
`test_adversarial_multitenant.py`, que ejercita la DB real en el VPS.
"""
import ast
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[3]
DIRS = [RAIZ / "apps" / "copiloto", RAIZ / "motor" / "backend"]

# Identificadores / claves que SON la aceptación legal.
TOKENS = {
    "legal_aceptado", "legal_version", "legal_version_aceptada", "legal_aceptado_en",
    "TenantLegalStore", "LEGAL_VERSION_VIGENTE", "LEGAL_VERSION_DESACTUALIZADA",
    "tenant_legal_store", "version_aceptada",
}

# Módulos que pueden nombrarla, y por qué. Un módulo nuevo que la nombre = decisión, no accidente.
MODULOS_PERMITIDOS = {
    "apps/copiloto/tenant_legal_store.py": "el store: lee/escribe la fila del tenant",
    "apps/copiloto/me_contrato.py": "las CLAVES del payload de /me (dato, no lógica)",
    "apps/copiloto/provision.py": "DDL idempotente de las columnas",
    "apps/copiloto/errores_web.py": "catálogo: el código del 409 de /me/legal/aceptar (versión ENVIADA ≠ vigente)",
    "apps/copiloto/web.py": "expone en /me y registra en /me/legal/aceptar (funciones de abajo)",
}
# Dentro de web.py: sólo estas funciones pueden nombrarla.
FUNCIONES_PERMITIDAS_EN_WEB = {"_campos_legales", "aceptar_legal"}
# … y el helper de /me INFORMA: no puede lanzar ni cortar el request.
FUNCIONES_QUE_NO_LANZAN = {"_campos_legales"}

QUE_HACER = (
    "la aceptación legal INFORMA, no bloquea (decisión 2026-10-13, LEGALNOOPERA). Un módulo o una "
    "función nueva que lee la aceptación puede ser un guard: si sólo la muestra, agregalo a la "
    "allowlist con su motivo; si rechaza/obstruye por `legal_aceptado=false`, ese camino está RETIRADO "
    "— es decisión del operador, este test no se relaja a mano ni con --no-verify."
)


def _es_docstring(nodo: ast.AST, padre: ast.AST | None) -> bool:
    if not isinstance(nodo, ast.Constant) or not isinstance(nodo.value, str):
        return False
    cuerpo = getattr(padre, "body", None)
    # `body` es lista en def/class/module/if…, pero una EXPRESIÓN en `IfExp`/`Lambda`.
    return (isinstance(cuerpo, list) and bool(cuerpo)
            and isinstance(cuerpo[0], ast.Expr) and cuerpo[0].value is nodo)


def _menciones(nodo: ast.AST, padre: ast.AST | None = None) -> list[tuple[int, str]]:
    """Tokens que nombra este subárbol, SIN bajar a funciones anidadas ni contar docstrings."""
    out: list[tuple[int, str]] = []
    if isinstance(nodo, ast.Name) and nodo.id in TOKENS:
        out.append((nodo.lineno, nodo.id))
    elif isinstance(nodo, ast.Attribute) and nodo.attr in TOKENS:
        out.append((nodo.lineno, nodo.attr))
    elif isinstance(nodo, ast.alias) and (nodo.name in TOKENS or nodo.name.split(".")[-1] in TOKENS):
        out.append((getattr(nodo, "lineno", 0), nodo.name))
    elif isinstance(nodo, ast.Constant) and isinstance(nodo.value, str) and not _es_docstring(nodo, padre):
        if nodo.value in TOKENS:
            out.append((nodo.lineno, nodo.value))
    for hijo in ast.iter_child_nodes(nodo):
        if isinstance(hijo, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        out.extend(_menciones(hijo, nodo))
    return out


def _funciones(arbol: ast.AST):
    for n in ast.walk(arbol):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            yield n


def _lanza(fn: ast.AST) -> bool:
    return any(isinstance(n, ast.Raise) for n in ast.walk(fn))


def auditar_fuente(ruta: str, texto: str) -> tuple[list[str], int]:
    """(violaciones, referencias_miradas) de UN módulo. `ruta` relativa a la raíz, con `/`."""
    arbol = ast.parse(texto)
    violaciones: list[str] = []
    miradas = 0

    # Referencias a nivel módulo (imports, constantes) — fuera de toda función.
    modulo = _menciones(arbol)
    # El cuerpo de las funciones se evalúa aparte, función por función.
    por_funcion = [(f, _menciones(f)) for f in _funciones(arbol)]
    miradas += len(modulo) + sum(len(m) for _, m in por_funcion)

    if ruta not in MODULOS_PERMITIDOS:
        for ln, tok in modulo + [m for _, ms in por_funcion for m in ms]:
            violaciones.append(f"{ruta}:{ln} nombra `{tok}` y el módulo no está en MODULOS_PERMITIDOS")
        return violaciones, miradas

    if ruta == "apps/copiloto/web.py":
        for fn, ms in por_funcion:
            if ms and fn.name not in FUNCIONES_PERMITIDAS_EN_WEB:
                violaciones.append(
                    f"{ruta}:{ms[0][0]} la función `{fn.name}` nombra `{ms[0][1]}` y no es una de "
                    f"{sorted(FUNCIONES_PERMITIDAS_EN_WEB)}")
            if ms and fn.name in FUNCIONES_QUE_NO_LANZAN and _lanza(fn):
                violaciones.append(f"{ruta}:{fn.lineno} `{fn.name}` informa la aceptación y NO puede lanzar")
    return violaciones, miradas


def _fuentes_reales() -> list[tuple[str, str]]:
    out = []
    for base in DIRS:
        for p in sorted(base.rglob("*.py")):
            rel = p.relative_to(RAIZ).as_posix()
            if "/tests/" in f"/{rel}" or rel.split("/")[-1].startswith("test_"):
                continue
            if any(parte in {"__pycache__", "node_modules", ".venv"} for parte in p.parts):
                continue
            out.append((rel, p.read_text(encoding="utf-8")))
    return out


def test_ningun_camino_de_produccion_usa_la_aceptacion_legal_para_decidir():
    fuentes = _fuentes_reales()
    assert len(fuentes) > 50, "el recorrido miró casi 0 módulos: un recorrido vacío pasa siempre"
    violaciones: list[str] = []
    miradas = 0
    for rel, texto in fuentes:
        v, m = auditar_fuente(rel, texto)
        violaciones += v
        miradas += m
    assert miradas > 0, "no encontró ni una referencia a la aceptación: el canario está ciego"
    assert not violaciones, f"{QUE_HACER}\n" + "\n".join(violaciones)


def test_los_modulos_permitidos_existen():
    """Si un módulo permitido desaparece o se renombra, la allowlist queda apuntando a nada y el
    canario deja de mirar el reemplazo sin avisar."""
    faltan = [m for m in MODULOS_PERMITIDOS if not (RAIZ / m).exists()]
    assert not faltan, f"módulos de la allowlist que ya no existen: {faltan}"


def test_las_funciones_permitidas_de_web_existen():
    """El helper de /me y el handler de aceptar siguen siendo los que la nombran (denominador)."""
    arbol = ast.parse((RAIZ / "apps/copiloto/web.py").read_text(encoding="utf-8"))
    con_menciones = {f.name for f, ms in ((f, _menciones(f)) for f in _funciones(arbol)) if ms}
    assert con_menciones == FUNCIONES_PERMITIDAS_EN_WEB, (
        f"las funciones de web.py que nombran la aceptación cambiaron: {sorted(con_menciones)} "
        f"≠ {sorted(FUNCIONES_PERMITIDAS_EN_WEB)}")


# --- CONTROL POSITIVO: el mismo verificador TIENE que acusar cada guard --------------------------------

@pytest.mark.parametrize("ruta,texto,fragmento", [
    ("apps/copiloto/ordenes.py",
     "from tenant_legal_store import TenantLegalStore\n"
     "def crear(cf, cid):\n    if TenantLegalStore(cf, cid).version_aceptada() is None:\n        raise ValueError('x')\n",
     "no está en MODULOS_PERMITIDOS"),
    ("apps/copiloto/auth_extra.py",
     "def dep(me):\n    if not me['legal_aceptado']:\n        raise PermissionError()\n",
     "no está en MODULOS_PERMITIDOS"),
    ("apps/copiloto/web.py",
     "def crear_pago(cf, cid):\n    if TenantLegalStore(cf, cid).version_aceptada() != LEGAL_VERSION_VIGENTE:\n"
     "        raise HTTPException(403)\n",
     "no es una de"),
    ("apps/copiloto/web.py",
     "def _campos_legales(cf, cid):\n    v = TenantLegalStore(cf, cid).version_aceptada()\n"
     "    if v is None:\n        raise HTTPException(403)\n    return {'legal_aceptado': True}\n",
     "NO puede lanzar"),
])
def test_el_canario_dispara_con_un_guard_mutado(ruta, texto, fragmento):
    violaciones, miradas = auditar_fuente(ruta, texto)
    assert miradas > 0
    assert any(fragmento in v for v in violaciones), violaciones


def test_los_usos_legitimos_no_acusan():
    """El verificador no es un falso rojo: el helper de /me y el handler de aceptar, tal como están."""
    texto = (
        "from tenant_legal_store import LEGAL_VERSION_VIGENTE, TenantLegalStore\n"
        "def _campos_legales(cf, cid):\n"
        "    '''menciona legal_aceptado en el docstring'''\n"
        "    v = TenantLegalStore(cf, cid).version_aceptada()\n"
        "    return {'legal_aceptado': v == LEGAL_VERSION_VIGENTE, 'legal_version_aceptada': v}\n"
        "def aceptar_legal(body):\n"
        "    if body.version != LEGAL_VERSION_VIGENTE:\n        raise ValueError('409')\n"
    )
    violaciones, miradas = auditar_fuente("apps/copiloto/web.py", texto)
    assert miradas > 0
    assert violaciones == []
