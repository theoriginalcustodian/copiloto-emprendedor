"""Chequeo MECLAVESRUNTIME: el set de claves REAL de GET /me contra el declarado en CLAVES_ME.

La fuente única del set es `apps/copiloto/me_contrato.py` (MECLAVESCORE, lado Python); acá no se
redeclara. Se carga por ruta de archivo (no por sys.path) para que el smoke funcione desde el
checkout del VPS sin tocar el path de Python.
"""
import importlib.util
import os

RUTA_ME_CONTRATO = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "apps", "copiloto", "me_contrato.py"
)


def cargar_claves_declaradas(ruta=RUTA_ME_CONTRATO):
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
