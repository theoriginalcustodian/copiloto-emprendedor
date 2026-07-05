"""Catálogo de tools del motor ReAct (Task 5): build_tool_catalog / TOOL_INDEX / WRITE_TOOLS.

Verifica que el catálogo une los TOOL_SCHEMAS de los servicios descubiertos + las 2 tools de 1ra clase
(calendar_book, mp_charge), que el índice resuelve cada tool a su destino, y que WRITE_TOOLS distingue
EXACTO write de read (via el WRITE_OPS explícito de cada módulo — test_service_schemas.py ya cubre que
todos los módulos lo declaran; acá se verifica el consumo en tool_catalog)."""
import tool_catalog


def test_catalog_has_services_calendar_and_mp():
    names = {s["function"]["name"] for s in tool_catalog.build_tool_catalog()}
    assert {"gmail_send", "gmail_fetch", "calendar_book", "mp_charge"} <= names


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
