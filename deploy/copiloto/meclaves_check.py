"""Chequeo MECLAVESRUNTIME: el set de claves REAL de GET /me contra el declarado en CLAVES_ME.

La fuente única del set es `apps/copiloto/me_contrato.py` (MECLAVESCORE, lado Python); acá no se
redeclara. Se carga por ruta de archivo (no por sys.path) para que el smoke funcione desde el
checkout del VPS sin tocar el path de Python.

SMOKESTDIN (2026-10-07): `run-smoke-prod.sh` manda este archivo + `smoke_beta_e2e.py` sueltos a un
tmpdir remoto (no el checkout desplegado), así que la ruta relativa por defecto (`../../apps/...`)
no resuelve ahí — y no debe: el SET DECLARADO tiene que salir del árbol DESPLEGADO (el contrato es
"¿el backend desplegado cumple su propia declaración?", no "¿coincide con lo que hay en `main`
local?" — si prod está atrás, esa segunda lectura daría rojo por deriva de deploy, no por contrato).
Por eso el override es por ENV, no por default de código: el default sigue sirviendo al uso local
documentado (`python deploy/copiloto/smoke_beta_e2e.py` desde la raíz del repo).
"""
import importlib.util
import os

RUTA_ME_CONTRATO = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "apps", "copiloto", "me_contrato.py"
)


def cargar_claves_declaradas(ruta=None):
    ruta = ruta or os.environ.get("UC_ME_CONTRATO_PATH") or RUTA_ME_CONTRATO
    spec = importlib.util.spec_from_file_location("me_contrato", ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return frozenset(modulo.CLAVES_ME)


def comparar_claves(recibidas, declaradas):
    """Devuelve (sobra, falta). sobra = llegó en /me y no está declarada; falta = declarada y no llegó.

    Guard: un set declarado vacío es el lector roto, no un /me sano — se niega a comparar.
    """
    declaradas = frozenset(declaradas)
    if not declaradas:
        raise ValueError("CLAVES_ME vacío: sin set declarado no hay nada que comparar")
    recibidas = frozenset(recibidas)
    return sorted(recibidas - declaradas), sorted(declaradas - recibidas)
