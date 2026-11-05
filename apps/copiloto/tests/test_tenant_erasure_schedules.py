"""SEC-D8 · todo Schedule POR TENANT declarado en deploy/ está cubierto por el borrado.

Hallazgo de la revisión de seguridad del commit af5e6ef3: `soporte-feedback-{cliente_id}` quedó fuera de
`PREFIJOS_SCHEDULE`. Este test lee los `_schedule_id` de `deploy/worker/ensure_*` y exige que cada prefijo
esté en la lista (la activity además barre por sufijo, pero la lista explícita es la que se audita).
"""
from __future__ import annotations

import re
from pathlib import Path

from tenant_erasure_activities import PREFIJOS_SCHEDULE

_RAIZ = Path(__file__).resolve().parents[3]
_RE = re.compile(r'return f"([a-z0-9-]+-)\{cliente_id\}"')


def test_todo_schedule_por_tenant_de_deploy_esta_en_PREFIJOS_SCHEDULE():
    archivos = sorted((_RAIZ / "deploy" / "worker").glob("ensure_*schedule*.py"))
    assert archivos, "el instrumento no encontró ningún ensure_*schedule*.py (ruta rota)"
    prefijos = set()
    for a in archivos:
        prefijos |= set(_RE.findall(a.read_text(encoding="utf8")))
    assert {"grafo-sync-", "mi-dia-", "soporte-feedback-"} <= prefijos   # control positivo
    faltan = prefijos - set(PREFIJOS_SCHEDULE)
    assert not faltan, f"schedules por tenant NO cubiertos por el borrado: {sorted(faltan)}"
