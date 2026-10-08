"""Catálogo de tools del motor ReAct (Task 5): build_tool_catalog / TOOL_INDEX / WRITE_TOOLS.

Verifica que el catálogo une los TOOL_SCHEMAS de los servicios descubiertos + las 2 tools de 1ra clase
(calendar_book, mp_charge), que el índice resuelve cada tool a su destino, y que WRITE_TOOLS distingue
EXACTO write de read (via el WRITE_OPS explícito de cada módulo — test_service_schemas.py ya cubre que
todos los módulos lo declaran; acá se verifica el consumo en tool_catalog)."""
import tool_catalog
from services import drive


def test_catalog_has_services_calendar_and_mp():
    names = {s["function"]["name"] for s in tool_catalog.build_tool_catalog()}
    assert {"gmail_send", "calendar_book", "mp_charge"} <= names
    # Poda del hito 2: lo que se fue NO puede volver por la puerta de atrás.
    assert not ({"gmail_fetch", "sheets_read_range", "sheets_update_range"} & names)


def test_write_tools_flags_writes_not_reads():
    assert "mp_charge" in tool_catalog.WRITE_TOOLS
    assert "calendar_book" in tool_catalog.WRITE_TOOLS
    assert "gmail_send" in tool_catalog.WRITE_TOOLS
    assert "gmail_fetch" not in tool_catalog.WRITE_TOOLS   # read


def test_index_resolves_service_tool():
    kind, *rest = tool_catalog.TOOL_INDEX["gmail_send"]
    assert kind == "service"


def test_index_resolves_first_class_tools():
    assert tool_catalog.TOOL_INDEX["calendar_book"] == ("calendar",)
    assert tool_catalog.TOOL_INDEX["mp_charge"] == ("mp",)


def test_required_of_returns_schema_required_fields():
    assert tool_catalog._required_of("gmail_send") == ["to", "body"]
    assert tool_catalog._required_of("tool_inexistente") == []


# A7 (poda de Drive, `800a56a0`): el control que de verdad lo sostiene es TOOL_INDEX (vía
# `drive.TOOLS`, que `_service_index()` recorre), no `/catalog` (`test_catalog_route.py:125` prueba
# la superficie de UI, nunca este índice). Hallazgo `H-A7SINTEST`: hasta este test, nada fallaba si
# alguien le agregaba un `TOOLS` a Drive de nuevo.
def test_drive_no_resuelve_en_tool_index():
    assert drive.TOOLS == {}
    idx = tool_catalog._service_index()
    assert not any(mod is drive for _kind, mod, _op in idx.values())


def test_drive_no_resuelve_en_tool_index_control_positivo(monkeypatch):
    """Control positivo del test de arriba: si `drive.TOOLS` deja de estar vacío, `_service_index()`
    tiene que exponerlo — si esto no detectara la regresión, el test anterior sería un cero sin
    control (canon 5)."""
    monkeypatch.setitem(drive.TOOLS, "drive_create_file", "create_file")
    idx = tool_catalog._service_index()
    assert idx["drive_create_file"] == ("service", drive, "create_file")
