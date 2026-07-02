"""Registry por DESCUBRIMIENTO de los módulos de servicio (`services/<svc>.py`).

Discovery por directorio: agregar un servicio = soltar un archivo en `services/`; NADIE edita este registry
ni el dispatcher ni el system prompt (esos se componen desde acá). Esto habilita el fan-out sin colisión de
archivos y el gating por toolkit. La clave de servicio que emite el LLM = el nombre del archivo (gmail.py -> 'gmail').

Contrato de un módulo (ver services/base.py): TOOLKIT + POLICY + PROMPT_FRAGMENT + build(op, entities, *, now_iso).
"""
from __future__ import annotations

import importlib
import pkgutil

_BY_SERVICE: dict = {}   # nombre de servicio (archivo) -> módulo
_LOADED = {"done": False}


def _discover() -> None:
    if _LOADED["done"]:
        return
    for info in pkgutil.iter_modules(__path__):
        if info.name in ("base",) or info.ispkg:
            continue
        try:
            mod = importlib.import_module(f"{__name__}.{info.name}")
        except Exception:  # noqa: BLE001 — un módulo roto se SALTEA, no tumba al agente ni a los demás servicios
            continue
        if hasattr(mod, "TOOLKIT") and hasattr(mod, "POLICY") and hasattr(mod, "build"):
            _BY_SERVICE[info.name] = mod
    _LOADED["done"] = True


def by_service(name: str | None):
    """Módulo del servicio (por nombre de archivo, ej 'gmail'), o None si no existe."""
    if not name:
        return None
    _discover()
    return _BY_SERVICE.get(name)


def modules() -> dict:
    _discover()
    return dict(_BY_SERVICE)


def merged_policy() -> dict:
    """{toolkit_slug: ToolkitPolicy} de TODOS los módulos → policy del ComposioGateway (allowlist mínima)."""
    _discover()
    return {mod.TOOLKIT: mod.POLICY for mod in _BY_SERVICE.values()}


def prompt_fragments() -> str:
    """Concatena los PROMPT_FRAGMENT de todos los módulos para componer el system prompt."""
    _discover()
    frags = [getattr(mod, "PROMPT_FRAGMENT", "").strip() for mod in _BY_SERVICE.values()]
    return "\n".join(f for f in frags if f)
