"""Auto-verificación de `service_risk_contrato.py` (RIESGOPROMESAWEB).

El contrato declara `SERVICIOS_CON_TOOL_VIVA` a mano -- este test lo re-deriva por regex/grep contra
el código real (`services/*.py` + `tool_catalog.py`) para que esa declaración no sea una aserción sin
control: si alguien agrega/quita un servicio con tool viva y no actualiza el contrato, este test sale
rojo ANTES que el de paridad TS.
"""

from __future__ import annotations

import re
from pathlib import Path

from service_risk_contrato import SERVICIOS_CON_TOOL_VIVA

_APPS_COPILOTO = Path(__file__).resolve().parent.parent
_TOOLKIT_RE = re.compile(r'^TOOLKIT\s*=\s*"([a-z]+)"', re.MULTILINE)
_OBS_SERVICE_LITERAL_RE = re.compile(r'_obs_service\("([a-z]+)"\)')


def _derivar_universo_real() -> frozenset[str]:
    """Re-deriva el universo SIN confiar en el contrato: lee los archivos fuente tal cual están."""
    dinamicos = set()
    for py_file in (_APPS_COPILOTO / "services").glob("*.py"):
        dinamicos.update(_TOOLKIT_RE.findall(py_file.read_text(encoding="utf-8")))

    catalogo_fuente = (_APPS_COPILOTO / "tool_catalog.py").read_text(encoding="utf-8")
    primera_clase = set(_OBS_SERVICE_LITERAL_RE.findall(catalogo_fuente))

    return frozenset(dinamicos | primera_clase)


def test_universo_declarado_coincide_con_el_real():
    real = _derivar_universo_real()
    assert real, "el regex no encontró ningún servicio -- el parser no mira, no que el universo esté vacío"
    assert SERVICIOS_CON_TOOL_VIVA == real, (
        f"service_risk_contrato.py declara {sorted(SERVICIOS_CON_TOOL_VIVA)} "
        f"pero el código real tiene {sorted(real)} -- actualizá el contrato en el mismo PR."
    )


def test_canario_toolkit_de_mentira_en_services_se_detecta():
    """Control positivo: si `services/*.py` declarara un TOOLKIT inventado, el derivador lo vería."""
    fuente_mutante = 'TOOLKIT = "telepatia"\n'
    detectado = set(_TOOLKIT_RE.findall(fuente_mutante))
    assert detectado == {"telepatia"}, "el regex no mira TOOLKIT -- el canario no lo cazaría"


def test_mercadopago_y_googlecalendar_son_primera_clase_no_services():
    """Control negativo: ninguno de los dos vive en `services/`, pero ambos entran por el literal
    de `_obs_service(...)` -- si se borrara ese literal, el universo real los perdería y el test de
    arriba se pondría rojo (ver `tool_catalog.py:576,626`)."""
    assert not (_APPS_COPILOTO / "services" / "mercadopago.py").exists()
    assert not (_APPS_COPILOTO / "services" / "googlecalendar.py").exists()
    assert {"mercadopago", "googlecalendar"}.issubset(SERVICIOS_CON_TOOL_VIVA)


def test_instagram_no_tiene_tool_viva():
    """La razón de ser de RIESGOPROMESAWEB: instagram no aparece en ningún lado del universo real."""
    assert "instagram" not in _derivar_universo_real()
    assert "instagram" not in SERVICIOS_CON_TOOL_VIVA
