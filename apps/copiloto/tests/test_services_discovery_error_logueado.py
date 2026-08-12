"""D-A (lote higiene, 2026-08-12): `services._discover()` saltea un módulo roto -- correcto, no debe
tumbar el catálogo entero por un servicio -- pero antes lo hacía MUDO. Control negativo: sin el fix,
este test falla porque no queda ningún rastro del fallo (ni log, ni excepción, nada)."""
from __future__ import annotations

import importlib
import json
import logging
import pkgutil

import pytest

import services


class _ModuloFalso:
    name = "servicio_roto"
    ispkg = False


@pytest.fixture(autouse=True)
def _registry_limpio():
    """El discovery cachea en módulo-level (`_LOADED`/`_BY_SERVICE`) -- sin resetear, el primer test
    que corre en el proceso decide el resultado de todos los demás."""
    services._LOADED["done"] = False
    services._BY_SERVICE.clear()
    yield
    services._LOADED["done"] = False
    services._BY_SERVICE.clear()


def test_modulo_roto_se_saltea_y_queda_logueado(monkeypatch, caplog):
    def _iter_modules_falso(path):
        yield _ModuloFalso()

    def _import_module_falso(nombre):
        if nombre.endswith("servicio_roto"):
            raise RuntimeError("boom en import del servicio")
        return importlib.import_module(nombre)

    monkeypatch.setattr(pkgutil, "iter_modules", _iter_modules_falso)
    monkeypatch.setattr(importlib, "import_module", _import_module_falso)

    with caplog.at_level(logging.WARNING, logger="copiloto"):
        mods = services.modules()   # no debe lanzar -- el contrato "un servicio roto no tumba a los demás"

    assert "servicio_roto" not in mods
    assert caplog.records, "no se emitió NINGÚN registro: el fallo quedó mudo otra vez"
    registro = json.loads(caplog.records[-1].getMessage())
    assert registro["workflow"] == "services.discover"
    assert registro["error_type"] == "RuntimeError"
    assert registro["servicio"] == "servicio_roto"
