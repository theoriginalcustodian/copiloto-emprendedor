"""Bootstrap del motor para pytest — un solo lugar (Fase 1, boundary del motor).

Reemplaza los `sys.path.insert(...)` inline que estaban repetidos en ~40 archivos de test.
pytest auto-carga este conftest (está en la raíz del código del copiloto, por encima de tests/)
ANTES de colectar cualquier test, así que todos los tests encuentran el motor + el propio código
del copiloto sin bootstrapear a mano.
"""
import sys
from pathlib import Path

# apps/copiloto en sys.path para poder importar `_paths` y los módulos del copiloto (worker_b,
# context_factory, services.*, dispatcher_emprendedor, ...) desde los tests.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _paths import ensure_paths  # noqa: E402

ensure_paths()
