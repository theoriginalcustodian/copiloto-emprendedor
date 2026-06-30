"""Policy de Composio para el toolkit Google Calendar del Copiloto B.

Los slugs y la version se CONFIRMAN empiricamente contra Composio (test_calendar_gateway.py::test_slugs_existen_real).
version: pineada por-toolkit (el SDK rechaza 'latest'); googlecalendar != gmail."""
import sys
from pathlib import Path

ARCH = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))

from clients.agent.providers.composio_gateway import ToolkitPolicy

CREATE_EVENT_SLUG = "GOOGLECALENDAR_CREATE_EVENT"     # existencia confirmada en test (catálogo real)
FIND_EVENT_SLUG = "GOOGLECALENDAR_FIND_EVENT"         # existencia confirmada en test (catálogo real)
# Version pineada del toolkit (el SDK rechaza 'latest'). DEBE estar en tk.meta.available_versions —
# lo valida test_version_pineada_existe_real contra Composio. Una version inexistente da 404 Tool_ToolNotFound
# en runtime (no en el de-risk del slug). Al deprecarse, bumpear acá y re-correr el test.
CALENDAR_VERSION = "20260623_00"

CALENDAR_POLICY = {
    "googlecalendar": ToolkitPolicy(
        version=CALENDAR_VERSION,
        read=frozenset({FIND_EVENT_SLUG}),
        write=frozenset({CREATE_EVENT_SLUG}),
    )
}
