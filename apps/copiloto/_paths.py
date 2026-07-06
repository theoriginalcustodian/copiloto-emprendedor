"""Fuente ÚNICA del bootstrap de sys.path del Copiloto — boundary explícito del motor (Fase 1).

Reemplaza los ~92 `sys.path.insert(...)` que estaban dispersos y hardcodeados en 56 archivos
(cada uno recomputando `Path(__file__).resolve().parents[N] / "deploy/skeleton_kit/..."` con un N
distinto según su profundidad). Ese patrón se rompía entero al mover `apps/copiloto` de repo.

Ahora el motor (arquetipo `conversational_agent/reference/`) se resuelve desde `UC_MOTOR_REF_PATH`
(env) o, por default, la copia dentro de este repo. **Al graduar a repo propio (Fase 2, vendorizar-
con-sync) SOLO cambia el default `_DEFAULT_MOTOR_REF` acá** — cero ediciones en los 56 archivos.

Uso:
  from _paths import ensure_paths
  ensure_paths()                 # idempotente; llamar ANTES de importar backend.agent / clients.agent
Los tests no lo llaman: `conftest.py` lo hace una vez por sesión de pytest.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent            # apps/copiloto (raíz del código del copiloto)
_REPO = APP.parents[1]                           # raíz del repo (apps/copiloto -> apps -> repo)

# Motor: env override o el motor VENDORIZADO en el repo (Fase 2 graduación — copia propia del arquetipo).
# El sync-con-drift-check (scripts/sync-motor.sh) lo mantiene alineado con la fábrica hasta el fork duro.
_DEFAULT_MOTOR_REF = _REPO / "motor"
MOTOR_REF = Path(os.environ.get("UC_MOTOR_REF_PATH") or _DEFAULT_MOTOR_REF)

WORKER = _REPO / "deploy" / "worker"             # provision_tables.py (infra-fábrica)

# Orden de búsqueda en sys.path (no hay colisiones de nombre entre estos árboles:
# motor = backend.agent/clients.agent · APP = worker_b/services/context_factory/... · WORKER = provision_tables).
_PATHS = (MOTOR_REF, APP, WORKER)


def ensure_paths() -> None:
    """Idempotente: agrega motor + app + worker a sys.path si no están. Safe para llamar N veces."""
    for p in _PATHS:
        sp = str(p)
        if sp not in sys.path:
            sys.path.insert(0, sp)
