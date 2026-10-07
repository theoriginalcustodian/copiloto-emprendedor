"""Chequeo MECLAVES*: el set de claves REAL de un endpoint contra lo declarado en su `*_contrato.py`.

Nació como MECLAVESRUNTIME (sólo `/me`); MECLAVESRESTO le agrega `/auth/login` reutilizando el mismo
mecanismo — `comparar_claves` no sabe nada de ningún endpoint en particular, y el loader genérico
(`_cargar_frozenset_de_modulo`) es el único lugar que sabe leer un `*_contrato.py` por ruta de archivo
(no por sys.path, para que el smoke funcione desde el checkout del VPS sin tocar el path de Python).

SMOKESTDIN (2026-10-07): `run-smoke-prod.sh` manda este archivo + `smoke_beta_e2e.py` sueltos a un
tmpdir remoto (no el checkout desplegado), así que la ruta relativa por defecto (`../../apps/...`)
no resuelve ahí — y no debe: el SET DECLARADO tiene que salir del árbol DESPLEGADO (el contrato es
"¿el backend desplegado cumple su propia declaración?", no "¿coincide con lo que hay en `main`
local?" — si prod está atrás, esa segunda lectura daría rojo por deriva de deploy, no por contrato).
Por eso el override es por ENV, no por default de código: el default sigue sirviendo al uso local
documentado (`python deploy/copiloto/smoke_beta_e2e.py` desde la raíz del repo). Cada endpoint tiene
su propia variable de override, para no confundir deriva de `/me` con deriva de `/auth/login`.
"""
import importlib.util
import os

_RAIZ_APPS_COPILOTO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "apps", "copiloto")
RUTA_ME_CONTRATO = os.path.join(_RAIZ_APPS_COPILOTO, "me_contrato.py")
RUTA_LOGIN_CONTRATO = os.path.join(_RAIZ_APPS_COPILOTO, "auth_login_contrato.py")


def _cargar_frozenset_de_modulo(ruta, nombre_modulo, atributo):
    spec = importlib.util.spec_from_file_location(nombre_modulo, ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return frozenset(getattr(modulo, atributo))


def cargar_claves_declaradas(ruta=None):
    """CLAVES_ME de `apps/copiloto/me_contrato.py` (MECLAVESCORE). Override: `UC_ME_CONTRATO_PATH`."""
    ruta = ruta or os.environ.get("UC_ME_CONTRATO_PATH") or RUTA_ME_CONTRATO
    return _cargar_frozenset_de_modulo(ruta, "me_contrato", "CLAVES_ME")


def cargar_claves_login_declaradas(ruta=None):
    """CLAVES_LOGIN de `apps/copiloto/auth_login_contrato.py` (MECLAVESRESTO).

    Override: `UC_LOGIN_CONTRATO_PATH` — mismo motivo que `UC_ME_CONTRATO_PATH`: el set declarado
    tiene que salir del árbol DESPLEGADO cuando `run-smoke-prod.sh` corre el smoke desde un tmpdir.
    """
    ruta = ruta or os.environ.get("UC_LOGIN_CONTRATO_PATH") or RUTA_LOGIN_CONTRATO
    return _cargar_frozenset_de_modulo(ruta, "auth_login_contrato", "CLAVES_LOGIN")


def comparar_claves(recibidas, declaradas):
    """Devuelve (sobra, falta). sobra = llegó en la respuesta y no está declarada; falta = declarada
    y no llegó. Agnóstico al endpoint: quien llama sabe de qué `*_contrato.py` vienen `declaradas`.

    Guard: un set declarado vacío es el lector roto, no una respuesta sana — se niega a comparar.
    """
    declaradas = frozenset(declaradas)
    if not declaradas:
        raise ValueError("set declarado vacío: sin claves que comparar (lector roto, no respuesta sana)")
    recibidas = frozenset(recibidas)
    return sorted(recibidas - declaradas), sorted(declaradas - recibidas)
